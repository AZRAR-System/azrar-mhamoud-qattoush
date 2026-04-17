/**
 * Tests for src/utils/installments.ts
 * Critical utility for financial calculations
 */

import { getInstallmentPaidAndRemaining } from '../../src/utils/installments';

const makeInst = (overrides = {}): any => ({
  رقم_الكمبيالة: 'inst-1',
  القيمة: 1000,
  حالة_الكمبيالة: 'معلق',
  ...overrides,
});

describe('getInstallmentPaidAndRemaining', () => {
  describe('status = مدفوع', () => {
    it('returns full amount as paid when status is مدفوع', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({ حالة_الكمبيالة: 'مدفوع' }));
      expect(result.paid).toBe(1000);
      expect(result.remaining).toBe(0);
    });

    it('handles zero value when مدفوع', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({ القيمة: 0, حالة_الكمبيالة: 'مدفوع' }));
      expect(result.paid).toBe(0);
      expect(result.remaining).toBe(0);
    });
  });

  describe('stored remaining amount', () => {
    it('uses القيمة_المتبقية when available', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({ القيمة_المتبقية: 400 }));
      expect(result.remaining).toBe(400);
      expect(result.paid).toBe(600);
    });

    it('remaining cannot be negative', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({ القيمة_المتبقية: -100 }));
      expect(result.remaining).toBe(0);
    });

    it('paid cannot be negative', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({ القيمة: 100, القيمة_المتبقية: 500 }));
      expect(result.paid).toBe(0);
      expect(result.remaining).toBe(500);
    });
  });

  describe('payment history fallback', () => {
    it('calculates from سجل_الدفعات when no القيمة_المتبقية', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({
        سجل_الدفعات: [{ المبلغ: 300 }, { المبلغ: 200 }],
      }));
      expect(result.paid).toBe(500);
      expect(result.remaining).toBe(500);
    });

    it('ignores negative payments', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({
        سجل_الدفعات: [{ المبلغ: 300 }, { المبلغ: -100 }],
      }));
      expect(result.paid).toBe(300);
      expect(result.remaining).toBe(700);
    });

    it('ignores non-numeric payments', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({
        سجل_الدفعات: [{ المبلغ: 300 }, { المبلغ: 'invalid' }],
      }));
      expect(result.paid).toBe(300);
    });

    it('returns full remaining when no payments', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({ سجل_الدفعات: [] }));
      expect(result.paid).toBe(0);
      expect(result.remaining).toBe(1000);
    });

    it('remaining cannot exceed original value', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({ سجل_الدفعات: [] }));
      expect(result.remaining).toBeLessThanOrEqual(1000);
    });
  });

  describe('edge cases', () => {
    it('handles missing سجل_الدفعات', () => {
      const result = getInstallmentPaidAndRemaining(makeInst());
      expect(result.paid).toBe(0);
      expect(result.remaining).toBe(1000);
    });

    it('handles null القيمة', () => {
      const result = getInstallmentPaidAndRemaining(makeInst({ القيمة: null }));
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });
  });
});
