import { runReport, getAvailableReports } from '@/services/db/system/reports';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Reports System Service - Analytics Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('getAvailableReports - returns list of reports', () => {
    const list = getAvailableReports();
    expect(list.length).toBeGreaterThan(0);
    expect(list.find(r => r.id === 'financial_summary')).toBeDefined();
  });

  test('runReport: financial_summary - calculates totals correctly', () => {
    // Setup installments
    kv.save(KEYS.INSTALLMENTS, [
      { 
        رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: 'غير مدفوع', 
        نوع_الكمبيالة: 'إيجار', تاريخ_استحقاق: '2020-01-01', isArchived: false 
      },
      { 
        رقم_الكمبيالة: 'I2', رقم_العقد: 'C1', القيمة: 500, حالة_الكمبيالة: 'مدفوع', 
        نوع_الكمبيالة: 'إيجار', تاريخ_استحقاق: '2020-01-01', isArchived: false,
        سجل_الدفعات: [{ 
          رقم_العملية: 'OP1', المبلغ: 500, التاريخ: '2020-01-01', المستخدم: 'admin', 
          الدور: 'Admin', النوع: 'FULL' 
        }] 
      }
    ]);
    
    const res = runReport('financial_summary');
    expect(res.title).toBe('الملخص المالي');
    
    const totalExpected = (res.data as any[]).find(d => d.item === 'إجمالي المتوقع')?.value;
    const totalPaid = (res.data as any[]).find(d => d.item === 'إجمالي المحصل')?.value;
    
    expect(totalExpected).toBe(1500);
    expect(totalPaid).toBe(500);
  });

  test('runReport: employee_commissions - aggregates monthly totals and applies tiers', () => {
    // Setup Commissions
    kv.save(KEYS.COMMISSIONS, [
      { رقم_العمولة: 'C1', اسم_المستخدم: 'emp1', المجموع: 1000, نوع_العمولة: 'Rental', شهر_دفع_العمولة: '2025-05' },
      { رقم_العمولة: 'C2', اسم_المستخدم: 'emp1', المجموع: 1000, نوع_العمولة: 'Rental', شهر_دفع_العمولة: '2025-05' }
    ]);
    
    // Total is 2000 for May. 
    // Tiers usually: < 1500 -> 30%, 1500-2500 -> 35%, etc. (depending on config)
    
    const res = runReport('employee_commissions');
    expect(res.data).toHaveLength(2);
    expect((res.data[0] as any).employeeUsername).toBe('emp1');
    // Verify math for one row
    expect((res.data[0] as any).officeCommission).toBe(1000);
    expect((res.data[0] as any).tier).toBe('2000-2999'); // 2000 total -> tier 2000-2999
  });

  test('runReport - returns empty for unknown report', () => {
    const res = runReport('unknown_id');
    expect(res.title).toBe('تقرير غير مكتمل');
    expect(res.data).toHaveLength(0);
  });
});
