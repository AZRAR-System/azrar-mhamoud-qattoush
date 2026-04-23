import { get, save } from '../../src/services/db/kv';
import { DbCache } from '../../src/services/dbCache';

describe('KV Store Protection', () => {
  beforeEach(() => {
    localStorage.clear();
    DbCache.isInitialized = true;
    DbCache.arrays = {};
  });

  test('Deep Clone works (modifying retrieved data doesn\'t affect cache)', () => {
    const original = [{ id: 1, meta: { active: true } }];
    save('test_key', original);
    
    const retrieved = get<any>('test_key');
    retrieved[0].meta.active = false; // Mutate
    
    const secondRetrieval = get<any>('test_key');
    expect(secondRetrieval[0].meta.active).toBe(true); // Should remain true
  });

  test('Save and read work correctly', () => {
    const data = [{ name: 'Alice' }, { name: 'Bob' }];
    save('users', data);
    
    const result = get('users');
    expect(result).toHaveLength(2);
    expect(result).toEqual(data);
  });
});
