import React from 'react';
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
import { Button } from '@/components/ui/Button';
import type { WordTemplateType } from '@/components/settings/settingsTypes';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsTemplatesSection({ page }: Props) {
  const {
    activeWordTemplateType,
    copyToClipboard,
    getSelectedWordTemplateName,
    handleDeleteSelectedWordTemplate,
    handleDownloadSelectedWordTemplate,
    handleImportWordTemplate,
    handlePreviewSelectedWordTemplate,
    inputClass,
    isDesktop,
    labelClass,
    refreshWordTemplates,
    setActiveWordTemplateType,
    setSelectedWordTemplateName,
    settings,
    settingsNoAccessFallback,
    wordTemplateDeleteBusy,
    wordTemplateImportBusy,
    wordTemplateKvKeysByName,
    wordTemplatePreviewBusy,
    wordTemplates,
    wordTemplatesBusy,
    wordTemplatesDir,
  } = page;

  return (
    <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
      <div className="p-8 overflow-y-auto custom-scrollbar h-full space-y-6 animate-fade-in">
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
            <FileText className="text-indigo-500" size={20} /> قوالب Word
          </h3>
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            يمكنك حفظ أكثر من قالب لكل نوع (العقد/الكمبيالات/محضر التسليم)، ثم اختيار القالب
            الافتراضي لكل نوع. يدعم النظام ملفات Word بصيغة{' '}
            <span className="font-mono">.docx</span> فقط.
          </div>
        </section>
    
        <section className="bg-white/60 dark:bg-slate-950/20 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
          {!isDesktop && (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              إدارة قوالب Word متاحة في نسخة سطح المكتب فقط.
            </div>
          )}
    
          {isDesktop && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass} htmlFor="settings-word-template-type">
                    نوع القالب
                  </label>
                  <select
                    id="settings-word-template-type"
                    className={inputClass}
                    value={activeWordTemplateType}
                    onChange={(e) =>
                      setActiveWordTemplateType(e.target.value as WordTemplateType)
                    }
                  >
                    <option value="contracts">العقد</option>
                    <option value="installments">الكمبيالات</option>
                    <option value="handover">محضر التسليم</option>
                  </select>
    
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    المسار المدعوم للحفظ:{' '}
                    <span className="font-mono">
                      {wordTemplatesDir || `templates/${activeWordTemplateType}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    ملاحظة: الاستيراد من مسارات الشبكة (UNC) غير مسموح.
                  </div>
                </div>
    
                <div>
                  <label className={labelClass} htmlFor="settings-word-template-default">
                    القالب الافتراضي
                  </label>
                  <select
                    id="settings-word-template-default"
                    className={inputClass}
                    value={getSelectedWordTemplateName(settings, activeWordTemplateType)}
                    onChange={(e) =>
                      setSelectedWordTemplateName(
                        activeWordTemplateType,
                        e.target.value || ''
                      )
                    }
                  >
                    <option value="">— لم يتم التحديد —</option>
                    {wordTemplates.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
    
                  {(() => {
                    const selected = getSelectedWordTemplateName(
                      settings,
                      activeWordTemplateType
                    ).trim();
                    const kvKey = selected
                      ? String(wordTemplateKvKeysByName[selected] || '').trim()
                      : '';
                    if (!selected) return null;
                    return (
                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        مفتاح القالب في قاعدة البيانات:{' '}
                        <span className="font-mono" dir="ltr">
                          {kvKey || 'غير متاح بعد (جرّب تحديث القائمة)'}
                        </span>
                        {kvKey ? (
                          <button
                            type="button"
                            onClick={() =>
                              void copyToClipboard(kvKey, {
                                successMessage: 'تم نسخ مفتاح القالب',
                              })
                            }
                            className="ml-2 inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold"
                            title="نسخ"
                          >
                            <Copy size={12} /> نسخ
                          </button>
                        ) : null}
                      </div>
                    );
                  })()}
    
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    إذا لم تظهر القوالب، اضغط “تحديث القائمة”.
                  </div>
                </div>
              </div>
    
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void refreshWordTemplates(activeWordTemplateType)}
                  disabled={wordTemplatesBusy}
                >
                  <RefreshCcw size={16} /> تحديث القائمة
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleImportWordTemplate}
                  disabled={wordTemplateImportBusy}
                >
                  <Upload size={16} /> استيراد قالب
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleDownloadSelectedWordTemplate}
                  disabled={
                    !getSelectedWordTemplateName(settings, activeWordTemplateType).trim()
                  }
                >
                  <Download size={16} /> تنزيل القالب
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handleDeleteSelectedWordTemplate()}
                  disabled={
                    wordTemplateDeleteBusy ||
                    !getSelectedWordTemplateName(settings, activeWordTemplateType).trim()
                  }
                >
                  <Trash2 size={16} /> حذف القالب
                </Button>
                <Button
                  variant="secondary"
                  onClick={handlePreviewSelectedWordTemplate}
                  disabled={
                    wordTemplatePreviewBusy ||
                    !getSelectedWordTemplateName(settings, activeWordTemplateType).trim()
                  }
                >
                  <Search size={16} /> معاينة
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </RBACGuard>
  );
}
