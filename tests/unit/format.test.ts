import {
  roundCurrency,
  formatNumber,
  formatCurrencyJOD,
  formatDateYMD,
  formatMonthYear,
  formatTimeHM,
  formatTimeFromHM,
  formatFileSize,
} from '@/utils/format';

describe('roundCurrency', () => {
  test('rounds to 2 decimal places', () => {
    expect(roundCurrency(1.006)).toBe(1.01);
    expect(roundCurrency(1.004)).toBe(1);
    expect(roundCurrency(0)).toBe(0);
    expect(roundCurrency(2.5)).toBe(2.5);
  });
});

describe('formatNumber', () => {
  test('formats finite number', () => {
    const r = formatNumber(1000);
    expect(r).toBeTruthy();
  });
  test('handles non-number input', () => {
    expect(formatNumber('abc')).toBe(formatNumber(0));
  });
  test('handles NaN', () => {
    expect(formatNumber(NaN)).toBe(formatNumber(0));
  });
});

describe('formatCurrencyJOD', () => {
  test('formats currency value', () => {
    const r = formatCurrencyJOD(100);
    expect(r).toContain('100');
  });
  test('handles null input', () => {
    expect(() => formatCurrencyJOD(null)).not.toThrow();
  });
});

describe('formatDateYMD', () => {
  test('returns — for falsy value', () => {
    expect(formatDateYMD('')).toBe('—');
    expect(formatDateYMD(null)).toBe('—');
    expect(formatDateYMD(undefined)).toBe('—');
  });

  test('returns slice for ISO string', () => {
    expect(formatDateYMD('2026-04-24')).toBe('2026-04-24');
    expect(formatDateYMD('2026-04-24T10:00:00')).toBe('2026-04-24');
  });

  test('handles short string (not ISO)', () => {
    expect(formatDateYMD('abc')).toBe('—');
  });

  test('handles Date instance', () => {
    const d = new Date(2026, 3, 24);
    const r = formatDateYMD(d);
    expect(r).toBe('2026-04-24');
  });

  test('returns — for invalid date string', () => {
    expect(formatDateYMD('not-a-date')).toBe('—');
  });
});

describe('formatMonthYear', () => {
  test('returns — for falsy', () => {
    expect(formatMonthYear('')).toBe('—');
    expect(formatMonthYear(null)).toBe('—');
  });

  test('returns — for invalid date', () => {
    expect(formatMonthYear('invalid')).toBe('—');
  });

  test('formats valid date', () => {
    const r = formatMonthYear('2026-04-01');
    expect(r).toBeTruthy();
    expect(r).not.toBe('—');
  });
});

describe('formatTimeHM', () => {
  test('returns — for falsy', () => {
    expect(formatTimeHM('')).toBe('—');
    expect(formatTimeHM(null)).toBe('—');
  });

  test('returns — for invalid date', () => {
    expect(formatTimeHM('not-a-date')).toBe('—');
  });

  test('formats valid date', () => {
    const r = formatTimeHM(new Date(2026, 3, 24, 10, 30));
    expect(r).toBeTruthy();
    expect(r).not.toBe('—');
  });

  test('supports hour12 false', () => {
    const r = formatTimeHM(new Date(2026, 3, 24, 14, 0), { hour12: false });
    expect(r).toBeTruthy();
  });
});

describe('formatTimeFromHM', () => {
  test('returns — for empty string', () => {
    expect(formatTimeFromHM('')).toBe('—');
    expect(formatTimeFromHM(null)).toBe('—');
  });

  test('returns — for invalid format', () => {
    expect(formatTimeFromHM('25:00')).toBe('—');
    expect(formatTimeFromHM('abc')).toBe('—');
    expect(formatTimeFromHM('9:5')).toBe('—');
  });

  test('formats valid HH:MM', () => {
    const r = formatTimeFromHM('09:30');
    expect(r).toBeTruthy();
    expect(r).not.toBe('—');
  });

  test('supports hour12 false option', () => {
    const r = formatTimeFromHM('14:00', { hour12: false });
    expect(r).toBeTruthy();
  });
});

describe('formatFileSize', () => {
  test('bytes', () => {
    expect(formatFileSize(500)).toContain('بايت');
  });

  test('kilobytes', () => {
    expect(formatFileSize(2048)).toContain('كيلوبايت');
  });

  test('megabytes', () => {
    expect(formatFileSize(2 * 1024 * 1024)).toContain('ميجابايت');
  });

  test('gigabytes', () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toContain('جيجابايت');
  });
});
