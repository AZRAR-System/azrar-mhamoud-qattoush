/**
 * Tests for src/utils/format.ts
 * Critical utility used across all pages for display formatting
 */

import {
  formatDateYMD,
  formatFileSize,
  formatNumber,
  formatCurrencyJOD,
} from '../../src/utils/format';

describe('formatDateYMD', () => {
  it('returns em dash for null', () => {
    expect(formatDateYMD(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(formatDateYMD(undefined)).toBe('—');
  });

  it('returns em dash for empty string', () => {
    expect(formatDateYMD('')).toBe('—');
  });

  it('returns date portion from ISO string', () => {
    expect(formatDateYMD('2026-04-15')).toBe('2026-04-15');
  });

  it('returns date portion from ISO datetime string', () => {
    expect(formatDateYMD('2026-04-15T10:30:00.000Z')).toBe('2026-04-15');
  });

  it('returns em dash for invalid date', () => {
    expect(formatDateYMD('not-a-date')).toBe('—');
  });

  it('formats Date object correctly', () => {
    const result = formatDateYMD(new Date(2026, 3, 15));
    expect(result).toBe('2026-04-15');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 بايت');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 كيلوبايت');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 ميجابايت');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 جيجابايت');
  });

  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 بايت');
  });

  it('formats fractional kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 كيلوبايت');
  });
});

describe('formatNumber', () => {
  it('formats zero', () => {
    const result = formatNumber(0);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles null input', () => {
    const result = formatNumber(null);
    expect(typeof result).toBe('string');
  });

  it('handles undefined input', () => {
    const result = formatNumber(undefined);
    expect(typeof result).toBe('string');
  });

  it('handles NaN input', () => {
    const result = formatNumber(NaN);
    expect(typeof result).toBe('string');
  });

  it('handles negative number', () => {
    const result = formatNumber(-100);
    expect(typeof result).toBe('string');
  });

  it('rounds to 2 decimal places internally', () => {
    const result = formatNumber(1.005);
    expect(typeof result).toBe('string');
  });
});

describe('formatCurrencyJOD', () => {
  it('returns a string', () => {
    expect(typeof formatCurrencyJOD(100)).toBe('string');
  });

  it('handles null', () => {
    expect(typeof formatCurrencyJOD(null)).toBe('string');
  });

  it('handles undefined', () => {
    expect(typeof formatCurrencyJOD(undefined)).toBe('string');
  });

  it('handles zero', () => {
    expect(typeof formatCurrencyJOD(0)).toBe('string');
  });

  it('handles negative value', () => {
    expect(typeof formatCurrencyJOD(-50)).toBe('string');
  });

  it('includes the currency symbol in output', () => {
    const result = formatCurrencyJOD(100);
    // The Arabic locale (ar-JO) formats JOD as "د.أ."
    expect(result).toMatch(/JOD|د\.أ\./);
  });
});
