import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { 
  getProperties, 
  addProperty, 
  updateProperty, 
  deleteProperty,
  getPropertyDetails 
} from '@/services/db/properties';
import { save, get } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';
import { العقارات_tbl, الأشخاص_tbl, العقود_tbl } from '@/types';

beforeAll(() => {
  installMemoryLocalStorage();
});

beforeEach(() => {
  resetKvAndCache();
  save(KEYS.PROPERTIES, []);
  save(KEYS.PEOPLE, []);
  save(KEYS.CONTRACTS, []);
});

describe('Properties Service', () => {
  it('addProperty: should create a record with PROP- ID', () => {
    save(KEYS.PEOPLE, [{ رقم_الشخص: 'O1', الاسم: 'Owner' }]);
    const res = addProperty({
      الكود_الداخلي: 'VC-01',
      رقم_المالك: 'O1',
      النوع: 'شقة',
      اسم_العقار: 'Villa A',
      العنوان: 'Amman',
      حالة_العقار: 'شاغر'
    } as any);

    expect(res.success).toBe(true);
    expect(res.data?.رقم_العقار).toMatch(/^PROP-/);
    expect(getProperties()).toHaveLength(1);
  });

  it('updateProperty: should link IsRented to status if patched', () => {
    save(KEYS.PROPERTIES, [{ رقم_العقار: 'P1', حالة_العقار: 'شاغر', IsRented: false }]);
    
    // Change to Rented
    updateProperty('P1', { حالة_العقار: 'مؤجر' });
    let p = getProperties()[0];
    expect(p.IsRented).toBe(true);

    // Change back to Vacant
    updateProperty('P1', { حالة_العقار: 'شاغر' });
    p = getProperties()[0];
    expect(p.IsRented).toBe(false);
  });

  it('deleteProperty: should block if active contracts exist', () => {
    save(KEYS.PROPERTIES, [{ رقم_العقار: 'P1' }]);
    save(KEYS.CONTRACTS, [{ رقم_العقار: 'P1', حالة_العقد: 'نشط', isArchived: false }]);

    const res = deleteProperty('P1');
    expect(res.success).toBe(false);
    expect(res.message).toContain('عقود سارية');
  });

  it('getPropertyDetails: should return full aggregate (owner, tenant, contract)', () => {
    const p = { رقم_العقار: 'P1', رقم_المالك: 'O1', اسم_العقار: 'P1 Name' } as any;
    const owner = { رقم_الشخص: 'O1', الاسم: 'Owner Name' } as any;
    const tenant = { رقم_الشخص: 'T1', الاسم: 'Tenant Name' } as any;
    const contract = { 
        رقم_العقد: 'C1', 
        رقم_العقار: 'P1', 
        رقم_المستاجر: 'T1', 
        تاريخ_النهاية: '2026-12-31',
        حالة_العقد: 'نشط'
    } as any;

    save(KEYS.PROPERTIES, [p]);
    save(KEYS.PEOPLE, [owner, tenant]);
    save(KEYS.CONTRACTS, [contract]);

    const details = getPropertyDetails('P1');
    expect(details?.property.اسم_العقار).toBe('P1 Name');
    expect(details?.owner?.الاسم).toBe('Owner Name');
    expect(details?.currentTenant?.الاسم).toBe('Tenant Name');
    expect(details?.currentContract?.رقم_العقد).toBe('C1');
  });
});
