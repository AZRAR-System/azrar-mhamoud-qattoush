/**
 * Installment schedule generation + read helpers (payment mutations stay in mockDb).
 */

import type { DbResult } from '@/types';
import { العقود_tbl, الكمبيالات_tbl } from '@/types';
import { formatDateOnly, parseDateOnly } from '@/utils/dateOnly';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { get } from './kv';
import { KEYS } from './keys';
import { INSTALLMENT_STATUS } from './installmentConstants';

const ok = dbOk;
const fail = dbFail;

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

const addMonthsDateOnly = (isoDate: string, months: number) => {
  const d = parseDateOnly(isoDate);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setMonth(next.getMonth() + months);
  return next;
};

const calcDayDiffValue = (startIso: string, annualValue: number) => {
  const start = parseDateOnly(startIso);
  if (!start) return 0;
  const day = start.getDate();
  if (day <= 1) return 0;
  const dim = daysInMonth(start);
  const remainingDays = dim - day + 1;
  const monthRent = annualValue / 12;
  return Math.round((monthRent * remainingDays) / dim);
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

  const totalRent = Math.round(monthRentExact * durationMonths);

  const startIso = contract.تاريخ_البداية;
  const endIso = contract.تاريخ_النهاية;
  const start = parseDateOnly(startIso);
  const end = parseDateOnly(endIso);
  if (!start || !end) return fail('تواريخ العقد غير صالحة');

  let installmentRank = 1;

  if (contract.احتساب_فرق_ايام) {
    const dayDiffValue = calcDayDiffValue(startIso, annualValue);
    if (dayDiffValue > 0) {
      installments.push({
        رقم_الكمبيالة: `INS-${contractId}-DAYDIFF`,
        رقم_العقد: contractId,
        تاريخ_استحقاق: startIso,
        القيمة: dayDiffValue,
        حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
        isArchived: false,
        نوع_الكمبيالة: 'فرق أيام',
        ترتيب_الكمبيالة: installmentRank,
      });
      installmentRank++;
    }
  }

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
      ? Math.round(monthRentExact * downMonths)
      : rawDownPaymentValue
    : 0;

  const downCoverageMonths = hasDownPayment
    ? downMonths > 0
      ? downMonths
      : Math.trunc(normalizedPeriodMonths)
    : 0;

  if (downPaymentValue > 0) {
    if (splitDownPayment) {
      if (splitCount < 2) return fail('عدد أقساط الدفعة الأولى يجب أن يكون 2 أو أكثر');
      if (splitCount > durationMonths)
        return fail('عدد أقساط الدفعة الأولى لا يمكن أن يتجاوز مدة العقد بالأشهر');

      const base = Math.floor(downPaymentValue / splitCount);
      const rem = downPaymentValue - base * splitCount;
      for (let j = 0; j < splitCount; j++) {
        const due = addMonthsDateOnly(startIso, j);
        if (!due) continue;
        installments.push({
          رقم_الكمبيالة: `INS-${contractId}-DOWN-${j + 1}`,
          رقم_العقد: contractId,
          تاريخ_استحقاق: formatDateOnly(due),
          القيمة: base + (j === splitCount - 1 ? rem : 0),
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
    durationMonths - (downPaymentValue > 0 ? downCoverageMonths : 0)
  );
  const remainingRentTotal = Math.max(0, totalRent - downPaymentValue);

  const remainingRentInstallmentsCount =
    remainingMonths > 0 ? Math.max(1, Math.ceil(remainingMonths / normalizedPeriodMonths)) : 0;

  const rentBaseAmount =
    remainingRentInstallmentsCount > 0
      ? Math.floor(remainingRentTotal / remainingRentInstallmentsCount)
      : 0;
  const rentRemainder =
    remainingRentInstallmentsCount > 0
      ? remainingRentTotal - rentBaseAmount * remainingRentInstallmentsCount
      : 0;

  for (let i = 0; i < remainingRentInstallmentsCount; i++) {
    const baseOffset =
      (downPaymentValue > 0 ? downCoverageMonths : 0) + Math.round(i * normalizedPeriodMonths);
    const paymentOffset =
      contract.طريقة_الدفع === 'Postpaid' ? Math.round(normalizedPeriodMonths) : 0;
    const due = addMonthsDateOnly(startIso, baseOffset + paymentOffset);
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
  const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find(
    (i) => i.رقم_الكمبيالة === installmentId
  );
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
