import { jest } from '@jest/globals';
import { 
  checkPrimaryKeyDuplicates, 
  checkUniqueConstraints, 
  checkForeignKeyIntegrity, 
  checkBusinessLogic,
  validateNewPerson, 
  validateNewProperty 
} from '@/services/dataValidation';

describe('Data Validation Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('checkPrimaryKeyDuplicates: should identify rows with same ID in a table', () => {
    localStorage.setItem('db_people', JSON.stringify([
      { رقم_الشخص: 'P1', الاسم: 'A' },
      { رقم_الشخص: 'P1', الاسم: 'B' }
    ]));
    
    const res = checkPrimaryKeyDuplicates();
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('P1');
  });

  it('checkForeignKeyIntegrity: should identify missing entity references', () => {
    localStorage.setItem('db_properties', JSON.stringify([
      { رقم_العقار: 'PR1', رقم_المالك: 'P-MISSING', الكود_الداخلي: 'V1' }
    ]));
    
    const res = checkForeignKeyIntegrity();
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('المالك P-MISSING غير موجود');
  });

  it('checkBusinessLogic: should flag rented properties without active contracts', () => {
    localStorage.setItem('db_properties', JSON.stringify([
      { رقم_العقار: 'PR1', الكود_الداخلي: 'V1', IsRented: true }
    ]));
    localStorage.setItem('db_contracts', JSON.stringify([])); // Empty

    const res = checkBusinessLogic();
    expect(res.warnings.some(w => w.includes('V1') && w.includes('لا يوجد عقد نشط'))).toBe(true);
  });

  it('validateNewPerson: should validate required fields', () => {
    const res = validateNewPerson({ الاسم: '' });
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain('الاسم مطلوب');
  });
});
