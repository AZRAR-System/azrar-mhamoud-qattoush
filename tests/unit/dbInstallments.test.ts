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
});
