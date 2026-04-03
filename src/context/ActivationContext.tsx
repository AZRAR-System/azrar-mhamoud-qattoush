import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

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

export const ActivationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [isActivated, setIsActivated] = useState(true);
  const [activatedAt] = useState<string | undefined>(new Date().toISOString());
  const [activationError] = useState<string | undefined>(undefined);
  const [reason] = useState<string | undefined>(undefined);
  const [review] = useState<ActivationContextType['review'] | undefined>(undefined);

  const refresh = useCallback(async () => {
    setIsActivated(true);
    setLoading(false);
  }, []);

  const activate = useCallback(async (_licenseKey: string, _opts?: { serverUrl?: string }) => {
    setIsActivated(true);
  }, []);

  const activateWithLicenseFileContent = useCallback(async (_rawLicense: string) => {
    setIsActivated(true);
  }, []);

  const deactivate = useCallback(async () => {
    // لا يمكن إلغاء التفعيل في هذا الوضع
  }, []);

  const value = useMemo(
    () => ({
      isActivated,
      loading,
      activatedAt,
      activationError,
      reason,
      review,
      refresh,
      activate,
      activateWithLicenseFileContent,
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
      activate,
      activateWithLicenseFileContent,
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
