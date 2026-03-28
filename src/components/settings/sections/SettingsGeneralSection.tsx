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
  FileJson,
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
    docxTemplates,
    docxTemplatesBusy,
    generateSampleLeaseDocx,
    generateSampleLeaseTempDocx,
    generateSampleLeaseTempPdf,
    handleLogoUpload,
    importDocxTemplate,
    inputClass,
    isDesktop,
    labelClass,
    lastGeneratedTempPath,
    loadPrintSettings,
    openPrintPreviewWindow,
    printSettingsBusy,
    printSettingsForm,
    printSettingsPath,
    refreshDocxTemplates,
    savePrintSettings,
    selectedDocxTemplate,
    setPrintSettingsForm,
    setSelectedDocxTemplate,
    setSettings,
    settings,
    settingsNoAccessFallback,
    t,
  } = page;

  return (
    <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
      <div className="p-8 overflow-y-auto custom-scrollbar h-full space-y-8 animate-fade-in">
        {/* Branding */}
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
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
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
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
    
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
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
    
        {/* Word template settings moved to "القوالب (Word)" */}
    
        {/* Letterhead */}
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Building className="text-indigo-500" size={20} /> الترويسة (الطباعة/التصدير)
          </h3>
    
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="font-bold text-slate-700 dark:text-slate-200">
                إظهار الترويسة
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                عند تفعيلها سيتم إضافة معلومات هوية الشركة في قوالب التصدير والطباعة.
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={settings.letterheadEnabled !== false}
                onChange={(e) =>
                  setSettings({ ...settings, letterheadEnabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              تفعيل
            </label>
          </div>
    
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass} htmlFor="settings-letterhead-tax-number">
                الرقم الضريبي
              </label>
              <input
                id="settings-letterhead-tax-number"
                className={inputClass}
                value={settings.taxNumber || ''}
                onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
              />
            </div>
            <div>
              <label
                className={labelClass}
                htmlFor="settings-letterhead-commercial-register"
              >
                السجل التجاري
              </label>
              <input
                id="settings-letterhead-commercial-register"
                className={inputClass}
                value={settings.commercialRegister || ''}
                onChange={(e) =>
                  setSettings({ ...settings, commercialRegister: e.target.value })
                }
              />
            </div>
          </div>
    
          <div>
            <label className={labelClass}>هوية الشركة (تظهر في الترويسة)</label>
            <textarea
              className={inputClass + ' min-h-[120px]'}
              value={settings.companyIdentityText || ''}
              onChange={(e) =>
                setSettings({ ...settings, companyIdentityText: e.target.value })
              }
              placeholder={'مثال:\nالمالك: ...\nالرقم الوطني/الهوية: ...\nالترخيص: ...'}
            />
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              ملاحظة: يمكن كتابة أكثر من سطر وسيظهر كما هو في الطباعة.
            </div>
          </div>
        </section>
    
        {/* DOCX Templates (Phase 2) */}
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Building className="text-indigo-500" size={20} /> قوالب Word (DOCX)
          </h3>
    
          {!isDesktop && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              هذه الميزة متاحة في نسخة سطح المكتب فقط.
            </div>
          )}
    
          {isDesktop && (
            <>
              <div className="flex flex-col md:flex-row gap-3 md:items-end mb-4">
                <div className="flex-1">
                  <label className={labelClass}>اختيار قالب</label>
                  <select
                    className={inputClass}
                    value={selectedDocxTemplate}
                    onChange={(e) => setSelectedDocxTemplate(e.target.value)}
                    disabled={docxTemplatesBusy}
                  >
                    <option value="">(اختيار تلقائي إذا كان هناك قالب واحد)</option>
                    {docxTemplates.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    يمكنك وضع قالبك داخل مجلد المستخدم:{' '}
                    <span className="font-mono">templates/contracts</span> أو استيراده من
                    هنا.
                  </div>
                </div>
    
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={refreshDocxTemplates}
                    disabled={docxTemplatesBusy}
                    isLoading={docxTemplatesBusy}
                  >
                    تحديث
                  </Button>
                  <RBACGuard
                    requiredPermissionsAny={['PRINT_TEMPLATES_EDIT', 'SETTINGS_ADMIN']}
                  >
                    <Button
                      variant="secondary"
                      onClick={importDocxTemplate}
                      disabled={docxTemplatesBusy}
                      isLoading={docxTemplatesBusy}
                    >
                      استيراد قالب
                    </Button>
                  </RBACGuard>
                </div>
              </div>
    
              <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  المتغيرات داخل القالب تكون بصيغة{' '}
                  <span className="font-mono">{'{{tenant_name}}'}</span> وغيرها.
                </div>
                <div className="flex gap-2">
                  <RBACGuard requiredPermissionsAny={['PRINT_EXPORT', 'SETTINGS_ADMIN']}>
                    <Button
                      variant="secondary"
                      onClick={generateSampleLeaseTempDocx}
                      disabled={docxTemplatesBusy}
                      isLoading={docxTemplatesBusy}
                    >
                      توليد مؤقت (مرحلة 5)
                    </Button>
                  </RBACGuard>
                  <RBACGuard requiredPermissionsAny={['PRINT_EXPORT', 'SETTINGS_ADMIN']}>
                    <Button
                      variant="secondary"
                      onClick={generateSampleLeaseTempPdf}
                      disabled={docxTemplatesBusy}
                      isLoading={docxTemplatesBusy}
                    >
                      توليد PDF مؤقت (مرحلة 6)
                    </Button>
                  </RBACGuard>
                  <RBACGuard requiredPermissionsAny={['PRINT_PREVIEW', 'SETTINGS_ADMIN']}>
                    <Button
                      variant="secondary"
                      onClick={openPrintPreviewWindow}
                      disabled={docxTemplatesBusy}
                      isLoading={docxTemplatesBusy}
                    >
                      معاينة (مرحلة 7)
                    </Button>
                  </RBACGuard>
                  <RBACGuard requiredPermissionsAny={['PRINT_EXPORT', 'SETTINGS_ADMIN']}>
                    <Button
                      onClick={generateSampleLeaseDocx}
                      disabled={docxTemplatesBusy}
                      isLoading={docxTemplatesBusy}
                    >
                      توليد عقد تجريبي (Word)
                    </Button>
                  </RBACGuard>
                </div>
              </div>
    
              {lastGeneratedTempPath && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                  آخر ملف مؤقت: <span className="font-mono">{lastGeneratedTempPath}</span>
                </div>
              )}
            </>
          )}
        </section>
    
        {/* Print Settings (Phase 4) */}
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <FileJson className="text-indigo-500" size={20} /> إعدادات الطباعة
            (print.settings.json)
          </h3>
    
          {!isDesktop && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              هذه الميزة متاحة في نسخة سطح المكتب فقط.
            </div>
          )}
    
          {isDesktop && (
            <>
              {printSettingsPath && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                  المسار: <span className="font-mono">{printSettingsPath}</span>
                </div>
              )}
    
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>حجم الصفحة</label>
                  <select
                    className={inputClass}
                    value={
                      typeof printSettingsForm.pageSize === 'string'
                        ? printSettingsForm.pageSize
                        : 'custom'
                    }
                    disabled={printSettingsBusy}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'A4' || v === 'A5' || v === 'Letter' || v === 'Legal') {
                        setPrintSettingsForm({ ...printSettingsForm, pageSize: v });
                      }
                    }}
                  >
                    <option value="A4">A4</option>
                    <option value="A5">A5</option>
                    <option value="Letter">Letter</option>
                    <option value="Legal">Legal</option>
                    <option value="custom">(مخصص)</option>
                  </select>
                </div>
    
                <div>
                  <label className={labelClass}>الاتجاه</label>
                  <select
                    className={inputClass}
                    value={printSettingsForm.orientation}
                    disabled={printSettingsBusy}
                    onChange={(e) => {
                      const v = e.target.value === 'landscape' ? 'landscape' : 'portrait';
                      setPrintSettingsForm({ ...printSettingsForm, orientation: v });
                    }}
                  >
                    <option value="portrait">طولي</option>
                    <option value="landscape">عرضي</option>
                  </select>
                </div>
    
                <div className="md:col-span-2">
                  <label className={labelClass}>الخط</label>
                  <input
                    className={inputClass}
                    value={printSettingsForm.fontFamily}
                    disabled={printSettingsBusy}
                    onChange={(e) =>
                      setPrintSettingsForm({
                        ...printSettingsForm,
                        fontFamily: e.target.value,
                      })
                    }
                  />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    مثال: <span className="font-mono">Tahoma, Arial</span>
                  </div>
                </div>
    
                <div className="md:col-span-2">
                  <label className={labelClass}>الهوامش (مم)</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input
                      type="number"
                      className={inputClass}
                      value={printSettingsForm.marginsMm.top}
                      disabled={printSettingsBusy}
                      onChange={(e) =>
                        setPrintSettingsForm({
                          ...printSettingsForm,
                          marginsMm: {
                            ...printSettingsForm.marginsMm,
                            top: Number(e.target.value),
                          },
                        })
                      }
                      placeholder="أعلى"
                    />
                    <input
                      type="number"
                      className={inputClass}
                      value={printSettingsForm.marginsMm.right}
                      disabled={printSettingsBusy}
                      onChange={(e) =>
                        setPrintSettingsForm({
                          ...printSettingsForm,
                          marginsMm: {
                            ...printSettingsForm.marginsMm,
                            right: Number(e.target.value),
                          },
                        })
                      }
                      placeholder="يمين"
                    />
                    <input
                      type="number"
                      className={inputClass}
                      value={printSettingsForm.marginsMm.bottom}
                      disabled={printSettingsBusy}
                      onChange={(e) =>
                        setPrintSettingsForm({
                          ...printSettingsForm,
                          marginsMm: {
                            ...printSettingsForm.marginsMm,
                            bottom: Number(e.target.value),
                          },
                        })
                      }
                      placeholder="أسفل"
                    />
                    <input
                      type="number"
                      className={inputClass}
                      value={printSettingsForm.marginsMm.left}
                      disabled={printSettingsBusy}
                      onChange={(e) =>
                        setPrintSettingsForm({
                          ...printSettingsForm,
                          marginsMm: {
                            ...printSettingsForm.marginsMm,
                            left: Number(e.target.value),
                          },
                        })
                      }
                      placeholder="يسار"
                    />
                  </div>
                </div>
    
                <div className="md:col-span-2">
                  <label className={labelClass}>
                    مسار LibreOffice (soffice.exe) لتصدير PDF (مرحلة 6)
                  </label>
                  <input
                    className={inputClass}
                    value={printSettingsForm.pdfExport?.sofficePath || ''}
                    disabled={printSettingsBusy}
                    onChange={(e) =>
                      setPrintSettingsForm({
                        ...printSettingsForm,
                        pdfExport: { sofficePath: e.target.value },
                      })
                    }
                    placeholder="مثال: C:\\Program Files\\LibreOffice\\program\\soffice.exe"
                  />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    إذا كان LibreOffice موجودًا في PATH يمكنك تركه فارغًا.
                  </div>
                </div>
              </div>
    
              <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between mt-6">
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={printSettingsForm.rtl}
                      disabled={printSettingsBusy}
                      onChange={(e) =>
                        setPrintSettingsForm({
                          ...printSettingsForm,
                          rtl: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    RTL
                  </label>
    
                  <label className="inline-flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={printSettingsForm.headerEnabled}
                      disabled={printSettingsBusy}
                      onChange={(e) =>
                        setPrintSettingsForm({
                          ...printSettingsForm,
                          headerEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    ترويسة
                  </label>
    
                  <label className="inline-flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={printSettingsForm.footerEnabled}
                      disabled={printSettingsBusy}
                      onChange={(e) =>
                        setPrintSettingsForm({
                          ...printSettingsForm,
                          footerEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    ذيل
                  </label>
                </div>
    
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={loadPrintSettings}
                    disabled={printSettingsBusy}
                    isLoading={printSettingsBusy}
                  >
                    إعادة تحميل
                  </Button>
                  <RBACGuard
                    requiredPermissionsAny={['PRINT_SETTINGS_EDIT', 'SETTINGS_ADMIN']}
                  >
                    <Button onClick={savePrintSettings} disabled={printSettingsBusy} isLoading={printSettingsBusy}>
                      حفظ
                    </Button>
                  </RBACGuard>
                </div>
              </div>
            </>
          )}
        </section>
    
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
