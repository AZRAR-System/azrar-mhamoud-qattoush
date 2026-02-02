import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { activateApp, activateWithLicenseFileContent, deactivateApp, getActivationState, isActivationValid, isCodeActivationAllowed } from '@/services/activation';
import { verifyLicenseFile } from '@/services/license';

type ActivationContextType = {
  isActivated: boolean;
  loading: boolean;
  activatedAt?: string;
  activationError?: string;
  refresh: () => Promise<void>;
  activate: (code: string) => Promise<void>;
  activateWithLicenseFileContent: (rawLicense: string) => Promise<void>;
  deactivate: () => Promise<void>;
};

const ActivationContext = createContext<ActivationContextType | undefined>(undefined);

export const ActivationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [activatedAt, setActivatedAt] = useState<string | undefined>(undefined);
  const [activationError, setActivationError] = useState<string | undefined>(undefined);

  const getDesktopDeviceIdIfAvailable = useCallback(async (): Promise<string | undefined> => {
    try {
      const id = await window.desktopDb?.getDeviceId?.();
      return typeof id === 'string' && id.trim() ? id.trim() : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const st = await getActivationState();
      setActivatedAt(st.activatedAt);

      let valid = false;
      try {
        valid = await isActivationValid(st);
      } catch {
        valid = false;
      }

      setIsActivated(valid);

      if (valid || !st.activated) {
        setActivationError(undefined);
        return;
      }

      // Provide a clear reason when activation state exists but is not valid.
      if (st.license) {
        const current = await getDesktopDeviceIdIfAvailable();
        if (!current) {
          setActivationError('تعذر قراءة بصمة الجهاز لإتمام التفعيل.');
          return;
        }
        try {
          await verifyLicenseFile(st.license, { deviceId: current });
          setActivationError('ملف التفعيل غير صالح.');
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setActivationError(msg || 'ملف التفعيل غير صالح.');
        }
        return;
      }

      if (!isCodeActivationAllowed()) {
        setActivationError('في نسخة الإنتاج: التفعيل يتم عبر ملف تفعيل مُوقّع مرتبط ببصمة الجهاز.');
        return;
      }

      setActivationError('التفعيل غير صالح.');
    } finally {
      setLoading(false);
    }
  }, [getDesktopDeviceIdIfAvailable]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activate = useCallback(async (code: string) => {
    await activateApp(code);
    await refresh();
  }, [refresh]);

  const activateWithLicense = useCallback(async (rawLicense: string) => {
    await activateWithLicenseFileContent(rawLicense);
    await refresh();
  }, [refresh]);

  const deactivate = useCallback(async () => {
    await deactivateApp();
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ isActivated, loading, activatedAt, activationError, refresh, activate, activateWithLicenseFileContent: activateWithLicense, deactivate }),
    [isActivated, loading, activatedAt, activationError, refresh, activate, activateWithLicense, deactivate]
  );

  return <ActivationContext.Provider value={value}>{children}</ActivationContext.Provider>;
};

export const useActivation = (): ActivationContextType => {
  const ctx = useContext(ActivationContext);
  if (!ctx) throw new Error('useActivation must be used within an ActivationProvider');
  return ctx;
};
