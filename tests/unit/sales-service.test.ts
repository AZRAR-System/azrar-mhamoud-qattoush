import {
  getSalesListings,
  createSalesListing,
  cancelOpenSalesListingsForProperty,
  getSalesOffers,
  submitSalesOffer,
  updateOfferStatus,
  getSalesAgreements,
  updateSalesAgreement,
  deleteSalesAgreement,
  createSalesAgreement,
} from '@/services/db/sales';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';
import { عروض_البيع_tbl, عروض_الشراء_tbl, اتفاقيات_البيع_tbl } from '@/types';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

const makeListing = (id = 'LST-1', status: any = 'Active'): عروض_البيع_tbl => ({
  id,
  رقم_العقار: 'PR-1',
  رقم_المالك: 'PER-1',
  السعر_المطلوب: 100000,
  أقل_سعر_مقبول: 90000,
  الحالة: status,
  تاريخ_العرض: '2026-01-01',
  نوع_البيع: 'Cash',
});

describe('createSalesListing', () => {
  test('fails without رقم_العقار', () => {
    expect(createSalesListing({ رقم_المالك: 'PER-1', السعر_المطلوب: 100000 }).success).toBe(false);
  });

  test('fails without رقم_المالك', () => {
    expect(createSalesListing({ رقم_العقار: 'PR-1', السعر_المطلوب: 100000 }).success).toBe(false);
  });

  test('fails when asking price is 0', () => {
    expect(createSalesListing({ رقم_العقار: 'PR-1', رقم_المالك: 'PER-1', السعر_المطلوب: 0 }).success).toBe(false);
  });

  test('fails when min price is negative', () => {
    expect(createSalesListing({ رقم_العقار: 'PR-1', رقم_المالك: 'PER-1', السعر_المطلوب: 100000, أقل_سعر_مقبول: -1 }).success).toBe(false);
  });

  test('creates new listing', () => {
    const r = createSalesListing({ رقم_العقار: 'PR-1', رقم_المالك: 'PER-1', السعر_المطلوب: 100000 });
    expect(r.success).toBe(true);
    expect(getSalesListings()).toHaveLength(1);
  });

  test('updates existing active listing for same property', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing()]);
    buildCache();
    const r = createSalesListing({ رقم_العقار: 'PR-1', رقم_المالك: 'PER-1', السعر_المطلوب: 120000 });
    expect(r.success).toBe(true);
    expect(getSalesListings()).toHaveLength(1);
    expect(getSalesListings()[0].السعر_المطلوب).toBe(120000);
  });

  test('updates property isForSale when property exists', () => {
    kv.save(KEYS.PROPERTIES, [{ 
      رقم_العقار: 'PR-1', 
      الكود_الداخلي: 'P1',
      رقم_المالك: 'PER-1',
      النوع: 'شقة',
      العنوان: 'عمان',
      حالة_العقار: 'شاغر',
      IsRented: false,
      المساحة: 100
    }]);
    buildCache();
    createSalesListing({ رقم_العقار: 'PR-1', رقم_المالك: 'PER-1', السعر_المطلوب: 100000 });
    const props = kv.get<any>(KEYS.PROPERTIES);
    expect(props[0].isForSale).toBe(true);
  });
});

describe('cancelOpenSalesListingsForProperty', () => {
  test('fails for empty propertyId', () => {
    expect(cancelOpenSalesListingsForProperty('').success).toBe(false);
  });

  test('cancels active listings', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing()]);
    buildCache();
    const r = cancelOpenSalesListingsForProperty('PR-1');
    expect(r.success).toBe(true);
    expect((r.data as any).cancelled).toBe(1);
    expect(getSalesListings()[0].الحالة).toBe('Cancelled');
  });

  test('returns 0 when no open listings', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing('LST-1', 'Sold')]);
    buildCache();
    const r = cancelOpenSalesListingsForProperty('PR-1');
    expect((r.data as any).cancelled).toBe(0);
  });
});

describe('getSalesOffers', () => {
  test('returns all offers when no listingId', () => {
    kv.save(KEYS.SALES_OFFERS, [{ id: 'OFF-1', listingId: 'LST-1' }, { id: 'OFF-2', listingId: 'LST-2' }]);
    buildCache();
    expect(getSalesOffers()).toHaveLength(2);
  });

  test('filters by listingId', () => {
    kv.save(KEYS.SALES_OFFERS, [{ id: 'OFF-1', listingId: 'LST-1' }, { id: 'OFF-2', listingId: 'LST-2' }]);
    buildCache();
    expect(getSalesOffers('LST-1')).toHaveLength(1);
  });
});

describe('submitSalesOffer', () => {
  test('fails without listingId', () => {
    expect(submitSalesOffer({ رقم_المشتري: 'B-1', قيمة_العرض: 100 }).success).toBe(false);
  });

  test('fails without رقم_المشتري', () => {
    expect(submitSalesOffer({ listingId: 'LST-1', قيمة_العرض: 100 }).success).toBe(false);
  });

  test('fails with invalid قيمة_العرض', () => {
    expect(submitSalesOffer({ listingId: 'LST-1', رقم_المشتري: 'B-1', قيمة_العرض: 0 }).success).toBe(false);
  });

  test('fails when listing not found', () => {
    expect(submitSalesOffer({ listingId: 'MISSING', رقم_المشتري: 'B-1', قيمة_العرض: 100 }).success).toBe(false);
  });

  test('fails when listing not active', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing('LST-1', 'Sold')]);
    buildCache();
    expect(submitSalesOffer({ listingId: 'LST-1', رقم_المشتري: 'B-1', قيمة_العرض: 100 }).success).toBe(false);
  });

  test('fails when existing agreement in progress', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing()]);
    kv.save(KEYS.SALES_AGREEMENTS, [{ id: 'AGR-1', listingId: 'LST-1', isCompleted: false }]);
    buildCache();
    expect(submitSalesOffer({ listingId: 'LST-1', رقم_المشتري: 'B-1', قيمة_العرض: 100 }).success).toBe(false);
  });

  test('submits successfully', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing()]);
    buildCache();
    const r = submitSalesOffer({ listingId: 'LST-1', رقم_المشتري: 'B-1', قيمة_العرض: 95000 });
    expect(r.success).toBe(true);
  });
});

describe('updateOfferStatus', () => {
  test('fails when offer not found', () => {
    expect(updateOfferStatus('MISSING', 'Accepted').success).toBe(false);
  });

  test('fails when listing not found', () => {
    kv.save(KEYS.SALES_OFFERS, [{ id: 'OFF-1', listingId: 'LST-MISSING', الحالة: 'Pending' }]);
    buildCache();
    expect(updateOfferStatus('OFF-1', 'Accepted').success).toBe(false);
  });

  test('fails when listing is sold', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing('LST-1', 'Sold')]);
    kv.save(KEYS.SALES_OFFERS, [{ id: 'OFF-1', listingId: 'LST-1', الحالة: 'Pending' }]);
    buildCache();
    expect(updateOfferStatus('OFF-1', 'Rejected').success).toBe(false);
  });

  test('accepts offer and rejects others', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing()]);
    kv.save(KEYS.SALES_OFFERS, [
      { id: 'OFF-1', listingId: 'LST-1', الحالة: 'Pending' },
      { id: 'OFF-2', listingId: 'LST-1', الحالة: 'Pending' },
    ]);
    buildCache();
    const r = updateOfferStatus('OFF-1', 'Accepted' as any);
    expect(r.success).toBe(true);
    const offers = kv.get<any>(KEYS.SALES_OFFERS);
    expect(offers.find((o: any) => o.id === 'OFF-1').الحالة).toBe('Accepted');
    expect(offers.find((o: any) => o.id === 'OFF-2').الحالة).toBe('Rejected');
  });

  test('updates to non-Accepted status', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing()]);
    kv.save(KEYS.SALES_OFFERS, [{ id: 'OFF-1', listingId: 'LST-1', الحالة: 'Pending' }]);
    buildCache();
    const r = updateOfferStatus('OFF-1', 'Rejected' as any);
    expect(r.success).toBe(true);
  });
});

describe('updateSalesAgreement', () => {
  test('fails when not found', () => {
    expect(updateSalesAgreement('MISSING', {}).success).toBe(false);
  });

  test('fails when completed', () => {
    kv.save(KEYS.SALES_AGREEMENTS, [{ id: 'AGR-1', isCompleted: true, listingId: 'LST-1' }]);
    buildCache();
    expect(updateSalesAgreement('AGR-1', {}).success).toBe(false);
  });

  test('updates successfully with external commission', () => {
    kv.save(KEYS.SALES_AGREEMENTS, [{
      id: 'AGR-1', isCompleted: false, listingId: 'LST-1',
      السعر_النهائي: 100000, عمولة_المشتري: 0, عمولة_البائع: 0, عمولة_وسيط_خارجي: 0,
    } as any]);
    buildCache();
    const r = updateSalesAgreement('AGR-1', {}, { buyer: 1000, seller: 500, external: 200 });
    expect(r.success).toBe(true);
    const exts = kv.get<any>(KEYS.EXTERNAL_COMMISSIONS);
    expect(exts.some((e: any) => e.القيمة === 200)).toBe(true);
  });

  test('removes external commission when set to 0', () => {
    kv.save(KEYS.EXTERNAL_COMMISSIONS, [{ id: 'EXT-AGR-1', القيمة: 200 }]);
    kv.save(KEYS.SALES_AGREEMENTS, [{
      id: 'AGR-1', isCompleted: false, listingId: 'LST-1',
      السعر_النهائي: 100000, عمولة_المشتري: 0, عمولة_البائع: 0, عمولة_وسيط_خارجي: 200,
    } as any]);
    buildCache();
    const r = updateSalesAgreement('AGR-1', {}, { external: 0 });
    expect(r.success).toBe(true);
    const exts = kv.get<any>(KEYS.EXTERNAL_COMMISSIONS);
    expect(exts.find((e: any) => e.id === 'EXT-AGR-1')).toBeUndefined();
  });
});

describe('deleteSalesAgreement', () => {
  test('fails when not found', () => {
    expect(deleteSalesAgreement('MISSING').success).toBe(false);
  });

  test('fails when completed', () => {
    kv.save(KEYS.SALES_AGREEMENTS, [{ id: 'AGR-1', isCompleted: true }]);
    buildCache();
    expect(deleteSalesAgreement('AGR-1').success).toBe(false);
  });

  test('deletes and restores listing to Active when no other agreements', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing('LST-1', 'Pending')]);
    kv.save(KEYS.SALES_AGREEMENTS, [{ id: 'AGR-1', isCompleted: false, listingId: 'LST-1' }]);
    buildCache();
    const r = deleteSalesAgreement('AGR-1');
    expect(r.success).toBe(true);
    expect(kv.get<any>(KEYS.SALES_LISTINGS)[0].الحالة).toBe('Active');
  });

  test('removes related offers', () => {
    kv.save(KEYS.SALES_OFFERS, [{ id: 'OFF-1', listingId: 'LST-1' }]);
    kv.save(KEYS.SALES_AGREEMENTS, [{ id: 'AGR-1', isCompleted: false, listingId: 'LST-1' }]);
    buildCache();
    deleteSalesAgreement('AGR-1');
    expect(kv.get<any>(KEYS.SALES_OFFERS)).toHaveLength(0);
  });
});

describe('createSalesAgreement', () => {
  const listing = makeListing();

  test('fails when existing agreement in progress', () => {
    kv.save(KEYS.SALES_AGREEMENTS, [{ id: 'AGR-1', listingId: 'LST-1', isCompleted: false }]);
    buildCache();
    const r = createSalesAgreement({ listingId: 'LST-1', رقم_المشتري: 'B-1' }, listing, {});
    expect(r.success).toBe(false);
  });

  test('fails without listingId', () => {
    const r = createSalesAgreement({ رقم_المشتري: 'B-1' }, listing, {});
    expect(r.success).toBe(false);
  });

  test('fails without رقم_المشتري', () => {
    const r = createSalesAgreement({ listingId: 'LST-1' }, listing, {});
    expect(r.success).toBe(false);
  });

  test('creates agreement and updates listing to Pending', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing()]);
    buildCache();
    const r = createSalesAgreement({ listingId: 'LST-1', رقم_المشتري: 'B-1' } as any, listing, { buyer: 500, seller: 300 });
    expect(r.success).toBe(true);
    expect(kv.get<any>(KEYS.SALES_LISTINGS)[0].الحالة).toBe('Pending');
  });

  test('creates external commission when external > 0', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing()]);
    buildCache();
    createSalesAgreement({ listingId: 'LST-1', رقم_المشتري: 'B-1' }, listing, { external: 300 });
    const exts = kv.get<any>(KEYS.EXTERNAL_COMMISSIONS);
    expect(exts.some((e: any) => e.القيمة === 300)).toBe(true);
  });

  test('calculates fees from expenses', () => {
    kv.save(KEYS.SALES_LISTINGS, [makeListing()]);
    buildCache();
    const r = createSalesAgreement(
      { listingId: 'LST-1', رقم_المشتري: 'B-1' },
      listing,
      { expenses: { رسوم_التنازل: 100, ضريبة_الابنية: 200, نقل_اشتراك_الكهرباء: 50, نقل_اشتراك_المياه: 50, قيمة_التأمينات: 100 } }
    );
    expect(r.success).toBe(true);
    const agr = kv.get<any>(KEYS.SALES_AGREEMENTS)[0];
    expect(agr.إجمالي_المصاريف).toBe(500);
  });
});
