import {
  getPeople,
  getPersonById,
  getPersonRoles,
  updatePersonRoles,
  addPerson,
  updatePerson,
  deletePerson,
  getPersonDetails,
  updateTenantRatingImpl,
  getPersonBlacklistStatus,
  addToBlacklist,
  updateBlacklistRecord,
  removeFromBlacklist,
  generateWhatsAppLink,
} from '@/services/db/people';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

const makePerson = (id: string, overrides: Record<string, unknown> = {}) => ({
  رقم_الشخص: id,
  الاسم: 'محمد الزعبي',
  رقم_الهاتف: '0791234567',
  ...overrides,
} as any);

const makeProperty = (id: string, ownerId: string) => ({
  رقم_العقار: id,
  الكود_الداخلي: id,
  رقم_المالك: ownerId,
  النوع: 'شقة',
  العنوان: 'عمان',
  حالة_العقار: 'شاغر',
  IsRented: false,
  المساحة: 100,
} as any);

const makeContract = (id: string, tenantId: string) => ({
  رقم_العقد: id,
  رقم_العقار: 'PR-1',
  رقم_المستاجر: tenantId,
  تاريخ_البداية: '2026-01-01',
  تاريخ_النهاية: '2027-01-01',
  مدة_العقد_بالاشهر: 12,
  القيمة_السنوية: 1200,
  تكرار_الدفع: 1,
  طريقة_الدفع: 'Cash',
  حالة_العقد: 'نشط',
  isArchived: false,
  lateFeeType: 'none',
  lateFeeValue: 0,
  lateFeeGraceDays: 0,
} as any);

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('getPeople / getPersonById', () => {
  test('returns empty array initially', () => {
    expect(getPeople()).toEqual([]);
  });

  test('getPersonById returns person', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1')]);
    buildCache();
    expect(getPersonById('P-1')?.رقم_الشخص).toBe('P-1');
  });

  test('getPersonById returns undefined for missing', () => {
    expect(getPersonById('MISSING')).toBeUndefined();
  });
});

describe('getPersonRoles / updatePersonRoles', () => {
  test('returns empty roles initially', () => {
    expect(getPersonRoles('P-1')).toEqual([]);
  });

  test('updates and retrieves roles', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1')]);
    buildCache();
    updatePersonRoles('P-1', ['مالك', 'مستأجر']);
    expect(getPersonRoles('P-1')).toContain('مالك');
  });
});

describe('addPerson', () => {
  test('fails validation for missing name', () => {
    const r = addPerson({ الاسم: '', رقم_الهاتف: '0791234567' } as any, []);
    expect(r.success).toBe(false);
  });

  test('adds person successfully', () => {
    const r = addPerson({ الاسم: 'أحمد الشرايري', رقم_الهاتف: '0791234567' } as any, ['مستأجر']);
    expect(r.success).toBe(true);
    expect(r.data?.الاسم).toBe('أحمد الشرايري');
  });
});

describe('updatePerson', () => {
  test('fails when person not found', () => {
    const r = updatePerson('MISSING', { الاسم: 'x' });
    expect(r.success).toBe(false);
  });

  test('updates person successfully', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1')]);
    buildCache();
    const r = updatePerson('P-1', { الاسم: 'خالد العمري' });
    expect(r.success).toBe(true);
    expect(r.data?.الاسم).toBe('خالد العمري');
  });
});

describe('deletePerson', () => {
  test('fails when person has properties', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1')]);
    kv.save(KEYS.PROPERTIES, [makeProperty('PR-1', 'P-1')]);
    buildCache();
    const r = deletePerson('P-1');
    expect(r.success).toBe(false);
    expect(r.message).toContain('عقارات');
  });

  test('fails when person has contracts', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1')]);
    kv.save(KEYS.CONTRACTS, [makeContract('C-1', 'P-1')]);
    buildCache();
    const r = deletePerson('P-1');
    expect(r.success).toBe(false);
    expect(r.message).toContain('عقود');
  });

  test('deletes person successfully', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1')]);
    buildCache();
    const r = deletePerson('P-1');
    expect(r.success).toBe(true);
    expect(getPersonById('P-1')).toBeUndefined();
  });
});

describe('getPersonDetails', () => {
  test('returns null for missing person', () => {
    expect(getPersonDetails('MISSING')).toBeNull();
  });

  test('returns full details', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1')]);
    buildCache();
    const r = getPersonDetails('P-1');
    expect(r?.person.رقم_الشخص).toBe('P-1');
    expect(r?.stats.commitmentRatio).toBe(100);
  });

  test('calculates stats with installments', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1')]);
    kv.save(KEYS.CONTRACTS, [makeContract('C-1', 'P-1')]);
    kv.save(KEYS.INSTALLMENTS, [{
      رقم_الكمبيالة: 'I-1',
      رقم_العقد: 'C-1',
      القيمة: 500,
      القيمة_المتبقية: 500,
      تاريخ_استحقاق: '2020-01-01',
      حالة_الكمبيالة: 'غير مدفوع',
      نوع_الكمبيالة: 'إيجار',
      نوع_الدفعة: 'دورية',
      ترتيب_الكمبيالة: 1,
    }]);
    buildCache();
    const r = getPersonDetails('P-1');
    expect(r?.stats.totalInstallments).toBe(1);
    expect(r?.stats.lateInstallments).toBe(1);
  });
});

describe('updateTenantRatingImpl', () => {
  test('noop for missing person', () => {
    expect(() => updateTenantRatingImpl('MISSING', 'full')).not.toThrow();
  });

  test('full payment increases points', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1', { تصنيف_السلوك: { type: 'جيد', points: 80, history: [] } })]);
    buildCache();
    updateTenantRatingImpl('P-1', 'full');
    const p = getPeople()[0];
    expect(p.تصنيف_السلوك.points).toBe(85);
  });

  test('partial payment decreases points', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1', { تصنيف_السلوك: { type: 'جيد', points: 80, history: [] } })]);
    buildCache();
    updateTenantRatingImpl('P-1', 'partial');
    const p = getPeople()[0];
    expect(p.تصنيف_السلوك.points).toBe(70);
  });

  test('late payment decreases points more', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1', { تصنيف_السلوك: { type: 'جيد', points: 80, history: [] } })]);
    buildCache();
    updateTenantRatingImpl('P-1', 'late');
    const p = getPeople()[0];
    expect(p.تصنيف_السلوك.points).toBe(60);
  });

  test('initializes تصنيف_السلوك when missing', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1')]);
    buildCache();
    updateTenantRatingImpl('P-1', 'full');
    const p = getPeople()[0];
    expect(p.تصنيف_السلوك).toBeDefined();
  });

  test('sets type to ملتزم جداً when points >= 90', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1', { تصنيف_السلوك: { type: 'جيد', points: 90, history: [] } })]);
    buildCache();
    updateTenantRatingImpl('P-1', 'full');
    expect(getPeople()[0].تصنيف_السلوك.type).toBe('ملتزم جداً');
  });

  test('sets type to مقبول when points 50-69', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1', { تصنيف_السلوك: { type: 'جيد', points: 80, history: [] } })]);
    buildCache();
    updateTenantRatingImpl('P-1', 'late');
    expect(getPeople()[0].تصنيف_السلوك.type).toBe('مقبول (متذبذب)');
  });

  test('sets type to غير منتظم when points < 50', () => {
    kv.save(KEYS.PEOPLE, [makePerson('P-1', { تصنيف_السلوك: { type: 'جيد', points: 50, history: [] } })]);
    buildCache();
    updateTenantRatingImpl('P-1', 'late');
    expect(getPeople()[0].تصنيف_السلوك.type).toBe('غير منتظم (سيء)');
  });
});

describe('blacklist operations', () => {
  test('getPersonBlacklistStatus returns undefined when not blacklisted', () => {
    expect(getPersonBlacklistStatus('P-1')).toBeUndefined();
  });

  test('addToBlacklist adds record', () => {
    addToBlacklist({ personId: 'P-1', reason: 'تأخر مستمر', severity: 'High' as any });
    expect(getPersonBlacklistStatus('P-1')).toBeDefined();
  });

  test('addToBlacklist deactivates previous record', () => {
    addToBlacklist({ personId: 'P-1', reason: 'سبب 1', severity: 'Low' as any });
    addToBlacklist({ personId: 'P-1', reason: 'سبب 2', severity: 'High' as any });
    const all = kv.get<any>(KEYS.BLACKLIST);
    const active = all.filter((b: any) => b.personId === 'P-1' && b.isActive);
    expect(active).toHaveLength(1);
  });

  test('updateBlacklistRecord updates successfully', () => {
    addToBlacklist({ personId: 'P-1', reason: 'سبب', severity: 'Low' as any });
    const all = kv.get<any>(KEYS.BLACKLIST);
    const r = updateBlacklistRecord(all[0].id, { reason: 'سبب محدث' });
    expect(r.success).toBe(true);
  });

  test('updateBlacklistRecord fails for missing id', () => {
    const r = updateBlacklistRecord('MISSING', { reason: 'x' });
    expect(r.success).toBe(false);
  });

  test('removeFromBlacklist by BL- id', () => {
    addToBlacklist({ personId: 'P-1', reason: 'سبب', severity: 'Low' as any });
    const id = kv.get<any>(KEYS.BLACKLIST)[0].id;
    removeFromBlacklist(id);
    expect(getPersonBlacklistStatus('P-1')).toBeUndefined();
  });

  test('removeFromBlacklist by person id', () => {
    addToBlacklist({ personId: 'P-2', reason: 'سبب', severity: 'Low' as any });
    removeFromBlacklist('P-2');
    expect(getPersonBlacklistStatus('P-2')).toBeUndefined();
  });
});

describe('generateWhatsAppLink', () => {
  test('returns non-empty link for valid phone', () => {
    const r = generateWhatsAppLink('0791234567', 'مرحبا');
    expect(r).toContain('whatsapp');
  });

  test('returns empty for empty phone', () => {
    const r = generateWhatsAppLink('', 'msg');
    expect(r).toBe('');
  });
});
