import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import type { عروض_البيع_tbl } from '@/types';
import { createSalesAgreement, getSalesListings } from '@/services/db/sales';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';

const listing: عروض_البيع_tbl = {
  id: 'LST-UT-1',
  رقم_العقار: 'PROP-1',
  رقم_المالك: 'P-OWN',
  السعر_المطلوب: 150000,
  أقل_سعر_مقبول: 140000,
  نوع_البيع: 'Cash',
  الحالة: 'Active',
  تاريخ_العرض: '2026-01-15',
};

beforeAll(() => {
  installMemoryLocalStorage();
});

beforeEach(() => {
  resetKvAndCache();
  save(KEYS.SALES_LISTINGS, [listing]);
  save(KEYS.SALES_AGREEMENTS, []);
  save(KEYS.EXTERNAL_COMMISSIONS, []);
});

describe('db/sales', () => {
  it('getSalesListings returns seeded rows', () => {
    const rows = getSalesListings();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('LST-UT-1');
  });

  it('createSalesAgreement persists agreement and sets listing Pending', () => {
    const res = createSalesAgreement(
      { listingId: listing.id, رقم_المشتري: 'P-BUY' },
      listing,
      { buyer: 100, seller: 100 }
    );
    expect(res.success).toBe(true);
    expect(res.data?.id).toMatch(/^AGR-/);
    const listings = getSalesListings();
    expect(listings.find((l) => l.id === listing.id)?.الحالة).toBe('Pending');
  });
});
