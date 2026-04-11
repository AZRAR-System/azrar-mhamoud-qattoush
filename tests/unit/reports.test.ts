import { jest } from '@jest/globals';
import { runReport } from '@/services/db/system/reports';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Reports Service Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.PROPERTIES, [
      { رقم_العقار: 'PR1', الكود_الداخلي: 'A-101', رقم_المالك: 'P-OWNER' }
    ]);
    save(KEYS.PEOPLE, [
      { رقم_الشخص: 'P-OWNER', الاسم: 'Owner Name' },
      { رقم_الشخص: 'P-TENANT', الاسم: 'Tenant Name' }
    ]);
    save(KEYS.CONTRACTS, [
      { 
        رقم_العقد: 'C1', 
        رقم_العقار: 'PR1', 
        رقم_المستاجر: 'P-TENANT', 
        حالة_العقد: 'نشط',
        تاريخ_البداية: '2024-01-01',
        تاريخ_النهاية: '2024-12-31'
      }
    ]);
    save(KEYS.INSTALLMENTS, [
      { 
        رقم_الكمبيالة: 'I1', 
        رقم_العقد: 'C1', 
        القيمة: 1000, 
        تاريخ_استحقاق: '2024-01-05', 
        حالة_الكمبيالة: 'مدفوع' 
      },
      { 
        رقم_الكمبيالة: 'I2', 
        رقم_العقد: 'C1', 
        القيمة: 1000, 
        تاريخ_استحقاق: '2024-02-05', 
        حالة_الكمبيالة: 'غير مدفوع' 
      }
    ]);
  });

  it('runReport: financial_summary: should calculate correct totals', () => {
    const report = runReport('financial_summary');
    
    expect(report.title).toBe('الملخص المالي');
    
    const expected = report.data.find((d: any) => d.item === 'إجمالي المتوقع')?.value;
    const paid = report.data.find((d: any) => d.item === 'إجمالي المحصل')?.value;
    
    expect(expected).toBe(2000);
    expect(paid).toBe(1000);
  });

  it('runReport: employee_commissions: should link users and properties correctly', () => {
    save(KEYS.USERS, [
      { اسم_المستخدم: 'user1', اسم_للعرض: 'Employee One' }
    ]);
    save(KEYS.COMMISSIONS, [
      { 
        رقم_العمولة: 'COM1', 
        رقم_العقد: 'C1', 
        اسم_المستخدم: 'user1', 
        المجموع: 500, 
        نوع_العمولة: 'Rental',
        تاريخ_العقد: '2024-01-10'
      }
    ]);

    const report = runReport('employee_commissions');
    expect(report.data).toHaveLength(1);
    expect(report.data[0].employee).toBe('Employee One');
    expect(report.data[0].property).toBe('A-101');
    expect(report.data[0].client).toBe('Tenant Name');
  });

  it('runReport: fallback: should handle unknown IDs gracefully', () => {
    const report = runReport('unknown_id');
    expect(report.title).toBe('تقرير غير مكتمل');
  });
});
