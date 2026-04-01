import type { RoleType, الكمبيالات_tbl } from '@/types';
import {
  compareDateOnlySafe,
  daysBetweenDateOnlySafe,
  parseDateOnly,
  todayDateOnlyISO,
  toDateOnlyISO,
} from '@/utils/dateOnly';
import { INSTALLMENT_STATUS } from '@/components/installments/installmentsConstants';

export const parseDateOnlyLocal = (iso: string | undefined | null): Date | null => {
  const normalized = toDateOnlyISO(iso);
  if (!normalized) return null;
  return parseDateOnly(normalized);
};

export const todayDateOnlyLocal = () => {
  const d = parseDateOnly(todayDateOnlyISO());
  if (!d) throw new Error('Invalid todayDateOnlyISO()');
  return d;
};

export const isRecord = (v: unknown): v is Record<string, unknown> => {
  return !!v && typeof v === 'object' && !Array.isArray(v);
};

export const normalizeRole = (role: unknown): RoleType => {
  if (role === 'SuperAdmin' || role === 'Admin' || role === 'Employee') return role;
  return 'Employee';
};

export const getPaidAndRemaining = (inst: الكمبيالات_tbl) => {
  const total = Math.max(0, Number(inst.القيمة ?? 0) || 0);
  const status = String(inst.حالة_الكمبيالة ?? '').trim();

  if (status === INSTALLMENT_STATUS.PAID) {
    return { paid: total, remaining: 0 };
  }

  const storedRemaining = inst.القيمة_المتبقية;
  if (typeof storedRemaining === 'number' && Number.isFinite(storedRemaining)) {
    const remaining = Math.max(0, Math.min(total, storedRemaining));
    const paid = Math.max(0, Math.min(total, total - remaining));
    return { paid, remaining };
  }

  const paidFromHistory =
    inst.سجل_الدفعات?.reduce((sum, p) => sum + (p.المبلغ > 0 ? p.المبلغ : 0), 0) ?? 0;
  const paid = Math.max(0, Math.min(total, paidFromHistory));
  const remaining = Math.max(0, total - paid);
  return { paid, remaining };
};

export const getLastPositivePaymentAmount = (inst: الكمبيالات_tbl): number | null => {
  if (!inst.سجل_الدفعات || inst.سجل_الدفعات.length === 0) return null;
  for (let i = inst.سجل_الدفعات.length - 1; i >= 0; i--) {
    const amount = inst.سجل_الدفعات[i].المبلغ;
    if (amount > 0) return amount;
  }
  return null;
};

/** ملخص أقرب دفعة إيجار غير مسددة بالكامل (حسب تاريخ الاستحقاق). */
export type NextUnpaidDueSummary = {
  dueDate: string | null;
  /** من `todayIso` إلى تاريخ الاستحقاق: موجب = مستقبل، سالب = متأخر، 0 = اليوم */
  daysFromToday: number | null;
};

export function getNextUnpaidDueSummary(
  rentInstallments: الكمبيالات_tbl[],
  todayIso: string
): NextUnpaidDueSummary {
  const candidates = rentInstallments
    .filter((i) => {
      if (String(i.حالة_الكمبيالة ?? '').trim() === INSTALLMENT_STATUS.CANCELLED) return false;
      return getPaidAndRemaining(i).remaining > 0;
    })
    .sort((a, b) => compareDateOnlySafe(a.تاريخ_استحقاق, b.تاريخ_استحقاق));
  const next = candidates[0];
  const dueRaw = next?.تاريخ_استحقاق;
  if (!next || !dueRaw) return { dueDate: null, daysFromToday: null };
  const dueDate = String(dueRaw).slice(0, 10);
  const days = daysBetweenDateOnlySafe(todayIso, dueDate);
  return { dueDate, daysFromToday: days };
}

/** نص عربي موحّد لعرض البطاقة (يمكن اختباره عبر `getNextUnpaidDueSummary`). */
export function formatNextDuePaymentLabel(
  summary: NextUnpaidDueSummary,
  opts?: { contractFullyPaid?: boolean }
): string | null {
  if (opts?.contractFullyPaid) return 'العقد مسدد — لا دفعة قادمة';
  if (!summary.dueDate || summary.daysFromToday === null) return null;
  const d = summary.dueDate;
  const days = summary.daysFromToday;
  if (days > 0) return `باقٍ ${days} يوم للدفعة القادمة (${d})`;
  if (days === 0) return `الدفعة القادمة مستحقة اليوم (${d})`;
  return `متأخر ${Math.abs(days)} يوم — أقرب دفعة (${d})`;
}
