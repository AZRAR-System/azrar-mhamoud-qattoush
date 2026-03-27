import { useCallback, useEffect, useMemo, useState } from 'react';

type HasFeatureResult = {
  ok: boolean;
  enabled?: boolean;
  reason?: string;
  error?: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const isHasFeatureResult = (v: unknown): v is HasFeatureResult => {
  if (!isRecord(v)) return false;
  if (typeof v.ok !== 'boolean') return false;
  if ('enabled' in v && typeof v.enabled !== 'boolean' && typeof v.enabled !== 'undefined')
    return false;
  if ('reason' in v && typeof v.reason !== 'string' && typeof v.reason !== 'undefined')
    return false;
  if ('error' in v && typeof v.error !== 'string' && typeof v.error !== 'undefined') return false;
  return true;
};

export type DesktopFeatureState = {
  featureName: string;
  loading: boolean;
  enabled: boolean;
  ok?: boolean;
  reason?: string;
  error?: string;
  refresh: () => void;
};

/**
 * Renderer-only UX helper.
 *
 * Security is enforced in Electron Main (IPC). This hook just improves UX by
 * disabling UI early when a feature is not allowed by license.
 *
 * Behavior when not running in Desktop/Electron: returns enabled=true.
 */
export function useDesktopFeature(featureName: string): DesktopFeatureState {
  const [loading, setLoading] = useState<boolean>(true);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [ok, setOk] = useState<boolean | undefined>(undefined);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const runCheck = useCallback(
    async (isStale: () => boolean) => {
      const api = (
        window as unknown as {
          desktopLicense?: { hasFeature?: (feature: string) => Promise<unknown> };
        }
      ).desktopLicense;
      if (!api?.hasFeature) {
        // Non-desktop builds or older desktop builds: don't block UI.
        if (isStale()) return;
        setLoading(false);
        setEnabled(true);
        setOk(undefined);
        setReason(undefined);
        setError(undefined);
        return;
      }

      if (isStale()) return;
      setLoading(true);

      try {
        const res = await api.hasFeature(featureName);
        if (isStale()) return;

        if (isHasFeatureResult(res)) {
          setOk(res.ok);
          setEnabled(res.enabled !== false);
          setReason(typeof res.reason === 'string' ? res.reason : undefined);
          setError(typeof res.error === 'string' ? res.error : undefined);
        } else {
          // Unexpected response shape: don't block UI.
          setOk(undefined);
          setEnabled(true);
          setReason(undefined);
          setError(undefined);
        }
      } catch (e: unknown) {
        if (isStale()) return;
        const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : undefined;
        setOk(false);
        setEnabled(true);
        setReason(undefined);
        setError(msg || 'hasFeature failed');
      } finally {
        if (!isStale()) setLoading(false);
      }
    },
    [featureName]
  );

  useEffect(() => {
    let stale = false;
    void runCheck(() => stale);
    return () => {
      stale = true;
    };
  }, [runCheck]);

  return useMemo(
    () => ({
      featureName,
      loading,
      enabled,
      ok,
      reason,
      error,
      refresh: () => void runCheck(() => false),
    }),
    [enabled, error, featureName, loading, ok, reason, runCheck]
  );
}
