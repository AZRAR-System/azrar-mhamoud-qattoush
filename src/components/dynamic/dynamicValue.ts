import type { FieldType } from '@/types';

export const formatDynamicValue = (type: FieldType | undefined, raw: unknown) => {
  if (raw === undefined || raw === null) return '';

  if (type === 'boolean') return raw ? 'نعم' : 'لا';

  if (type === 'number') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n.toLocaleString();
    return String(raw);
  }

  // date/text/select fallbacks
  return String(raw);
};

export const isEmptyDynamicValue = (raw: unknown) => {
  if (raw === undefined || raw === null) return true;
  if (typeof raw === 'string' && raw.trim() === '') return true;
  if (Array.isArray(raw) && raw.length === 0) return true;
  return false;
};
