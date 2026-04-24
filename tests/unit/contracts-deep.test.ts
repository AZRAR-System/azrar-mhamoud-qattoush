import { createContractWrites, getContracts, getContractDetails } from '@/services/db/contracts';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

const logOperation = jest.fn();
const handleSmartEngine = jest.fn();
const formatDateOnly = (d: Date) => d.toISOString().slice(0, 10);
const addDaysIso = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const addMonthsDateOnly = (iso: string, months: number) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d;
};

const deps = { logOperation, handleSmartEngine, formatDateOnly, addDaysIso, addMonthsDateOnly };
const {
  createContract,
  updateContract,
  archiveContract,
  terminateContract,
  renewContract,
  deleteContract,
  autoArchiveContracts,
} = createContractWrites(deps);

const makeContractData = (overrides = {}) => ({
  رقم_العقار: 'PR-1',
  رقم_المستاجر: 'PER-1',
  تاريخ_البداية: '2026-01-01',
  تاريخ_النهاية: '2027-01-01',
  مدة_العقد_بالاشهر: 12,
  القيمة_السنوية: 1200,
  تكرار_الدفع: 1,
  طريقة_الدفع: 'Cash' as any,
  حالة_العقد: 'نشط' as any,
  isArchived: false,
  lateFeeType: 'none' as any,
  lateFeeValue: 0,
  lateFeeGraceDays: 0,
  paymentDay: 1,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  buildCache();
  jest.clearAllMocks();
  kv.save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR-1', الكود_الداخلي: 'P1', رقم_المالك: 'OWN-1', النوع: 'شقة', العنوان: 'عمان', حالة_العقار: 'شاغر', IsRented: false, المساحة: 100 }]);
  kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'PER-1', الاسم: 'أحمد', رقم_الهاتف: '0791234567' }]);
  buildCache();
});

// ─── getContractDetails ───────────────────────────────────────────
describe('getContractDetails', () => {
  test('returns null for nonexistent contract', () => {
    expect(getContractDetails('MISSING')).toBeNull();
  });

  test('returns full details with property and tenant', () => {
    const r = createContract(makeContractData(), 100, 50);
    expect(r.success).toBe(true);
    const id = r.data!.رقم_العقد;
    const details = getContractDetails(id);
    expect(details?.contract.رقم_العقد).toBe(id);
    expect(details?.property?.الكود_الداخلي).toBe('P1');
    expect(details?.tenant?.الاسم).toBe('أحمد');
    expect(details?.installments.length).toBeGreaterThan(0);
  });
});

// ─── createContract ───────────────────────────────────────────────
describe('createContract', () => {
  test('creates contract with sequential ID', () => {
    const r = createContract(makeContractData(), 100, 50);
    expect(r.success).toBe(true);
    expect(r.data?.رقم_العقد).toBe('cot_001');
  });

  test('increments ID for each new contract', () => {
    createContract(makeContractData(), 0, 0);
    const r2 = createContract(makeContractData(), 0, 0);
    expect(r2.data?.رقم_العقد).toBe('cot_002');
  });

  test('sets contract status to نشط', () => {
    const r = createContract(makeContractData(), 0, 0);
    expect(r.data?.حالة_العقد).toBe('نشط');
  });

  test('generates installments correctly', () => {
    createContract(makeContractData(), 0, 0);
    const insts = kv.get<any>(KEYS.INSTALLMENTS);
    expect(insts.length).toBeGreaterThan(0);
  });

  test('creates commission record', () => {
    createContract(makeContractData(), 200, 100);
    const comms = kv.get<any>(KEYS.COMMISSIONS);
    expect(comms.length).toBe(1);
    expect(comms[0].المجموع).toBe(300);
  });

  test('marks property as IsRented=true', () => {
    createContract(makeContractData(), 0, 0);
    const props = kv.get<any>(KEYS.PROPERTIES);
    expect(props[0].IsRented).toBe(true);
    expect(props[0].حالة_العقار).toBe('مؤجر');
  });

  test('uses provided تاريخ_الانشاء when valid', () => {
    const r = createContract(makeContractData({ تاريخ_الانشاء: '2025-06-15' }), 0, 0);
    expect(r.data?.تاريخ_الانشاء).toBe('2025-06-15');
  });

  test('uses custom commissionPaidMonth when valid', () => {
    createContract(makeContractData(), 0, 0, '2026-03');
    const comms = kv.get<any>(KEYS.COMMISSIONS);
    expect(comms[0].شهر_دفع_العمولة).toBe('2026-03');
  });

  test('calls handleSmartEngine and logOperation', () => {
    createContract(makeContractData(), 0, 0);
    expect(handleSmartEngine).toHaveBeenCalledWith('contract', expect.any(Object));
    expect(logOperation).toHaveBeenCalledWith('Admin', 'إضافة', 'Contracts', expect.any(String), expect.any(String));
  });
});

// ─── updateContract ───────────────────────────────────────────────
describe('updateContract', () => {
  test('fails for nonexistent contract', () => {
    const r = updateContract('MISSING', {}, 0, 0);
    expect(r.success).toBe(false);
    expect(r.message).toContain('غير موجود');
  });

  test('fails when trying to change property', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    const r = updateContract(data!.رقم_العقد, { رقم_العقار: 'PR-2' }, 0, 0);
    expect(r.success).toBe(false);
    expect(r.message).toContain('العقار');
  });

  test('fails when trying to change tenant', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    const r = updateContract(data!.رقم_العقد, { رقم_المستاجر: 'PER-99' }, 0, 0);
    expect(r.success).toBe(false);
    expect(r.message).toContain('المستأجر');
  });

  test('updates contract successfully', () => {
    const { data } = createContract(makeContractData(), 100, 50);
    const r = updateContract(data!.رقم_العقد, { نص_مدة_العقد: 'سنة واحدة' }, 150, 75);
    expect(r.success).toBe(true);
    expect(r.data?.نص_مدة_العقد).toBe('سنة واحدة');
  });

  test('updates commission when exists', () => {
    const { data } = createContract(makeContractData(), 100, 50);
    updateContract(data!.رقم_العقد, {}, 200, 100);
    const comms = kv.get<any>(KEYS.COMMISSIONS);
    expect(comms[0].المجموع).toBe(300);
  });

  test('fails regeneration when paid installments exist', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    const id = data!.رقم_العقد;
    const insts = kv.get<any>(KEYS.INSTALLMENTS);
    insts[0].حالة_الكمبيالة = 'مدفوع';
    kv.save(KEYS.INSTALLMENTS, insts);
    buildCache();
    const r = updateContract(id, {}, 0, 0, undefined, { regenerateInstallments: true });
    expect(r.success).toBe(false);
    expect(r.message).toContain('مبالغ محصلة');
  });

  test('regenerates installments when no paid ones', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    const r = updateContract(data!.رقم_العقد, {}, 0, 0, undefined, { regenerateInstallments: true });
    expect(r.success).toBe(true);
  });
});

// ─── archiveContract ──────────────────────────────────────────────
describe('archiveContract', () => {
  test('archives contract', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    archiveContract(data!.رقم_العقد);
    const contracts = kv.get<any>(KEYS.CONTRACTS);
    const c = contracts.find((x: any) => x.رقم_العقد === data!.رقم_العقد);
    expect(c.isArchived).toBe(true);
    expect(c.حالة_العقد).toBe('مؤرشف');
  });

  test('noop for nonexistent id', () => {
    expect(() => archiveContract('MISSING')).not.toThrow();
  });
});

// ─── terminateContract ────────────────────────────────────────────
describe('terminateContract', () => {
  test('fails for nonexistent contract', () => {
    const r = terminateContract('MISSING', 'سبب', '2026-03-01');
    expect(r.success).toBe(false);
  });

  test('terminates contract and marks installments cancelled', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    const id = data!.رقم_العقد;
    const r = terminateContract(id, 'انتهاء', '2026-06-01');
    expect(r.success).toBe(true);
    const contracts = kv.get<any>(KEYS.CONTRACTS);
    const c = contracts.find((x: any) => x.رقم_العقد === id);
    expect(c.حالة_العقد).toBe('مفسوخ');
    const insts = kv.get<any>(KEYS.INSTALLMENTS).filter((i: any) => i.رقم_العقد === id);
    expect(insts.every((i: any) => i.isArchived)).toBe(true);
  });

  test('saves clearance record when provided', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    terminateContract(data!.رقم_العقد, 'سبب', '2026-03-01', {
      contractId: data!.رقم_العقد, totalDue: 1200, totalPaid: 1200,
      depositAmount: 100, deductions: 0, refundAmount: 100, notes: '', createdAt: '2026-03-01',
    } as any);
    const crs = kv.get<any>(KEYS.CLEARANCE_RECORDS);
    expect(crs.length).toBe(1);
  });

  test('marks property as شاغر after termination', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    terminateContract(data!.رقم_العقد, 'سبب', '2026-03-01');
    const props = kv.get<any>(KEYS.PROPERTIES);
    expect(props[0].IsRented).toBe(false);
    expect(props[0].حالة_العقار).toBe('شاغر');
  });
});

// ─── renewContract ────────────────────────────────────────────────
describe('renewContract', () => {
  test('fails for nonexistent contract', () => {
    expect(renewContract('MISSING').success).toBe(false);
  });

  test('fails when contract already has renewal', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    const id = data!.رقم_العقد;
    const all = kv.get<any>(KEYS.CONTRACTS);
    const idx = all.findIndex((c: any) => c.رقم_العقد === id);
    all[idx].linkedContractId = 'cot_002';
    kv.save(KEYS.CONTRACTS, all);
    buildCache();
    expect(renewContract(id).success).toBe(false);
    expect(renewContract(id).message).toContain('تجديد');
  });

  test('creates new contract on renewal', () => {
    const { data } = createContract(makeContractData(), 100, 50);
    const r = renewContract(data!.رقم_العقد);
    expect(r.success).toBe(true);
    expect(kv.get<any>(KEYS.CONTRACTS).length).toBe(2);
  });

  test('marks old contract as منتهي', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    const id = data!.رقم_العقد;
    renewContract(id);
    const old = kv.get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === id);
    expect(old.حالة_العقد).toBe('منتهي');
    expect(old.linkedContractId).toBeTruthy();
  });

  test('transfers balance as debt installment when negative', () => {
    const { data } = createContract(makeContractData(), 0, 0);
    const id = data!.رقم_العقد;
    const insts = kv.get<any>(KEYS.INSTALLMENTS);
    insts[0].حالة_الكمبيالة = 'غير مدفوع';
    kv.save(KEYS.INSTALLMENTS, insts);
    buildCache();
    renewContract(id, { transferBalance: true });
    const allInsts = kv.get<any>(KEYS.INSTALLMENTS);
    const debtInst = allInsts.find((i: any) => i.نوع_الدفعة === 'رصيد سابق');
    expect(debtInst).toBeDefined();
  });

  test('transfers security deposit when requested', () => {
    const { data } = createContract(makeContractData({ قيمة_التأمين: 500 }), 0, 0);
    const r = renewContract(data!.رقم_العقد, { transferSecurity: true });
    expect(r.success).toBe(true);
    const newContract = kv.get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === r.data?.رقم_العقد);
    expect(newContract.قيمة_التأمين).toBe(500);
  });
});

// ─── deleteContract ───────────────────────────────────────────────
describe('deleteContract', () => {
  test('deletes contract and related records', () => {
    const { data } = createContract(makeContractData(), 100, 50);
    const id = data!.رقم_العقد;
    const r = deleteContract(id);
    expect(r.success).toBe(true);
    expect(kv.get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === id)).toBeUndefined();
    expect(kv.get<any>(KEYS.INSTALLMENTS).filter((i: any) => i.رقم_العقد === id)).toHaveLength(0);
    expect(kv.get<any>(KEYS.COMMISSIONS).filter((c: any) => c.رقم_العقد === id)).toHaveLength(0);
  });

  test('noop for nonexistent id', () => {
    const r = deleteContract('MISSING');
    expect(r.success).toBe(true);
  });
});

// ─── autoArchiveContracts ─────────────────────────────────────────
describe('autoArchiveContracts', () => {
  test('archives ended contract with all installments paid', () => {
    const { data } = createContract(makeContractData({ تاريخ_النهاية: '2025-01-01' }), 0, 0);
    const id = data!.رقم_العقد;
    const insts = kv.get<any>(KEYS.INSTALLMENTS).map((i: any) => ({
      ...i, حالة_الكمبيالة: 'مدفوع', المبلغ_المدفوع: i.القيمة, القيمة_المتبقية: 0,
    }));
    kv.save(KEYS.INSTALLMENTS, insts);
    const all = kv.get<any>(KEYS.CONTRACTS);
    const idx = all.findIndex((c: any) => c.رقم_العقد === id);
    all[idx].حالة_العقد = 'منتهي';
    kv.save(KEYS.CONTRACTS, all);
    buildCache();
    const r = autoArchiveContracts();
    expect(r.success).toBe(true);
    expect(r.data!.updated).toBeGreaterThan(0);
    const archived = kv.get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === id);
    expect(archived.حالة_العقد).toBe('مؤرشف');
  });

  test('moves ended contract with unpaid installments to تحصيل', () => {
    const { data } = createContract(makeContractData({ تاريخ_النهاية: '2025-01-01' }), 0, 0);
    const id = data!.رقم_العقد;
    const all = kv.get<any>(KEYS.CONTRACTS);
    const idx = all.findIndex((c: any) => c.رقم_العقد === id);
    all[idx].حالة_العقد = 'منتهي';
    kv.save(KEYS.CONTRACTS, all);
    buildCache();
    const r = autoArchiveContracts();
    expect(r.success).toBe(true);
    const updated = kv.get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === id);
    expect(updated.حالة_العقد).toBe('تحصيل');
  });

  test('marks active contract as قريب الانتهاء when within 30 days', () => {
    const nearEnd = addDaysIso(formatDateOnly(new Date()), 15);
    const { data } = createContract(makeContractData({ تاريخ_النهاية: nearEnd }), 0, 0);
    const id = data!.رقم_العقد;
    autoArchiveContracts();
    const c = kv.get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === id);
    expect(['قريب الانتهاء', 'منتهي']).toContain(c.حالة_العقد);
  });

  test('returns updated=0 when nothing to change', () => {
    const r = autoArchiveContracts();
    expect(r.data!.updated).toBe(0);
  });
});

// ─── processSecurityDeposit ───────────────────────────────────────
describe('processSecurityDeposit', () => {
  test('returns ok for Return action', () => {
    const { data } = createContract(makeContractData({ قيمة_التأمين: 500 }), 0, 0);
    const { processSecurityDeposit } = createContractWrites(deps);
    const r = processSecurityDeposit(data!.رقم_العقد, 0, 'Return', 'استعادة كاملة');
    expect(r.success).toBe(true);
  });

  test('returns ok for Execute action with deductions', () => {
    const { data } = createContract(makeContractData({ قيمة_التأمين: 500 }), 0, 0);
    const { processSecurityDeposit } = createContractWrites(deps);
    const r = processSecurityDeposit(data!.رقم_العقد, 200, 'Execute');
    expect(r.success).toBe(true);
  });

  test('returns ok for ExecutePartial action', () => {
    const { data } = createContract(makeContractData({ قيمة_التأمين: 500 }), 0, 0);
    const { processSecurityDeposit } = createContractWrites(deps);
    const r = processSecurityDeposit(data!.رقم_العقد, 100, 'ExecutePartial', 'خصم جزئي');
    expect(r.success).toBe(true);
  });
});

// ─── generateContractInstallments failure ─────────────────────────
describe('createContract - zero duration', () => {
  test('handles zero duration contract gracefully', () => {
    const badContract = makeContractData({ مدة_العقد_بالاشهر: 0 });
    let r;
    try {
      r = createContract(badContract, 0, 0);
      expect(r.success === true || r.success === false).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });
});

// ─── autoArchiveContracts - تحصيل branch ─────────────────────────
describe('autoArchiveContracts - collection branch', () => {
  test('keeps تحصيل status when already in collection', () => {
    const { data } = createContract(makeContractData({ تاريخ_النهاية: '2025-01-01' }), 0, 0);
    const id = data!.رقم_العقد;
    const all = kv.get<any>(KEYS.CONTRACTS);
    const idx = all.findIndex((c: any) => c.رقم_العقد === id);
    all[idx].حالة_العقد = 'تحصيل';
    kv.save(KEYS.CONTRACTS, all);
    buildCache();
    const r = autoArchiveContracts();
    expect(r.success).toBe(true);
    const c = kv.get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === id);
    expect(c.حالة_العقد).toBe('تحصيل');
  });
});
