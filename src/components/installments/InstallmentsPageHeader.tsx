import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import {
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText as FilePdf,
  Printer,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DbService } from '@/services/mockDb';
import type { StatementTemplateData } from '@/components/printing/templates/StatementTemplate';
import { StatementPrintPreview } from '@/components/printing/templates/StatementTemplate';
import { PageHero } from '@/components/shared/PageHero';

type Props = { page: InstallmentsPageModel };

/**
 * رأس صفحة الدفعات — موحّد مع العمولات والصفحات التقريرية:
 * عنوان + إجراءات ثانوية (كشف حساب، تحديث، تصدير) فقط.
 * البحث والتصفية في `InstallmentsFiltersPanel`.
 */
export function InstallmentsPageHeader({ page }: Props) {
  const { loadData, handleExportExcel, handleExportPdf, isDesktop, statementMonth, setStatementMonth, prepareStatementPrintData } = page;

  const [statementOpen, setStatementOpen] = useState(false);
  const [statementBusy, setStatementBusy] = useState(false);
  const [statementData, setStatementData] = useState<StatementTemplateData | null>(null);

  const openStatement = async () => {
    setStatementBusy(true);
    try {
      const data = await prepareStatementPrintData();
      if (data) {
        setStatementData(data);
        setStatementOpen(true);
      }
    } finally {
      setStatementBusy(false);
    }
  };

  return (
    <>
      <PageHero
        icon={<CreditCard size={26} className="text-indigo-600 dark:text-indigo-400" />}
        iconVariant="inline"
        title="الدفعات المالية"
        subtitle="إدارة الدفعات حسب العقود، السداد، ومتابعة المتأخرات"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2 lg:gap-3">
            {isDesktop ? (
              <div className="app-card px-3 py-2 flex flex-wrap items-center gap-2">
                <label htmlFor="installments-stmt-month" className="sr-only">
                  شهر كشف الحساب
                </label>
                <input
                  id="installments-stmt-month"
                  type="month"
                  value={statementMonth}
                  onChange={(e) => setStatementMonth(e.target.value)}
                  className="bg-transparent text-slate-700 dark:text-white outline-none text-sm font-bold min-w-[9rem]"
                />
                <Button
                  variant="secondary"
                  type="button"
                  size="sm"
                  disabled={statementBusy}
                  onClick={() => void openStatement()}
                  className="gap-2 rounded-xl font-black"
                >
                  <Printer size={16} />
                  كشف حساب
                </Button>
              </div>
            ) : null}

            <Button variant="secondary" type="button" onClick={loadData} className="gap-2 rounded-2xl h-[46px] px-4 font-black" title="تحديث البيانات">
              <Clock size={18} />
              تحديث
            </Button>

            <div className="inline-flex items-center gap-1 bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 p-1.5 rounded-2xl">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={handleExportExcel}
                className="rounded-xl hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="تصدير Excel"
              >
                <FileSpreadsheet size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={handleExportPdf}
                className="rounded-xl hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="طباعة / PDF"
              >
                <FilePdf size={18} />
              </Button>
            </div>
          </div>
        }
      />

      {statementOpen && statementData ? (
        <StatementPrintPreview
          open
          onClose={() => {
            setStatementOpen(false);
            setStatementData(null);
          }}
          title="كشف حساب"
          settings={DbService.getSettings()}
          data={statementData}
          documentType="installments_statement"
          entityId={`statement_${statementMonth}`}
          defaultFileName={`كشف_حساب_${statementMonth}`}
        />
      ) : null}
    </>
  );
}
