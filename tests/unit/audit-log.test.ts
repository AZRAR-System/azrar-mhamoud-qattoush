import { auditLog } from '../../src/services/auditLog';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

describe('Audit Log Logic - Comprehensive Suite', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // 1. Record Action
  test('record - creates and saves a new audit entry', () => {
    (get as jest.Mock).mockReturnValue([]);
    const res = auditLog.record('Create', 'Contract', 'C1', 'New lease');
    
    expect(res.action).toBe('Create');
    expect(res.entity).toBe('Contract');
    expect(save).toHaveBeenCalledWith(KEYS.AUDIT_LOG, expect.arrayContaining([res]));
  });

  // 2. Capacity Limit
  test('record - maintains maximum 500 records by slicing old ones', () => {
    const existing = new Array(500).fill(null).map((_, i) => ({ id: `A${i}` }));
    (get as jest.Mock).mockReturnValue(existing);
    
    auditLog.record('Action', 'Table');
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved).toHaveLength(500);
    expect(saved[0].id).toContain('AUD-');
    expect(saved[499].id).toBe('A498'); // Last one should be shifted out
  });

  // 3. User Resolution
  test('record - resolves userId from username if not provided', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.USERS) return [{ id: 'U1', اسم_المستخدم: 'mahmoud' }];
      if (key === KEYS.AUDIT_LOG) return [];
      return [];
    });

    const res = auditLog.record('Action', 'Table', 'ID', 'Details', { userName: 'mahmoud' });
    expect(res.userId).toBe('U1');
  });

  // 4. Actor from Storage
  test('record - defaults to actor in localStorage if no user info provided', () => {
    localStorage.setItem('khaberni_user', JSON.stringify({ id: 'U2', اسم_للعرض: 'Admin' }));
    (get as jest.Mock).mockReturnValue([]);

    const res = auditLog.record('Action', 'Table');
    expect(res.userName).toBe('Admin');
    expect(res.userId).toBe('U2');
  });

  // 5. System Actor
  test('record - defaults to System if storage is empty', () => {
    (get as jest.Mock).mockReturnValue([]);
    const res = auditLog.record('Action', 'Table');
    expect(res.userName).toBe('System');
  });

  // 6. Legacy Log Integration
  test('appendFromLegacyLog - maps legacy parameters to record correctly', () => {
    (get as jest.Mock).mockReturnValue([]);
    auditLog.appendFromLegacyLog('UserA', 'Delete', 'People', 'P1', 'Force delete', { ipAddress: '1.1.1.1' });
    
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved[0].action).toBe('Delete');
    expect(saved[0].ip).toBe('1.1.1.1');
    expect(saved[0].userName).toBe('UserA');
  });

  // 7. Get All
  test('getAll - returns valid records from storage', () => {
    (get as jest.Mock).mockReturnValue([{ id: 'A1' }, { id: 'A2' }, null]);
    const all = auditLog.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('A1');
  });

  // 8. Event Dispatching
  test('record - dispatches db-changed event on window', () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    (get as jest.Mock).mockReturnValue([]);
    
    auditLog.record('Action', 'Table');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'azrar:db-changed'
    }));
  });
});
