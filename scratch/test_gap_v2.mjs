
import { ContractFinancialEngine } from '../src/services/db/ContractFinancialEngine.ts';

const annual = 3600; // 300 per month
const start = '2026-05-20'; // dim = 31

console.log(`Testing with start=${start}, annual=${annual}\n`);

[1, 15, 20, 25].forEach(payDay => {
    const val = ContractFinancialEngine.calculateDayDiffValue(start, annual, payDay);
    console.log(`PaymentDay=${payDay} | GapValue=${val}`);
    
    if (payDay === 1) {
        // Expected: (300/31) * 12 = 116.13
        console.log(`  Expected 116.13, Got ${val}`);
    }
});

console.log('\n--- SCHEDULE TEST for 2026-05-20, Day 1 ---');
const schedule = ContractFinancialEngine.calculateSchedule({
    تاريخ_البداية: '2026-05-20',
    القيمة_السنوية: 3600,
    يوم_الدفع: 1,
    احتساب_فرق_ايام: true,
    تكرار_الدفع: 12
}, 'test');

schedule.forEach(inst => {
    console.log(`  Inst: ${inst.تاريخ_استحقاق} | ${inst.نوع_الدفعة.padEnd(8)} | ${inst.القيمة}`);
});
