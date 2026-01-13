export const formatDateOnly = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const toDateOnlyISO = (value: unknown): string | null => {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateOnly(value);

  const s = String(value).trim();
  if (!s) return null;

  // Handles both YYYY-MM-DD and full ISO datetime YYYY-MM-DDTHH:mm...
  if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10);

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateOnly(d);
};

export const todayDateOnlyISO = () => formatDateOnly(new Date());

export const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const parseDateOnly = (iso: string) => {
  const safe = toDateOnlyISO(iso);
  if (!safe) return null;
  const parts = safe.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

export const daysBetweenDateOnly = (from: Date, to: Date) => {
  const a = toDateOnly(from).getTime();
  const b = toDateOnly(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

export const daysBetweenDateOnlySafe = (from: unknown, to: unknown) => {
  const a = parseDateOnly(String(from ?? ''));
  const b = parseDateOnly(String(to ?? ''));
  if (!a || !b) return null;
  return daysBetweenDateOnly(a, b);
};

export const isBeforeTodayDateOnly = (value: unknown) => {
  const d = parseDateOnly(String(value ?? ''));
  if (!d) return false;
  const today = parseDateOnly(todayDateOnlyISO())!;
  return d.getTime() < today.getTime();
};

export const compareDateOnlySafe = (a: unknown, b: unknown) => {
  const da = parseDateOnly(String(a ?? ''));
  const db = parseDateOnly(String(b ?? ''));
  if (!da && !db) return 0;
  if (!da) return -1;
  if (!db) return 1;
  return da.getTime() - db.getTime();
};

export const addDaysDateOnly = (d: Date, days: number) => {
  const next = toDateOnly(d);
  next.setDate(next.getDate() + days);
  return next;
};
