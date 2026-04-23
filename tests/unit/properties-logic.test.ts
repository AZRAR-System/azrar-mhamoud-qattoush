import { 
  addProperty, 
  updateProperty, 
  deleteProperty, 
  getPropertyDetails 
} from '../../src/services/db/properties';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/services/dataValidation', () => ({
  validateNewProperty: jest.fn(() => ({ isValid: true, errors: [] })),
}));

describe('Properties Logic - Comprehensive Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Create Property
  test('addProperty - creates a new property and sets IsRented based on status', () => {
    (get as jest.Mock).mockReturnValue([]);
    const res = addProperty({ 
      الكود_الداخلي: 'P-01', 
      رقم_المالك: 'O1', 
      حالة_العقار: 'مؤجر',
      النوع: 'Apartment',
      العنوان: 'Amman',
      المساحة: 100
    } as any);
    
    expect(res.success).toBe(true);
    expect(res.data?.IsRented).toBe(true);
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved[0].الكود_الداخلي).toBe('P-01');
  });

  // 2. Update Property Status
  test('updateProperty - changing status to شاغر updates IsRented to false', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_العقار: 'P1', حالة_العقار: 'مؤجر', IsRented: true }]);
    const res = updateProperty('P1', { حالة_العقار: 'شاغر' });
    
    expect(res.success).toBe(true);
    expect(res.data?.IsRented).toBe(false);
  });

  // 3. Update Other Fields
  test('updateProperty - updates area and address without losing other data', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_العقار: 'P1', الكود_الداخلي: 'P-01', المساحة: 100 }]);
    const res = updateProperty('P1', { المساحة: 120 });
    
    expect(res.success).toBe(true);
    expect(res.data?.المساحة).toBe(120);
    expect(res.data?.الكود_الداخلي).toBe('P-01');
  });

  // 4. Delete Protection (Active Contract)
  test('deleteProperty - blocks deletion if property has active contract', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقار: 'P1', حالة_العقد: 'نشط', isArchived: false }];
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1' }];
      return [];
    });
    
    const res = deleteProperty('P1');
    expect(res.success).toBe(false);
    expect(res.message).toContain('عقود سارية');
  });

  // 5. Successful Deletion
  test('deleteProperty - deletes if only archived or ended contracts exist', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقار: 'P1', حالة_العقد: 'منتهي', isArchived: true }];
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1' }];
      return [];
    });
    
    const res = deleteProperty('P1');
    expect(res.success).toBe(true);
    const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.PROPERTIES)[1];
    expect(saved).toHaveLength(0);
  });

  // 6. Detailed View - Aggregation
  test('getPropertyDetails - aggregates owner, contract and tenant correctly', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1', رقم_المالك: 'O1' }];
      if (key === KEYS.PEOPLE) return [{ رقم_الشخص: 'O1', الاسم: 'Owner' }, { رقم_الشخص: 'T1', الاسم: 'Tenant' }];
      if (key === KEYS.CONTRACTS) return [{ رقم_العقار: 'P1', رقم_المستاجر: 'T1', تاريخ_النهاية: '2026-12-31', حالة_العقد: 'نشط' }];
      return [];
    });
    
    const details = getPropertyDetails('P1');
    expect(details?.owner?.الاسم).toBe('Owner');
    expect(details?.currentTenant?.الاسم).toBe('Tenant');
    expect(details?.currentContract?.رقم_المستاجر).toBe('T1');
  });

  // 7. Detailed View - Missing Data
  test('getPropertyDetails - returns null for non-existent property', () => {
    (get as jest.Mock).mockReturnValue([]);
    expect(getPropertyDetails('X')).toBeNull();
  });

  // 8. Update - Rejection of Non-Existent
  test('updateProperty - fails for invalid id', () => {
    (get as jest.Mock).mockReturnValue([]);
    const res = updateProperty('X', { المساحة: 1 });
    expect(res.success).toBe(false);
  });
});
