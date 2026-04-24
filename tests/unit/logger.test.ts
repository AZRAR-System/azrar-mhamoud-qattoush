import { logOperationInternal, getSystemLogs, clearSystemLogs } from '@/services/db/operations/logger';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('logOperationInternal', () => {
  test('adds log entry', () => {
    logOperationInternal('Admin', 'إضافة', 'Contracts', 'C-1', 'تفاصيل');
    const logs = getSystemLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[logs.length - 1].نوع_العملية).toBe('إضافة');
  });

  test('logs with meta', () => {
    logOperationInternal('Admin', 'حذف', 'People', 'P-1', 'حذف شخص', {
      ipAddress: '192.168.1.1',
      deviceInfo: 'Windows 11',
    });
    const logs = getSystemLogs();
    const last = logs[logs.length - 1];
    expect(last.ipAddress).toBe('192.168.1.1');
    expect(last.deviceInfo).toBe('Windows 11');
  });

  test('uses System as default user', () => {
    logOperationInternal('', 'تعديل', 'Properties', 'PR-1', 'تفاصيل');
    const logs = getSystemLogs();
    expect(logs[logs.length - 1].اسم_المستخدم).toBe('System');
  });
});

describe('clearSystemLogs', () => {
  test('clears all logs', () => {
    logOperationInternal('Admin', 'إضافة', 'Test', 'T-1', 'x');
    clearSystemLogs();
    expect(getSystemLogs()).toHaveLength(0);
  });
});
