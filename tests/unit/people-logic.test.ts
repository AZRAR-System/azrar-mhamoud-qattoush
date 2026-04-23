import { 
  addPerson, 
  updatePerson, 
  deletePerson, 
  getPersonById,
  getPersonDetails,
  updateTenantRatingImpl,
  addToBlacklist,
  getPeopleByRole,
  upsertContactBookInternal,
  getContactsDirectoryInternal
} from '../../src/services/db/people';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/services/dataValidation', () => ({
  validateNewPerson: jest.fn(() => ({ isValid: true, errors: [] })),
}));

jest.mock('../../src/services/storage', () => ({
  storage: { isDesktop: () => false }
}));

describe('People Logic - Comprehensive Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Create Person
  test('addPerson - creates a new person with roles', () => {
    (get as jest.Mock).mockReturnValue([]);
    const res = addPerson({ الاسم: 'محمد', رقم_الهاتف: '079123' } as any, ['Tenant']);
    
    expect(res.success).toBe(true);
    expect(res.data?.الاسم).toBe('محمد');
    const savedPeople = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.PEOPLE)[1];
    expect(savedPeople[0].الاسم).toBe('محمد');
    const savedRoles = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.ROLES)[1];
    expect(savedRoles[0].الدور).toBe('Tenant');
  });

  // 2. Update Person
  test('updatePerson - updates basic fields', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_الشخص: 'P1', الاسم: 'قديم' }]);
    const res = updatePerson('P1', { الاسم: 'جديد' });
    
    expect(res.success).toBe(true);
    expect(res.data?.الاسم).toBe('جديد');
  });

  // 3. Delete Protection (Property Owner)
  test('deletePerson - blocks deletion if person is an owner with properties', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.PROPERTIES) return [{ رقم_المالك: 'P1' }];
      if (key === KEYS.PEOPLE) return [{ رقم_الشخص: 'P1' }];
      return [];
    });
    
    const res = deletePerson('P1');
    expect(res.success).toBe(false);
    expect(res.message).toContain('عقارات مرتبطة');
  });

  // 4. Delete Protection (Tenant)
  test('deletePerson - blocks deletion if person has active contracts', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.PROPERTIES) return [];
      if (key === KEYS.CONTRACTS) return [{ رقم_المستاجر: 'P1' }];
      if (key === KEYS.PEOPLE) return [{ رقم_الشخص: 'P1' }];
      return [];
    });
    
    const res = deletePerson('P1');
    expect(res.success).toBe(false);
    expect(res.message).toContain('عقود مرتبطة');
  });

  // 5. Success Deletion
  test('deletePerson - deletes person and roles if no dependencies', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.PEOPLE) return [{ رقم_الشخص: 'P1' }];
      if (key === KEYS.ROLES) return [{ رقم_الشخص: 'P1', الدور: 'Tenant' }];
      return [];
    });
    
    const res = deletePerson('P1');
    expect(res.success).toBe(true);
    const savedPeople = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.PEOPLE)[1];
    expect(savedPeople).toHaveLength(0);
  });

  // 6. Rating Logic
  test('updateTenantRatingImpl - adjusts points and type based on payment', () => {
    let people = [{ رقم_الشخص: 'T1', تصنيف_السلوك: { type: 'جيد', points: 70, history: [] } }];
    (get as jest.Mock).mockReturnValue(people);
    (save as jest.Mock).mockImplementation((key, data) => { if (key === KEYS.PEOPLE) people = data; });

    // Late payment (-20)
    updateTenantRatingImpl('T1', 'late');
    expect(people[0].تصنيف_السلوك?.points).toBe(50);
    expect(people[0].تصنيف_السلوك?.type).toBe('مقبول (متذبذب)');

    // Full payment (+5)
    updateTenantRatingImpl('T1', 'full');
    expect(people[0].تصنيف_السلوك?.points).toBe(55);
  });

  // 7. Blacklist Implementation
  test('addToBlacklist - deactivates old records and adds new one', () => {
    (get as jest.Mock).mockReturnValue([{ personId: 'P1', isActive: true }]);
    addToBlacklist({ personId: 'P1', reason: 'Non-payment' } as any);
    
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved).toHaveLength(2);
    expect(saved[0].isActive).toBe(false); // Old one
    expect(saved[1].isActive).toBe(true); // New one
  });

  // 8. Role Filtering
  test('getPeopleByRole - returns correct people for a role', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.PEOPLE) return [{ رقم_الشخص: 'P1' }, { رقم_الشخص: 'P2' }];
      if (key === KEYS.ROLES) return [{ رقم_الشخص: 'P1', الدور: 'Owner' }, { رقم_الشخص: 'P2', الدور: 'Tenant' }];
      return [];
    });
    
    const owners = getPeopleByRole('Owner');
    expect(owners).toHaveLength(1);
    expect(owners[0].رقم_الشخص).toBe('P1');
  });

  // 9. Contact Book Logic
  test('upsertContactBookInternal - updates existing contact by phone', () => {
    (get as jest.Mock).mockReturnValue([{ id: 'C1', name: 'Old', phone: '079' }]);
    const res = upsertContactBookInternal({ name: 'New', phone: '079' });
    
    expect(res.success).toBe(true);
    expect(res.data?.created).toBe(false);
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved[0].name).toBe('New');
  });

  // 10. Unified Directory
  test('getContactsDirectoryInternal - merges people and local contacts', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.PEOPLE) return [{ رقم_الشخص: 'P1', الاسم: 'Person' }];
      if (key === KEYS.ROLES) return [];
      if (key === KEYS.CONTACTS) return [{ id: 'L1', name: 'Local', phone: '123' }];
      return [];
    });
    
    const dir = getContactsDirectoryInternal();
    expect(dir).toHaveLength(2);
    expect(dir.some(i => i.source === 'person')).toBe(true);
    expect(dir.some(i => i.source === 'local')).toBe(true);
  });
});
