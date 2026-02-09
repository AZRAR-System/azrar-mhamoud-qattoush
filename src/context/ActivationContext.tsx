import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  activateWithLicenseFileContent,
  deactivateApp,
  getActivationState,
} from '@/services/activation';

type ActivationContextType = {
  isActivated: boolean;
  loading: boolean;
  activatedAt?: string;
  activationError?: string;
  reason?: string;
  review?: {
    serverUrl?: string;
    remoteStatus?:
      | 'active'
      | 'suspended'
      | 'revoked'
      | 'expired'
      | 'mismatch'
      | 'invalid_license'
      | 'unknown';
    remoteCheckedAt?: string;
    remoteLastAttemptAt?: string;
    remoteLastError?: string;
    remoteStatusUpdatedAt?: string;
    remoteStatusNote?: string;
  };
  refresh: () => Promise<void>;
  activateWithLicenseFileContent: (rawLicense: string) => Promise<void>;
  deactivate: () => Promise<void>;
};

const ActivationContext = createContext<ActivationContextType | undefined>(undefined);

const ACTIVATION_POLL_MS = 60_000;

const messageForReason = (r?: string): string | undefined => {
  if (!r) return undefined;
  if (r === 'remote:suspended') return 'تم تعليق الترخيص — راجع الشركة.';
  if (r === 'remote:revoked') return 'تم إلغاء الترخيص — راجع الشركة.';
  if (r === 'remote:expired') return 'انتهت صلاحية الترخيص.';
  if (r === 'remote:mismatch') return 'الترخيص غير مطابق لهذا الجهاز.';
  if (r === 'remote:invalid_license') return 'مفتاح الترخيص غير صالح.';
  if (r === 'remote:stale') return 'تعذر التحقق من حالة الترخيص عبر الإنترنت حالياً.';
  return undefined;
};

export const ActivationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [activatedAt, setActivatedAt] = useState<string | undefined>(undefined);
  const [activationError, setActivationError] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [review, setReview] = useState<ActivationContextType['review'] | undefined>(undefined);

  const applyBridgeStatus = useCallback(
    (res: unknown, opts?: { setLoading?: boolean }) => {
      const rec = res as {
        ok?: boolean;
        status?: {
          activated?: boolean;
          activatedAt?: string;
          reason?: string;
          review?: ActivationContextType['review'];
        };
        error?: string;
      };

      if (!rec?.ok) {
        setIsActivated(false);
        setActivatedAt(undefined);
        setActivationError(rec?.error || 'تعذر قراءة حالة التفعيل');
        setReason(undefined);
        setReview(undefined);
        if (opts?.setLoading) setLoading(false);
        return;
      }

      const activated = Boolean(rec.status?.activated);
      const r = typeof rec.status?.reason === 'string' ? rec.status.reason : undefined;
      const rv = rec.status?.review;

      setIsActivated(activated);
      setActivatedAt(rec.status?.activatedAt);
      setReason(r);
      setReview(rv);

      if (!activated) {
        setActivationError(messageForReason(r));
      } else {
        setActivationError(undefined);
      }

      if (opts?.setLoading) setLoading(false);
    },
    []
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Desktop: rely on Main-process licensing status via IPC.
      if (window.desktopLicense?.getStatus) {
        // Best-effort: refresh remote status first (handles remote disable/suspend).
        if (window.desktopLicense?.refreshOnlineStatus) {
          try {
            await window.desktopLicense.refreshOnlineStatus();
          } catch {
            // ignore; we'll still display last known status
          }
        }

        const res = await window.desktopLicense.getStatus();
        applyBridgeStatus(res);
        return;
      }

      // Non-desktop fallback (best-effort): keep legacy UI state only.
      const st = await getActivationState();
      setActivatedAt(st.activatedAt);
      setIsActivated(Boolean(st.activated));
      setActivationError(undefined);
      setReason(undefined);
      setReview(undefined);
    } finally {
      setLoading(false);
    }
  }, [applyBridgeStatus]);

  const refreshSilent = useCallback(async () => {
    try {
      if (!window.desktopLicense?.getStatus) return;
      const res = await window.desktopLicense.getStatus();
      applyBridgeStatus(res);
    } catch {
      // ignore transient failures
    }
  }, [applyBridgeStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Keep activation enforcement responsive while the app is running.
    // Main process already polls the server; here we just pull the latest status via IPC
    // so router guards can react without requiring app restart.
    const onFocus = () => {
      void refreshSilent();
    };

    window.addEventListener('focus', onFocus);

    const timer = window.setInterval(() => {
      if (!isActivated) return;
      void refreshSilent();
    }, ACTIVATION_POLL_MS);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [isActivated, refreshSilent]);

  const activateWithLicense = useCallback(
    async (rawLicense: string) => {
      await activateWithLicenseFileContent(rawLicense);
      await refresh();
    },
    [refresh]
  );

  const deactivate = useCallback(async () => {
    await deactivateApp();
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      isActivated,
      loading,
      activatedAt,
      activationError,
      reason,
      review,
      refresh,
      activateWithLicenseFileContent: activateWithLicense,
      deactivate,
    }),
    [
      isActivated,
      loading,
      activatedAt,
      activationError,
      reason,
      review,
      refresh,
      activateWithLicense,
      deactivate,
    ]
  );

  return <ActivationContext.Provider value={value}>{children}</ActivationContext.Provider>;
};

export const useActivation = (): ActivationContextType => {
  const ctx = useContext(ActivationContext);
  if (!ctx) throw new Error('useActivation must be used within an ActivationProvider');
  return ctx;
};
