import { validateBeforeSave } from '../../src/services/db/schemas';
import { KEYS } from '../../src/services/db/keys';

describe('Schemas Real Validation', () => {
  
  describe('Person Schema', () => {
    test('valid person succeeds', () => {
      const data = { 
        رقم_الشخص: 'P1', 
        الاسم: 'محمد', 
        رقم_الهاتف: '0501234567',
        نوع_الملف: 'فرد'
      };
      const res = validateBeforeSave(KEYS.PEOPLE, [data]);
      expect(res.valid).toBe(true);
    });

    test('missing required phone fails', () => {
      const data = { رقم_الشخص: 'P1', الاسم: 'محمد' };
      const res = validateBeforeSave(KEYS.PEOPLE, [data]);
      expect(res.valid).toBe(false);
      expect(res.errors?.[0]).toContain('رقم_الهاتف');
    });
  });

  describe('Contract Schema', () => {
    test('valid contract succeeds', () => {
      const data = {
        رقم_العقد: 'C1',
        رقم_العقار: 'Prop1',
        رقم_المستاجر: 'T1',
        القيمة_السنوية: 12000,
        تاريخ_البداية: '2026-01-01',
        تاريخ_النهاية: '2026-12-31',
        مدة_العقد_بالاشهر: 12,
        تكرار_الدفع: 12,
        طريقة_الدفع: 'Cash',
        حالة_العقد: 'نشط',
        isArchived: false,
        lateFeeType: 'none',
        lateFeeValue: 0,
        lateFeeGraceDays: 0
      };
      const res = validateBeforeSave(KEYS.CONTRACTS, [data]);
      expect(res.valid).toBe(true);
    });

    test('negative rent fails', () => {
      const data = {
        رقم_العقد: 'C1',
        رقم_العقار: 'Prop1',
        رقم_المستاجر: 'T1',
        القيمة_السنوية: -1000,
        تاريخ_البداية: '2026-01-01',
        تاريخ_النهاية: '2026-12-31',
        مدة_العقد_بالاشهر: 12,
        تكرار_الدفع: 12,
        طريقة_الدفع: 'Cash',
        حالة_العقد: 'نشط',
        isArchived: false,
        lateFeeType: 'none',
        lateFeeValue: 0,
        lateFeeGraceDays: 0
      };
      const res = validateBeforeSave(KEYS.CONTRACTS, [data]);
      expect(res.valid).toBe(false);
    });
  });
});
