import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useActivation } from '@/context/ActivationContext';
import { isCodeActivationAllowed } from '@/services/activation';
import { KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';
import { safeCopyToClipboard } from '@/utils/clipboard';

export const Activation: React.FC = () => {
  const { t } = useTranslation();
  const {
    isActivated,
    loading,
    activatedAt,
    activationError,
    activate,
    activateWithLicenseFileContent,
    refresh,
  } = useActivation();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  const isArabicText = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    return /\p{Script=Arabic}/u.test(value);
  };

  const tr = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const txt = value.trim();
    if (!txt) return '';
    return isArabicText(txt) ? t(txt) : txt;
  };

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
      // Re-run bootstrap so desktop KV hydration happens after activation.
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="w-full max-w-lg">
        <Card
          title={t('تفعيل النظام')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void refresh();
                void loadDeviceId();
              }}
              disabled={busy}
              rightIcon={<RefreshCw size={16} className={busy ? 'animate-spin' : ''} />}
            >
              {t('تحديث الحالة')}
            </Button>
          }
        >
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{t('الحالة')}</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck
                    size={18}
                    className={isActivated ? 'text-emerald-600' : 'text-slate-400'}
                  />
                  {statusLabel}
                </div>
                {isActivated && activatedAt && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t('آخر تفعيل:')} {new Date(activatedAt).toLocaleString()}
                  </div>
                )}

                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 whitespace-normal break-words">
                      <span className="font-semibold">{t('بصمة الجهاز:')}</span>{' '}
                      {deviceId ? (
                        <span className="font-mono break-all">{deviceId}</span>
                      ) : (
                        <span>{t('غير متوفرة')}</span>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!deviceId) return;
                        void safeCopyToClipboard(deviceId);
                      }}
                      disabled={!deviceId}
                      className="flex-shrink-0"
                    >
                      {t('نسخ')}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">AZRAR Desktop</div>
            </div>

            {!isActivated && (
              <>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {canUseCodeActivation
                    ? t('أدخل رمز التفعيل لتفعيل النظام.')
                    : t('التفعيل في نسخة الإنتاج يتم عبر ملف تفعيل مُوقّع مرتبط ببصمة الجهاز.')}
                </div>

                {canUseCodeActivation && (
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t('رمز التفعيل')}
                    icon={<KeyRound size={16} />}
                    error={error}
                    autoFocus
                  />
                )}

                {!canUseCodeActivation && error && (
                  <div className="text-xs text-rose-600 dark:text-rose-300 font-semibold">
                    {tr(error) || error}
                  </div>
                )}

                {!canUseCodeActivation && !error && activationError && (
                  <div className="text-xs text-rose-600 dark:text-rose-300 font-semibold">
                    {tr(activationError) || String(activationError)}
                  </div>
                )}

                <div className="flex gap-3">
                  {canUseCodeActivation && (
                    <Button
                      className="flex-1"
                      onClick={() => void handleActivate()}
                      disabled={busy || loading || code.trim().length < 6}
                    >
                      {busy ? t('جاري التفعيل...') : t('تفعيل')}
                    </Button>
                  )}

                  <Button
                    className="flex-1"
                    variant={canUseCodeActivation ? 'secondary' : 'primary'}
                    onClick={() => void handlePickLicenseFile()}
                    disabled={busy || loading || !window.desktopDb?.pickLicenseFile}
                  >
                    {t('تحميل ملف التفعيل')}
                  </Button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('ملاحظة: إذا كنت تملك ملف تفعيل/كود من الدعم، استخدمه هنا.')}
                </div>
              </>
            )}

            {isActivated && (
              <div className="text-sm text-emerald-700 dark:text-emerald-300">
                {t('النظام مُفعّل. يمكنك المتابعة إلى تسجيل الدخول.')}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
