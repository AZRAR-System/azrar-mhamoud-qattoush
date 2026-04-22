import React from 'react';
import { Search, Printer, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';

interface ReportsSmartFilterBarProps {
  search: string;
  setSearch: (val: string) => void;
  onPrintDashboard: () => void;
  onExportAll: () => void;
  onFinancialReport?: () => void;
  isExportingAll: boolean;
  reportsCount: number;
  showFinancialReport: boolean;
}

export const ReportsSmartFilterBar: React.FC<ReportsSmartFilterBarProps> = ({
  search,
  setSearch,
  onPrintDashboard,
  onExportAll,
  onFinancialReport,
  isExportingAll,
  reportsCount,
  showFinancialReport,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6"
            onClick={onPrintDashboard}
            leftIcon={<Printer size={20} />}
          >
            طباعة اللوحة
          </Button>

          {showFinancialReport && onFinancialReport && (
            <Button
              variant="secondary"
              className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 font-black px-6"
              onClick={onFinancialReport}
              leftIcon={<Printer size={18} />}
            >
              تصدير تقرير مالي
            </Button>
          )}

          <Button
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            onClick={onExportAll}
            disabled={isExportingAll || reportsCount === 0}
            leftIcon={<FileSpreadsheet size={18} />}
          >
            تصدير شامل (Excel)
          </Button>
        </div>
      }
      filters={
        <div className="relative group max-w-xl w-full">
          <Search
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن تقرير مالي أو إداري..."
            className="pr-12 py-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm"
          />
        </div>
      }
      pagination={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <BarChart3 size={14} className="text-indigo-500" />
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
              {reportsCount.toLocaleString()} تقرير متاح
            </span>
          </div>
        </div>
      }
    />
  );
};
