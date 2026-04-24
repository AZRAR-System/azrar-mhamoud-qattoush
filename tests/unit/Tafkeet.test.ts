import { tafkeet } from '../../src/utils/tafkeet';
import { describe, it, expect } from '@jest/globals';

describe('Tafkeet Utility', () => {
    it('should convert 4200 correctly', () => {
        expect(tafkeet(4200)).toBe('أربعة آلاف ومائتان دينار أردني فقط لا غير');
    });

    it('should convert 350 correctly', () => {
        expect(tafkeet(350)).toBe('ثلاثمائة وخمسون دينار أردني فقط لا غير');
    });

    it('should convert 1234567 correctly', () => {
        expect(tafkeet(1234567)).toBe('مليون ومائتان وأربعة وثلاثون ألف وخمسمائة وسبعة وستون دينار أردني فقط لا غير');
    });

    it('should handle decimals (fils)', () => {
        expect(tafkeet(100.25)).toContain('دينار أردني وخمسة وعشرون فلس فقط لا غير');
    });
});

describe('tafkeet - edge cases', () => {
  test('converts number with remainder < 11', () => {
    const r = tafkeet(1005);
    expect(r).toContain('خمسة');
  });

  test('converts number with remainder 10-19 (teens)', () => {
    const r = tafkeet(1015);
    expect(r).toContain('خمسة عشر');
  });

  test('converts number with remainder >= 20', () => {
    const r = tafkeet(1025);
    expect(r).toContain('خمسة وعشرون');
  });

  test('converts 2 million', () => {
    const r = tafkeet(2000000);
    expect(r).toContain('مليونان');
  });

  test('converts 5 million (3-10 range)', () => {
    const r = tafkeet(5000000);
    expect(r).toContain('ملايين');
  });

  test('converts 15 million (>10 range)', () => {
    const r = tafkeet(15000000);
    expect(r).toContain('مليون');
  });
});
