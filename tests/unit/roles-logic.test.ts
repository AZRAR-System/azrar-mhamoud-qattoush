import { normalizeRole, isRole, isSuperAdmin } from '@/utils/roles';

describe('Roles Utility - Comprehensive Suite', () => {
  // 1. Normalization
  test('normalizeRole - trims and lowercases roles', () => {
    expect(normalizeRole('  SuperAdmin  ')).toBe('superadmin');
    expect(normalizeRole('ADMIN')).toBe('admin');
  });

  test('normalizeRole - handles null/undefined', () => {
    expect(normalizeRole(null)).toBe('');
    expect(normalizeRole(undefined)).toBe('');
  });

  // 2. Role Check
  test('isRole - matches roles correctly', () => {
    expect(isRole('Admin', 'admin')).toBe(true);
    expect(isRole('staff', 'Manager')).toBe(false);
  });

  test('isRole - returns true if no required role', () => {
    expect(isRole('any', null)).toBe(true);
  });

  // 3. SuperAdmin Check
  test('isSuperAdmin - identifies superadmin correctly', () => {
    expect(isSuperAdmin('SuperAdmin')).toBe(true);
    expect(isSuperAdmin('admin')).toBe(false);
  });

  // 4. Case Sensitivity
  test('isRole - is case insensitive', () => {
    expect(isRole('MANAGER', 'manager')).toBe(true);
  });

  // 5. Edge cases
  test('normalizeRole - handles non-string inputs', () => {
    expect(normalizeRole(123)).toBe('123');
  });
});
