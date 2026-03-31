import { Printer } from 'lucide-react';
import { CONTRACT_WORD_FLAT_VARIABLE_COUNT } from '@/constants/contractWordTemplateVariables';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { PrintingHubKpiCards } from '@/components/settings/printing/PrintingHubKpiCards';
import { PrintingHubQuickNav } from '@/components/settings/printing/PrintingHubQuickNav';
import { PrintingLivePreviewPanel } from '@/components/settings/printing/PrintingLivePreviewPanel';
import { SettingsLetterheadDocxPrintBlocks } from '@/components/settings/printing/SettingsLetterheadDocxPrintBlocks';
import { SettingsTemplatesSection } from '@/components/settings/sections/SettingsTemplatesSection';
import { SettingsContractWordSection } from '@/components/settings/sections/SettingsContractWordSection';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsPrintingHubSection({ page }: Props) {
  const {
    docxTemplates,
    isDesktop,
    printSettingsPath,
    settings,
    settingsNoAccessFallback,
    wordTemplates,
  } = page;

  const printStatusLabel = !isDesktop ? 'الويب' : printSettingsPath?.trim() ? 'جاهز' : 'لم يُحمّل';

  return (
    <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
      <div className="animate-fade-in">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
              <Printer size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                الطباعة والقوالب
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-2xl leading-relaxed">
                مركز واحد للترويسة، قوالب DOCX وWord، إعدادات الطباعة، ومتغيرات العقد مع بحث وتصنيف؛
                المعاينة الحية تعرض شكل المستند أثناء التعديل.
              </p>
            </div>
          </div>
        </div>

        {settings ? (
          <PrintingHubKpiCards
            wordTemplatesCount={wordTemplates.length}
            docxTemplatesCount={docxTemplates.length}
            contractVariablesCount={CONTRACT_WORD_FLAT_VARIABLE_COUNT}
            printStatusLabel={printStatusLabel}
          />
        ) : null}

        <PrintingHubQuickNav />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_min(440px,42vw)] gap-8 items-start">
          <div className="space-y-6 min-w-0 order-2 xl:order-1">
            <SettingsLetterheadDocxPrintBlocks page={page} />
            <SettingsTemplatesSection page={page} />
            <SettingsContractWordSection page={page} embedded />
          </div>

          <div className="order-1 xl:order-2 xl:sticky xl:top-4 min-w-0">
            <PrintingLivePreviewPanel page={page} />
          </div>
        </div>
      </div>
    </RBACGuard>
  );
}
