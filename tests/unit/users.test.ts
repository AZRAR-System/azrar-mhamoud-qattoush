import { 
  getUsers, 
  authenticateUser, 
  addSystemUser, 
  updateUserRole, 
  updateUserStatus, 
  deleteSystemUser,
  changeUserPassword,
  getUserPermissions,
  updateUserPermissions
} from '@/services/db/system/users';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Users System Service - Auth and RBAC Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('addSystemUser and authenticateUser', async () => {
    await addSystemUser({ 
      اسم_المستخدم: 'admin', 
      كلمة_المرور: 'pass123', 
      الدور: 'SuperAdmin' 
    });
    
    const res = await authenticateUser('admin', 'pass123');
    expect(res.success).toBe(true);
    expect(res.data?.اسم_المستخدم).toBe('admin');
    
    const failRes = await authenticateUser('admin', 'wrong');
    expect(failRes.success).toBe(false);
  });

  test('updateUserRole - prevents removing last superadmin', async () => {
    await addSystemUser({ اسم_المستخدم: 'sa', كلمة_المرور: '1', الدور: 'SuperAdmin' });
    const user = getUsers()[0];
    
    expect(() => updateUserRole(user.id, 'Employee')).toThrow('آخر مدير نظام نشط');
  });

  test('updateUserStatus and deleteSystemUser', async () => {
    await addSystemUser({ اسم_المستخدم: 'u1', كلمة_المرور: '1', الدور: 'Employee' });
    const user = getUsers()[0];
    
    updateUserStatus(user.id, false);
    expect(getUsers()[0].isActive).toBe(false);
    
    deleteSystemUser(user.id);
    expect(getUsers()).toHaveLength(0);
  });

  test('changeUserPassword - updates hash', async () => {
    await addSystemUser({ اسم_المستخدم: 'u1', كلمة_المرور: 'old', الدور: 'Employee' });
    const user = getUsers()[0];
    
    await changeUserPassword(user.id, 'new_pass');
    const res = await authenticateUser('u1', 'new_pass');
    expect(res.success).toBe(true);
  });

  test('User Permissions - CRUD', () => {
    updateUserPermissions('USR-1', ['ADD_PERSON', 'EDIT_PERSON']);
    const perms = getUserPermissions('USR-1');
    expect(perms).toContain('ADD_PERSON');
    expect(perms).toHaveLength(2);
  });
});
