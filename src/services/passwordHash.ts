const PREFIX = 'pbkdf2_sha256';
const DEFAULT_ITERATIONS = 180_000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;

const textEncoder = new TextEncoder();

const getCrypto = (): Crypto => {
  const c = globalThis.crypto;
  if (!c) throw new Error('WebCrypto is not available.');
  return c;
};

const toBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

const fromBase64 = (b64: string): Uint8Array => {
  const bin = atob(String(b64 || ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

const pbkdf2Sha256 = async (
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> => {
  const cryptoObj = getCrypto();
  const key = await cryptoObj.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await cryptoObj.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    key,
    DERIVED_BITS
  );

  return new Uint8Array(bits);
};

export const isHashedPassword = (value: unknown): value is string => {
  const s = String(value ?? '');
  return s.startsWith(`${PREFIX}$`);
};

export const hashPassword = async (
  password: string,
  opts?: { iterations?: number }
): Promise<string> => {
  const p = String(password ?? '').trim();
  if (!p) return '';

  const cryptoObj = getCrypto();
  const iterations = Number.isFinite(opts?.iterations)
    ? Number(opts?.iterations)
    : DEFAULT_ITERATIONS;

  const salt = new Uint8Array(SALT_BYTES);
  cryptoObj.getRandomValues(salt);

  const derived = await pbkdf2Sha256(p, salt, iterations);
  return `${PREFIX}$${iterations}$${toBase64(salt)}$${toBase64(derived)}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const p = String(password ?? '').trim();
  const s = String(stored ?? '').trim();
  if (!p || !s) return false;

  if (!isHashedPassword(s)) return p === s;

  const parts = s.split('$');
  if (parts.length !== 4) return false;

  const [, iterStr, saltB64, hashB64] = parts;
  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const actual = await pbkdf2Sha256(p, salt, iterations);
  return constantTimeEqual(actual, expected);
};
