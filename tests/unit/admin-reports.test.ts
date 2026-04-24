import { runReport } from '@/services/db/system/reports';
import { KEYS } from '@/services/db/keys';
import { save } from '@/services/db/kv';

describe('Admin Reports Service - Comprehensive Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    // Initialize required keys to satisfy schemas and reports
    save(KEYS.PEOPLE, []);
    save(KEYS.PROPERTIES, []);
    save(KEYS.CONTRACTS, []);
    save(KEYS.INSTALLMENTS, []);
    save(KEYS.COMMISSIONS, []);
    save(KEYS.USERS, []);
  });

  test('runReport("financial_summary") - calculates totals accurately', () => {
    const installments = [
      { 
        رقم_الكمبيالة: 'I1', 
        رقم_العقد: 'C1', 
        القيمة: 1000, 
        حالة_الكمبيالة: 'مستحق', 
        تاريخ_استحقاق: '2025-01-01', 
        نوع_الكمبيالة: 'إيجار' 
      },
      { 
        رقم_الكمبيالة: 'I2', 
        رقم_العقد: 'C1', 
        القيمة: 2000, 
        حالة_الكمبيالة: 'مقبوض', 
        تاريخ_استحقاق: '2025-02-01', 
        نوع_الكمبيالة: 'إيجار',
        سجل_الدفعات: [{ رقم_العملية: 'T1', المبلغ: 2000, التاريخ: '2025-02-01', المستخدم: 'admin', الدور: 'admin', النوع: 'FULL' }]
      },
      { 
        رقم_الكمبيالة: 'I3', 
        رقم_العقد: 'C1', 
        القيمة: 500, 
        حالة_الكمبيالة: 'مستحق', 
        تاريخ_استحقاق: '2026-01-01', 
        نوع_الكمبيالة: 'إيجار' 
      },
    ];
    save(KEYS.INSTALLMENTS, installments as any);

    const result = runReport('financial_summary');
    const totalExpected = (result.data as any[]).find(d => d.item === 'إجمالي المتوقع')?.value;
    const totalPaid = (result.data as any[]).find(d => d.item === 'إجمالي المحصل')?.value;

    expect(totalExpected).toBe(3500);
    expect(totalPaid).toBe(2000);
  });

  test('runReport("employee_commissions") - applies tier rates correctly', () => {
    const users = [{ id: 'U1', اسم_المستخدم: 'mahmoud', اسم_للعرض: 'Mahmoud' }];
    const commissions = [
      { رقم_العمولة: 'C1', اسم_المستخدم: 'mahmoud', المجموع: 1000, نوع_العمولة: 'Rental', شهر_دفع_العمولة: '2025-01' },
      { رقم_العمولة: 'C2', اسم_المستخدم: 'mahmoud', المجموع: 2000, نوع_العمولة: 'Rental', شهر_دفع_العمولة: '2025-01' },
    ];

    save(KEYS.USERS, users as any);
    save(KEYS.COMMISSIONS, commissions as any);
    save(KEYS.CONTRACTS, []);
    save(KEYS.SALES_AGREEMENTS, []);
    save(KEYS.PROPERTIES, []);
    save(KEYS.PEOPLE, []);
    save(KEYS.BLACKLIST, []);

    const result = runReport('employee_commissions');
    const row1 = (result.data as any[]).find(d => d.id === 'C1');
    
    expect(row1).toBeDefined();
    expect(row1?.tier).toBe('3000-3999');
    expect(row1?.employeeBase).toBe(250); // 1000 * 0.25
  });
});
