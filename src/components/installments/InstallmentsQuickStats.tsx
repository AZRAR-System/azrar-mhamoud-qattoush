import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import { AlertCircle, BarChart3, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatsCardRow } from '@/components/shared/StatsCardRow';
import { DS } from '@/constants/designSystem';

type Props = { page: InstallmentsPageModel };

export function InstallmentsQuickStats({ page }: Props) {
  const { isDesktopFast, financialStats, showCharts, setShowCharts } = page;

  return (
    <>
      {!isDesktopFast && financialStats && (
        <StatsCardRow>
          <div className={DS.components.card + ' p-6 transition-all duration-300 hover:shadow-2xl'}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <TrendingUp size={20} />
              </div>
              <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                المحصل فعلياً
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {financialStats.totalCollected.toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-400">د.أ</span>
            </div>
            <div className="mt-3 text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/5 w-fit">
              نسبة التحصيل: {financialStats.collectionRate.toFixed(1)}%
            </div>
          </div>

          <div className={DS.components.card + ' p-6 transition-all duration-300 hover:shadow-2xl'}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl">
                <AlertCircle size={20} />
              </div>
              <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                إجمالي المتأخرات
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {financialStats.totalOverdue.toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-400">د.أ</span>
            </div>
            <div className="mt-3 text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/5 w-fit">
              {financialStats.overdueCount} دفعة متأخرة حالياً
            </div>
          </div>

          <div className={DS.components.card + ' p-6 transition-all duration-300 hover:shadow-2xl'}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <BarChart3 size={20} />
              </div>
              <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                المتوقع تحصيله
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {financialStats.totalExpected.toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-400">د.أ</span>
            </div>
            <div className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400">
              إجمالي قيمة الكمبيالات الصادرة
            </div>
          </div>

          <div className={DS.components.card + ' p-6 transition-all duration-300 hover:shadow-2xl flex flex-col justify-center'}>
            <Button
              variant={showCharts ? 'secondary' : 'primary'}
              className="w-full rounded-2xl h-14 gap-3 text-base shadow-xl shadow-indigo-500/20"
              onClick={() => setShowCharts(!showCharts)}
            >
              <BarChart3 size={22} />
              {showCharts ? 'إخفاء التحليلات' : 'عرض التحليلات'}
            </Button>
          </div>
        </StatsCardRow>
      )}
    </>
  );
}
