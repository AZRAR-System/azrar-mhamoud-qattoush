import React from 'react';
import { Check, RefreshCcw } from 'lucide-react';
import { DS } from '@/constants/designSystem';
import { AppModal } from '@/components/ui/AppModal';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';
import { SettingsSidebar } from '@/components/settings/SettingsSidebar';
import { SettingsLoadErrorPanel } from '@/components/settings/SettingsLoadErrorPanel';
import { SettingsGeneralSection } from '@/components/settings/sections/SettingsGeneralSection';
import { SettingsTemplatesSection } from '@/components/settings/sections/SettingsTemplatesSection';
import { SettingsContractWordSection } from '@/components/settings/sections/SettingsContractWordSection';
import { SettingsMessagesSection } from '@/components/settings/sections/SettingsMessagesSection';
import { SettingsCommissionsSection } from '@/components/settings/sections/SettingsCommissionsSection';
import { SettingsLookupsSection } from '@/components/settings/sections/SettingsLookupsSection';
import { SettingsBackupSection } from '@/components/settings/sections/SettingsBackupSection';
import { SettingsServerSection } from '@/components/settings/sections/SettingsServerSection';
import { SettingsAuditSection } from '@/components/settings/sections/SettingsAuditSection';
import { SettingsDiagnosticsSection } from '@/components/settings/sections/SettingsDiagnosticsSection';
import { SettingsAboutSection } from '@/components/settings/sections/SettingsAboutSection';

type Props = { page: SettingsPageModel };

export function SettingsPageView({ page }: Props) {
  const {
    embedded,
    activeSection,
    settings,
    settingsLoading,
    saveStatus,
    isTableModalOpen,
    setIsTableModalOpen,
    isEditingTable,
    handleSaveTable,
    tableForm,
    setTableForm,
    isWordTemplatePreviewOpen,
    setIsWordTemplatePreviewOpen,
    wordTemplatePreviewTitle,
    setWordTemplatePreviewTitle,
    wordTemplatePreviewHtml,
    setWordTemplatePreviewHtml,
    wordTemplatePreviewBusy,
  } = page;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {!embedded && (
        <div className={`${DS.components.pageHeader} mb-6`}>
          <div>
            <h2 className={DS.components.pageTitle}>إعدادات النظام</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              تخصيص البيانات، القوائم، والنسخ الاحتياطي
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(activeSection === 'general' || activeSection === 'messages') &&
              settings &&
              !settingsLoading && (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${saveStatus === 'saving' ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'}`}
                >
                  {saveStatus === 'saving' ? (
                    <RefreshCcw size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  {saveStatus === 'saving' ? 'جاري الحفظ...' : 'تم الحفظ'}
                </div>
              )}
          </div>
        </div>
      )}

      <div className={`flex flex-1 overflow-hidden h-full ${embedded ? '' : 'gap-6'}`}>
        {!embedded && <SettingsSidebar page={page} />}

        <div className="flex-1 app-card flex flex-col relative">
          {settingsLoading && (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              جاري تحميل الإعدادات...
            </div>
          )}

            <SettingsLoadErrorPanel page={page} />

            {!settingsLoading && activeSection === 'general' && settings && (
              <SettingsGeneralSection page={page} />
            )}
            {!settingsLoading && activeSection === 'templates' && settings && (
              <SettingsTemplatesSection page={page} />
            )}
            {!settingsLoading && activeSection === 'contractWord' && (
              <SettingsContractWordSection page={page} />
            )}
            {!settingsLoading && activeSection === 'messages' && settings && (
              <SettingsMessagesSection page={page} />
            )}
            {!settingsLoading && activeSection === 'commissions' && settings && (
              <SettingsCommissionsSection page={page} />
            )}
            {activeSection === 'lookups' && <SettingsLookupsSection page={page} />}
            {!settingsLoading && activeSection === 'backup' && (
              <SettingsBackupSection page={page} />
            )}
            {!settingsLoading && activeSection === 'server' && <SettingsServerSection page={page} />}
            {!settingsLoading && activeSection === 'audit' && <SettingsAuditSection page={page} />}
            {!settingsLoading && activeSection === 'diagnostics' && (
              <SettingsDiagnosticsSection page={page} />
            )}
            {!settingsLoading && activeSection === 'about' && <SettingsAboutSection page={page} />}

        </div>
      </div>

      {isTableModalOpen && (
        <AppModal
          open={isTableModalOpen}
          title={isEditingTable ? 'تعديل اسم الجدول' : 'إنشاء جدول جديد'}
          onClose={() => setIsTableModalOpen(false)}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveTable}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold shadow-lg"
              >
                حفظ
              </button>
            </div>
          }
        >
          {!isEditingTable && (
            <div className="mb-4">
              <label
                className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1"
                htmlFor="settings-lookup-table-key"
              >
                المعرف البرمجي (إنجليزي)
              </label>
              <input
                id="settings-lookup-table-key"
                className="w-full border border-gray-200 dark:border-slate-600 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 outline-none text-sm font-mono text-slate-800 dark:text-white"
                placeholder="e.g. city_list"
                value={tableForm.name}
                onChange={(e) =>
                  setTableForm({ ...tableForm, name: e.target.value.replace(/\s+/g, '_') })
                }
              />
            </div>
          )}

          <div>
            <label
              className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1"
              htmlFor="settings-lookup-table-label"
            >
              الاسم الظاهر (عربي)
            </label>
            <input
              id="settings-lookup-table-label"
              className="w-full border border-gray-200 dark:border-slate-600 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 outline-none text-sm text-slate-800 dark:text-white"
              placeholder="مثال: قائمة المدن"
              value={tableForm.label}
              onChange={(e) => setTableForm({ ...tableForm, label: e.target.value })}
            />
          </div>
        </AppModal>
      )}

      {isWordTemplatePreviewOpen && (
        <AppModal
          open={isWordTemplatePreviewOpen}
          title={
            wordTemplatePreviewTitle ? `معاينة: ${wordTemplatePreviewTitle}` : 'معاينة قالب Word'
          }
          onClose={() => {
            setIsWordTemplatePreviewOpen(false);
            setWordTemplatePreviewHtml('');
            setWordTemplatePreviewTitle('');
          }}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsWordTemplatePreviewOpen(false);
                  setWordTemplatePreviewHtml('');
                  setWordTemplatePreviewTitle('');
                }}
                className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition font-bold"
              >
                إغلاق
              </button>
            </div>
          }
        >
          <div className="text-sm text-slate-700 dark:text-slate-200">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/40 p-4 max-h-[70vh] overflow-auto">
              {wordTemplatePreviewBusy ? (
                <div className="text-slate-500">جاري التحويل...</div>
              ) : (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: wordTemplatePreviewHtml }}
                />
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
              ملاحظة: المعاينة تقريبية (تحويل DOCX إلى HTML) وقد تختلف عن التنسيق النهائي داخل Word.
            </div>
          </div>
        </AppModal>
      )}
    </div>
  );
}
