import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import crypto from 'node:crypto';

const MAGIC = Buffer.from('AZRAREN1');
const VERSION = 1;

const ITERATIONS = 180_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

type EncryptBufferToFileArgs = {
  bytes: Uint8Array | Buffer;
  destPath: string;
  password: string;
};

type EncryptFileToFileArgs = {
  sourcePath: string;
  destPath: string;
  password: string;
};

type DecryptFileToBufferArgs = {
  sourcePath: string;
  password: string;
  maxBytes?: number;
};

type DecryptFileToFileArgs = {
  sourcePath: string;
  destPath: string;
  password: string;
};

function deriveKey(password: string, salt: Buffer, iterations = ITERATIONS): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_BYTES, 'sha256');
}

function ensureDirForFile(filePath: string): Promise<void> {
  return fsp.mkdir(path.dirname(filePath), { recursive: true }) as Promise<void>;
}

export async function isEncryptedFile(filePath: string): Promise<boolean> {
  try {
    const fh = await fsp.open(filePath, 'r');
    try {
      const header = Buffer.alloc(MAGIC.length);
      const { bytesRead } = await fh.read(header, 0, header.length, 0);
      if (bytesRead !== header.length) return false;
      return header.equals(MAGIC);
    } finally {
      await fh.close();
    }
  } catch {
    return false;
  }
}

function encryptBytes(password: string, plain: Buffer): Buffer {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const cipherText = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  const meta = Buffer.alloc(1 + 4);
  meta.writeUInt8(VERSION, 0);
  meta.writeUInt32LE(ITERATIONS, 1);

  return Buffer.concat([MAGIC, meta, salt, iv, tag, cipherText]);
}

function decryptBytes(password: string, enc: Buffer): Buffer {
  const minLen = MAGIC.length + 1 + 4 + SALT_BYTES + IV_BYTES + TAG_BYTES;
  if (enc.length < minLen) throw new Error('Invalid encrypted file');

  let offset = 0;
  const magic = enc.subarray(0, MAGIC.length);
  offset += MAGIC.length;
  if (!magic.equals(MAGIC)) throw new Error('Not an encrypted file');

  const version = enc.readUInt8(offset);
  offset += 1;
  if (version !== VERSION) throw new Error('Unsupported encrypted file version');

  const iterations = enc.readUInt32LE(offset);
  offset += 4;
  if (!Number.isFinite(iterations) || iterations <= 0)
    throw new Error('Invalid encryption metadata');

  const salt = enc.subarray(offset, offset + SALT_BYTES);
  offset += SALT_BYTES;

  const iv = enc.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;

  const tag = enc.subarray(offset, offset + TAG_BYTES);
  offset += TAG_BYTES;

  const cipherText = enc.subarray(offset);

  const key = deriveKey(password, salt, iterations);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]);
}

export async function encryptBufferToFile(args: EncryptBufferToFileArgs): Promise<void> {
  const destPath = String(args.destPath || '');
  const password = String(args.password || '');
  if (!destPath) throw new Error('destPath is required');
  if (!password) throw new Error('password is required');

  const plain = Buffer.isBuffer(args.bytes) ? args.bytes : Buffer.from(args.bytes);
  const enc = encryptBytes(password, plain);
  await ensureDirForFile(destPath);
  await fsp.writeFile(destPath, enc);
}

export async function encryptFileToFile(args: EncryptFileToFileArgs): Promise<void> {
  const sourcePath = String(args.sourcePath || '');
  const destPath = String(args.destPath || '');
  const password = String(args.password || '');
  if (!sourcePath) throw new Error('sourcePath is required');
  if (!destPath) throw new Error('destPath is required');
  if (!password) throw new Error('password is required');

  const plain = await fsp.readFile(sourcePath);
  const enc = encryptBytes(password, plain);
  await ensureDirForFile(destPath);
  await fsp.writeFile(destPath, enc);
}

export async function decryptFileToBuffer(args: DecryptFileToBufferArgs): Promise<Buffer> {
  const sourcePath = String(args.sourcePath || '');
  const password = String(args.password || '');
  if (!sourcePath) throw new Error('sourcePath is required');
  if (!password) throw new Error('password is required');

  const raw = await fsp.readFile(sourcePath);
  const isEnc = raw.subarray(0, MAGIC.length).equals(MAGIC);
  const out = isEnc ? decryptBytes(password, raw) : raw;

  const maxBytes = args.maxBytes;
  if (
    typeof maxBytes === 'number' &&
    Number.isFinite(maxBytes) &&
    maxBytes > 0 &&
    out.length > maxBytes
  ) {
    throw new Error('File too large');
  }
  return out;
}

export async function decryptFileToFile(args: DecryptFileToFileArgs): Promise<void> {
  const sourcePath = String(args.sourcePath || '');
  const destPath = String(args.destPath || '');
  const password = String(args.password || '');
  if (!sourcePath) throw new Error('sourcePath is required');
  if (!destPath) throw new Error('destPath is required');
  if (!password) throw new Error('password is required');

  const bytes = await decryptFileToBuffer({ sourcePath, password });
  await ensureDirForFile(destPath);
  await fsp.writeFile(destPath, bytes);
}

// For completeness (used by callers to decide behavior)
export { fs };
