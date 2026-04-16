/**
 * فحص صلاحيات المستخدم بدون استيراد mockDb بالكامل (للاستخدام في الشل الأولي مثل RBACGuard).
 */

import { get } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import type { المستخدمين_tbl, مستخدم_صلاحية_tbl } from '@/types';
import { isSuperAdmin, normalizeRole } from '@/utils/roles';

export function userHasPermission(userId: string, permission: string): boolean {
  const normalizedUserId = String(userId ?? '').trim();
  if (!normalizedUserId) return false;
  const user = get<المستخدمين_tbl>(KEYS.USERS).find((u) => u.id === normalizedUserId);
  if (!user) return false;
  if (isSuperAdmin(normalizeRole(user.الدور))) return true;
  const perms = get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS)
    .filter((p) => p.userId === userId)
    .map((p) => p.permissionCode);
  return perms.includes(permission);
}
