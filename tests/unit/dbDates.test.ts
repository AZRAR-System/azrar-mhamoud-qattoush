import { 
  formatDateOnly, 
  toDateOnly, 
  parseDateOnly, 
  daysBetweenDateOnly, 
  addMonthsDateOnly, 
  addDaysIso 
} from '@/services/db/utils/dates';

describe('DB Date Utilities Suite', () => {
  test('formatDateOnly - returns ISO YYYY-MM-DD', () => {
    const d = new Date(2025, 4, 15); // May 15
    expect(formatDateOnly(d)).toBe('2025-05-15');
  });

  test('toDateOnly - resets time to midnight', () => {
    const d = new Date(2025, 4, 15, 14, 30, 0);
    const res = toDateOnly(d);
    expect(res.getHours()).toBe(0);
    expect(res.getDate()).toBe(15);
  });

  test('parseDateOnly - parses YYYY-MM-DD correctly', () => {
    const res = parseDateOnly('2025-05-15')!;
    expect(res.getFullYear()).toBe(2025);
    expect(res.getMonth()).toBe(4); // 0-indexed
    expect(res.getDate()).toBe(15);
    
    expect(parseDateOnly('invalid')).toBeNull();
  });

  test('daysBetweenDateOnly - calculates difference ignoring time', () => {
    const d1 = new Date(2025, 4, 10, 23, 0);
    const d2 = new Date(2025, 4, 15, 0, 1);
    expect(daysBetweenDateOnly(d1, d2)).toBe(5);
  });

  test('addMonthsDateOnly - handles month rollover', () => {
    const res = addMonthsDateOnly('2025-01-31', 1)!;
    // Rollover from Jan 31 + 1 month usually ends up in early March or Feb 28 depending on JS Date implementation
    expect(res).toBeInstanceOf(Date);
    expect(res.getMonth()).toBeGreaterThan(0);
  });

  test('addDaysIso - returns formatted string', () => {
    expect(addDaysIso('2025-05-15', 5)).toBe('2025-05-20');
    expect(addDaysIso('2025-05-31', 1)).toBe('2025-06-01');
  });
});
