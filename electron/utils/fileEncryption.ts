import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

const MAGIC = Buffer.from('AZRDBE01', 'ascii'); // 8 bytes
const VERSION = 2;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN;

const SCRYPT_V2 = {
  // Stronger than Node defaults but still reasonable for desktop.
  // (These are KDF params, not AES params.)
  N: 1 << 18,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024,
} as const;

function assertNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  if (!value) throw new Error(`${name} is required`);
  if (value.length > 512) throw new Error(`${name} is too long`);
  if (value.includes('\u0000')) throw new Error(`${name} contains invalid characters`);
  return value;
}

async function deriveKeyV1(password: string, salt: Buffer): Promise<Buffer> {
  return (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 32, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  })) as Buffer;
}

async function deriveKeyV2(password: string, salt: Buffer): Promise<Buffer> {
  return (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 32, SCRYPT_V2, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  })) as Buffer;
}

export async function isEncryptedFile(filePath: string): Promise<boolean> {
  try {
    const fh = await fsp.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(MAGIC.length);
      const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
      if (bytesRead !== buf.length) return false;
      return buf.equals(MAGIC);
    } finally {
      await fh.close();
    }
  } catch {
    return false;
  }
}

export async function encryptFileToFile(opts: {
  sourcePath: string;
  destPath: string;
  password: string;
}): Promise<void> {
  const sourcePath = assertNonEmptyString(opts.sourcePath, 'sourcePath');
  const destPath = assertNonEmptyString(opts.destPath, 'destPath');
  const password = assertNonEmptyString(opts.password, 'password');

  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = await deriveKeyV2(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const header = Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv]);
  // Authenticate header (prevents header tampering / format confusion).
  cipher.setAAD(header);

  await new Promise<void>((resolve, reject) => {
    const input = fs.createReadStream(sourcePath);
    const output = fs.createWriteStream(destPath, { flags: 'w' });

    const onError = (e: unknown) => reject(e instanceof Error ? e : new Error(String(e)));

    input.on('error', onError);
    output.on('error', onError);
    cipher.on('error', onError);

    output.write(header);

    input
      .pipe(cipher)
      .pipe(output, { end: false });

    cipher.on('end', () => {
      try {
        const tag = cipher.getAuthTag();
        output.write(tag);
        output.end();
      } catch (e: unknown) {
        onError(e);
      }
    });

    output.on('finish', () => resolve());
  });
}

export async function decryptFileToFile(opts: {
  sourcePath: string;
  destPath: string;
  password: string;
}): Promise<void> {
  const sourcePath = assertNonEmptyString(opts.sourcePath, 'sourcePath');
  const destPath = assertNonEmptyString(opts.destPath, 'destPath');
  const password = assertNonEmptyString(opts.password, 'password');

  const st = await fsp.stat(sourcePath);
  if (!st.isFile()) throw new Error('ملف النسخة الاحتياطية غير صالح');
  if (st.size < HEADER_LEN + TAG_LEN) throw new Error('ملف النسخة الاحتياطية مشفر لكنه تالف');

  const fh = await fsp.open(sourcePath, 'r');
  try {
    const headerBuf = Buffer.alloc(HEADER_LEN);
    const { bytesRead } = await fh.read(headerBuf, 0, HEADER_LEN, 0);
    if (bytesRead !== HEADER_LEN) throw new Error('ملف النسخة الاحتياطية تالف');

    const magic = headerBuf.subarray(0, MAGIC.length);
    if (!magic.equals(MAGIC)) throw new Error('الملف غير مشفر أو غير مدعوم');

    const ver = headerBuf[MAGIC.length];
    if (ver !== 1 && ver !== 2) throw new Error('صيغة التشفير غير مدعومة');

    const salt = headerBuf.subarray(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN);
    const iv = headerBuf.subarray(MAGIC.length + 1 + SALT_LEN, HEADER_LEN);

    const tagBuf = Buffer.alloc(TAG_LEN);
    await fh.read(tagBuf, 0, TAG_LEN, st.size - TAG_LEN);

    const key = ver === 2 ? await deriveKeyV2(password, salt) : await deriveKeyV1(password, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tagBuf);
    if (ver === 2) {
      decipher.setAAD(headerBuf);
    }

    await fsp.mkdir(path.dirname(destPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const input = fs.createReadStream(sourcePath, {
        start: HEADER_LEN,
        end: st.size - TAG_LEN - 1,
      });
      const output = fs.createWriteStream(destPath, { flags: 'w' });

      const onError = (e: unknown) => reject(e instanceof Error ? e : new Error(String(e)));

      input.on('error', onError);
      output.on('error', onError);
      decipher.on('error', () => reject(new Error('كلمة المرور غير صحيحة أو الملف تالف')));

      input.pipe(decipher).pipe(output);
      output.on('finish', () => resolve());
    });
  } finally {
    await fh.close();
  }
}

export async function encryptBufferToFile(opts: {
  bytes: Buffer;
  destPath: string;
  password: string;
}): Promise<void> {
  const destPath = assertNonEmptyString(opts.destPath, 'destPath');
  const password = assertNonEmptyString(opts.password, 'password');
  const bytes = opts.bytes instanceof Buffer ? opts.bytes : Buffer.from(opts.bytes as unknown as Uint8Array);

  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = await deriveKeyV2(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const header = Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv]);
  cipher.setAAD(header);

  await new Promise<void>((resolve, reject) => {
    const input = Readable.from([bytes]);
    const output = fs.createWriteStream(destPath, { flags: 'w' });

    const onError = (e: unknown) => reject(e instanceof Error ? e : new Error(String(e)));

    input.on('error', onError);
    output.on('error', onError);
    cipher.on('error', onError);

    output.write(header);

    input.pipe(cipher).pipe(output, { end: false });

    cipher.on('end', () => {
      try {
        const tag = cipher.getAuthTag();
        output.write(tag);
        output.end();
      } catch (e: unknown) {
        onError(e);
      }
    });

    output.on('finish', () => resolve());
  });
}

export async function decryptFileToBuffer(opts: {
  sourcePath: string;
  password: string;
  maxBytes?: number;
}): Promise<Buffer> {
  const sourcePath = assertNonEmptyString(opts.sourcePath, 'sourcePath');
  const password = assertNonEmptyString(opts.password, 'password');
  const maxBytes = typeof opts.maxBytes === 'number' && Number.isFinite(opts.maxBytes) ? opts.maxBytes : undefined;

  const st = await fsp.stat(sourcePath);
  if (!st.isFile()) throw new Error('الملف غير صالح');
  if (st.size < HEADER_LEN + TAG_LEN) throw new Error('الملف مشفر لكنه تالف');
  if (maxBytes !== undefined && st.size > maxBytes + HEADER_LEN + TAG_LEN) {
    throw new Error('حجم الملف كبير جداً');
  }

  const fh = await fsp.open(sourcePath, 'r');
  try {
    const headerBuf = Buffer.alloc(HEADER_LEN);
    const { bytesRead } = await fh.read(headerBuf, 0, HEADER_LEN, 0);
    if (bytesRead !== HEADER_LEN) throw new Error('الملف تالف');

    const magic = headerBuf.subarray(0, MAGIC.length);
    if (!magic.equals(MAGIC)) throw new Error('الملف غير مشفر أو غير مدعوم');

    const ver = headerBuf[MAGIC.length];
    if (ver !== 1 && ver !== 2) throw new Error('صيغة التشفير غير مدعومة');

    const salt = headerBuf.subarray(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN);
    const iv = headerBuf.subarray(MAGIC.length + 1 + SALT_LEN, HEADER_LEN);

    const tagBuf = Buffer.alloc(TAG_LEN);
    await fh.read(tagBuf, 0, TAG_LEN, st.size - TAG_LEN);

    const key = ver === 2 ? await deriveKeyV2(password, salt) : await deriveKeyV1(password, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tagBuf);
    if (ver === 2) {
      decipher.setAAD(headerBuf);
    }

    return await new Promise<Buffer>((resolve, reject) => {
      const input = fs.createReadStream(sourcePath, {
        start: HEADER_LEN,
        end: st.size - TAG_LEN - 1,
      });

      const chunks: Buffer[] = [];
      let total = 0;

      const onError = (e: unknown) => reject(e instanceof Error ? e : new Error(String(e)));

      input.on('error', onError);
      decipher.on('error', () => reject(new Error('كلمة المرور غير صحيحة أو الملف تالف')));

      input
        .pipe(decipher)
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          total += chunk.length;
          if (maxBytes !== undefined && total > maxBytes) {
            input.destroy(new Error('حجم الملف كبير جداً'));
          }
        })
        .on('error', onError)
        .on('end', () => resolve(Buffer.concat(chunks, total)));
    });
  } finally {
    await fh.close();
  }
}
