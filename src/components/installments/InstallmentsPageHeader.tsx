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
import { SmartPageHero } from '@/components/shared/SmartPageHero';

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
      <SmartPageHero
        variant="premium"
        icon={<CreditCard size={32} />}
        title="الدفعات المالية"
        description="إدارة الدفعات حسب العقود، السداد، ومتابعة المتأخرات بنظام أزرار."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3 lg:gap-4">
            {isDesktop ? (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
                <label htmlFor="installments-stmt-month" className="sr-only">
                  شهر كشف الحساب
                </label>
                <input
                  id="installments-stmt-month"
                  type="month"
                  value={statementMonth}
                  onChange={(e) => setStatementMonth(e.target.value)}
                  className="bg-transparent text-white outline-none text-sm font-black min-w-[9rem] [color-scheme:dark]"
                />
                <Button
                  variant="secondary"
                  type="button"
                  size="sm"
                  disabled={statementBusy}
                  onClick={() => void openStatement()}
                  className="gap-2 rounded-xl font-black bg-white/20 hover:bg-white/30 border-none text-white"
                >
                  <Printer size={16} />
                  كشف حساب
                </Button>
              </div>
            ) : null}

            <Button 
                variant="secondary" 
                type="button" 
                onClick={() => void loadData()} 
                className="gap-2 rounded-2xl h-[48px] px-6 font-black bg-white/10 hover:bg-white/20 border-white/20 text-white backdrop-blur-md" 
                title="تحديث البيانات"
            >
              <Clock size={18} />
              تحديث
            </Button>

            <div className="inline-flex items-center gap-1 bg-white/10 border border-white/20 p-1.5 rounded-2xl backdrop-blur-md">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={handleExportExcel}
                className="rounded-xl hover:bg-white/20 text-white"
                title="تصدير Excel"
              >
                <FileSpreadsheet size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={handleExportPdf}
                className="rounded-xl hover:bg-white/20 text-white"
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
