import { 
  getLookupsByCategory,
  addLookupItem,
  deleteLookupItem,
  updateLookupItem,
  getLookupCategories,
  addLookupCategory,
  updateLookupCategory,
  deleteLookupCategory,
  importLookups
} from '@/services/db/system/lookups';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Lookups System Service - Data Dictionary Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
    jest.clearAllMocks();
  });

  describe('Category Management', () => {
    test('addLookupCategory - creates new category', () => {
      const res = addLookupCategory('PROPERTY_TYPE', 'Property Types');
      expect(res.success).toBe(true);
      
      const cats = getLookupCategories();
      expect(cats).toHaveLength(1);
      expect(cats[0].name).toBe('PROPERTY_TYPE');
      expect(cats[0].label).toBe('Property Types');
    });

    test('updateLookupCategory - modifies existing category', () => {
      addLookupCategory('T1', 'Old Label');
      updateLookupCategory('T1', { label: 'New Label' });
      
      const cats = getLookupCategories();
      expect(cats[0].label).toBe('New Label');
    });

    test('deleteLookupCategory - removes category and its items', () => {
      addLookupCategory('CAT1', 'L1');
      addLookupItem('CAT1', 'Item 1');
      
      deleteLookupCategory('CAT1');
      
      expect(getLookupCategories()).toHaveLength(0);
      expect(getLookupsByCategory('CAT1')).toHaveLength(0);
    });
  });

  describe('Item Management', () => {
    test('addLookupItem - adds items to a category', () => {
      addLookupItem('COLORS', 'Red');
      addLookupItem('COLORS', 'Blue');
      
      const items = getLookupsByCategory('COLORS');
      expect(items).toHaveLength(2);
      expect(items.map(i => i.label)).toContain('Red');
      expect(items.map(i => i.label)).toContain('Blue');
    });

    test('addLookupItem - prevents duplicates in same category', () => {
      addLookupItem('COLORS', 'Red');
      const res = addLookupItem('COLORS', 'Red');
      expect(res.success).toBe(false);
      expect(res.message).toBe('العنصر موجود مسبقاً');
    });

    test('updateLookupItem - changes label and key', () => {
      addLookupItem('CAT', 'Old');
      const item = getLookupsByCategory('CAT')[0];
      
      updateLookupItem(item.id, 'New');
      const updated = getLookupsByCategory('CAT')[0];
      expect(updated.label).toBe('New');
      expect(updated.key).toBeDefined();
    });

    test('deleteLookupItem - removes specific item', () => {
      addLookupItem('CAT', 'I1');
      const item = getLookupsByCategory('CAT')[0];
      deleteLookupItem(item.id);
      expect(getLookupsByCategory('CAT')).toHaveLength(0);
    });
  });

  describe('Importing', () => {
    test('importLookups - adds multiple items skipping duplicates', () => {
      addLookupItem('CAT', 'Existing');
      importLookups('CAT', ['Existing', 'New 1', 'New 2', '']);
      
      const items = getLookupsByCategory('CAT');
      expect(items).toHaveLength(3); // Existing + 2 new
      expect(items.map(i => i.label)).toContain('New 1');
      expect(items.map(i => i.label)).toContain('New 2');
    });
  });

  describe('getLookupCategories normalization', () => {
    test('merges system and custom categories by key', () => {
      kv.save(KEYS.LOOKUP_CATEGORIES, [
        { id: '1', name: 'CAT', label: 'Custom', key: 'cat', isSystem: false },
        { id: '2', name: 'CAT_SYS', label: 'System', key: 'cat', isSystem: true }
      ]);
      
      const cats = getLookupCategories();
      expect(cats).toHaveLength(1);
      expect(cats[0].label).toBe('System'); // System overrides custom for same key
    });
  });
});
