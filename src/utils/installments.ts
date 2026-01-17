import type { الكمبيالات_tbl } from '@/types';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const hasUnknownProp = <K extends string>(obj: Record<string, unknown>, key: K): obj is Record<string, unknown> & Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const getInstallmentPaidAndRemaining = (inst: الكمبيالات_tbl) => {
  const status = String(inst?.حالة_الكمبيالة ?? '').trim();

  // If explicitly marked as PAID, treat it as fully paid.
  if (status === 'مدفوع') {
    return { paid: Math.max(0, inst.القيمة || 0), remaining: 0 };
  }

  // Prefer stored remaining amount if available.
  const rawRemaining =
    isRecord(inst) && hasUnknownProp(inst, 'القيمة_المتبقية')
      ? inst.القيمة_المتبقية
      : undefined;
  if (typeof rawRemaining === 'number' && Number.isFinite(rawRemaining)) {
    const remaining = Math.max(0, rawRemaining);
    const paid = Math.max(0, (inst.القيمة || 0) - remaining);
    return { paid, remaining };
  }

  // Fallback: compute from payment history.
  const rawPayments =
    isRecord(inst) && hasUnknownProp(inst, 'سجل_الدفعات')
      ? inst.سجل_الدفعات
      : undefined;
  const payments = Array.isArray(rawPayments) ? rawPayments : [];

  const paid = payments.reduce((sum: number, p: unknown) => {
    if (!isRecord(p) || !hasUnknownProp(p, 'المبلغ')) return sum;
    const amt = p.المبلغ;
    if (typeof amt !== 'number' || !Number.isFinite(amt) || amt <= 0) return sum;
    return sum + amt;
  }, 0);
  const remaining = Math.max(0, (inst.القيمة || 0) - paid);
  return { paid: Math.max(0, paid), remaining };
};
