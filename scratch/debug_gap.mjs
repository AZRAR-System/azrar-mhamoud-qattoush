
import { ContractFinancialEngine } from '../src/services/db/ContractFinancialEngine.ts';

const mockContract = {
  تاريخ_البداية: '2026-05-20',
  مدة_العقد_بالاشهر: 12,
  القيمة_السنوية: 3000,
  يوم_الدفع: 1,
  تكرار_الدفع: 12,
  احتساب_فرق_ايام: true,
  مبلغ_الفرقية: undefined
};

console.log('--- AUTO CALCULATION CHECK ---');
const autoVal = ContractFinancialEngine.calculateDayDiffValue(
  mockContract.تاريخ_البداية,
  mockContract.القيمة_السنوية,
  mockContract.يوم_الدفع
);
console.log('calculateDayDiffValue Result:', autoVal);

console.log('\n--- SCHEDULE GENERATION CHECK ---');
const schedule = ContractFinancialEngine.calculateSchedule(mockContract, 'test-id');
console.log('Schedule Length:', schedule.length);
schedule.slice(0, 3).forEach(inst => {
  console.log(`  Row: ${inst.تاريخ_استحقاق} | ${inst.نوع_الدفعة} | ${inst.القيمة}`);
});

console.log('\n--- EDGE CASE: paymentDay as String ---');
const stringVal = ContractFinancialEngine.calculateDayDiffValue(
  mockContract.تاريخ_البداية,
  mockContract.القيمة_السنوية,
  '1' as any
);
console.log('Result with string "1":', stringVal);
