import { SearchEngine } from '@/services/searchEngine';

describe('SearchEngine.applyFilters edge branches', () => {
  test('returns original data when rules array is empty', () => {
    const rows = [{ a: 1 }];
    expect(SearchEngine.applyFilters(rows, [])).toBe(rows);
  });

  test('returns data when rules is nullish', () => {
    const rows = [{ a: 1 }];
    expect(SearchEngine.applyFilters(rows, null as unknown as [])).toEqual(rows);
  });

  test('excludes item when field value is null or undefined', () => {
    const r = SearchEngine.applyFilters(
      [{ x: null }, { x: undefined }, { x: 'ok' }] as { x: unknown }[],
      [{ field: 'x', operator: 'equals', value: 'ok' }]
    );
    expect(r).toHaveLength(1);
  });

  test('between rejects when range bounds are not finite', () => {
    const r = SearchEngine.applyFilters([{ n: 5 }], [
      { field: 'n', operator: 'between', value: [1, null] },
    ]);
    expect(r).toHaveLength(0);
  });

  test('in operator requires array value and membership', () => {
    expect(
      SearchEngine.applyFilters([{ k: 'a' }], [{ field: 'k', operator: 'in', value: ['a', 'b'] }])
    ).toHaveLength(1);
    expect(
      SearchEngine.applyFilters([{ k: 'z' }], [{ field: 'k', operator: 'in', value: ['a'] }])
    ).toHaveLength(0);
    expect(
      SearchEngine.applyFilters([{ k: 'a' }], [{ field: 'k', operator: 'in', value: 'bad' }])
    ).toHaveLength(0);
  });

  test('gte uses numeric coercion for string field values', () => {
    const r = SearchEngine.applyFilters([{ v: '10' }], [{ field: 'v', operator: 'gte', value: 5 }]);
    expect(r).toHaveLength(1);
  });
});
