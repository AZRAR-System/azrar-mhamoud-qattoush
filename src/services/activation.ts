import { storage } from '@/services/storage';
import { parseLicenseFileContent, type SignedLicenseFileV1, verifyLicenseFile } from '@/services/license';
import { tryParseJson } from '@/utils/json';

export const ACTIVATION_STORAGE_KEY = 'azrar:activation:v1';
const ACTIVATION_LAST_SEEN_KEY = 'azrar:activation:lastSeenAt:v1';

// Allow small backward clock drift (timezones / minor adjustments) without locking out users.
// A large rollback is a strong signal of tampering for time-limited licenses.
const MAX_CLOCK_ROLLBACK_MS = 2 * 60 * 60 * 1000; // 2 hours

let lastSeenWriteAtMs = 0;

const readLastSeenMs = async (): Promise<number | null> => {
  try {
    const raw = await storage.getItem(ACTIVATION_LAST_SEEN_KEY);
    const s = String(raw || '').trim();
    if (!s) return null;
    const d = new Date(s);
    const t = d.getTime();
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
};

const writeLastSeenMs = async (ms: number): Promise<void> => {
  try {
    const now = Date.now();
    // Throttle to reduce write amplification.
    if (now - lastSeenWriteAtMs < 5 * 60 * 1000) return;
    lastSeenWriteAtMs = now;
    await storage.setItem(ACTIVATION_LAST_SEEN_KEY, new Date(ms).toISOString());
  } catch {
    // ignore
  }
};

const enforceNoClockRollback = async (nowMs: number): Promise<void> => {
  const last = await readLastSeenMs();
  if (last !== null && nowMs + MAX_CLOCK_ROLLBACK_MS < last) {
    throw new Error('تم رصد تغيير كبير في وقت الجهاز للخلف. يرجى ضبط تاريخ/وقت الجهاز بشكل صحيح ثم إعادة المحاولة.');
  }
  await writeLastSeenMs(Math.max(last ?? 0, nowMs));
};

export type ActivationState = {
  activated: boolean;
  activatedAt?: string;
  codeHash?: string;
  deviceId?: string;
  license?: SignedLicenseFileV1;
};

export const isCodeActivationAllowed = (): boolean => {
  // Hardening: code activation is dev-only.
  // In packaged/production builds, do NOT allow activation by code even if an env var leaks.
  const env = (import.meta as unknown as { env?: Record<string, unknown> })?.env;
  const isDev = !!env?.DEV;
  if (!isDev) return false;

  const allow = String(env?.VITE_ALLOW_CODE_ACTIVATION ?? '').trim();
  return allow === '1' || allow.toLowerCase() === 'true';
};

const parseStoredActivationState = (raw: string): ActivationState | null => {
  const parsed = tryParseJson(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const rec = parsed as Record<string, unknown>;
  const activated = Boolean(rec.activated);
  const activatedAt = typeof rec.activatedAt === 'string' ? rec.activatedAt : undefined;
  const codeHash = typeof rec.codeHash === 'string' ? rec.codeHash : undefined;
  const deviceId = typeof rec.deviceId === 'string' ? rec.deviceId : undefined;

  let license: SignedLicenseFileV1 | undefined;
  try {
    const licRaw = (rec as Record<string, unknown>).license;
    if (licRaw && typeof licRaw === 'object') {
      const licStr = JSON.stringify(licRaw);
      license = parseLicenseFileContent(licStr);
    }
  } catch {
    // ignore invalid stored license
  }

  return { activated, activatedAt, codeHash, deviceId, license };
};

const getDesktopDeviceIdIfAvailable = async (): Promise<string | undefined> => {
  try {
    const w = globalThis as unknown as { window?: Window };
    const deviceId = await w.window?.desktopDb?.getDeviceId?.();
    return typeof deviceId === 'string' && deviceId.trim() ? deviceId.trim() : undefined;
  } catch {
    return undefined;
  }
};

export async function isActivationValid(state: ActivationState): Promise<boolean> {
  if (!state.activated) return false;

  // License-based activation (recommended): verify signature + device binding + expiry.
  if (state.license) {
    try {
      const current = await getDesktopDeviceIdIfAvailable();
      if (!current) return false;

      // Hardening for subscriptions: prevent extending a time-limited license by rolling back system clock.
      // Only enforced when a signed license exists (recommended production path).
      await enforceNoClockRollback(Date.now());

      await verifyLicenseFile(state.license, { deviceId: current });
      return true;
    } catch {
      return false;
    }
  }

  // Production hardening: if code activation is not allowed, then ONLY a signed license
  // file can activate the app. This prevents bypass via manually writing activation
  // state into localStorage/kv.
  if (!isCodeActivationAllowed()) {
    return false;
  }

  // For any non-license activation, always enforce device binding.
  const current = await getDesktopDeviceIdIfAvailable();
  if (!current) return false;
  if (!state.deviceId) return false;
  return current === state.deviceId;
}

const sha256Hex = async (text: string): Promise<string | null> => {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const enc = new TextEncoder();
    const bytes = enc.encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const arr = Array.from(new Uint8Array(digest));
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
};

export async function getActivationState(): Promise<ActivationState> {
  const raw = await storage.getItem(ACTIVATION_STORAGE_KEY);
  if (!raw) return { activated: false };
  return parseStoredActivationState(raw) ?? { activated: false };
}

export async function isAppActivated(): Promise<boolean> {
  const st = await getActivationState();
  return await isActivationValid(st);
}

export async function activateApp(activationCode: string): Promise<void> {
  if (!isCodeActivationAllowed()) {
    throw new Error('في نسخة الإنتاج: التفعيل يتم عبر ملف تفعيل مُوقّع مرتبط ببصمة الجهاز.');
  }

  const code = String(activationCode || '').trim();
  if (code.length < 6) {
    throw new Error('يرجى إدخال رمز تفعيل صحيح.');
  }

  const codeHash = await sha256Hex(code);
  const deviceId = await getDesktopDeviceIdIfAvailable();
  if (!deviceId) {
    throw new Error('تعذر قراءة بصمة الجهاز لإتمام التفعيل.');
  }
  const state: ActivationState = {
    activated: true,
    activatedAt: new Date().toISOString(),
    codeHash: codeHash ?? undefined,
    deviceId,
  };

  await storage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify(state));
}

export async function activateWithLicenseFileContent(rawLicenseContent: string): Promise<void> {
  const lic = parseLicenseFileContent(rawLicenseContent);
  const current = await getDesktopDeviceIdIfAvailable();
  if (!current) {
    throw new Error('تعذر قراءة بصمة الجهاز لإتمام التفعيل.');
  }

  await verifyLicenseFile(lic, { deviceId: current });

  const state: ActivationState = {
    activated: true,
    activatedAt: new Date().toISOString(),
    deviceId: current,
    license: lic,
  };

  await storage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify(state));
}

export async function deactivateApp(): Promise<void> {
  await storage.removeItem(ACTIVATION_STORAGE_KEY);
}
