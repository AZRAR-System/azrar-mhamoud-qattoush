export function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return String(iso);
  return new Date(t).toLocaleString();
}

export { getErrorMessage } from '@/utils/errors';

export function licenseStatusToArabic(status?: string): string {
  const v = String(status || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'active') return 'نشط';
  if (v === 'suspended') return 'معلق';
  if (v === 'revoked') return 'ملغي';
  if (v === 'expired') return 'منتهي';
  if (v === 'mismatch') return 'غير مطابق';
  return status || '';
}

