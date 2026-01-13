import { العقود_tbl } from '@/types';

export const getTenancyStatusScore = (status: unknown) => {
  // Higher score = more relevant “current” tenancy.
  // We include 'مجدد' as a fallback because some datasets mark current contracts this way.
  switch (String(status || '')) {
    case 'نشط':
      return 3;
    case 'قريب الانتهاء':
      return 2;
    case 'مجدد':
      return 1;
    default:
      return 0;
  }
};

export const isTenancyRelevant = (c: Pick<العقود_tbl, 'حالة_العقد' | 'isArchived'> | any) => {
  if (!c) return false;
  if ((c as any).isArchived) return false;
  return getTenancyStatusScore((c as any).حالة_العقد) > 0;
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
