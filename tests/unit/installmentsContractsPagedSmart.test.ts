import { installmentsContractsPagedSmart } from '@/services/domainQueries';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('installmentsContractsPagedSmart - Comprehensive Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).desktopDb;
    buildCache();
  });

  test('filters by query (tenant name)', async () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'Target User', رقم_الهاتف: '123' }]);
    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1',
      تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false,
      lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    }]);

    const res = await installmentsContractsPagedSmart({ query: 'Target' });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].tenant?.الاسم).toBe('Target User');
  });

  test('filters by status (debt)', async () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'P', رقم_الهاتف: '1' }]);
    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1',
      تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false,
      lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    }]);
    // Past due installment
    kv.save(KEYS.INSTALLMENTS, [{ 
      رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', حالة_الكمبيالة: 'Pending', تاريخ_استحقاق: '2000-01-01', القيمة: 100, سجل_الدفعات: [], نوع_الكمبيالة: 'Rental'
    }]);

    const res = await installmentsContractsPagedSmart({ filter: 'debt' });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].hasDebt).toBe(true);
  });

  test('filters by status (paid)', async () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'P', رقم_الهاتف: '1' }]);
    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1',
      تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false,
      lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    }]);
    kv.save(KEYS.INSTALLMENTS, [{ 
      رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', حالة_الكمبيالة: 'PAID', تاريخ_استحقاق: '2020-01-01', القيمة: 100, سجل_الدفعات: [], نوع_الكمبيالة: 'Rental', القيمة_المتبقية: 0
    }]);

    const res = await installmentsContractsPagedSmart({ filter: 'paid' });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].isFullyPaid).toBe(true);
  });

  test('sorting by tenant name', async () => {
    kv.save(KEYS.PEOPLE, [
      { رقم_الشخص: 'P1', الاسم: 'B User', رقم_الهاتف: '1' },
      { رقم_الشخص: 'P2', الاسم: 'A User', رقم_الهاتف: '2' }
    ]);
    kv.save(KEYS.CONTRACTS, [
      { رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1', تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12, القيمة_السنوية: 1000, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0 },
      { رقم_العقد: 'C2', رقم_العقار: 'PR1', رقم_المستاجر: 'P2', تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12, القيمة_السنوية: 1000, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0 }
    ]);

    const res = await installmentsContractsPagedSmart({ sort: 'tenant-asc' });
    expect(res.items[0].tenant?.الاسم).toBe('A User');

    const res2 = await installmentsContractsPagedSmart({ sort: 'tenant-desc' });
    expect(res2.items[0].tenant?.الاسم).toBe('B User');
  });

  test('sorting by due date', async () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'P', رقم_الهاتف: '1' }]);
    kv.save(KEYS.CONTRACTS, [
      { رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1', تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12, القيمة_السنوية: 1000, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0 },
      { رقم_العقد: 'C2', رقم_العقار: 'PR1', رقم_المستاجر: 'P1', تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12, القيمة_السنوية: 1000, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0 }
    ]);
    kv.save(KEYS.INSTALLMENTS, [
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: '2020-05-01', القيمة: 100, سجل_الدفعات: [], نوع_الكمبيالة: 'Rental', حالة_الكمبيالة: 'Pending' },
      { رقم_الكمبيالة: 'I2', رقم_العقد: 'C2', تاريخ_استحقاق: '2020-01-01', القيمة: 100, سجل_الدفعات: [], نوع_الكمبيالة: 'Rental', حالة_الكمبيالة: 'Pending' }
    ]);

    const res = await installmentsContractsPagedSmart({ sort: 'due-asc' });
    expect(res.items[0].contract.رقم_العقد).toBe('C2');

    const res2 = await installmentsContractsPagedSmart({ sort: 'due-desc' });
    expect(res2.items[0].contract.رقم_العقد).toBe('C1');
  });
});
