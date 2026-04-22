import { roundCurrency } from '@/utils/format';
import { parseDateOnly, formatDateOnly } from '@/utils/dateOnly';
import type { العقود_tbl, الكمبيالات_tbl } from '@/types';

/**
 * © 2026 — AZRAR Contract Financial Engine
 * Single Source of Truth for all contract scheduling and arithmetic.
 */

export const CONTRACT_STATUS_AR = {
  ACTIVE: 'نشط',
  NEAR_EXPIRY: 'قريب الانتهاء',
  ENDED: 'منتهي',
  TERMINATED: 'مفسوخ',
  COLLECTION: 'تحصيل',
  ARCHIVED: 'مؤرشف',
  CANCELLED: 'ملغي',
};

export class ContractFinancialEngine {
  private static daysInMonth(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  /**
   * Calculates the value of the partial first month (Day Difference).
   * Equation: (MonthlyRent / ActualDaysInMonth) * GapDays
   */
  public static calculateDayDiffValue(startIso: string, annualValue: number, paymentDay: number): number {
    const start = parseDateOnly(startIso);
    if (!start) return 0;

    const pDay = Number(paymentDay);
    const cDay = start.getDate();

    if (cDay === pDay) return 0;

    const monthlyRent = Number(annualValue) / 12;
    const dim = this.daysInMonth(start);
    let gapDays = 0;

    if (pDay === 1) {
        gapDays = dim - cDay + 1;
    } else if (cDay > pDay) {
        gapDays = (dim - cDay) + pDay;
    } else {
        gapDays = pDay - cDay;
    }

    return roundCurrency((monthlyRent / dim) * gapDays);
  }

  /**
   * Generates the complete installment schedule for a contract.
   * Model: Gap(Extra) + N Periodic Payments + Insurance.
   */
  public static calculateSchedule(contract: Partial<العقود_tbl>, contractId: string): الكمبيالات_tbl[] {
    const installments: الكمبيالات_tbl[] = [];
    
    const startIso = contract.تاريخ_البداية || '';
    const annualValue = Math.max(0, Number(contract.القيمة_السنوية || 0));
    const durationMonths = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
    
    // Frequencies: monthly=12, bimonthly=6, quarterly=4, semi_annual=2, annual=1
    // Wait, the UI passes تكرار_الدفع as count of payments per year usually.
    // Let's assume frequencyMonths = 12 / paymentsPerYear
    const paymentsPerYear = Math.max(1, Number(contract.تكرار_الدفع || 12));
    const frequencyMonths = 12 / paymentsPerYear;
    
    const monthlyRent = annualValue / 12;
    const start = parseDateOnly(startIso);
    if (!start) return [];

    let rank = 1;

    // --- 1. START GAP (Day Difference) ---
    // If start day matches payment day, no gap is needed.
    const enableDayDiff = Boolean(contract.احتساب_فرق_ايام);
    const pDay = Number(contract.يوم_الدفع || 1);
    const dateMatches = start.getDate() === pDay;
    
    if (enableDayDiff && !dateMatches) {
      const manualAmountRaw = contract.مبلغ_الفرقية;
      const autoAmount = this.calculateDayDiffValue(startIso, annualValue, pDay);
      
      // Only use manual if it's a valid number string or number, and NOT empty string
      const isManualProvided = manualAmountRaw !== undefined && manualAmountRaw !== null && String(manualAmountRaw).trim() !== '';
      const dayDiffValue = isManualProvided ? Number(manualAmountRaw) : autoAmount;

      if (dayDiffValue > 0) {
        installments.push(this.createInstallment({
          contractId,
          rank: rank++,
          date: startIso,
          amount: dayDiffValue,
          type: 'فرق أيام',
          note: 'فرقية بداية العقد (مبلغ إضافي)',
        }));
      }
    }

    // --- 2. DOWN PAYMENT ---
    let periodicOffsetMonths = 0;
    if (contract.يوجد_دفعة_اولى) {
      const isByMonths = Number(contract.عدد_أشهر_الدفعة_الأولى || 0) > 0;
      const dpTotalAmount = isByMonths
        ? roundCurrency(monthlyRent * Number(contract.عدد_أشهر_الدفعة_الأولى))
        : Number(contract.قيمة_الدفعة_الاولى || 0);

      if (dpTotalAmount > 0) {
        if (isByMonths) {
          periodicOffsetMonths = Number(contract.عدد_أشهر_الدفعة_الأولى);
        }

        const splitCount = contract.تقسيط_الدفعة_الأولى ? Math.max(2, Number(contract.عدد_أقساط_الدفعة_الأولى || 2)) : 1;
        const dpInstallmentAmount = roundCurrency(dpTotalAmount / splitCount);

        for (let i = 0; i < splitCount; i++) {
          const dpDate = new Date(start);
          if (i > 0) dpDate.setMonth(dpDate.getMonth() + i);

          installments.push(this.createInstallment({
            contractId,
            rank: rank++,
            date: formatDateOnly(dpDate),
            amount: i === splitCount - 1 ? (dpTotalAmount - (dpInstallmentAmount * (splitCount - 1))) : dpInstallmentAmount,
            type: 'دفعة أولى',
            note: splitCount > 1 ? `دفعة أولى (قسط ${i + 1}/${splitCount})` : 'الدفعة الأولى',
          }));
        }
      }
    }

    // --- 3. PERIODIC INSTALLMENTS ---
    // Periodic starts from the next paymentDay, potentially offset by down payment.
    const firstPaymentDate = new Date(start);
    if (dateMatches) {
        // Starts immediately
    } else if (start.getDate() < pDay) {
        firstPaymentDate.setDate(pDay);
    } else {
        firstPaymentDate.setMonth(start.getMonth() + 1);
        firstPaymentDate.setDate(pDay);
    }

    // Offset the starting month if down payment covered some months
    if (periodicOffsetMonths > 0) {
        firstPaymentDate.setMonth(firstPaymentDate.getMonth() + periodicOffsetMonths);
    }

    const remainingMonths = Math.max(0, durationMonths - periodicOffsetMonths);
    const periodicCount = Math.ceil(remainingMonths / frequencyMonths);
    const periodicAmount = roundCurrency(monthlyRent * frequencyMonths);

    for (let i = 0; i < periodicCount; i++) {
        const monthTarget = firstPaymentDate.getMonth() + (i * frequencyMonths);
        const instDate = new Date(firstPaymentDate.getFullYear(), monthTarget, pDay);
        
        // Handle month rollover (e.g. Jan 31 -> Feb 28 instead of Mar 3)
        if (instDate.getDate() !== pDay) {
            instDate.setDate(0); 
        }

        installments.push(this.createInstallment({
          contractId,
          rank: rank++,
          date: formatDateOnly(instDate),
          amount: periodicAmount,
          type: 'دورية',
          note: `قسط دوري ${i + 1}/${periodicCount}`,
        }));
    }

    // --- 4. BALANCING (ROUNDING FIX) ---
    // User requested: "فرق تقريب: 0.01 د.أ — سيُضاف لآخر قسط"
    // Only balance periodic installments if duration matches.
    const totalCurrent = installments.reduce((sum, inst) => sum + inst.القيمة, 0);
    const expectedTotal = annualValue + (enableDayDiff ? installments.find(ix => ix.نوع_الدفعة === 'فرق أيام')?.القيمة || 0 : 0);
    
    const balanceDiff = roundCurrency(expectedTotal - totalCurrent);
    if (Math.abs(balanceDiff) > 0 && installments.length > 0) {
        // Add diff to the last 'دورية' or 'دفعة أولى' installment
        for (let i = installments.length - 1; i >= 0; i--) {
            if (installments[i].نوع_الدفعة === 'دورية' || installments[i].نوع_الدفعة === 'دفعة أولى') {
                installments[i].القيمة = roundCurrency(installments[i].القيمة + balanceDiff);
                installments[i].ملاحظات += ` (تمت إضافة فرق تقريب: ${balanceDiff})`;
                break;
            }
        }
    }

    return installments;
  }

  private static createInstallment(params: {
    contractId: string;
    rank: number;
    date: string;
    amount: number;
    type: string;
    note?: string;
  }): الكمبيالات_tbl {
    return {
      رقم_الكمبيالة: `INS-${params.contractId}-${params.rank}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      رقم_العقد: params.contractId,
      تاريخ_استحقاق: params.date,
      القيمة: roundCurrency(params.amount),
      القيمة_المتبقية: roundCurrency(params.amount),
      حالة_الكمبيالة: 'غير مدفوع',
      نوع_الكمبيالة: 'كمبيالة',
      نوع_الدفعة: params.type as الكمبيالات_tbl['نوع_الدفعة'],
      ترتيب_الكمبيالة: params.rank,
      ملاحظات: params.note || '',
      سجل_الدفعات: [],
    };
  }
}
