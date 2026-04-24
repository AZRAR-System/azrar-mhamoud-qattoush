import {
  getCommissions,
  updateCommission,
  postponeCommissionCollection,
  upsertCommissionForContract,
  upsertCommissionForSale,
  finalizeCommissionCollection,
  getFinancialAlerts,
  deleteCommission,
} from '@/services/db/financial';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

const makeComm = (id: string, type = 'Rental') => ({
  رقم_العمولة: id,
  رقم_العقد: 'C-1',
  تاريخ_العقد: '2026-01-01',
  نوع_العمولة: type,
  عمولة_المالك: 100,
  عمولة_المستأجر: 50,
  عمولة_البائع: 0,
  عمولة_المشتري: 0,
  المجموع: 150,
  شهر_دفع_العمولة: '2026-01',
});

describe('getCommissions', () => {
  test('returns empty array initially', () => {
    expect(getCommissions()).toEqual([]);
  });
});

describe('updateCommission', () => {
  test('fails when id not found', () => {
    const r = updateCommission('MISSING', {});
    expect(r.success).toBe(false);
  });

  test('updates without recalculating total when no financial fields changed', () => {
    kv.save(KEYS.COMMISSIONS, [makeComm('COM-1')]);
    buildCache();
    const r = updateCommission('COM-1', { شهر_دفع_العمولة: '2026-02' });
    expect(r.success).toBe(true);
    expect((r.data as any).المجموع).toBe(150);
  });

  test('recalculates total for Rental when financial fields change', () => {
    kv.save(KEYS.COMMISSIONS, [makeComm('COM-1')]);
    buildCache();
    const r = updateCommission('COM-1', { عمولة_المالك: 200, عمولة_المستأجر: 100 });
    expect(r.success).toBe(true);
    expect((r.data as any).المجموع).toBe(300);
  });

  test('recalculates total for Sale type', () => {
    kv.save(KEYS.COMMISSIONS, [{ ...makeComm('COM-2', 'Sale'), عمولة_البائع: 300, عمولة_المشتري: 200, عمولة_إدخال_عقار: 50 }]);
    buildCache();
    const r = updateCommission('COM-2', { عمولة_البائع: 400 });
    expect(r.success).toBe(true);
    expect((r.data as any).المجموع).toBe(650);
  });
});

describe('postponeCommissionCollection', () => {
  test('fails for invalid date format', () => {
    const r = postponeCommissionCollection('COM-1', '2026/01/01');
    expect(r.success).toBe(false);
    expect(r.message).toContain('تاريخ');
  });

  test('fails when commission not found', () => {
    const r = postponeCommissionCollection('MISSING', '2026-01-15');
    expect(r.success).toBe(false);
  });

  test('postpones successfully', () => {
    kv.save(KEYS.COMMISSIONS, [makeComm('COM-1')]);
    buildCache();
    const r = postponeCommissionCollection('COM-1', '2026-03-15', 'Owner', 'note');
    expect(r.success).toBe(true);
    expect((r.data as any).تاريخ_تحصيل_مؤجل).toBe('2026-03-15');
    expect((r.data as any).شهر_دفع_العمولة).toBe('2026-03');
  });
});

const fullContract = (id: string) => ({ 
  رقم_العقد: id, 
  رقم_العقار: 'PR-1', 
  رقم_المستاجر: 'PER-1',
  تاريخ_البداية: '2026-01-01',
  تاريخ_النهاية: '2026-12-31',
  مدة_العقد_بالاشهر: 12,
  القيمة_السنوية: 4800,
  تكرار_الدفع: 1,
  طريقة_الدفع: 'نقدي',
  حالة_العقد: 'نشط',
  isArchived: false,
  lateFeeType: 'none',
  lateFeeValue: 0,
  lateFeeGraceDays: 0
});

describe('upsertCommissionForContract', () => {
  test('fails when contract not found', () => {
    const r = upsertCommissionForContract('C-MISSING', { commOwner: 100, commTenant: 50 });
    expect(r.success).toBe(false);
  });

  test('creates new commission for contract', () => {
    kv.save(KEYS.CONTRACTS, [fullContract('C-1')]);
    buildCache();
    const r = upsertCommissionForContract('C-1', { commOwner: 200, commTenant: 100 });
    expect(r.success).toBe(true);
    expect((r.data as any).المجموع).toBe(300);
  });

  test('updates existing commission for contract', () => {
    kv.save(KEYS.CONTRACTS, [fullContract('C-1')]);
    kv.save(KEYS.COMMISSIONS, [makeComm('COM-C-1')]);
    buildCache();
    const r = upsertCommissionForContract('C-1', { commOwner: 300, commTenant: 150 });
    expect(r.success).toBe(true);
  });

  test('uses provided commissionPaidMonth', () => {
    kv.save(KEYS.CONTRACTS, [fullContract('C-2')]);
    buildCache();
    const r = upsertCommissionForContract('C-2', {
      commOwner: 100, commTenant: 50, commissionPaidMonth: '2025-06',
    });
    expect(r.success).toBe(true);
    expect((r.data as any).شهر_دفع_العمولة).toBe('2025-06');
  });

  test('uses employeeUsername when provided', () => {
    kv.save(KEYS.CONTRACTS, [fullContract('C-3')]);
    buildCache();
    const r = upsertCommissionForContract('C-3', {
      commOwner: 100, commTenant: 50, employeeUsername: 'user1',
    });
    expect(r.success).toBe(true);
    expect((r.data as any).اسم_المستخدم).toBe('user1');
  });
});

describe('upsertCommissionForSale', () => {
  test('creates new sale commission', () => {
    const r = upsertCommissionForSale('AGR-1', { sellerComm: 500, buyerComm: 300 });
    expect(r.success).toBe(true);
    expect((r.data as any).المجموع).toBe(800);
    expect((r.data as any).نوع_العمولة).toBe('Sale');
  });

  test('updates existing sale commission', () => {
    kv.save(KEYS.COMMISSIONS, [{
      رقم_العمولة: 'COM-SALE-AGR-1',
      رقم_الاتفاقية: 'AGR-1',
      نوع_العمولة: 'Sale',
      عمولة_البائع: 100, عمولة_المشتري: 100, المجموع: 200,
    }]);
    buildCache();
    const r = upsertCommissionForSale('AGR-1', { sellerComm: 600, buyerComm: 400 });
    expect(r.success).toBe(true);
    expect((r.data as any).المجموع).toBe(1000);
  });

  test('includes listingComm in total', () => {
    const r = upsertCommissionForSale('AGR-2', {
      sellerComm: 500, buyerComm: 300, listingComm: 100, listingEmployee: 'emp1',
    });
    expect(r.success).toBe(true);
    expect((r.data as any).المجموع).toBe(900);
    expect((r.data as any).يوجد_ادخال_عقار).toBe(true);
  });
});

describe('finalizeCommissionCollection', () => {
  test('fails when id not found', () => {
    const r = finalizeCommissionCollection('MISSING');
    expect(r.success).toBe(false);
  });

  test('succeeds for existing commission', () => {
    kv.save(KEYS.COMMISSIONS, [makeComm('COM-1')]);
    buildCache();
    const r = finalizeCommissionCollection('COM-1');
    expect(r.success).toBe(true);
  });
});

describe('getFinancialAlerts', () => {
  test('returns only unread Financial alerts', () => {
    kv.save(KEYS.ALERTS, [
      { id: 'A1', category: 'Financial', تم_القراءة: false },
      { id: 'A2', category: 'Financial', تم_القراءة: true },
      { id: 'A3', category: 'Expiry', تم_القراءة: false },
    ]);
    buildCache();
    const r = getFinancialAlerts();
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('A1');
  });
});

describe('deleteCommission', () => {
  test('deletes commission by id', () => {
    kv.save(KEYS.COMMISSIONS, [makeComm('COM-1'), makeComm('COM-2')]);
    buildCache();
    deleteCommission('COM-1');
    expect(getCommissions()).toHaveLength(1);
    expect(getCommissions()[0].رقم_العمولة).toBe('COM-2');
  });

  test('noop when id not found', () => {
    kv.save(KEYS.COMMISSIONS, [makeComm('COM-1')]);
    buildCache();
    deleteCommission('MISSING');
    expect(getCommissions()).toHaveLength(1);
  });
});
