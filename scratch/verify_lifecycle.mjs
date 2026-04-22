// Verification script for AZRAR Lifecycle Logic

const roundCurrency = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Replicated Logic from autoArchiveContracts in contracts.ts
const simulateAutoArchive = (contracts, installments, todayStr) => {
    let updated = 0;
    const results = contracts.map(c => {
        const status = c.حالة_العقد;
        const isEnded = status === 'منتهي' || status === 'Expired';
        const isTerminated = status === 'مفسوخ' || status === 'Terminated';
        
        // Simulating the logic:
        if (isEnded || isTerminated || status === 'تحصيل') {
            const cInsts = installments.filter(i => i.رقم_العقد === c.رقم_العقد);
            const totalDue = cInsts.reduce((sum, i) => sum + i.القيمة, 0);
            const totalPaid = cInsts.reduce((sum, i) => {
                // Simplified paid check for simulation
                return sum + (i.حالة === 'Paid' ? i.القيمة : (i.paid || 0));
            }, 0);
            
            const isClean = roundCurrency(totalPaid) >= roundCurrency(totalDue);
            
            if (isClean && !c.isArchived) {
                updated++;
                return { ...c, isArchived: true, حالة_العقد: 'مؤرشف' };
            }
            if (!isClean && status !== 'تحصيل') {
                updated++;
                return { ...c, حالة_العقد: 'تحصيل' };
            }
        }
        return c;
    });
    return { results, updated };
};

// --- Test Cases ---

console.log('--- Lifecycle Scenario A: Clean Archiving ---');
const contractsA = [{ رقم_العقد: 'C-001', حالة_العقد: 'منتهي', isArchived: false }];
const instsA = [{ رقم_العقد: 'C-001', القيمة: 1000, حالة: 'Paid' }];
const resA = simulateAutoArchive(contractsA, instsA, '2026-01-01');
console.log('Status before:', contractsA[0].حالة_العقد);
console.log('Status after:', resA.results[0].حالة_العقد);
console.log('Is Archived:', resA.results[0].isArchived);
console.log(resA.results[0].حالة_العقد === 'مؤرشف' ? '✅ PASS' : '❌ FAIL');

console.log('\n--- Lifecycle Scenario B: Collection Transition ---');
const contractsB = [{ رقم_العقد: 'C-002', حالة_العقد: 'منتهي', isArchived: false }];
const instsB = [{ رقم_العقد: 'C-002', القيمة: 1000, paid: 800, حالة: 'Partial' }];
const resB = simulateAutoArchive(contractsB, instsB, '2026-01-01');
console.log('Status before:', contractsB[0].حالة_العقد);
console.log('Status after:', resB.results[0].حالة_العقد);
console.log('Is Archived:', resB.results[0].isArchived);
console.log(resB.results[0].حالة_العقد === 'تحصيل' ? '✅ PASS' : '❌ FAIL');

console.log('\n--- Lifecycle Scenario C: Terminated Settlement ---');
const contractsC = [{ رقم_العقد: 'C-003', حالة_العقد: 'مفسوخ', isArchived: false }];
const instsC = [{ رقم_العقد: 'C-003', القيمة: 500, حالة: 'Paid' }];
const resC = simulateAutoArchive(contractsC, instsC, '2026-01-01');
console.log('Status before:', contractsC[0].حالة_العقد);
console.log('Status after:', resC.results[0].حالة_العقد);
console.log(resC.results[0].حالة_العقد === 'مؤرشف' ? '✅ PASS' : '❌ FAIL');
