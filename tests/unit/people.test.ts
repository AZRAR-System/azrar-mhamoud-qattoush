import { 
  getPeople, 
  addPerson, 
  updatePerson, 
  deletePerson, 
  getPersonDetails,
  addToBlacklist,
  removeFromBlacklist,
  updateTenantRatingImpl
} from '@/services/db/people';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('People System Service - CRM Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
    delete (window as any).desktopDb;
  });

  const validPersonData = () => ({
    الاسم: 'Test User',
    رقم_الهاتف: '0791234567',
    الرقم_الوطني: '1234567890'
  });

  const validContractData = (id: string, tenantId: string) => ({
    رقم_العقد: id,
    رقم_العقار: 'PR1',
    رقم_المستاجر: tenantId,
    تاريخ_البداية: '2025-01-01',
    تاريخ_النهاية: '2025-12-31',
    مدة_العقد_بالاشهر: 12,
    القيمة_السنوية: 1200,
    تكرار_الدفع: 1,
    طريقة_الدفع: 'نقدي',
    حالة_العقد: 'نشط',
    isArchived: false,
    lateFeeType: 'none' as const,
    lateFeeValue: 0,
    lateFeeGraceDays: 0
  });

  describe('CRUD Operations', () => {
    test('addPerson - creates person and assigns roles', () => {
      const res = addPerson(validPersonData(), ['مستأجر']);
      expect(res.success).toBe(true);
      expect(res.data?.رقم_الشخص).toContain('P-');
      
      expect(getPeople()).toHaveLength(1);
      const roles = kv.get<any>(KEYS.ROLES);
      expect(roles[0].الدور).toBe('مستأجر');
    });

    test('updatePerson - updates fields', () => {
      const p = addPerson(validPersonData(), []).data!;
      updatePerson(p.رقم_الشخص, { الاسم: 'Updated Name' });
      expect(getPeople()[0].الاسم).toBe('Updated Name');
    });

    test('deletePerson - blocks if has active contracts', () => {
      const p = addPerson(validPersonData(), []).data!;
      kv.save(KEYS.CONTRACTS, [validContractData('C1', p.رقم_الشخص)]);
      const res = deletePerson(p.رقم_الشخص);
      expect(res.success).toBe(false);
      expect(res.message).toContain('عقود مرتبطة');
    });
  });

  describe('Blacklist', () => {
    test('addToBlacklist and removeFromBlacklist', () => {
      addToBlacklist({ personId: 'P1', reason: 'Non-payment' });
      const bl = kv.get<any>(KEYS.BLACKLIST);
      expect(bl).toHaveLength(1);
      expect(bl[0].isActive).toBe(true);

      removeFromBlacklist('P1');
      expect(kv.get<any>(KEYS.BLACKLIST)[0].isActive).toBe(false);
    });
  });

  describe('Ratings', () => {
    test('updateTenantRatingImpl - adjusts points and type', () => {
      const p = addPerson(validPersonData(), []).data!;
      // Initialize with 90 so we can see the +5 change (since it caps at 100)
      const people = kv.get<any>(KEYS.PEOPLE);
      people[0].تصنيف_السلوك = { type: 'جيد', points: 90, history: [] };
      kv.save(KEYS.PEOPLE, people);

      updateTenantRatingImpl(p.رقم_الشخص, 'full'); // +5
      
      const updated = getPeople()[0];
      expect(updated.تصنيف_السلوك?.points).toBe(95); 
      expect(updated.تصنيف_السلوك?.type).toBe('ملتزم جداً');
      
      updateTenantRatingImpl(p.رقم_الشخص, 'late'); // -20
      expect(getPeople()[0].تصنيف_السلوك?.points).toBe(75);
      expect(getPeople()[0].تصنيف_السلوك?.type).toBe('جيد (ملتزم)');
    });
  });

  describe('Details', () => {
    test('getPersonDetails - aggregates statistics', () => {
      const p = addPerson(validPersonData(), []).data!;
      kv.save(KEYS.CONTRACTS, [validContractData('C1', p.رقم_الشخص)]);
      kv.save(KEYS.INSTALLMENTS, [
        { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: '2020-01-01', حالة_الكمبيالة: 'غير مدفوع', القيمة: 100, نوع_الكمبيالة: 'إيجار' }
      ]);
      
      const details = getPersonDetails(p.رقم_الشخص);
      expect(details?.stats.totalInstallments).toBe(1);
      expect(details?.stats.lateInstallments).toBe(1);
      expect(details?.stats.commitmentRatio).toBe(0);
    });
  });
});
