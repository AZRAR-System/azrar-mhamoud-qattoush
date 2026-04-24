import { SearchEngine, FilterRule } from '@/services/searchEngine';

const data = [
  { name: 'أحمد', age: 30, date: '2026-01-15', status: 'active' },
  { name: 'سارة', age: 25, date: '2026-03-10', status: 'inactive' },
  { name: 'محمد', age: 35, date: '2026-06-20', status: 'active' },
];

describe('SearchEngine.applyFilters', () => {
  test('returns all data when no rules', () => {
    expect(SearchEngine.applyFilters(data, [])).toHaveLength(3);
  });

  test('contains filter', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'name', operator: 'contains', value: 'أحمد' }]);
    expect(r).toHaveLength(1);
  });

  test('equals filter', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'status', operator: 'equals', value: 'active' }]);
    expect(r).toHaveLength(2);
  });

  test('returns false when field value is null', () => {
    const d = [{ name: null, age: 30 }];
    const r = SearchEngine.applyFilters(d, [{ field: 'name', operator: 'contains', value: 'x' }]);
    expect(r).toHaveLength(0);
  });

  test('returns false when field value is undefined', () => {
    const d = [{ age: 30 }] as any[];
    const r = SearchEngine.applyFilters(d, [{ field: 'name', operator: 'contains', value: 'x' }]);
    expect(r).toHaveLength(0);
  });

  test('gte filter - passes', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'age', operator: 'gte', value: 30 }]);
    expect(r).toHaveLength(2);
  });

  test('gte filter - fails when value non-numeric', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'age', operator: 'gte', value: 'abc' }]);
    expect(r).toHaveLength(0);
  });

  test('lte filter - passes', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'age', operator: 'lte', value: 30 }]);
    expect(r).toHaveLength(2);
  });

  test('lte filter - fails when field non-numeric', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'name', operator: 'lte', value: 30 }]);
    expect(r).toHaveLength(0);
  });

  test('between filter - passes', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'age', operator: 'between', value: [25, 32] }]);
    expect(r).toHaveLength(2);
  });

  test('between filter - fails when range has non-numeric', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'age', operator: 'between', value: ['abc', 'xyz'] }]);
    expect(r).toHaveLength(0);
  });

  test('between filter - fails when field non-numeric', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'name', operator: 'between', value: [1, 100] }]);
    expect(r).toHaveLength(0);
  });

  test('dateBetween filter - passes', () => {
    const r = SearchEngine.applyFilters(data, [{
      field: 'date', operator: 'dateBetween', value: ['2026-01-01', '2026-04-01']
    }]);
    expect(r).toHaveLength(2);
  });

  test('dateBetween filter - excludes outside range', () => {
    const r = SearchEngine.applyFilters(data, [{
      field: 'date', operator: 'dateBetween', value: ['2026-07-01', '2026-12-31']
    }]);
    expect(r).toHaveLength(0);
  });

  test('in filter - passes', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'status', operator: 'in', value: ['active'] }]);
    expect(r).toHaveLength(2);
  });

  test('in filter - fails when value not array', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'status', operator: 'in', value: 'active' }]);
    expect(r).toHaveLength(0);
  });

  test('unknown operator returns true (passes all)', () => {
    const r = SearchEngine.applyFilters(data, [{ field: 'name', operator: 'unknown' as any, value: 'x' }]);
    expect(r).toHaveLength(3);
  });

  test('multiple rules - AND logic', () => {
    const r = SearchEngine.applyFilters(data, [
      { field: 'status', operator: 'equals', value: 'active' },
      { field: 'age', operator: 'gte', value: 32 },
    ]);
    expect(r).toHaveLength(1);
    expect((r[0] as any).name).toBe('محمد');
  });
});
