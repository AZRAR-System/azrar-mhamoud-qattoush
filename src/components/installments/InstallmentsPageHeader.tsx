import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import {
  Clock,
  DollarSign,
  FileSpreadsheet,
  FileText as FilePdf,
  Filter,
  Printer,
  Search as SearchIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DbService } from '@/services/mockDb';
import type { StatementTemplateData } from '@/components/printing/templates/StatementTemplate';
import { StatementPrintPreview } from '@/components/printing/templates/StatementTemplate';

type Props = { page: InstallmentsPageModel };

export function InstallmentsPageHeader({ page }: Props) {
  const {
    search,
    setSearch,
    isAdvancedFiltersOpen,
    setIsAdvancedFiltersOpen,
    loadData,
    handleExportExcel,
    handleExportPdf,
    clearFilters,
    isDesktop,
    statementMonth,
    setStatementMonth,
    prepareStatementPrintData,
  } = page;

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
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
      <div className="flex items-center gap-4">
        <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-500/30 text-white">
          <DollarSign size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            المالية والتحصيل
            <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full font-bold">
              إدارة الدفعات
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            متابعة العقود، السداد، والتحصيل المالي بدقة احترافية
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isDesktop ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="installments-stmt-month" className="sr-only">
              شهر كشف الحساب
            </label>
            <input
              id="installments-stmt-month"
              type="month"
              value={statementMonth}
              onChange={(e) => setStatementMonth(e.target.value)}
              className="h-[46px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-bold text-slate-800 dark:text-white"
            />
            <Button
              variant="secondary"
              type="button"
              disabled={statementBusy}
              onClick={() => void openStatement()}
              className="gap-2 rounded-2xl h-[46px] px-4 font-black"
            >
              <Printer size={18} />
              كشف حساب
            </Button>
          </div>
        ) : null}

        <div className="relative group/search">
          <SearchIcon
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-indigo-500 transition-colors"
            size={18}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث سريع: مستأجر، عقد، عقار..."
            className="pr-12 pl-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full lg:w-72 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
          />
        </div>

        <Button
          variant={isAdvancedFiltersOpen ? 'primary' : 'secondary'}
          onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
          className="gap-2 px-6 rounded-2xl h-[46px]"
        >
          <Filter size={18} />
          تصفية متقدمة
        </Button>

        <Button
          variant="outline"
          type="button"
          onClick={clearFilters}
          className="rounded-2xl h-[46px] px-4 font-black border-slate-200 dark:border-slate-600"
        >
          مسح الفلاتر
        </Button>

        <Button
          variant="secondary"
          onClick={loadData}
          className="p-3 rounded-2xl h-[46px] w-[46px]"
        >
          <Clock size={18} />
        </Button>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportExcel}
            className="hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <FileSpreadsheet size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportPdf}
            className="hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <FilePdf size={18} />
          </Button>
        </div>
      </div>
    </div>

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
