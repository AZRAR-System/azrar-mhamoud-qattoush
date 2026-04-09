import { get, save } from './kv';
import { KEYS } from './keys';
import { العمولات_tbl, العقود_tbl, الكمبيالات_tbl, DbResult, tbl_Alerts } from '@/types';
import { dbFail, dbOk } from '@/services/localDbStorage';

const fail = dbFail;
const ok = dbOk;

/**
 * Financial services
 */

export const getCommissions = (): العمولات_tbl[] => get<العمولات_tbl>(KEYS.COMMISSIONS);

export const updateCommission = (id: string, patch: Partial<العمولات_tbl>): DbResult<العمولات_tbl> => {
  const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
  const idx = all.findIndex((c) => c.رقم_العمولة === id);
  if (idx === -1) return fail('العمولة غير موجودة');

  const next: العمولات_tbl = { ...all[idx], ...patch };
  const updated = [...all];
  updated[idx] = next;
  save(KEYS.COMMISSIONS, updated);
  return ok(next);
};

export const postponeCommissionCollection = (
  commissionId: string,
  newDate: string,
  target?: 'Owner' | 'Tenant',
  note?: string
): DbResult<العمولات_tbl> => {
  const date = String(newDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('تاريخ غير صالح');

  const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
  const idx = all.findIndex((c) => c.رقم_العمولة === commissionId);
  if (idx === -1) return fail('العمولة غير موجودة');

  const next: العمولات_tbl = {
    ...all[idx],
    تاريخ_تحصيل_مؤجل: date,
    شهر_دفع_العمولة: date.slice(0, 7),
    تاريخ_العقد: date,
  };
  const updated = [...all];
  updated[idx] = next;
  save(KEYS.COMMISSIONS, updated);
  return ok(next);
};

export const upsertCommissionForContract = (
  contractId: string,
  values: {
    commOwner: number;
    commTenant: number;
    commissionPaidMonth?: string;
    employeeUsername?: string;
  }
): DbResult<العمولات_tbl> => {
  const contract = get<العقود_tbl>(KEYS.CONTRACTS).find((c) => c.رقم_العقد === contractId);
  if (!contract) return fail('العقد غير موجود');

  const commOwner = Number(values.commOwner || 0);
  const commTenant = Number(values.commTenant || 0);
  const now = new Date();
  const nowYMD = now.toISOString().slice(0, 10);
  const nowYM = now.toISOString().slice(0, 7);
  const month =
    values.commissionPaidMonth && /^\d{4}-\d{2}$/.test(String(values.commissionPaidMonth))
      ? String(values.commissionPaidMonth)
      : nowYM;

  const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
  const existing = all.find((c) => c.رقم_العقد === contractId);

  const employeeUsername = String(values.employeeUsername || '').trim() || undefined;

  if (existing) {
    const patch: Partial<العمولات_tbl> & { اسم_المستخدم?: string } = {
      عمولة_المالك: commOwner,
      عمولة_المستأجر: commTenant,
      شهر_دفع_العمولة: month,
    };
    if (employeeUsername) patch.اسم_المستخدم = employeeUsername;
    return updateCommission(existing.رقم_العمولة, patch);
  }

  const record: العمولات_tbl & { اسم_المستخدم?: string } = {
    رقم_العمولة: `COM-${contractId}`,
    رقم_العقد: contractId,
    تاريخ_العقد: nowYMD,
    شهر_دفع_العمولة: month,
    عمولة_المالك: commOwner,
    عمولة_المستأجر: commTenant,
    المجموع: commOwner + commTenant,
  };
  if (employeeUsername) record.اسم_المستخدم = employeeUsername;

  save(KEYS.COMMISSIONS, [...all, record]);
  return ok(record);
};

export const finalizeCommissionCollection = (id: string): DbResult<null> => {
  const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
  const idx = all.findIndex((c) => c.رقم_العمولة === id);
  if (idx === -1) return fail('العمولة غير موجودة');
  
  // Logic from legacy mark paid if applicable
  return ok();
};

export const getFinancialAlerts = (): tbl_Alerts[] => {
  return get<tbl_Alerts>(KEYS.ALERTS).filter(a => a.category === 'Financial' && !a.تم_القراءة);
};

export const deleteCommission = (id: string): DbResult<null> => {
  const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
  save(KEYS.COMMISSIONS, all.filter((c) => c.رقم_العمولة !== id));
  return ok();
};
