import { sanitizeFolderName, toDateOnlySafe, buildAttachmentEntityFolder } from '@/services/db/attachmentPaths';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('sanitizeFolderName', () => {
  test('returns غير_معروف for empty string', () => {
    expect(sanitizeFolderName('')).toBe('غير_معروف');
    expect(sanitizeFolderName('   ')).toBe('غير_معروف');
  });

  test('replaces slashes with dash', () => {
    expect(sanitizeFolderName('a/b\\c')).toBe('a-b-c');
  });

  test('replaces invalid chars', () => {
    expect(sanitizeFolderName('a<bc')).toBe('a-bc');
  });

  test('strips control characters', () => {
    expect(sanitizeFolderName('a\u0000b\u001Fc')).toBe('abc');
  });

  test('collapses whitespace', () => {
    expect(sanitizeFolderName('a   b')).toBe('a b');
  });

  test('truncates to maxLen', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeFolderName(long, 10)).toHaveLength(10);
  });

  test('returns as-is when within maxLen', () => {
    expect(sanitizeFolderName('hello', 80)).toBe('hello');
  });

  test('returns غير_معروف when all chars stripped', () => {
    expect(sanitizeFolderName('\u0000\u0001\u001F')).toBe('غير_معروف');
  });
});

describe('toDateOnlySafe', () => {
  test('returns empty for falsy', () => {
    expect(toDateOnlySafe(null)).toBe('');
    expect(toDateOnlySafe(undefined)).toBe('');
    expect(toDateOnlySafe('')).toBe('');
  });

  test('formats Date instance', () => {
    const d = new Date('2026-04-24T00:00:00Z');
    expect(toDateOnlySafe(d)).toContain('2026-04-24');
  });

  test('formats valid date string', () => {
    expect(toDateOnlySafe('2026-04-24')).toBe('2026-04-24');
  });

  test('formats number timestamp', () => {
    const ts = new Date('2026-01-01').getTime();
    expect(toDateOnlySafe(ts)).toContain('2026-01-01');
  });

  test('returns slice for invalid date string', () => {
    const r = toDateOnlySafe('not-a-date-long');
    expect(r).toBe('not-a-date');
  });
});

describe('buildAttachmentEntityFolder', () => {
  test('Person type returns sanitized id', () => {
    const r = buildAttachmentEntityFolder('Person', 'PER-123');
    expect(r).toBe('PER-123');
  });

  test('Contract type returns sanitized id', () => {
    const r = buildAttachmentEntityFolder('Contract', 'C-42');
    expect(r).toBe('C-42');
  });

  test('Property type with existing property uses code', () => {
    kv.save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR-1', الكود_الداخلي: 'P-CODE', رقم_المالك: 'O1', النوع: 'A', العنوان: 'A', حالة_العقار: 'A', IsRented: false, المساحة: 100 }]);
    buildCache();
    const r = buildAttachmentEntityFolder('Property', 'PR-1');
    expect(r).toBe('P-CODE');
  });

  test('Property type without matching property uses id', () => {
    const r = buildAttachmentEntityFolder('Property', 'PR-MISSING');
    expect(r).toBe('PR-MISSING');
  });

  test('Clearance with matching contract and property', () => {
    kv.save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR-1', الكود_الداخلي: 'PCODE', رقم_المالك: 'O1', النوع: 'A', العنوان: 'A', حالة_العقار: 'A', IsRented: false, المساحة: 100 }]);
    kv.save(KEYS.CONTRACTS, [{ رقم_العقد: 'C-1', رقم_العقار: 'PR-1', رقم_المستاجر: 'P1', تاريخ_البداية: '2026-01-01', تاريخ_النهاية: '2027-01-01', مدة_العقد_بالاشهر: 12, القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false, lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0 }]);
    buildCache();
    const r = buildAttachmentEntityFolder('Clearance', 'C-1');
    expect(r).toContain('C-1');
    expect(r).toContain('PCODE');
  });

  test('Clearance without matching contract', () => {
    const r = buildAttachmentEntityFolder('Clearance', 'C-MISSING');
    expect(r).toContain('C-MISSING');
  });

  test('unknown type returns Other fallback', () => {
    const r = buildAttachmentEntityFolder('Invoice' as any, 'INV-1');
    expect(r).toContain('Invoice');
    expect(r).toContain('INV-1');
  });

  test('empty type returns Other fallback', () => {
    const r = buildAttachmentEntityFolder('' as any, 'X-1');
    expect(r).toContain('Other');
  });
});
