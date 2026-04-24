import { get, save } from '../../src/services/db/kv';
import { DbCache } from '../../src/services/dbCache';

describe('KV Store Real Integrity', () => {
  beforeEach(() => {
    localStorage.clear();
    DbCache.isInitialized = true;
    DbCache.arrays = {};
  });

  test('True Deep Clone - modifying returned array/object does not leak to cache', () => {
    const original = [{ id: '1', meta: { val: 100 } }];
    save('test_key', original);
    
    // First retrieval and mutation
    const retrieved = get<any>('test_key');
    retrieved[0].meta.val = 999;
    retrieved.push({ id: '2', meta: { val: 200 } });

    // Second retrieval should still be original
    const second = get<any>('test_key');
    expect(second).toHaveLength(1);
    expect(second[0].meta.val).toBe(100);
  });

  test('Scalability - handles 1000 records correctly', () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      id: `ID-${i}`,
      value: Math.random()
    }));

    save('large_data', largeData);
    const retrieved = get('large_data');
    
    expect(retrieved).toHaveLength(1000);
    expect((retrieved[999] as any).id).toBe('ID-999');
  });

  test('Validation Rejection - invalid data should throw or return fail', () => {
    // Note: save() in kv.ts uses validateBeforeSave
    // If validation fails, it throws or returns something. Let's check kv.ts.
    // Line 31: if (!validation.valid) { const errorMsg = ... throw new Error(errorMsg); }
    
    const invalidData = [{ رقم_الشخص: 'P1' }]; // Missing 'الاسم' for PEOPLE key
    
    expect(() => {
      save('db_people', invalidData); // Using the actual key from KEYS.PEOPLE
    }).toThrow();
  });
});
