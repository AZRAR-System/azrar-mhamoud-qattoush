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
} from '@/services/domainQueries';
import { buildCache } from '@/services/dbCache';

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
