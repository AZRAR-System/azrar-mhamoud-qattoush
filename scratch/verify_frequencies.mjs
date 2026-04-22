/**
 * Multi-Frequency Logic Verification
 */
import { ContractFinancialEngine } from '../src/services/db/ContractFinancialEngine.ts';

const test = (name, contract) => {
    console.log(`--- ${name} ---`);
    const schedule = ContractFinancialEngine.calculateSchedule(contract, 'TEST-ID');
    const total = schedule.reduce((sum, inst) => sum + inst.القيمة, 0);
    console.log(`Installments: ${schedule.length}`);
    schedule.forEach(inst => {
        console.log(`  ${inst.تاريخ_استحقاق} | ${inst.نوع_الدفعة.padEnd(10)} | ${inst.القيمة.toFixed(2)}`);
    });
    console.log(`TOTAL SUM: ${total.toFixed(2)}`);
    console.log('-----------------------------------\n');
};

console.log('RE-RUNNING MULTI-FREQUENCY TESTS\n');

// 1. Quarterly + Gap
test('Quarterly + Gap (300/mo)', {
    تاريخ_البداية: '2026-05-20',
    مدة_العقد_بالاشهر: 12,
    القيمة_السنوية: 3600, // 300 * 12
    تكرار_الدفع: 4,      // Quarterly
    يوم_الدفع: 1,
    احتساب_فرق_ايام: true
});

// 2. Quarterly - NO Gap
test('Quarterly - NO Gap (300/mo)', {
    تاريخ_البداية: '2026-05-20',
    مدة_العقد_بالاشهر: 12,
    القيمة_السنوية: 3600,
    تكرار_الدفع: 4,
    يوم_الدفع: 20, // To avoid gap or just disable
    احتساب_فرق_ايام: false
});

// 3. Semi-Annual + Gap
test('Semi-Annual + Gap (300/mo)', {
    تاريخ_البداية: '2026-05-20',
    مدة_العقد_بالاشهر: 12,
    القيمة_السنوية: 3600,
    تكرار_الدفع: 2,      // Semi-Annual
    يوم_الدفع: 1,
    احتساب_فرق_ايام: true
});

// 4. Annual + Gap
test('Annual + Gap (300/mo)', {
    تاريخ_البداية: '2026-05-20',
    مدة_العقد_بالاشهر: 12,
    القيمة_السنوية: 3600,
    تكرار_الدفع: 1,      // Annual
    يوم_الدفع: 1,
    احتساب_فرق_ايام: true
});
