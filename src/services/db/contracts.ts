/**
 * Contracts domain — read helpers (writes / cascade stay in mockDb DbService).
 */

import type { ContractDetailsResult } from '@/types';
import { العقود_tbl, العقارات_tbl, الأشخاص_tbl, الكمبيالات_tbl } from '@/types';
import { get } from './kv';
import { KEYS } from './keys';

export const getContracts = (): العقود_tbl[] => get<العقود_tbl>(KEYS.CONTRACTS);

export const getContractDetails = (id: string): ContractDetailsResult | null => {
  const c = get<العقود_tbl>(KEYS.CONTRACTS).find((x) => x.رقم_العقد === id);
  if (!c) return null;
  const p = get<العقارات_tbl>(KEYS.PROPERTIES).find((x) => x.رقم_العقار === c.رقم_العقار);
  const t = get<الأشخاص_tbl>(KEYS.PEOPLE).find((x) => x.رقم_الشخص === c.رقم_المستاجر);
  const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS)
    .filter((i) => i.رقم_العقد === id)
    .sort((a, b) => (a.ترتيب_الكمبيالة || 0) - (b.ترتيب_الكمبيالة || 0));
  return { contract: c, property: p, tenant: t, installments: inst };
};
