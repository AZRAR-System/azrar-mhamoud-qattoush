import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  activateWithLicenseKey,
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
  activate: (licenseKey: string, opts?: { serverUrl?: string }) => Promise<void>;
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
  const [loading, setLoading] = useState(false);
  const [isActivated, setIsActivated] = useState(true);
  const [activatedAt, setActivatedAt] = useState<string | undefined>(new Date().toISOString());
  const [activationError, setActivationError] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [review, setReview] = useState<ActivationContextType['review'] | undefined>(undefined);

  const refresh = useCallback(async () => {
    setIsActivated(true);
    setLoading(false);
  }, []);

  const activate = useCallback(async (licenseKey: string, opts?: { serverUrl?: string }) => {
    setIsActivated(true);
  }, []);

  const activateWithLicenseFileContent = useCallback(async (rawLicense: string) => {
    setIsActivated(true);
  }, []);

  const deactivate = useCallback(async () => {
    // لا يمكن إلغاء التفعيل في هذا الوضع
  }, []);

  const value = useMemo(
    () => ({
      isActivated: true,
      loading: false,
      activatedAt,
      activationError,
      reason,
      review,
      refresh,
      activate,
      activateWithLicenseFileContent,
      deactivate,
    }),
    [activatedAt, activationError, reason, review, refresh, activate, activateWithLicenseFileContent, deactivate]
  );

  return <ActivationContext.Provider value={value}>{children}</ActivationContext.Provider>;
};

export const useActivation = (): ActivationContextType => {
  const ctx = useContext(ActivationContext);
  if (!ctx) throw new Error('useActivation must be used within an ActivationProvider');
  return ctx;
};
