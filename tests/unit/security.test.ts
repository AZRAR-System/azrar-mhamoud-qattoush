import { obfuscate, deobfuscate, isObfuscated } from '@/utils/security';

describe('obfuscate', () => {
  test('returns empty for empty string', () => {
    expect(obfuscate('')).toBe('');
  });

  test('obfuscates text to base64', () => {
    const r = obfuscate('secret');
    expect(r).not.toBe('secret');
    expect(r.length).toBeGreaterThan(0);
  });

  test('different texts produce different output', () => {
    expect(obfuscate('a')).not.toBe(obfuscate('b'));
  });
});

describe('deobfuscate', () => {
  test('returns empty for empty string', () => {
    expect(deobfuscate('')).toBe('');
  });

  test('reverses obfuscation', () => {
    const original = 'محمود القطوش';
    expect(deobfuscate(obfuscate(original))).toBe(original);
  });

  test('returns input when not valid base64', () => {
    const r = deobfuscate('not-base64-@@##');
    expect(r).toBe('not-base64-@@##');
  });

  test('returns decoded value when valid base64 but no salt', () => {
    const noSalt = btoa('plain text');
    const r = deobfuscate(noSalt);
    expect(r).toBe('plain text');
  });
});

describe('isObfuscated', () => {
  test('returns false for empty string', () => {
    expect(isObfuscated('')).toBe(false);
  });

  test('returns false for short string', () => {
    expect(isObfuscated('abc')).toBe(false);
  });

  test('returns true for obfuscated string', () => {
    expect(isObfuscated(obfuscate('test data'))).toBe(true);
  });

  test('returns false for plain text', () => {
    expect(isObfuscated('hello world plain text')).toBe(false);
  });

  test('returns false for invalid base64', () => {
    expect(isObfuscated('not-valid-base64-@@##!!')).toBe(false);
  });
});
