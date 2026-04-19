import type { FC } from 'react';
import { KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { safeCopyToClipboard } from '@/utils/clipboard';
import type { UseActivationReturn } from '@/hooks/useActivation';

export const ActivationPageView: FC<{ page: UseActivationReturn }> = ({ page }) => {
  const {
    t, tr,
    isActivated, loading, activatedAt, activationError, refresh,
    code, setCode, error, busy, deviceId, loadDeviceId,
    canUseCodeActivation, statusLabel, handleActivate, handlePickLicenseFile,
  } = page;

  return (
    <div className="space-y-6">
    <SmartPageHero
      title="تفعيل النظام"
      description="إدخال رمز التفعيل لتفعيل النظام"
      icon={KeyRound}
      iconColor="text-emerald-600 dark:text-emerald-400"
      iconBg="bg-emerald-50 dark:bg-emerald-950/40"
    />
    <Card title={t('تفعيل النظام')}
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
          <div className="p-6 space-y-4 text-right" dir="rtl">
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
    );
};
