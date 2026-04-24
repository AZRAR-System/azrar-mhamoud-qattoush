import { localDbStorage, dbOk, dbFail } from '@/services/localDbStorage';

beforeEach(() => localStorage.clear());

describe('localDbStorage.getArray', () => {
  test('returns empty array when key not found', () => {
    expect(localDbStorage.getArray('missing_key')).toEqual([]);
  });

  test('returns parsed array when key exists', () => {
    localStorage.setItem('test_key', JSON.stringify([1, 2, 3]));
    expect(localDbStorage.getArray('test_key')).toEqual([1, 2, 3]);
  });
});

describe('localDbStorage.saveJson', () => {
  test('saves and retrieves data', () => {
    localDbStorage.saveJson('test_save', [{ id: 1 }]);
    const raw = localStorage.getItem('test_save');
    expect(JSON.parse(raw!)).toEqual([{ id: 1 }]);
  });
});

describe('dbOk', () => {
  test('returns success with data', () => {
    const r = dbOk({ id: 1 });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: 1 });
    expect(r.message).toBe('تمت العملية بنجاح');
  });

  test('returns success with custom message', () => {
    const r = dbOk(null, 'تم الحفظ');
    expect(r.message).toBe('تم الحفظ');
  });

  test('returns success without data', () => {
    const r = dbOk();
    expect(r.success).toBe(true);
    expect(r.data).toBeUndefined();
  });
});

describe('dbFail', () => {
  test('returns failure with message', () => {
    const r = dbFail('خطأ في الاتصال');
    expect(r.success).toBe(false);
    expect(r.message).toBe('خطأ في الاتصال');
  });

  test('returns failure with default message', () => {
    const r = dbFail();
    expect(r.success).toBe(false);
    expect(r.message).toBe('حدث خطأ');
  });
});
