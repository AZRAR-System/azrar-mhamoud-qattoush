import { userHasPermission } from '../../src/services/userPermissions';
import { get } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';
import { isSuperAdmin, normalizeRole } from '../../src/utils/roles';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
}));

describe('Permissions & RBAC Logic - Comprehensive Suite', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Super Admin Bypass
  test('userHasPermission - returns true for SuperAdmin regardless of perms list', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.USERS) return [{ id: 'U1', الدور: 'SuperAdmin' }];
      if (key === KEYS.USER_PERMISSIONS) return [];
      return [];
    });
    
    expect(userHasPermission('U1', 'any_secret_permission')).toBe(true);
  });

  // 2. Specific Permission Grant
  test('userHasPermission - returns true if permission code is explicitly assigned', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.USERS) return [{ id: 'U2', الدور: 'Employee' }];
      if (key === KEYS.USER_PERMISSIONS) return [{ userId: 'U2', permissionCode: 'contracts_view' }];
      return [];
    });
    
    expect(userHasPermission('U2', 'contracts_view')).toBe(true);
  });

  // 3. Permission Denial
  test('userHasPermission - returns false if permission code is not assigned', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.USERS) return [{ id: 'U2', الدور: 'Employee' }];
      if (key === KEYS.USER_PERMISSIONS) return [{ userId: 'U2', permissionCode: 'contracts_view' }];
      return [];
    });
    
    expect(userHasPermission('U2', 'financial_delete')).toBe(false);
  });

  // 4. Non-Existent User
  test('userHasPermission - returns false for invalid user ID', () => {
    (get as jest.Mock).mockReturnValue([]);
    expect(userHasPermission('NON-EXISTENT', 'contracts_view')).toBe(false);
  });

  // 5. Role Normalization
  test('normalizeRole - handles Arabic and English variants', () => {
    expect(normalizeRole('SuperAdmin')).toBe('superadmin');
    expect(normalizeRole('أدمن')).toBe('أدمن');
    expect(normalizeRole('موظف')).toBe('موظف');
  });

  // 6. SuperAdmin Check
  test('isSuperAdmin - correctly identifies root roles', () => {
    expect(isSuperAdmin('superadmin')).toBe(true);
    expect(isSuperAdmin('admin')).toBe(false);
    expect(isSuperAdmin('owner')).toBe(false);
  });

  // 7. Case Sensitivity & Trimming
  test('userHasPermission - handles whitespace and casing in IDs', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.USERS) return [{ id: 'U1', الدور: 'SuperAdmin' }];
      return [];
    });
    
    expect(userHasPermission(' U1 ', 'view')).toBe(true);
  });

  // 8. Multiple User Permissions
  test('userHasPermission - handles multiple users with different permissions correctly', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.USERS) return [
        { id: 'U1', الدور: 'Employee' },
        { id: 'U2', الدور: 'Employee' }
      ];
      if (key === KEYS.USER_PERMISSIONS) return [
        { userId: 'U1', permissionCode: 'view' },
        { userId: 'U2', permissionCode: 'edit' }
      ];
      return [];
    });
    
    expect(userHasPermission('U1', 'view')).toBe(true);
    expect(userHasPermission('U1', 'edit')).toBe(false);
    expect(userHasPermission('U2', 'edit')).toBe(true);
  });
});
