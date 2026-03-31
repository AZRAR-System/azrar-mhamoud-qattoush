import {
  Database,
  Building,
  List,
  Upload,
  Globe,
  Phone,
  Bell,
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  Search,
  Check,
  FolderOpen,
  ArrowRight,
  RefreshCcw,
  Edit2,
  BadgeDollarSign,
  History,
  Shield,
  FileSpreadsheet,
  Info,
  PlayCircle,
  AlertTriangle,
  Copy,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { GEO_COUNTRIES, GEO_CURRENCIES } from '@/constants/geo';
import { getCurrencySuffix } from '@/services/moneySettings';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsGeneralSection({ page }: Props) {
  const {
    clearSystemCache,
    handleLogoUpload,
    inputClass,
    labelClass,
    setSettings,
    settings,
    settingsNoAccessFallback,
    t,
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
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
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
                  onChange={(e) => setSettings({ ...settings, companySlogan: e.target.value })}
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
                onChange={(e) => setSettings({ ...settings, companyWebsite: e.target.value })}
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

        {/* الترويسة وقوالب DOCX وإعدادات الطباعة: راجع «الطباعة والقوالب» في الشريط الجانبي */}

        {/* Advanced Reset Section */}
        <section className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-800/30">
          <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} /> منطقة الخطر (إصلاح النظام)
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600/80 dark:text-red-400/80 max-w-lg">
              في حال واجهت مشاكل في تحميل البيانات أو عرض الصفحات، يمكنك مسح الذاكرة المؤقتة وإعادة
              بناء الفهارس. لن يتم حذف البيانات الأساسية.
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
