/**
 * Contracts domain — reads + write operations (factory to avoid circular imports with mockDb).
 */

import type { ClearanceRecord, ContractDetailsResult, DbResult } from '@/types';
import { العقود_tbl, العقارات_tbl, الأشخاص_tbl, الكمبيالات_tbl, العمولات_tbl } from '@/types';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { get, save } from './kv';
import { KEYS } from './keys';
import { INSTALLMENT_STATUS } from './installmentConstants';
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
      const nextSeq = maxSeq + 1;
      return `cot_${String(nextSeq).padStart(3, '0')}`;
    };

    const id = makeNextCotContractId();
    const createdRaw = String(data?.تاريخ_الانشاء ?? '').trim();
    const createdDate = /^\d{4}-\d{2}-\d{2}$/.test(createdRaw)
      ? createdRaw
      : formatDateOnly(new Date());
    const oppRaw = String(data?.رقم_الفرصة ?? '').trim();
    const contract: العقود_tbl = {
      ...data,
      رقم_العقد: id,
      حالة_العقد: 'نشط',
      isArchived: false,
      تاريخ_الانشاء: createdDate,
      رقم_الفرصة: oppRaw || undefined,
    } as العقود_tbl;

    const allC = get<العقود_tbl>(KEYS.CONTRACTS);
    const updatedContracts = allC.map((c) => {
      if (c.isArchived) return c;
      if (c.رقم_العقد === id) return c;
      if (c.رقم_العقار !== contract.رقم_العقار) return c;
      if (c.رقم_المستاجر === contract.رقم_المستاجر) return c;
      if (c.حالة_العقد === 'منتهي' || c.حالة_العقد === 'مفسوخ' || c.حالة_العقد === 'ملغي') {
        return { ...c, isArchived: true };
      }
      return c;
    });
    save(KEYS.CONTRACTS, [...updatedContracts, contract]);

    const allComm = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const nowYMD = formatDateOnly(new Date());
    const startRaw = String(data?.تاريخ_البداية ?? '').trim();
    const commissionDate = /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : nowYMD;
    const paidMonth =
      commissionPaidMonth && /^\d{4}-\d{2}$/.test(String(commissionPaidMonth))
        ? String(commissionPaidMonth)
        : commissionDate.slice(0, 7);
    save(KEYS.COMMISSIONS, [
      ...allComm,
      {
        رقم_العمولة: `COM-${id}`,
        رقم_العقد: id,
        تاريخ_العقد: commissionDate,
        شهر_دفع_العمولة: paidMonth,
        رقم_الفرصة: oppRaw || undefined,
        عمولة_المالك: commOwner,
        عمولة_المستأجر: commTenant,
        المجموع: commOwner + commTenant,
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

    if (data.رقم_العقار && data.رقم_العقار !== existing.رقم_العقار) {
      return fail('لا يمكن تغيير العقار المرتبط من خلال تعديل العقد.');
    }
    if (data.رقم_المستاجر && data.رقم_المستاجر !== existing.رقم_المستاجر) {
      return fail('لا يمكن تغيير المستأجر المرتبط من خلال تعديل العقد.');
    }

    const updated: العقود_tbl = {
      ...existing,
      ...data,
      رقم_العقد: id,
    } as العقود_tbl;

    const existingCreated = String(existing.تاريخ_الانشاء ?? '').trim();
    const backfillCreated = /^\d{4}-\d{2}-\d{2}$/.test(String(existing?.تاريخ_البداية || '').trim())
      ? String(existing.تاريخ_البداية).trim()
      : undefined;
    updated.تاريخ_الانشاء = /^\d{4}-\d{2}-\d{2}$/.test(existingCreated)
      ? existingCreated
      : backfillCreated;

    const oppRaw = String(data.رقم_الفرصة ?? existing.رقم_الفرصة ?? '').trim();
    updated.رقم_الفرصة = oppRaw || undefined;

    let regeneratedInstallments: الكمبيالات_tbl[] | null = null;
    const wantsRegen = options?.regenerateInstallments === true;
    if (wantsRegen) {
      const currentInst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter((i) => i.رقم_العقد === id);
      const hasPaid = currentInst.some((i) => String(i.حالة_الكمبيالة || '').trim() === 'مدفوع');
      if (hasPaid) {
        return fail('لا يمكن إعادة توليد الدفعات لأن هناك دفعات مدفوعة على هذا العقد.');
      }
      const instRes = generateContractInstallmentsInternal(updated, id);
      if (!instRes.success || !instRes.data) return fail(instRes.message || 'تعذر توليد الدفعات');
      regeneratedInstallments = instRes.data;
    }

    const nextContracts = [...all];
    nextContracts[idx] = updated;
    save(KEYS.CONTRACTS, nextContracts);

    const allComm = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const cIdx = allComm.findIndex((x) => x.رقم_العقد === id || x.رقم_العمولة === `COM-${id}`);
    const now = new Date();
    const nowYMD = now.toISOString().slice(0, 10);
    const nowYM = now.toISOString().slice(0, 7);
    const existingComm = cIdx > -1 ? allComm[cIdx] : undefined;
    const existingPaidMonth = String(existingComm?.شهر_دفع_العمولة || '').trim();
    const nextPaidMonth =
      commissionPaidMonth && /^\d{4}-\d{2}$/.test(String(commissionPaidMonth))
        ? String(commissionPaidMonth)
        : /^\d{4}-\d{2}$/.test(existingPaidMonth)
          ? existingPaidMonth
          : nowYM;
    const existingDate = String(existingComm?.تاريخ_العقد || '').trim();
    const nextCommissionDate = /^\d{4}-\d{2}-\d{2}$/.test(existingDate) ? existingDate : nowYMD;
    if (cIdx > -1) {
      allComm[cIdx] = {
        ...allComm[cIdx],
        رقم_العمولة: allComm[cIdx].رقم_العمولة || `COM-${id}`,
        رقم_العقد: id,
        تاريخ_العقد: nextCommissionDate,
        شهر_دفع_العمولة: nextPaidMonth,
        رقم_الفرصة: oppRaw || undefined,
        عمولة_المالك: commOwner,
        عمولة_المستأجر: commTenant,
        المجموع: commOwner + commTenant,
      };
      save(KEYS.COMMISSIONS, allComm);
    } else {
      save(KEYS.COMMISSIONS, [
        ...allComm,
        {
          رقم_العمولة: `COM-${id}`,
          رقم_العقد: id,
          تاريخ_العقد: nowYMD,
          شهر_دفع_العمولة: nextPaidMonth,
          رقم_الفرصة: oppRaw || undefined,
          عمولة_المالك: commOwner,
          عمولة_المستأجر: commTenant,
          المجموع: commOwner + commTenant,
        },
      ]);
    }

    if (wantsRegen && regeneratedInstallments) {
      const allInst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
      const kept = allInst.filter((i) => i.رقم_العقد !== id);
      save(KEYS.INSTALLMENTS, [...kept, ...regeneratedInstallments]);
    }

    handleSmartEngine('contract', updated);
    logOperation(
      'Admin',
      'تعديل',
      'Contracts',
      id,
      `تعديل عقد (${wantsRegen ? 'مع إعادة توليد الدفعات' : 'بدون تغيير الدفعات'})`
    );
    return ok(updated, 'تم تعديل العقد');
  };

  const archiveContract = (id: string) => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const idx = all.findIndex((c) => c.رقم_العقد === id);
    if (idx > -1) {
      all[idx].isArchived = true;
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
      let changed = false;
      for (let i = 0; i < instAll.length; i++) {
        const inst = instAll[i];
        if (inst.رقم_العقد !== id) continue;

        const note = `${inst.ملاحظات ? inst.ملاحظات + '\n' : ''}سبب الفسخ: ${reason}`;

        if (inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID) {
          instAll[i] = { ...inst, isArchived: true, ملاحظات: note };
          changed = true;
          continue;
        }

        instAll[i] = {
          ...inst,
          حالة_الكمبيالة: INSTALLMENT_STATUS.CANCELLED,
          isArchived: true,
          ملاحظات: note,
        };
        changed = true;
      }
      if (changed) save(KEYS.INSTALLMENTS, instAll);

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
      
      // WhatsApp notification to tenant
      try {
        const tenant = get<الأشخاص_tbl>(KEYS.PEOPLE).find(p => p.رقم_الشخص === all[idx].رقم_المستاجر);
        if (tenant && tenant.رقم_الهاتف) {
          import('@/services/whatsAppAutoSender').then(({ sendContractTerminationNotice }) => {
            sendContractTerminationNotice(tenant.رقم_الهاتف, all[idx], reason, date);
          });
        }
      } catch (whatsappError) {
        console.warn('[WhatsApp] Failed to send termination notice', whatsappError);
      }
      
      return ok();
    }
    return fail('العقد غير موجود');
  };

  const renewContract = (id: string): DbResult<العقود_tbl> => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const idx = all.findIndex((c) => c.رقم_العقد === id);
    if (idx === -1) return fail('العقد غير موجود');
    const old = all[idx];
    if (old.linkedContractId) return fail('هذا العقد لديه تجديد بالفعل');

    const newStart = addDaysIso(old.تاريخ_النهاية, 1);
    if (!newStart) return fail('تاريخ نهاية العقد غير صالح');
    const endCandidate = addMonthsDateOnly(newStart, old.مدة_العقد_بالاشهر);
    if (!endCandidate) return fail('تعذر حساب تاريخ النهاية');
    endCandidate.setDate(endCandidate.getDate() - 1);
    const newEnd = formatDateOnly(endCandidate);

    const prevCommission = get<العمولات_tbl>(KEYS.COMMISSIONS).find((x) => x.رقم_العقد === id);
    const commOwner = prevCommission?.عمولة_المالك ?? 0;
    const commTenant = prevCommission?.عمولة_المستأجر ?? 0;
    const commissionPaidMonth = /^\d{4}-\d{2}-\d{2}$/.test(String(newStart))
      ? String(newStart).slice(0, 7)
      : undefined;

    const { رقم_العقد: _ignoreId, ...oldWithoutId } = old;
    const res = createContract(
      {
        ...oldWithoutId,
        تاريخ_البداية: newStart,
        تاريخ_النهاية: newEnd,
        حالة_العقد: 'نشط',
        isArchived: false,
        عقد_مرتبط: old.رقم_العقد,
        linkedContractId: undefined,
      },
      commOwner,
      commTenant,
      commissionPaidMonth
    );
    if (!res.success || !res.data) return fail(res.message || 'فشل إنشاء عقد التجديد');

    const newId = res.data.رقم_العقد;
    const all2 = get<العقود_tbl>(KEYS.CONTRACTS);
    const idx2 = all2.findIndex((c) => c.رقم_العقد === id);
    if (idx2 > -1) {
      all2[idx2].linkedContractId = newId;
      all2[idx2].حالة_العقد = 'مجدد';
      save(KEYS.CONTRACTS, all2);
    }

    const all3 = get<العقود_tbl>(KEYS.CONTRACTS);
    const nIdx = all3.findIndex((c) => c.رقم_العقد === newId);
    if (nIdx > -1) {
      all3[nIdx].عقد_مرتبط = id;
      save(KEYS.CONTRACTS, all3);
    }

    logOperation('Admin', 'تجديد', 'Contracts', id, `تم إنشاء عقد تجديد: ${newId}`);
    return ok(res.data, 'تم التجديد بنجاح');
  };

  return {
    createContract,
    updateContract,
    archiveContract,
    terminateContract,
    renewContract,
  };
}
