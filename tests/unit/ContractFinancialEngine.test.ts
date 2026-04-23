import { ContractFinancialEngine } from '../../src/services/db/ContractFinancialEngine';
import { roundCurrency } from '../../src/utils/format';
import { parseDateOnly, formatDateOnly } from '../../src/utils/dateOnly';

describe('ContractFinancialEngine', () => {
  describe('calculateDayDiffValue', () => {
    const annualValue = 12000; // 1000 per month

    test('returns 0 when start day equals payment day', () => {
      const result = ContractFinancialEngine.calculateDayDiffValue('2026-05-01', annualValue, 1);
      expect(result).toBe(0);
    });

    test('calculates gap for May (31 days)', () => {
      // Monthly rent = 1000. Days in May = 31.
      // Start May 15, Payment Day 1.
      // gapDays = 31 - 15 + 1 = 17 days.
      // (1000 / 31) * 17 = 548.387... -> 548.39
      const result = ContractFinancialEngine.calculateDayDiffValue('2026-05-15', annualValue, 1);
      const expected = roundCurrency((1000 / 31) * 17);
      expect(result).toBe(expected);
      expect(result).toBe(548.39);
    });

    test('calculates gap for February (28 days) in non-leap year', () => {
      // Monthly rent = 1000. Days in Feb 2026 = 28.
      // Start Feb 15, Payment Day 1.
      // gapDays = 28 - 15 + 1 = 14 days.
      // (1000 / 28) * 14 = 500
      const result = ContractFinancialEngine.calculateDayDiffValue('2026-02-15', annualValue, 1);
      expect(result).toBe(500);
    });

    test('calculates gap for February (29 days) in leap year', () => {
      // Monthly rent = 1000. Days in Feb 2028 = 29.
      // Start Feb 15, Payment Day 1.
      // gapDays = 29 - 15 + 1 = 15 days.
      // (1000 / 29) * 15 = 517.241... -> 517.24
      const result = ContractFinancialEngine.calculateDayDiffValue('2028-02-15', annualValue, 1);
      const expected = roundCurrency((1000 / 29) * 15);
      expect(result).toBe(expected);
      expect(result).toBe(517.24);
    });

    test('calculates gap when payment day is later in same month', () => {
      // Start May 5, Payment Day 10.
      // gapDays = 10 - 5 = 5 days.
      // (1000 / 31) * 5 = 161.290... -> 161.29
      const result = ContractFinancialEngine.calculateDayDiffValue('2026-05-05', annualValue, 10);
      expect(result).toBe(161.29);
    });

    test('calculates gap when payment day is earlier but cDay > pDay', () => {
      // Start May 10, Payment Day 5.
      // gapDays = (31 - 10) + 5 = 26 days.
      // (1000 / 31) * 26 = 838.709... -> 838.71
      const result = ContractFinancialEngine.calculateDayDiffValue('2026-05-10', annualValue, 5);
      expect(result).toBe(838.71);
    });
  });

  describe('calculateSchedule', () => {
    const contractBase = {
      رقم_العقد: 'COT-TEST',
      تاريخ_البداية: '2026-05-15',
      القيمة_السنوية: 12000,
      مدة_العقد_بالاشهر: 12,
      تكرار_الدفع: 12, // Monthly
      يوم_الدفع: 1,
    };

    test('generates schedule without day difference when disabled', () => {
      const contract = { ...contractBase, احتساب_فرق_ايام: false };
      const schedule = ContractFinancialEngine.calculateSchedule(contract, 'COT-TEST');
      
      // Should have 12 installments starting from 2026-06-01 (next payment day)
      expect(schedule.length).toBe(12);
      expect(schedule[0].تاريخ_استحقاق).toBe('2026-06-01');
      expect(schedule[0].القيمة).toBe(1000);
      expect(schedule[0].نوع_الدفعة).toBe('دورية');
    });

    test('generates schedule with auto day difference when enabled', () => {
      const contract = { ...contractBase, احتساب_فرق_ايام: true };
      const schedule = ContractFinancialEngine.calculateSchedule(contract, 'COT-TEST');
      
      // Should have 1 (gap) + 12 (periodic) = 13 installments
      expect(schedule.length).toBe(13);
      expect(schedule[0].نوع_الدفعة).toBe('فرق أيام');
      expect(schedule[0].القيمة).toBe(548.39);
      expect(schedule[1].تاريخ_استحقاق).toBe('2026-06-01');
    });

    test('uses manual day difference amount if provided', () => {
      const contract = { ...contractBase, احتساب_فرق_ايام: true, مبلغ_الفرقية: 600 };
      const schedule = ContractFinancialEngine.calculateSchedule(contract, 'COT-TEST');
      
      expect(schedule[0].نوع_الدفعة).toBe('فرق أيام');
      expect(schedule[0].القيمة).toBe(600);
    });

    test('handles quarterly distribution (تكرار_الدفع = 4)', () => {
      const contract = { ...contractBase, تكرار_الدفع: 4, احتساب_فرق_ايام: false };
      const schedule = ContractFinancialEngine.calculateSchedule(contract, 'COT-TEST');
      
      // 12 months / 4 payments per year = every 3 months.
      // 12 months total = 4 installments.
      expect(schedule.length).toBe(4);
      expect(schedule[0].القيمة).toBe(3000);
      expect(schedule[0].تاريخ_استحقاق).toBe('2026-06-01');
      expect(schedule[1].تاريخ_استحقاق).toBe('2026-09-01');
    });

    test('balances rounding difference in the last installment', () => {
      // 1000 / 3 = 333.333... -> 333.33
      // 333.33 * 3 = 999.99. Diff = 0.01.
      const contract = { 
        ...contractBase, 
        القيمة_السنوية: 1000, 
        مدة_العقد_بالاشهر: 12, 
        تكرار_الدفع: 3, // Every 4 months
        احتساب_فرق_ايام: false 
      };
      const schedule = ContractFinancialEngine.calculateSchedule(contract, 'COT-TEST');
      
      const total = schedule.reduce((sum, i) => sum + i.القيمة, 0);
      expect(total).toBe(1000);
      expect(schedule[schedule.length - 1].القيمة).toBe(333.34); // 333.33 + 0.01
    });

    test('handles down payment with splitting', () => {
      const contract = { 
        ...contractBase, 
        يوجد_دفعة_اولى: true, 
        قيمة_الدفعة_الاولى: 2000,
        تقسيط_الدفعة_الأولى: true,
        عدد_أقساط_الدفعة_الأولى: 2,
        احتساب_فرق_ايام: false
      };
      const schedule = ContractFinancialEngine.calculateSchedule(contract, 'COT-TEST');
      
      // 2 DP installments + 12 periodic = 14
      expect(schedule.length).toBe(14);
      expect(schedule[0].نوع_الدفعة).toBe('دفعة أولى');
      expect(schedule[0].القيمة).toBe(1000);
      expect(schedule[1].نوع_الدفعة).toBe('دفعة أولى');
      expect(schedule[1].القيمة).toBe(1000);
      expect(schedule[2].نوع_الدفعة).toBe('دورية');
    });

    test('handles down payment by months (عدد_أشهر_الدفعة_الأولى)', () => {
      const contract = { 
        ...contractBase, 
        يوجد_دفعة_اولى: true, 
        عدد_أشهر_الدفعة_الأولى: 2, // 2000
        احتساب_فرق_ايام: false
      };
      const schedule = ContractFinancialEngine.calculateSchedule(contract, 'COT-TEST');
      
      // DP covers 2 months. Total duration 12 months.
      // 1 DP + 10 periodic = 11
      expect(schedule.length).toBe(11);
      expect(schedule[0].نوع_الدفعة).toBe('دفعة أولى');
      expect(schedule[0].القيمة).toBe(2000);
      expect(schedule[1].نوع_الدفعة).toBe('دورية');
      // Periodic starts after 2 months offset from 2026-06-01 -> 2026-08-01
      expect(schedule[1].تاريخ_استحقاق).toBe('2026-08-01');
    });
  });
});
