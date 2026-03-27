import { verifyAsync } from '@noble/ed25519';

import { isRecord } from '@/utils/unknown';
import { AZRAR_LICENSE_PUBLIC_KEY_B64 } from '@/license/publicKey';

export type LicensePayloadV1 = {
  v: 1;
  product: 'AZRAR';
  deviceId: string;
  issuedAt: string;
  expiresAt?: string;
  customer?: string;
  features?: string[];
};

export type SignedLicenseFileV1 = {
  payload: LicensePayloadV1;
  sig: string; // base64 signature over canonical payload JSON
};

let cachedPublicKeyB64: string | null = null;

const getEnvPublicKeyB64 = (): string =>
  String(
    (import.meta as unknown as { env?: Record<string, string> })?.env
      ?.VITE_AZRAR_LICENSE_PUBLIC_KEY || ''
  ).trim();

const normalizeB64 = (raw: string): string => {
  const s = String(raw || '')
    .trim()
    .replace(/\s+/g, '');
  if (!s) return '';

  // Accept base64url by converting to standard base64.
  let out = s.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if missing.
  const pad = out.length % 4;
  if (pad === 2) out += '==';
  else if (pad === 3) out += '=';
  else if (pad === 1) return '';

  return out;
};

const tryGetDesktopPublicKeyB64 = async (): Promise<string> => {
  try {
    const w = globalThis as unknown as { window?: Window };
    const res = await w.window?.desktopDb?.getLicensePublicKey?.();
    if (!res || typeof res !== 'object') return '';
    const r = res as Record<string, unknown>;
    if (r.ok !== true) return '';
    const b64 = typeof r.publicKeyB64 === 'string' ? r.publicKeyB64.trim() : '';
    return b64;
  } catch {
    return '';
  }
};

const getPublicKeyB64 = async (): Promise<string> => {
  if (cachedPublicKeyB64 && cachedPublicKeyB64.trim()) return cachedPublicKeyB64;

  const envKey = getEnvPublicKeyB64();
  if (envKey) {
    // cache original, but validate it decodes
    if (normalizeB64(envKey)) {
      cachedPublicKeyB64 = envKey;
      return envKey;
    }
  }

  // Source-embedded default key (production-safe). Avoids reliance on build-time env injection.
  if (AZRAR_LICENSE_PUBLIC_KEY_B64 && normalizeB64(AZRAR_LICENSE_PUBLIC_KEY_B64)) {
    cachedPublicKeyB64 = AZRAR_LICENSE_PUBLIC_KEY_B64;
    return AZRAR_LICENSE_PUBLIC_KEY_B64;
  }

  const desktopKey = await tryGetDesktopPublicKeyB64();
  if (desktopKey) {
    cachedPublicKeyB64 = desktopKey;
    return desktopKey;
  }

  return '';
};

const toStringOrUndef = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s : undefined;
};

const base64ToBytes = (b64: string): Uint8Array => {
  const norm = normalizeB64(b64);
  if (!norm) return new Uint8Array();
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const utf8ToBytes = (s: string): Uint8Array => new TextEncoder().encode(s);

export function canonicalizeLicensePayloadV1(payload: LicensePayloadV1): string {
  const canonical: LicensePayloadV1 = {
    v: 1,
    product: 'AZRAR',
    deviceId: String(payload.deviceId || ''),
    customer: toStringOrUndef(payload.customer) ?? undefined,
    issuedAt: String(payload.issuedAt || ''),
    expiresAt: toStringOrUndef(payload.expiresAt) ?? undefined,
    features: Array.isArray(payload.features) ? payload.features.map(String) : undefined,
  };

  return JSON.stringify(canonical);
}

export function parseLicenseFileContent(raw: string): SignedLicenseFileV1 {
  const trimmed = String(raw || '').trim();
  if (!trimmed) throw new Error('ملف التفعيل فارغ.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('صيغة ملف التفعيل غير صحيحة (JSON).');
  }

  if (!isRecord(parsed)) throw new Error('صيغة ملف التفعيل غير صحيحة.');

  const payloadRaw = (parsed as Record<string, unknown>).payload;
  const sig = toStringOrUndef((parsed as Record<string, unknown>).sig);
  if (!sig) throw new Error('ملف التفعيل لا يحتوي على توقيع (sig).');
  if (!isRecord(payloadRaw)) throw new Error('ملف التفعيل لا يحتوي على payload صحيحة.');

  const v = (payloadRaw as Record<string, unknown>).v;
  if (v !== 1) throw new Error('إصدار ملف التفعيل غير مدعوم.');

  const product = toStringOrUndef((payloadRaw as Record<string, unknown>).product);
  if (product !== 'AZRAR') throw new Error('ملف التفعيل ليس لهذا المنتج.');

  const deviceId = toStringOrUndef((payloadRaw as Record<string, unknown>).deviceId);
  if (!deviceId) throw new Error('ملف التفعيل لا يحتوي على بصمة جهاز (deviceId).');

  const issuedAt = toStringOrUndef((payloadRaw as Record<string, unknown>).issuedAt);
  if (!issuedAt) throw new Error('ملف التفعيل لا يحتوي على تاريخ الإصدار (issuedAt).');

  const expiresAt = toStringOrUndef((payloadRaw as Record<string, unknown>).expiresAt);
  const customer = toStringOrUndef((payloadRaw as Record<string, unknown>).customer);
  const featuresRaw = (payloadRaw as Record<string, unknown>).features;
  const features = Array.isArray(featuresRaw) ? featuresRaw.map((x) => String(x)) : undefined;

  return {
    payload: {
      v: 1,
      product: 'AZRAR',
      deviceId,
      issuedAt,
      expiresAt,
      customer,
      features,
    },
    sig,
  };
}

export async function verifyLicenseFile(
  lic: SignedLicenseFileV1,
  opts: { deviceId?: string; now?: Date } = {}
): Promise<void> {
  const publicKeyB64 = await getPublicKeyB64();
  if (!publicKeyB64) {
    throw new Error('مفتاح التحقق غير مُعد. (VITE_AZRAR_LICENSE_PUBLIC_KEY)');
  }

  const expectedDeviceId = (opts.deviceId || '').trim();
  if (expectedDeviceId && lic.payload.deviceId !== expectedDeviceId) {
    throw new Error('ملف التفعيل لا يطابق بصمة هذا الجهاز.');
  }

  const now = opts.now ?? new Date();
  if (lic.payload.expiresAt) {
    const exp = new Date(lic.payload.expiresAt);
    if (!Number.isFinite(exp.getTime())) {
      throw new Error('تاريخ انتهاء ملف التفعيل غير صالح.');
    }
    if (now.getTime() > exp.getTime()) {
      throw new Error('انتهت صلاحية ملف التفعيل.');
    }
  }

  const msg = canonicalizeLicensePayloadV1(lic.payload);
  const msgBytes = utf8ToBytes(msg);
  const sigBytes = base64ToBytes(lic.sig);
  const pubBytes = base64ToBytes(publicKeyB64);

  if (sigBytes.length !== 64 || pubBytes.length !== 32) {
    throw new Error('صيغة التوقيع أو المفتاح غير صالحة.');
  }

  const ok = await verifyAsync(sigBytes, msgBytes, pubBytes);
  if (!ok) {
    throw new Error('توقيع ملف التفعيل غير صحيح.');
  }
}
