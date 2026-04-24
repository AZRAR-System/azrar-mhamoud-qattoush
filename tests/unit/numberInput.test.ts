import {
  normalizeDigitsToLatin,
  normalizeNumericString,
  parseNumberOrUndefined,
  parseIntOrUndefined,
} from '@/utils/numberInput';

describe('normalizeDigitsToLatin', () => {
  test('converts Arabic-Indic digits', () => {
    expect(normalizeDigitsToLatin('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  test('converts Persian digits', () => {
    expect(normalizeDigitsToLatin('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  test('converts Arabic decimal separator', () => {
    expect(normalizeDigitsToLatin('١٢٫٥')).toBe('12.5');
  });

  test('converts Arabic thousands separator', () => {
    expect(normalizeDigitsToLatin('١٬٠٠٠')).toBe('1,000');
  });

  test('leaves Latin digits unchanged', () => {
    expect(normalizeDigitsToLatin('123.45')).toBe('123.45');
  });

  test('handles empty string', () => {
    expect(normalizeDigitsToLatin('')).toBe('');
  });

  test('handles non-digit characters', () => {
    expect(normalizeDigitsToLatin('abc')).toBe('abc');
  });
});

describe('normalizeNumericString', () => {
  test('removes commas', () => {
    expect(normalizeNumericString('1,000')).toBe('1000');
  });

  test('trims whitespace', () => {
    expect(normalizeNumericString('  42  ')).toBe('42');
  });

  test('converts Arabic digits and removes commas', () => {
    expect(normalizeNumericString('١٬٠٠٠')).toBe('1000');
  });

  test('handles empty string', () => {
    expect(normalizeNumericString('')).toBe('');
  });
});

describe('parseNumberOrUndefined', () => {
  test('parses valid number', () => {
    expect(parseNumberOrUndefined('42')).toBe(42);
    expect(parseNumberOrUndefined('3.14')).toBe(3.14);
  });

  test('returns undefined for empty string', () => {
    expect(parseNumberOrUndefined('')).toBeUndefined();
  });

  test('returns undefined for non-numeric string', () => {
    expect(parseNumberOrUndefined('abc')).toBeUndefined();
  });

  test('parses Arabic digits', () => {
    expect(parseNumberOrUndefined('٤٢')).toBe(42);
  });

  test('returns undefined for Infinity', () => {
    expect(parseNumberOrUndefined('Infinity')).toBeUndefined();
  });
});

describe('parseIntOrUndefined', () => {
  test('parses and truncates decimal', () => {
    expect(parseIntOrUndefined('3.9')).toBe(3);
    expect(parseIntOrUndefined('42')).toBe(42);
  });

  test('returns undefined for empty string', () => {
    expect(parseIntOrUndefined('')).toBeUndefined();
  });

  test('returns undefined for non-numeric', () => {
    expect(parseIntOrUndefined('xyz')).toBeUndefined();
  });

  test('truncates negative decimal', () => {
    expect(parseIntOrUndefined('-3.9')).toBe(-3);
  });
});
