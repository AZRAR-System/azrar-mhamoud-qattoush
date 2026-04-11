import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import { 
  createInstallmentPaymentHandlers 
} from '@/services/db/installments';
import { INSTALLMENT_STATUS } from '@/services/db/installmentConstants';
import { save, get } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';
import { الكمبيالات_tbl } from '@/types';

const installment: الكمبيالات_tbl = {
  رقم_الكمبيالة: 'INS-001',
  رقم_العقد: 'C-001',
  تاريخ_استحقاق: '2026-10-01',
  القيمة: 1000,
  القيمة_المتبقية: 1000,
  حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
  نوع_الكمبيالة: 'دورية',
  سجل_الدفعات: [],
};

const handlers = () => createInstallmentPaymentHandlers({
  logOperation: jest.fn(),
  markAlertsReadByPrefix: jest.fn(),
  updateTenantRating: jest.fn(),
});

beforeAll(() => {
  installMemoryLocalStorage();
});

beforeEach(() => {
  resetKvAndCache();
  save(KEYS.INSTALLMENTS, [installment]);
  save(KEYS.CONTRACTS, [{ رقم_العقد: 'C-001', حالة_العقد: 'نشط' }]);
});

describe('Installments Service', () => {
  it('should process full payment correctly', () => {
    const { markInstallmentPaid } = handlers();
    const result = markInstallmentPaid('INS-001', 'user-1', 'Admin', {
      paidAmount: 1000,
      paymentDate: '2026-10-02',
    });

    expect(result.success).toBe(true);
    const updated = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS)[0];
    expect(updated.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.PAID);
    expect(updated.القيمة_المتبقية).toBe(0);
    expect(updated.سجل_الدفعات).toHaveLength(1);
  });

  it('should process partial payment correctly', () => {
    const { markInstallmentPaid } = handlers();
    const result = markInstallmentPaid('INS-001', 'user-1', 'Admin', {
      paidAmount: 400,
      paymentDate: '2026-10-02',
      isPartial: true,
    });

    expect(result.success).toBe(true);
    const updated = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS)[0];
    expect(updated.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.PARTIAL);
    expect(updated.القيمة_المتبقية).toBe(600);
  });

  it('should reject payment if role is not allowed', () => {
    const { markInstallmentPaid } = handlers();
    const result = markInstallmentPaid('INS-001', 'user-1', 'Employee', {
      paidAmount: 1000,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('صلاحية');
  });

  it('should record late fees correctly', () => {
    const { setInstallmentLateFee } = handlers();
    const result = setInstallmentLateFee('INS-001', 'user-1', 'Admin', {
      amount: 50,
      classification: 'تأخير',
      note: 'Late fee test',
    });

    expect(result.success).toBe(true);
    const updated = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS)[0];
    expect((updated as any).غرامة_تأخير).toBe(50);
  });
});
