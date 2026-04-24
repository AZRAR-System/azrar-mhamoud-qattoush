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
  removeFromBlacklistSmart
} from '@/services/domainQueries';
import { DbService } from '@/services/mockDb';

describe('Domain Queries Service - Smart Bridge Suite', () => {
  const mockDesktopDb = {
    domainSearchGlobal: jest.fn(),
    domainSearch: jest.fn(),
    domainPropertyPickerSearch: jest.fn(),
    domainContractPickerSearch: jest.fn(),
    domainCounts: jest.fn(),
    domainDashboardSummary: jest.fn(),
    domainPersonDetails: jest.fn(),
    domainContractDetails: jest.fn(),
    domainSalesForPerson: jest.fn(),
    domainBlacklistRemove: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
  };

  beforeAll(() => {
    // @ts-ignore
    window.desktopDb = mockDesktopDb;
  });

  afterAll(() => {
    // @ts-ignore
    delete window.desktopDb;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('domainSearchGlobalSmart - calls desktopDb when available', async () => {
    mockDesktopDb.domainSearchGlobal.mockResolvedValue({
      ok: true,
      people: [{ id: 'P1' }],
      properties: [],
      contracts: []
    });

    const res = await domainSearchGlobalSmart('test');
    expect(mockDesktopDb.domainSearchGlobal).toHaveBeenCalledWith('test');
    expect(res.people).toHaveLength(1);
  });

  test('domainSearchSmart - calls desktopDb and returns items', async () => {
    mockDesktopDb.domainSearch.mockResolvedValue({
      ok: true,
      items: [{ id: 'X1' }]
    });

    const res = await domainSearchSmart('people', 'query');
    expect(mockDesktopDb.domainSearch).toHaveBeenCalledWith({ entity: 'people', query: 'query', limit: 50 });
    expect(res).toHaveLength(1);
  });

  test('propertyPickerSearchSmart - calls desktopDb', async () => {
    mockDesktopDb.domainPropertyPickerSearch.mockResolvedValue({
      ok: true,
      items: [{ property: { id: 'PR1' } }]
    });

    const res = await propertyPickerSearchSmart({ query: 'prop' });
    expect(mockDesktopDb.domainPropertyPickerSearch).toHaveBeenCalledWith({ query: 'prop' });
    expect(res).toHaveLength(1);
  });

  test('contractPickerSearchSmart - calls desktopDb', async () => {
    mockDesktopDb.domainContractPickerSearch.mockResolvedValue({
      ok: true,
      items: [{ contract: { id: 'C1' } }]
    });

    const res = await contractPickerSearchSmart({ query: 'cont' });
    expect(mockDesktopDb.domainContractPickerSearch).toHaveBeenCalledWith({ query: 'cont' });
    expect(res).toHaveLength(1);
  });

  test('domainCountsSmart - calls desktopDb', async () => {
    mockDesktopDb.domainCounts.mockResolvedValue({
      ok: true,
      counts: { people: 10, properties: 5, contracts: 2 }
    });

    const res = await domainCountsSmart();
    expect(res?.people).toBe(10);
  });

  test('dashboardSummarySmart - calls desktopDb', async () => {
    const payload = { todayYMD: '2020-01-01', weekYMD: '2020-01-07' };
    mockDesktopDb.domainDashboardSummary.mockResolvedValue({
      ok: true,
      data: { totalPeople: 100 }
    });

    const res = await dashboardSummarySmart(payload);
    expect(res?.totalPeople).toBe(100);
  });

  test('personDetailsSmart - calls desktopDb', async () => {
    mockDesktopDb.domainPersonDetails.mockResolvedValue({
      ok: true,
      data: { person: { رقم_الشخص: 'P1' } }
    });

    const res = await personDetailsSmart('P1');
    expect(res?.person?.رقم_الشخص).toBe('P1');
  });

  test('contractDetailsSmart - calls desktopDb', async () => {
    mockDesktopDb.domainContractDetails.mockResolvedValue({
      ok: true,
      data: { contract: { رقم_العقد: 'C1' } }
    });

    const res = await contractDetailsSmart('C1');
    expect(res?.contract?.رقم_العقد).toBe('C1');
  });

  test('salesForPersonSmart - calls desktopDb', async () => {
    mockDesktopDb.domainSalesForPerson.mockResolvedValue({
      ok: true,
      listings: [{}],
      agreements: []
    });

    const res = await salesForPersonSmart('P1');
    expect(res?.listings).toHaveLength(1);
  });

  test('removeFromBlacklistSmart - calls desktopDb', async () => {
    mockDesktopDb.domainBlacklistRemove.mockResolvedValue({
      ok: true,
      message: 'Success'
    });

    const res = await removeFromBlacklistSmart('P1');
    expect(res.success).toBe(true);
    expect(res.message).toBe('Success');
  });

  test('Non-desktop fallback - domainSearchGlobalSmart', async () => {
    // @ts-ignore
    delete window.desktopDb;
    
    const spy = jest.spyOn(DbService, 'searchGlobal').mockReturnValue({
      people: [], properties: [], contracts: []
    });

    await domainSearchGlobalSmart('test');
    expect(spy).toHaveBeenCalledWith('test');
    
    // Restore for other tests
    // @ts-ignore
    window.desktopDb = mockDesktopDb;
  });
});
