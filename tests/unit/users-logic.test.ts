import { 
  getUsers, 
  addSystemUser, 
  authenticateUser, 
  deleteSystemUser, 
  updateUserStatus, 
  updateUserRole,
  changeUserPassword
} from '@/services/db/system/users';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';
import { save } from '@/services/db/kv';

describe('User Management Service - Comprehensive Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    // Initialize with a default super_admin using kv.save to ensure cache consistency
    const initialUsers = [
      { id: 'U-ROOT', اسم_المستخدم: 'admin', كلمة_المرور: '123', الدور: 'super_admin', isActive: true }
    ];
    save(KEYS.USERS, initialUsers as any);
  });

  // 1. Creation
  test('addSystemUser - creates new user successfully', async () => {
    await addSystemUser({ اسم_المستخدم: 'mahmoud', اسم_للعرض: 'Mahmoud Q.', الدور: 'admin', كلمة_المرور: 'pass123' });
    const all = getUsers();
    expect(all).toHaveLength(2);
    expect(all.find(u => u.اسم_المستخدم === 'mahmoud')).toBeDefined();
  });

  test('addSystemUser - fails on duplicate username', async () => {
    await expect(addSystemUser({ اسم_المستخدم: 'admin' }))
      .rejects.toThrow('اسم المستخدم موجود مسبقاً');
  });

  // 2. Authentication
  test('authenticateUser - succeeds with correct password', async () => {
    const result = await authenticateUser('admin', '123');
    expect(result.success).toBe(true);
  });

  test('authenticateUser - fails with wrong password', async () => {
    const result = await authenticateUser('admin', 'wrong');
    expect(result.success).toBe(false);
  });

  // 3. Status & Role
  test('updateUserStatus - deactivates user', async () => {
    const userId = getUsers()[0].id;
    updateUserStatus(userId, false);
    const result = await authenticateUser('admin', '123');
    expect(result.success).toBe(false);
  });

  test('updateUserRole - changes role when not the last super_admin', async () => {
    // Add another superadmin to allow changing the first one
    await addSystemUser({ اسم_المستخدم: 'admin2', الدور: 'super_admin', كلمة_المرور: '1' });
    const userId = getUsers().find(u => u.اسم_المستخدم === 'admin')?.id || '';
    updateUserRole(userId, 'employee');
    expect(getUsers().find(u => u.id === userId)?.الدور).toBe('employee');
  });

  test('updateUserRole - prevents changing last super_admin role', () => {
    const userId = getUsers()[0].id;
    expect(() => updateUserRole(userId, 'employee')).toThrow('لا يمكن تغيير دور آخر مدير نظام نشط');
  });

  // 4. Deletion Safety
  test('deleteSystemUser - prevents deleting the last active super_admin', () => {
    const userId = getUsers()[0].id;
    expect(() => deleteSystemUser(userId)).toThrow('لا يمكن حذف آخر مدير نظام نشط');
  });
});
