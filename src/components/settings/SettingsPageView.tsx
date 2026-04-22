import { Settings as SettingsIcon } from 'lucide-react';
import { DS } from '@/constants/designSystem';
import { PageLayout } from '@/components/shared/PageLayout';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { SettingsSmartFilterBar } from './SettingsSmartFilterBar';
import { AppModal } from '@/components/ui/AppModal';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';
import { SettingsSidebar } from '@/components/settings/SettingsSidebar';
import { SettingsLoadErrorPanel } from '@/components/settings/SettingsLoadErrorPanel';
import { SettingsGeneralSection } from '@/components/settings/sections/SettingsGeneralSection';
import { SettingsPrintingHubSection } from '@/components/settings/sections/SettingsPrintingHubSection';
import { SettingsMessagesSection } from '@/components/settings/sections/SettingsMessagesSection';
import { SettingsCommissionsSection } from '@/components/settings/sections/SettingsCommissionsSection';
import { SettingsLookupsSection } from '@/components/settings/sections/SettingsLookupsSection';
import { SettingsBackupSection } from '@/components/settings/sections/SettingsBackupSection';
import { SettingsServerSection } from '@/components/settings/sections/SettingsServerSection';
import { SettingsAuditSection } from '@/components/settings/sections/SettingsAuditSection';
import { SettingsDiagnosticsSection } from '@/components/settings/sections/SettingsDiagnosticsSection';
import { SettingsAboutSection } from '@/components/settings/sections/SettingsAboutSection';
import { PrintPreviewModal } from '@/components/printing/PrintPreviewModal';

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
    wordTemplatePrintPreviewBodyHtml,
    activeWordTemplateType,
  } = page;

  const content = (
    <div className="flex flex-col h-full animate-fade-in">
      {!embedded && (
        <SmartPageHero
          variant="premium"
          title="إعدادات النظام"
          description="تخصيص البيانات، القوائم، الطباعة، والنسخ الاحتياطي"
          icon={<SettingsIcon size={32} />}
        />
      )}

      {!embedded && (
        <SettingsSmartFilterBar
          saveStatus={saveStatus}
          activeSectionLabel={page.visibleTabs.find(t => t.id === activeSection)?.label || 'الإعدادات'}
        />
      )}


      <div className={`flex flex-1 overflow-hidden h-full ${embedded ? '' : 'gap-6'}`}>
        {!embedded && <SettingsSidebar page={page} />}

        <div className={DS.settingsLayout.shell}>
          {settingsLoading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 p-8">
              جاري تحميل الإعدادات...
            </div>
          ) : (
            <div className={DS.settingsLayout.scroll}>
              <div className={DS.settingsLayout.inner}>
                <SettingsLoadErrorPanel page={page} />

                {activeSection === 'general' && settings && <SettingsGeneralSection page={page} />}
                {activeSection === 'printingHub' && settings && (
                  <SettingsPrintingHubSection page={page} />
                )}
                {activeSection === 'messages' && settings && (
                  <SettingsMessagesSection page={page} />
                )}
                {activeSection === 'commissions' && settings && (
                  <SettingsCommissionsSection page={page} />
                )}
                {activeSection === 'lookups' && <SettingsLookupsSection page={page} />}
                {activeSection === 'backup' && <SettingsBackupSection page={page} />}
                {activeSection === 'server' && <SettingsServerSection page={page} />}
                {activeSection === 'audit' && <SettingsAuditSection page={page} />}
                {activeSection === 'diagnostics' && <SettingsDiagnosticsSection page={page} />}
                {activeSection === 'about' && <SettingsAboutSection page={page} />}
              </div>
            </div>
          )}
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

      {isWordTemplatePreviewOpen && settings && (
        <PrintPreviewModal
          open={isWordTemplatePreviewOpen}
          onClose={() => setIsWordTemplatePreviewOpen(false)}
          title={
            activeWordTemplateType === 'contracts'
              ? 'معاينة — قالب العقد (بيانات تجريبية)'
              : activeWordTemplateType === 'installments'
                ? 'معاينة — قالب الكمبيالات (بيانات تجريبية)'
                : 'معاينة — محضر التسليم (بيانات تجريبية)'
          }
          settings={settings}
          bodyHtml={wordTemplatePrintPreviewBodyHtml}
          documentType={`settings_word_template_${activeWordTemplateType}`}
          defaultFileName={`معاينة_قالب_${activeWordTemplateType}`}
        />
      )}
    </div>
  );

  return embedded ? content : <PageLayout>{content}</PageLayout>;
}
