import { 
  createSalesHandlers, 
  addSalesListing, 
  updateSalesListing,
  deleteSalesListing,
  submitSalesOffer, 
  updateOfferStatus,
  deleteSalesOffer,
  addSalesOfferNote,
  getOwnershipHistory
} from '@/services/db/system/sales_agreements';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Sales Agreements System Service - Real Estate Sales Suite', () => {
  const mockDeps = {
    logOperation: jest.fn(),
    getPersonRoles: jest.fn().mockReturnValue(['عميل']),
    updatePersonRoles: jest.fn(),
    terminateContract: jest.fn().mockReturnValue({ success: true }),
    upsertCommissionForSale: jest.fn().mockReturnValue({ success: true }),
  };

  const handlers = createSalesHandlers(mockDeps);

  const validProperty = (id: string) => ({
    رقم_العقار: id,
    الكود_الداخلي: 'UNIT-S1',
    رقم_المالك: 'O1',
    النوع: 'شقة', العنوان: 'A', حالة_العقار: 'شاغر', IsRented: false, المساحة: 10
  });

  beforeEach(() => {
    localStorage.clear();
    buildCache();
    jest.clearAllMocks();
    kv.save(KEYS.PROPERTIES, [validProperty('PR1')]);
    buildCache();
  });

  describe('Sales Listings Management', () => {
    test('deleteSalesListing - reverts property status if last listing', () => {
      const listing = addSalesListing({ رقم_العقار: 'PR1', السعر_المطلوب: 100 }).data!;
      expect(kv.get<any>(KEYS.PROPERTIES)[0].isForSale).toBe(true);
      
      deleteSalesListing(listing.id);
      expect(kv.get<any>(KEYS.PROPERTIES)[0].isForSale).toBe(false);
    });

    test('updateSalesListing - updates price and property sync', () => {
      const listing = addSalesListing({ رقم_العقار: 'PR1', السعر_المطلوب: 100 }).data!;
      updateSalesListing(listing.id, { السعر_المطلوب: 150 });
      expect(kv.get<any>(KEYS.PROPERTIES)[0].salePrice).toBe(150);
    });
  });

  describe('Sales Offers', () => {
    test('submitSalesOffer, updateStatus, and deleteOffer', () => {
      const listing = addSalesListing({ رقم_العقار: 'PR1', السعر_المطلوب: 100 }).data!;
      const offer = submitSalesOffer({ listingId: listing.id, رقم_المشتري: 'P2', قيمة_العرض: 90 }).data!;
      
      expect(offer.الحالة).toBe('Pending');
      updateOfferStatus(offer.id, 'Accepted');
      expect(kv.get<any>(KEYS.SALES_OFFERS)[0].الحالة).toBe('Accepted');

      deleteSalesOffer(offer.id);
      expect(kv.get<any>(KEYS.SALES_OFFERS)).toHaveLength(0);
    });

    test('addSalesOfferNote - appends timestamped notes', () => {
      const listing = addSalesListing({ رقم_العقار: 'PR1', السعر_المطلوب: 100 }).data!;
      const offer = submitSalesOffer({ listingId: listing.id, رقم_المشتري: 'P2', قيمة_العرض: 90 }).data!;
      addSalesOfferNote(offer.id, 'Counter offered 95');
      const stored = kv.get<any>(KEYS.SALES_OFFERS)[0];
      expect(stored.ملاحظات_التفاوض).toContain('Counter offered 95');
    });
  });

  describe('Agreements and Transfers', () => {
    test('addSalesAgreement - persists and syncs commission', () => {
      const res = handlers.addSalesAgreement({
        listingId: 'L1',
        رقم_المشتري: 'P2',
        رقم_العقار: 'PR1',
        السعر_النهائي: 45000,
        عمولة_البائع: 1000
      });

      expect(res.success).toBe(true);
      expect(mockDeps.upsertCommissionForSale).toHaveBeenCalled();
    });

    test('finalizeOwnershipTransfer - full flow including role management', () => {
      // 1. Setup Data
      kv.save(KEYS.PROPERTIES, [{ 
        رقم_العقار: 'PR1', الكود_الداخلي: 'U1', رقم_المالك: 'OLD_O', 
        النوع: 'شقة', العنوان: 'A', حالة_العقار: 'شاغر', IsRented: false, المساحة: 10 
      }]);
      const listing = addSalesListing({ رقم_العقار: 'PR1' }).data!;
      const agreement = handlers.addSalesAgreement({ 
        listingId: listing.id, رقم_المشتري: 'NEW_O', رقم_العقار: 'PR1' 
      }).data!;
      
      // 2. Setup Attachments (required for transfer)
      kv.save(KEYS.ATTACHMENTS, [
        { referenceType: 'Property', referenceId: 'PR1', id: 'A1', name: 'N1' },
        { referenceType: 'Person', referenceId: 'NEW_O', id: 'A2', name: 'N2' }
      ]);

      // 3. Setup active contract (should be terminated)
      kv.save(KEYS.CONTRACTS, [{ 
        رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'T1',
        تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2025-01-01',
        مدة_العقد_بالاشهر: 60, القيمة_السنوية: 1000, تكرار_الدفع: 1, طريقة_الدفع: 'X',
        حالة_العقد: 'نشط', isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
      }]);

      // 4. Exec
      const res = handlers.finalizeOwnershipTransfer(agreement.id, { transactionId: 'TX-100' });
      
      expect(res.success).toBe(true);
      expect(kv.get<any>(KEYS.PROPERTIES)[0].رقم_المالك).toBe('NEW_O');
      expect(mockDeps.terminateContract).toHaveBeenCalledWith('C1', expect.any(String), expect.any(String));
      expect(mockDeps.updatePersonRoles).toHaveBeenCalledWith('NEW_O', expect.arrayContaining(['مالك']));
      
      const history = getOwnershipHistory('PR1');
      expect(history).toHaveLength(1);
      expect(history[0].رقم_المعاملة).toBe('TX-100');
    });
  });
});
