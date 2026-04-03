import React from 'react';
import type { SystemSettings } from '@/types';
import type { FinancialReportTemplateData } from '@/components/printing/templates/FinancialReportTemplate';
import { FinancialReportPrintPreview } from '@/components/printing/templates/FinancialReportTemplate';

type Props = {
  onClose: () => void;
  reportData?: FinancialReportTemplateData;
  settings?: SystemSettings;
};

export const FinancialReportPrintPanel: React.FC<Props> = ({
  onClose,
  reportData,
  settings,
}) => {
  if (!reportData || !settings) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        لا تتوفر بيانات التقرير. جرّب توليد تقرير مجدول من الإعدادات ثم أعد المحاولة.
      </div>
    );
  }

  const ymd = new Date().toISOString().slice(0, 10);

  return (
    <FinancialReportPrintPreview
      open
      onClose={onClose}
      title="تقرير مالي مجدول"
      settings={settings}
      data={reportData}
      documentType="scheduled_financial_report"
      entityId="scheduled_report"
      defaultFileName={`تقرير-مالي-${ymd}`}
    />
  );
};
