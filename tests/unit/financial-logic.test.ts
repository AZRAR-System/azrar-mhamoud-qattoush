import { 
  updateCommission, 
  upsertCommissionForContract, 
  upsertCommissionForSale,
  postponeCommissionCollection,
  deleteCommission,
  getFinancialAlerts
} from '../../src/services/db/financial';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/services/localDbStorage', () => ({
  dbOk: (data?: any) => ({ success: true, data }),
  dbFail: (msg: string) => ({ success: false, message: msg }),
}));

describe('Financial Logic - Comprehensive Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Update Rent Commission
  test('updateCommission - recalculates total for rent commission', () => {
    const existing = [{
      رقم_العمولة: 'COM-1',
      نوع_العمولة: 'Rent',
      عمولة_المالك: 100,
      عمولة_المستأجر: 50,
      المجموع: 150
    }];
    (get as jest.Mock).mockReturnValue(existing);
    const result = updateCommission('COM-1', { عمولة_المالك: 200 });
    expect(result.success).toBe(true);
    expect((result.data as any).المجموع).toBe(250);
  });

  // 2. Update Sale Commission
  test('updateCommission - recalculates total for sale commission', () => {
    const existing = [{
      رقم_العمولة: 'COM-SALE-1',
      نوع_العمولة: 'Sale',
      عمولة_البائع: 1000,
      عمولة_المشتري: 1000,
      يوجد_ادخال_عقار: true,
      عمولة_إدخال_عقار: 100,
      المجموع: 2000,
    }];
    (get as jest.Mock).mockReturnValue(existing);
    const result = updateCommission('COM-SALE-1', { عمولة_المشتري: 2000 });
    expect(result.success).toBe(true);
    expect((result.data as any).المجموع).toBe(3000);
    expect((result.data as any).عمولة_إدخال_عقار).toBe(150);
  });

  // 3. Upsert Contract Commission (New)
  test('upsertCommissionForContract - creates new commission record', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'COT-1' }];
      if (key === KEYS.COMMISSIONS) return [];
      return [];
    });
    const result = upsertCommissionForContract('COT-1', { commOwner: 150, commTenant: 75 });
    expect(result.success).toBe(true);
    expect((result.data as any).المجموع).toBe(225);
  });

  // 4. Upsert Sale Commission (Sync Legacy)
  test('upsertCommissionForSale - parties total excludes intro; intro is 5% for employee only', () => {
    (get as jest.Mock).mockReturnValue([]);
    const result = upsertCommissionForSale('AG-1', { sellerComm: 500, buyerComm: 300, listingComm: 50 });
    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.عمولة_المالك).toBe(500);
    expect(data.المجموع).toBe(800);
    expect(data.عمولة_إدخال_عقار).toBe(40);
    expect(data.يوجد_ادخال_عقار).toBe(true);
  });

  // 5. Postpone Collection
  test('postponeCommissionCollection - updates dates and month key correctly', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_العمولة: 'COM-1', تاريخ_تحصيل_مؤجل: '2025-01-01' }]);
    const result = postponeCommissionCollection('COM-1', '2025-06-15');
    expect(result.success).toBe(true);
    expect((result.data as any).تاريخ_تحصيل_مؤجل).toBe('2025-06-15');
    expect((result.data as any).شهر_دفع_العمولة).toBe('2025-06');
  });

  // 6. Delete Commission
  test('deleteCommission - removes commission from storage', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_العمولة: 'COM-1' }, { رقم_العمولة: 'COM-2' }]);
    const result = deleteCommission('COM-1');
    expect(result.success).toBe(true);
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved).toHaveLength(1);
    expect(saved[0].رقم_العمولة).toBe('COM-2');
  });

  // 7. Financial Alerts
  test('getFinancialAlerts - returns only unread financial alerts', () => {
    const alerts = [
      { category: 'Financial', تم_القراءة: false, id: 'A1' },
      { category: 'Financial', تم_القراءة: true, id: 'A2' },
      { category: 'Operational', تم_القراءة: false, id: 'A3' }
    ];
    (get as jest.Mock).mockReturnValue(alerts);
    const res = getFinancialAlerts();
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('A1');
  });

  // 8. Error Handling - Non-Existent Update
  test('updateCommission - returns error if id not found', () => {
    (get as jest.Mock).mockReturnValue([]);
    const result = updateCommission('NON-EXISTENT', { عمولة_المالك: 100 });
    expect(result.success).toBe(false);
    expect(result.message).toContain('غير موجودة');
  });
});
