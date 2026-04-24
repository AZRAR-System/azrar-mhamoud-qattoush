import { isRecord, isPlainRecord, hasUnknownProp } from '@/utils/unknown';

describe('isRecord', () => {
  test('returns true for object', () => expect(isRecord({})).toBe(true));
  test('returns true for array', () => expect(isRecord([])).toBe(true));
  test('returns false for null', () => expect(isRecord(null)).toBe(false));
  test('returns false for string', () => expect(isRecord('str')).toBe(false));
  test('returns false for number', () => expect(isRecord(42)).toBe(false));
  test('returns false for undefined', () => expect(isRecord(undefined)).toBe(false));
});

describe('isPlainRecord', () => {
  test('returns true for plain object', () => expect(isPlainRecord({ a: 1 })).toBe(true));
  test('returns false for array', () => expect(isPlainRecord([])).toBe(false));
  test('returns false for null', () => expect(isPlainRecord(null)).toBe(false));
  test('returns false for string', () => expect(isPlainRecord('x')).toBe(false));
});

describe('hasUnknownProp', () => {
  test('returns true when key exists', () => {
    const obj = { name: 'أحمد', age: 30 };
    expect(hasUnknownProp(obj, 'name')).toBe(true);
  });
  test('returns false when key missing', () => {
    expect(hasUnknownProp({ a: 1 }, 'b' as any)).toBe(false);
  });
  test('returns false for inherited properties', () => {
    expect(hasUnknownProp({}, 'toString' as any)).toBe(false);
  });
});
