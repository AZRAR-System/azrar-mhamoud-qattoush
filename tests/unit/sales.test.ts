import { jest } from '@jest/globals';
import { DbService } from '@/services/mockDb';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Sales Service Logic - Fixed', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.SALES_LISTINGS, []);
    save(KEYS.SALES_OFFERS, []);
    save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR-SALE', الكود_الداخلي: 'S1', IsRented: false, رقم_المالك: 'OLD_OWNER' }]);
  });

  it('addSalesListing: should create a listing and persist it', () => {
    const res = DbService.addSalesListing({
      رقم_العقار: 'PR-SALE',
      السعر_المطلوب: 100000,
      ملاحظات: 'Ready for view'
    } as any);

    expect(res.success).toBe(true);
    expect(DbService.getSalesListings()).toHaveLength(1);
  });

  it('submitSalesOffer: should record a buyer offer linked to listing', () => {
    save(KEYS.SALES_LISTINGS, [{ id: 'L1', رقم_العقار: 'PR-SALE', الحالة: 'Active' }]);
    
    const res = DbService.submitSalesOffer({
      listingId: 'L1',
      رقم_المشتري: 'P-BUYER',
      قيمة_العرض: 95000
    } as any);

    expect(res.success).toBe(true);
    expect(DbService.getSalesOffers()).toHaveLength(1);
  });

  it('finalizeOwnershipTransfer: should update property owner', async () => {
    save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR1', رقم_المالك: 'OLD_OWNER', الكود_الداخلي: 'S1' }]);
    save(KEYS.SALES_LISTINGS, [{ id: 'L1', رقم_العقار: 'PR1', رقم_المالك: 'OLD_OWNER', الحالة: 'Active' }]);
    save(KEYS.SALES_AGREEMENTS, [{ 
      id: 'AG1', 
      listingId: 'L1',
      رقم_المشتري: 'NEW_OWNER',
      رقم_العقار: 'PR1',
      isCompleted: false
    }]);

    // Implementation expects (id: string, data: { transactionId: string })
    const res = await DbService.finalizeOwnershipTransfer('AG1', { transactionId: 'TX1' });
    expect(res.success).toBe(true);

    const props = get<any[]>(KEYS.PROPERTIES);
    expect(props.find(p => p.رقم_العقار === 'PR1').رقم_المالك).toBe('NEW_OWNER');
  });
});
