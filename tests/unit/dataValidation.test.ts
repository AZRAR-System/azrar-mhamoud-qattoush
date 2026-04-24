import {
  checkPrimaryKeyDuplicates,
  checkUniqueConstraints,
  checkForeignKeyIntegrity,
  checkBusinessLogic,
  validateAllData,
  validateNewPerson,
  validateNewProperty,
} from '@/services/dataValidation';

const KEYS = {
  PEOPLE: 'db_people',
  ROLES: 'db_roles',
  PROPERTIES: 'db_properties',
  CONTRACTS: 'db_contracts',
  INSTALLMENTS: 'db_installments',
  USERS: 'db_users',
};

const save = (key: string, data: unknown) => localStorage.setItem(key, JSON.stringify(data));

const makePerson = (id: string, nationalId?: string) => ({
  رقم_الشخص: id, الاسم: `Person ${id}`, رقم_الهاتف: '0791234567', الرقم_الوطني: nationalId,
});

const makeProperty = (id: string, code: string, ownerId: string, isRented = false) => ({
  رقم_العقار: id, الكود_الداخلي: code, رقم_المالك: ownerId,
  النوع: 'Apartment', العنوان: 'Amman', حالة_العقار: 'Active', IsRented: isRented, المساحة: 100,
});

const makeContract = (id: string, propId: string, tenantId: string, status = 'نشط', start = '2026-01-01', end = '2027-01-01') => ({
  رقم_العقد: id, رقم_العقار: propId, رقم_المستاجر: tenantId,
  تاريخ_البداية: start, تاريخ_النهاية: end, مدة_العقد_بالاشهر: 12,
  القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'Cash',
  حالة_العقد: status, isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0,
});

beforeEach(() => localStorage.clear());

describe('checkPrimaryKeyDuplicates', () => {
  test('returns valid when no duplicates', () => {
    save(KEYS.PEOPLE, [makePerson('P1'), makePerson('P2')]);
    const r = checkPrimaryKeyDuplicates();
    expect(r.isValid).toBe(true);
  });

  test('detects duplicate person ids', () => {
    save(KEYS.PEOPLE, [makePerson('P1'), makePerson('P1')]);
    const r = checkPrimaryKeyDuplicates();
    expect(r.isValid).toBe(false);
    expect(r.errors[0]).toContain('P1');
  });

  test('detects duplicate property ids', () => {
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'C1', 'O1'), makeProperty('PR1', 'C2', 'O1')]);
    const r = checkPrimaryKeyDuplicates();
    expect(r.isValid).toBe(false);
  });

  test('detects duplicate contract ids', () => {
    save(KEYS.CONTRACTS, [makeContract('C1', 'PR1', 'P1'), makeContract('C1', 'PR1', 'P1')]);
    const r = checkPrimaryKeyDuplicates();
    expect(r.isValid).toBe(false);
  });

  test('detects duplicate installment ids', () => {
    save(KEYS.INSTALLMENTS, [
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1' },
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1' },
    ]);
    const r = checkPrimaryKeyDuplicates();
    expect(r.isValid).toBe(false);
  });
});

describe('checkUniqueConstraints', () => {
  test('valid when no duplicates', () => {
    save(KEYS.PEOPLE, [makePerson('P1', '1234567890'), makePerson('P2', '0987654321')]);
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'CODE1', 'O1'), makeProperty('PR2', 'CODE2', 'O1')]);
    const r = checkUniqueConstraints();
    expect(r.isValid).toBe(true);
  });

  test('detects duplicate national ids', () => {
    save(KEYS.PEOPLE, [makePerson('P1', '1234567890'), makePerson('P2', '1234567890')]);
    const r = checkUniqueConstraints();
    expect(r.isValid).toBe(false);
  });

  test('detects duplicate property codes', () => {
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'SAME', 'O1'), makeProperty('PR2', 'SAME', 'O1')]);
    const r = checkUniqueConstraints();
    expect(r.isValid).toBe(false);
  });

  test('detects duplicate usernames', () => {
    save(KEYS.USERS, [{ اسم_المستخدم: 'admin' }, { اسم_المستخدم: 'admin' }]);
    const r = checkUniqueConstraints();
    expect(r.isValid).toBe(false);
  });
});

describe('checkForeignKeyIntegrity', () => {
  test('valid with correct references', () => {
    save(KEYS.PEOPLE, [makePerson('P1'), makePerson('P2')]);
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'C1', 'P1')]);
    save(KEYS.CONTRACTS, [makeContract('C1', 'PR1', 'P2')]);
    const r = checkForeignKeyIntegrity();
    expect(r.isValid).toBe(true);
  });

  test('detects missing property owner', () => {
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'C1', 'MISSING')]);
    const r = checkForeignKeyIntegrity();
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.includes('المالك'))).toBe(true);
  });

  test('detects missing contract property', () => {
    save(KEYS.PEOPLE, [makePerson('P1')]);
    save(KEYS.CONTRACTS, [makeContract('C1', 'PR-MISSING', 'P1')]);
    const r = checkForeignKeyIntegrity();
    expect(r.isValid).toBe(false);
  });

  test('detects missing contract tenant', () => {
    save(KEYS.PEOPLE, [makePerson('P1')]);
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'C1', 'P1')]);
    save(KEYS.CONTRACTS, [makeContract('C1', 'PR1', 'MISSING')]);
    const r = checkForeignKeyIntegrity();
    expect(r.isValid).toBe(false);
  });

  test('warning for missing guarantor', () => {
    save(KEYS.PEOPLE, [makePerson('P1'), makePerson('P2')]);
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'C1', 'P1')]);
    save(KEYS.CONTRACTS, [{ ...makeContract('C1', 'PR1', 'P2'), رقم_الكفيل: 'MISSING' }]);
    const r = checkForeignKeyIntegrity();
    expect(r.warnings.some(w => w.includes('الكفيل'))).toBe(true);
  });

  test('detects installment with missing contract', () => {
    save(KEYS.INSTALLMENTS, [{ رقم_الكمبيالة: 'I1', رقم_العقد: 'C-MISSING' }]);
    const r = checkForeignKeyIntegrity();
    expect(r.isValid).toBe(false);
  });

  test('detects role with missing person', () => {
    save(KEYS.ROLES, [{ رقم_الشخص: 'P-MISSING', الدور: 'مالك' }]);
    const r = checkForeignKeyIntegrity();
    expect(r.isValid).toBe(false);
  });
});

describe('checkBusinessLogic', () => {
  test('warning when IsRented=true but no active contract', () => {
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'C1', 'O1', true)]);
    const r = checkBusinessLogic();
    expect(r.warnings.some(w => w.includes('مؤجر'))).toBe(true);
  });

  test('warning when IsRented=false but has active contract', () => {
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'C1', 'O1', false)]);
    save(KEYS.CONTRACTS, [makeContract('C1', 'PR1', 'P1', 'نشط')]);
    const r = checkBusinessLogic();
    expect(r.warnings.some(w => w.includes('شاغر'))).toBe(true);
  });

  test('error when multiple active contracts for same property', () => {
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'C1', 'O1', true)]);
    save(KEYS.CONTRACTS, [makeContract('C1', 'PR1', 'P1', 'نشط'), makeContract('C2', 'PR1', 'P2', 'نشط')]);
    const r = checkBusinessLogic();
    expect(r.isValid).toBe(false);
  });

  test('error when end date before start date', () => {
    save(KEYS.CONTRACTS, [makeContract('C1', 'PR1', 'P1', 'نشط', '2026-06-01', '2026-01-01')]);
    const r = checkBusinessLogic();
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.includes('تاريخ النهاية'))).toBe(true);
  });

  test('warning when duration mismatch', () => {
    save(KEYS.CONTRACTS, [{
      ...makeContract('C1', 'PR1', 'P1', 'نشط', '2026-01-01', '2026-04-01'),
      مدة_العقد_بالاشهر: 24,
    }]);
    const r = checkBusinessLogic();
    expect(r.warnings.some(w => w.includes('مدة العقد'))).toBe(true);
  });
});

describe('validateAllData', () => {
  test('returns valid for clean data', () => {
    const r = validateAllData();
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  test('collects parse warnings for non-array data', () => {
    localStorage.setItem('db_people', JSON.stringify({ not: 'array' }));
    const r = validateAllData();
    expect(r.warnings.some(w => w.includes('db_people'))).toBe(true);
  });

  test('collects parse warnings for invalid JSON', () => {
    localStorage.setItem('db_properties', 'not-valid-json');
    const r = validateAllData();
    expect(r.warnings.some(w => w.includes('db_properties'))).toBe(true);
  });
});

describe('validateNewPerson', () => {
  test('fails without name', () => {
    const r = validateNewPerson({ رقم_الهاتف: '0791234567' });
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('الاسم مطلوب');
  });

  test('fails without phone', () => {
    const r = validateNewPerson({ الاسم: 'Test' });
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('رقم الهاتف مطلوب');
  });

  test('warning for non-Jordanian phone format', () => {
    const r = validateNewPerson({ الاسم: 'Test', رقم_الهاتف: '123456' });
    expect(r.warnings.some(w => w.includes('أردنية'))).toBe(true);
  });

  test('valid Jordanian phone passes', () => {
    const r = validateNewPerson({ الاسم: 'Test', رقم_الهاتف: '0791234567' });
    expect(r.errors).toHaveLength(0);
  });

  test('warning for invalid national ID format', () => {
    const r = validateNewPerson({ الاسم: 'T', رقم_الهاتف: '0791234567', الرقم_الوطني: '123' });
    expect(r.warnings.some(w => w.includes('الرقم الوطني'))).toBe(true);
  });

  test('error for duplicate national ID', () => {
    save(KEYS.PEOPLE, [{ ...makePerson('P1'), الرقم_الوطني: '1234567890' }]);
    const r = validateNewPerson({ الاسم: 'T', رقم_الهاتف: '0791234567', الرقم_الوطني: '1234567890' });
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.includes('1234567890'))).toBe(true);
  });

  test('warning for invalid extra phone', () => {
    const r = validateNewPerson({ الاسم: 'T', رقم_الهاتف: '0791234567', رقم_هاتف_اضافي: '999' } as any);
    expect(r.warnings.some(w => w.includes('الإضافي'))).toBe(true);
  });
});

describe('validateNewProperty', () => {
  test('fails without code', () => {
    const r = validateNewProperty({ رقم_المالك: 'P1', النوع: 'A', العنوان: 'B' } as any);
    expect(r.errors).toContain('الكود الداخلي مطلوب');
  });

  test('fails without owner', () => {
    const r = validateNewProperty({ الكود_الداخلي: 'C1', النوع: 'A', العنوان: 'B' } as any);
    expect(r.errors).toContain('المالك مطلوب');
  });

  test('fails without type', () => {
    const r = validateNewProperty({ الكود_الداخلي: 'C1', رقم_المالك: 'P1', العنوان: 'B' } as any);
    expect(r.errors).toContain('نوع العقار مطلوب');
  });

  test('fails without address', () => {
    const r = validateNewProperty({ الكود_الداخلي: 'C1', رقم_المالك: 'P1', النوع: 'A' } as any);
    expect(r.errors).toContain('العنوان مطلوب');
  });

  test('fails with duplicate code', () => {
    save(KEYS.PROPERTIES, [makeProperty('PR1', 'SAME', 'O1')]);
    const r = validateNewProperty({ الكود_الداخلي: 'SAME', رقم_المالك: 'P1', النوع: 'A', العنوان: 'B' } as any);
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.includes('SAME'))).toBe(true);
  });

  test('fails when owner not found', () => {
    const r = validateNewProperty({ الكود_الداخلي: 'NEW', رقم_المالك: 'MISSING', النوع: 'A', العنوان: 'B' } as any);
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.includes('MISSING'))).toBe(true);
  });

  test('passes with valid data', () => {
    save(KEYS.PEOPLE, [makePerson('P1')]);
    const r = validateNewProperty({ الكود_الداخلي: 'NEW', رقم_المالك: 'P1', النوع: 'A', العنوان: 'B' } as any);
    expect(r.isValid).toBe(true);
  });
});
