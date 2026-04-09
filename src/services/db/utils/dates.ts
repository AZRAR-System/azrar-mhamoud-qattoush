/**
 * Pure date utilities for DB logic (Year-Month-Day focused).
 */

export const formatDateOnly = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const toDateOnly = (d: Date): Date => 
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const parseDateOnly = (iso: string): Date | null => {
  if (!iso) return null;
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

export const daysBetweenDateOnly = (from: Date, to: Date): number => {
  const a = toDateOnly(from).getTime();
  const b = toDateOnly(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

export const addMonthsDateOnly = (isoDate: string, months: number): Date | null => {
  const d = parseDateOnly(isoDate);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setMonth(next.getMonth() + months);
  return next;
};

export const addDaysIso = (isoDate: string, days: number): string | null => {
  const d = parseDateOnly(isoDate);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return formatDateOnly(d);
};
