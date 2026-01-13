import type { الكمبيالات_tbl } from '@/types';

export const getInstallmentPaidAndRemaining = (inst: الكمبيالات_tbl) => {
  const status = String(inst?.حالة_الكمبيالة ?? '').trim();

  // If explicitly marked as PAID, treat it as fully paid.
  if (status === 'مدفوع') {
    return { paid: Math.max(0, inst.القيمة || 0), remaining: 0 };
  }

  // Prefer stored remaining amount if available.
  const rawRemaining = (inst as any)?.القيمة_المتبقية;
  if (typeof rawRemaining === 'number' && Number.isFinite(rawRemaining)) {
    const remaining = Math.max(0, rawRemaining);
    const paid = Math.max(0, (inst.القيمة || 0) - remaining);
    return { paid, remaining };
  }

  // Fallback: compute from payment history.
  const payments = Array.isArray((inst as any)?.سجل_الدفعات) ? (inst as any).سجل_الدفعات : [];
  const paid = payments.reduce((sum: number, p: any) => sum + (p?.المبلغ > 0 ? p.المبلغ : 0), 0);
  const remaining = Math.max(0, (inst.القيمة || 0) - paid);
  return { paid: Math.max(0, paid), remaining };
};
