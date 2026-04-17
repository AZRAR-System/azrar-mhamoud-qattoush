/**
 * Tests for src/services/db/properties.ts
 * Focuses on business logic: validation, referential integrity, IsRented sync
 */

// Mock dependencies
jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(() => []),
  save: jest.fn(),
}));

jest.mock('../../src/services/dataValidation', () => ({
  validateNewProperty: jest.fn(() => ({ isValid: true, errors: [], warnings: [] })),
}));

jest.mock('../../src/services/localDbStorage', () => ({
  dbOk: (data?: unknown) => ({ success: true, data }),
  dbFail: (message: string) => ({ success: false, message }),
}));

jest.mock('../../src/services/db/keys', () => ({
  KEYS: {
    PROPERTIES: 'db_properties',
    CONTRACTS: 'db_contracts',
    PEOPLE: 'db_people',
  },
}));

import { get, save } from '../../src/services/db/kv';
import { validateNewProperty } from '../../src/services/dataValidation';
import { addProperty, updateProperty, deleteProperty } from '../../src/services/db/properties';

const mockGet = get as jest.Mock;
const mockSave = save as jest.Mock;
const mockValidate = validateNewProperty as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReturnValue([]);
});

describe('addProperty', () => {
  it('returns fail when validation fails', () => {
    mockValidate.mockReturnValueOnce({ isValid: false, errors: ['الكود الداخلي مطلوب'], warnings: [] });
    const result = addProperty({ الكود_الداخلي: '', رقم_المالك: 'P1', النوع: 'شقة', العنوان: 'عنوان' } as any);
    expect(result.success).toBe(false);
  });

  it('returns ok with new property on success', () => {
    const result = addProperty({ الكود_الداخلي: 'P001', رقم_المالك: 'P1', النوع: 'شقة', العنوان: 'عنوان', حالة_العقار: 'شاغر' } as any);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('sets IsRented true when حالة_العقار is مؤجر', () => {
    const result = addProperty({ الكود_الداخلي: 'P001', رقم_المالك: 'P1', النوع: 'شقة', العنوان: 'عنوان', حالة_العقار: 'مؤجر' } as any);
    expect(result.success).toBe(true);
    expect((result.data as any)?.IsRented).toBe(true);
  });

  it('sets IsRented false when حالة_العقار is شاغر', () => {
    const result = addProperty({ الكود_الداخلي: 'P001', رقم_المالك: 'P1', النوع: 'شقة', العنوان: 'عنوان', حالة_العقار: 'شاغر' } as any);
    expect((result.data as any)?.IsRented).toBe(false);
  });

  it('saves to storage on success', () => {
    addProperty({ الكود_الداخلي: 'P001', رقم_المالك: 'P1', النوع: 'شقة', العنوان: 'عنوان' } as any);
    expect(mockSave).toHaveBeenCalled();
  });
});

describe('updateProperty', () => {
  const existing = [{ رقم_العقار: 'PROP-1', الكود_الداخلي: 'P001', حالة_العقار: 'شاغر', IsRented: false }];

  it('returns fail when property not found', () => {
    mockGet.mockReturnValue([]);
    const result = updateProperty('PROP-999', { حالة_العقار: 'مؤجر' } as any);
    expect(result.success).toBe(false);
  });

  it('updates property successfully', () => {
    mockGet.mockReturnValue([...existing]);
    const result = updateProperty('PROP-1', { العنوان: 'عنوان جديد' } as any);
    expect(result.success).toBe(true);
  });

  it('syncs IsRented when حالة_العقار changes to مؤجر', () => {
    mockGet.mockReturnValue([...existing]);
    const result = updateProperty('PROP-1', { حالة_العقار: 'مؤجر' } as any);
    expect((result.data as any)?.IsRented).toBe(true);
  });

  it('does not override explicit IsRented value', () => {
    mockGet.mockReturnValue([...existing]);
    const result = updateProperty('PROP-1', { حالة_العقار: 'مؤجر', IsRented: false } as any);
    expect((result.data as any)?.IsRented).toBe(false);
  });
});

describe('deleteProperty', () => {
  it('returns fail when active contracts exist', () => {
    mockGet
      .mockReturnValueOnce([{ رقم_العقار: 'PROP-1', حالة_العقد: 'سارية', isArchived: false }]) // get contracts
      .mockReturnValueOnce([]); // unused
    const result = deleteProperty('PROP-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('عقود سارية');
  });

  it('deletes successfully when no active contracts and saves', () => {
    mockGet
      .mockReturnValueOnce([]) // get contracts (empty)
      .mockReturnValueOnce([{ رقم_العقار: 'PROP-1' }]); // get properties (with PROP-1)
    
    const result = deleteProperty('PROP-1');
    expect(result.success).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });
});
