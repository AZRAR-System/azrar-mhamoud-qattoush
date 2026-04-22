// Verification script for AZRAR financial logic

// Mock utility functions to match the codebase logic exactly
const roundCurrency = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const parseDateOnly = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const formatDateOnly = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const daysBetweenDateOnly = (start, end) => {
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.floor((e - s) / (1000 * 60 * 60 * 24));
};

// Replicated Logic from installments.ts
const calcDayDiffValue = (startIso, annualValue) => {
    const start = parseDateOnly(startIso);
    if (!start) return 0;
    const day = start.getDate();
    if (day <= 1) return 0;
    const dim = daysInMonth(start.getFullYear(), start.getMonth());
    const remainingDays = dim - day + 1;
    const monthRent = annualValue / 12;
    // (monthRent * remainingDays) / dim
    return roundCurrency((monthRent * remainingDays) / dim);
};

const calculateAutoLateFees = (contract, installments, todayIso) => {
    if (contract.lateFeeType === 'none' || !contract.lateFeeType) return [];
    const today = parseDateOnly(todayIso);
    const grace = Number(contract.lateFeeGraceDays || 0);
    const type = contract.lateFeeType;
    const value = Number(contract.lateFeeValue || 0);
    const max = contract.lateFeeMaxAmount ? Number(contract.lateFeeMaxAmount) : Infinity;

    const results = [];
    for (const inst of installments) {
        // Simplified: assume 100% remaining for testing
        const remaining = inst.value; 
        if (remaining <= 0) continue;

        const due = parseDateOnly(inst.date);
        if (!due) continue;

        const daysLate = daysBetweenDateOnly(due, today);
        if (daysLate <= grace) continue;

        let fee = 0;
        if (type === 'fixed') {
            fee = value;
        } else if (type === 'percentage') {
            fee = roundCurrency((inst.value * value) / 100);
        } else if (type === 'daily') {
            fee = roundCurrency(value * (daysLate - grace));
        }

        const cappedFee = Math.min(fee, max);
        if (cappedFee > 0) {
            results.push({ installmentId: inst.id, suggestedFee: cappedFee, daysLate });
        }
    }
    return results;
};

// --- SCENARIO 1: May 2026 ---
console.log('--- Scenario 1: May 2026 ---');
const s1_start = '2026-05-20';
const s1_annual = 3600; // 300 per month
const s1_res = calcDayDiffValue(s1_start, s1_annual);
console.log(`Start: ${s1_start}, Monthly: 300`);
console.log(`Result: ${s1_res} JOD`);
console.log(`Expected: 116.13 JOD`);
console.log(s1_res === 116.13 ? '✅ PASS' : '❌ FAIL');

// --- SCENARIO 2: Feb 2027 ---
console.log('\n--- Scenario 2: Feb 2027 ---');
const s2_start = '2027-02-15';
const s2_annual = 2400; // 200 per month
const s2_res = calcDayDiffValue(s2_start, s2_annual);
console.log(`Start: ${s2_start}, Monthly: 200`);
console.log(`Result: ${s2_res} JOD`);
console.log(`Expected: 100.00 JOD`);
console.log(s2_res === 100.00 ? '✅ PASS' : '❌ FAIL');

// --- SCENARIO 3: Late Fee ---
console.log('\n--- Scenario 3: Late Fee ---');
const s3_contract = {
    lateFeeType: 'daily',
    lateFeeValue: 0.5,
    lateFeeGraceDays: 3
};
const s3_insts = [{ id: 'INST-1', date: '2026-01-01', value: 300 }];
const s3_today = '2026-01-11'; // 10 days late
const s3_res = calculateAutoLateFees(s3_contract, s3_insts, s3_today);
console.log(`Installment: 300, Due: 2026-01-01, Today: 2026-01-11 (10 days late)`);
console.log(`Grace: 3 days, Fee: 0.5/day`);
console.log(`Result: ${s3_res[0]?.suggestedFee} JOD`);
console.log(`Expected: 3.5 JOD`);
console.log(s3_res[0]?.suggestedFee === 3.5 ? '✅ PASS' : '❌ FAIL');

// --- SCENARIO 4: Annual Balance ---
console.log('\n--- Scenario 4: Annual Balance ---');
// Replication of generateContractInstallmentsInternal simplified for balance
const testAnnualBalance = (startIso, annualValue, months) => {
    const totalRent = roundCurrency((annualValue / 12) * months);
    const dayDiffValue = calcDayDiffValue(startIso, annualValue);
    const dayDiffActive = dayDiffValue > 0;
    
    const remainingMonths = Math.max(0, months - (dayDiffActive ? 1 : 0));
    const remainingRentTotal = Math.max(0, totalRent - dayDiffValue);
    
    const count = remainingMonths; // Assuming monthly
    const base = roundCurrency(remainingRentTotal / count);
    const remainder = roundCurrency(remainingRentTotal - (base * count));
    
    let sum = dayDiffValue;
    for(let i=0; i<count; i++) {
        sum += (base + (i === count - 1 ? remainder : 0));
    }
    return roundCurrency(sum);
};

const s4_res = testAnnualBalance('2026-03-15', 3600, 12);
console.log(`Start: 2026-03-15, Annual: 3600, Duration: 12 months`);
console.log(`Result Sum: ${s4_res} JOD`);
console.log(`Expected Sum: 3600.00 JOD`);
console.log(s4_res === 3600 ? '✅ PASS' : '❌ FAIL');
