import { 
  getPersonDetails, 
  updateTenantRatingImpl, 
  addToBlacklist, 
  removeFromBlacklist,
  upsertContactBookInternal,
  getContactsDirectoryInternal,
  addPersonWithAutoLinkInternal,
  updatePersonWithAutoLinkInternal,
  getPersonBlacklistStatus
} from '@/services/db/people';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('People Service - Comprehensive Logic Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('getPersonDetails - aggregates full person profile', () => {
    const person = { رقم_الشخص: 'P1', الاسم: 'Test User', رقم_الهاتف: '123' };
    kv.save(KEYS.PEOPLE, [person]);
    kv.save(KEYS.ROLES, [{ رقم_الشخص: 'P1', الدور: 'Tenant' }]);
    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1',
      تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false,
      lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    }]);
    kv.save(KEYS.INSTALLMENTS, [{ 
      رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', حالة_الكمبيالة: 'Pending', تاريخ_استحقاق: '2020-01-01', القيمة: 100, سجل_الدفعات: [], نوع_الكمبيالة: 'Rental'
    }]);
    kv.save(KEYS.BLACKLIST, [{ personId: 'P1', isActive: true, reason: 'Bad' }]);

    const details = getPersonDetails('P1');
    expect(details?.person.الاسم).toBe('Test User');
    expect(details?.roles).toContain('Tenant');
    expect(details?.contracts).toHaveLength(1);
    expect(details?.blacklistRecord?.reason).toBe('Bad');
    expect(details?.stats.lateInstallments).toBe(1);
  });

  test('updateTenantRatingImpl - updates points and history', () => {
    kv.save(KEYS.PEOPLE, [{ 
      رقم_الشخص: 'T1', الاسم: 'Tenant', رقم_الهاتف: '123',
      تصنيف_السلوك: { points: 100, history: [], type: 'جيد' } 
    }]);
    
    updateTenantRatingImpl('T1', 'late');
    const p = kv.get<any>(KEYS.PEOPLE)[0];
    expect(p.تصنيف_السلوك.points).toBe(80);
  });

  test('blacklist operations - add and remove', () => {
    addToBlacklist({ personId: 'P1', reason: 'Non-payment', severity: 'High' });
    expect(getPersonBlacklistStatus('P1')).toBeDefined();
    let bl = kv.get<any>(KEYS.BLACKLIST);
    expect(bl).toHaveLength(1);
    expect(bl[0].isActive).toBe(true);

    removeFromBlacklist('P1');
    bl = kv.get<any>(KEYS.BLACKLIST);
    expect(bl[0].isActive).toBe(false);
  });

  test('ContactBook - upsert and directory merging', () => {
    upsertContactBookInternal({ name: 'Local Contact', phone: '0790000000' });
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'System Person', رقم_الهاتف: '0791111111' }]);
    
    const directory = getContactsDirectoryInternal();
    expect(directory.some(d => d.name === 'Local Contact')).toBe(true);
    expect(directory.some(d => d.name === 'System Person')).toBe(true);
  });

  test('addPersonWithAutoLinkInternal - links local contact to new person', () => {
    kv.save(KEYS.CONTACTS, [{ id: 'C1', name: 'Old Friend', phone: '0799999999', extraPhone: '0788888888' }]);
    
    const res = addPersonWithAutoLinkInternal({ 
      الاسم: 'New Person', 
      رقم_الهاتف: '0799999999',
      رقم_الشخص: 'P2'
    } as any, []);
    
    expect(res.success).toBe(true);
    // Should have picked up extra phone from contact book
    expect(res.data?.رقم_هاتف_اضافي).toBe('0788888888');
    // Contact book should be cleared for this phone
    expect(kv.get<any>(KEYS.CONTACTS)).toHaveLength(0);
  });

  test('updatePersonWithAutoLinkInternal - updates person and removes contact if phone matches', () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'John', رقم_الهاتف: '0799999999' }]);
    kv.save(KEYS.CONTACTS, [{ id: 'C1', name: 'John Old', phone: '0799999999' }]);

    const res = updatePersonWithAutoLinkInternal('P1', { الاسم: 'John Updated' } as any);
    expect(res.success).toBe(true);
    expect(kv.get<any>(KEYS.PEOPLE)[0].الاسم).toBe('John Updated');
    // Contact book should be cleared for this phone
    expect(kv.get<any>(KEYS.CONTACTS)).toHaveLength(0);
  });
});
