export const normalizeRole = (role: unknown): string => String(role ?? '').trim().toLowerCase();

export const isRole = (userRole: unknown, requiredRole: unknown): boolean => {
  if (!requiredRole) return true;
  return normalizeRole(userRole) === normalizeRole(requiredRole);
};

export const isSuperAdmin = (userRole: unknown): boolean => normalizeRole(userRole) === 'superadmin';
