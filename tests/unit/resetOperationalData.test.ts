import { resetOperationalData } from '@/services/db/resetOperationalData';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
  delete (window as any).desktopDb;
});

afterEach(() => {
  delete (window as any).desktopDb;
});

describe('resetOperationalData', () => {
  test('returns success result', () => {
    const r = resetOperationalData();
    expect(r.success).toBe(true);
    expect(r.deletedTables).toBeGreaterThan(0);
    expect(r.propertiesReset).toBe(true);
    expect(r.timestamp).toBeTruthy();
  });

  test('clears localStorage keys', () => {
    localStorage.setItem('db_people', JSON.stringify([{ id: 1 }]));
    localStorage.setItem('db_contracts', JSON.stringify([{ id: 2 }]));
    resetOperationalData();
    expect(localStorage.getItem('db_people')).toBeNull();
    expect(localStorage.getItem('db_contracts')).toBeNull();
  });

  test('calls desktop resetAll when available', () => {
    const resetAll = jest.fn();
    const deleteFn = jest.fn().mockResolvedValue(true);
    (window as any).desktopDb = { resetAll, delete: deleteFn, set: jest.fn() };
    resetOperationalData();
    expect(resetAll).toHaveBeenCalled();
  });

  test('works when desktop has no resetAll function', () => {
    (window as any).desktopDb = { someOtherMethod: jest.fn(), delete: jest.fn().mockResolvedValue(true) } as any;
    expect(() => resetOperationalData()).not.toThrow();
  });

  test('works in non-desktop mode', () => {
    expect(() => resetOperationalData()).not.toThrow();
  });

  test('returns correct message', () => {
    const r = resetOperationalData();
    expect(r.message).toContain('تم مسح');
  });
});
