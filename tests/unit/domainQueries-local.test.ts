import {
  domainSearchGlobalSmart,
  domainSearchSmart,
  propertyPickerSearchSmart,
  contractPickerSearchSmart,
  domainCountsSmart,
  dashboardSummarySmart,
  personDetailsSmart,
  contractDetailsSmart,
  salesForPersonSmart,
  removeFromBlacklistSmart,
  personTenancyContractsSmart,
  ownershipHistorySmart,
  propertyInspectionsSmart
} from '@/services/domainQueries';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Domain Queries Service - Local Fallback Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    // Ensure NOT electron
    delete (window as any).desktopDb;
    buildCache();
  });

  test('domainSearchGlobalSmart - local search', async () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'John Doe', رقم_الهاتف: '123' }]);
    kv.save(KEYS.PROPERTIES, [{
      رقم_العقار: 'PR1', الكود_الداخلي: 'P1', العنوان: 'Amman',
      رقم_المالك: 'O1', النوع: 'Apartment', حالة_العقار: 'Active', IsRented: false, المساحة: 100
    }]);

    const res = await domainSearchGlobalSmart('John');
    expect(res.people).toHaveLength(1);
    expect(res.people[0].الاسم).toBe('John Doe');
  });

  test('domainSearchSmart - local search', async () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'John Doe', رقم_الهاتف: '123' }]);
    const res = await domainSearchSmart('people', 'John');
    expect(res).toHaveLength(1);
  });

  test('propertyPickerSearchSmart - local search', async () => {
    kv.save(KEYS.PROPERTIES, [{
      رقم_العقار: 'PR1', الكود_الداخلي: 'P-101', العنوان: 'Amman',
      رقم_المالك: 'O1', النوع: 'Apartment', حالة_العقار: 'Active', IsRented: false, المساحة: 100
    }]);
    const res = await propertyPickerSearchSmart({ query: '101' });
    expect(res).toHaveLength(1);
  });

  test('contractPickerSearchSmart - local search', async () => {
    kv.save(KEYS.CONTRACTS, [{
      رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1',
      تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false,
      lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    }]);
    const res = await contractPickerSearchSmart({ query: 'C1' });
    expect(res).toHaveLength(1);
  });

  test('domainCountsSmart - local returns null', async () => {
    const res = await domainCountsSmart();
    expect(res).toBeNull();
  });

  test('dashboardSummarySmart - local returns null', async () => {
    const res = await dashboardSummarySmart({ todayYMD: '2020-01-01', weekYMD: '2020-01-07' });
    expect(res).toBeNull();
  });

  test('personTenancyContractsSmart - local logic', async () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'John', رقم_الهاتف: '1' }]);
    kv.save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR1', الكود_الداخلي: 'P1', رقم_المالك: 'O1', النوع: 'A', العنوان: 'A', حالة_العقار: 'A', IsRented: true, المساحة: 100 }]);
    kv.save(KEYS.CONTRACTS, [{
      رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1',
      تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false,
      lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    }]);

    const res = await personTenancyContractsSmart('P1');
    expect(res).toHaveLength(1);
    expect(res?.[0].propertyCode).toBe('P1');
  });

  test('ownershipHistorySmart - local logic', async () => {
    // Mocking DbService.getOwnershipHistory is needed if it's not simple KV
    const res = await ownershipHistorySmart({ personId: 'P1' });
    expect(Array.isArray(res)).toBe(true);
  });

  test('salesForPersonSmart - local sales', async () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'P', رقم_الهاتف: '1' }]);
    kv.save(KEYS.SALES_LISTINGS, [{ id: 'L1', رقم_المالك: 'P1', رقم_العقار: 'PR1', الحالة: 'Active', السعر_المطلوب: 1000 }]);
    const res = await salesForPersonSmart('P1');
    expect(res?.listings).toHaveLength(1);
  });

  test('removeFromBlacklistSmart - local remove', async () => {
    kv.save(KEYS.BLACKLIST, [{ personId: 'P1', isActive: true, reason: 'Bad' }]);
    const res = await removeFromBlacklistSmart('P1');
    expect(res.success).toBe(true);
    expect(kv.get<any>(KEYS.BLACKLIST)[0].isActive).toBe(false);
  });

  test('propertyInspectionsSmart - local logic', async () => {
    const res = await propertyInspectionsSmart('PR1');
    expect(Array.isArray(res)).toBe(true);
  });
});
