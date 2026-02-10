/** @jest-environment node */

let normalizeKvValueOnWrite;

beforeAll(async () => {
  ({ normalizeKvValueOnWrite } = await import('../../electron/utils/kvInvariants.js'));
});

describe('kv invariants', () => {
  test('no-op for other keys', () => {
    const input = JSON.stringify([{ a: 1 }]);
    expect(normalizeKvValueOnWrite('db_people', input)).toBe(input);
  });

  test('no-op for non-array JSON', () => {
    const input = JSON.stringify({ hello: 'world' });
    expect(normalizeKvValueOnWrite('db_contracts', input)).toBe(input);
  });

  test('defaults تكرار_الدفع to 12 when invalid', () => {
    const inputArr = [
      { id: 'c1', تكرار_الدفع: 0 },
      { id: 'c2' },
      { id: 'c3', تكرار_الدفع: 6 },
      'raw',
    ];
    const input = JSON.stringify(inputArr);

    const out = normalizeKvValueOnWrite('db_contracts', input);
    const parsed = JSON.parse(out);

    expect(parsed[0].تكرار_الدفع).toBe(12);
    expect(parsed[1].تكرار_الدفع).toBe(12);
    expect(parsed[2].تكرار_الدفع).toBe(6);
    expect(parsed[3]).toBe('raw');
  });

  test('keeps value unchanged when already valid', () => {
    const input = JSON.stringify([{ id: 'c1', تكرار_الدفع: 12 }]);
    expect(normalizeKvValueOnWrite('db_contracts', input)).toBe(input);
  });
});
