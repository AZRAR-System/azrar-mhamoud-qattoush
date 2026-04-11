import { jest } from '@jest/globals';
import { addPerson, updatePerson, getPersonById, updatePersonRoles, getPersonRoles } from '@/services/db/people';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('People Service Logic - Arabic Field Fix', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.PEOPLE, []);
    save(KEYS.ROLES, []);
  });

  it('addPerson: should create a person when valid Arabic fields are provided', async () => {
    // Valid fields according to validateNewPerson
    const data = { 
      الاسم: 'محمود قطوش', 
      رقم_الهاتف: '0790000000', 
      العنوان: 'عمان' 
    };
    
    const res = addPerson(data as any, ['Tenant']);
    
    // Wait for async migration IIFE to settle
    await new Promise(r => setTimeout(r, 10));

    expect(res.success).toBe(true);
    expect(res.data?.الاسم).toBe('محمود قطوش');
    
    // Verification of roles
    const roles = getPersonRoles(res.data!.رقم_الشخص);
    expect(roles).toContain('Tenant');
  });

  it('updatePerson: should persist changes in localStorage', () => {
    const pId = 'P-123';
    save(KEYS.PEOPLE, [{ رقم_الشخص: pId, الاسم: 'Old Name' }]);
    
    const res = updatePerson(pId, { الاسم: 'New Name' });
    expect(res.success).toBe(true);
    expect(getPersonById(pId)?.الاسم).toBe('New Name');
  });
});
