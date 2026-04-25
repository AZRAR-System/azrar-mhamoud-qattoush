import {
  getBrandYears,
  getOfficialBrandSignature,
  applyOfficialBrandSignature,
  BRAND_SIGNATURE_BASE_YEARS,
} from '@/utils/brandSignature';

describe('getBrandYears', () => {
  test('returns base years for current year 2026', () => {
    expect(getBrandYears(new Date('2026-01-01'))).toBe(16);
  });

  test('returns incremented years for future year', () => {
    expect(getBrandYears(new Date('2028-01-01'))).toBe(18);
  });

  test('returns base years minimum for past year', () => {
    expect(getBrandYears(new Date('2020-01-01'))).toBe(BRAND_SIGNATURE_BASE_YEARS);
  });
});

describe('getOfficialBrandSignature', () => {
  test('contains brand name', () => {
    const r = getOfficialBrandSignature();
    expect(r).toContain('أزرار للخدمات العقارية');
  });

  test('contains slogan', () => {
    const r = getOfficialBrandSignature();
    expect(r).toContain('لأن الثقة لا تُشترى');
  });
});

describe('applyOfficialBrandSignature', () => {
  test('returns empty for empty message', () => {
    expect(applyOfficialBrandSignature('')).toBe('');
    expect(applyOfficialBrandSignature('   ')).toBe('   ');
  });

  test('appends signature to message', () => {
    const r = applyOfficialBrandSignature('مرحباً');
    expect(r).toContain('مرحباً');
    expect(r).toContain('أزرار للخدمات العقارية');
  });

  test('does not duplicate signature when already present', () => {
    const msg = 'رسالة\n\n' + getOfficialBrandSignature();
    const r = applyOfficialBrandSignature(msg);
    const count = (r.match(/أزرار للخدمات العقارية/g) || []).length;
    expect(count).toBe(1);
  });

  test('replaces old brand line with official signature', () => {
    const old = 'رسالة\nإدارة الأملاك';
    const r = applyOfficialBrandSignature(old);
    expect(r).not.toContain('إدارة الأملاك');
    expect(r).toContain('أزرار للخدمات العقارية');
  });

  test('replaces خبرني brand line', () => {
    const old = 'رسالة\nخبرني للخدمات العقارية';
    const r = applyOfficialBrandSignature(old);
    expect(r).toContain('أزرار للخدمات العقارية');
  });

  test('replaces old slogan with years and سيطرة', () => {
    const old = 'رسالة\n16 سنة تفوّق وسيطرة';
    const r = applyOfficialBrandSignature(old);
    expect(r).toContain('أزرار للخدمات العقارية');
  });

  test('replaces old slogan with years and وثقة', () => {
    const old = 'رسالة\n15 سنة تفوّق وثقة';
    const r = applyOfficialBrandSignature(old);
    expect(r).toContain('أزرار للخدمات العقارية');
  });

  test('handles CRLF line endings', () => {
    const r = applyOfficialBrandSignature('مرحبا\r\nكيف الحال');
    expect(r).toContain('أزرار للخدمات العقارية');
  });

  test('صادر عن أزرار pattern stripped', () => {
    const old = 'رسالة\nصادر عن أزرار للخدمات العقارية';
    const r = applyOfficialBrandSignature(old);
    const count = (r.match(/للخدمات العقارية/g) || []).length;
    expect(count).toBe(1);
  });
});
