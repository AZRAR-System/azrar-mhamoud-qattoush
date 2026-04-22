/**
 * Installment schedule generation, reads, and payment mutations (factory deps avoid cycles with mockDb).
 */

import type { DbResult, RoleType } from '@/types';
import { العقود_tbl, الكمبيالات_tbl } from '@/types';
import { formatCurrencyJOD, roundCurrency } from '@/utils/format';
import { formatDateOnly, parseDateOnly, toDateOnly, addDaysDateOnly, todayDateOnlyISO, daysBetweenDateOnly } from '@/utils/dateOnly';
import { addMonthsDateOnly } from '@/services/db/utils/dates';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { get, save } from './kv';
import { KEYS } from './keys';
import { INSTALLMENT_STATUS } from './installmentConstants';

const ok = dbOk;
const fail = dbFail;

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();


const calcDayDiffValue = (startIso: string, annualValue: number) => {
  const start = parseDateOnly(startIso);
  if (!start) return 0;
  const day = start.getDate();
  if (day <= 1) return 0;
  const dim = daysInMonth(start);
  const remainingDays = dim - day + 1;
  const monthRent = annualValue / 12;
  return roundCurrency((monthRent * remainingDays) / dim);
};

const toFirstOfNextMonth = (iso: string) => {
  const d = parseDateOnly(iso);
  if (!d) return iso;
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return formatDateOnly(next);
};

/** Used by alerts/scans and mockDb payment logic — single source of truth. */
export const getInstallmentPaidAndRemaining = (inst: الكمبيالات_tbl) => {
  const norm = (v: unknown) => String(v ?? '').trim();

  if (norm(inst.حالة_الكمبيالة) === INSTALLMENT_STATUS.PAID) {
    return { paid: Math.max(0, inst.القيمة), remaining: 0 };
  }

  const rawRemaining = asUnknownRecord(inst)['القيمة_المتبقية'];
  if (typeof rawRemaining === 'number' && Number.isFinite(rawRemaining)) {
    const total = Math.max(0, inst.القيمة);
    const remaining = Math.max(0, Math.min(total, rawRemaining));
    const paid = Math.max(0, Math.min(total, total - remaining));
    return { paid, remaining };
  }

  const paidFromHistory =
    inst.سجل_الدفعات?.reduce((sum, p) => sum + (p.المبلغ > 0 ? p.المبلغ : 0), 0) || 0;
  const paid = Math.max(0, Math.min(inst.القيمة, paidFromHistory));
  const remaining = Math.max(0, inst.القيمة - paid);
  return { paid, remaining };
};

export const generateContractInstallmentsInternal = (
  contract: العقود_tbl,
  contractId: string
): DbResult<الكمبيالات_tbl[]> => {
  const installments: الكمبيالات_tbl[] = [];

  const durationMonths = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
  const paymentsPerYear = Math.max(1, Number(contract.تكرار_الدفع || 12));
  const annualValue = Math.max(0, Number(contract.القيمة_السنوية || 0));

  const monthRentExact = annualValue / 12;

  const periodMonths = 12 / paymentsPerYear;
  const normalizedPeriodMonths =
    Number.isFinite(periodMonths) && periodMonths > 0 ? periodMonths : 1;

  const totalRent = roundCurrency(monthRentExact * durationMonths);

  const startIso = contract.تاريخ_البداية;
  const endIso = contract.تاريخ_النهاية;
  const start = parseDateOnly(startIso);
  const end = parseDateOnly(endIso);
  if (!start || !end) return fail('تواريخ العقد غير صالحة');

  let installmentRank = 1;

  let dayDiffValue = 0;
  let dayDiffActive = false;
  if (contract.احتساب_فرق_ايام) {
    dayDiffValue = calcDayDiffValue(startIso, annualValue);
    if (dayDiffValue > 0) {
      dayDiffActive = true;
      installments.push({
        رقم_الكمبيالة: `INS-${contractId}-DAYDIFF`,
        رقم_العقد: contractId,
        تاريخ_استحقاق: startIso,
        القيمة: dayDiffValue,
        حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
        isArchived: false,
        نوع_الكمبيالة: 'إيجار',
        نوع_الدفعة: 'فرق أيام',
        ترتيب_الكمبيالة: installmentRank,
      });
      installmentRank++;
    }
  }

  const periodicStartIso = dayDiffActive ? toFirstOfNextMonth(startIso) : startIso;

  const rawDownPaymentValue =
    contract.يوجد_دفعة_اولى && contract.قيمة_الدفعة_الاولى && contract.قيمة_الدفعة_الاولى > 0
      ? contract.قيمة_الدفعة_الاولى
      : 0;

  const rawDownMonths = Number(asUnknownRecord(contract)['عدد_أشهر_الدفعة_الأولى'] ?? 0);
  const downMonths = Number.isFinite(rawDownMonths) ? Math.trunc(rawDownMonths) : 0;
  const hasDownPayment =
    Boolean(contract.يوجد_دفعة_اولى) && (rawDownPaymentValue > 0 || downMonths > 0);

  const splitDownPayment = Boolean(asUnknownRecord(contract)['تقسيط_الدفعة_الأولى']);
  const rawSplitCount = Number(asUnknownRecord(contract)['عدد_أقساط_الدفعة_الأولى'] ?? 0);
  const splitCount = Number.isFinite(rawSplitCount) ? Math.trunc(rawSplitCount) : 0;

  if (splitDownPayment && downMonths > 0) {
    return fail('لا يمكن الجمع بين "تقسيط الدفعة الأولى" و"عدد أشهر الدفعة الأولى"');
  }

  const maxDownMonths = Math.min(60, durationMonths);
  if (downMonths < 0 || downMonths > maxDownMonths) {
    return fail(`عدد أشهر الدفعة الأولى يجب أن يكون بين 0 و ${maxDownMonths}`);
  }

  const downPaymentValue = hasDownPayment
    ? downMonths > 0
      ? roundCurrency(monthRentExact * downMonths)
      : rawDownPaymentValue
    : 0;

  const downCoverageMonths = hasDownPayment
    ? downMonths > 0
      ? downMonths
      : Math.trunc(normalizedPeriodMonths)
    : 0;

  if (downPaymentValue > 0) {
    if (splitDownPayment) {
      const splitCount = Math.max(1, Number(contract.عدد_أقساط_الدفعة_الأولى || 1));
      if (splitCount < 2) return fail('عدد أقساط الدفعة الأولى يجب أن يكون 2 أو أكثر');
      if (splitCount > durationMonths)
        return fail('عدد أقساط الدفعة الأولى لا يمكن أن يتجاوز مدة العقد بالأشهر');

      const base = roundCurrency(downPaymentValue / splitCount);
      const remainder = roundCurrency(downPaymentValue - base * splitCount);
      for (let j = 0; j < splitCount; j++) {
        const due = addMonthsDateOnly(startIso, j);
        if (!due) continue;
        installments.push({
          رقم_الكمبيالة: `INS-${contractId}-DOWN-${j + 1}`,
          رقم_العقد: contractId,
          تاريخ_استحقاق: formatDateOnly(due),
          القيمة: base + (j === splitCount - 1 ? remainder : 0),
          حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
          isArchived: false,
          نوع_الكمبيالة: 'دفعة أولى',
          نوع_الدفعة: 'دفعة أولى',
          رقم_القسط: j + 1,
          ترتيب_الكمبيالة: installmentRank,
        });
        installmentRank++;
      }
    } else {
      installments.push({
        رقم_الكمبيالة: `INS-${contractId}-DOWN`,
        رقم_العقد: contractId,
        تاريخ_استحقاق: startIso,
        القيمة: downPaymentValue,
        حالة_الكمبيالة: INSTALLMENT_STATUS.PAID,
        isArchived: false,
        نوع_الكمبيالة: 'دفعة أولى',
        نوع_الدفعة: 'دفعة أولى',
        رقم_القسط: 1,
        ترتيب_الكمبيالة: installmentRank,
      });
      installmentRank++;
    }
  }

  const remainingMonths = Math.max(
    0,
    durationMonths - (downPaymentValue > 0 ? downCoverageMonths : 0) - (dayDiffActive ? 1 : 0)
  );
  const remainingRentTotal = Math.max(0, totalRent - downPaymentValue - dayDiffValue);

  const remainingRentInstallmentsCount =
    remainingMonths > 0 ? Math.max(1, Math.ceil(remainingMonths / normalizedPeriodMonths)) : 0;

  const rentBaseAmount =
    remainingRentInstallmentsCount > 0
      ? roundCurrency(remainingRentTotal / remainingRentInstallmentsCount)
      : 0;
  const rentRemainder =
    remainingRentInstallmentsCount > 0
      ? roundCurrency(remainingRentTotal - rentBaseAmount * remainingRentInstallmentsCount)
      : 0;

  for (let i = 0; i < remainingRentInstallmentsCount; i++) {
    const baseOffset =
      (downPaymentValue > 0 ? downCoverageMonths : 0) + Math.round(i * normalizedPeriodMonths);
    const paymentOffset =
      contract.طريقة_الدفع === 'Postpaid' ? roundCurrency(normalizedPeriodMonths) : 0;
    const due = addMonthsDateOnly(periodicStartIso, baseOffset + paymentOffset);
    if (!due) continue;
    const installmentAmount =
      rentBaseAmount + (i === remainingRentInstallmentsCount - 1 ? rentRemainder : 0);
    installments.push({
      رقم_الكمبيالة: `INS-${contractId}-${i + 1}`,
      رقم_العقد: contractId,
      تاريخ_استحقاق: formatDateOnly(due),
      القيمة: installmentAmount,
      حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
      isArchived: false,
      نوع_الكمبيالة: 'إيجار',
      نوع_الدفعة: 'دورية',
      رقم_القسط: i + 1,
      ترتيب_الكمبيالة: installmentRank,
    });
    installmentRank++;
  }

  if (contract.قيمة_التأمين && contract.قيمة_التأمين > 0) {
    const securityDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    securityDate.setDate(securityDate.getDate() - 1);

    installments.push({
      رقم_الكمبيالة: `INS-${contractId}-SEC`,
      رقم_العقد: contractId,
      تاريخ_استحقاق: formatDateOnly(securityDate),
      القيمة: contract.قيمة_التأمين,
      حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
      isArchived: false,
      نوع_الكمبيالة: 'تأمين',
      نوع_الدفعة: 'تأمين',
      ترتيب_الكمبيالة: installmentRank,
    });
    installmentRank++;
  }

  return ok(installments);
};

export const getInstallmentPaymentSummary = (installmentId: string) => {
  const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find((i) => i.رقم_الكمبيالة === installmentId);
  if (!inst) return null;
  return getInstallmentPaidAndRemaining(inst);
};

export const calculateAutoLateFees = (
  contract: العقود_tbl,
  installments: الكمبيالات_tbl[]
): Array<{ installmentId: string; suggestedFee: number; daysLate: number }> => {
  if (contract.lateFeeType === 'none' || !contract.lateFeeType) return [];

  const today = parseDateOnly(todayDateOnlyISO())!;
  const grace = Number(contract.lateFeeGraceDays || 0);
  const type = contract.lateFeeType;
  const value = Number(contract.lateFeeValue || 0);
  const max = contract.lateFeeMaxAmount ? Number(contract.lateFeeMaxAmount) : Infinity;

  const results: Array<{ installmentId: string; suggestedFee: number; daysLate: number }> = [];

  for (const inst of installments) {
    const { remaining } = getInstallmentPaidAndRemaining(inst);
    if (remaining <= 0) continue;

    const due = parseDateOnly(inst.تاريخ_استحقاق);
    if (!due) continue;

    const daysLate = daysBetweenDateOnly(due, today);
    if (daysLate <= grace) continue;

    let fee = 0;
    if (type === 'fixed') {
      fee = value;
    } else if (type === 'percentage') {
      fee = roundCurrency((inst.القيمة * value) / 100);
    } else if (type === 'daily') {
      fee = roundCurrency(value * (daysLate - grace));
    }

    const cappedFee = Math.min(fee, max);
    if (cappedFee > 0) {
      results.push({
        installmentId: inst.رقم_الكمبيالة,
        suggestedFee: cappedFee,
        daysLate,
      });
    }
  }

  return results;
};

export const getInstallmentStatus = (installmentId: string) => {
  const inst = getInstallments().find((i) => i.رقم_الكمبيالة === installmentId);
  if (!inst) return null;

  const totalPaid =
    inst.سجل_الدفعات?.reduce((sum, p) => sum + (p.المبلغ > 0 ? p.المبلغ : 0), 0) || 0;
  const remainingAmount = Math.max(0, inst.القيمة - totalPaid);

  return {
    installmentId,
    totalAmount: inst.القيمة,
    paidAmount: totalPaid,
    remainingAmount,
    status: inst.حالة_الكمبيالة,
    paymentDate: inst.تاريخ_الدفع,
    notes: inst.ملاحظات,
    paymentHistory: inst.سجل_الدفعات || [],
    progressPercent: Math.round((totalPaid / inst.القيمة) * 100),
  };
};

type LogMeta = {
  ipAddress?: string;
  deviceInfo?: string;
};

export type InstallmentPaymentDeps = {
  logOperation: (
    user: string,
    action: string,
    table: string,
    recordId: string,
    details: string,
    meta?: LogMeta
  ) => void;
  markAlertsReadByPrefix: (prefix: string) => void;
  updateTenantRating: (tenantId: string, paymentType: 'full' | 'partial' | 'late') => void;
};

export function createInstallmentPaymentHandlers(deps: InstallmentPaymentDeps) {
  const { logOperation, markAlertsReadByPrefix, updateTenantRating } = deps;
  const fail = dbFail;
  const ok = dbOk;

  const markInstallmentPaid = (
    id: string,
    userId: string,
    role: RoleType,
    paymentDetails?: {
      paidAmount?: number;
      paymentDate?: string;
      notes?: string;
      isPartial?: boolean;
    }
  ) => {
    const ALLOWED_ROLES: RoleType[] = ['SuperAdmin', 'Admin'];
    if (!ALLOWED_ROLES.includes(role)) {
      return fail(`الصلاحية غير كافية (${role}): يُسمح فقط بـ ${ALLOWED_ROLES.join(', ')}`);
    }

    const all = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const idx = all.findIndex((i) => i.رقم_الكمبيالة === id);
    if (idx === -1) {
      return fail('الكمبيالة غير موجودة');
    }

    const inst = JSON.parse(JSON.stringify(all[idx])) as الكمبيالات_tbl;
    if (!inst.سجل_الدفعات) inst.سجل_الدفعات = [];

    if (inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID) {
      return fail('لا يمكن سداد كمبيالة مدفوعة بالفعل');
    }

    if (!paymentDetails?.paidAmount || paymentDetails.paidAmount <= 0) {
      return fail('يجب تحديد مبلغ أكبر من صفر');
    }

    const paymentsLog = inst.سجل_الدفعات;
    const totalPaid = paymentsLog.reduce((sum, p) => sum + (p.المبلغ > 0 ? p.المبلغ : 0), 0);
    const currentRemaining = inst.القيمة - totalPaid;

    if (paymentDetails.paidAmount > currentRemaining) {
      return fail(
        `المبلغ المدفوع (${paymentDetails.paidAmount}) يتجاوز المتبقي (${currentRemaining})`
      );
    }

    const paymentDate = paymentDetails?.paymentDate
      ? paymentDetails.paymentDate.split('T')[0]
      : formatDateOnly(toDateOnly(new Date()));

    const newTotal = totalPaid + paymentDetails.paidAmount;
    let newStatus: string;

    if (newTotal >= inst.القيمة) {
      newStatus = INSTALLMENT_STATUS.PAID;
    } else if (newTotal > 0) {
      newStatus = INSTALLMENT_STATUS.PARTIAL;
    } else {
      newStatus = INSTALLMENT_STATUS.UNPAID;
    }

    const operationId = `OP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    paymentsLog.push({
      رقم_العملية: operationId,
      المبلغ: paymentDetails.paidAmount,
      التاريخ: paymentDate,
      الملاحظات: paymentDetails.notes,
      المستخدم: userId,
      الدور: role,
      النوع: newTotal >= inst.القيمة ? 'FULL' : 'PARTIAL',
    });

    inst.حالة_الكمبيالة = newStatus;
    inst.تاريخ_الدفع = paymentDate;
    inst.القيمة_المتبقية = Math.max(0, inst.القيمة - newTotal);
    inst.ملاحظات = (inst.ملاحظات || '').trim();
    if (paymentDetails?.notes) {
      inst.ملاحظات += (inst.ملاحظات ? '\n' : '') + `[${paymentDate}] ${paymentDetails.notes}`;
    }

    all[idx] = inst;
    save(KEYS.INSTALLMENTS, all);

    let operationDesc = `[${role}] ${userId} - `;
    const isPartialPayment = paymentDetails?.isPartial ?? false;
    if (isPartialPayment) {
      operationDesc += `سداد جزئي - المبلغ المدفوع: ${formatCurrencyJOD(paymentDetails.paidAmount)}، الباقي: ${formatCurrencyJOD(inst.القيمة_المتبقية)} من إجمالي ${formatCurrencyJOD(inst.القيمة)}`;
    } else {
      operationDesc += `سداد كامل - المبلغ: ${formatCurrencyJOD(inst.القيمة)} في ${inst.تاريخ_الدفع}`;
    }

    if (paymentDetails?.notes) {
      operationDesc += ` | الملاحظات: ${paymentDetails.notes}`;
    }

    logOperation(userId, 'سداد كمبيالة', 'الكمبيالات', id, operationDesc);

    try {
      if (newStatus === INSTALLMENT_STATUS.PAID) {
        markAlertsReadByPrefix(`ALR-FIN-REM7-${id}`);
        markAlertsReadByPrefix(`ALR-FIN-PAY-${id}`);
      }
    } catch {
      // ignore alert cleanup failures
    }

    try {
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const contract = contracts.find((c) => c.رقم_العقد === inst.رقم_العقد);
      const tenantId = contract?.رقم_المستاجر;
      if (tenantId) {
        const due = parseDateOnly(inst.تاريخ_استحقاق);
        const paid = parseDateOnly(paymentDate);
        const isLate = !!(due && paid && toDateOnly(paid).getTime() > toDateOnly(due).getTime());
        const isPartial = paymentDetails?.isPartial ?? newStatus === INSTALLMENT_STATUS.PARTIAL;
        const paymentType: 'full' | 'partial' | 'late' = isLate
          ? 'late'
          : isPartial
            ? 'partial'
            : 'full';
        updateTenantRating(tenantId, paymentType);
      }
    } catch {
      // ignore rating failures
    }

    return ok();
  };

  const setInstallmentLateFee = (
    installmentId: string,
    userId: string,
    role: RoleType,
    payload: { amount: number; classification?: string; note?: string; date?: string }
  ): DbResult<null> => {
    const ALLOWED_ROLES: RoleType[] = ['SuperAdmin', 'Admin'];
    if (!ALLOWED_ROLES.includes(role)) {
      return fail(`الصلاحية غير كافية (${role}): يُسمح فقط بـ ${ALLOWED_ROLES.join(', ')}`);
    }

    const amount = Number(payload.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) return fail('قيمة الغرامة غير صالحة');

    const all = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const idx = all.findIndex((i) => i.رقم_الكمبيالة === installmentId);
    if (idx === -1) return fail('الكمبيالة غير موجودة');

    const inst = JSON.parse(JSON.stringify(all[idx])) as الكمبيالات_tbl;
    const date = payload.date
      ? String(payload.date).split('T')[0]
      : formatDateOnly(toDateOnly(new Date()));

    asUnknownRecord(inst)['غرامة_تأخير'] = amount;
    asUnknownRecord(inst)['تصنيف_غرامة_تأخير'] = (payload.classification || '').trim() || undefined;
    asUnknownRecord(inst)['تاريخ_احتساب_غرامة_تأخير'] = date;

    inst.ملاحظات = (inst.ملاحظات || '').trim();
    const extraNote = (payload.note || '').trim();
    const noteLine = `غرامة تأخير: ${formatCurrencyJOD(amount)}${payload.classification ? ` | التصنيف: ${payload.classification}` : ''}${extraNote ? ` | ملاحظة: ${extraNote}` : ''}`;
    inst.ملاحظات += (inst.ملاحظات ? '\n' : '') + `[${date}] ${noteLine}`;

    all[idx] = inst;
    save(KEYS.INSTALLMENTS, all);

    logOperation(
      userId,
      'تسجيل غرامة تأخير',
      'الكمبيالات',
      installmentId,
      `[${role}] ${userId} - ${noteLine}`
    );
    return ok();
  };

  const reversePayment = (id: string, userId: string, role: RoleType, reason: string) => {
    if (role !== 'SuperAdmin') {
      const errorMsg = `🚫 Unauthorized Reverse Payment: Role=${role}, UserId=${userId}`;
      logOperation(userId, 'عكس سداد - فشل', 'الكمبيالات', id, `${errorMsg}. السبب: ${reason}`);
      return fail('فقط السوبر أدمن يمكنه عكس السداد. العملية مسجلة.');
    }

    if (!reason || reason.trim().length === 0) {
      logOperation(userId, 'عكس سداد - فشل', 'الكمبيالات', id, '❌ بدون سبب');
      return fail('سبب عكس السداد إلزامي للتدقيق');
    }

    const all = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const idx = all.findIndex((i) => i.رقم_الكمبيالة === id);
    if (idx === -1) {
      logOperation(userId, 'عكس سداد - فشل', 'الكمبيالات', id, '❌ الكمبيالة غير موجودة');
      return fail('الكمبيالة غير موجودة');
    }

    const inst = JSON.parse(JSON.stringify(all[idx])) as الكمبيالات_tbl;

    if (
      inst.حالة_الكمبيالة === INSTALLMENT_STATUS.UNPAID ||
      inst.حالة_الكمبيالة === INSTALLMENT_STATUS.CANCELLED
    ) {
      const msg = `لا يمكن عكس سداد كمبيالة ${inst.حالة_الكمبيالة}`;
      logOperation(userId, 'عكس سداد - فشل', 'الكمبيالات', id, msg);
      return fail(msg);
    }

    if (!inst.سجل_الدفعات || inst.سجل_الدفعات.length === 0) {
      logOperation(userId, 'عكس سداد - فشل', 'الكمبيالات', id, '❌ لا يوجد سجل دفعات');
      return fail('لا توجد عمليات دفع لعكسها');
    }

    const lastPayment = inst.سجل_الدفعات[inst.سجل_الدفعات.length - 1];
    if (lastPayment.رقم_العملية.startsWith('REVERSAL_')) {
      const msg = 'آخر عملية هي عكس - لا يمكن عكس العكس (Reverse of Reverse)';
      logOperation(userId, 'عكس سداد - فشل', 'الكمبيالات', id, msg);
      return fail(msg);
    }

    const reversedAmount = lastPayment.المبلغ;
    const previousOperation = { ...lastPayment };

    inst.سجل_الدفعات = inst.سجل_الدفعات.slice(0, -1);

    const newTotal = inst.سجل_الدفعات.reduce((sum, p) => sum + (p.المبلغ > 0 ? p.المبلغ : 0), 0);
    let newStatus: string;

    if (newTotal >= inst.القيمة) {
      newStatus = INSTALLMENT_STATUS.PAID;
    } else if (newTotal > 0) {
      newStatus = INSTALLMENT_STATUS.PARTIAL;
    } else {
      newStatus = INSTALLMENT_STATUS.UNPAID;
    }

    const reversalDate = new Date().toISOString().split('T')[0];
    const reversalRecord = {
      رقم_العملية: `REVERSAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      المبلغ: -reversedAmount,
      التاريخ: reversalDate,
      الملاحظات: `🔄 عكس: ${reason} | كانت: ${formatCurrencyJOD(Number(previousOperation.المبلغ || 0))} بتاريخ ${previousOperation.التاريخ}`,
      المستخدم: userId,
      الدور: role,
      النوع: 'PARTIAL' as const,
    };
    inst.سجل_الدفعات.push(reversalRecord);

    inst.حالة_الكمبيالة = newStatus;
    inst.القيمة_المتبقية = Math.max(0, inst.القيمة - newTotal);

    if (newStatus === INSTALLMENT_STATUS.UNPAID) {
      inst.تاريخ_الدفع = undefined;
    } else if (inst.سجل_الدفعات.length > 0) {
      const lastNonReversal = inst.سجل_الدفعات
        .slice()
        .reverse()
        .find((p) => p.المبلغ > 0);
      inst.تاريخ_الدفع = lastNonReversal?.التاريخ;
    }

    inst.ملاحظات = (inst.ملاحظات || '').trim();
    inst.ملاحظات += (inst.ملاحظات ? '\n' : '') + `[${reversalDate}] 🔄 عكس: ${reason}`;

    all[idx] = inst;
    save(KEYS.INSTALLMENTS, all);

    const auditDesc =
      `[HIGH-RISK] ${role}/${userId} عكس السداد\n` +
      `├─ الكمبيالة: ${id}\n` +
      `├─ المبلغ المعكوس: ${formatCurrencyJOD(reversedAmount)}\n` +
      `├─ آخر عملية أصلية: ${previousOperation.رقم_العملية}\n` +
      `├─ الحالة السابقة: ${inst.حالة_الكمبيالة}\n` +
      `├─ الحالة الجديدة: ${newStatus}\n` +
      `├─ المجموع الجديد: ${formatCurrencyJOD(newTotal)}\n` +
      `├─ السبب: ${reason}\n` +
      `└─ التاريخ: ${reversalDate}`;
    logOperation(userId, 'عكس سداد - نجح', 'الكمبيالات', id, auditDesc);

    return ok(
      inst,
      `✅ تم عكس السداد بنجاح: ${formatCurrencyJOD(reversedAmount)} (السبب: ${reason})`
    );
  };

  return { markInstallmentPaid, setInstallmentLateFee, reversePayment };
}

/**
 * جلب جميع الكمبيالات
 */
export function getInstallments(): الكمبيالات_tbl[] {
  return get<الكمبيالات_tbl>(KEYS.INSTALLMENTS) || [];
}

/**
 * تحديث الحقول الديناميكية (بيانات إضافية) لكمبيالة معينة.
 */
export function updateInstallmentDynamicFields(id: string, fields: Record<string, unknown>) {
  const all = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
  const idx = all.findIndex((i) => i.رقم_الكمبيالة === id);
  if (idx === -1) return dbFail('الكمبيالة غير موجودة');
  all[idx] = { ...all[idx], ...fields };
  save(KEYS.INSTALLMENTS, all);
  return dbOk(all[idx]);
}
