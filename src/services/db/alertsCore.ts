/**
 * Core alert KV helpers (upsert / stable ids / contract context / mark read by prefix).
 */

import type { tbl_Alerts } from '@/types';
import { العقود_tbl, الأشخاص_tbl, العقارات_tbl } from '@/types';
import { get, save } from './kv';
import { KEYS } from './keys';

export function upsertAlert(alert: tbl_Alerts) {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  const indices: number[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i]?.id === alert.id) indices.push(i);
  }

  if (indices.length > 0) {
    const wasRead = indices.some((i) => !!all[i]?.تم_القراءة);
    const primaryIdx = indices[0];
    const prev = all[primaryIdx];
    all[primaryIdx] = { ...prev, ...alert, تم_القراءة: wasRead };

    if (indices.length > 1) {
      const keep = new Set<number>([primaryIdx]);
      const deduped: tbl_Alerts[] = [];
      for (let i = 0; i < all.length; i++) {
        if (all[i]?.id !== alert.id || keep.has(i)) {
          deduped.push(all[i]);
        }
      }
      save(KEYS.ALERTS, deduped);
      return;
    }

    save(KEYS.ALERTS, all);
    return;
  }

  save(KEYS.ALERTS, [alert, ...all]);
}

export const stableAlertId = (
  dateISO: string,
  type: string,
  message: string,
  category: string
) => {
  const input = `${dateISO}|${category}|${type}|${message}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ALR-GEN-${category}-${(hash >>> 0).toString(36)}`;
};

export const buildContractAlertContext = (
  contractIdRaw: string
): Partial<
  Pick<tbl_Alerts, 'tenantName' | 'phone' | 'propertyCode' | 'مرجع_الجدول' | 'مرجع_المعرف'>
> => {
  const contractId = String(contractIdRaw || '').trim();
  if (!contractId) return {};

  const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

  const contract = contracts.find((c) => String(c?.رقم_العقد) === contractId);
  if (!contract) {
    return { مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: contractId };
  }

  const tenant = people.find((p) => String(p?.رقم_الشخص) === String(contract.رقم_المستاجر));
  const property = properties.find((p) => String(p?.رقم_العقار) === String(contract.رقم_العقار));

  return {
    tenantName: tenant?.الاسم,
    phone: tenant?.رقم_الهاتف,
    propertyCode: property?.الكود_الداخلي,
    مرجع_الجدول: 'العقود_tbl',
    مرجع_المعرف: contractId,
  };
};

export const markAlertsReadByPrefix = (prefix: string) => {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  let changed = false;
  for (const a of all) {
    if (a.id.startsWith(prefix) && !a.تم_القراءة) {
      a.تم_القراءة = true;
      changed = true;
    }
  }
  if (changed) save(KEYS.ALERTS, all);
};
