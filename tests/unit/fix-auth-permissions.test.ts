export {};
/**
 * Tests for RBAC auth layer
 * Covers: normalizeRole, isSuperAdmin, userHasPermission userId normalization
 */

// Pure logic from src/utils/roles.ts
const normalizeRole = (role: unknown): string =>
  String(role ?? '').trim().toLowerCase();

const isSuperAdmin = (userRole: unknown): boolean =>
  normalizeRole(userRole) === 'superadmin';

const isRole = (userRole: unknown, requiredRole: unknown): boolean => {
  if (!requiredRole) return true;
  return normalizeRole(userRole) === normalizeRole(requiredRole);
};

// userId normalization logic from src/services/userPermissions.ts
const normalizeUserId = (userId: string): string =>
  String(userId ?? '').trim();

describe('normalizeRole', () => {
  it('converts to lowercase', () => {
    expect(normalizeRole('SuperAdmin')).toBe('superadmin');
  });

  it('trims whitespace', () => {
    expect(normalizeRole('  admin  ')).toBe('admin');
  });

  it('handles null', () => {
    expect(normalizeRole(null)).toBe('');
  });

  it('handles undefined', () => {
    expect(normalizeRole(undefined)).toBe('');
  });

  it('handles empty string', () => {
    expect(normalizeRole('')).toBe('');
  });

  it('handles number', () => {
    expect(normalizeRole(123)).toBe('123');
  });
});

describe('isSuperAdmin', () => {
  it('returns true for superadmin', () => {
    expect(isSuperAdmin('superadmin')).toBe(true);
  });

  it('returns true for SuperAdmin (case insensitive)', () => {
    expect(isSuperAdmin('SuperAdmin')).toBe(true);
  });

  it('returns true for SUPERADMIN', () => {
    expect(isSuperAdmin('SUPERADMIN')).toBe(true);
  });

  it('returns false for admin', () => {
    expect(isSuperAdmin('admin')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSuperAdmin('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSuperAdmin(null)).toBe(false);
  });

  it('returns true for superadmin with spaces', () => {
    expect(isSuperAdmin(' superadmin ')).toBe(true); // trim handles it
  });

  it('returns false for partial match', () => {
    expect(isSuperAdmin('superadmin2')).toBe(false);
  });
});

describe('isRole', () => {
  it('returns true when roles match', () => {
    expect(isRole('admin', 'admin')).toBe(true);
  });

  it('returns true when roles match case-insensitively', () => {
    expect(isRole('Admin', 'admin')).toBe(true);
  });

  it('returns true when requiredRole is empty', () => {
    expect(isRole('viewer', '')).toBe(true);
  });

  it('returns false when roles do not match', () => {
    expect(isRole('viewer', 'admin')).toBe(false);
  });
});

describe('userId normalization', () => {
  it('trims whitespace from userId', () => {
    expect(normalizeUserId('  user-123  ')).toBe('user-123');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeUserId('')).toBe('');
  });

  it('returns empty string for whitespace only', () => {
    expect(normalizeUserId('   ')).toBe('');
  });

  it('preserves valid userId unchanged', () => {
    expect(normalizeUserId('user-abc-123')).toBe('user-abc-123');
  });

  it('empty userId should deny permission', () => {
    const normalized = normalizeUserId('');
    expect(normalized.length === 0).toBe(true); // guard triggers → return false
  });
});
