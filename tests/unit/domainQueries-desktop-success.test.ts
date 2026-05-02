import {
  addFollowUpSmart,
  contractDetailsSmart,
  domainGetSmart,
  dashboardHighlightsSmart,
  dashboardPerformanceSmart,
  dashboardSummarySmart,
  deleteInspectionSmart,
  deletePersonSmart,
  deleteSalesAgreementSmart,
  domainSearchGlobalSmart,
  domainSearchSmart,
  ownershipHistorySmart,
  personDetailsSmart,
  personTenancyContractsSmart,
  propertyInspectionsSmart,
  removeFromBlacklistSmart,
  salesForPersonSmart,
  propertyContractsSmart,
  salesForPropertySmart,
  updatePropertySmart,
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
  domainPersonTenancyContracts: jest.fn().mockResolvedValue({ ok: false }),
  domainContractDetails: jest.fn().mockResolvedValue({ ok: false }),
  domainOwnershipHistory: jest.fn().mockResolvedValue({ ok: false }),
  domainPropertyInspections: jest.fn().mockResolvedValue({ ok: false }),
  domainSalesForPerson: jest.fn().mockResolvedValue({ ok: false }),
  domainSalesForProperty: jest.fn().mockResolvedValue({ ok: false }),
  domainBlacklistRemove: jest.fn().mockResolvedValue({ ok: false }),
  domainPeopleDelete: jest.fn().mockResolvedValue({ ok: false }),
  domainPropertyUpdate: jest.fn().mockResolvedValue({ ok: false }),
  domainInspectionDelete: jest.fn().mockResolvedValue({ ok: false }),
  domainFollowUpAdd: jest.fn().mockResolvedValue({ ok: false }),
  domainSalesAgreementDelete: jest.fn().mockResolvedValue({ ok: false }),
  domainGet: jest.fn().mockResolvedValue({ ok: false }),
  domainPropertyContracts: jest.fn().mockResolvedValue({ ok: false }),
  set: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  keys: jest.fn(),
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

describe('desktop IPC success branches', () => {
  test('domainSearchGlobalSmart maps partial payload defensively', async () => {
    (window as any).desktopDb = makeBridge({
      domainSearchGlobal: jest.fn().mockResolvedValue({
        ok: true,
        people: [{ رقم_الشخص: 'P1', الاسم: 'Ali' }],
        properties: [],
        contracts: [{ رقم_العقد: 'C1', حالة_العقد: 'نشط' }],
      }),
    });
    const r = await domainSearchGlobalSmart('x');
    expect(r.people).toHaveLength(1);
    expect(r.properties).toEqual([]);
    expect(r.contracts).toHaveLength(1);
  });

  test('domainSearchSmart returns items on desktop success', async () => {
    (window as any).desktopDb = makeBridge({
      domainSearch: jest.fn().mockResolvedValue({
        ok: true,
        items: [{ رقم_الشخص: 'P2', الاسم: 'Bob' }],
      }),
    });
    const r = await domainSearchSmart('people', 'b', 10);
    expect(r).toHaveLength(1);
    expect(String((r[0] as { الاسم?: string })?.الاسم)).toBe('Bob');
  });

  test('dashboardSummarySmart returns data object', async () => {
    const data = {
      totalPeople: 1,
      totalProperties: 2,
      occupiedProperties: 0,
      totalContracts: 0,
      activeContracts: 0,
      dueNext7Payments: 0,
      paymentsToday: 0,
      revenueToday: 0,
      contractsExpiring30: 0,
      maintenanceOpen: 0,
      propertyTypeCounts: [],
      contractStatusCounts: [],
    };
    (window as any).desktopDb = makeBridge({
      domainDashboardSummary: jest.fn().mockResolvedValue({ ok: true, data }),
    });
    const r = await dashboardSummarySmart({ todayYMD: '2026-05-01', weekYMD: '2026-05-07' });
    expect(r?.totalPeople).toBe(1);
    expect(r?.totalProperties).toBe(2);
  });

  test('dashboardPerformanceSmart returns data object', async () => {
    const data = {
      currentMonthCollections: 100,
      previousMonthCollections: 50,
      paidCountThisMonth: 0,
      dueUnpaidThisMonth: 0,
    };
    (window as any).desktopDb = makeBridge({
      domainDashboardPerformance: jest.fn().mockResolvedValue({ ok: true, data }),
    });
    const r = await dashboardPerformanceSmart({ monthKey: '2026-05', prevMonthKey: '2026-04' });
    expect(r).toEqual(expect.objectContaining(data));
  });

  test('dashboardHighlightsSmart returns data object', async () => {
    const data = {
      dueInstallmentsToday: [],
      expiringContracts: [],
      incompleteProperties: [],
    };
    (window as any).desktopDb = makeBridge({
      domainDashboardHighlights: jest.fn().mockResolvedValue({ ok: true, data }),
    });
    const r = await dashboardHighlightsSmart({ todayYMD: '2026-05-02' });
    expect(r?.dueInstallmentsToday).toEqual([]);
  });

  test('personDetailsSmart returns desktop payload', async () => {
    const data = { person: { رقم_الشخص: 'P9', الاسم: 'Sam' } };
    (window as any).desktopDb = makeBridge({
      domainPersonDetails: jest.fn().mockResolvedValue({ ok: true, data }),
    });
    const r = await personDetailsSmart('P9');
    expect(r).toEqual(data);
  });

  test('personTenancyContractsSmart returns desktop items', async () => {
    const items = [
      {
        contract: { رقم_العقد: 'C9', رقم_المستاجر: 'P9', رقم_العقار: 'PR9' },
        propertyCode: 'PC',
      },
    ];
    (window as any).desktopDb = makeBridge({
      domainPersonTenancyContracts: jest.fn().mockResolvedValue({ ok: true, items }),
    });
    const r = await personTenancyContractsSmart('P9');
    expect(r).toHaveLength(1);
    expect(String(r?.[0]?.contract?.رقم_العقد)).toBe('C9');
  });

  test('contractDetailsSmart returns desktop data', async () => {
    const data = { contract: { رقم_العقد: 'CZ' }, installments: [] };
    (window as any).desktopDb = makeBridge({
      domainContractDetails: jest.fn().mockResolvedValue({ ok: true, data }),
    });
    const r = await contractDetailsSmart('CZ');
    expect(r).toEqual(data);
  });

  test('ownershipHistorySmart returns desktop items', async () => {
    (window as any).desktopDb = makeBridge({
      domainOwnershipHistory: jest.fn().mockResolvedValue({ ok: true, items: [{ id: 1 }] }),
    });
    const r = await ownershipHistorySmart({ personId: 'P1' });
    expect(r).toEqual([{ id: 1 }]);
  });

  test('propertyInspectionsSmart returns desktop items', async () => {
    (window as any).desktopDb = makeBridge({
      domainPropertyInspections: jest.fn().mockResolvedValue({ ok: true, items: [{ k: 1 }] }),
    });
    const r = await propertyInspectionsSmart('PR-9');
    expect(r).toEqual([{ k: 1 }]);
  });

  test('salesForPersonSmart maps listings and agreements', async () => {
    (window as any).desktopDb = makeBridge({
      domainSalesForPerson: jest.fn().mockResolvedValue({
        ok: true,
        listings: [{ id: 'L1' }],
        agreements: [{ id: 'A1' }],
      }),
    });
    const r = await salesForPersonSmart('P1');
    expect(r?.listings).toHaveLength(1);
    expect(r?.agreements).toHaveLength(1);
  });

  test('salesForPropertySmart maps listings and agreements', async () => {
    (window as any).desktopDb = makeBridge({
      domainSalesForProperty: jest.fn().mockResolvedValue({
        ok: true,
        listings: [],
        agreements: [{ id: 'AG' }],
      }),
    });
    const r = await salesForPropertySmart('PR-1');
    expect(r?.agreements).toHaveLength(1);
  });

  test('removeFromBlacklistSmart uses IPC message when provided', async () => {
    (window as any).desktopDb = makeBridge({
      domainBlacklistRemove: jest.fn().mockResolvedValue({ ok: true, message: 'OK' }),
    });
    const r = await removeFromBlacklistSmart('P1');
    expect(r.success).toBe(true);
    expect(r.message).toBe('OK');
  });

  test('deletePersonSmart updatePropertySmart deleteInspectionSmart use asSimpleResult', async () => {
    (window as any).desktopDb = makeBridge({
      domainPeopleDelete: jest.fn().mockResolvedValue({ ok: true, message: '' }),
      domainPropertyUpdate: jest.fn().mockResolvedValue({ ok: false, message: 'bad patch' }),
      domainInspectionDelete: jest.fn().mockResolvedValue({ ok: true }),
    });
    expect((await deletePersonSmart('P1')).success).toBe(true);
    expect((await updatePropertySmart('PR', { x: 1 })).success).toBe(false);
    expect((await deleteInspectionSmart('IN1')).success).toBe(true);
  });

  test('domainGetSmart and propertyContractsSmart return IPC payloads', async () => {
    (window as any).desktopDb = makeBridge({
      domainGet: jest.fn().mockResolvedValue({
        ok: true,
        data: { رقم_الشخص: 'Z1', الاسم: 'FromIPC' },
      }),
      domainPropertyContracts: jest.fn().mockResolvedValue({
        ok: true,
        items: [{ contract: { رقم_العقد: 'K1' }, tenantName: 'T' }],
      }),
    });
    const g = await domainGetSmart('people', 'Z1');
    expect(String((g as { الاسم?: string })?.الاسم)).toBe('FromIPC');

    const pc = await propertyContractsSmart('PR-1', 10);
    expect(pc?.length).toBe(1);
    expect(String(pc?.[0]?.contract?.رقم_العقد)).toBe('K1');
  });

  test('addFollowUpSmart and deleteSalesAgreementSmart', async () => {
    (window as any).desktopDb = makeBridge({
      domainFollowUpAdd: jest.fn().mockResolvedValue({ ok: true, message: 'saved' }),
      domainSalesAgreementDelete: jest.fn().mockResolvedValue({ ok: false, message: 'nope' }),
    });
    expect((await addFollowUpSmart({ title: 't' })).message).toBe('saved');
    expect((await deleteSalesAgreementSmart('SA1')).success).toBe(false);
    expect((await deleteSalesAgreementSmart('SA1')).message).toBe('nope');
  });
});
