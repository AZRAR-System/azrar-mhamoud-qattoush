export const LOCALE_AR_LATN_GREGORY = 'ar-JO-u-ca-gregory-nu-latn';

const toFiniteNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  const fixed = Number.isFinite(n) ? n : 0;
  // تصحيح تلقائي للارقام المالية على 2 خانات عشرية
  return Math.round(fixed * 100) / 100;
};

export const formatNumber = (
  value: unknown,
  options: Intl.NumberFormatOptions = {},
  locale: string = LOCALE_AR_LATN_GREGORY
): string => {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    ...options,
  }).format(toFiniteNumber(value));
};

export const formatCurrencyJOD = (
  value: unknown,
  options: Intl.NumberFormatOptions = {},
  locale: string = LOCALE_AR_LATN_GREGORY
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'JOD',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(toFiniteNumber(value));
};

export const formatDateYMD = (value: unknown): string => {
  if (!value) return '—';
  if (!(value instanceof Date)) {
    const s = String(value).trim();
    // Treat ISO-like strings as date-only to avoid timezone shifts (YYYY-MM-DD or YYYY-MM-DDTHH:mm...)
    if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10);
  }

  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatMonthYear = (
  value: unknown,
  locale: string = LOCALE_AR_LATN_GREGORY
): string => {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale, { month: 'long', year: 'numeric' });
};

export const formatTimeHM = (
  value: unknown,
  options: {
    locale?: string;
    hour12?: boolean;
  } = {}
): string => {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';

  const { locale = 'en-US', hour12 = true } = options;
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });
};

export const formatTimeFromHM = (
  hm: unknown,
  options: {
    locale?: string;
    hour12?: boolean;
  } = {}
): string => {
  const raw = String(hm || '').trim();
  if (!raw) return '—';

  const m = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return '—';

  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  return formatTimeHM(d, options);
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' بايت';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' كيلوبايت';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' ميجابايت';
  return (bytes / 1073741824).toFixed(1) + ' جيجابايت';
}
