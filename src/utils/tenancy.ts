import { العقود_tbl } from '@/types';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const hasUnknownProp = <K extends string>(
  obj: Record<string, unknown>,
  key: K
): obj is Record<string, unknown> & Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const getTenancyStatusScore = (status: unknown) => {
  // Higher score = more relevant “current” tenancy.
  // We include 'مجدد' as a fallback because some datasets mark current contracts this way.
  const raw = String(status || '').trim();
  const lower = raw.toLowerCase();

  // Normalize common variants across datasets/legacy imports.
  if (raw === 'نشط' || raw === 'ساري' || raw === 'سارية' || raw === 'فعال' || lower === 'active')
    return 3;
  if (raw === 'قريب الانتهاء' || raw === 'قريبة الانتهاء') return 2;
  if (raw === 'مجدد' || raw === 'تجديد' || lower === 'renewed') return 1;
  return 0;
};

export const isTenancyRelevant = (c: Pick<العقود_tbl, 'حالة_العقد' | 'isArchived'> | unknown) => {
  if (!c) return false;

  const archived =
    isRecord(c) && hasUnknownProp(c, 'isArchived')
      ? Boolean(c.isArchived)
      : // If it's not an object or the property doesn't exist, treat as not archived.
        false;
  if (archived) return false;

  const status = isRecord(c) && hasUnknownProp(c, 'حالة_العقد') ? c.حالة_العقد : undefined;
  return getTenancyStatusScore(status) > 0;
};

export const isBetterTenancyContract = (next: العقود_tbl, prev?: العقود_tbl) => {
  if (!prev) return true;

  const prevScore = getTenancyStatusScore(prev.حالة_العقد);
  const nextScore = getTenancyStatusScore(next.حالة_العقد);
  if (nextScore !== prevScore) return nextScore > prevScore;

  const a = String(prev.تاريخ_البداية || '');
  const b = String(next.تاريخ_البداية || '');
  if (b !== a) return b.localeCompare(a) > 0;

  const ea = String(prev.تاريخ_النهاية || '');
  const eb = String(next.تاريخ_النهاية || '');
  if (eb !== ea) return eb.localeCompare(ea) > 0;

  return String(next.رقم_العقد || '').localeCompare(String(prev.رقم_العقد || '')) > 0;
};

export const pickBestTenancyContract = (contracts: العقود_tbl[]) => {
  let best: العقود_tbl | undefined;
  for (const c of contracts) {
    if (!isTenancyRelevant(c)) continue;
    if (isBetterTenancyContract(c, best)) best = c;
  }
  return best;
};
