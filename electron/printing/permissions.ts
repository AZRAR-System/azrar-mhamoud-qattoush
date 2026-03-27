import { kvGet } from '../db';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const parseJsonArray = (raw: string | null): unknown[] => {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  try {
    const parsed: unknown = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeRole = (role: unknown): string => {
  const s = String(role ?? '')
    .trim()
    .toLowerCase();
  return s.replace(/\s+/g, '');
};

const isSuperAdminRole = (role: unknown): boolean => {
  const s = normalizeRole(role);
  if (!s) return false;
  if (s.includes('superadmin')) return true;
  // Arabic/legacy best-effort.
  if (String(role ?? '').includes('سوبر')) return true;
  return false;
};

export const getDesktopUserById = (userId: string | undefined): Record<string, unknown> | null => {
  const id = String(userId ?? '').trim();
  if (!id) return null;
  const users = parseJsonArray(kvGet('db_users'));
  const found = users.find((u) => isRecord(u) && String(u.id ?? '').trim() === id);
  return isRecord(found) ? found : null;
};

export const desktopUserHasPermission = (
  userId: string | undefined,
  permissionCode: string
): boolean => {
  const id = String(userId ?? '').trim();
  const code = String(permissionCode ?? '').trim();
  if (!id || !code) return false;

  const user = getDesktopUserById(id);
  if (!user) return false;

  if (user.isActive === false) return false;
  if (isSuperAdminRole(user['الدور'] ?? user.role)) return true;

  const perms = parseJsonArray(kvGet('db_user_permissions'))
    .filter((p) => isRecord(p) && String(p.userId ?? '').trim() === id)
    .map((p) => String((p as Record<string, unknown>).permissionCode ?? '').trim())
    .filter(Boolean);

  return perms.includes(code);
};
