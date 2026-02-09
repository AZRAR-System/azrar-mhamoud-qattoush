import crypto from 'node:crypto';
import { hashes, verify } from '@noble/ed25519';
import type { SignedLicenseFileV1, LicensePayloadV1 } from './types';

// @noble/ed25519 v3 requires hashes.sha512 to be set in some runtimes.
// In Electron/Node we can safely provide it via node:crypto.
if (!hashes.sha512) {
  hashes.sha512 = (message: Uint8Array) => crypto.createHash('sha512').update(message).digest();
}

const normalizeB64 = (s: string): string => String(s || '').trim().replace(/\s+/g, '');

const parseIsoOrNull = (s: unknown): number | null => {
  if (typeof s !== 'string') return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
};

export const canonicalizeLicensePayloadV1 = (payload: LicensePayloadV1): string => {
  const canonical: LicensePayloadV1 = {
    v: 1,
    deviceId: String(payload.deviceId || '').trim(),
    issuedAt: String(payload.issuedAt || '').trim(),
    ...(payload.expiresAt ? { expiresAt: String(payload.expiresAt).trim() } : {}),
    ...(payload.features && typeof payload.features === 'object' ? { features: payload.features } : {}),
  };
  return JSON.stringify(canonical);
};

export const parseSignedLicenseFileV1 = (raw: string): SignedLicenseFileV1 => {
  const parsed = JSON.parse(String(raw || '').trim()) as SignedLicenseFileV1;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid license file');
  if (!parsed.payload || typeof parsed.payload !== 'object') throw new Error('Invalid license payload');
  if (!parsed.sig || typeof parsed.sig !== 'string') throw new Error('Invalid license signature');
  return parsed;
};

export const verifySignedLicenseFileV1 = async (
  lic: SignedLicenseFileV1,
  opts: {
    expectedDeviceId?: string;
    publicKeyB64: string;
    nowMs?: number;
  }
): Promise<{ ok: true } | { ok: false; error: string }> => {
  try {
    const publicKeyB64 = normalizeB64(opts.publicKeyB64);
    if (!publicKeyB64) return { ok: false, error: 'Missing license public key.' };

    const payload = lic.payload as LicensePayloadV1;
    if (payload?.v !== 1) return { ok: false, error: 'Unsupported license version.' };

    const msg = canonicalizeLicensePayloadV1(payload);

    const sigBytes = Buffer.from(normalizeB64(lic.sig), 'base64');
    const pubBytes = Buffer.from(publicKeyB64, 'base64');

    const ok = await verify(sigBytes, Buffer.from(msg, 'utf8'), pubBytes);
    if (!ok) return { ok: false, error: 'Invalid license signature.' };

    if (opts.expectedDeviceId && String(payload.deviceId || '').trim() !== String(opts.expectedDeviceId).trim()) {
      return { ok: false, error: 'License is not bound to this device.' };
    }

    const now = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
    const exp = parseIsoOrNull(payload.expiresAt);
    if (exp !== null && now > exp) {
      return { ok: false, error: 'License is expired.' };
    }

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message || 'Failed to verify license' };
  }
};

export const sha256Hex = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
