import { ROUTE_PATHS } from '@/routes/paths';

export type LicenseGuardResult =
  | { ok: true }
  | { ok: false; reason: 'not-desktop' | 'bridge-missing' | 'not-activated' | 'unknown'; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

export async function ensureDesktopActivated(opts?: {
  redirectToLogin?: boolean;
}): Promise<LicenseGuardResult> {
  try {
    if (typeof window === 'undefined') return { ok: false, reason: 'not-desktop', message: 'Not in browser context' };

    const w = window as unknown as { desktopLicensing?: unknown; desktopDb?: unknown };
    const bridge = (w.desktopLicensing ?? w.desktopDb) as unknown;
    if (!isRecord(bridge) || typeof bridge.licenseStatus !== 'function') {
      return { ok: false, reason: 'bridge-missing', message: 'License bridge is not available' };
    }

    const st = await (bridge.licenseStatus as () => Promise<unknown>)();
    const activated = isRecord(st) && typeof st.activated === 'boolean' ? st.activated : false;
    if (!activated) {
      if (opts?.redirectToLogin) {
        try {
          window.location.hash = ROUTE_PATHS.LOGIN;
        } catch {
          // ignore
        }
      }
      return { ok: false, reason: 'not-activated', message: 'تفعيل مطلوب' };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown', message: 'تعذر التحقق من التفعيل' };
  }
}
