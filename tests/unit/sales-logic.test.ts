import { createSalesListing, submitSalesOffer, updateSalesAgreement } from '../../src/services/db/sales';
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

describe('Sales Logic Real Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSalesListing', () => {
    test('updates property forsale status and prices', () => {
      (get as jest.Mock).mockImplementation((key) => {
        if (key === KEYS.SALES_LISTINGS) return [];
        if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'PROP-1', isForSale: false }];
        return [];
      });

      const result = createSalesListing({
        رقم_العقار: 'PROP-1',
        رقم_المالك: 'OWN-1',
        السعر_المطلوب: 50000,
        أقل_سعر_مقبول: 45000
      });

      expect(result.success).toBe(true);
      
      // Verify properties update
      const savedProps = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.PROPERTIES)[1];
      expect(savedProps[0].isForSale).toBe(true);
      expect(savedProps[0].salePrice).toBe(50000);
    });

    test('validates asking price is positive', () => {
      const result = createSalesListing({ رقم_العقار: 'P1', رقم_المالك: 'O1', السعر_المطلوب: 0 });
      expect(result.success).toBe(false);
      expect(result.message).toContain('السعر المطلوب');
    });
  });

  describe('submitSalesOffer', () => {
    test('prevents offer if agreement already exists for listing', () => {
      (get as jest.Mock).mockImplementation((key) => {
        if (key === KEYS.SALES_LISTINGS) return [{ id: 'LST-1', الحالة: 'Active' }];
        if (key === KEYS.SALES_AGREEMENTS) return [{ listingId: 'LST-1', isCompleted: false }];
        return [];
      });

      const result = submitSalesOffer({ listingId: 'LST-1', رقم_المشتري: 'B1', قيمة_العرض: 48000 });
      expect(result.success).toBe(false);
      expect(result.message).toContain('اتفاقية قيد الإجراء');
    });
  });

  describe('updateSalesAgreement', () => {
    test('calculates expenses and commissions correctly', () => {
      const existing = [{
        id: 'AG-1',
        السعر_النهائي: 100000,
        عمولة_المشتري: 0,
        عمولة_البائع: 0,
        isCompleted: false
      }];
      (get as jest.Mock).mockImplementation((key) => {
        if (key === KEYS.SALES_AGREEMENTS) return existing;
        if (key === KEYS.EXTERNAL_COMMISSIONS) return [];
        return [];
      });

      const result = updateSalesAgreement('AG-1', { قيمة_الدفعة_الاولى: 20000 }, {
        buyer: 2000,
        seller: 2000,
        expenses: { رسوم_التنازل: 5000, ضريبة_الابنية: 1000 } as any
      });

      expect(result.success).toBe(true);
      const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.SALES_AGREEMENTS)[1][0];
      expect(saved.إجمالي_المصاريف).toBe(6000);
      expect(saved.إجمالي_العمولات).toBe(4000);
      expect(saved.قيمة_المتبقي).toBe(80000);
    });
  });
});
