import { ContractFinancialEngine } from '../../src/services/db/ContractFinancialEngine';

describe('ContractFinancialEngine - Real Logic Tests', () => {
  
  describe('calculateDayDiffValue (Gaps)', () => {
    // 15 scenarios - calculated based on: roundCurrency((monthlyRent / dim) * gapDays)
    // Monthly Rent = 3600 / 12 = 300
    const scenarios = [
      { start: '2026-01-20', rent: 3600, expected: 116.13, desc: 'Jan (31 days) - 12 days gap' },
      { start: '2026-02-15', rent: 3600, expected: 150.00, desc: 'Feb (28 days) - 14 days gap' },
      { start: '2024-02-15', rent: 3600, expected: 155.17, desc: 'Feb Leap (29 days) - 15 days gap' },
      { start: '2026-03-25', rent: 3600, expected: 67.74, desc: 'Mar (31 days) - 7 days gap' },
      { start: '2026-04-10', rent: 3600, expected: 210.00, desc: 'Apr (30 days) - 21 days gap' },
      { start: '2026-05-20', rent: 3600, expected: 116.13, desc: 'May (31 days) - 12 days gap' },
      { start: '2026-06-05', rent: 3600, expected: 260.00, desc: 'Jun (30 days) - 26 days gap' },
      { start: '2026-07-28', rent: 3600, expected: 38.71, desc: 'Jul (31 days) - 4 days gap' },
      { start: '2026-08-12', rent: 3600, expected: 193.55, desc: 'Aug (31 days) - 20 days gap' },
      { start: '2026-09-02', rent: 3600, expected: 290.00, desc: 'Sep (30 days) - 29 days gap' },
      { start: '2026-10-15', rent: 3600, expected: 164.52, desc: 'Oct (31 days) - 17 days gap' },
      { start: '2026-11-22', rent: 3600, expected: 90.00, desc: 'Nov (30 days) - 9 days gap' },
      { start: '2026-12-01', rent: 3600, expected: 0, desc: 'Dec 1st (No gap)' },
      { start: '2026-01-31', rent: 3600, expected: 9.68, desc: 'Jan 31st - 1 day gap' },
      { start: '2026-02-28', rent: 3600, expected: 10.71, desc: 'Feb 28th - 1 day gap' }
    ];

    scenarios.forEach(({ start, rent, expected, desc }) => {
      test(desc, () => {
        const result = ContractFinancialEngine.calculateDayDiffValue(start, rent, 1);
        expect(result).toBe(expected);
      });
    });
  });

  describe('calculateSchedule (Frequencies & Balancing)', () => {
    test('Monthly with Gap and Rounding Balancing', () => {
      const contract = {
        رقم_العقد: 'COT-1',
        تاريخ_البداية: '2026-05-20',
        القيمة_السنوية: 3333.33,
        مدة_العقد_بالاشهر: 12,
        تكرار_الدفع: 12, // monthly
        يوم_الدفع: 1,
        احتساب_فرق_ايام: true
      };

      const result = ContractFinancialEngine.calculateSchedule(contract as any, 'COT-1');

      // DayDiff: 107.53
      const dayDiff = result.find(i => i.نوع_الدفعة === 'فرق أيام');
      expect(dayDiff?.القيمة).toBe(107.53);

      const periodic = result.filter(i => i.نوع_الدفعة === 'دورية');
      expect(periodic).toHaveLength(12);
      expect(periodic[0].القيمة).toBe(277.78);
      
      const totalSum = result.reduce((sum, inst) => sum + inst.القيمة, 0);
      expect(totalSum).toBeCloseTo(3333.33 + 107.53, 2);
      
      // Last installment should have the balancing diff
      expect(periodic[11].القيمة).toBe(277.75);
    });

    test('Quarterly with Gap', () => {
      const contract = {
        رقم_العقد: 'COT-2',
        تاريخ_البداية: '2026-01-15',
        القيمة_السنوية: 12000,
        مدة_العقد_بالاشهر: 12,
        تكرار_الدفع: 4, // quarterly
        يوم_الدفع: 1,
        احتساب_فرق_ايام: true
      };

      const result = ContractFinancialEngine.calculateSchedule(contract as any, 'COT-2');
      const dayDiff = result.find(i => i.نوع_الدفعة === 'فرق أيام');
      expect(dayDiff?.القيمة).toBe(548.39);
      
      const periodic = result.filter(i => i.نوع_الدفعة === 'دورية');
      expect(periodic).toHaveLength(4);
      expect(periodic[0].تاريخ_استحقاق).toBe('2026-02-01');
    });
  });

  describe('Down Payments', () => {
    test('Down Payment Split into 3 installments', () => {
      const contract = {
        رقم_العقد: 'COT-3',
        تاريخ_البداية: '2026-01-01',
        القيمة_السنوية: 12000,
        مدة_العقد_بالاشهر: 12,
        تكرار_الدفع: 12,
        يوم_الدفع: 1,
        يوجد_دفعة_اولى: true,
        قيمة_الدفعة_الاولى: 3000,
        تقسيط_الدفعة_الأولى: true,
        عدد_أقساط_الدفعة_الأولى: 3
      };

      const result = ContractFinancialEngine.calculateSchedule(contract as any, 'COT-3');
      const dp = result.filter(i => i.نوع_الدفعة === 'دفعة أولى');
      expect(dp).toHaveLength(3);
      expect(dp[0].القيمة).toBe(1000);
      expect(dp[1].تاريخ_استحقاق).toBe('2026-02-01');
    });
  });
});
