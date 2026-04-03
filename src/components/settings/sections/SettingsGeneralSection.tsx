import {
  AlertTriangle,
  Building,
  CalendarDays,
  Globe,
  Image as ImageIcon,
  Phone,
  Shield,
} from 'lucide-react';
import { GEO_COUNTRIES, GEO_CURRENCIES } from '@/constants/geo';
import { getCurrencySuffix } from '@/services/moneySettings';
import { Select } from '@/components/ui/Select';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync';
import { useToast } from '@/context/ToastContext';
import { getErrorMessage } from '@/utils/errors';

type Props = { page: SettingsPageModel };

export function SettingsGeneralSection({ page }: Props) {
  const toast = useToast();
  const googleCal = useGoogleCalendarSync();

  const {
    clearSystemCache,
    handleLogoUpload,
    inputClass,
    labelClass,
    setSettings,
    settings,
    settingsNoAccessFallback,
  } = page;

  return (
    <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
      <div className="space-y-8 animate-fade-in">
        {/* Branding */}
        <section className="settings-section-panel">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Building className="text-indigo-500" size={20} /> الهوية التجارية
          </h3>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex flex-col items-center gap-3">
              <div className="relative group cursor-pointer">
                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden hover:border-indigo-400 transition">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <ImageIcon className="text-gray-300" size={40} />
                  )}
                </div>
                <input
                  id="settings-logo-upload"
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleLogoUpload}
                  aria-label="تحميل شعار الشركة"
                  title="تحميل شعار الشركة"
                />
              </div>
            </div>
            <div className="flex-1 grid grid-cols-1 gap-4">
              <div>
                <label className={labelClass} htmlFor="settings-company-name">
                  اسم الشركة الرسمي
                </label>
                <input
                  id="settings-company-name"
                  className={inputClass}
                  value={settings.companyName}
                  onChange={(e) =>
                    setSettings({ ...settings, companyName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="settings-company-slogan">
                  الشعار اللفظي
                </label>
                <input
                  id="settings-company-slogan"
                  className={inputClass}
                  value={settings.companySlogan || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, companySlogan: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </section>
        <section className="settings-section-panel">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Phone className="text-green-500" size={20} /> معلومات الاتصال
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
            <div>
              <label className={labelClass} htmlFor="settings-company-phone">
                الهاتف
              </label>
              <input
                id="settings-company-phone"
                className={inputClass}
                value={settings.companyPhone}
                onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="settings-company-email">
                البريد الإلكتروني
              </label>
              <input
                id="settings-company-email"
                className={inputClass}
                value={settings.companyEmail}
                onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="settings-company-website">
                الموقع
              </label>
              <input
                id="settings-company-website"
                className={inputClass}
                value={settings.companyWebsite}
                onChange={(e) =>
                  setSettings({ ...settings, companyWebsite: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="settings-company-address">
              العنوان
            </label>
            <input
              id="settings-company-address"
              className={inputClass}
              value={settings.companyAddress}
              onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
            />
          </div>
        </section>
    
        <section className="settings-section-panel">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Globe className="text-sky-500" size={20} /> البلد والعملة
          </h3>
    
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>البلد (مع العلم)</label>
              <Select
                className="w-full"
                value={String(settings.countryIso2 || 'JO').toUpperCase()}
                onChange={(e) => {
                  const iso2 = String(e.target.value || '').toUpperCase();
                  const c = GEO_COUNTRIES.find((x) => x.iso2 === iso2);
                  setSettings({
                    ...settings,
                    countryIso2: iso2 || undefined,
                    countryDialCode: c?.dialCode || undefined,
                  });
                }}
                options={GEO_COUNTRIES.map((c) => ({
                  value: c.iso2,
                  label: `${c.flag} ${c.nameAr}${c.dialCode ? ` (+${c.dialCode})` : ''}`,
                }))}
              />
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                يُستخدم كود البلد تلقائياً لتطبيع أرقام WhatsApp المكتوبة بصيغة محلية.
              </div>
            </div>
    
            <div>
              <label className={labelClass}>العملة (تصنيف/اختيار)</label>
              <Select
                className="w-full"
                value={String(settings.currency || 'JOD').toUpperCase()}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    currency: String(e.target.value || '').toUpperCase(),
                  })
                }
                options={GEO_CURRENCIES.map((cur) => {
                  const code = cur.code.toUpperCase();
                  const suffix = getCurrencySuffix(code);
                  return {
                    value: code,
                    label: `${code} — ${cur.nameAr}${suffix ? ` (${suffix})` : ''}`,
                  };
                })}
              />
            </div>
          </div>
        </section>

        {!googleCal.status.loading && googleCal.status.available ? (
          <section className="settings-section-panel">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
              <CalendarDays className="text-blue-500" size={20} /> التكامل الخارجي — Google Calendar
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-3xl leading-relaxed">
              تصدير أحادي الاتجاه: المهام والمتابعات من AZRAR إلى تقويم Google الافتراضي. رموز OAuth تُخزَّن
              مشفّرة عبر النظام فقط (ليست في قاعدة البيانات العادية). معطّل افتراضياً — فعّل ثم اربط حساب
              Google من المتصفح.
            </p>
            <div className="flex flex-col gap-4 max-w-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 dark:border-slate-600"
                  checked={googleCal.status.enabled}
                  onChange={async (e) => {
                    const r = await googleCal.setEnabled(e.target.checked);
                    if (!r.ok) toast.error('تعذر حفظ إعداد التكامل');
                  }}
                />
                <span className={labelClass}>تفعيل المزامنة مع Google Calendar</span>
              </label>

              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  disabled={!googleCal.status.enabled || googleCal.status.connected}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700"
                  onClick={async () => {
                    try {
                      const r = await googleCal.startAuth();
                      if (r.ok) toast.success('تم الربط مع Google');
                      else toast.error(r.message || 'فشل الربط');
                    } catch (err: unknown) {
                      toast.error(getErrorMessage(err) || 'فشل الربط');
                    }
                  }}
                >
                  ربط حساب Google
                </button>
                <button
                  type="button"
                  disabled={!googleCal.status.connected}
                  className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                  onClick={async () => {
                    await googleCal.signOut();
                    toast.info('تم قطع الاتصال بحساب Google');
                  }}
                >
                  قطع الاتصال
                </button>
                <button
                  type="button"
                  disabled={!googleCal.canSync}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 disabled:opacity-40"
                  onClick={async () => {
                    try {
                      const r = await googleCal.syncNow();
                      if (r.ok) toast.success('تمت المزامنة مع التقويم');
                      else toast.error((r as { message?: string }).message || 'فشل المزامنة');
                    } catch (err: unknown) {
                      toast.error(getErrorMessage(err) || 'فشل المزامنة');
                    }
                  }}
                >
                  مزامنة الآن
                </button>
              </div>

              <div className="text-[12px] text-slate-500 dark:text-slate-400 space-y-1">
                <div>
                  الحالة:{' '}
                  {googleCal.status.connected ? (
                    <span className="text-emerald-600 dark:text-emerald-400">متصل</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">غير متصل</span>
                  )}
                </div>
                {googleCal.status.lastSyncAt ? (
                  <div>آخر مزامنة: {new Date(googleCal.status.lastSyncAt).toLocaleString('ar-JO')}</div>
                ) : null}
                {googleCal.status.lastMessage ? (
                  <div className="text-slate-600 dark:text-slate-300">{googleCal.status.lastMessage}</div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="settings-section-panel">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Shield className="text-amber-500" size={20} /> الأمان والجلسة
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl">
            <div>
              <label className={labelClass} htmlFor="settings-auto-lock-minutes">
                قفل الشاشة بعد خمول (دقائق)
              </label>
              <input
                id="settings-auto-lock-minutes"
                type="number"
                min={0}
                max={240}
                className={inputClass}
                value={settings.autoLockMinutes ?? 30}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  const v = Number.isFinite(n) ? Math.max(0, Math.min(240, Math.floor(n))) : 30;
                  setSettings({ ...settings, autoLockMinutes: v });
                }}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                افتراضي 30 دقيقة. اضبط على 0 لتعطيل القفل التلقائي (تبقى الجلسة مفتوحة حتى تسجيل الخروج).
              </p>
            </div>
          </div>
        </section>
    
        {/* الترويسة وقوالب DOCX وإعدادات الطباعة: راجع «الطباعة والقوالب» في الشريط الجانبي */}
    
        {/* Advanced Reset Section */}
        <section className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-800/30">
          <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} /> منطقة الخطر (إصلاح النظام)
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600/80 dark:text-red-400/80 max-w-lg">
              في حال واجهت مشاكل في تحميل البيانات أو عرض الصفحات، يمكنك مسح الذاكرة المؤقتة
              وإعادة بناء الفهارس. لن يتم حذف البيانات الأساسية.
            </p>
            <button
              onClick={clearSystemCache}
              className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              إصلاح / مسح الكاش
            </button>
          </div>
        </section>
      </div>
    </RBACGuard>
  );
}
