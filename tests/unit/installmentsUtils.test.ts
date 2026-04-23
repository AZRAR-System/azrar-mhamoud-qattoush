import { 
  getPaidAndRemaining, 
  getNextUnpaidDueSummary, 
  formatNextDuePaymentLabel,
  normalizeRole
} from '@/components/installments/installmentsUtils';
import { INSTALLMENT_STATUS } from '@/components/installments/installmentsConstants';

describe('Installments Utilities - Financial Logic Suite', () => {
  const mockInstallment = {
    رقم_الكمبيالة: 'I1',
    القيمة: 1000,
    حالة_الكمبيالة: 'Pending',
    سجل_الدفعات: [],
    رقم_العقد: 'C1',
    تاريخ_استحقاق: '2025-01-01',
    isArchived: false,
  };

  test('getPaidAndRemaining - handles fully paid status', () => {
    const inst = { ...mockInstallment, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID };
    const res = getPaidAndRemaining(inst as any);
    expect(res.paid).toBe(1000);
    expect(res.remaining).toBe(0);
  });

  test('getPaidAndRemaining - uses القيمة_المتبقية if available', () => {
    const inst = { ...mockInstallment, القيمة_المتبقية: 400 };
    const res = getPaidAndRemaining(inst as any);
    expect(res.remaining).toBe(400);
    expect(res.paid).toBe(600);
  });

  test('getPaidAndRemaining - calculates from سجل_الدفعات fallback', () => {
    const inst = { 
      ...mockInstallment, 
      سجل_الدفعات: [{ المبلغ: 200 }, { المبلغ: 300 }] 
    };
    const res = getPaidAndRemaining(inst as any);
    expect(res.paid).toBe(500);
    expect(res.remaining).toBe(500);
  });

  test('getNextUnpaidDueSummary - finds earliest unpaid installment', () => {
    const installments = [
      { ...mockInstallment, رقم_الكمبيالة: 'I1', تاريخ_استحقاق: '2025-02-01' },
      { ...mockInstallment, رقم_الكمبيالة: 'I2', تاريخ_استحقاق: '2025-01-01' },
      { ...mockInstallment, رقم_الكمبيالة: 'I3', حالة_الكمبيالة: 'مدفوع', تاريخ_استحقاق: '2024-12-01' }
    ];
    
    const summary = getNextUnpaidDueSummary(installments as any, '2024-12-15');
    expect(summary.dueDate).toBe('2025-01-01');
    expect(summary.daysFromToday).toBeGreaterThan(0);
  });

  test('formatNextDuePaymentLabel - formats correctly for various timeframes', () => {
    expect(formatNextDuePaymentLabel({ dueDate: '2025-01-01', daysFromToday: 5 }))
      .toContain('باقٍ 5 يوم');
    expect(formatNextDuePaymentLabel({ dueDate: '2025-01-01', daysFromToday: 0 }))
      .toContain('مستحقة اليوم');
    expect(formatNextDuePaymentLabel({ dueDate: '2025-01-01', daysFromToday: -3 }))
      .toContain('متأخر 3 يوم');
  });

  test('normalizeRole - defaults to Employee', () => {
    expect(normalizeRole('SuperAdmin')).toBe('SuperAdmin');
    expect(normalizeRole('Invalid')).toBe('Employee');
  });
});
