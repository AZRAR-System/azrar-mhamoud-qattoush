import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { العقود_tbl, الكمبيالات_tbl } from '@/types';
import { createInstallmentPaymentHandlers } from '@/services/db/installments';
import { INSTALLMENT_STATUS } from '@/services/db/installmentConstants';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';

const contract: العقود_tbl = {
  رقم_العقد: 'cot_001',
  رقم_العقار: 'PROP-1',
  رقم_المستاجر: 'P-TENANT',
  تاريخ_الانشاء: '2026-01-01',
  تاريخ_البداية: '2026-01-01',
  تاريخ_النهاية: '2026-12-31',
  مدة_العقد_بالاشهر: 12,
  القيمة_السنوية: 1200,
  تكرار_الدفع: 12,
  طريقة_الدفع: 'Postpaid',
  حالة_العقد: 'نشط',
  isArchived: false,
};

const installment: الكمبيالات_tbl = {
  رقم_الكمبيالة: 'INS-UT-1',
  رقم_العقد: contract.رقم_العقد,
  تاريخ_استحقاق: '2026-06-01',
  القيمة: 100,
  القيمة_المتبقية: 100,
  حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
  نوع_الكمبيالة: 'دورية',
  سجل_الدفعات: [],
};

const handlers = () =>
  createInstallmentPaymentHandlers({
    logOperation: jest.fn(),
    markAlertsReadByPrefix: jest.fn(),
    updateTenantRating: jest.fn(),
  });

beforeAll(() => {
  installMemoryLocalStorage();
});

beforeEach(() => {
  resetKvAndCache();
  save(KEYS.CONTRACTS, [contract]);
  save(KEYS.INSTALLMENTS, [installment]);
});

describe('db/installments payment handlers', () => {
  it('markInstallmentPaid marks paid when amount covers balance', () => {
    const { markInstallmentPaid } = handlers();
    const res = markInstallmentPaid('INS-UT-1', 'admin', 'Admin', {
      paidAmount: 100,
      paymentDate: '2026-06-02',
    });
    expect(res.success).toBe(true);
    const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find((i) => i.رقم_الكمبيالة === 'INS-UT-1');
    expect(inst?.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.PAID);
    expect(inst?.القيمة_المتبقية).toBe(0);
    expect(inst?.سجل_الدفعات?.length).toBe(1);
  });

  it('markInstallmentPaid sets PARTIAL then PAID on second payment', () => {
    const { markInstallmentPaid } = handlers();
    expect(
      markInstallmentPaid('INS-UT-1', 'admin', 'Admin', {
        paidAmount: 40,
        paymentDate: '2026-06-01',
        isPartial: true,
      }).success
    ).toBe(true);
    let inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find((i) => i.رقم_الكمبيالة === 'INS-UT-1');
    expect(inst?.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.PARTIAL);
    expect(inst?.القيمة_المتبقية).toBe(60);

    expect(
      markInstallmentPaid('INS-UT-1', 'admin', 'Admin', {
        paidAmount: 60,
        paymentDate: '2026-06-02',
      }).success
    ).toBe(true);
    inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find((i) => i.رقم_الكمبيالة === 'INS-UT-1');
    expect(inst?.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.PAID);
    expect(inst?.القيمة_المتبقية).toBe(0);
    expect(inst?.سجل_الدفعات?.filter((p) => p.المبلغ > 0).length).toBe(2);
  });

  it('markInstallmentPaid rejects Employee role', () => {
    const { markInstallmentPaid } = handlers();
    const res = markInstallmentPaid('INS-UT-1', 'u1', 'Employee', { paidAmount: 100 });
    expect(res.success).toBe(false);
    expect(String(res.message || '')).toMatch(/صلاحية/);
  });

  it('markInstallmentPaid rejects unknown installment id', () => {
    const { markInstallmentPaid } = handlers();
    const res = markInstallmentPaid('NO-SUCH', 'admin', 'Admin', { paidAmount: 10 });
    expect(res.success).toBe(false);
  });

  it('markInstallmentPaid rejects zero or negative amount', () => {
    const { markInstallmentPaid } = handlers();
    expect(markInstallmentPaid('INS-UT-1', 'admin', 'Admin', { paidAmount: 0 }).success).toBe(false);
    expect(markInstallmentPaid('INS-UT-1', 'admin', 'Admin', { paidAmount: -5 }).success).toBe(
      false
    );
  });

  it('markInstallmentPaid rejects overpayment vs remaining', () => {
    const { markInstallmentPaid } = handlers();
    markInstallmentPaid('INS-UT-1', 'admin', 'Admin', { paidAmount: 30 });
    const res = markInstallmentPaid('INS-UT-1', 'admin', 'Admin', { paidAmount: 80 });
    expect(res.success).toBe(false);
    expect(String(res.message || '')).toMatch(/يتجاوز/);
  });

  it('markInstallmentPaid rejects paying already PAID installment', () => {
    const { markInstallmentPaid } = handlers();
    markInstallmentPaid('INS-UT-1', 'admin', 'Admin', { paidAmount: 100 });
    const res = markInstallmentPaid('INS-UT-1', 'admin', 'Admin', { paidAmount: 1 });
    expect(res.success).toBe(false);
  });

  it('reversePayment restores unpaid after full payment (SuperAdmin)', () => {
    const { markInstallmentPaid, reversePayment } = handlers();
    markInstallmentPaid('INS-UT-1', 'admin', 'Admin', {
      paidAmount: 100,
      paymentDate: '2026-06-02',
    });
    const rev = reversePayment('INS-UT-1', 'sa', 'SuperAdmin', 'تصحيح اختبار');
    expect(rev.success).toBe(true);
    const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find((i) => i.رقم_الكمبيالة === 'INS-UT-1');
    expect(inst?.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.UNPAID);
  });

  it('reversePayment rejects non-SuperAdmin', () => {
    const { markInstallmentPaid, reversePayment } = handlers();
    markInstallmentPaid('INS-UT-1', 'admin', 'Admin', {
      paidAmount: 100,
      paymentDate: '2026-06-02',
    });
    const rev = reversePayment('INS-UT-1', 'admin', 'Admin', 'سبب');
    expect(rev.success).toBe(false);
  });

  it('reversePayment rejects empty reason', () => {
    const { markInstallmentPaid, reversePayment } = handlers();
    markInstallmentPaid('INS-UT-1', 'admin', 'Admin', { paidAmount: 100 });
    const rev = reversePayment('INS-UT-1', 'sa', 'SuperAdmin', '   ');
    expect(rev.success).toBe(false);
  });

  it('reversePayment rejects when installment unpaid', () => {
    const { reversePayment } = handlers();
    const rev = reversePayment('INS-UT-1', 'sa', 'SuperAdmin', 'سبب');
    expect(rev.success).toBe(false);
  });

  it('reversePayment after partial restores UNPAID and full remaining', () => {
    const { markInstallmentPaid, reversePayment } = handlers();
    markInstallmentPaid('INS-UT-1', 'admin', 'Admin', { paidAmount: 40 });
    expect(
      reversePayment('INS-UT-1', 'sa', 'SuperAdmin', 'إلغاء آخر دفعة').success
    ).toBe(true);
    const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find((i) => i.رقم_الكمبيالة === 'INS-UT-1');
    expect(inst?.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.UNPAID);
    expect(inst?.القيمة_المتبقية).toBe(100);
  });

  it('setInstallmentLateFee records amount and rejects invalid role', () => {
    const { setInstallmentLateFee } = handlers();
    expect(setInstallmentLateFee('INS-UT-1', 'u', 'Employee', { amount: 10 }).success).toBe(false);
    const ok = setInstallmentLateFee('INS-UT-1', 'admin', 'Admin', {
      amount: 15,
      classification: 'تأخير',
      note: 'اختبار',
    });
    expect(ok.success).toBe(true);
    const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find((i) => i.رقم_الكمبيالة === 'INS-UT-1');
    expect((inst as unknown as { غرامة_تأخير?: number }).غرامة_تأخير).toBe(15);
  });
});
