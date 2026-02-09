import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

import { kvGet, kvSet, kvDelete } from '../db';
import { getOrCreateDeviceId } from '../sqlSync';
import { getDeviceFingerprintV2 } from './fingerprint';
import type { LicenseStatus, SignedLicenseFileV1 } from './types';
import { decryptBestEffort, encryptBestEffort } from './store';
import { parseSignedLicenseFileV1, verifySignedLicenseFileV1 } from './verify';

const LICENSE_STATE_KEY = 'lic_state_v1';
const ACTIVATED_FLAG_KEY = 'db_app_activated';
const LICENSE_SERVER_URL_KEY = 'lic_server_url_v1';

let onlineMonitorTimer: NodeJS.Timeout | null = null;
let onlineMonitorInFlight = false;

type StoredState = {
  v: 1;
  activatedAt: string;
  // Device binding ID used for license verification.
  // For new licenses: fp2:<sha256> (hardware fingerprint)
  // For legacy licenses: random deviceId from userData/device-id.txt
  boundToDeviceId: string;
  boundToType: 'fingerprint' | 'legacyDeviceId';
  // Optional: record current computed fingerprint for diagnostics.
  deviceFingerprint?: string;
  lastSeenAt?: string;
  // Anti-date-tamper: store time anchors to detect clock rollback.
  lastServerTimeMs?: number;
  clockTamperedAt?: string;
  clockTamperReason?: string;
  signedLicense: SignedLicenseFileV1;

  // Optional: enables online status checks + re-issue.
  licenseKeyEnc?: ReturnType<typeof encryptBestEffort>;
  serverUrl?: string;
  remoteStatus?: 'active' | 'suspended' | 'revoked' | 'expired' | 'mismatch' | 'invalid_license' | 'unknown';
  remoteCheckedAt?: string;
  remoteLastAttemptAt?: string;
  remoteLastError?: string;
  remoteStatusUpdatedAt?: string;
  remoteStatusNote?: string;
};

const buildReviewInfo = (st: StoredState | null): LicenseStatus['review'] | undefined => {
  if (!st) return undefined;
  if (!isOnlineManagedState(st) && !st.remoteStatus && !st.remoteCheckedAt && !st.remoteLastAttemptAt && !st.remoteLastError) {
    return undefined;
  }

  const serverUrl = normalizeUrl(st.serverUrl || getLicenseServerUrl());
  return {
    serverUrl: serverUrl || undefined,
    remoteStatus: st.remoteStatus,
    remoteCheckedAt: st.remoteCheckedAt,
    remoteLastAttemptAt: st.remoteLastAttemptAt,
    remoteLastError: st.remoteLastError,
    remoteStatusUpdatedAt: st.remoteStatusUpdatedAt,
    remoteStatusNote: st.remoteStatusNote,
  };
};

const parseTimeMs = (iso?: string): number | null => {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  return Number.isFinite(t) ? t : null;
};

const getOnlineTtlMs = (): number => {
  const hoursRaw = String(process.env.AZRAR_LICENSE_ONLINE_TTL_HOURS || '').trim();
  const hours = Number(hoursRaw);
  if (Number.isFinite(hours) && hours > 0) return Math.floor(hours * 60 * 60 * 1000);
  return 24 * 60 * 60 * 1000;
};

const getOnlineCheckIntervalMs = (): number => {
  const minsRaw = String(process.env.AZRAR_LICENSE_ONLINE_CHECK_INTERVAL_MINUTES || '').trim();
  const mins = Number(minsRaw);
  if (Number.isFinite(mins) && mins > 0) return Math.floor(mins * 60 * 1000);
  return 60 * 60 * 1000;
};

const getClockSkewAllowMs = (): number => {
  const raw = String(process.env.AZRAR_CLOCK_SKEW_ALLOW_MS || '').trim();
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0) return Math.floor(v);
  return 5 * 60 * 1000; // 5 minutes
};

const allowClockRollback = (): boolean => {
  const v = String(process.env.AZRAR_ALLOW_CLOCK_ROLLBACK || '').trim().toLowerCase();
  return v === '1' || v === 'true';
};

const getTrustedNowMs = (st: StoredState | null): number => {
  const now = Date.now();
  const server = st?.lastServerTimeMs;
  return Number.isFinite(Number(server)) && Number(server) > 0 ? Math.max(now, Number(server)) : now;
};

const detectClockRollback = (st: StoredState): { ok: true } | { ok: false; reason: string } => {
  if (allowClockRollback()) return { ok: true };
  const allowMs = getClockSkewAllowMs();
  const nowMs = Date.now();

  const lastSeenMs = parseTimeMs(st.lastSeenAt) ?? 0;
  if (lastSeenMs > 0 && nowMs + allowMs < lastSeenMs) {
    return { ok: false, reason: 'clock:rollback' };
  }

  const lastServerMs = Number(st.lastServerTimeMs ?? 0);
  if (Number.isFinite(lastServerMs) && lastServerMs > 0 && nowMs + allowMs < lastServerMs) {
    return { ok: false, reason: 'clock:behind_server' };
  }

  return { ok: true };
};

const clearClockTamperIfRecovered = (st: StoredState): void => {
  if (!st.clockTamperedAt) return;
  if (allowClockRollback()) return;

  const allowMs = getClockSkewAllowMs();
  const nowMs = Date.now();
  const lastSeenMs = parseTimeMs(st.lastSeenAt) ?? 0;
  const lastServerMs = Number(st.lastServerTimeMs ?? 0);
  const anchorMs = Math.max(lastSeenMs, Number.isFinite(lastServerMs) ? lastServerMs : 0);

  if (anchorMs > 0 && nowMs + allowMs >= anchorMs) {
    delete st.clockTamperedAt;
    delete st.clockTamperReason;
  }
};

const isOnlineManagedState = (st: StoredState): boolean => {
  // If a licenseKey exists, we expect periodic online checks.
  return Boolean(st.licenseKeyEnc);
};

const syncActivatedFlagFromState = (st: StoredState): void => {
  // If clock tampering was detected, force deactivation until corrected.
  if (st.clockTamperedAt) {
    kvDelete(ACTIVATED_FLAG_KEY);
    return;
  }

  // Offline-only licenses do not require online status.
  if (!isOnlineManagedState(st)) {
    kvSet(ACTIVATED_FLAG_KEY, '1');
    return;
  }

  const ttlMs = getOnlineTtlMs();
  const checkedAtMs = parseTimeMs(st.remoteCheckedAt) ?? parseTimeMs(st.activatedAt) ?? 0;
  const isFreshEnough = checkedAtMs > 0 ? Date.now() - checkedAtMs <= ttlMs : false;
  const isRemotelyActive = (st.remoteStatus ?? 'unknown') === 'active';

  if (isFreshEnough && isRemotelyActive) kvSet(ACTIVATED_FLAG_KEY, '1');
  else kvDelete(ACTIVATED_FLAG_KEY);
};

const normalizeUrl = (u: string): string => {
  const s = String(u || '').trim();
  if (!s) return '';
  return s.endsWith('/') ? s.slice(0, -1) : s;
};

export const getLicenseServerUrl = (): string => {
  try {
    const stored = String(kvGet(LICENSE_SERVER_URL_KEY) ?? '').trim();
    if (stored) return normalizeUrl(stored);
  } catch {
    // ignore
  }

  const env = String(process.env.AZRAR_LICENSE_SERVER_URL || '').trim();
  return normalizeUrl(env);
};

export const setLicenseServerUrl = (url: string): { ok: true; url: string } | { ok: false; error: string } => {
  try {
    const normalized = normalizeUrl(url);
    if (!normalized) return { ok: false, error: 'رابط السيرفر غير صالح.' };
    kvSet(LICENSE_SERVER_URL_KEY, normalized);
    return { ok: true, url: normalized };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message || 'Failed to save server URL' };
  }
};

const readPublicKeyB64 = (): string => {
  // Public verification key (Ed25519). Safe to embed.
  // Fallback to avoid activation failures if the key file can't be resolved at runtime.
  const EMBEDDED_PUBLIC_KEY_B64 = 'LwHzREBHX+CwlqYyI+RI5k4vLezMduFJ00ngTom3KSk=';

  const envKey = String(
    process.env.AZRAR_LICENSE_PUBLIC_KEY_B64 || process.env.VITE_AZRAR_LICENSE_PUBLIC_KEY || ''
  ).trim();
  if (envKey) return envKey;

  const fileName = 'azrar-license-public.key.json';

  // Dev + packaged fallback: ship a PUBLIC key file inside the app.
  // In dev, app.getAppPath() may be the project root OR the `electron/` folder,
  // so we try multiple path shapes.
  const candidates = Array.from(
    new Set([
      // Dev: workspace root
      path.join(process.cwd(), 'electron', 'assets', fileName),

      // Dev: app path variants
      path.join(app.getAppPath(), 'assets', fileName),
      path.join(app.getAppPath(), 'electron', 'assets', fileName),
      path.join(path.dirname(app.getAppPath()), 'electron', 'assets', fileName),

      // Packaged: resources
      path.join(process.resourcesPath, 'app.asar', 'electron', 'assets', fileName),
      path.join(process.resourcesPath, 'electron', 'assets', fileName),
    ])
  );

  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(String(raw || '').trim()) as { publicKeyB64?: unknown };
      const b64 = typeof parsed?.publicKeyB64 === 'string' ? String(parsed.publicKeyB64).trim() : '';
      if (b64) return b64;
    } catch {
      // try next
    }
  }

  return EMBEDDED_PUBLIC_KEY_B64;
};

const readStoredState = (): StoredState | null => {
  try {
    const raw = kvGet(LICENSE_STATE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(String(raw || '').trim()) as unknown;
    const decrypted = decryptBestEffort(parsed);
    if (!decrypted) return null;

    const st = JSON.parse(decrypted) as StoredState;
    if (!st || typeof st !== 'object') return null;
    if (st.v !== 1) return null;
    if (!st.boundToDeviceId || !st.boundToType || !st.signedLicense) return null;
    return st;
  } catch {
    return null;
  }
};

const writeStoredState = (st: StoredState): void => {
  const enc = encryptBestEffort(JSON.stringify(st));
  kvSet(LICENSE_STATE_KEY, JSON.stringify(enc));
  syncActivatedFlagFromState(st);
};

const clearStoredState = (): void => {
  kvDelete(LICENSE_STATE_KEY);
  kvDelete(ACTIVATED_FLAG_KEY);
};

export const getDeviceFingerprint = (): { ok: boolean; fingerprint?: string; warning?: string; error?: string } => {
  const res = getDeviceFingerprintV2();
  if (!res.ok) return { ok: false, error: res.error || 'Failed to compute device fingerprint' };
  return { ok: true, fingerprint: res.fingerprint, warning: res.warning };
};

export const getLicenseStatus = async (): Promise<LicenseStatus> => {
  const fpRes = getDeviceFingerprintV2();
  const deviceFingerprint = fpRes.ok ? fpRes.fingerprint : undefined;

  const st = readStoredState();
  if (!st) {
    return {
      activated: false,
      deviceFingerprint,
      reason: 'not_activated',
    };
  }

  // Anti-date-tamper: block if clock rolled back.
  const clockCheck = detectClockRollback(st);
  if (!clockCheck.ok) {
    if (!st.clockTamperedAt) {
      st.clockTamperedAt = new Date().toISOString();
      st.clockTamperReason = clockCheck.reason;
      writeStoredState(st);
    } else {
      syncActivatedFlagFromState(st);
    }
    return {
      activated: false,
      deviceFingerprint,
      reason: clockCheck.reason,
      activatedAt: st.activatedAt,
      review: buildReviewInfo(st),
      license: {
        expiresAt: st.signedLicense?.payload?.expiresAt,
        features: st.signedLicense?.payload?.features,
        deviceId: st.signedLicense?.payload?.deviceId,
      },
    };
  }

  // If the user fixed the clock since a previous tamper detection, restore activation.
  if (st.clockTamperedAt) {
    clearClockTamperIfRecovered(st);
    if (!st.clockTamperedAt) {
      try {
        writeStoredState(st);
      } catch {
        // ignore
      }
    }
  }

  // Re-verify on each call.
  const publicKeyB64 = readPublicKeyB64();
  const expectedDeviceId = st.boundToDeviceId;
  const verified = await verifySignedLicenseFileV1(st.signedLicense, {
    expectedDeviceId,
    publicKeyB64,
    nowMs: getTrustedNowMs(st),
  });

  if (!verified.ok) {
    return {
      activated: false,
      deviceFingerprint,
      reason:
        st.remoteStatus && st.remoteStatus !== 'active'
          ? `remote:${st.remoteStatus}`
          : verified.error,
      activatedAt: st.activatedAt,
      review: buildReviewInfo(st),
      license: {
        expiresAt: st.signedLicense?.payload?.expiresAt,
        features: st.signedLicense?.payload?.features,
        deviceId: st.signedLicense?.payload?.deviceId,
      },
    };
  }

  // Update last-seen timestamp after successful verification.
  try {
    st.lastSeenAt = new Date().toISOString();
    writeStoredState(st);
  } catch {
    // ignore
  }

  // Enforce online status if this license was activated online.
  if (isOnlineManagedState(st)) {
    const ttlMs = getOnlineTtlMs();
    const checkedAtMs = parseTimeMs(st.remoteCheckedAt) ?? parseTimeMs(st.activatedAt) ?? 0;
    const isFreshEnough = checkedAtMs > 0 ? Date.now() - checkedAtMs <= ttlMs : false;
    const remoteStatus = st.remoteStatus ?? 'unknown';

    if (!isFreshEnough) {
      return {
        activated: false,
        deviceFingerprint,
        reason: 'remote:stale',
        activatedAt: st.activatedAt,
        review: buildReviewInfo(st),
        license: {
          expiresAt: st.signedLicense?.payload?.expiresAt,
          features: st.signedLicense?.payload?.features,
          deviceId: st.signedLicense?.payload?.deviceId,
        },
      };
    }

    if (remoteStatus !== 'active') {
      return {
        activated: false,
        deviceFingerprint,
        reason: `remote:${remoteStatus}`,
        activatedAt: st.activatedAt,
        review: buildReviewInfo(st),
        license: {
          expiresAt: st.signedLicense?.payload?.expiresAt,
          features: st.signedLicense?.payload?.features,
          deviceId: st.signedLicense?.payload?.deviceId,
        },
      };
    }
  }

  return {
    activated: true,
    deviceFingerprint,
    activatedAt: st.activatedAt,
    lastCheckAt: new Date().toISOString(),
    reason: undefined,
    review: buildReviewInfo(st),
    license: {
      expiresAt: st.signedLicense?.payload?.expiresAt,
      features: st.signedLicense?.payload?.features,
      deviceId: st.signedLicense?.payload?.deviceId,
    },
  };
};

const getBoundDeviceIdForThisMachine = async (licenseDeviceId: string): Promise<string> => {
  const isFingerprintLicense = licenseDeviceId.startsWith('fp2:');
  if (isFingerprintLicense) {
    const fpRes = getDeviceFingerprintV2();
    if (!fpRes.ok || !fpRes.fingerprint) return '';
    return fpRes.fingerprint;
  }
  return await getOrCreateDeviceId();
};

export const activateOnline = async (payload: {
  licenseKey: string;
  serverUrl?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  try {
    const licenseKey = String(payload.licenseKey || '').trim().replace(/\s+/g, '').toUpperCase();
    if (licenseKey.length < 6) return { ok: false, error: 'يرجى إدخال مفتاح ترخيص صحيح.' };

    const serverUrl = normalizeUrl(payload.serverUrl || getLicenseServerUrl());
    if (!serverUrl) return { ok: false, error: 'رابط سيرفر التفعيل غير مُعد.' };

    // Device binding ID: prefer hardware fingerprint.
    const fpRes = getDeviceFingerprintV2();
    const deviceId = fpRes.ok && fpRes.fingerprint ? fpRes.fingerprint : await getOrCreateDeviceId();
    if (!deviceId) return { ok: false, error: 'تعذر قراءة بصمة الجهاز لإتمام التفعيل.' };

    const resp = await fetch(`${serverUrl}/api/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, deviceId }),
    });
    const json = (await resp.json().catch(() => null)) as unknown;
    const rec = (json && typeof json === 'object' ? (json as Record<string, unknown>) : null) ?? null;
    const ok = rec?.ok === true;
    if (!resp.ok || !ok) {
      const err = String(rec?.error || `HTTP ${resp.status}`).trim();
      if (err === 'suspended') return { ok: false, error: 'تم تعليق الترخيص — راجع الشركة.' };
      if (err === 'revoked') return { ok: false, error: 'تم إلغاء الترخيص — راجع الشركة.' };
      if (err === 'invalid_license') {
        return {
          ok: false,
          error: 'مفتاح الترخيص غير موجود على السيرفر. تأكد أنك أدخلت مفتاح LIC-... الصحيح وأنك تستخدم نفس رابط سيرفر التفعيل.',
        };
      }
      if (err === 'requires_new_activation') return { ok: false, error: 'هذا المفتاح مستخدم على جهاز آخر. يلزم تفعيل جديد.' };
      if (err === 'expired') return { ok: false, error: 'انتهت صلاحية الترخيص.' };
      return { ok: false, error: err || 'فشل التفعيل عبر الإنترنت.' };
    }

    const signedLicense = rec?.signedLicense;
    if (!signedLicense) return { ok: false, error: 'استجابة السيرفر غير صالحة.' };

    const serverTimeMs = (() => {
      const t = Date.parse(String(rec?.time || ''));
      return Number.isFinite(t) ? t : null;
    })();

    // Validate the signed license locally before saving.
    const lic = parseSignedLicenseFileV1(JSON.stringify(signedLicense));
    const licenseDeviceId = String(lic?.payload?.deviceId || '').trim();
    const expectedDeviceId = await getBoundDeviceIdForThisMachine(licenseDeviceId);
    const publicKeyB64 = readPublicKeyB64();
    const verified = await verifySignedLicenseFileV1(lic, {
      expectedDeviceId,
      publicKeyB64,
      nowMs: serverTimeMs ? Math.max(Date.now(), serverTimeMs) : Date.now(),
    });
    if (!verified.ok) return { ok: false, error: verified.error };

    const state: StoredState = {
      v: 1,
      activatedAt: new Date().toISOString(),
      boundToDeviceId: expectedDeviceId,
      boundToType: licenseDeviceId.startsWith('fp2:') ? 'fingerprint' : 'legacyDeviceId',
      deviceFingerprint: fpRes.ok ? fpRes.fingerprint : undefined,
      lastSeenAt: new Date().toISOString(),
      ...(serverTimeMs ? { lastServerTimeMs: serverTimeMs } : {}),
      signedLicense: lic,
      licenseKeyEnc: encryptBestEffort(licenseKey),
      serverUrl,
      remoteStatus: 'active',
      remoteCheckedAt: serverTimeMs ? new Date(serverTimeMs).toISOString() : new Date().toISOString(),
    };

    writeStoredState(state);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message || 'فشل التفعيل عبر الإنترنت.' };
  }
};

export const refreshOnlineStatus = async (): Promise<{ ok: true; status: LicenseStatus } | { ok: false; error: string }> => {
  try {
    const st = readStoredState();
    if (!st) return { ok: true, status: await getLicenseStatus() };

    const serverUrl = normalizeUrl(st.serverUrl || getLicenseServerUrl());
    if (!serverUrl) return { ok: true, status: await getLicenseStatus() };

    const licenseKey = st.licenseKeyEnc ? decryptBestEffort(st.licenseKeyEnc) : '';
    if (!licenseKey) return { ok: true, status: await getLicenseStatus() };

    const deviceId = st.boundToDeviceId;
    const resp = await fetch(`${serverUrl}/api/license/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, deviceId }),
    });
    const json = (await resp.json().catch(() => null)) as unknown;
    const rec = (json && typeof json === 'object' ? (json as Record<string, unknown>) : null) ?? null;

    const serverTimeMs = (() => {
      const t = Date.parse(String(rec?.time || ''));
      return Number.isFinite(t) ? t : null;
    })();

    const isOk = resp.ok && rec?.ok === true;
    const statusRaw = isOk ? String(rec?.status || 'unknown') : String(rec?.error || 'unknown');
    const allowed: NonNullable<StoredState['remoteStatus']>[] = [
      'active',
      'suspended',
      'revoked',
      'expired',
      'mismatch',
      'invalid_license',
      'unknown',
    ];
    const status = allowed.includes(statusRaw as NonNullable<StoredState['remoteStatus']>)
      ? (statusRaw as NonNullable<StoredState['remoteStatus']>)
      : null;

    st.remoteLastAttemptAt = new Date().toISOString();

    // If we got a definitive status (including invalid_license), persist it.
    // Otherwise treat it as a transient failure and DO NOT overwrite remoteCheckedAt
    // to preserve offline fallback until TTL expires.
    if (status) {
      st.remoteStatus = status;
      st.remoteCheckedAt = serverTimeMs ? new Date(serverTimeMs).toISOString() : new Date().toISOString();
      st.remoteLastError = undefined;
      if (serverTimeMs) st.lastServerTimeMs = serverTimeMs;

      const updatedAt = typeof rec?.statusUpdatedAt === 'string' ? String(rec.statusUpdatedAt).trim() : '';
      const note = typeof rec?.statusNote === 'string' ? String(rec.statusNote).trim() : '';
      if (updatedAt) st.remoteStatusUpdatedAt = updatedAt;
      if (note) st.remoteStatusNote = note;
    } else {
      const err = String(rec?.error || `HTTP ${resp.status}` || '').trim();
      st.remoteLastError = err || 'unknown';
    }

    st.lastSeenAt = new Date().toISOString();

    // If a tamper was previously detected and the clock is now OK vs server, clear it.
    if (st.clockTamperedAt) {
      const nowMs = Date.now();
      const allowMs = getClockSkewAllowMs();
      if (serverTimeMs && nowMs + allowMs >= serverTimeMs) {
        delete st.clockTamperedAt;
        delete st.clockTamperReason;
      }
    }

    writeStoredState(st);

    // Ensure updater gating matches remote enforcement.
    syncActivatedFlagFromState(st);

    return { ok: true, status: await getLicenseStatus() };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message || 'Failed to refresh online status' };
  }
};

export const startOnlineStatusMonitor = (): void => {
  try {
    const disabled = String(process.env.AZRAR_LICENSE_DISABLE_MONITOR || '').trim();
    if (disabled === '1' || disabled.toLowerCase() === 'true') return;

    if (onlineMonitorTimer) return;

    const intervalMs = getOnlineCheckIntervalMs();

    const tick = async () => {
      if (onlineMonitorInFlight) return;
      onlineMonitorInFlight = true;
      try {
        const st = readStoredState();
        if (!st) return;
        if (!isOnlineManagedState(st)) return;

        // Always attempt periodic refresh to allow fast remote disable.
        // If refresh fails transiently, we keep the last known good remoteCheckedAt/remoteStatus
        // and rely on TTL for offline fallback.
        const refreshed = await refreshOnlineStatus();
        if (!refreshed.ok) {
          // Best-effort: still sync updater gating based on last known state.
          try {
            const st2 = readStoredState();
            if (st2) syncActivatedFlagFromState(st2);
          } catch {
            // ignore
          }
        }
      } finally {
        onlineMonitorInFlight = false;
      }
    };

    // Run once shortly after startup.
    const startupDelayMs = 2500;
    setTimeout(() => {
      void tick();
    }, startupDelayMs);

    onlineMonitorTimer = setInterval(() => {
      void tick();
    }, intervalMs);
  } catch {
    // Best-effort: never crash startup due to monitor wiring.
  }
};

export const stopOnlineStatusMonitor = (): void => {
  if (onlineMonitorTimer) {
    clearInterval(onlineMonitorTimer);
    onlineMonitorTimer = null;
  }
};

export const activateWithLicenseContent = async (
  rawLicenseContent: string
): Promise<{ ok: true } | { ok: false; error: string }> => {
  try {
    const fpRes = getDeviceFingerprintV2();
    const legacyDeviceId = await getOrCreateDeviceId();
    const deviceFingerprint = fpRes.ok ? fpRes.fingerprint : undefined;

    const lic = parseSignedLicenseFileV1(rawLicenseContent);
    const publicKeyB64 = readPublicKeyB64();

    const licenseDeviceId = String(lic?.payload?.deviceId || '').trim();
    if (!licenseDeviceId) return { ok: false, error: 'License missing device binding.' };

    const isFingerprintLicense = licenseDeviceId.startsWith('fp2:');
    const expectedDeviceId = isFingerprintLicense ? (deviceFingerprint ?? '') : legacyDeviceId;
    if (!expectedDeviceId) {
      return {
        ok: false,
        error: isFingerprintLicense
          ? 'تعذر قراءة بصمة الجهاز (HWID) لإتمام التفعيل.'
          : 'تعذر قراءة معرف الجهاز لإتمام التفعيل.',
      };
    }

    const verified = await verifySignedLicenseFileV1(lic, {
      expectedDeviceId,
      publicKeyB64,
      nowMs: getTrustedNowMs(null),
    });

    if (!verified.ok) return { ok: false, error: verified.error };

    const state: StoredState = {
      v: 1,
      activatedAt: new Date().toISOString(),
      boundToDeviceId: expectedDeviceId,
      boundToType: isFingerprintLicense ? 'fingerprint' : 'legacyDeviceId',
      deviceFingerprint,
      lastSeenAt: new Date().toISOString(),
      signedLicense: lic,
    };

    writeStoredState(state);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message || 'فشل التفعيل' };
  }
};

export const deactivate = (): { ok: true } => {
  clearStoredState();
  return { ok: true };
};
