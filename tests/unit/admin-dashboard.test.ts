import { 
  domainCountsSmart, 
  dashboardSummarySmart, 
  dashboardPerformanceSmart 
} from '@/services/domainQueries';

describe('Admin Dashboard Stats - Comprehensive Suite', () => {
  const desktopDbMock = {
    domainCounts: jest.fn(),
    domainDashboardSummary: jest.fn(),
    domainDashboardPerformance: jest.fn(),
  };

  beforeAll(() => {
    (window as any).desktopDb = desktopDbMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. Domain Counts
  test('domainCountsSmart - returns counts from desktop DB', async () => {
    desktopDbMock.domainCounts.mockResolvedValue({ 
      ok: true, 
      counts: { people: 10, properties: 20, contracts: 30 } 
    });
    
    const counts = await domainCountsSmart();
    expect(counts).toEqual({ people: 10, properties: 20, contracts: 30 });
    expect(desktopDbMock.domainCounts).toHaveBeenCalled();
  });

  // 2. Dashboard Summary
  test('dashboardSummarySmart - returns summary data correctly', async () => {
    const mockData = {
      totalPeople: 100,
      totalProperties: 50,
      occupiedProperties: 40,
      activeContracts: 80,
      revenueToday: 1500
    };
    desktopDbMock.domainDashboardSummary.mockResolvedValue({ ok: true, data: mockData });
    
    const summary = await dashboardSummarySmart({ todayYMD: '2025-01-01', weekYMD: '2025-01-07' });
    expect(summary?.totalPeople).toBe(100);
    expect(summary?.revenueToday).toBe(1500);
  });

  // 3. Performance Stats
  test('dashboardPerformanceSmart - returns collection stats', async () => {
    const mockPerf = {
      currentMonthCollections: 5000,
      previousMonthCollections: 4500,
      paidCountThisMonth: 10
    };
    desktopDbMock.domainDashboardPerformance.mockResolvedValue({ ok: true, data: mockPerf });
    
    const perf = await dashboardPerformanceSmart({ monthKey: '2025-01', prevMonthKey: '2024-12' });
    expect(perf?.currentMonthCollections).toBe(5000);
    expect(perf?.paidCountThisMonth).toBe(10);
  });

  // 4. Failure Handling
  test('dashboardSummarySmart - returns null on failure', async () => {
    desktopDbMock.domainDashboardSummary.mockResolvedValue({ ok: false });
    const summary = await dashboardSummarySmart({ todayYMD: 'any', weekYMD: 'any' });
    expect(summary).toBeNull();
  });

  test('dashboardPerformanceSmart - returns null on exception', async () => {
    desktopDbMock.domainDashboardPerformance.mockRejectedValue(new Error('DB Error'));
    const perf = await dashboardPerformanceSmart({ monthKey: 'any', prevMonthKey: 'any' });
    expect(perf).toBeNull();
  });
});
