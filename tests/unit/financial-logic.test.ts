import { updateCommission, upsertCommissionForContract, upsertCommissionForSale } from '../../src/services/db/financial';
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

describe('Financial Logic Real Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateCommission', () => {
    test('recalculates total for rent commission', () => {
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
      expect((result.data as any).المجموع).toBe(250); // 200 + 50
    });

    test('recalculates total for sale commission', () => {
      const existing = [{
        رقم_العمولة: 'COM-SALE-1',
        نوع_العمولة: 'Sale',
        عمولة_البائع: 1000,
        عمولة_المشتري: 1000,
        عمولة_إدخال_عقار: 500,
        المجموع: 2500
      }];
      (get as jest.Mock).mockReturnValue(existing);

      const result = updateCommission('COM-SALE-1', { عمولة_المشتري: 2000 });
      
      expect(result.success).toBe(true);
      expect((result.data as any).المجموع).toBe(3500); // 1000 + 2000 + 500
    });
  });

  describe('upsertCommissionForContract', () => {
    test('creates new commission if none exists', () => {
      (get as jest.Mock).mockImplementation((key) => {
        if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'COT-1' }];
        if (key === KEYS.COMMISSIONS) return [];
        return [];
      });

      const result = upsertCommissionForContract('COT-1', { commOwner: 150, commTenant: 75 });
      
      expect(result.success).toBe(true);
      expect((result.data as any).المجموع).toBe(225);
      expect(save).toHaveBeenCalledWith(KEYS.COMMISSIONS, expect.arrayContaining([
        expect.objectContaining({ رقم_العقد: 'COT-1', المجموع: 225 })
      ]));
    });
  });

  describe('upsertCommissionForSale', () => {
    test('correctly syncs legacy fields for sale agreements', () => {
      (get as jest.Mock).mockReturnValue([]);
      
      const result = upsertCommissionForSale('AG-1', {
        sellerComm: 500,
        buyerComm: 500,
        listingComm: 100
      });

      expect(result.success).toBe(true);
      const record = result.data as any;
      expect(record.عمولة_المالك).toBe(500); // Seller sync
      expect(record.عمولة_المستأجر).toBe(500); // Buyer sync
      expect(record.المجموع).toBe(1100);
    });
  });
});
