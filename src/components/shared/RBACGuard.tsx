import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleType, PermissionCode } from '@/types';
import { DbService } from '@/services/mockDb';
import { isSuperAdmin, normalizeRole } from '@/utils/roles';

interface RBACGuardProps {
  children: React.ReactNode;
  requiredRole?: RoleType | RoleType[]; // e.g., 'Admin' or ['Admin', 'SuperAdmin']
  requiredPermission?: PermissionCode;
  requiredPermissionsAny?: PermissionCode[];
  requiredPermissionsAll?: PermissionCode[];
  fallback?: React.ReactNode;
}

export const RBACGuard: React.FC<RBACGuardProps> = ({
  children,
  requiredRole,
  requiredPermission,
  requiredPermissionsAny,
  requiredPermissionsAll,
  fallback = null,
}) => {
  const { user } = useAuth();

  if (!user) return <>{fallback}</>;

  // 1. Role Check
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userRole = normalizeRole(user.الدور);
    const allowed = roles.map((r) => normalizeRole(r));

    // SuperAdmin bypasses role check (implied, but safe to keep explicit)
    if (!isSuperAdmin(userRole) && !allowed.includes(userRole)) {
      return <>{fallback}</>;
    }
  }

  // 2. Permission Check
  const checkPermission = (permissionCode: PermissionCode) =>
    DbService.userHasPermission(user.id, permissionCode);

  if (requiredPermission) {
    if (!checkPermission(requiredPermission)) return <>{fallback}</>;
  }

  if (Array.isArray(requiredPermissionsAll) && requiredPermissionsAll.length > 0) {
    for (const p of requiredPermissionsAll) {
      if (!checkPermission(p)) return <>{fallback}</>;
    }
  }

  if (Array.isArray(requiredPermissionsAny) && requiredPermissionsAny.length > 0) {
    let allowed = false;
    for (const p of requiredPermissionsAny) {
      if (checkPermission(p)) {
        allowed = true;
        break;
      }
    }
    if (!allowed) return <>{fallback}</>;
  }

  return <>{children}</>;
};
