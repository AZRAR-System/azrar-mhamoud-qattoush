import { storage } from '@/services/storage';
import { tryParseJson } from '@/utils/json';
import { verifyLicenseFile } from '@/services/license';

export const ACTIVATION_STORAGE_KEY = 'azrar:activation:v1';
const ACTIVATION_LAST_SEEN_KEY = 'azrar:activation:lastSeenAt:v1';
const CLOCK_ROLLBACK_TOLERANCE_MS = 2 * 60 * 60 * 1000; // 2 hours

export type ActivationState = {
  activated: boolean;
  activatedAt?: string;
  // Optional legacy fields used by non-desktop (web/test) validation.
  deviceId?: string;
  license?: unknown;
};

const parseStoredActivationState = (raw: string): ActivationState | null => {
  const parsed = tryParseJson(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const rec = parsed as Record<string, unknown>;
  const activated = Boolean(rec.activated);
  const activatedAt = typeof rec.activatedAt === 'string' ? rec.activatedAt : undefined;
  return { activated, activatedAt };
};

export async function isActivationValid(state: ActivationState): Promise<boolean> {
  try {
    const w = globalThis as unknown as { window?: Window };
    const bridge = w.window?.desktopLicense;
    if (bridge?.getStatus) {
      const res = await bridge.getStatus();
      const rec = res as { ok?: boolean; status?: { activated?: boolean } };
      if (rec?.ok && rec.status) return Boolean(rec.status.activated);
      return false;
    }
  } catch {
    // fall back
  }

  // Non-desktop runtime fallback (best-effort): validate a provided signed license
  // and enforce a simple anti-clock-rollback rule.
  if (!state.activated) return false;

  if (state.license) {
    const now = new Date();

    // Anti-rollback: if the system time moves backwards too far compared to our last seen time,
    // reject before any expensive verification.
    try {
      const lastSeenRaw = await storage.getItem(ACTIVATION_LAST_SEEN_KEY);
      if (lastSeenRaw) {
        const lastSeenMs = Date.parse(String(lastSeenRaw));
        const nowMs = now.getTime();
        if (!Number.isNaN(lastSeenMs) && lastSeenMs - nowMs > CLOCK_ROLLBACK_TOLERANCE_MS) {
          return false;
        }
      }
    } catch {
      // ignore anti-rollback read failures
    }

    try {
      // Device id is optional here; if present we bind verification to it.
      const deviceId = typeof state.deviceId === 'string' ? state.deviceId : undefined;
      await verifyLicenseFile(state.license as never, { deviceId, now });

      // Best-effort: update lastSeenAt on successful validation.
      try {
        await storage.setItem(ACTIVATION_LAST_SEEN_KEY, now.toISOString());
      } catch {
        // ignore
      }

      return true;
    } catch {
      return false;
    }
  }

  // If we cannot reach the desktop licensing bridge, do NOT accept a bare
  // `activated: true` flag without a verifiable signed license.
  return false;
}

export async function getActivationState(): Promise<ActivationState> {
  const raw = await storage.getItem(ACTIVATION_STORAGE_KEY);
  if (!raw) return { activated: false };
  return parseStoredActivationState(raw) ?? { activated: false };
}

export async function isAppActivated(): Promise<boolean> {
  const st = await getActivationState();
  return await isActivationValid(st);
}

export async function activateWithLicenseFileContent(rawLicenseContent: string): Promise<void> {
  const w = globalThis as unknown as { window?: Window };
  const bridge = w.window?.desktopLicense;
  if (!bridge?.activateFromContent) {
    throw new Error('ميزة التفعيل بملف الترخيص متاحة على نسخة سطح المكتب فقط.');
  }

  const res = await bridge.activateFromContent(String(rawLicenseContent || ''));
  const rec = res as { ok?: boolean; error?: string };
  if (!rec?.ok) throw new Error(rec?.error || 'فشل التفعيل');

  // Keep minimal UI state only; authoritative activation is in Main.
  const state: ActivationState = { activated: true, activatedAt: new Date().toISOString() };
  await storage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify(state));
}

export async function deactivateApp(): Promise<void> {
  await storage.removeItem(ACTIVATION_STORAGE_KEY);

  // Best-effort: ask Main to clear activation.
  try {
    const w = globalThis as unknown as { window?: Window };
    await w.window?.desktopLicense?.deactivate?.();
  } catch {
    // ignore
  }
}
