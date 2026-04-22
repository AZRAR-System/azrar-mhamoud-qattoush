/**
 * Contracts domain — reads + write operations (factory to avoid circular imports with mockDb).
 */

import type { ClearanceRecord, ContractDetailsResult, DbResult } from '@/types';
import { العقود_tbl, العقارات_tbl, الأشخاص_tbl, الكمبيالات_tbl, العمولات_tbl } from '@/types';
import { roundCurrency } from '@/utils/format';
import { parseDateOnly, daysBetweenDateOnly } from '@/utils/dateOnly';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { get, save } from './kv';
import { KEYS } from './keys';
import { generateContractInstallmentsInternal } from './installments';

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

type LogMeta = {
  ipAddress?: string;
  deviceInfo?: string;
};

export type ContractWritesDeps = {
  logOperation: (
    user: string,
    action: string,
    table: string,
    recordId: string,
    details: string,
    meta?: LogMeta
  ) => void;
  handleSmartEngine: (category: 'person' | 'property' | 'contract', data: unknown) => void;
  formatDateOnly: (d: Date) => string;
  addDaysIso: (isoDate: string, days: number) => string | null;
  addMonthsDateOnly: (isoDate: string, months: number) => Date | null;
};

export function createContractWrites(deps: ContractWritesDeps) {
  const { logOperation, handleSmartEngine, formatDateOnly, addDaysIso, addMonthsDateOnly } = deps;
  const fail = dbFail;
  const ok = dbOk;

  const createContract = (
    data: Partial<العقود_tbl>,
    commOwner: number,
    commTenant: number,
    commissionPaidMonth?: string
  ): DbResult<العقود_tbl> => {
    const makeNextCotContractId = () => {
      const existing = get<العقود_tbl>(KEYS.CONTRACTS);
      let maxSeq = 0;
      for (const c of existing) {
        const raw = String(c.رقم_العقد || '').trim();
        const m = /^cot_(\d+)$/i.exec(raw);
        if (!m) continue;
        const n = parseInt(m[1], 10);
        if (!Number.isFinite(n)) continue;
        if (n > maxSeq) maxSeq = n;
      }
      return `cot_${String(maxSeq + 1).padStart(3, '0')}`;
    };

    const id = makeNextCotContractId();
    const createdDate = /^\d{4}-\d{2}-\d{2}$/.test(String(data?.تاريخ_الانشاء ?? ''))
      ? String(data?.تاريخ_الانشاء)
      : formatDateOnly(new Date());

    const contract: العقود_tbl = {
      ...data,
      رقم_العقد: id,
      حالة_العقد: 'نشط',
      isArchived: false,
      تاريخ_الانشاء: createdDate,
    } as العقود_tbl;

    save(KEYS.CONTRACTS, [...get<العقود_tbl>(KEYS.CONTRACTS), contract]);

    const allComm = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const startRaw = String(data?.تاريخ_البداية ?? '').trim();
    const commissionDate = /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : formatDateOnly(new Date());
    const paidMonth = commissionPaidMonth && /^\d{4}-\d{2}$/.test(String(commissionPaidMonth))
        ? String(commissionPaidMonth)
        : commissionDate.slice(0, 7);

    save(KEYS.COMMISSIONS, [
      ...allComm,
      {
        رقم_العمولة: `COM-${id}`,
        رقم_العقد: id,
        تاريخ_العقد: commissionDate,
        شهر_دفع_العمولة: paidMonth,
        عمولة_المالك: commOwner,
        عمولة_المستأجر: commTenant,
        المجموع: roundCurrency(commOwner + commTenant),
      },
    ]);

    const installmentsRes = generateContractInstallmentsInternal(contract, id);
    if (!installmentsRes.success || !installmentsRes.data)
      return fail(installmentsRes.message || 'تعذر توليد الدفعات');

    save(KEYS.INSTALLMENTS, [...get<الكمبيالات_tbl>(KEYS.INSTALLMENTS), ...installmentsRes.data]);

    const props = get<العقارات_tbl>(KEYS.PROPERTIES);
    const pIdx = props.findIndex((p) => p.رقم_العقار === contract.رقم_العقار);
    if (pIdx > -1) {
      props[pIdx].IsRented = true;
      props[pIdx].حالة_العقار = 'مؤجر';
      save(KEYS.PROPERTIES, props);
    }

    handleSmartEngine('contract', contract);
    logOperation('Admin', 'إضافة', 'Contracts', id, `إنشاء عقد جديد للعقار ${contract.رقم_العقار}`);
    return ok(contract);
  };

  const updateContract = (
    id: string,
    data: Partial<العقود_tbl>,
    commOwner: number,
    commTenant: number,
    commissionPaidMonth?: string,
    options?: { regenerateInstallments?: boolean }
  ): DbResult<العقود_tbl> => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const idx = all.findIndex((c) => c.رقم_العقد === id);
    if (idx === -1) return fail('العقد غير موجود');

    const existing = all[idx];
    const updated: العقود_tbl = { ...existing, ...data, رقم_العقد: id } as العقود_tbl;

    let regeneratedInstallments: الكمبيالات_tbl[] | null = null;
    if (options?.regenerateInstallments) {
      const currentInst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter((i) => i.رقم_العقد === id);
      if (currentInst.some((i) => i.حالة_الكمبيالة === 'مدفوع')) {
        return fail('لا يمكن إعادة توليد الدفعات لأن هناك مبالغ محصلة بالفعل.');
      }
      const instRes = generateContractInstallmentsInternal(updated, id);
      if (!instRes.success || !instRes.data) return fail(instRes.message || 'تعذر توليد الدفعات');
      regeneratedInstallments = instRes.data;
    }

    all[idx] = updated;
    save(KEYS.CONTRACTS, all);

    const allComm = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const cIdx = allComm.findIndex((x) => x.رقم_العقد === id);
    if (cIdx > -1) {
      allComm[cIdx] = {
        ...allComm[cIdx],
        عمولة_المالك: commOwner,
        عمولة_المستأجر: commTenant,
        المجموع: roundCurrency(commOwner + commTenant),
        شهر_دفع_العمولة: commissionPaidMonth || allComm[cIdx].شهر_دفع_العمولة,
      };
      save(KEYS.COMMISSIONS, allComm);
    }

    if (regeneratedInstallments) {
      const allInst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter((i) => i.رقم_العقد !== id);
      save(KEYS.INSTALLMENTS, [...allInst, ...regeneratedInstallments]);
    }

    handleSmartEngine('contract', updated);
    logOperation('Admin', 'تعديل', 'Contracts', id, `تعديل العقد`);
    return ok(updated);
  };

  const archiveContract = (id: string) => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const idx = all.findIndex((c) => c.رقم_العقد === id);
    if (idx > -1) {
      all[idx].isArchived = true;
      all[idx].حالة_العقد = 'مؤرشف';
      save(KEYS.CONTRACTS, all);
      logOperation('Admin', 'أرشفة', 'Contracts', id, 'أرشفة عقد');
    }
  };

  const terminateContract = (
    id: string,
    reason: string,
    date: string,
    clearanceRecord?: ClearanceRecord
  ): DbResult<null> => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const idx = all.findIndex((c) => c.رقم_العقد === id);
    if (idx > -1) {
      const propertyId = all[idx].رقم_العقار;
      all[idx].حالة_العقد = 'مفسوخ';
      all[idx].terminationDate = date;
      all[idx].terminationReason = reason;
      save(KEYS.CONTRACTS, all);

      const instAll = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
      for (let i = 0; i < instAll.length; i++) {
        if (instAll[i].رقم_العقد !== id) continue;
        const msg = `فسخ: ${reason}`;
        instAll[i].ملاحظات = instAll[i].ملاحظات ? instAll[i].ملاحظات + '\n' + msg : msg;
        if (instAll[i].حالة_الكمبيالة !== 'مدفوع') {
           instAll[i].حالة_الكمبيالة = 'ملغي';
        }
        instAll[i].isArchived = true;
      }
      save(KEYS.INSTALLMENTS, instAll);

      const props = get<العقارات_tbl>(KEYS.PROPERTIES);
      const pIdx = props.findIndex((p) => p.رقم_العقار === propertyId);
      if (pIdx > -1) {
        props[pIdx].IsRented = false;
        props[pIdx].حالة_العقار = 'شاغر';
        save(KEYS.PROPERTIES, props);
      }

      if (clearanceRecord) {
        const crs = get<ClearanceRecord>(KEYS.CLEARANCE_RECORDS);
        save(KEYS.CLEARANCE_RECORDS, [...crs, { ...clearanceRecord, id: `CLR-${id}` }]);
      }

      logOperation('Admin', 'فسخ', 'Contracts', id, `فسخ العقد: ${reason}`);
      return ok();
    }
    return fail('العقد غير موجود');
  };

  const renewContract = (
    id: string,
    options?: { transferBalance?: boolean; transferSecurity?: boolean }
  ): DbResult<العقود_tbl> => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const idx = all.findIndex((c) => c.رقم_العقد === id);
    if (idx === -1) return fail('العقد غير موجود');
    const old = all[idx];
    if (old.linkedContractId) return fail('هذا العقد لديه تجديد بالفعل');

    let transferredBalance = 0;
    if (options?.transferBalance) {
      const insts = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter((i) => i.رقم_العقد === id);
      const totalDue = roundCurrency(insts.reduce((sum, i) => sum + i.القيمة, 0));
      const totalPaid = roundCurrency(insts.reduce((sum, i) => {
        const p = i.سجل_الدفعات?.reduce((s, x) => s + x.المبلغ, 0) || (i.حالة_الكمبيالة === 'مدفوع' ? i.القيمة : 0);
        return sum + p;
      }, 0));
      transferredBalance = roundCurrency(totalPaid - totalDue);
    }

    const nextSecurity = options?.transferSecurity ? (old.قيمة_التأمين || 0) : 0;
    const newStart = addDaysIso(old.تاريخ_النهاية, 1);
    if (!newStart) return fail('تاريخ بداية العقد الجديد غير صالح');

    const endCandidate = addMonthsDateOnly(newStart, old.مدة_العقد_بالاشهر || 12);
    if (!endCandidate) return fail('تعذر حساب تاريخ النهاية');
    endCandidate.setDate(endCandidate.getDate() - 1);
    const newEnd = formatDateOnly(endCandidate);

    const prevComm = get<العمولات_tbl>(KEYS.COMMISSIONS).find((x) => x.رقم_العقد === id);

    const res = createContract(
      {
        ...old,
        رقم_العقد: undefined as unknown as string,
        تاريخ_البداية: newStart,
        تاريخ_النهاية: newEnd,
        حالة_العقد: 'نشط',
        isArchived: false,
        عقد_مرتبط: old.رقم_العقد,
        linkedContractId: undefined,
        قيمة_التأمين: nextSecurity || old.قيمة_التأمين,
      },
      prevComm?.عمولة_المالك || 0,
      prevComm?.عمولة_المستأجر || 0
    );

    if (res.success && res.data) {
      const newId = res.data.رقم_العقد;
      // Mark old as ended and linked
      const allAgain = get<العقود_tbl>(KEYS.CONTRACTS);
      const oldIdx = allAgain.findIndex(c => c.رقم_العقد === id);
      if (oldIdx > -1) {
        allAgain[oldIdx].linkedContractId = newId;
        allAgain[oldIdx].حالة_العقد = 'منتهي';
        save(KEYS.CONTRACTS, allAgain);
      }

      // Handle Negative Balance (Debt)
      if (transferredBalance < 0) {
        const debtAmount = Math.abs(transferredBalance);
        const debtInst: الكمبيالات_tbl = {
          رقم_الكمبيالة: `DEBT-${newId}`,
          رقم_العقد: newId,
          نوع_الكمبيالة: 'كمبيالة',
          نوع_الدفعة: 'رصيد سابق' as الكمبيالات_tbl['نوع_الدفعة'],
          تاريخ_استحقاق: newStart,
          القيمة: debtAmount,
          القيمة_المتبقية: debtAmount,
          حالة_الكمبيالة: 'غير مدفوع',
          ترتيب_الكمبيالة: 0,
          ملاحظات: `رصيد مدور من عقد ${id}`,
        };
        save(KEYS.INSTALLMENTS, [...get<الكمبيالات_tbl>(KEYS.INSTALLMENTS), debtInst]);
      }
      
      logOperation('Admin', 'تجديد', 'Contracts', id, `تجديد العقد الي ${newId}`);
      return ok(res.data);
    }

    return fail(res.message || 'فشل التجديد');
  };

  const deleteContract = (id: string): DbResult<null> => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const filtered = all.filter((c) => c.رقم_العقد !== id);
    save(KEYS.CONTRACTS, filtered);

    const insts = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter((i) => i.رقم_العقد !== id);
    save(KEYS.INSTALLMENTS, insts);

    const comms = get<العمولات_tbl>(KEYS.COMMISSIONS).filter((c) => c.رقم_العقد !== id);
    save(KEYS.COMMISSIONS, comms);

    logOperation('Admin', 'حذف', 'Contracts', id, `حذف العقد نهائياً`);
    return ok(null);
  };

  const processSecurityDeposit = (
    contractId: string,
    deductions: number,
    action: 'Return' | 'Execute' | 'ExecutePartial',
    note?: string
  ): DbResult<null> => {
    logOperation('Admin', 'تسوية تأمين', 'Contracts', contractId, `إجراء: ${action}, خصم: ${deductions}, ملاحظة: ${note}`);
    return ok(null, 'تمت العملية');
  };

  const autoArchiveContracts = (): DbResult<{ updated: number }> => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const insts = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const todayStr = formatDateOnly(new Date());
    const today = parseDateOnly(todayStr)!;
    let updated = 0;

    const next = all.map((c) => {
      const status = String(c.حالة_العقد || '').trim();
      const isActive = status === 'نشط' || status === 'قريب الانتهاء';
      const isEnded = status === 'منتهي' || status === 'مفسوخ' || status === 'تحصيل';

      // 1. Alert for active
      if (isActive) {
        const end = parseDateOnly(c.تاريخ_النهاية || '');
        if (end) {
          const days = daysBetweenDateOnly(today, end);
          if (days <= 0) { updated++; return { ...c, حالة_العقد: 'منتهي' }; }
          if (days <= 30 && status !== 'قريب الانتهاء') { updated++; return { ...c, حالة_العقد: 'قريب الانتهاء' }; }
        }
      }

      // 2. Archive or Collection for ended
      if (isEnded) {
        const cInsts = insts.filter((i) => i.رقم_العقد === c.رقم_العقد);
        const totalDue = roundCurrency(cInsts.reduce((s, i) => s + i.القيمة, 0));
        const totalPaid = roundCurrency(cInsts.reduce((s, i) => {
           const p = i.سجل_الدفعات?.reduce((acc, x) => acc + x.المبلغ, 0) || (i.حالة_الكمبيالة === 'مدفوع' ? i.القيمة : 0);
           return s + p;
        }, 0));

        const clean = totalPaid >= totalDue;
        if (clean && !c.isArchived) { updated++; return { ...c, حالة_العقد: 'مؤرشف', isArchived: true }; }
        if (!clean && status !== 'تحصيل') { updated++; return { ...c, حالة_العقد: 'تحصيل' }; }
      }

      return c;
    });

    if (updated > 0) save(KEYS.CONTRACTS, next);
    return ok({ updated });
  };

  return {
    createContract,
    updateContract,
    archiveContract,
    terminateContract,
    renewContract,
    deleteContract,
    processSecurityDeposit,
    autoArchiveContracts,
  };
}
