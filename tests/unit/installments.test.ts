import { jest } from '@jest/globals';
import { DbService } from '@/services/mockDb';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { INSTALLMENT_STATUS } from '@/services/db/installmentConstants';

describe('Installments Service Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.INSTALLMENTS, []);
    save(KEYS.CONTRACTS, [{ رقم_العقد: 'C1', تاريخ_البداية: '2024-01-01', تاريخ_النهاية: '2024-12-31' }]);
    save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'Tenant 1' }]);
  });

  it('previewContractInstallments: should generate monthly installments', () => {
    const res = DbService.previewContractInstallments({
      تاريخ_البداية: '2024-01-01',
      تاريخ_النهاية: '2024-12-31',
      مدة_العقد_بالاشهر: 12,
      تكرار_الدفع: 12,
      القيمة_السنوية: 1200
    } as any, 'C1');

    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(12);
    expect(res.data![0].القيمة).toBe(100);
  });

  it('markInstallmentPaid: should handle partial payments and status updates', () => {
    save(KEYS.INSTALLMENTS, [{ رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID }]);
    
    // Partial payment
    DbService.markInstallmentPaid('I1', 'user1', 'Admin', { paidAmount: 500, isPartial: true });
    let inst = (get<any[]>(KEYS.INSTALLMENTS)).find(i => i.رقم_الكمبيالة === 'I1');
    expect(inst.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.PARTIAL);
    expect(inst.القيمة_المتبقية).toBe(500);

    // Full payment
    DbService.markInstallmentPaid('I1', 'user1', 'Admin', { paidAmount: 500 });
    inst = (get<any[]>(KEYS.INSTALLMENTS)).find(i => i.رقم_الكمبيالة === 'I1');
    expect(inst.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.PAID);
    expect(inst.القيمة_المتبقية).toBe(0);
  });

  it('reversePayment: should allow SuperAdmin to undo a payment', () => {
    save(KEYS.INSTALLMENTS, [{ 
      رقم_الكمبيالة: 'I1', 
      رقم_العقد: 'C1', 
      القيمة: 1000, 
      حالة_الكمبيالة: INSTALLMENT_STATUS.PAID,
      سجل_الدفعات: [{ رقم_العملية: 'PAY-1', المبلغ: 1000, التاريخ: '2024-01-01' }]
    }]);

    const res = DbService.reversePayment('I1', 'super1', 'SuperAdmin', 'Error in entry');
    expect(res.success).toBe(true);
    
    const inst = (get<any[]>(KEYS.INSTALLMENTS)).find(i => i.رقم_الكمبيالة === 'I1');
    expect(inst.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.UNPAID);
    expect(inst.سجل_الدفعات.length).toBeGreaterThanOrEqual(1);
  });
});
