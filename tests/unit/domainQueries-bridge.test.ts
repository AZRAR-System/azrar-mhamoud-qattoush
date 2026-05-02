import {
  domainSearchGlobalSmart,
  domainSearchSmart,
  propertyPickerSearchSmart,
  propertyPickerSearchPagedSmart,
  contractPickerSearchSmart,
  contractPickerSearchPagedSmart,
  domainCountsSmart,
  dashboardSummarySmart,
  dashboardPerformanceSmart,
  dashboardHighlightsSmart,
  paymentNotificationTargetsSmart,
  personDetailsSmart,
  peoplePickerSearchPagedSmart,
  installmentsContractsPagedSmart,
} from '@/services/domainQueries';
import { buildCache } from '@/services/dbCache';
import { KEYS } from '@/services/db/keys';
import type { PropertyPickerSearchPayload } from '@/types/domain.types';

const makeBridge = (overrides: Record<string, jest.Mock> = {}) => ({
  domainSearchGlobal: jest.fn().mockResolvedValue({ ok: false }),
  domainSearch: jest.fn().mockResolvedValue({ ok: false }),
  domainPropertyPickerSearch: jest.fn().mockResolvedValue({ ok: false }),
  domainContractPickerSearch: jest.fn().mockResolvedValue({ ok: false }),
  domainCounts: jest.fn().mockResolvedValue({ ok: false }),
  domainMigrate: jest.fn().mockResolvedValue({}),
  domainDashboardSummary: jest.fn().mockResolvedValue({ ok: false }),
  domainDashboardPerformance: jest.fn().mockResolvedValue({ ok: false }),
  domainDashboardHighlights: jest.fn().mockResolvedValue({ ok: false }),
  domainPaymentNotificationTargets: jest.fn().mockResolvedValue({ ok: false }),
  domainPersonDetails: jest.fn().mockResolvedValue({ ok: false }),
  set: jest.fn(), get: jest.fn(), delete: jest.fn(), keys: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  buildCache();
  delete (window as any).desktopDb;
});

afterEach(() => {
  delete (window as any).desktopDb;
});

/** Minimal operational KV so DbService reads succeed after `buildCache()`. */
function seedHydratedKvAndRebuild() {
  const tenant = {
    رقم_الشخص: 'P-T1',
    الاسم: 'مستأجر تجريبي',
    الرقم_الوطني: '990011',
    رقم_الهاتف: '0790000001',
    رقم_هاتف_اضافي: '',
  };
  const owner = {
    رقم_الشخص: 'P-O1',
    الاسم: 'مالك تجريبي',
    الرقم_الوطني: '',
    رقم_الهاتف: '',
    رقم_هاتف_اضافي: '',
  };
  const property = {
    رقم_العقار: 'PR-1',
    الكود_الداخلي: 'INT-001',
    رقم_المالك: 'P-O1',
    حالة_العقار: 'مؤجر',
    IsRented: true,
    العنوان: '',
    المدينة: '',
    المنطقة: '',
    isForSale: false,
    isForRent: true,
  };
  const contract = {
    رقم_العقد: 'C-TEST-1',
    رقم_المستاجر: 'P-T1',
    رقم_العقار: 'PR-1',
    حالة_العقد: 'نشط',
    isArchived: false,
    تاريخ_الانشاء: '2026-01-10',
    تاريخ_البداية: '2026-01-01',
    تاريخ_النهاية: '2027-01-01',
    القيمة_السنوية: 12000,
    رقم_الفرصة: '',
  };
  const installment = {
    رقم_الكمبيالة: 'INS-1',
    رقم_العقد: 'C-TEST-1',
    نوع_الكمبيالة: 'إيجار',
    حالة_الكمبيالة: 'غير مدفوع',
    القيمة: 1000,
    القيمة_المتبقية: 400,
    تاريخ_استحقاق: '2020-06-01',
  };

  localStorage.setItem(KEYS.PEOPLE, JSON.stringify([tenant, owner]));
  localStorage.setItem(KEYS.PROPERTIES, JSON.stringify([property]));
  localStorage.setItem(KEYS.CONTRACTS, JSON.stringify([contract]));
  localStorage.setItem(KEYS.INSTALLMENTS, JSON.stringify([installment]));
  localStorage.setItem(KEYS.ROLES, JSON.stringify([]));
  buildCache();
}

/** Extra people/properties/contracts for branch coverage in memory fallbacks. */
function seedRichBranchesKvAndRebuild() {
  const guarantor = {
    رقم_الشخص: 'P-G1',
    الاسم: 'كفيل تجريبي',
    الرقم_الوطني: '',
    رقم_الهاتف: '0792222000',
    رقم_هاتف_اضافي: '',
  };
  const tenant = {
    رقم_الشخص: 'P-T1',
    الاسم: 'مستأجر تجريبي',
    الرقم_الوطني: '990011',
    رقم_الهاتف: '0790000001',
    رقم_هاتف_اضافي: '',
  };
  const owner = {
    رقم_الشخص: 'P-O1',
    الاسم: 'مالك تجريبي',
    الرقم_الوطني: '2000888777',
    رقم_الهاتف: '0798888777',
    رقم_هاتف_اضافي: '',
  };
  const propRented = {
    رقم_العقار: 'PR-1',
    الكود_الداخلي: 'INT-RENT',
    رقم_المالك: 'P-O1',
    حالة_العقار: 'مؤجر',
    IsRented: true,
    النوع: 'شقة',
    نوع_التاثيث: 'مفروش',
    العنوان: '',
    المدينة: '',
    المنطقة: '',
    المساحة: 120,
    الطابق: '3',
    isForSale: true,
    isForRent: true,
    salePrice: 95000,
    الإيجار_التقديري: 8000,
    updatedAt: '2026-03-01',
  } as Record<string, unknown>;
  const propVacant = {
    رقم_العقار: 'PR-2',
    الكود_الداخلي: 'VAC-002',
    رقم_المالك: 'P-O1',
    حالة_العقار: 'شاغر',
    IsRented: false,
    النوع: 'محل',
    نوع_التاثيث: '',
    العنوان: '',
    المدينة: '',
    المنطقة: '',
    المساحة: 55,
    الطابق: '1',
    isForSale: false,
    isForRent: true,
    الإيجار_التقديري: 4500,
    updatedAt: '2026-01-20',
  } as Record<string, unknown>;
  const propNoRent = {
    رقم_العقار: 'PR-3',
    الكود_الداخلي: 'NR-003',
    رقم_المالك: 'P-O1',
    حالة_العقار: 'شاغر',
    IsRented: false,
    النوع: 'شقة',
    المساحة: 80,
    الطابق: '2',
    isForSale: false,
    isForRent: false,
    الإيجار_التقديري: 0,
    updatedAt: '2026-02-01',
  } as Record<string, unknown>;

  const cActive = {
    رقم_العقد: 'C-ACTIVE',
    رقم_المستاجر: 'P-T1',
    رقم_العقار: 'PR-1',
    رقم_الكفيل: 'P-G1',
    حالة_العقد: 'نشط',
    isArchived: false,
    تاريخ_الانشاء: '2026-01-10',
    تاريخ_البداية: '2026-06-01',
    تاريخ_النهاية: '2027-01-01',
    القيمة_السنوية: 24000,
    رقم_الفرصة: 'OPP-9',
  };
  const cOlderSameProp = {
    رقم_العقد: 'C-OLDER',
    رقم_المستاجر: 'P-T1',
    رقم_العقار: 'PR-1',
    حالة_العقد: 'نشط',
    isArchived: false,
    تاريخ_الانشاء: '2025-12-01',
    تاريخ_البداية: '2025-01-01',
    تاريخ_النهاية: '2025-12-31',
    القيمة_السنوية: 10000,
    رقم_الفرصة: '',
  };
  const cExpiring = {
    رقم_العقد: 'C-EXP',
    رقم_المستاجر: 'P-T1',
    رقم_العقار: 'PR-2',
    حالة_العقد: 'قريب الانتهاء',
    isArchived: false,
    تاريخ_الانشاء: '2026-02-01',
    تاريخ_البداية: '2026-01-01',
    تاريخ_النهاية: '2026-04-01',
    القيمة_السنوية: 5000,
    رقم_الفرصة: '',
  };
  const cCollection = {
    رقم_العقد: 'C-COL',
    رقم_المستاجر: 'P-T1',
    رقم_العقار: 'PR-3',
    حالة_العقد: 'تحصيل',
    isArchived: false,
    تاريخ_الانشاء: '2026-01-05',
    تاريخ_البداية: '2026-01-01',
    تاريخ_النهاية: '2026-12-01',
    القيمة_السنوية: 8000,
    رقم_الفرصة: '',
  };
  const cExpired = {
    رقم_العقد: 'C-EXPIRED',
    رقم_المستاجر: 'P-T1',
    رقم_العقار: 'PR-3',
    حالة_العقد: 'منتهي',
    isArchived: false,
    تاريخ_الانشاء: '2024-01-01',
    تاريخ_البداية: '2024-01-01',
    تاريخ_النهاية: '2024-12-01',
    القيمة_السنوية: 3000,
    رقم_الفرصة: '',
  };
  const cTerminated = {
    رقم_العقد: 'C-TERM',
    رقم_المستاجر: 'P-T1',
    رقم_العقار: 'PR-2',
    حالة_العقد: 'مفسوخ',
    isArchived: false,
    تاريخ_الانشاء: '2025-06-01',
    تاريخ_البداية: '2025-06-01',
    تاريخ_النهاية: '2025-12-01',
    القيمة_السنوية: 4000,
    رقم_الفرصة: '',
  };
  const cArchived = {
    رقم_العقد: 'C-ARCH',
    رقم_المستاجر: 'P-T1',
    رقم_العقار: 'PR-1',
    حالة_العقد: 'مؤرشف',
    isArchived: true,
    تاريخ_الانشاء: '2023-01-01',
    تاريخ_البداية: '2023-01-01',
    تاريخ_النهاية: '2023-12-01',
    القيمة_السنوية: 2000,
    رقم_الفرصة: '',
  };

  const installment = {
    رقم_الكمبيالة: 'INS-1',
    رقم_العقد: 'C-ACTIVE',
    نوع_الكمبيالة: 'إيجار',
    حالة_الكمبيالة: 'غير مدفوع',
    القيمة: 1000,
    القيمة_المتبقية: 400,
    تاريخ_استحقاق: '2020-06-01',
  };

  localStorage.setItem(
    KEYS.PEOPLE,
    JSON.stringify([guarantor, tenant, owner])
  );
  localStorage.setItem(
    KEYS.PROPERTIES,
    JSON.stringify([propRented, propVacant, propNoRent])
  );
  localStorage.setItem(
    KEYS.CONTRACTS,
    JSON.stringify([
      cOlderSameProp,
      cActive,
      cExpiring,
      cCollection,
      cExpired,
      cTerminated,
      cArchived,
    ])
  );
  localStorage.setItem(KEYS.INSTALLMENTS, JSON.stringify([installment]));
  localStorage.setItem(KEYS.ROLES, JSON.stringify([]));
  buildCache();
}

const emptyPayload = {
  query: '',
  status: '',
  type: '',
  furnishing: '',
  sort: 'code-asc',
  offset: 0,
  limit: 50,
  occupancy: 'all',
  sale: '',
  rent: '',
  minArea: '',
  maxArea: '',
  floor: '',
  minPrice: '',
  maxPrice: '',
  contractLink: 'all',
} satisfies PropertyPickerSearchPayload;

const makeDesktopSqlFailBridge = () =>
  makeBridge({
    domainContractPickerSearch: jest.fn().mockResolvedValue({ ok: false, message: 'SQL down' }),
    domainPeoplePickerSearch: jest.fn().mockResolvedValue({ ok: false, message: 'SQL down' }),
    domainPropertyPickerSearch: jest.fn().mockResolvedValue({ ok: false, message: 'SQL down' }),
    domainInstallmentsContractsSearch: jest
      .fn()
      .mockResolvedValue({ ok: false, message: 'SQL down' }),
  });

describe('desktop SQL failure + hydrated KV memory fallbacks', () => {
  test('contractPickerSearchPagedSmart serves rows from local KV with advisory error', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeDesktopSqlFailBridge();

    const r = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      offset: 0,
      limit: 10,
    });

    expect(r.total).toBe(1);
    expect(r.items).toHaveLength(1);
    expect(String(r.items[0]?.contract?.رقم_العقد || '')).toBe('C-TEST-1');
    expect(String(r.items[0]?.tenantName || '')).toContain('مستأجر');
    expect(r.error || '').toMatch(/SQL down|احتياطي/);
  });

  test('contractPickerSearchPagedSmart memory path respects search query', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeDesktopSqlFailBridge();

    const r = await contractPickerSearchPagedSmart({
      query: 'INT-001',
      tab: 'active',
      offset: 0,
      limit: 10,
    });

    expect(r.total).toBe(1);
    expect(r.items).toHaveLength(1);
  });

  test('peoplePickerSearchPagedSmart serves rows from local KV when desktop SQL fails', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeDesktopSqlFailBridge();

    const r = await peoplePickerSearchPagedSmart({
      query: 'مستأجر',
      role: '',
      offset: 0,
      limit: 10,
    });

    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.items.some((x) => String(x?.person?.رقم_الشخص) === 'P-T1')).toBe(true);
  });

  test('installmentsContractsPagedSmart serves rows from local KV when desktop SQL fails', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeDesktopSqlFailBridge();

    const r = await installmentsContractsPagedSmart({
      query: '',
      filter: 'all',
      offset: 0,
      limit: 48,
    });

    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-TEST-1')).toBe(true);
  });

  test('propertyPickerSearchPagedSmart serves rows from local KV when desktop SQL fails', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeDesktopSqlFailBridge();

    const r = await propertyPickerSearchPagedSmart({
      query: '',
      status: '',
      type: '',
      furnishing: '',
      sort: 'code-asc',
      offset: 0,
      limit: 24,
      occupancy: 'all',
      sale: '',
      rent: '',
      minArea: '',
      maxArea: '',
      floor: '',
      minPrice: '',
      maxPrice: '',
      contractLink: '',
    });

    expect(r.total).toBe(1);
    expect(r.items).toHaveLength(1);
    expect(String(r.items[0]?.property?.رقم_العقار || '')).toBe('PR-1');
    expect(String(r.items[0]?.ownerName || '')).toContain('مالك');
    expect(r.error || '').toMatch(/SQL down|احتياطي/);
  });

  test('propertyPickerSearchPagedSmart memory fallback maps active as summary (owner + tenant names for cards)', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeDesktopSqlFailBridge();

    const r = await propertyPickerSearchPagedSmart({
      query: '',
      status: '',
      type: '',
      furnishing: '',
      sort: 'code-asc',
      offset: 0,
      limit: 24,
      occupancy: 'all',
      sale: '',
      rent: '',
      minArea: '',
      maxArea: '',
      floor: '',
      minPrice: '',
      maxPrice: '',
      contractLink: '',
    });

    const row = r.items[0] as Record<string, unknown> | undefined;
    expect(String(row?.ownerName || '')).toContain('مالك');
    const active = row?.active as Record<string, unknown> | undefined;
    expect(active).toBeTruthy();
    expect(active).not.toHaveProperty('رقم_العقد');
    expect(String(active?.contractId || '')).toBe('C-TEST-1');
    expect(String(active?.tenantName || '')).toContain('مستأجر');
    expect(String(active?.tenantPhone || '')).toContain('079');
  });

  test('propertyPickerSearchPagedSmart adds recovery hint when SQLite reports disk malformed', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeBridge({
      domainPropertyPickerSearch: jest
        .fn()
        .mockResolvedValue({ ok: false, message: 'database disk image is malformed' }),
    });

    const r = await propertyPickerSearchPagedSmart({
      query: '',
      status: '',
      type: '',
      furnishing: '',
      sort: 'code-asc',
      offset: 0,
      limit: 24,
      occupancy: 'all',
      sale: '',
      rent: '',
      minArea: '',
      maxArea: '',
      floor: '',
      minPrice: '',
      maxPrice: '',
      contractLink: '',
    });

    expect(r.error || '').toMatch(/malformed|احتياطي/);
    expect(r.error || '').toMatch(/إعدادات|نسخ|استعد|إغلاق/);
  });
});

describe('property memory fallback filters (desktop SQL fail + KV)', () => {
  beforeEach(() => {
    seedRichBranchesKvAndRebuild();
    (window as any).desktopDb = makeDesktopSqlFailBridge();
  });

  test('picks newer active contract when two نشط exist on same property', async () => {
    const r = await propertyPickerSearchPagedSmart({ ...emptyPayload });
    const row = r.items.find((x) => String(x?.property?.رقم_العقار) === 'PR-1');
    expect(String((row?.active as { contractId?: string })?.contractId)).toBe('C-ACTIVE');
  });

  test('occupancy vacant vs rented', async () => {
    const vacant = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      occupancy: 'vacant',
    });
    expect(vacant.items.map((x) => String(x?.property?.رقم_العقار)).sort()).toEqual([
      'PR-2',
      'PR-3',
    ]);

    const rented = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      occupancy: 'rented',
    });
    expect(rented.items.map((x) => String(x?.property?.رقم_العقار))).toEqual(['PR-1']);
  });

  test('contractLink linked and unlinked', async () => {
    const linked = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      contractLink: 'linked',
    });
    expect(linked.items.map((x) => String(x?.property?.رقم_العقار)).sort()).toEqual([
      'PR-1',
      'PR-2',
    ]);

    const unlinked = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      contractLink: 'unlinked',
    });
    expect(unlinked.items.map((x) => String(x?.property?.رقم_العقار))).toEqual(['PR-3']);
  });

  test('forceVacant excludes rented property', async () => {
    const r = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      forceVacant: true,
    });
    expect(r.items.some((x) => String(x?.property?.رقم_العقار) === 'PR-1')).toBe(false);
    expect(r.total).toBeGreaterThanOrEqual(2);
  });

  test('status شاغر and مؤجر filters', async () => {
    const شاغر = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      status: 'شاغر',
    });
    expect(شاغر.items.every((x) => String(x?.property?.رقم_العقار) !== 'PR-1')).toBe(true);

    const مؤجر = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      status: 'مؤجر',
    });
    expect(مؤجر.items.map((x) => String(x?.property?.رقم_العقار))).toEqual(['PR-1']);
  });

  test('type, furnishing, sale and rent filters', async () => {
    const byType = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      type: 'شقة',
    });
    expect(byType.items.map((x) => String(x?.property?.رقم_العقار)).sort()).toEqual([
      'PR-1',
      'PR-3',
    ]);

    const furnished = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      furnishing: 'مفروش',
    });
    expect(furnished.items.map((x) => String(x?.property?.رقم_العقار))).toEqual(['PR-1']);

    const forSale = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      sale: 'for-sale',
    });
    expect(forSale.items.map((x) => String(x?.property?.رقم_العقار))).toEqual(['PR-1']);

    const forRent = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      rent: 'for-rent',
    });
    expect(forRent.items.map((x) => String(x?.property?.رقم_العقار))).not.toContain('PR-3');

    const notForRent = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      rent: 'not-for-rent',
    });
    expect(notForRent.items.map((x) => String(x?.property?.رقم_العقار))).not.toContain('PR-3');
  });

  test('minArea, maxArea, floor and price window', async () => {
    const area = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      minArea: '100',
      maxArea: '130',
    });
    expect(area.items.map((x) => String(x?.property?.رقم_العقار))).toEqual(['PR-1']);

    const floor = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      floor: '3',
    });
    expect(floor.items.map((x) => String(x?.property?.رقم_العقار))).toEqual(['PR-1']);

    const salePrice = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      minPrice: '90000',
      maxPrice: '100000',
    });
    expect(salePrice.items.map((x) => String(x?.property?.رقم_العقار))).toEqual(['PR-1']);

    const rentPrice = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      minPrice: '4000',
      maxPrice: '5000',
    });
    expect(rentPrice.items.map((x) => String(x?.property?.رقم_العقار))).toContain('PR-2');
  });

  test('sort updated-asc, updated-desc, code-desc', async () => {
    const asc = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      sort: 'updated-asc',
    });
    const idsAsc = asc.items.map((x) => String(x?.property?.رقم_العقار));
    expect(idsAsc.indexOf('PR-2')).toBeLessThan(idsAsc.indexOf('PR-1'));

    const desc = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      sort: 'updated-desc',
    });
    const idsDesc = desc.items.map((x) => String(x?.property?.رقم_العقار));
    expect(idsDesc.indexOf('PR-1')).toBeLessThan(idsDesc.indexOf('PR-2'));

    const codeDesc = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      sort: 'code-desc',
    });
    expect(codeDesc.items[0]?.property?.الكود_الداخلي).toBeTruthy();
  });

  test('search matches guarantor name and owner phone digits', async () => {
    const g = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      query: 'كفيل',
    });
    expect(g.items.some((x) => String(x?.property?.رقم_العقار) === 'PR-1')).toBe(true);

    const digits = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      query: '98888777',
    });
    expect(digits.items.some((x) => String(x?.property?.رقم_العقار) === 'PR-1')).toBe(true);
  });

  test('pagination offset slices page', async () => {
    const p0 = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      sort: 'code-asc',
      offset: 0,
      limit: 1,
    });
    const p1 = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      sort: 'code-asc',
      offset: 1,
      limit: 1,
    });
    expect(p0.total).toBeGreaterThanOrEqual(3);
    expect(p0.items).toHaveLength(1);
    expect(p1.items).toHaveLength(1);
    expect(String(p0.items[0]?.property?.رقم_العقار)).not.toBe(
      String(p1.items[0]?.property?.رقم_العقار)
    );
  });
});

describe('contract memory fallback tabs and filters (desktop SQL fail + KV)', () => {
  beforeEach(() => {
    seedRichBranchesKvAndRebuild();
    (window as any).desktopDb = makeDesktopSqlFailBridge();
  });

  test('tab expiring, collection, expired, terminated, archived', async () => {
    const exp = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'expiring',
      offset: 0,
      limit: 20,
    });
    expect(exp.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-EXP')).toBe(true);

    const col = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'collection',
      offset: 0,
      limit: 20,
    });
    expect(col.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-COL')).toBe(true);

    const ex = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'expired',
      offset: 0,
      limit: 20,
    });
    expect(ex.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-EXPIRED')).toBe(true);

    const term = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'terminated',
      offset: 0,
      limit: 20,
    });
    expect(term.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-TERM')).toBe(true);

    const arch = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'archived',
      offset: 0,
      limit: 20,
    });
    expect(arch.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-ARCH')).toBe(true);
  });

  test('createdMonth and annual value rules', async () => {
    const byMonth = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      createdMonth: '2026-01',
      offset: 0,
      limit: 20,
    });
    expect(byMonth.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-ACTIVE')).toBe(true);
    expect(byMonth.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-OLDER')).toBe(false);

    const byValue = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      minValue: 20000,
      maxValue: 25000,
      offset: 0,
      limit: 20,
    });
    expect(byValue.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-ACTIVE')).toBe(true);
  });

  test('date range filters and sort modes', async () => {
    const between = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      startDateFrom: '2026-01-01',
      startDateTo: '2026-12-31',
      offset: 0,
      limit: 50,
    });
    expect(between.total).toBeGreaterThanOrEqual(1);

    const endBetween = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      endDateFrom: '2027-01-01',
      endDateTo: '2027-12-31',
      offset: 0,
      limit: 50,
    });
    expect(endBetween.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-ACTIVE')).toBe(
      true
    );

    const s1 = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      sort: 'created-asc',
      offset: 0,
      limit: 10,
    });
    expect(s1.items.length).toBeGreaterThanOrEqual(1);

    const s2 = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      sort: 'end-asc',
      offset: 0,
      limit: 10,
    });
    expect(s2.items.length).toBeGreaterThanOrEqual(1);

    const s3 = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      sort: 'end-desc',
      offset: 0,
      limit: 10,
    });
    expect(s3.items.length).toBeGreaterThanOrEqual(1);
  });

  test('digit search matches tenant national id', async () => {
    const r = await contractPickerSearchPagedSmart({
      query: '990011',
      tab: 'active',
      offset: 0,
      limit: 20,
    });
    expect(r.items.some((x) => String(x?.contract?.رقم_العقد) === 'C-ACTIVE')).toBe(true);
  });
});

describe('desktop migrate retry restores SQL', () => {
  test('propertyPickerSearchPagedSmart uses second SQL result after migrate', async () => {
    seedHydratedKvAndRebuild();
    const picker = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, message: 'temporary' })
      .mockResolvedValueOnce({
        ok: true,
        items: [{ property: { رقم_العقار: 'X1' } }],
        total: 1,
      });
    (window as any).desktopDb = makeBridge({
      domainPropertyPickerSearch: picker,
      domainMigrate: jest.fn().mockResolvedValue({}),
    });

    const r = await propertyPickerSearchPagedSmart({
      ...emptyPayload,
      query: '',
    });
    expect(picker).toHaveBeenCalledTimes(2);
    expect(r.total).toBe(1);
    expect(String(r.items[0]?.property?.رقم_العقار)).toBe('X1');
    expect(r.error).toBeUndefined();
  });

  test('installmentsContractsPagedSmart uses second SQL result after migrate', async () => {
    seedHydratedKvAndRebuild();
    const search = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, message: 'tmp' })
      .mockResolvedValueOnce({ ok: true, items: [], total: 0 });
    (window as any).desktopDb = makeBridge({
      domainInstallmentsContractsSearch: search,
      domainMigrate: jest.fn().mockResolvedValue({}),
    });
    await installmentsContractsPagedSmart({ query: '', offset: 0, limit: 10 });
    expect(search).toHaveBeenCalledTimes(2);
  });

  test('contractPickerSearchPagedSmart uses second SQL result after migrate', async () => {
    seedHydratedKvAndRebuild();
    const picker = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, message: 'temporary' })
      .mockResolvedValueOnce({
        ok: true,
        items: [{ contract: { رقم_العقد: 'Z9' } }],
        total: 1,
      });
    (window as any).desktopDb = makeBridge({
      domainContractPickerSearch: picker,
      domainMigrate: jest.fn().mockResolvedValue({}),
    });

    const r = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      offset: 0,
      limit: 10,
    });
    expect(picker).toHaveBeenCalledTimes(2);
    expect(String(r.items[0]?.contract?.رقم_العقد)).toBe('Z9');
  });

  test('propertyPickerSearchPagedSmart uses KV when IPC throws', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeBridge({
      domainPropertyPickerSearch: jest.fn().mockRejectedValue(new Error('ipc-down')),
    });
    const r = await propertyPickerSearchPagedSmart({ ...emptyPayload });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.error || '').toMatch(/ipc-down|احتياطي/);
  });

  test('contractPickerSearchPagedSmart uses KV when IPC throws', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeBridge({
      domainContractPickerSearch: jest.fn().mockRejectedValue(new Error('ipc-contract')),
    });
    const r = await contractPickerSearchPagedSmart({
      query: '',
      tab: 'active',
      offset: 0,
      limit: 10,
    });
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.error || '').toMatch(/ipc-contract|احتياطي/);
  });

  test('propertyPickerSearchPagedSmart ignores migrate failure and still uses memory', async () => {
    seedHydratedKvAndRebuild();
    (window as any).desktopDb = makeBridge({
      domainPropertyPickerSearch: jest.fn().mockResolvedValue({ ok: false, message: 'sql' }),
      domainMigrate: jest.fn().mockRejectedValue(new Error('migrate-boom')),
    });
    const r = await propertyPickerSearchPagedSmart({ ...emptyPayload });
    expect(r.items.length).toBeGreaterThan(0);
  });
});

describe('desktop bridge returns ok:false', () => {
  test('domainSearchGlobalSmart returns empty', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await domainSearchGlobalSmart('test');
    expect(r).toEqual({ people: [], properties: [], contracts: [] });
  });

  test('domainSearchSmart returns empty', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await domainSearchSmart('people', 'q');
    expect(r).toEqual([]);
  });

  test('propertyPickerSearchSmart falls back to domainSearchSmart', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await propertyPickerSearchSmart({ query: '' });
    expect(Array.isArray(r)).toBe(true);
  });

  test('propertyPickerSearchPagedSmart returns items+total', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await propertyPickerSearchPagedSmart({ query: '' });
    expect(r).toHaveProperty('items');
    expect(r).toHaveProperty('total');
  });

  test('contractPickerSearchSmart falls back', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await contractPickerSearchSmart({ query: '' });
    expect(Array.isArray(r)).toBe(true);
  });

  test('contractPickerSearchPagedSmart returns error when desktop fails', async () => {
    (window as any).desktopDb = makeBridge({
      domainContractPickerSearch: jest.fn().mockResolvedValue({ ok: false, message: 'SQL error' }),
    });
    const r = await contractPickerSearchPagedSmart({ query: 'x' });
    expect(r.error).toBeTruthy();
    expect(r.items).toEqual([]);
  });

  test('dashboardSummarySmart returns null', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await dashboardSummarySmart({ todayYMD: '2026-01-01', weekYMD: '2026-01-07' });
    expect(r).toBeNull();
  });

  test('dashboardPerformanceSmart returns null', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await dashboardPerformanceSmart({ monthKey: '2026-01', prevMonthKey: '2025-12' });
    expect(r).toBeNull();
  });

  test('dashboardHighlightsSmart returns null', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await dashboardHighlightsSmart({ todayYMD: '2026-01-01' });
    expect(r).toBeNull();
  });

  test('personDetailsSmart returns null for desktop failure', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await personDetailsSmart('P-1');
    expect(r).toBeNull();
  });
});

describe('desktop bridge throws exception', () => {
  test('domainSearchGlobalSmart returns empty on throw', async () => {
    (window as any).desktopDb = makeBridge({
      domainSearchGlobal: jest.fn().mockRejectedValue(new Error('crash')),
    });
    const r = await domainSearchGlobalSmart('q');
    expect(r).toEqual({ people: [], properties: [], contracts: [] });
  });

  test('domainSearchSmart returns empty on throw', async () => {
    (window as any).desktopDb = makeBridge({
      domainSearch: jest.fn().mockRejectedValue(new Error('crash')),
    });
    const r = await domainSearchSmart('contracts', 'q');
    expect(r).toEqual([]);
  });

  test('contractPickerSearchPagedSmart returns error on throw', async () => {
    (window as any).desktopDb = makeBridge({
      domainContractPickerSearch: jest.fn().mockRejectedValue(new Error('network')),
    });
    const r = await contractPickerSearchPagedSmart({ query: 'x' });
    expect(r.error).toContain('network');
  });

  test('dashboardSummarySmart returns null on throw', async () => {
    (window as any).desktopDb = makeBridge({
      domainDashboardSummary: jest.fn().mockRejectedValue(new Error('crash')),
    });
    const r = await dashboardSummarySmart({ todayYMD: '2026-01-01', weekYMD: '2026-01-07' });
    expect(r).toBeNull();
  });
});

describe('domainCountsSmart', () => {
  test('returns counts on success', async () => {
    (window as any).desktopDb = makeBridge({
      domainCounts: jest.fn().mockResolvedValue({
        ok: true, counts: { people: 5, properties: 3, contracts: 2 },
      }),
    });
    const r = await domainCountsSmart();
    expect(r?.people).toBe(5);
    expect(r?.properties).toBe(3);
  });

  test('retries with migrate when first call returns ok:false', async () => {
    const migrateCall = jest.fn().mockResolvedValue({});
    const countsCall = jest.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, counts: { people: 9, properties: 4, contracts: 1 } });

    (window as any).desktopDb = makeBridge({
      domainCounts: countsCall,
      domainMigrate: migrateCall,
    });
    const r = await domainCountsSmart();
    expect(migrateCall).toHaveBeenCalled();
    expect(r?.people).toBe(9);
  });

  test('returns null in non-desktop', async () => {
    const r = await domainCountsSmart();
    expect(r).toBeNull();
  });
});

describe('personDetailsSmart edge cases', () => {
  test('returns null for empty id', async () => {
    const r = await personDetailsSmart('');
    expect(r).toBeNull();
  });

  test('non-desktop fallback works', async () => {
    const r = await personDetailsSmart('NONEXISTENT');
    expect(r).toBeNull();
  });
});

describe('paymentNotificationTargetsSmart', () => {
  test('desktop success returns items', async () => {
    (window as any).desktopDb = makeBridge({
      domainPaymentNotificationTargets: jest.fn().mockResolvedValue({
        ok: true, items: [{ key: 'K1', tenantName: 'T1', contractId: 'C1', items: [] }],
      }),
    });
    const r = await paymentNotificationTargetsSmart({ daysAhead: 7 });
    expect(r).toHaveLength(1);
  });

  test('desktop fails returns null', async () => {
    (window as any).desktopDb = makeBridge();
    const r = await paymentNotificationTargetsSmart({ daysAhead: 7 });
    expect(r).toBeNull();
  });

  test('non-desktop returns array', async () => {
    const r = await paymentNotificationTargetsSmart({ daysAhead: 7 });
    expect(Array.isArray(r)).toBe(true);
  });
});
