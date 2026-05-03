import { dedupeAlertsStorage } from './alertsCore';
import { get, save } from './kv';
import { KEYS } from './keys';
import { العمولات_tbl, العقود_tbl, DbResult, tbl_Alerts } from '@/types';
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

  const current = all[idx];
  const next: العمولات_tbl = { ...current, ...patch };

  // Recalculate Total if any constituent part was modified
  const changedAny = [
    'عمولة_المالك',
    'عمولة_المستأجر',
    'عمولة_البائع',
    'عمولة_المشتري',
    'عمولة_إدخال_عقار',
    'يوجد_ادخال_عقار',
  ].some((key) => key in patch);

  /** إذا وُجدت في الـ patch تُعتبر تعديلاً صريحاً ولا يُستبدل بالحساب التلقائي 5% */
  const introExplicitlyPatched = Object.prototype.hasOwnProperty.call(patch, 'عمولة_إدخال_عقار');

  if (changedAny) {
    const isSale = next.نوع_العمولة === 'Sale';
    if (isSale) {
      const parties =
        Number(next.عمولة_البائع || 0) + Number(next.عمولة_المشتري || 0);
      next.المجموع = parties;
      // إدخال عقار: لا يُضاف للمجموع؛ القيمة اليدوية تُحترم إذا أُرسلت في patch
      if (!next.يوجد_ادخال_عقار) {
        next.عمولة_إدخال_عقار = 0;
      } else if (!introExplicitlyPatched) {
        next.عمولة_إدخال_عقار = parties * 0.05;
      }
    } else {
      const parties =
        Number(next.عمولة_المالك || 0) + Number(next.عمولة_المستأجر || 0);
      next.المجموع = parties;
      if (!next.يوجد_ادخال_عقار) {
        next.عمولة_إدخال_عقار = 0;
      } else if (!introExplicitlyPatched) {
        next.عمولة_إدخال_عقار = parties * 0.05;
      }
    }
  }

  const updated = [...all];
  updated[idx] = next;
  save(KEYS.COMMISSIONS, updated);
  return ok(next);
};

export const postponeCommissionCollection = (
  commissionId: string,
  newDate: string,
  _target?: 'Owner' | 'Tenant',
  _note?: string
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

/** تطبيع تاريخ العمولة إلى YYYY-MM-DD واشتقاق شهر محاسبي YYYY-MM */
const normalizeCommissionDateAndMonth = (raw?: string): { ymd: string; ym: string } => {
  const fallbackYmd = new Date().toISOString().split('T')[0]!;
  const s0 = String(raw || '').trim();
  const s = s0.includes('T') ? String(s0.split('T')[0] || '').trim() : s0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ymd: s, ym: s.slice(0, 7) };
  if (/^\d{4}-\d{2}$/.test(s)) return { ymd: `${s}-01`, ym: s };
  if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const p = s.split('/');
    if (p.length >= 3) {
      const ymd = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      return { ymd, ym: ymd.slice(0, 7) };
    }
  }
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const ymd = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return { ymd, ym: ymd.slice(0, 7) };
  }
  return { ymd: fallbackYmd, ym: fallbackYmd.slice(0, 7) };
};

export const upsertCommissionForSale = (
  agreementId: string,
  data: {
    sellerComm: number;
    buyerComm: number;
    listingComm?: number;
    /** صريح من الاتفاقية؛ إن لم يُمرَّر يُستنتج من listingComm > 0 */
    propertyIntroEnabled?: boolean;
    listingEmployee?: string;
    closingEmployee?: string;
    date?: string;
  }
): DbResult<العمولات_tbl> => {
  const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
  const existingId = `COM-SALE-${agreementId}`;
  const idx = all.findIndex((c) => c.رقم_العمولة === existingId);

  const { ymd: dateYmd, ym: paidMonth } = normalizeCommissionDateAndMonth(data.date);

  const partiesTotal = Number(data.sellerComm || 0) + Number(data.buyerComm || 0);
  const introEnabled =
    data.propertyIntroEnabled === true
      ? true
      : data.propertyIntroEnabled === false
        ? false
        : (Number(data.listingComm) || 0) > 0;
  const introAmount = introEnabled ? partiesTotal * 0.05 : 0;

  const record: العمولات_tbl = {
    رقم_العمولة: existingId,
    رقم_الاتفاقية: agreementId,
    تاريخ_العقد: dateYmd,
    شهر_دفع_العمولة: paidMonth,
    نوع_العمولة: 'Sale',
    عمولة_البائع: data.sellerComm,
    عمولة_المشتري: data.buyerComm,
    عمولة_المالك: data.sellerComm, // Legacy field sync
    عمولة_المستأجر: data.buyerComm, // Legacy field sync
    عمولة_إدخال_عقار: introAmount,
    موظف_إدخال_العقار: data.listingEmployee,
    اسم_المستخدم: data.closingEmployee,
    المجموع: partiesTotal,
    يوجد_ادخال_عقار: introEnabled,
  };

  if (idx !== -1) {
    all[idx] = record;
  } else {
    all.push(record);
  }

  save(KEYS.COMMISSIONS, all);
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
  return dedupeAlertsStorage(get<tbl_Alerts>(KEYS.ALERTS) || []).filter(
    (a) => a.category === 'Financial' && !a.تم_القراءة
  );
};

export const deleteCommission = (id: string): DbResult<null> => {
  const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
  save(KEYS.COMMISSIONS, all.filter((c) => c.رقم_العمولة !== id));
  return ok();
};
