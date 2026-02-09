import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useActivation } from '@/context/ActivationContext';
import { KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';
import { LOCALE_AR_LATN_GREGORY } from '@/utils/format';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { loadLicenseAdminServerSettings, saveLicenseAdminSelectedServer } from '@/features/licenseAdmin/settings';

export const Activation: React.FC = () => {
  const { t } = useTranslation();
  const {
    isActivated,
    loading,
    activatedAt,
    activationError,
    reason,
    review,
    activateWithLicenseFileContent,
    refresh,
  } = useActivation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  const [copyHint, setCopyHint] = useState<'ok' | 'fail' | ''>('');
  const [licenseKey, setLicenseKey] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [savedServers, setSavedServers] = useState<string[]>([]);

  useEffect(() => {
    if (!copyHint) return;
    const id = window.setTimeout(() => setCopyHint(''), 1800);
    return () => window.clearTimeout(id);
  }, [copyHint]);

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
      // Prefer HW fingerprint when available.
      const fpRes = await window.desktopLicense?.getDeviceFingerprint?.();
      const fp = fpRes && typeof fpRes === 'object' ? (fpRes as Record<string, unknown>) : {};
      const fpVal = typeof fp.fingerprint === 'string' ? fp.fingerprint : '';
      if (fpVal) {
        setDeviceId(fpVal);
        return;
      }

      const id = await window.desktopDb?.getDeviceId?.();
      setDeviceId(typeof id === 'string' ? id : '');
    } catch {
      setDeviceId('');
    }
  };

  const loadServerUrl = async () => {
    try {
      const res = await window.desktopLicense?.getServerUrl?.();
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      const url = typeof rec.url === 'string' ? rec.url : '';
      if (String(url || '').trim()) {
        setServerUrl(String(url));
        return;
      }

      // Fallback to saved License Admin server selection (multi-server workflow).
      const st = loadLicenseAdminServerSettings();
      if (st.selectedServer) setServerUrl(st.selectedServer);
    } catch {
      const st = loadLicenseAdminServerSettings();
      setServerUrl(st.selectedServer || '');
    }
  };

  useEffect(() => {
    const st = loadLicenseAdminServerSettings();
    setSavedServers(st.servers);
    void loadDeviceId();
    void loadServerUrl();
  }, []);

  const statusLabel = useMemo(() => {
    if (loading) return '...';
    return isActivated ? t('مُفعّل') : t('غير مُفعّل');
  }, [isActivated, loading, t]);


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

  const handleActivateOnline = async () => {
    setError('');
    setBusy(true);
    try {
      if (!window.desktopLicense?.activateOnline) {
        setError(t('ميزة التفعيل عبر الإنترنت غير متاحة في هذه النسخة.'));
        return;
      }

      // Persist URL if user provided it.
      if (serverUrl.trim() && window.desktopLicense?.setServerUrl) {
        await window.desktopLicense.setServerUrl(serverUrl.trim());
      }

      const res = await window.desktopLicense.activateOnline({
        licenseKey: licenseKey.trim(),
        serverUrl: serverUrl.trim() ? serverUrl.trim() : undefined,
      });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) {
        const msg = typeof rec.error === 'string' ? rec.error : t('تعذر تفعيل النظام.');
        setError(tr(msg) || t('تعذر تفعيل النظام.'));
        return;
      }

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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="w-full max-w-lg">
        <Card
          className="overflow-visible"
          title={t('تفعيل النظام')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void refresh();
                void loadDeviceId();
                void window.desktopLicense?.refreshOnlineStatus?.();
              }}
              disabled={busy}
              rightIcon={<RefreshCw size={16} className={busy ? 'animate-spin' : ''} />}
            >
              {t('تحديث الحالة')}
            </Button>
          }
        >
          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t('الحالة')}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <ShieldCheck size={18} className={isActivated ? 'text-emerald-600' : 'text-slate-400'} />
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{statusLabel}</div>
                    {!loading && (
                      <div
                        className={
                          'ms-1 rounded-md px-2 py-0.5 text-[11px] font-bold ' +
                          (isActivated
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')
                        }
                      >
                        {isActivated ? t('مُعتمد') : t('يتطلب تفعيل')}
                      </div>
                    )}
                  </div>

                  {isActivated && activatedAt && (
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t('آخر تفعيل:')} {new Date(activatedAt).toLocaleString(LOCALE_AR_LATN_GREGORY)}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">AZRAR Desktop</div>
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{t('بصمة الجهاز')}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 px-3 py-2 overflow-x-auto">
                      <span className="font-mono text-[11px] text-slate-800 dark:text-slate-100 whitespace-nowrap" dir="ltr">
                        {deviceId || t('غير متوفرة')}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        if (!deviceId) return;
                        const res = await safeCopyToClipboard(deviceId);
                        setCopyHint(res.ok ? 'ok' : 'fail');
                      }}
                      disabled={!deviceId}
                      className="flex-shrink-0 w-full sm:w-auto"
                    >
                      {t('نسخ')}
                    </Button>
                  </div>
                  {!!copyHint && (
                    <div
                      className={
                        'mt-1 text-[11px] font-semibold ' +
                        (copyHint === 'ok'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-700 dark:text-rose-200')
                      }
                    >
                      {copyHint === 'ok' ? t('تم النسخ') : t('تعذر النسخ')}
                    </div>
                  )}
                </div>

                {!error && !activationError && reason && !isActivated && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-nowrap">
                    <span className="font-semibold">{t('السبب:')}</span>{' '}
                    <span className="font-mono" dir="ltr">
                      {reason}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {!isActivated && (
              <>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {t('التفعيل يتم عبر ملف تفعيل مُوقّع مرتبط ببصمة الجهاز أو عبر الإنترنت بمفتاح ترخيص.')}
                </div>

                {(error || (!error && activationError)) && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-3">
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-200">{t('مشكلة بالتفعيل')}</div>
                    <div className="mt-1 text-xs text-rose-700 dark:text-rose-200 overflow-x-auto whitespace-nowrap">
                      <span className="font-mono" dir="ltr">
                        {tr(error) || tr(activationError) || String(error || activationError || '')}
                      </span>
                    </div>
                  </div>
                )}

                {!!review && (reason === 'remote:suspended' || reason === 'remote:revoked' || review.remoteStatusUpdatedAt || review.remoteStatusNote) && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('معلومات المراجعة')}
                    </div>
                    {review.remoteStatusUpdatedAt && (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-nowrap">
                        {t('تاريخ الحالة:')}{' '}
                        <span className="font-mono" dir="ltr">
                          {new Date(review.remoteStatusUpdatedAt).toLocaleString(LOCALE_AR_LATN_GREGORY)}
                        </span>
                      </div>
                    )}
                    {review.remoteLastAttemptAt && (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-nowrap">
                        {t('آخر محاولة اتصال:')}{' '}
                        <span className="font-mono" dir="ltr">
                          {new Date(review.remoteLastAttemptAt).toLocaleString(LOCALE_AR_LATN_GREGORY)}
                        </span>
                      </div>
                    )}
                    {review.remoteStatusNote && (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-nowrap">
                        {t('ملاحظة:')}{' '}
                        <span className="font-mono" dir="ltr">
                          {String(review.remoteStatusNote)}
                        </span>
                      </div>
                    )}
                    {review.remoteLastError && (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-nowrap">
                        {t('آخر خطأ اتصال:')}{' '}
                        <span className="font-mono" dir="ltr">
                          {String(review.remoteLastError)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button
                    className="flex-1"
                    variant="primary"
                    onClick={() => void handlePickLicenseFile()}
                    disabled={busy || loading || !window.desktopDb?.pickLicenseFile}
                  >
                    {t('تحميل ملف التفعيل')}
                  </Button>
                </div>

                {!!window.desktopLicense?.activateOnline && (
                  <div className="pt-3 space-y-2">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {t('تفعيل عبر الإنترنت (مفتاح ترخيص):')}
                    </div>
                    <Input
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder={t('مفتاح الترخيص')}
                      icon={<KeyRound size={16} />}
                      error={error}
                    />

                    {savedServers.length ? (
                      <Select
                        value={serverUrl}
                        onChange={(e) => {
                          const next = String(e.target.value);
                          setServerUrl(next);
                          if (next) saveLicenseAdminSelectedServer(next);
                        }}
                        options={savedServers.map((s) => ({ value: s, label: s }))}
                      />
                    ) : null}

                    <Input
                      value={serverUrl}
                      onChange={(e) => {
                        const next = e.target.value;
                        setServerUrl(next);
                        if (next.trim()) saveLicenseAdminSelectedServer(next);
                      }}
                      placeholder={t('رابط سيرفر التفعيل (اختياري)')}
                    />

                    <Button
                      className="w-full"
                      onClick={() => void handleActivateOnline()}
                      disabled={busy || loading || licenseKey.trim().length < 6}
                    >
                      {busy ? t('جاري التفعيل...') : t('تفعيل عبر الإنترنت')}
                    </Button>
                  </div>
                )}

                <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('ملاحظة: إذا كنت تملك ملف تفعيل من الدعم، استخدمه هنا.')}
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
