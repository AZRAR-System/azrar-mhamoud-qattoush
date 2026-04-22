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

    const currentDay = start.getDate();
    if (currentDay === paymentDay) return 0;

    const monthlyRent = annualValue / 12;
    const dim = this.daysInMonth(start);
    
    let gapDays = 0;
    if (currentDay < paymentDay) {
        gapDays = paymentDay - currentDay;
    } else {
        // Gap until end of month + days until payment day in next month? 
        // User Example: 20/05 to 01/06 (13 days? Prompt says 12 days).
        // Let's check 20 to 1st: 31 - 20 + 1 = 12. Correct.
        gapDays = (dim - currentDay) + (paymentDay > 1 ? (paymentDay - 1) : 1);
        // Wait, if paymentDay is 1: (31 - 20) + 1 = 12. 
        // If paymentDay is 13: (31 - 20) + 13 = 24? 
        // Let's re-verify the prompt example: 20/05 -> 01/06 (300/31 * 12) = 116.13.
        // My daysBetween logic: 31 - 20 + 1 = 12.
        if (paymentDay === 1) {
            gapDays = dim - currentDay + 1;
        } else if (currentDay > paymentDay) {
            gapDays = (dim - currentDay) + paymentDay;
        } else {
            gapDays = paymentDay - currentDay;
        }
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
    const paymentDay = Number(contract.يوم_الدفع || 1);
    
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
    const dateMatches = start.getDate() === paymentDay;
    
    if (enableDayDiff && !dateMatches) {
      const manualAmount = contract.مبلغ_الفرقية;
      const autoAmount = this.calculateDayDiffValue(startIso, annualValue, paymentDay);
      const dayDiffValue = manualAmount !== undefined ? Number(manualAmount) : autoAmount;

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

    // --- 2. PERIODIC INSTALLMENTS ---
    // Periodic starts from the next paymentDay.
    const firstPaymentDate = new Date(start);
    if (dateMatches) {
        // Starts immediately
    } else if (start.getDate() < paymentDay) {
        firstPaymentDate.setDate(paymentDay);
    } else {
        firstPaymentDate.setMonth(start.getMonth() + 1);
        firstPaymentDate.setDate(paymentDay);
    }

    const periodicCount = Math.ceil(durationMonths / frequencyMonths);
    const periodicAmount = roundCurrency(monthlyRent * frequencyMonths);

    for (let i = 0; i < periodicCount; i++) {
        const monthTarget = firstPaymentDate.getMonth() + (i * frequencyMonths);
        const instDate = new Date(firstPaymentDate.getFullYear(), monthTarget, paymentDay);
        
        // Handle month rollover (e.g. Jan 31 -> Feb 28 instead of Mar 3)
        if (instDate.getDate() !== paymentDay) {
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

    // --- 3. INSURANCE ---
    if (contract.قيمة_التأمين && contract.قيمة_التأمين > 0) {
        const end = parseDateOnly(contract.تاريخ_النهاية || startIso);
        installments.push(this.createInstallment({
          contractId,
          rank: rank++,
          date: end ? formatDateOnly(end) : startIso,
          amount: contract.قيمة_التأمين,
          type: 'تأمين',
          note: 'مبلغ التأمين المسترد',
        }));
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
