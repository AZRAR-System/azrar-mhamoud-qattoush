import { storage } from '@/services/storage';
import { tryParseJson } from '@/utils/json';

export const ACTIVATION_STORAGE_KEY = 'azrar:activation:v1';

export type ActivationState = {
  activated: boolean;
  activatedAt?: string;
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

  // Non-desktop runtime fallback (should not be used for production licensing).
  return Boolean(state.activated);
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
