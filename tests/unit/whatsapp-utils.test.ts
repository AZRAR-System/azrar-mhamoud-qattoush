import {
  normalizeWhatsAppPhone,
  buildWhatsAppLink,
  collectWhatsAppPhones,
  buildWhatsAppLinks,
  openWhatsAppForPhones,
} from '@/utils/whatsapp';

describe('normalizeWhatsAppPhone', () => {
  test('returns empty for empty input', () => {
    expect(normalizeWhatsAppPhone('')).toBe('');
    expect(normalizeWhatsAppPhone('   ')).toBe('');
  });

  test('strips 00 prefix by default', () => {
    expect(normalizeWhatsAppPhone('00962791234567')).toBe('962791234567');
  });

  test('does not strip 00 when stripInternationalPrefix00=false', () => {
    const r = normalizeWhatsAppPhone('00962791234567', { stripInternationalPrefix00: false });
    expect(r).toBe('00962791234567'.replace(/\D/g, ''));
  });

  test('keeps number if already starts with country code', () => {
    const r = normalizeWhatsAppPhone('962791234567', { defaultCountryCode: '962' });
    expect(r).toBe('962791234567');
  });

  test('converts local 07x number to international', () => {
    const r = normalizeWhatsAppPhone('0791234567', { defaultCountryCode: '962' });
    expect(r).toBe('962791234567');
  });

  test('local number starting with 0 that already has country code after stripping', () => {
    const r = normalizeWhatsAppPhone('0962791234567', { defaultCountryCode: '962' });
    expect(r).toBe('962791234567');
  });

  test('9-digit number starting with 7 gets country code', () => {
    const r = normalizeWhatsAppPhone('791234567', { defaultCountryCode: '962' });
    expect(r).toBe('962791234567');
  });

  test('9-digit number not starting with 7 now gets country code', () => {
    const r = normalizeWhatsAppPhone('591234567', { defaultCountryCode: '962' });
    expect(r).toBe('962591234567');
  });

  test('returns digits only when no country code given', () => {
    const r = normalizeWhatsAppPhone('+962-79-1234567');
    expect(r).toBe('962791234567');
  });

  test('leading zeros only returns empty', () => {
    const r = normalizeWhatsAppPhone('000', { defaultCountryCode: '962' });
    expect(r).toBe('');
  });
});

describe('buildWhatsAppLink', () => {
  test('returns empty string for empty phone', () => {
    expect(buildWhatsAppLink('hello', '')).toBe('');
  });

  test('returns web link by default', () => {
    const r = buildWhatsAppLink('test', '962791234567');
    expect(r).toContain('api.whatsapp.com');
    expect(r).toContain('962791234567');
  });

  test('returns desktop link with target=desktop', () => {
    const r = buildWhatsAppLink('test', '962791234567', { target: 'desktop' });
    expect(r).toContain('whatsapp://send');
  });

  test('empty message still builds link', () => {
    const r = buildWhatsAppLink('', '962791234567');
    expect(r).toContain('962791234567');
  });

  test('target=auto in non-desktop env returns web link', () => {
    const r = buildWhatsAppLink('msg', '962791234567', { target: 'auto' });
    expect(r).toContain('api.whatsapp.com');
  });

  test('target=auto in desktop env returns desktop link', () => {
    (window as any).desktopDb = {};
    const r = buildWhatsAppLink('msg', '962791234567', { target: 'auto' });
    expect(r).toContain('whatsapp://');
    delete (window as any).desktopDb;
  });
});

describe('collectWhatsAppPhones', () => {
  test('returns empty for empty array', () => {
    expect(collectWhatsAppPhones([])).toEqual([]);
  });

  test('filters null and undefined', () => {
    const r = collectWhatsAppPhones([null, undefined, '']);
    expect(r).toEqual([]);
  });

  test('deduplicates phones', () => {
    const r = collectWhatsAppPhones(['962791234567', '962791234567']);
    expect(r).toHaveLength(1);
  });

  test('normalizes and collects valid phones', () => {
    const r = collectWhatsAppPhones(['0791234567'], { defaultCountryCode: '962' });
    expect(r).toEqual(['962791234567']);
  });
});

describe('buildWhatsAppLinks', () => {
  test('returns empty for no valid phones', () => {
    expect(buildWhatsAppLinks('msg', [])).toEqual([]);
  });

  test('returns links for valid phones', () => {
    const r = buildWhatsAppLinks('msg', ['962791234567', '962791234568']);
    expect(r).toHaveLength(2);
    r.forEach(link => expect(link).toContain('api.whatsapp.com'));
  });
});

describe('openWhatsAppForPhones', () => {
  test('does nothing for empty phones', async () => {
    await expect(openWhatsAppForPhones('msg', [])).resolves.toBeUndefined();
  });

  test('opens single phone without delay', async () => {
    const opened: string[] = [];
    jest.spyOn(require('@/utils/externalLink'), 'openExternalUrl').mockImplementation((url: string) => {
      opened.push(url);
    });
    await openWhatsAppForPhones('msg', ['962791234567'], { delayMs: 0 });
    expect(opened.length).toBe(1);
    jest.restoreAllMocks();
  });

  test('skips empty links', async () => {
    const opened: string[] = [];
    jest.spyOn(require('@/utils/externalLink'), 'openExternalUrl').mockImplementation((url: string) => {
      opened.push(url);
    });
    await openWhatsAppForPhones('msg', [''], { delayMs: 0 });
    expect(opened.length).toBe(0);
    jest.restoreAllMocks();
  });
});
