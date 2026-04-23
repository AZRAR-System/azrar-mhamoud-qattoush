import { validateBeforeSave } from '../../src/services/db/schemas';
import { KEYS } from '../../src/services/db/keys';

describe('Schemas Logic - Strengthened Suite', () => {
  
  // 1. Valid Person
  test('Person - valid person succeeds', () => {
    const data = { 
      رقم_الشخص: 'P1', الاسم: 'محمد', رقم_الهاتف: '0501234567', نوع_الملف: 'فرد'
    };
    const res = validateBeforeSave(KEYS.PEOPLE, [data]);
    expect(res.valid).toBe(true);
  });

  // 2. Person - Invalid Type
  test('Person - missing required name fails', () => {
    const data = { رقم_الشخص: 'P1', رقم_الهاتف: '0501234567' };
    const res = validateBeforeSave(KEYS.PEOPLE, [data]);
    expect(res.valid).toBe(false);
    expect(res.errors?.[0]).toContain('الاسم');
  });

  // 3. Contract - Valid
  test('Contract - valid contract succeeds', () => {
    const data = {
      رقم_العقد: 'C1', رقم_العقار: 'Prop1', رقم_المستاجر: 'T1',
      تاريخ_البداية: '2026-01-01', تاريخ_النهاية: '2026-12-31', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 12000, تكرار_الدفع: 12, طريقة_الدفع: 'Cash', حالة_العقد: 'نشط',
      isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    };
    const res = validateBeforeSave(KEYS.CONTRACTS, [data]);
    expect(res.valid).toBe(true);
  });

  // 4. Contract - Negative Rent
  test('Contract - negative annual rent fails', () => {
    const data = {
      رقم_العقد: 'C1', رقم_العقار: 'Prop1', رقم_المستاجر: 'T1',
      تاريخ_البداية: '2026-01-01', تاريخ_النهاية: '2026-12-31', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: -100, تكرار_الدفع: 12, طريقة_الدفع: 'Cash', حالة_العقد: 'نشط',
      isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    };
    const res = validateBeforeSave(KEYS.CONTRACTS, [data]);
    expect(res.valid).toBe(false);
  });

  // 5. Contract - Missing propertyId
  test('Contract - missing propertyId fails', () => {
    const data = {
      رقم_العقد: 'C1', رقم_المستاجر: 'T1',
      تاريخ_البداية: '2026-01-01', تاريخ_النهاية: '2026-12-31', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 12000, تكرار_الدفع: 12, طريقة_الدفع: 'Cash', حالة_العقد: 'نشط',
      isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    };
    const res = validateBeforeSave(KEYS.CONTRACTS, [data]);
    expect(res.valid).toBe(false);
    expect(res.errors?.[0]).toContain('رقم_العقار');
  });

  // 6. Installment - Negative Amount
  test('Installment - negative value fails', () => {
    const data = {
      رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: '2026-01-01',
      القيمة: -50, حالة_الكمبيالة: 'غير مدفوع', نوع_الكمبيالة: 'كمبيالة'
    };
    const res = validateBeforeSave(KEYS.INSTALLMENTS, [data]);
    expect(res.valid).toBe(false);
  });

  // 7. Installment - Invalid Type for Fee
  test('Contract - invalid lateFeeType value fails', () => {
    const data = {
      رقم_العقد: 'C1', رقم_العقار: 'Prop1', رقم_المستاجر: 'T1',
      تاريخ_البداية: '2026-01-01', تاريخ_النهاية: '2026-12-31', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 12000, تكرار_الدفع: 12, طريقة_الدفع: 'Cash', حالة_العقد: 'نشط',
      isArchived: false, lateFeeType: 'INVALID_TYPE', lateFeeValue: 0, lateFeeGraceDays: 0
    };
    const res = validateBeforeSave(KEYS.CONTRACTS, [data]);
    expect(res.valid).toBe(false);
  });

  // 8. Property - Valid
  test('Property - valid property succeeds', () => {
    const data = {
      رقم_العقار: 'P1', الكود_الداخلي: 'INT-01', رقم_المالك: 'O1', النوع: 'شقة',
      العنوان: 'عمان', حالة_العقار: 'شاغر', IsRented: false, المساحة: 100
    };
    const res = validateBeforeSave(KEYS.PROPERTIES, [data]);
    expect(res.valid).toBe(true);
  });

  // 9. Property - Negative Area
  test('Property - negative area fails', () => {
    const data = {
      رقم_العقار: 'P1', الكود_الداخلي: 'INT-01', رقم_المالك: 'O1', النوع: 'شقة',
      العنوان: 'عمان', حالة_العقار: 'شاغر', IsRented: false, المساحة: -5
    };
    const res = validateBeforeSave(KEYS.PROPERTIES, [data]);
    expect(res.valid).toBe(false);
  });

  // 10. Installment - Multiple records validation
  test('Installment - fails if any item in array is invalid', () => {
    const data = [
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: '2026-01-01', القيمة: 100, حالة_الكمبيالة: 'Pending', نوع_الكمبيالة: 'Rent' },
      { رقم_الكمبيالة: 'I2', رقم_العقد: 'C1', تاريخ_استحقاق: '2026-01-01', القيمة: -50, حالة_الكمبيالة: 'Pending', نوع_الكمبيالة: 'Rent' }
    ];
    const res = validateBeforeSave(KEYS.INSTALLMENTS, data);
    expect(res.valid).toBe(false);
  });

  // 11. Person - Invalid email format
  test('Person - rejects non-individual/non-organization types', () => {
    const data = { 
      رقم_الشخص: 'P1', الاسم: 'محمد', رقم_الهاتف: '050', نوع_الملف: 'فضائي' 
    };
    const res = validateBeforeSave(KEYS.PEOPLE, [data]);
    expect(res.valid).toBe(false);
  });

  // 12. Contract - Zero repeat frequency
  test('Contract - zero repeat frequency fails', () => {
    const data = {
      رقم_العقد: 'C1', رقم_العقار: 'Prop1', رقم_المستاجر: 'T1',
      تاريخ_البداية: '2026-01-01', تاريخ_النهاية: '2026-12-31', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 12000, تكرار_الدفع: 0, طريقة_الدفع: 'Cash', حالة_العقد: 'نشط',
      isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    };
    const res = validateBeforeSave(KEYS.CONTRACTS, [data]);
    expect(res.valid).toBe(false);
  });
});
