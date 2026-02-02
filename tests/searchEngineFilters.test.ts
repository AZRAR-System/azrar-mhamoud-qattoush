import { SearchEngine, type FilterRule } from '@/services/searchEngine';

describe('SearchEngine.applyFilters (normalized text + numbers)', () => {
  test('contains uses strict Arabic normalization (أ/إ/آ/ٱ and ى)', () => {
    const data = [{ name: 'أحمد علي' }, { name: 'إيمان' }, { name: 'فاطمة' }];

    const rules: FilterRule[] = [{ field: 'name', operator: 'contains', value: 'احمد' }];
    expect(SearchEngine.applyFilters(data, rules)).toEqual([{ name: 'أحمد علي' }]);

    const rules2: FilterRule[] = [{ field: 'name', operator: 'contains', value: 'ايمان' }];
    expect(SearchEngine.applyFilters(data, rules2)).toEqual([{ name: 'إيمان' }]);
  });

  test('strict mode does not fold ة/ه by default', () => {
    const data = [{ t: 'فاطمة' }, { t: 'فاطمه' }];

    const rules: FilterRule[] = [{ field: 't', operator: 'equals', value: 'فاطمه' }];
    expect(SearchEngine.applyFilters(data, rules)).toEqual([{ t: 'فاطمه' }]);
  });

  test('numeric comparisons accept Arabic/Indic digits', () => {
    const data = [{ v: '١٠٠٠' }, { v: '2000' }];

    const rules: FilterRule[] = [{ field: 'v', operator: 'gte', value: '1500' }];
    expect(SearchEngine.applyFilters(data, rules)).toEqual([{ v: '2000' }]);
  });

  test('between handles numeric strings robustly', () => {
    const data = [{ v: '١٠٠٠' }, { v: '1500' }, { v: '2000' }];
    const rules: FilterRule[] = [{ field: 'v', operator: 'between', value: ['١٢٠٠', '1800'] }];
    expect(SearchEngine.applyFilters(data, rules)).toEqual([{ v: '1500' }]);
  });
});
