import {
  canonicalizeLicensePayloadV1,
  parseLicenseFileContent,
  type LicensePayloadV1,
} from '@/services/license';

const basePayload: LicensePayloadV1 = {
  v: 1,
  product: 'AZRAR',
  deviceId: 'DEVICE-123',
  issuedAt: '2026-01-01T00:00:00Z',
};

describe('canonicalizeLicensePayloadV1', () => {
  test('produces consistent JSON', () => {
    const r = canonicalizeLicensePayloadV1(basePayload);
    const parsed = JSON.parse(r);
    expect(parsed.v).toBe(1);
    expect(parsed.product).toBe('AZRAR');
    expect(parsed.deviceId).toBe('DEVICE-123');
  });

  test('includes features when provided', () => {
    const r = canonicalizeLicensePayloadV1({ ...basePayload, features: ['f1', 'f2'] });
    const parsed = JSON.parse(r);
    expect(parsed.features).toEqual(['f1', 'f2']);
  });

  test('excludes features when not array', () => {
    const r = canonicalizeLicensePayloadV1({ ...basePayload, features: undefined });
    const parsed = JSON.parse(r);
    expect(parsed.features).toBeUndefined();
  });

  test('includes expiresAt when provided', () => {
    const r = canonicalizeLicensePayloadV1({ ...basePayload, expiresAt: '2027-01-01T00:00:00Z' });
    const parsed = JSON.parse(r);
    expect(parsed.expiresAt).toBe('2027-01-01T00:00:00Z');
  });

  test('includes customer when provided', () => {
    const r = canonicalizeLicensePayloadV1({ ...basePayload, customer: 'خبرني' });
    const parsed = JSON.parse(r);
    expect(parsed.customer).toBe('خبرني');
  });
});

describe('parseLicenseFileContent', () => {
  const makeLicense = (overrides = {}) => JSON.stringify({
    payload: { ...basePayload, ...overrides },
    sig: 'dGVzdA==',
  });

  test('throws for empty string', () => {
    expect(() => parseLicenseFileContent('')).toThrow('فارغ');
  });

  test('throws for invalid JSON', () => {
    expect(() => parseLicenseFileContent('not json')).toThrow('JSON');
  });

  test('throws for non-object JSON', () => {
    expect(() => parseLicenseFileContent('"string"')).toThrow('غير صحيحة');
  });

  test('throws when sig missing', () => {
    const raw = JSON.stringify({ payload: basePayload });
    expect(() => parseLicenseFileContent(raw)).toThrow('توقيع');
  });

  test('throws when payload missing', () => {
    const raw = JSON.stringify({ sig: 'abc' });
    expect(() => parseLicenseFileContent(raw)).toThrow('payload');
  });

  test('throws when v !== 1', () => {
    expect(() => parseLicenseFileContent(makeLicense({ v: 2 }))).toThrow('إصدار');
  });

  test('throws when product is not AZRAR', () => {
    expect(() => parseLicenseFileContent(makeLicense({ product: 'OTHER' }))).toThrow('المنتج');
  });

  test('throws when deviceId missing', () => {
    expect(() => parseLicenseFileContent(makeLicense({ deviceId: '' }))).toThrow('deviceId');
  });

  test('throws when issuedAt missing', () => {
    expect(() => parseLicenseFileContent(makeLicense({ issuedAt: '' }))).toThrow('issuedAt');
  });

  test('parses valid license successfully', () => {
    const r = parseLicenseFileContent(makeLicense());
    expect(r.payload.deviceId).toBe('DEVICE-123');
    expect(r.payload.product).toBe('AZRAR');
    expect(r.sig).toBe('dGVzdA==');
  });

  test('parses license with features', () => {
    const r = parseLicenseFileContent(makeLicense({ features: ['premium', 'reports'] }));
    expect(r.payload.features).toEqual(['premium', 'reports']);
  });

  test('parses license with expiresAt and customer', () => {
    const r = parseLicenseFileContent(makeLicense({
      expiresAt: '2027-01-01T00:00:00Z',
      customer: 'خبرني للخدمات العقارية',
    }));
    expect(r.payload.expiresAt).toBe('2027-01-01T00:00:00Z');
    expect(r.payload.customer).toBe('خبرني للخدمات العقارية');
  });

  test('parses license without optional fields', () => {
    const raw = JSON.stringify({
      payload: { v: 1, product: 'AZRAR', deviceId: 'D1', issuedAt: '2026-01-01' },
      sig: 'abc123',
    });
    const r = parseLicenseFileContent(raw);
    expect(r.payload.expiresAt).toBeUndefined();
    expect(r.payload.customer).toBeUndefined();
    expect(r.payload.features).toBeUndefined();
  });
});
