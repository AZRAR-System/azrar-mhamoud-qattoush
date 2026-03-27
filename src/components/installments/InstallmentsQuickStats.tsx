import React from 'react';
import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import { AlertCircle, BarChart3, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type Props = { page: InstallmentsPageModel };

export function InstallmentsQuickStats({ page }: Props) {
  const { isDesktopFast, financialStats, showCharts, setShowCharts } = page;

  return (
    <>
    {!isDesktopFast && financialStats && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <div className="bg-white/50 dark:bg-slate-900/50 p-5 rounded-3xl border border-white dark:border-slate-700/50 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-xl">
              <TrendingUp size={18} />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              المحصل فعلياً
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">
            {financialStats.totalCollected.toLocaleString()}{' '}
            <span className="text-xs font-medium">د.أ</span>
          </div>
          <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1">
            نسبة التحصيل: {financialStats.collectionRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white/50 dark:bg-slate-900/50 p-5 rounded-3xl border border-white dark:border-slate-700/50 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 rounded-xl">
              <AlertCircle size={18} />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              إجمالي المتأخرات
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">
            {financialStats.totalOverdue.toLocaleString()}{' '}
            <span className="text-xs font-medium">د.أ</span>
          </div>
          <div className="mt-2 text-xs font-bold text-rose-600">
            {financialStats.overdueCount} دفعة متأخرة حالياً
          </div>
        </div>

        <div className="bg-white/50 dark:bg-slate-900/50 p-5 rounded-3xl border border-white dark:border-slate-700/50 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-xl">
              <BarChart3 size={18} />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              المتوقع تحصيله
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">
            {financialStats.totalExpected.toLocaleString()}{' '}
            <span className="text-xs font-medium">د.أ</span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            إجمالي قيمة الكمبيالات الصادرة
          </div>
        </div>

        <div className="bg-white/50 dark:bg-slate-900/50 p-5 rounded-3xl border border-white dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 flex flex-col justify-center">
          <Button
            variant="primary"
            className="w-full rounded-2xl gap-2 py-4 shadow-xl shadow-indigo-500/20"
            onClick={() => setShowCharts(!showCharts)}
          >
            <BarChart3 size={20} />
            عرض التحليلات البيانية
          </Button>
        </div>
      </div>
    )}
    </>
  );
}
