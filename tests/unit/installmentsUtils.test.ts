import {
  parseDateOnlyLocal,
  isRecord,
  normalizeRole,
  getPaidAndRemaining,
  getLastPositivePaymentAmount,
  getNextUnpaidDueSummary,
  formatNextDuePaymentLabel,
} from '@/components/installments/installmentsUtils';

const makeInst = (overrides: Record<string, unknown> = {}) => ({
  رقم_الكمبيالة: 'I-1',
  رقم_العقد: 'C-1',
  القيمة: 500,
  القيمة_المتبقية: 500,
  تاريخ_استحقاق: '2026-06-01',
  حالة_الكمبيالة: 'غير مدفوع',
  نوع_الكمبيالة: 'إيجار',
  نوع_الدفعة: 'دورية',
  ترتيب_الكمبيالة: 1,
  ...overrides,
} as any);

describe('parseDateOnlyLocal', () => {
  test('returns null for null/undefined', () => {
    expect(parseDateOnlyLocal(null)).toBeNull();
    expect(parseDateOnlyLocal(undefined)).toBeNull();
  });

  test('returns Date for valid ISO', () => {
    expect(parseDateOnlyLocal('2026-01-15')).toBeInstanceOf(Date);
  });
});

describe('isRecord', () => {
  test('returns true for plain object', () => expect(isRecord({})).toBe(true));
  test('returns false for array', () => expect(isRecord([])).toBe(false));
  test('returns false for null', () => expect(isRecord(null)).toBe(false));
  test('returns false for string', () => expect(isRecord('x')).toBe(false));
});

describe('normalizeRole', () => {
  test('returns SuperAdmin for SuperAdmin', () => {
    expect(normalizeRole('SuperAdmin')).toBe('SuperAdmin');
  });
  test('returns Admin for Admin', () => {
    expect(normalizeRole('Admin')).toBe('Admin');
  });
  test('returns Employee for Employee', () => {
    expect(normalizeRole('Employee')).toBe('Employee');
  });
  test('returns Employee for unknown role', () => {
    expect(normalizeRole('Manager')).toBe('Employee');
    expect(normalizeRole(null)).toBe('Employee');
    expect(normalizeRole(undefined)).toBe('Employee');
    expect(normalizeRole(123)).toBe('Employee');
  });
});

describe('getPaidAndRemaining', () => {
  test('paid status returns full amount', () => {
    const r = getPaidAndRemaining(makeInst({ حالة_الكمبيالة: 'مدفوع', القيمة: 500 }));
    expect(r.remaining).toBe(0);
    expect(r.paid).toBe(500);
  });

  test('uses القيمة_المتبقية when finite', () => {
    const r = getPaidAndRemaining(makeInst({ القيمة: 500, القيمة_المتبقية: 200 }));
    expect(r.remaining).toBe(200);
    expect(r.paid).toBe(300);
  });

  test('uses payment history when no القيمة_المتبقية', () => {
    const r = getPaidAndRemaining(makeInst({
      القيمة: 500,
      القيمة_المتبقية: undefined,
      سجل_الدفعات: [{ المبلغ: 150, التاريخ: '2026-01-01', رقم_العملية: 'OP1', المستخدم: 'u', الدور: 'Admin', النوع: 'PARTIAL' }],
    }));
    expect(r.paid).toBe(150);
    expect(r.remaining).toBe(350);
  });

  test('returns full remaining with no history', () => {
    const r = getPaidAndRemaining(makeInst({ القيمة: 500, القيمة_المتبقية: undefined }));
    expect(r.remaining).toBe(500);
  });
});

describe('getLastPositivePaymentAmount', () => {
  test('returns null when no payment history', () => {
    expect(getLastPositivePaymentAmount(makeInst({ سجل_الدفعات: [] }))).toBeNull();
  });

  test('returns null when سجل_الدفعات is undefined', () => {
    expect(getLastPositivePaymentAmount(makeInst({ سجل_الدفعات: undefined }))).toBeNull();
  });

  test('returns last positive amount', () => {
    const r = getLastPositivePaymentAmount(makeInst({
      سجل_الدفعات: [
        { المبلغ: 100, التاريخ: '2026-01-01', رقم_العملية: 'OP1', المستخدم: 'u', الدور: 'Admin', النوع: 'PARTIAL' },
        { المبلغ: 200, التاريخ: '2026-02-01', رقم_العملية: 'OP2', المستخدم: 'u', الدور: 'Admin', النوع: 'PARTIAL' },
      ],
    }));
    expect(r).toBe(200);
  });

  test('skips negative amounts', () => {
    const r = getLastPositivePaymentAmount(makeInst({
      سجل_الدفعات: [
        { المبلغ: 100, التاريخ: '2026-01-01', رقم_العملية: 'OP1', المستخدم: 'u', الدور: 'Admin', النوع: 'PARTIAL' },
        { المبلغ: -50, التاريخ: '2026-02-01', رقم_العملية: 'OP2', المستخدم: 'u', الدور: 'Admin', النوع: 'PARTIAL' },
      ],
    }));
    expect(r).toBe(100);
  });

  test('returns null when all amounts are negative', () => {
    const r = getLastPositivePaymentAmount(makeInst({
      سجل_الدفعات: [
        { المبلغ: -100, التاريخ: '2026-01-01', رقم_العملية: 'OP1', المستخدم: 'u', الدور: 'Admin', النوع: 'PARTIAL' },
      ],
    }));
    expect(r).toBeNull();
  });
});

describe('getNextUnpaidDueSummary', () => {
  test('returns null dueDate for empty list', () => {
    const r = getNextUnpaidDueSummary([], '2026-01-01');
    expect(r.dueDate).toBeNull();
    expect(r.daysFromToday).toBeNull();
  });

  test('returns first unpaid installment', () => {
    const insts = [
      makeInst({ تاريخ_استحقاق: '2026-06-01', القيمة_المتبقية: 500 }),
      makeInst({ رقم_الكمبيالة: 'I-2', تاريخ_استحقاق: '2026-07-01', القيمة_المتبقية: 500 }),
    ];
    const r = getNextUnpaidDueSummary(insts, '2026-05-01');
    expect(r.dueDate).toBe('2026-06-01');
  });

  test('skips cancelled installments', () => {
    const insts = [
      makeInst({ تاريخ_استحقاق: '2026-06-01', حالة_الكمبيالة: 'ملغي', القيمة_المتبقية: 500 }),
      makeInst({ رقم_الكمبيالة: 'I-2', تاريخ_استحقاق: '2026-07-01', القيمة_المتبقية: 500 }),
    ];
    const r = getNextUnpaidDueSummary(insts, '2026-05-01');
    expect(r.dueDate).toBe('2026-07-01');
  });
});

describe('formatNextDuePaymentLabel', () => {
  test('returns fully paid message', () => {
    const r = formatNextDuePaymentLabel({ dueDate: null, daysFromToday: null }, { contractFullyPaid: true });
    expect(r).toContain('مسدد');
  });

  test('returns null when no due date', () => {
    expect(formatNextDuePaymentLabel({ dueDate: null, daysFromToday: null })).toBeNull();
  });

  test('future payment label', () => {
    const r = formatNextDuePaymentLabel({ dueDate: '2026-06-01', daysFromToday: 10 });
    expect(r).toContain('باقٍ');
  });

  test('today payment label', () => {
    const r = formatNextDuePaymentLabel({ dueDate: '2026-05-01', daysFromToday: 0 });
    expect(r).toContain('اليوم');
  });

  test('overdue payment label', () => {
    const r = formatNextDuePaymentLabel({ dueDate: '2026-04-01', daysFromToday: -5 });
    expect(r).toContain('متأخر');
  });
});
