import {
  getProperties,
  addProperty,
  updateProperty,
  deleteProperty,
  getPropertyDetails,
} from '@/services/db/properties';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

const makeProp = (id: string, ownerId = 'OWN-1', overrides: Record<string, unknown> = {}) => ({
  رقم_العقار: id,
  الكود_الداخلي: id,
  رقم_المالك: ownerId,
  النوع: 'شقة',
  العنوان: 'عمان - الجاردنز',
  حالة_العقار: 'شاغر',
  IsRented: false,
  المساحة: 120,
  ...overrides,
} as any);

const makeContract = (id: string, propId: string, status = 'نشط', archived = false) => ({
  رقم_العقد: id,
  رقم_العقار: propId,
  رقم_المستاجر: 'PER-1',
  تاريخ_البداية: '2026-01-01',
  تاريخ_النهاية: '2027-01-01',
  مدة_العقد_بالاشهر: 12,
  القيمة_السنوية: 1200,
  تكرار_الدفع: 1,
  طريقة_الدفع: 'Cash',
  حالة_العقد: status,
  isArchived: archived,
  lateFeeType: 'none',
  lateFeeValue: 0,
  lateFeeGraceDays: 0,
} as any);

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('getProperties', () => {
  test('returns empty array initially', () => {
    expect(getProperties()).toEqual([]);
  });
});

describe('addProperty', () => {
  test('fails validation when missing required fields', () => {
    const r = addProperty({ الكود_الداخلي: '', رقم_المالك: '', النوع: '', العنوان: '', حالة_العقار: 'شاغر', IsRented: false, المساحة: 100 } as any);
    expect(r.success).toBe(false);
  });

  test('adds property successfully', () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'OWN-1', الاسم: 'فراس النابلسي', رقم_الهاتف: '0791234567' }]);
    buildCache();
    const r = addProperty({
      الكود_الداخلي: 'P-101',
      رقم_المالك: 'OWN-1',
      النوع: 'شقة',
      العنوان: 'عمان',
      حالة_العقار: 'شاغر',
      IsRented: false,
      المساحة: 120,
    } as any);
    expect(r.success).toBe(true);
    expect(r.data?.الكود_الداخلي).toBe('P-101');
  });

  test('sets IsRented from حالة_العقار when not provided', () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'OWN-1', الاسم: 'خالد العمري', رقم_الهاتف: '0791234567' }]);
    buildCache();
    const r = addProperty({
      الكود_الداخلي: 'P-102',
      رقم_المالك: 'OWN-1',
      النوع: 'شقة',
      العنوان: 'عمان',
      حالة_العقار: 'مؤجر',
      المساحة: 100,
    } as any);
    expect(r.success).toBe(true);
    expect(r.data?.IsRented).toBe(true);
  });
});

describe('updateProperty', () => {
  test('fails when property not found', () => {
    const r = updateProperty('MISSING', { العنوان: 'عمان' });
    expect(r.success).toBe(false);
  });

  test('updates property successfully', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1')]);
    buildCache();
    const r = updateProperty('PR-1', { العنوان: 'عمان - الشميساني' });
    expect(r.success).toBe(true);
    expect(r.data?.العنوان).toBe('عمان - الشميساني');
  });

  test('updates IsRented when حالة_العقار changes', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1')]);
    buildCache();
    const r = updateProperty('PR-1', { حالة_العقار: 'مؤجر' });
    expect(r.success).toBe(true);
    expect(r.data?.IsRented).toBe(true);
  });

  test('keeps IsRented unchanged when explicitly provided', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1')]);
    buildCache();
    const r = updateProperty('PR-1', { حالة_العقار: 'مؤجر', IsRented: false });
    expect(r.success).toBe(true);
    expect(r.data?.IsRented).toBe(false);
  });
});

describe('deleteProperty', () => {
  test('fails when active contracts exist', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1')]);
    kv.save(KEYS.CONTRACTS, [makeContract('C-1', 'PR-1', 'نشط', false)]);
    buildCache();
    const r = deleteProperty('PR-1');
    expect(r.success).toBe(false);
    expect(r.message).toContain('عقود');
  });

  test('allows deletion when contracts are archived', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1')]);
    kv.save(KEYS.CONTRACTS, [makeContract('C-1', 'PR-1', 'نشط', true)]);
    buildCache();
    const r = deleteProperty('PR-1');
    expect(r.success).toBe(true);
  });

  test('allows deletion when contracts are ended', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1')]);
    kv.save(KEYS.CONTRACTS, [makeContract('C-1', 'PR-1', 'منتهي', false)]);
    buildCache();
    const r = deleteProperty('PR-1');
    expect(r.success).toBe(true);
  });

  test('deletes property with no contracts', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1')]);
    buildCache();
    const r = deleteProperty('PR-1');
    expect(r.success).toBe(true);
    expect(getProperties()).toHaveLength(0);
  });
});

describe('getPropertyDetails', () => {
  test('returns null for missing property', () => {
    expect(getPropertyDetails('MISSING')).toBeNull();
  });

  test('returns property details without contracts', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1', 'OWN-1')]);
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'OWN-1', الاسم: 'نور الدين العمري', رقم_الهاتف: '0791234567' }]);
    buildCache();
    const r = getPropertyDetails('PR-1');
    expect(r?.property.رقم_العقار).toBe('PR-1');
    expect(r?.owner?.الاسم).toBe('نور الدين العمري');
    expect(r?.currentContract).toBeFalsy();
  });

  test('returns active contract and tenant', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1', 'OWN-1')]);
    kv.save(KEYS.PEOPLE, [
      { رقم_الشخص: 'OWN-1', الاسم: 'فراس النابلسي', رقم_الهاتف: '0791111111' },
      { رقم_الشخص: 'PER-1', الاسم: 'محمد الشرايري', رقم_الهاتف: '0792222222' },
    ]);
    kv.save(KEYS.CONTRACTS, [makeContract('C-1', 'PR-1', 'نشط')]);
    buildCache();
    const r = getPropertyDetails('PR-1');
    expect(r?.currentTenant?.الاسم).toBe('محمد الشرايري');
    expect(r?.currentContract?.رقم_العقد).toBe('C-1');
  });

  test('returns guarantor when present', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1', 'OWN-1')]);
    kv.save(KEYS.PEOPLE, [
      { رقم_الشخص: 'OWN-1', الاسم: 'فراس', رقم_الهاتف: '0791111111' },
      { رقم_الشخص: 'PER-1', الاسم: 'محمد', رقم_الهاتف: '0792222222' },
      { رقم_الشخص: 'GUA-1', الاسم: 'أحمد الضمان', رقم_الهاتف: '0793333333' },
    ]);
    kv.save(KEYS.CONTRACTS, [{ ...makeContract('C-1', 'PR-1', 'نشط'), رقم_الكفيل: 'GUA-1' }]);
    buildCache();
    const r = getPropertyDetails('PR-1');
    expect(r?.currentGuarantor?.الاسم).toBe('أحمد الضمان');
  });

  test('returns history when multiple contracts exist', () => {
    kv.save(KEYS.PROPERTIES, [makeProp('PR-1', 'OWN-1')]);
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'OWN-1', الاسم: 'فراس', رقم_الهاتف: '0791111111' },
      { رقم_الشخص: 'PER-1', الاسم: 'محمد', رقم_الهاتف: '0792222222' }]);
    kv.save(KEYS.CONTRACTS, [
      makeContract('C-1', 'PR-1', 'نشط'),
      { ...makeContract('C-2', 'PR-1', 'منتهي'), تاريخ_النهاية: '2025-01-01' },
    ]);
    buildCache();
    const r = getPropertyDetails('PR-1');
    expect(r?.history.length).toBeGreaterThan(0);
  });
});
