import {
  getInstallmentPaidAndRemaining,
  calculateAutoLateFees,
  getInstallmentPaymentSummary,
  createInstallmentPaymentHandlers,
} from '@/services/db/installments';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

const logOperation = jest.fn();
const markAlertsReadByPrefix = jest.fn();
const updateTenantRating = jest.fn();
const deps = { logOperation, markAlertsReadByPrefix, updateTenantRating };
const { markInstallmentPaid, setInstallmentLateFee, reversePayment } =
  createInstallmentPaymentHandlers(deps);

const makeInst = (id: string, overrides: Record<string, unknown> = {}) => ({
  رقم_الكمبيالة: id,
  رقم_العقد: 'C-1',
  القيمة: 500,
  المبلغ_المدفوع: 0,
  القيمة_المتبقية: 500,
  تاريخ_استحقاق: '2026-01-01',
  حالة_الكمبيالة: 'غير مدفوع',
  نوع_الكمبيالة: 'إيجار',
  نوع_الدفعة: 'دورية',
  ترتيب_الكمبيالة: 1,
  ...overrides,
} as any);

const makeContract = (overrides: Record<string, unknown> = {}) => ({
  رقم_العقد: 'C-1',
  رقم_العقار: 'PR-1',
  رقم_المستاجر: 'PER-1',
  تاريخ_البداية: '2026-01-01',
  تاريخ_النهاية: '2027-01-01',
  مدة_العقد_بالاشهر: 12,
  القيمة_السنوية: 6000,
  تكرار_الدفع: 12,
  طريقة_الدفع: 'Cash',
  حالة_العقد: 'نشط',
  isArchived: false,
  lateFeeType: 'none',
  lateFeeValue: 0,
  lateFeeGraceDays: 0,
  ...overrides,
} as any);

beforeEach(() => {
  localStorage.clear();
  buildCache();
  jest.clearAllMocks();
});

describe('getInstallmentPaidAndRemaining', () => {
  test('paid status returns full amount', () => {
    const inst = makeInst('I-1', { حالة_الكمبيالة: 'مدفوع', القيمة: 500 });
    const r = getInstallmentPaidAndRemaining(inst);
    expect(r.remaining).toBe(0);
    expect(r.paid).toBe(500);
  });

  test('uses القيمة_المتبقية when finite number', () => {
    const inst = makeInst('I-1', { القيمة: 500, القيمة_المتبقية: 200 });
    const r = getInstallmentPaidAndRemaining(inst);
    expect(r.remaining).toBe(200);
    expect(r.paid).toBe(300);
  });

  test('uses payment history when no القيمة_المتبقية', () => {
    const inst = makeInst('I-1', {
      القيمة: 500,
      القيمة_المتبقية: undefined,
      سجل_الدفعات: [{ المبلغ: 200, التاريخ: '2026-01-01', رقم_العملية: 'OP1', المستخدم: 'u', الدور: 'Admin', النوع: 'PARTIAL' }],
    });
    const r = getInstallmentPaidAndRemaining(inst);
    expect(r.paid).toBe(200);
    expect(r.remaining).toBe(300);
  });

  test('returns full remaining when no payment history', () => {
    const inst = makeInst('I-1', { القيمة: 500, القيمة_المتبقية: undefined });
    const r = getInstallmentPaidAndRemaining(inst);
    expect(r.paid).toBe(0);
    expect(r.remaining).toBe(500);
  });
});

describe('getInstallmentPaymentSummary', () => {
  test('returns null for nonexistent installment', () => {
    expect(getInstallmentPaymentSummary('MISSING')).toBeNull();
  });

  test('returns summary for existing installment', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1')]);
    buildCache();
    const r = getInstallmentPaymentSummary('I-1');
    expect(r).not.toBeNull();
    expect(r!.remaining).toBe(500);
  });
});

describe('calculateAutoLateFees', () => {
  test('returns empty for lateFeeType none', () => {
    const r = calculateAutoLateFees(makeContract({ lateFeeType: 'none' }), [makeInst('I-1')]);
    expect(r).toHaveLength(0);
  });

  test('fixed fee calculation', () => {
    const inst = makeInst('I-1', { تاريخ_استحقاق: '2025-01-01', القيمة_المتبقية: 500 });
    const r = calculateAutoLateFees(
      makeContract({ lateFeeType: 'fixed', lateFeeValue: 50, lateFeeGraceDays: 0 }),
      [inst]
    );
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].suggestedFee).toBe(50);
  });

  test('percentage fee calculation', () => {
    const inst = makeInst('I-1', { تاريخ_استحقاق: '2025-01-01', القيمة: 1000, القيمة_المتبقية: 1000 });
    const r = calculateAutoLateFees(
      makeContract({ lateFeeType: 'percentage', lateFeeValue: 10, lateFeeGraceDays: 0 }),
      [inst]
    );
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].suggestedFee).toBe(100);
  });

  test('daily fee calculation', () => {
    const inst = makeInst('I-1', { تاريخ_استحقاق: '2025-01-01', القيمة_المتبقية: 500 });
    const r = calculateAutoLateFees(
      makeContract({ lateFeeType: 'daily', lateFeeValue: 5, lateFeeGraceDays: 0 }),
      [inst]
    );
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].suggestedFee).toBeGreaterThan(0);
  });

  test('respects lateFeeMaxAmount cap', () => {
    const inst = makeInst('I-1', { تاريخ_استحقاق: '2025-01-01', القيمة_المتبقية: 500 });
    const r = calculateAutoLateFees(
      makeContract({ lateFeeType: 'fixed', lateFeeValue: 1000, lateFeeGraceDays: 0, lateFeeMaxAmount: 100 }),
      [inst]
    );
    expect(r[0].suggestedFee).toBe(100);
  });

  test('skips paid installments', () => {
    const inst = makeInst('I-1', { حالة_الكمبيالة: 'مدفوع', القيمة: 500 });
    const r = calculateAutoLateFees(
      makeContract({ lateFeeType: 'fixed', lateFeeValue: 50 }),
      [inst]
    );
    expect(r).toHaveLength(0);
  });

  test('skips within grace period', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() - 1);
    const dueDateStr = tomorrow.toISOString().slice(0, 10);
    const inst = makeInst('I-1', { تاريخ_استحقاق: dueDateStr, القيمة_المتبقية: 500 });
    const r = calculateAutoLateFees(
      makeContract({ lateFeeType: 'fixed', lateFeeValue: 50, lateFeeGraceDays: 30 }),
      [inst]
    );
    expect(r).toHaveLength(0);
  });
});

describe('markInstallmentPaid', () => {
  test('fails for unauthorized role', () => {
    const r = markInstallmentPaid('I-1', 'user1', 'Employee' as any, { paidAmount: 100 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('الصلاحية');
  });

  test('fails when installment not found', () => {
    const r = markInstallmentPaid('MISSING', 'user1', 'Admin', { paidAmount: 100 });
    expect(r.success).toBe(false);
  });

  test('fails when already paid', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1', { حالة_الكمبيالة: 'مدفوع' })]);
    buildCache();
    const r = markInstallmentPaid('I-1', 'user1', 'Admin', { paidAmount: 100 });
    expect(r.success).toBe(false);
  });

  test('fails when paidAmount is 0', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1')]);
    buildCache();
    const r = markInstallmentPaid('I-1', 'user1', 'Admin', { paidAmount: 0 });
    expect(r.success).toBe(false);
  });

  test('fails when paidAmount exceeds remaining', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1', { القيمة: 500 })]);
    buildCache();
    const r = markInstallmentPaid('I-1', 'user1', 'Admin', { paidAmount: 600 });
    expect(r.success).toBe(false);
  });

  test('marks as fully paid', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1', { القيمة: 500 })]);
    buildCache();
    const r = markInstallmentPaid('I-1', 'user1', 'Admin', { paidAmount: 500 });
    expect(r.success).toBe(true);
  });

  test('marks as partial payment', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1', { القيمة: 500 })]);
    buildCache();
    const r = markInstallmentPaid('I-1', 'user1', 'Admin', { paidAmount: 200, isPartial: true, notes: 'دفعة جزئية' });
    expect(r.success).toBe(true);
  });

  test('marks as partial with note appended', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1', { القيمة: 500, ملاحظات: 'ملاحظة قديمة' })]);
    buildCache();
    markInstallmentPaid('I-1', 'user1', 'Admin', { paidAmount: 200, notes: 'ملاحظة جديدة' });
    const inst = kv.get<any>(KEYS.INSTALLMENTS)[0];
    expect(inst.ملاحظات).toContain('ملاحظة جديدة');
  });

  test('updates tenant rating when contract found', () => {
    kv.save(KEYS.CONTRACTS, [makeContract()]);
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1', { القيمة: 500, رقم_العقد: 'C-1' })]);
    buildCache();
    markInstallmentPaid('I-1', 'user1', 'Admin', { paidAmount: 500 });
    expect(updateTenantRating).toHaveBeenCalled();
  });
});

describe('setInstallmentLateFee', () => {
  test('fails for unauthorized role', () => {
    const r = setInstallmentLateFee('I-1', 'u', 'Employee' as any, { amount: 50 });
    expect(r.success).toBe(false);
  });

  test('fails for invalid amount', () => {
    const r = setInstallmentLateFee('I-1', 'u', 'Admin', { amount: -10 });
    expect(r.success).toBe(false);
  });

  test('fails when not found', () => {
    const r = setInstallmentLateFee('MISSING', 'u', 'Admin', { amount: 50 });
    expect(r.success).toBe(false);
  });

  test('sets late fee successfully', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1')]);
    buildCache();
    const r = setInstallmentLateFee('I-1', 'u', 'Admin', {
      amount: 50, classification: 'تأخر', note: 'سبب',
    });
    expect(r.success).toBe(true);
  });

  test('sets late fee with custom date', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1')]);
    buildCache();
    const r = setInstallmentLateFee('I-1', 'u', 'Admin', { amount: 30, date: '2026-03-15' });
    expect(r.success).toBe(true);
  });
});

describe('reversePayment', () => {
  test('fails for non-SuperAdmin', () => {
    const r = reversePayment('I-1', 'u', 'Admin', 'سبب');
    expect(r.success).toBe(false);
  });

  test('fails when reason is empty', () => {
    const r = reversePayment('I-1', 'u', 'SuperAdmin', '');
    expect(r.success).toBe(false);
  });

  test('fails when installment not found', () => {
    const r = reversePayment('MISSING', 'u', 'SuperAdmin', 'سبب');
    expect(r.success).toBe(false);
  });

  test('fails when installment is unpaid', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1', { حالة_الكمبيالة: 'غير مدفوع' })]);
    buildCache();
    const r = reversePayment('I-1', 'u', 'SuperAdmin', 'سبب');
    expect(r.success).toBe(false);
  });

  test('reverses paid installment successfully', () => {
    kv.save(KEYS.INSTALLMENTS, [makeInst('I-1', {
      حالة_الكمبيالة: 'مدفوع',
      القيمة_المتبقية: 0,
      سجل_الدفعات: [{ رقم_العملية: 'OP1', المبلغ: 500, التاريخ: '2026-01-01', المستخدم: 'u', الدور: 'Admin', النوع: 'FULL' }]
    })]);
    buildCache();
    const r = reversePayment('I-1', 'u', 'SuperAdmin', 'خطأ في الإدخال');
    expect(r.success).toBe(true);
  });
});
