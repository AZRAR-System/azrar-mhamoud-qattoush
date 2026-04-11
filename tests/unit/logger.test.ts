import { logOperationInternal, getSystemLogs } from '@/services/db/operations/logger';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Logger Service', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.LOGS, []);
  });

  it('logOperationInternal: should persist log entries', () => {
    logOperationInternal('admin', 'Add', 'People', 'P1', 'Added John');
    
    const logs = getSystemLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].اسم_المستخدم).toBe('admin');
    expect(logs[0].نوع_العملية).toBe('Add');
    expect(logs[0].رقم_السجل).toBe('P1');
  });

  it('getSystemLogs: should return all entries', () => {
    logOperationInternal('admin', 'Add', 'People', 'P1', 'Added John');
    logOperationInternal('user1', 'Delete', 'Contracts', 'C1', 'Removed contract');

    const logs = getSystemLogs();
    expect(logs).toHaveLength(2);
  });
});
