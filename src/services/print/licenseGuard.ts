import { ROUTE_PATHS } from '@/routes/paths';

export type LicenseGuardResult =
  | { ok: true }
  | { ok: false; reason: 'not-desktop' | 'bridge-missing' | 'not-activated' | 'unknown'; message: string };

export async function ensureDesktopActivated(opts?: {
  redirectToLogin?: boolean;
}): Promise<LicenseGuardResult> {
  try {
    if (typeof window === 'undefined') return { ok: false, reason: 'not-desktop', message: 'Not in browser context' };

    const bridge: any = (window as any).desktopLicensing ?? (window as any).desktopDb;
    if (!bridge?.licenseStatus) {
      return { ok: false, reason: 'bridge-missing', message: 'License bridge is not available' };
    }

    const st = await bridge.licenseStatus();
    const activated = !!(st && typeof st === 'object' ? (st as any).activated : false);
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
