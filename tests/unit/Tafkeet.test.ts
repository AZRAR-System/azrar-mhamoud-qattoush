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
