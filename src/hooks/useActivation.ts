import { useEffect, useMemo, useState, useCallback } from 'react';
import { useActivation as useActivationContext } from '@/context/ActivationContext';
import { isCodeActivationAllowed } from '@/services/activation';
import { ROUTE_PATHS } from '@/routes/paths';

export function useActivation() {
  const t = useCallback((s: string) => s, []);
  const {
    isActivated,
    loading,
    activatedAt,
    activationError,
    activate,
    activateWithLicenseFileContent,
    refresh,
  } = useActivationContext();
  
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  const isArabicText = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    return /\p{Script=Arabic}/u.test(value);
  };

  const tr = useCallback((value: unknown): string => {
    if (typeof value !== 'string') return '';
    const txt = value.trim();
    if (!txt) return '';
    return isArabicText(txt) ? t(txt) : txt;
  }, [t]);

  const loadDeviceId = async () => {
    try {
      const id = await window.desktopDb?.getDeviceId?.();
      setDeviceId(typeof id === 'string' ? id : '');
    } catch {
      setDeviceId('');
    }
  };

  useEffect(() => {
    void loadDeviceId();
  }, []);

  const canUseCodeActivation = useMemo(() => {
    return isCodeActivationAllowed();
  }, []);

  const statusLabel = useMemo(() => {
    if (loading) return '...';
    return isActivated ? t('مُفعّل') : t('غير مُفعّل');
  }, [isActivated, loading, t]);

  const handleActivate = async () => {
    setError('');
    setBusy(true);
    try {
      await activate(code);
      window.location.hash = ROUTE_PATHS.LOGIN;
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(tr(msg) || t('تعذر تفعيل النظام.'));
    } finally {
      setBusy(false);
    }
  };

  const handlePickLicenseFile = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await window.desktopDb?.pickLicenseFile?.();
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.canceled) return;
      if (rec.ok !== true) {
        const err = typeof rec.error === 'string' ? rec.error : 'تعذر تحميل ملف التفعيل.';
        setError(tr(err) || t('تعذر تحميل ملف التفعيل.'));
        return;
      }
      const content = typeof rec.content === 'string' ? rec.content : '';
      if (!content.trim()) {
        setError(t('ملف التفعيل فارغ.'));
        return;
      }

      await activateWithLicenseFileContent(content);
      window.location.hash = ROUTE_PATHS.LOGIN;
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(tr(msg) || t('تعذر تحميل ملف التفعيل.'));
    } finally {
      setBusy(false);
    }
  };

  return {
    t, tr,
    isActivated, loading, activatedAt, activationError, refresh,
    code, setCode, error, busy, deviceId, loadDeviceId,
    canUseCodeActivation, statusLabel, handleActivate, handlePickLicenseFile,
  };
}

export type UseActivationReturn = ReturnType<typeof useActivation>;
