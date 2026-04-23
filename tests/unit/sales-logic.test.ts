import { 
  createSalesListing, 
  cancelOpenSalesListingsForProperty, 
  submitSalesOffer, 
  updateOfferStatus,
  createSalesAgreement,
  updateSalesAgreement,
  deleteSalesAgreement
} from '../../src/services/db/sales';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/services/localDbStorage', () => ({
  dbOk: (data?: any, msg?: string) => ({ success: true, data, message: msg }),
  dbFail: (msg: string) => ({ success: false, message: msg }),
}));

describe('Sales Logic - Comprehensive Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Create Listing
  test('createSalesListing - creates listing and updates property forSale status', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1', isForSale: false }];
      if (key === KEYS.SALES_LISTINGS) return [];
      return [];
    });

    const res = createSalesListing({ رقم_العقار: 'P1', رقم_المالك: 'O1', السعر_المطلوب: 100000 });
    expect(res.success).toBe(true);
    
    const savedProps = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.PROPERTIES)[1];
    expect(savedProps[0].isForSale).toBe(true);
    expect(savedProps[0].salePrice).toBe(100000);
  });

  // 2. Cancel Listing
  test('cancelOpenSalesListingsForProperty - marks active listings as Cancelled', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.SALES_LISTINGS) return [{ id: 'L1', رقم_العقار: 'P1', الحالة: 'Active' }];
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1', isForSale: true }];
      return [];
    });

    const res = cancelOpenSalesListingsForProperty('P1');
    expect(res.success).toBe(true);
    expect(res.data.cancelled).toBe(1);
    
    const savedListings = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.SALES_LISTINGS)[1];
    expect(savedListings[0].الحالة).toBe('Cancelled');
  });

  // 3. Submit Offer
  test('submitSalesOffer - adds new offer to listing', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.SALES_LISTINGS) return [{ id: 'L1', الحالة: 'Active' }];
      if (key === KEYS.SALES_OFFERS) return [];
      if (key === KEYS.SALES_AGREEMENTS) return [];
      return [];
    });

    const res = submitSalesOffer({ listingId: 'L1', رقم_المشتري: 'B1', قيمة_العرض: 95000 });
    expect(res.success).toBe(true);
    
    const savedOffers = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.SALES_OFFERS)[1];
    expect(savedOffers[0].رقم_المشتري).toBe('B1');
  });

  // 4. Accept Offer
  test('updateOfferStatus - accepting offer rejects others and sets listing to Pending', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.SALES_OFFERS) return [
        { id: 'O1', listingId: 'L1', الحالة: 'Pending' },
        { id: 'O2', listingId: 'L1', الحالة: 'Pending' }
      ];
      if (key === KEYS.SALES_LISTINGS) return [{ id: 'L1', الحالة: 'Active' }];
      return [];
    });

    const res = updateOfferStatus('O1', 'Accepted');
    expect(res.success).toBe(true);
    
    const savedOffers = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.SALES_OFFERS)[1];
    expect(savedOffers.find((o: any) => o.id === 'O1').الحالة).toBe('Accepted');
    expect(savedOffers.find((o: any) => o.id === 'O2').الحالة).toBe('Rejected');
    
    const savedListings = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.SALES_LISTINGS)[1];
    expect(savedListings[0].الحالة).toBe('Pending');
  });

  // 5. Create Agreement
  test('createSalesAgreement - creates agreement and calculates commissions and expenses', () => {
    (get as jest.Mock).mockReturnValue([]);
    const listing = { id: 'L1', رقم_العقار: 'P1', رقم_المالك: 'O1' };
    const commissions = { 
      buyer: 2000, 
      seller: 2000, 
      external: 500, 
      expenses: { رسوم_التنازل: 1000, ضريبة_الابنية: 500 } 
    };
    
    const res = createSalesAgreement({ listingId: 'L1', رقم_المشتري: 'B1', السعر_النهائي: 100000 } as any, listing as any, commissions as any);
    expect(res.success).toBe(true);
    
    const savedAgreements = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.SALES_AGREEMENTS)[1];
    expect(savedAgreements[0].إجمالي_العمولات).toBe(4500);
    expect(savedAgreements[0].إجمالي_المصاريف).toBe(1500);
  });

  // 6. Update Agreement
  test('updateSalesAgreement - recalculates totals on patch', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.SALES_AGREEMENTS) return [{ id: 'A1', السعر_النهائي: 100000, قيمة_الدفعة_الاولى: 10000, isCompleted: false }];
      if (key === KEYS.EXTERNAL_COMMISSIONS) return [];
      return [];
    });

    const res = updateSalesAgreement('A1', { قيمة_الدفعة_الاولى: 20000 });
    expect(res.success).toBe(true);
    
    const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.SALES_AGREEMENTS)[1];
    expect(saved[0].قيمة_المتبقي).toBe(80000);
  });

  // 7. Delete Agreement
  test('deleteSalesAgreement - reverts listing status to Active if no other active agreements', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.SALES_AGREEMENTS) return [{ id: 'A1', listingId: 'L1', isCompleted: false }];
      if (key === KEYS.SALES_LISTINGS) return [{ id: 'L1', الحالة: 'Pending' }];
      if (key === KEYS.SALES_OFFERS) return [];
      if (key === KEYS.EXTERNAL_COMMISSIONS) return [];
      return [];
    });

    const res = deleteSalesAgreement('A1');
    expect(res.success).toBe(true);
    
    const savedListings = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.SALES_LISTINGS)[1];
    expect(savedListings[0].الحالة).toBe('Active');
  });

  test('createSalesListing - updates existing listing if already present', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.SALES_LISTINGS) return [{ id: 'L1', رقم_العقار: 'P1', الحالة: 'Active' }];
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1' }];
      return [];
    });

    const res = createSalesListing({ رقم_العقار: 'P1', رقم_المالك: 'O1', السعر_المطلوب: 120000 });
    expect(res.success).toBe(true);
    expect(res.message).toContain('تحديث');
    
    const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.SALES_LISTINGS)[1];
    expect(saved[0].السعر_المطلوب).toBe(120000);
  });

  test('createSalesListing - fails on invalid price', () => {
    const res = createSalesListing({ رقم_العقار: 'P1', رقم_المالك: 'O1', السعر_المطلوب: 0 });
    expect(res.success).toBe(false);
    expect(res.message).toContain('السعر المطلوب');
  });
});
