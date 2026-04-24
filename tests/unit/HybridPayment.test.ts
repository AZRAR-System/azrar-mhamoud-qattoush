import { ContractFinancialEngine } from '../../src/services/db/ContractFinancialEngine';
import { describe, it, expect } from '@jest/globals';

describe('Hybrid Payment Logic', () => {
    it('should change frequency mid-contract (e.g., Monthly -> Quarterly after 6 months)', () => {
        const contract = {
            تاريخ_البداية: '2026-01-01',
            مدة_العقد_بالاشهر: 12,
            القيمة_السنوية: 1200,
            تكرار_الدفع: 12, // Monthly (1 payment/month)
            تكرار_الدفع_المرحلة_الثانية: 4, // Quarterly (1 payment/3 months)
            بداية_المرحلة_الثانية_من_شهر: 7, // Starts from month 7
            يوم_الدفع: 1,
            احتساب_فرق_ايام: false,
        };

        const schedule = ContractFinancialEngine.calculateSchedule(contract as any, 'hybrid-test');

        // Total months: 12
        // Months 1-6: Monthly (6 installments)
        // Month 7: Starts Phase 2 (Quarterly)
        // Installment 7 (Month 7) covers months 7, 8, 9
        // Installment 8 (Month 10) covers months 10, 11, 12

        const periodic = schedule.filter(s => s.نوع_الدفعة === 'دورية');
        
        // Check ranks and dates
        expect(periodic[0].تاريخ_استحقاق).toBe('2026-01-01');
        expect(periodic[5].تاريخ_استحقاق).toBe('2026-06-01'); // 6th month
        
        // 7th installment should be the start of phase 2
        expect(periodic[6].تاريخ_استحقاق).toBe('2026-07-01');
        expect(periodic[6].القيمة).toBe(300); // 3 months * 100/mo
        
        // 8th installment should be 3 months later
        expect(periodic[7].تاريخ_استحقاق).toBe('2026-10-01');
        expect(periodic[7].القيمة).toBe(300);

        expect(periodic.length).toBe(8); // 6 (monthly) + 2 (quarterly)
    });

    it('should include Insurance installment when value is provided', () => {
        const contract = {
            تاريخ_البداية: '2026-01-01',
            القيمة_السنوية: 1200,
            مدة_العقد_بالاشهر: 12,
            تكرار_الدفع: 12,
            يوم_الدفع: 1,
            طريقة_الدفع: 'Prepaid' as any,
            قيمة_التأمين: 100
        };
        const schedule = ContractFinancialEngine.calculateSchedule(contract as any, 'C1');
        const insurance = schedule.find(i => i.نوع_الدفعة === 'تأمين');
        expect(insurance).toBeDefined();
        expect(insurance?.القيمة).toBe(100);
        // Total rent should still be 1200
        const totalRent = schedule.filter(i => i.نوع_الدفعة !== 'تأمين').reduce((s, i) => s + i.القيمة, 0);
        expect(totalRent).toBe(1200);
    });

    it('should handle Down Payment covering upfront months then Monthly', () => {
        const contract = {
            تاريخ_البداية: '2026-01-01',
            مدة_العقد_بالاشهر: 12,
            القيمة_السنوية: 1200,
            تكرار_الدفع: 12,
            يوجد_دفعة_اولى: true,
            عدد_أشهر_الدفعة_الأولى: 3, // Covers first 3 months
            يوم_الدفع: 1,
        };

        const schedule = ContractFinancialEngine.calculateSchedule(contract as any, 'upfront-test');
        
        const dp = schedule.filter(s => s.نوع_الدفعة === 'دفعة أولى');
        const periodic = schedule.filter(s => s.نوع_الدفعة === 'دورية');

        expect(dp[0].القيمة).toBe(300);
        expect(dp[0].تاريخ_استحقاق).toBe('2026-01-01');

        // Periodic should start from month 4 (April)
        expect(periodic[0].تاريخ_استحقاق).toBe('2026-04-01');
        expect(periodic.length).toBe(9); // 12 - 3 = 9
    });
});
