import { formatCurrencyJOD, formatNumber, formatDateYMD } from '@/utils/format';
import { isTenancyRelevant } from '@/utils/tenancy';

describe('Utility Functions - Format', () => {
  it('formatCurrencyJOD: should format amount as JOD', () => {
    const res = formatCurrencyJOD(1000);
    expect(res).toContain('1,000');
    // In JSDOM/Node with Arabic locale, it might vary, but we expect currency formatting to happen.
  });

  it('formatNumber: should format with thousands separator', () => {
    const res = formatNumber(1234.56, { maximumFractionDigits: 2 });
    expect(res).toContain('1,234.56');
  });

  it('formatDateYMD: should format date as YYYY-MM-DD', () => {
    expect(formatDateYMD('2024-05-01T10:00:00Z')).toBe('2024-05-01');
  });
});

describe('Utility Functions - Tenancy', () => {
  it('isTenancyRelevant: should return true for active/renewed contracts', () => {
    expect(isTenancyRelevant({ حالة_العقد: 'نشط', isArchived: false } as any)).toBe(true);
    expect(isTenancyRelevant({ حالة_العقد: 'ملغي', isArchived: false } as any)).toBe(false);
  });
});
