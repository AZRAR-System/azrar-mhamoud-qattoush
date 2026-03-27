/**
 * Attachment folder naming on disk (Person / Property / Contract / Clearance).
 */

import { العقارات_tbl, العقود_tbl } from '@/types';
import { get } from './kv';
import { KEYS } from './keys';

export const sanitizeFolderName = (input: string, maxLen = 80): string => {
  const raw = String(input ?? '').trim();
  if (!raw) return 'غير_معروف';
  const cleaned = raw
    .replace(/[\\/]+/g, '-')
    .replace(/[<>:"|?*]+/g, '-')
    .replace(/[\u0000-\u001F]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = cleaned || 'غير_معروف';
  return safe.length > maxLen ? safe.slice(0, maxLen).trim() : safe;
};

export const toDateOnlySafe = (d: unknown): string => {
  try {
    if (!d) return '';
    const input =
      d instanceof Date || typeof d === 'string' || typeof d === 'number' ? d : String(d);
    const dt = new Date(input);
    if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
    return dt.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

export const buildAttachmentEntityFolder = (referenceType: string, referenceId: string): string => {
  const t = String(referenceType || '');

  if (t === 'Person') {
    return sanitizeFolderName(referenceId, 110);
  }

  if (t === 'Property') {
    const prop = get<العقارات_tbl>(KEYS.PROPERTIES).find((p) => p.رقم_العقار === referenceId);
    const code = String(prop?.الكود_الداخلي || referenceId);
    return sanitizeFolderName(code, 110);
  }

  if (t === 'Contract') {
    return sanitizeFolderName(referenceId, 140);
  }

  if (t === 'Clearance') {
    const contract = get<العقود_tbl>(KEYS.CONTRACTS).find((x) => x.رقم_العقد === referenceId);
    const property = contract
      ? get<العقارات_tbl>(KEYS.PROPERTIES).find((p) => p.رقم_العقار === contract.رقم_العقار)
      : undefined;
    const propertyToken = String(property?.الكود_الداخلي || contract?.رقم_العقار || '');
    const parts = [String(referenceId || ''), propertyToken].filter(Boolean);
    return sanitizeFolderName(parts.join('__'), 140);
  }

  return sanitizeFolderName(`${t || 'Other'} - ${referenceId}`, 120);
};
