import { tryParseJson, safeJsonParseArray, safeJsonParse } from '../../src/utils/json';

describe('utils/json', () => {
  describe('tryParseJson', () => {
    test('parses valid JSON object', () => {
      expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
    });
    test('parses valid JSON array', () => {
      expect(tryParseJson('[1,2,3]')).toEqual([1, 2, 3]);
    });
    test('returns null for invalid JSON', () => {
      expect(tryParseJson('not json')).toBeNull();
    });
    test('returns null for empty string', () => {
      expect(tryParseJson('')).toBeNull();
    });
    test('parses JSON string', () => {
      expect(tryParseJson('"hello"')).toBe('hello');
    });
    test('parses JSON number', () => {
      expect(tryParseJson('42')).toBe(42);
    });
    test('parses JSON null', () => {
      expect(tryParseJson('null')).toBeNull();
    });
  });

  describe('safeJsonParseArray', () => {
    test('parses valid JSON array string', () => {
      expect(safeJsonParseArray('[1,2,3]')).toEqual([1, 2, 3]);
    });
    test('returns empty array for invalid JSON', () => {
      expect(safeJsonParseArray('not json')).toEqual([]);
    });
    test('returns empty array for empty string', () => {
      expect(safeJsonParseArray('')).toEqual([]);
    });
    test('returns empty array for non-array JSON', () => {
      expect(safeJsonParseArray('{"a":1}')).toEqual([]);
    });
    test('handles non-string input', () => {
      expect(safeJsonParseArray(null)).toEqual([]);
      expect(safeJsonParseArray(undefined)).toEqual([]);
      expect(safeJsonParseArray(123)).toEqual([]);
    });
    test('handles whitespace string', () => {
      expect(safeJsonParseArray('   ')).toEqual([]);
    });
  });

  describe('safeJsonParse', () => {
    test('parses valid JSON', () => {
      expect(safeJsonParse<number>('42', 0)).toBe(42);
    });
    test('returns fallback for null input', () => {
      expect(safeJsonParse<number>(null, 99)).toBe(99);
    });
    test('returns fallback for undefined input', () => {
      expect(safeJsonParse<number>(undefined, 99)).toBe(99);
    });
    test('returns fallback for invalid JSON', () => {
      expect(safeJsonParse<number>('bad', 99)).toBe(99);
    });
    test('returns fallback for empty string', () => {
      expect(safeJsonParse<string>('', 'default')).toBe('default');
    });
    test('parses object JSON', () => {
      expect(safeJsonParse<{ a: number }>('{"a":1}', { a: 0 })).toEqual({ a: 1 });
    });
    test('parses array JSON', () => {
      expect(safeJsonParse<number[]>('[1,2]', [])).toEqual([1, 2]);
    });
  });
});
