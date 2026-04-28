import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import { AlertCircle, BarChart3, TrendingUp, Filter, CheckCircle2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatsCardRow } from '@/components/shared/StatsCardRow';
import { DS } from '@/constants/designSystem';

type Props = { page: InstallmentsPageModel };

export function InstallmentsQuickStats({ page }: Props) {
  const { financialStats, showCharts, setShowCharts, filter, setFilter } = page;

  if (!financialStats) return null;

  const filterTabs = [
    { id: 'all', label: 'الكل', icon: Filter },
    { id: 'debt', label: 'المتأخرة', icon: AlertCircle },
    { id: 'due', label: 'المستحقة', icon: CalendarClock },
    { id: 'paid', label: 'المدفوعة', icon: CheckCircle2 },
  ] as const;

  return (
    <div className="space-y-4 mb-6">
      <StatsCardRow>
        <div className={DS.components.card + ' p-6 transition-all duration-300 hover:shadow-2xl border-b-4 border-emerald-500'}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <TrendingUp size={20} />
            </div>
            <div className="px-3 py-1 rounded-full bg-emerald-500/5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
              {financialStats.collectionRate.toFixed(1)}% محصل
            </div>
          </div>
          <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">المحصل فعلياً</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
            {financialStats.totalCollected.toLocaleString()} <span className="text-sm font-medium text-slate-400">د.أ</span>
          </div>
        </div>

        <div className={DS.components.card + ' p-6 transition-all duration-300 hover:shadow-2xl border-b-4 border-rose-500'}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl">
              <AlertCircle size={20} />
            </div>
            <div className="px-3 py-1 rounded-full bg-rose-500/5 text-[10px] font-black text-rose-600 dark:text-rose-400">
              {financialStats.overdueCount} دفعة
            </div>
          </div>
          <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">إجمالي المتأخرات</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
            {financialStats.totalOverdue.toLocaleString()} <span className="text-sm font-medium text-slate-400">د.أ</span>
          </div>
        </div>

        <div className={DS.components.card + ' p-6 transition-all duration-300 hover:shadow-2xl border-b-4 border-indigo-500'}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <BarChart3 size={20} />
            </div>
          </div>
          <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">المتوقع تحصيله</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
            {financialStats.totalExpected.toLocaleString()} <span className="text-sm font-medium text-slate-400">د.أ</span>
          </div>
        </div>

        <div className={DS.components.card + ' p-6 flex items-center justify-center'}>
          <Button
            variant={showCharts ? 'secondary' : 'primary'}
            className="w-full rounded-2xl h-14 gap-3 text-base shadow-lg transition-all active:scale-95"
            onClick={() => setShowCharts(!showCharts)}
          >
            <BarChart3 size={22} />
            {showCharts ? 'إخفاء التحليلات' : 'عرض التحليلات'}
          </Button>
        </div>
      </StatsCardRow>

      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit border border-slate-200/50 dark:border-slate-700/50">
        {filterTabs.map((tab) => {
          const isActive = filter === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/30'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
