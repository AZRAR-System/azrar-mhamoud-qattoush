
// Mocking roundCurrency and simple date helpers for the test script
function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

function parseDateOnly(iso) {
  if (!iso) return null;
  const parts = iso.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateOnly(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** 
 * Re-implementing the engine logic here for isolated Node testing 
 */
function calculateSchedule(contract) {
  const installments = [];
  const startIso = contract.startDate;
  const annualValue = contract.annual;
  const durationMonths = contract.duration;
  
  const monthlyRent = annualValue / 12;
  const totalContractValue = roundCurrency(monthlyRent * durationMonths);

  const start = parseDateOnly(startIso);
  let currentSum = 0;

  // 1. Start Gap
  if (contract.calcDayDiff && start.getDate() > 1) {
    const dim = daysInMonth(start);
    const day = start.getDate();
    const remainingDays = dim - day + 1;
    const value = roundCurrency((monthlyRent / dim) * remainingDays);
    
    installments.push({ type: 'فرق أيام', amount: value, date: startIso });
    currentSum = roundCurrency(currentSum + value);
  }

  // 2. Full Months
  let currentDate = start;
  if (contract.calcDayDiff && start.getDate() > 1) {
    currentDate = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  } else {
    currentDate = new Date(start.getFullYear(), start.getMonth(), 1);
  }

  const periodicToGenerate = (contract.calcDayDiff && start.getDate() > 1) ? 11 : 12;

  for (let i = 0; i < periodicToGenerate; i++) {
    const instDate = formatDateOnly(currentDate);
    const value = roundCurrency(monthlyRent);
    
    installments.push({ type: 'دورية', amount: value, date: instDate });
    currentSum = roundCurrency(currentSum + value);
    
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  // 3. End Gap
  const endGapValue = roundCurrency(totalContractValue - currentSum);
  if (endGapValue > 0) {
    installments.push({ type: 'end_gap', amount: endGapValue, date: formatDateOnly(currentDate) });
    currentSum = roundCurrency(currentSum + endGapValue);
  }

  // Final Balance check
  const finalDiff = roundCurrency(totalContractValue - currentSum);
  if (Math.abs(finalDiff) > 0) {
      installments[installments.length-1].amount = roundCurrency(installments[installments.length-1].amount + finalDiff);
  }

  return installments;
}

const scenarios = [
  { 
    name: "بداية منتصف شهر",
    startDate: '2026-03-15', annual: 3600, duration: 12, calcDayDiff: true 
  },
  { 
    name: "بداية أول الشهر",
    startDate: '2026-06-01', annual: 3600, duration: 12, calcDayDiff: true 
  },
  { 
    name: "بداية آخر يوم",
    startDate: '2027-02-28', annual: 2400, duration: 12, calcDayDiff: true 
  },
  { 
    name: "شهر فبراير كبيسة",
    startDate: '2028-02-15', annual: 4800, duration: 12, calcDayDiff: true 
  },
  { 
    name: "إيجار بكسور",
    startDate: '2026-05-20', annual: 4000, duration: 12, calcDayDiff: true 
  }
];

console.log("--- عصف ذهني مالي: اختبار المحرك الجديد ---\n");

scenarios.forEach(s => {
  const result = calculateSchedule(s);
  const total = result.reduce((acc, curr) => acc + curr.amount, 0);
  console.log(`[سيناريو]: ${s.name}`);
  console.log(`  البداية: ${s.startDate}, السنوي: ${s.annual}`);
  result.forEach((inst, i) => {
    console.log(`  ${i+1}. ${inst.type}: ${inst.amount} JOD (${inst.date})`);
  });
  console.log(`  المجموع النهائي: ${roundCurrency(total)} JOD (المتوقع: ${s.annual})`);
  console.log("------------------------------------------");
});
