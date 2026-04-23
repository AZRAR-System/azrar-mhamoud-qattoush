import { validateBeforeSave } from '../../src/services/db/schemas';
import { KEYS } from '../../src/services/db/keys';

describe('Schemas Validation', () => {
  test('valid contract succeeds', () => {
    const validContract = {
      رقم_العقد: 'COT-1',
      رقم_العقار: 'PROP-1',
      رقم_المستاجر: 'TEN-1',
      تاريخ_البداية: '2026-01-01',
      تاريخ_النهاية: '2026-12-31',
      مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 12000,
      تكرار_الدفع: 12,
      طريقة_الدفع: 'نقدي',
      حالة_العقد: 'نشط',
      isArchived: false,
      lateFeeType: 'none',
      lateFeeValue: 0,
      lateFeeGraceDays: 0,
    };
    
    const result = validateBeforeSave(KEYS.CONTRACTS, [validContract]);
    expect(result.valid).toBe(true);
  });

  test('contract missing tenantId fails', () => {
    const invalidContract = {
      رقم_العقد: 'COT-1',
      رقم_العقار: 'PROP-1',
      // missing رقم_المستاجر
      تاريخ_البداية: '2026-01-01',
      تاريخ_النهاية: '2026-12-31',
      مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 12000,
      تكرار_الدفع: 12,
      طريقة_الدفع: 'نقدي',
      حالة_العقد: 'نشط',
      isArchived: false,
      lateFeeType: 'none',
      lateFeeValue: 0,
      lateFeeGraceDays: 0,
    };
    
    const result = validateBeforeSave(KEYS.CONTRACTS, [invalidContract]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('رقم_المستاجر'));
  });

  test('contract with invalid lateFeeType fails', () => {
    const invalidContract = {
      رقم_العقد: 'COT-1',
      رقم_العقار: 'PROP-1',
      رقم_المستاجر: 'TEN-1',
      تاريخ_البداية: '2026-01-01',
      تاريخ_النهاية: '2026-12-31',
      مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 12000,
      تكرار_الدفع: 12,
      طريقة_الدفع: 'نقدي',
      حالة_العقد: 'نشط',
      isArchived: false,
      lateFeeType: 'INVALID_TYPE', // Enum check
      lateFeeValue: 0,
      lateFeeGraceDays: 0,
    };
    
    const result = validateBeforeSave(KEYS.CONTRACTS, [invalidContract]);
    expect(result.valid).toBe(false);
  });
});
