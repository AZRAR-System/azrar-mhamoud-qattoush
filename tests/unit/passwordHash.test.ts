import {
  hashPassword,
  isHashedPassword,
  verifyPassword,
} from '@/services/passwordHash';

describe('passwordHash', () => {
  test('hashPassword returns empty string for blank password', async () => {
    await expect(hashPassword('')).resolves.toBe('');
    await expect(hashPassword('   ')).resolves.toBe('');
  });

  test('isHashedPassword detects pbkdf2 prefix', () => {
    expect(isHashedPassword('pbkdf2_sha256$1$salt$hash')).toBe(true);
    expect(isHashedPassword('plain')).toBe(false);
    expect(isHashedPassword(null)).toBe(false);
  });

  test('verifyPassword returns false when password or stored is empty', async () => {
    await expect(verifyPassword('', 'x')).resolves.toBe(false);
    await expect(verifyPassword('x', '')).resolves.toBe(false);
  });

  test('verifyPassword compares plain stored when not hashed', async () => {
    await expect(verifyPassword('secret', 'secret')).resolves.toBe(true);
    await expect(verifyPassword('secret', 'other')).resolves.toBe(false);
  });

  test('hash then verify round-trip', async () => {
    const stored = await hashPassword('my-pass-9');
    expect(isHashedPassword(stored)).toBe(true);
    await expect(verifyPassword('my-pass-9', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong', stored)).resolves.toBe(false);
  });

  test('hashPassword respects custom iterations', async () => {
    const stored = await hashPassword('p', { iterations: 1000 });
    expect(stored).toMatch(/^pbkdf2_sha256\$1000\$/);
    await expect(verifyPassword('p', stored)).resolves.toBe(true);
  });

  test('verifyPassword rejects malformed hash format', async () => {
    await expect(verifyPassword('p', 'pbkdf2_sha256$only$two')).resolves.toBe(false);
  });

  test('verifyPassword rejects non-positive iterations', async () => {
    const bad = 'pbkdf2_sha256$0$abcd$efgh';
    await expect(verifyPassword('p', bad)).resolves.toBe(false);
  });

  test('hashPassword throws when WebCrypto is unavailable', async () => {
    const orig = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      await expect(hashPassword('any')).rejects.toThrow('WebCrypto');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: orig, configurable: true });
    }
  });
});
