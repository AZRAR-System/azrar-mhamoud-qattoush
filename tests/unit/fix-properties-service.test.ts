/**
 * Tests for src/services/db/properties.ts
 * Focuses on business logic: validation, referential integrity, IsRented sync
 */

import { addProperty, updateProperty, deleteProperty } from '../../src/services/db/properties';
import { get, save } from '../../src/services/db/kv';
import { validateNewProperty } from '../../src/services/dataValidation';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/services/dataValidation', () => ({
  validateNewProperty: jest.fn(),
}));

jest.mock('../../src/services/localDbStorage', () => ({
  dbOk: (data?: unknown) => ({ success: true, data }),
  dbFail: (message: string) => ({ success: false, message }),
}));

describe('Properties Real Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addProperty', () => {
    test('successfully adds property and verifies all fields', () => {
      (validateNewProperty as jest.Mock).mockReturnValue({ isValid: true });
      (get as jest.Mock).mockReturnValue([]);
      
      const payload = { 
        الكود_الداخلي: 'P-100', 
        رقم_المالك: 'OWN-1', 
        النوع: 'شقة', 
        حالة_العقار: 'شاغر' 
      };
      
      const result = addProperty(payload as any);
      
      expect(result.success).toBe(true);
      const added = result.data as any;
      expect(added.الكود_الداخلي).toBe('P-100');
      expect(added.IsRented).toBe(false);
      expect(added.رقم_العقار).toMatch(/^PROP-/);
      
      // Verify save content
      expect(save).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining([
        expect.objectContaining({ الكود_الداخلي: 'P-100' })
      ]));
    });

    test('syncs IsRented correctly on creation', () => {
      (validateNewProperty as jest.Mock).mockReturnValue({ isValid: true });
      (get as jest.Mock).mockReturnValue([]);

      const result = addProperty({ حالة_العقار: 'مؤجر' } as any);
      expect((result.data as any).IsRented).toBe(true);
    });
  });

  describe('updateProperty', () => {
    test('updates specific fields and preserves others', () => {
      const existing = [{ رقم_العقار: 'prop_1', العنوان: 'العنوان القديم', حالة_العقار: 'شاغر' }];
      (get as jest.Mock).mockReturnValue(existing);

      const result = updateProperty('prop_1', { العنوان: 'العنوان الجديد' } as any);
      
      expect(result.success).toBe(true);
      expect((result.data as any).العنوان).toBe('العنوان الجديد');
      expect((result.data as any).حالة_العقار).toBe('شاغر'); // Preserved
    });

    test('blocking invalid updates should happen here if implemented', () => {
      // If we have logic to prevent certain updates, test it here.
    });
  });

  describe('deleteProperty', () => {
    test('prevents deletion if active contracts exist', () => {
      // Mock contracts to return one active contract for this property
      (get as jest.Mock).mockImplementation((key) => {
        if (key.includes('contracts')) {
          return [{ رقم_العقار: 'prop_1', حالة_العقد: 'نشط', isArchived: false }];
        }
        return [{ رقم_العقار: 'prop_1' }];
      });

      const result = deleteProperty('prop_1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('عقود سارية');
    });
  });
});
