import { createInstallmentPaymentHandlers, getInstallmentPaidAndRemaining, calculateAutoLateFees } from '../../src/services/db/installments';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';
import { INSTALLMENT_STATUS } from '../../src/services/db/installmentConstants';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/services/localDbStorage', () => ({
  dbOk: jest.fn((data, message) => ({ success: true, data, message })),
  dbFail: jest.fn((message) => ({ success: false, message })),
}));

describe('Installments Logic', () => {
  const mockDeps = {
    logOperation: jest.fn(),
    markAlertsReadByPrefix: jest.fn(),
    updateTenantRating: jest.fn(),
  };

  const { markInstallmentPaid, reversePayment } = createInstallmentPaymentHandlers(mockDeps);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstallmentPaidAndRemaining', () => {
    test('calculates from history when status is not PAID', () => {
      const inst = {
        القيمة: 1000,
        حالة_الكمبيالة: 'غير مدفوع',
        سجل_الدفعات: [{ المبلغ: 300 }, { المبلغ: 200 }]
      } as any;
      const res = getInstallmentPaidAndRemaining(inst);
      expect(res.paid).toBe(500);
      expect(res.remaining).toBe(500);
    });

    test('returns 0 remaining when status is PAID', () => {
      const inst = {
        القيمة: 1000,
        حالة_الكمبيالة: 'مدفوع'
      } as any;
      const res = getInstallmentPaidAndRemaining(inst);
      expect(res.remaining).toBe(0);
      expect(res.paid).toBe(1000);
    });
  });

  describe('markInstallmentPaid', () => {
    test('handles partial payment and calculates remainder', () => {
      const existing = {
        رقم_الكمبيالة: 'INS-1',
        رقم_العقد: 'COT-1',
        القيمة: 1000,
        حالة_الكمبيالة: 'غير مدفوع',
        سجل_الدفعات: []
      };
      (get as jest.Mock).mockReturnValue([existing]);

      const result = markInstallmentPaid('INS-1', 'U1', 'Admin', { paidAmount: 400, isPartial: true });

      expect(result.success).toBe(true);
      expect(save).toHaveBeenCalledWith(KEYS.INSTALLMENTS, expect.arrayContaining([
        expect.objectContaining({ 
          حالة_الكمبيالة: INSTALLMENT_STATUS.PARTIAL,
          القيمة_المتبقية: 600
        })
      ]));
    });

    test('completes payment when total reaches value', () => {
      const existing = {
        رقم_الكمبيالة: 'INS-1',
        رقم_العقد: 'COT-1',
        القيمة: 1000,
        حالة_الكمبيالة: 'جزئي',
        سجل_الدفعات: [{ المبلغ: 600 }]
      };
      (get as jest.Mock).mockReturnValue([existing]);

      const result = markInstallmentPaid('INS-1', 'U1', 'Admin', { paidAmount: 400 });

      expect(result.success).toBe(true);
      expect(save).toHaveBeenCalledWith(KEYS.INSTALLMENTS, expect.arrayContaining([
        expect.objectContaining({ 
          حالة_الكمبيالة: INSTALLMENT_STATUS.PAID,
          القيمة_المتبقية: 0
        })
      ]));
    });
  });

  describe('reversePayment', () => {
    test('reverses last payment and reverts status', () => {
      const existing = {
        رقم_الكمبيالة: 'INS-1',
        القيمة: 1000,
        حالة_الكمبيالة: 'مدفوع',
        سجل_الدفعات: [
          { رقم_العملية: 'OP1', المبلغ: 600, التاريخ: '2026-01-01' },
          { رقم_العملية: 'OP2', المبلغ: 400, التاريخ: '2026-02-01' }
        ]
      };
      (get as jest.Mock).mockReturnValue([existing]);

      const result = reversePayment('INS-1', 'U1', 'SuperAdmin', 'Wrong amount');

      expect(result.success).toBe(true);
      const saved = (save as jest.Mock).mock.calls[0][1][0];
      expect(saved.حالة_الكمبيالة).toBe(INSTALLMENT_STATUS.PARTIAL);
      expect(saved.القيمة_المتبقية).toBe(400);
      expect(saved.سجل_الدفعات.length).toBe(2); // The reversal record is added
      expect(saved.سجل_الدفعات[1].المبلغ).toBe(-400);
    });
  });

  describe('calculateAutoLateFees', () => {
    test('calculates fixed fee', () => {
      const contract = { lateFeeType: 'fixed', lateFeeValue: 50, lateFeeGraceDays: 5 } as any;
      const installments = [{ رقم_الكمبيالة: 'I1', القيمة: 1000, تاريخ_استحقاق: '2026-01-01' }] as any;
      
      // Assume today is well past Jan 1st
      const res = calculateAutoLateFees(contract, installments);
      expect(res[0].suggestedFee).toBe(50);
    });

    test('calculates percentage fee', () => {
      const contract = { lateFeeType: 'percentage', lateFeeValue: 10, lateFeeGraceDays: 0 } as any;
      const installments = [{ رقم_الكمبيالة: 'I1', القيمة: 1000, تاريخ_استحقاق: '2026-01-01' }] as any;
      
      const res = calculateAutoLateFees(contract, installments);
      expect(res[0].suggestedFee).toBe(100); // 10% of 1000
    });
  });
});
