import { describe, it, expect } from '@jest/globals';
import type { الكمبيالات_tbl } from '@/types';
import {
  formatNextDuePaymentLabel,
  getNextUnpaidDueSummary,
  getPaidAndRemaining,
  getLastPositivePaymentAmount,
} from '@/components/installments/installmentsUtils';
import { INSTALLMENT_STATUS } from '@/components/installments/installmentsConstants';

const baseInst = (over: Partial<الكمبيالات_tbl>): الكمبيالات_tbl =>
  ({
    رقم_الكمبيالة: 'K-1',
    رقم_العقد: 'C-1',
    تاريخ_استحقاق: '2026-06-01',
    القيمة: 100,
    القيمة_المتبقية: 100,
    حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
    نوع_الكمبيالة: 'دورية',
    سجل_الدفعات: [],
    ...over,
  }) as الكمبيالات_tbl;

describe('installmentsUtils', () => {
  describe('getPaidAndRemaining', () => {
    it('returns zero remaining when status is PAID', () => {
      const r = getPaidAndRemaining(
        baseInst({ حالة_الكمبيالة: INSTALLMENT_STATUS.PAID, القيمة: 200, القيمة_المتبقية: 0 })
      );
      expect(r.paid).toBe(200);
      expect(r.remaining).toBe(0);
    });

    it('uses القيمة_المتبقية when set (partial state)', () => {
      const r = getPaidAndRemaining(
        baseInst({
          حالة_الكمبيالة: INSTALLMENT_STATUS.PARTIAL,
          القيمة: 100,
          القيمة_المتبقية: 40,
        })
      );
      expect(r.remaining).toBe(40);
      expect(r.paid).toBe(60);
    });

    it('derives from سجل_الدفعات when no reliable المتبقية', () => {
      const r = getPaidAndRemaining(
        baseInst({
          حالة_الكمبيالة: INSTALLMENT_STATUS.PARTIAL,
          القيمة: 100,
          القيمة_المتبقية: undefined as unknown as number,
          سجل_الدفعات: [{ رقم_العملية: 'op1', المبلغ: 25, التاريخ: '2026-01-01' } as never],
        })
      );
      expect(r.paid).toBe(25);
      expect(r.remaining).toBe(75);
    });

    it('ignores non-positive entries in سجل_الدفعات for paid sum', () => {
      const r = getPaidAndRemaining(
        baseInst({
          القيمة: 100,
          القيمة_المتبقية: undefined as unknown as number,
          حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
          سجل_الدفعات: [
            { المبلغ: 30, التاريخ: '2026-01-01' } as never,
            { المبلغ: -30, التاريخ: '2026-01-02' } as never,
          ],
        })
      );
      expect(r.paid).toBe(30);
      expect(r.remaining).toBe(70);
    });
  });

  describe('getLastPositivePaymentAmount', () => {
    it('returns null when no payments', () => {
      expect(getLastPositivePaymentAmount(baseInst({}))).toBeNull();
    });

    it('returns last positive amount scanning from end', () => {
      const amt = getLastPositivePaymentAmount(
        baseInst({
          سجل_الدفعات: [
            { المبلغ: 40, التاريخ: '2026-01-01' } as never,
            { المبلغ: 60, التاريخ: '2026-01-02' } as never,
          ],
        })
      );
      expect(amt).toBe(60);
    });

    it('skips trailing reversal (negative) to find previous positive', () => {
      const amt = getLastPositivePaymentAmount(
        baseInst({
          سجل_الدفعات: [
            { المبلغ: 100, التاريخ: '2026-01-01' } as never,
            { المبلغ: -100, التاريخ: '2026-01-02' } as never,
          ],
        })
      );
      expect(amt).toBe(100);
    });
  });

  describe('getNextUnpaidDueSummary / formatNextDuePaymentLabel', () => {
    it('picks earliest unpaid due date', () => {
      const list = [
        baseInst({ تاريخ_استحقاق: '2026-08-01', رقم_الكمبيالة: 'a' }),
        baseInst({ تاريخ_استحقاق: '2026-06-01', رقم_الكمبيالة: 'b' }),
      ];
      const s = getNextUnpaidDueSummary(list, '2026-05-01');
      expect(s.dueDate).toBe('2026-06-01');
      expect(s.daysFromToday).toBe(31);
    });

    it('returns null when all paid', () => {
      const list = [
        baseInst({
          رقم_الكمبيالة: 'p',
          حالة_الكمبيالة: INSTALLMENT_STATUS.PAID,
          القيمة_المتبقية: 0,
        }),
      ];
      const s = getNextUnpaidDueSummary(list, '2026-05-01');
      expect(s.dueDate).toBeNull();
    });

    it('formatNextDuePaymentLabel covers future, today, overdue', () => {
      expect(formatNextDuePaymentLabel({ dueDate: '2026-06-10', daysFromToday: 5 })).toContain('باقٍ 5 يوم');
      expect(formatNextDuePaymentLabel({ dueDate: '2026-01-01', daysFromToday: 0 })).toContain('اليوم');
      expect(formatNextDuePaymentLabel({ dueDate: '2025-12-01', daysFromToday: -10 })).toContain('متأخر 10 يوم');
      expect(
        formatNextDuePaymentLabel({ dueDate: null, daysFromToday: null }, { contractFullyPaid: true })
      ).toContain('مسدد');
    });
  });
});
