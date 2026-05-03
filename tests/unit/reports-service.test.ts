import { runReport, getAvailableReports } from '@/services/db/system/reports';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('getAvailableReports', () => {
  test('returns non-empty array', () => {
    const r = getAvailableReports();
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });
});

describe('runReport - fallback', () => {
  test('returns empty report for unknown id', () => {
    const r = runReport('unknown_report_id');
    expect(r.columns).toEqual([]);
    expect(r.data).toEqual([]);
  });
});

describe('runReport - financial_summary', () => {
  test('returns zeros when no installments', () => {
    const r = runReport('financial_summary');
    const row = (key: string) => (r.data as any[]).find(d => d.item === key)?.value ?? -1;
    expect(row('إجمالي المتوقع')).toBe(0);
    expect(row('إجمالي المحصل')).toBe(0);
  });

  test('totalExpected = 0 gives 0% collection rate', () => {
    const r = runReport('financial_summary');
    const summary = (r.summary as any[])?.[0];
    expect(summary?.value).toBe('0%');
  });

  test('calculates totals with paid installments', () => {
    kv.save(KEYS.INSTALLMENTS, [
      {
        رقم_الكمبيالة: 'I-1',
        رقم_العقد: 'C-1',
        نوع_الكمبيالة: 'إيجار',
        حالة_الكمبيالة: 'مدفوع',
        القيمة: 1000,
        المبلغ_المدفوع: 1000,
        القيمة_المتبقية: 0,
        تاريخ_استحقاق: '2025-01-01',
        تاريخ_الدفع: '2025-01-01',
      },
      {
        رقم_الكمبيالة: 'I-2',
        رقم_العقد: 'C-1',
        نوع_الكمبيالة: 'إيجار',
        حالة_الكمبيالة: 'غير مدفوع',
        القيمة: 500,
        المبلغ_المدفوع: 0,
        القيمة_المتبقية: 500,
        تاريخ_استحقاق: '2020-01-01',
      },
    ]);
    buildCache();
    const r = runReport('financial_summary');
    const row = (key: string) => (r.data as any[]).find(d => d.item === key)?.value ?? -1;
    expect(row('إجمالي المتوقع')).toBe(1500);
    expect(row('إجمالي المتأخر')).toBe(500);
  });

  test('ignores تأمين installments', () => {
    kv.save(KEYS.INSTALLMENTS, [
      { 
        رقم_الكمبيالة: 'I-T', 
        نوع_الكمبيالة: 'تأمين', 
        القيمة: 9999, 
        تاريخ_استحقاق: '2025-01-01',
        رقم_العقد: 'C-T',
        حالة_الكمبيالة: 'غير مدفوع'
      },
    ]);
    buildCache();
    const r = runReport('financial_summary');
    const row = (key: string) => (r.data as any[]).find(d => d.item === key)?.value ?? -1;
    expect(row('إجمالي المتوقع')).toBe(0);
  });
});

describe('runReport - employee_commissions', () => {
  test('returns report structure with no data', () => {
    const r = runReport('employee_commissions');
    expect(r.title).toBe('تقرير عمولات الموظفين');
    expect(Array.isArray(r.data)).toBe(true);
  });

  test('rental commission row - no matching contract', () => {
    kv.save(KEYS.COMMISSIONS, [{
      رقم_العمولة: 'COM-1',
      نوع_العمولة: 'Rental',
      رقم_العقد: 'C-MISSING',
      المجموع: 200,
      اسم_المستخدم: 'user1',
      تاريخ_العقد: '2026-01-15',
      يوجد_ادخال_عقار: false,
    }]);
    buildCache();
    const r = runReport('employee_commissions');
    const row = (r.data as any[])[0];
    expect(row.type).toBe('إيجار');
    expect(row.property).toBe('—');
  });

  test('sale commission row - no matching agreement', () => {
    kv.save(KEYS.COMMISSIONS, [{
      رقم_العمولة: 'COM-2',
      نوع_العمولة: 'Sale',
      رقم_الاتفاقية: 'AGR-MISSING',
      المجموع: 500,
      اسم_المستخدم: 'user1',
      تاريخ_العقد: '2026-02-10',
      يوجد_ادخال_عقار: false,
    }]);
    buildCache();
    const r = runReport('employee_commissions');
    const row = (r.data as any[])[0];
    expect(row.type).toBe('بيع');
    expect(row.property).toBe('—');
    expect(row.tier).toBe('N/A');
  });

  test('rental commission with intro enabled', () => {
    kv.save(KEYS.COMMISSIONS, [{
      رقم_العمولة: 'COM-3',
      نوع_العمولة: 'Rental',
      رقم_العقد: 'C-1',
      عمولة_المالك: 180,
      عمولة_المستأجر: 120,
      المجموع: 300,
      اسم_المستخدم: 'user1',
      تاريخ_العقد: '2026-01-01',
      يوجد_ادخال_عقار: true,
    }]);
    buildCache();
    const r = runReport('employee_commissions');
    const row = (r.data as any[])[0];
    expect(row.intro).toBeGreaterThan(0);
  });

  test('getMonthKey - DD/MM/YYYY format', () => {
    kv.save(KEYS.COMMISSIONS, [{
      رقم_العمولة: 'COM-4',
      نوع_العمولة: 'Rental',
      رقم_العقد: 'C-X',
      المجموع: 100,
      اسم_المستخدم: 'u',
      تاريخ_العقد: '15/03/2026',
      شهر_دفع_العمولة: '',
      يوجد_ادخال_عقار: false,
    }]);
    buildCache();
    const r = runReport('employee_commissions');
    expect((r.data as any[]).length).toBe(1);
  });

  test('getMonthKey - fallback to 0000-00 for invalid date', () => {
    kv.save(KEYS.COMMISSIONS, [{
      رقم_العمولة: 'COM-5',
      نوع_العمولة: 'Rental',
      رقم_العقد: 'C-X',
      المجموع: 100,
      اسم_المستخدم: 'u',
      تاريخ_العقد: 'invalid',
      شهر_دفع_العمولة: '',
      يوجد_ادخال_عقار: false,
    }]);
    buildCache();
    const r = runReport('employee_commissions');
    expect((r.data as any[]).length).toBe(1);
  });

  test('commission with matching contract and property', () => {
    kv.save(KEYS.PROPERTIES, [{ 
      رقم_العقار: 'PR-1', 
      الكود_الداخلي: 'P-CODE', 
      رقم_المالك: 'PER-1',
      النوع: 'شقة',
      العنوان: 'عمان',
      حالة_العقار: 'مؤجر',
      IsRented: true,
      المساحة: 100
    }]);
    kv.save(KEYS.PEOPLE, [
      { رقم_الشخص: 'PER-1', الاسم: 'المالك', رقم_الهاتف: '079' },
      { رقم_الشخص: 'PER-2', الاسم: 'المستأجر', رقم_الهاتف: '078' },
    ]);
    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'C-1', 
      رقم_العقار: 'PR-1', 
      رقم_المستاجر: 'PER-2',
      تاريخ_البداية: '2026-01-01',
      تاريخ_النهاية: '2026-12-31',
      مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 4800,
      تكرار_الدفع: 1,
      طريقة_الدفع: 'نقدي',
      حالة_العقد: 'نشط',
      isArchived: false,
      lateFeeType: 'none',
      lateFeeValue: 0,
      lateFeeGraceDays: 0
    }]);
    kv.save(KEYS.COMMISSIONS, [{
      رقم_العمولة: 'COM-6',
      نوع_العمولة: 'Rental',
      رقم_العقد: 'C-1',
      المجموع: 400,
      اسم_المستخدم: 'user1',
      تاريخ_العقد: '2026-03-01',
      يوجد_ادخال_عقار: false,
    }]);
    buildCache();
    const r = runReport('employee_commissions');
    const row = (r.data as any[])[0];
    expect(row.property).toBe('P-CODE');
    expect(row.client).toBe('المستأجر');
    expect(row.ownerName).toBe('المالك');
  });
});
