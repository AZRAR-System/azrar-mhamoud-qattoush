/**
 * Tests for src/utils/dateOnly.ts
 * Critical utility used across contracts, installments, and reports
 */

import {
  formatDateOnly,
  toDateOnlyISO,
  toDateOnly,
  parseDateOnly,
  daysBetweenDateOnly,
  daysBetweenDateOnlySafe,
  isBeforeTodayDateOnly,
  compareDateOnlySafe,
  addDaysDateOnly,
} from '../../src/utils/dateOnly';

describe('formatDateOnly', () => {
  it('formats date correctly', () => {
    expect(formatDateOnly(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('pads month and day with zeros', () => {
    expect(formatDateOnly(new Date(2026, 2, 5))).toBe('2026-03-05');
  });
});

describe('toDateOnlyISO', () => {
  it('converts valid ISO string', () => {
    expect(toDateOnlyISO('2026-04-15')).toBe('2026-04-15');
  });

  it('returns null for null', () => {
    expect(toDateOnlyISO(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toDateOnlyISO(undefined)).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(toDateOnlyISO('not-a-date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(toDateOnlyISO('')).toBeNull();
  });

  it('handles Date object', () => {
    const result = toDateOnlyISO(new Date(2026, 3, 15));
    expect(result).toBe('2026-04-15');
  });
});

describe('parseDateOnly', () => {
  it('parses ISO date string correctly', () => {
    const d = parseDateOnly('2026-04-15')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(15);
  });

  it('month is 0-indexed internally', () => {
    const d = parseDateOnly('2026-01-01')!;
    expect(d.getMonth()).toBe(0);
  });
});

describe('daysBetweenDateOnly', () => {
  it('returns 0 for same date', () => {
    const d = new Date(2026, 0, 1);
    expect(daysBetweenDateOnly(d, d)).toBe(0);
  });

  it('returns positive for future date', () => {
    const from = new Date(2026, 0, 1);
    const to = new Date(2026, 0, 10);
    expect(daysBetweenDateOnly(from, to)).toBe(9);
  });

  it('returns negative for past date', () => {
    const from = new Date(2026, 0, 10);
    const to = new Date(2026, 0, 1);
    expect(daysBetweenDateOnly(from, to)).toBe(-9);
  });
});

describe('daysBetweenDateOnlySafe', () => {
  it('returns null for invalid inputs', () => {
    expect(daysBetweenDateOnlySafe(null, null)).toBeNull();
  });

  it('returns null if one input is invalid', () => {
    expect(daysBetweenDateOnlySafe('2026-01-01', null)).toBeNull();
  });

  it('calculates days between valid ISO strings', () => {
    expect(daysBetweenDateOnlySafe('2026-01-01', '2026-01-11')).toBe(10);
  });
});

describe('isBeforeTodayDateOnly', () => {
  it('returns true for past date', () => {
    expect(isBeforeTodayDateOnly('2020-01-01')).toBe(true);
  });

  it('returns false for future date', () => {
    expect(isBeforeTodayDateOnly('2099-12-31')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isBeforeTodayDateOnly(null)).toBe(false);
  });

  it('returns false for invalid date', () => {
    expect(isBeforeTodayDateOnly('invalid')).toBe(false);
  });
});

describe('compareDateOnlySafe', () => {
  it('returns 0 for equal dates', () => {
    expect(compareDateOnlySafe('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('returns a positive value when a > b', () => {
    const result = compareDateOnlySafe('2026-02-01', '2026-01-01');
    expect(result).toBeGreaterThan(0);
  });

  it('returns a negative value when a < b', () => {
    const result = compareDateOnlySafe('2026-01-01', '2026-02-01');
    expect(result).toBeLessThan(0);
  });

  it('returns 0 when both null', () => {
    expect(compareDateOnlySafe(null, null)).toBe(0);
  });

  it('returns -1 when a is null', () => {
    expect(compareDateOnlySafe(null, '2026-01-01')).toBe(-1);
  });

  it('returns 1 when b is null', () => {
    expect(compareDateOnlySafe('2026-01-01', null)).toBe(1);
  });
});

describe('addDaysDateOnly', () => {
  it('adds days correctly', () => {
    const d = new Date(2026, 0, 1);
    const result = addDaysDateOnly(d, 10);
    expect(result.getDate()).toBe(11);
  });

  it('handles month rollover', () => {
    const d = new Date(2026, 0, 25);
    const result = addDaysDateOnly(d, 10);
    expect(result.getMonth()).toBe(1);
  });

  it('handles negative days', () => {
    const d = new Date(2026, 0, 10);
    const result = addDaysDateOnly(d, -5);
    expect(result.getDate()).toBe(5);
  });
});
