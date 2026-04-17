/**
 * Tests for src/services/db/people.ts
 * Focuses on: validation, referential integrity, roles management
 */

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(() => []),
  save: jest.fn(),
}));

jest.mock('../../src/services/dataValidation', () => ({
  validateNewPerson: jest.fn(() => ({ isValid: true, errors: [], warnings: [] })),
}));

jest.mock('../../src/services/localDbStorage', () => ({
  dbOk: (data?: unknown) => ({ success: true, data }),
  dbFail: (message: string) => ({ success: false, message }),
}));

jest.mock('../../src/services/db/keys', () => ({
  KEYS: {
    PEOPLE: 'db_people',
    ROLES: 'db_roles',
    PROPERTIES: 'db_properties',
    CONTRACTS: 'db_contracts',
    BLACKLIST: 'db_blacklist',
  },
}));

// Mocking domainMigrate since it might be accessed via requestDomainMigrate if it were separated.
// Note: In current people.ts it is a local const, but if it was imported this mock would be vital.
jest.mock('../../src/services/db/domainMigrate', () => ({
  requestDomainMigrate: jest.fn(),
}), { virtual: true });

import { get, save } from '../../src/services/db/kv';
import { validateNewPerson } from '../../src/services/dataValidation';
import { addPerson, updatePerson, deletePerson } from '../../src/services/db/people';

const mockGet = get as jest.Mock;
const mockSave = save as jest.Mock;
const mockValidate = validateNewPerson as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReturnValue([]);
});

describe('addPerson', () => {
  it('returns fail when validation fails', () => {
    mockValidate.mockReturnValueOnce({ isValid: false, errors: ['الاسم مطلوب'], warnings: [] });
    const result = addPerson({ الاسم: '', رقم_الهاتف: '' } as any, []);
    expect(result.success).toBe(false);
    expect(result.message).toContain('الاسم مطلوب');
  });

  it('returns ok with new person on success', () => {
    const result = addPerson({ الاسم: 'أحمد', رقم_الهاتف: '0799000000' } as any, []);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('generates unique id starting with P-', () => {
    const result = addPerson({ الاسم: 'أحمد', رقم_الهاتف: '0799000000' } as any, []);
    expect((result.data as any)?.رقم_الشخص).toMatch(/^P-/);
  });

  it('saves roles when provided', () => {
    addPerson({ الاسم: 'أحمد', رقم_الهاتف: '0799000000' } as any, ['مالك']);
    expect(mockSave).toHaveBeenCalledTimes(2); // people + roles
  });

  it('saves to storage on success', () => {
    addPerson({ الاسم: 'أحمد', رقم_الهاتف: '0799000000' } as any, []);
    expect(mockSave).toHaveBeenCalled();
  });
});

describe('updatePerson', () => {
  const existing = [{ رقم_الشخص: 'P-1', الاسم: 'أحمد', رقم_الهاتف: '0799000000' }];

  it('returns fail when person not found', () => {
    mockGet.mockReturnValue([]);
    const result = updatePerson('P-999', { الاسم: 'محمد' } as any);
    expect(result.success).toBe(false);
  });

  it('updates person successfully', () => {
    mockGet.mockReturnValue([...existing]);
    const result = updatePerson('P-1', { الاسم: 'محمد' } as any);
    expect(result.success).toBe(true);
    expect((result.data as any)?.الاسم).toBe('محمد');
  });

  it('saves after update', () => {
    mockGet.mockReturnValue([...existing]);
    updatePerson('P-1', { الاسم: 'محمد' } as any);
    expect(mockSave).toHaveBeenCalled();
  });
});

describe('deletePerson', () => {
  it('returns fail when person owns properties', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'db_properties') return [{ رقم_المالك: 'P-1' }];
      return [];
    });
    const result = deletePerson('P-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('عقارات');
  });

  it('returns fail when person has contracts', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'db_contracts') return [{ رقم_المستاجر: 'P-1' }];
      return [];
    });
    const result = deletePerson('P-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('عقود');
  });

  it('deletes successfully when no constraints', () => {
    mockGet
      .mockReturnValueOnce([]) // no properties
      .mockReturnValueOnce([]) // no contracts
      .mockReturnValueOnce([{ رقم_الشخص: 'P-1' }]) // people
      .mockReturnValueOnce([]); // roles
    const result = deletePerson('P-1');
    expect(result.success).toBe(true);
  });

  it('saves people and roles after delete', () => {
    mockGet
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ رقم_الشخص: 'P-1' }])
      .mockReturnValueOnce([]);
    deletePerson('P-1');
    expect(mockSave).toHaveBeenCalledTimes(2); // people + roles
  });
});
