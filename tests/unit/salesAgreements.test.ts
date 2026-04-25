import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';
import {
  getSalesListings,
  getSalesOffers,
  getSalesAgreements,
  getOwnershipHistory,
} from '@/services/db/system/sales_agreements';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('getSalesListings', () => {
  test('returns empty array initially', () => {
    expect(getSalesListings()).toEqual([]);
  });

  test('returns saved listings', () => {
    kv.save(KEYS.SALES_LISTINGS, [{ id: 'LST-1', رقم_العقار: 'PR-1', رقم_المالك: 'OWN-1', السعر_المطلوب: 100000, الحالة: 'Active' }]);
    buildCache();
    expect(getSalesListings()).toHaveLength(1);
  });
});

describe('getSalesOffers', () => {
  beforeEach(() => {
    kv.save(KEYS.SALES_OFFERS, [
      { id: 'OFF-1', listingId: 'LST-1', رقم_المشتري: 'P-1', قيمة_العرض: 90000, الحالة: 'Pending' },
      { id: 'OFF-2', listingId: 'LST-2', رقم_المشتري: 'P-2', قيمة_العرض: 80000, الحالة: 'Pending' },
    ]);
    buildCache();
  });

  test('returns all offers when no listingId', () => {
    expect(getSalesOffers()).toHaveLength(2);
  });

  test('filters by listingId', () => {
    expect(getSalesOffers('LST-1')).toHaveLength(1);
    expect(getSalesOffers('LST-1')[0].id).toBe('OFF-1');
  });

  test('returns empty for nonexistent listingId', () => {
    expect(getSalesOffers('MISSING')).toHaveLength(0);
  });
});

describe('getSalesAgreements', () => {
  test('returns empty array initially', () => {
    expect(getSalesAgreements()).toEqual([]);
  });
});

describe('getOwnershipHistory', () => {
  const historyRecord = {
    id: 'OH-1',
    رقم_العقار: 'PR-1',
    رقم_المالك_القديم: 'OWN-1',
    رقم_المالك_الجديد: 'OWN-2',
    تاريخ_النقل: '2026-01-01',
  };

  beforeEach(() => {
    kv.save(KEYS.OWNERSHIP_HISTORY, [historyRecord]);
    buildCache();
  });

  test('returns all records when no filter', () => {
    expect(getOwnershipHistory()).toHaveLength(1);
  });

  test('filters by propertyId', () => {
    expect(getOwnershipHistory('PR-1')).toHaveLength(1);
    expect(getOwnershipHistory('PR-99')).toHaveLength(0);
  });

  test('filters by personId as old owner', () => {
    expect(getOwnershipHistory(undefined, 'OWN-1')).toHaveLength(1);
  });

  test('filters by personId as new owner', () => {
    expect(getOwnershipHistory(undefined, 'OWN-2')).toHaveLength(1);
  });

  test('returns empty for unknown personId', () => {
    expect(getOwnershipHistory(undefined, 'MISSING')).toHaveLength(0);
  });

  test('uses cache when initialized - propertyId', () => {
    const r = getOwnershipHistory('PR-1');
    expect(r).toHaveLength(1);
  });

  test('uses cache when initialized - personId', () => {
    const r = getOwnershipHistory(undefined, 'OWN-1');
    expect(r).toHaveLength(1);
  });
});
