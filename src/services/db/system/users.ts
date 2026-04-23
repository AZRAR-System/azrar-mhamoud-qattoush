import { get, save } from '../kv';
import { KEYS } from '../keys';
import { المستخدمين_tbl, مستخدم_صلاحية_tbl, RoleType, DbResult } from '@/types';
import { isSuperAdmin } from '@/utils/roles';
import { hashPassword, isHashedPassword, verifyPassword } from '@/services/passwordHash';
import { userHasPermission as userHasPermissionCore } from '@/services/userPermissions';
import { logOperationInternal } from '../operations/logger';
import { dbFail, dbOk } from '@/services/localDbStorage';

const ok = dbOk;
const fail = dbFail;

/**
 * User management and authentication service
 */

export const getUsers = (): المستخدمين_tbl[] => get<المستخدمين_tbl>(KEYS.USERS);

export const getCurrentUser = (): المستخدمين_tbl | null => {
  const all = getUsers();
  // Assume for now we just return the first active user if not specified, 
  // though in a real app this would call an auth state service.
  return all.find(u => u.isActive) || null;
};

export const authenticateUser = async (u: string, p: string): Promise<DbResult<المستخدمين_tbl>> => {
  const username = String(u || '').trim();
  const password = String(p || '');
  if (!username || !password) return fail('Invalid credentials');

  const all = getUsers();
  const idx = all.findIndex((x) => String(x.اسم_المستخدم || '').trim() === username);
  if (idx < 0) return fail('Invalid credentials');

  const user = all[idx];
  if (!user || !user.isActive) return fail('Invalid credentials');

  const stored = String(user.كلمة_المرور || '');
  const okPass = await verifyPassword(password, stored);
  if (!okPass) {
    logAuthAttempt({ username, result: 'FAILED', reason: 'wrong password' });
    return fail('Invalid credentials');
  }

  // Opportunistic upgrade: if we matched a legacy plaintext password, replace with a hash.
  try {
    if (stored && !isHashedPassword(stored)) {
      const upgraded = await hashPassword(password);
      all[idx] = { ...user, كلمة_المرور: upgraded };
      save(KEYS.USERS, all);
    }
  } catch { /* ignore */ }

  logAuthAttempt({ username, result: 'SUCCESS', userId: String(user.id || '') });
  return ok(user);
};

export const logAuthAttempt = (payload: {
  username: string;
  result: 'SUCCESS' | 'FAILED' | 'LOCKED';
  reason?: string;
  userId?: string;
  fails?: number;
  lockedUntil?: number;
  deviceInfo?: string;
}) => {
  try {
    const username = String(payload?.username || '').trim();
    if (!username) return;

    const result = payload.result;
    const action =
      result === 'SUCCESS'
        ? 'AUTH_LOGIN_SUCCESS'
        : result === 'LOCKED'
          ? 'AUTH_LOGIN_LOCKED'
          : 'AUTH_LOGIN_FAILED';

    const recordId = String(payload?.userId || username).trim();
    const parts: string[] = [];
    if (payload?.reason) parts.push(String(payload.reason));
    if (typeof payload?.fails === 'number' && Number.isFinite(payload.fails))
      parts.push(`fails=${payload.fails}`);
    
    logOperationInternal(username, action, 'Auth', recordId, parts.join(' | '), {
      ipAddress: 'local',
      deviceInfo: String(payload?.deviceInfo || '').slice(0, 220),
    });
  } catch { /* ignore */ }
};

export const userHasPermission = (userId: string, permission: string): boolean =>
  userHasPermissionCore(userId, permission);

export const getUserPermissions = (userId: string): string[] =>
  get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS)
    .filter((p) => p.userId === userId)
    .map((p) => p.permissionCode);

export const updateUserPermissions = (userId: string, perms: string[]) => {
  const all = get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS).filter((p) => p.userId !== userId);
  perms.forEach((code) => all.push({ userId, permissionCode: code }));
  save(KEYS.USER_PERMISSIONS, all);
};

export const updateUserRole = (userId: string, role: RoleType) => {
  const all = getUsers();
  const idx = all.findIndex((u) => u.id === userId);
  if (idx > -1) {
    const target = all[idx];
    // Prevent changing the role of the last superadmin
    if (isSuperAdmin(target.الدور) && !isSuperAdmin(role)) {
      const others = all.filter(u => u.id !== userId && isSuperAdmin(u.الدور) && u.isActive);
      if (others.length === 0) {
        throw new Error('لا يمكن تغيير دور آخر مدير نظام نشط');
      }
    }
    all[idx].الدور = role;
    save(KEYS.USERS, all);
  }
};

export const updateUserStatus = (id: string, status: boolean) => {
  const all = getUsers();
  const idx = all.findIndex((u) => u.id === id);
  if (idx > -1) {
    all[idx].isActive = status;
    save(KEYS.USERS, all);
  }
};

export const deleteSystemUser = (id: string) => {
  const all = getUsers();
  const target = all.find(u => u.id === id);
  if (!target) return;

  // Prevent deleting the last superadmin
  if (isSuperAdmin(target.الدور)) {
    const others = all.filter(u => u.id !== id && isSuperAdmin(u.الدور) && u.isActive);
    if (others.length === 0) {
      throw new Error('لا يمكن حذف آخر مدير نظام نشط');
    }
  }

  const updated = all.filter((u) => u.id !== id);
  save(KEYS.USERS, updated);
};

export const addSystemUser = async (user: Partial<المستخدمين_tbl>) => {
  const all = getUsers();
  const candidateUsername = String(user.اسم_المستخدم || '').trim();
  if (!candidateUsername) throw new Error('اسم المستخدم مطلوب');
  if (all.some((u) => String(u.اسم_المستخدم || '').trim() === candidateUsername)) {
    throw new Error('اسم المستخدم موجود مسبقاً');
  }

  const rawPassword = String(user.كلمة_المرور || '');
  const storedPassword = rawPassword ? await hashPassword(rawPassword) : '';

  const newUser: المستخدمين_tbl = {
    id: `USR-${Date.now()}`,
    اسم_المستخدم: candidateUsername,
    اسم_للعرض: user.اسم_للعرض,
    كلمة_المرور: storedPassword,
    الدور: user.الدور || 'Employee',
    linkedPersonId: user.linkedPersonId,
    isActive: true,
  };
  save(KEYS.USERS, [...all, newUser]);
};

export const changeUserPassword = async (userId: string, newPassword: string, actorUserId?: string) => {
  const targetId = String(userId || '').trim();
  const actorId = String(actorUserId || '').trim();
  const password = String(newPassword || '');

  if (!targetId) throw new Error('معرّف المستخدم غير صالح');
  if (!password.trim()) throw new Error('كلمة المرور مطلوبة');

  const all = getUsers();
  const idx = all.findIndex((u) => String(u.id || '').trim() === targetId);
  if (idx < 0) throw new Error('المستخدم غير موجود');

  const storedPassword = await hashPassword(password.trim());
  const beforeUsername = String(all[idx]?.اسم_المستخدم || '').trim();

  all[idx] = { ...all[idx], كلمة_المرور: storedPassword };
  save(KEYS.USERS, all);

  try {
    const actorName = actorId
      ? String(all.find((u) => String(u.id || '').trim() === actorId)?.اسم_المستخدم || '').trim()
      : 'System';
    logOperationInternal(actorName, 'USERS_CHANGE_PASSWORD', 'Users', targetId, `target=${beforeUsername}`);
  } catch { /* ignore */ }
};

export const getPermissionDefinitions = () => [
  { code: 'ADD_PERSON', label: 'إضافة أشخاص', category: 'Persons' },
  { code: 'EDIT_PERSON', label: 'تعديل أشخاص', category: 'Persons' },
  { code: 'DELETE_PERSON', label: 'حذف أشخاص', category: 'Persons' },
  { code: 'ADD_PROPERTY', label: 'إضافة عقارات', category: 'Properties' },
  { code: 'EDIT_PROPERTY', label: 'تعديل عقارات', category: 'Properties' },
  { code: 'DELETE_PROPERTY', label: 'حذف عقارات', category: 'Properties' },
  { code: 'CREATE_CONTRACT', label: 'إنشاء عقود', category: 'Contracts' },
  { code: 'DELETE_CONTRACT', label: 'حذف/أرشفة عقود', category: 'Contracts' },
  { code: 'EDIT_MAINTENANCE', label: 'تعديل تذاكر الصيانة', category: 'Maintenance' },
  { code: 'CLOSE_MAINTENANCE', label: 'إنهاء/إغلاق تذاكر الصيانة', category: 'Maintenance' },
  { code: 'DELETE_MAINTENANCE', label: 'حذف تذاكر الصيانة', category: 'Maintenance' },
  { code: 'SETTINGS_ADMIN', label: 'إدارة الإعدادات', category: 'System' },
  { code: 'SETTINGS_AUDIT', label: 'سجل العمليات', category: 'System' },
  { code: 'MANAGE_USERS', label: 'إدارة المستخدمين', category: 'System' },
  { code: 'BLACKLIST_VIEW', label: 'عرض القائمة السوداء', category: 'Security' },
  { code: 'BLACKLIST_ADD', label: 'إضافة للقائمة السوداء', category: 'Security' },
  { code: 'BLACKLIST_REMOVE', label: 'رفع الحظر (إزالة)', category: 'Security' },
];
