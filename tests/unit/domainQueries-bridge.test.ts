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

const makeDesktopSqlFailBridge = () =>
  makeBridge({
    domainContractPickerSearch: jest.fn().mockResolvedValue({ ok: false, message: 'SQL down' }),
    domainPeoplePickerSearch: jest.fn().mockResolvedValue({ ok: false, message: 'SQL down' }),
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
