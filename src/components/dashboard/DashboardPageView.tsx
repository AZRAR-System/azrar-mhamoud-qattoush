import { type FC } from 'react';
import logoLight from '@/assets/logo/icon1.png';
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  Calendar,
  DollarSign,
  RefreshCw,
  Activity,
  Search,
} from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { KPICards } from '@/components/dashboard/layers/KPICards';
import { SkeletonCardGrid } from '@/components/shared/SkeletonCard';
import { OverviewLayer } from '@/components/dashboard/layers/OverviewLayer';
import { SalesTrackingLayer } from '@/components/dashboard/layers/SalesTrackingLayer';
import { CalendarTasksLayer } from '@/components/dashboard/layers/CalendarTasksLayer';
import { MonitoringLayer } from '@/components/dashboard/layers/MonitoringLayer';
import { formatCurrencyJOD, formatNumber, formatTimeHM } from '@/utils/format';
import { QuickActionsBar } from '@/components/dashboard/layers/QuickActionsBar';
import { DailySummaryWidget } from '@/components/dashboard/DailySummaryWidget';
import { MarqueeWidget } from '@/components/dashboard/MarqueeWidget';
import type { UseDashboardReturn, LayerConfig } from '@/hooks/useDashboard';
import { getPaymentMonth } from '@/hooks/useDashboard';
import type { الكمبيالات_tbl } from '@/types';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { PageLayout } from '@/components/shared/PageLayout';
import { DS } from '@/constants/designSystem';

const layerConfigs: LayerConfig[] = [
  { id: 'overview', label: 'نظرة عامة', icon: <BarChart3 size={20} />, description: 'التحليلات والملخصات المالية' },
  { id: 'sales', label: 'تتبع المبيعات', icon: <TrendingUp size={20} />, description: 'خط أنابيب المبيعات والأداء' },
  { id: 'calendar', label: 'التقويم والمهام', icon: <Calendar size={20} />, description: 'الأحداث والمهام والمتابعة' },
  { id: 'monitoring', label: 'نظام المراقبة', icon: <AlertCircle size={20} />, description: 'التنبيهات والمشاكل المعلقة' },
  { id: 'performance', label: 'الأداء المالي', icon: <DollarSign size={20} />, description: 'التقارير المالية والإيرادات' },
];

export const DashboardPageView: FC<{ page: UseDashboardReturn }> = ({ page }) => {
  const {
    userRecord, dashboardData, isRefreshing, kpiLoading, isDesktopFast, lastUpdatedAt,
    activeLayer, setActiveLayer, handleManualRefresh,
    pagesSearch, setPagesSearch, pagesLinks,
  } = page;

  return (
    <div className="pb-16 md:pb-20">
      <div className="-mx-4 lg:-mx-8 mb-6 md:mb-8 w-[calc(100%+2rem)] lg:w-[calc(100%+4rem)] max-w-none shrink-0">
        <MarqueeWidget edgeToEdge />
      </div>

      <PageLayout className="max-w-[1600px] mx-auto">
        <SmartPageHero
          variant="premium"
          title={`أهلاً بك، ${String(userRecord['اسم_للعرض'] || userRecord['name'] || 'مستخدم')}`}
          description={`إليك نظرة سريعة على أداء نظام AZRAR لهذا اليوم.`}
          topContent={
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md animate-fade-in animate-delay-300 border ${kpiLoading ? 'bg-amber-500/20 border-amber-300/30' : isRefreshing ? 'bg-blue-500/20 border-blue-300/30' : 'bg-white/10 border-white/20'}`}>
              <Activity size={14} className={`${kpiLoading ? 'text-amber-300 animate-pulse' : isRefreshing ? 'text-blue-300 animate-spin' : 'text-indigo-200 animate-pulse'}`} />
              <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                {kpiLoading ? 'حالة النظام: تحميل...' : isRefreshing ? 'حالة النظام: تحديث...' : 'حالة النظام: متصل'}
              </span>
            </div>
          }
          actions={
            <div
              className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 text-right w-full"
              dir="rtl"
            >
              <div className="flex items-center gap-4 animate-fade-in animate-delay-900">
                <button
                  onClick={handleManualRefresh}
                  className={DS.colors.heroPrimary}
                >
                  <div className="flex items-center gap-3 px-6 py-3">
                    <RefreshCw
                      size={20}
                      className={`group-hover:rotate-180 transition-transform duration-500 ${
                        isRefreshing ? 'animate-spin' : ''
                      }`}
                    />
                    تحديث البيانات
                  </div>
                </button>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-bold text-white/50 uppercase">
                    آخر تحديث
                  </span>
                  <span className="text-xs font-black text-white">
                    {formatTimeHM(lastUpdatedAt)}
                  </span>
                </div>
              </div>

              <div className="hidden lg:flex flex-col items-center justify-center animate-scale-in animate-delay-800 animate-duration-1000">
                <div className="relative">
                  <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-2xl animate-pulse" />
                  <img
                    src={logoLight}
                    alt="AZRAR System Logo"
                    className="relative w-36 h-36 object-contain drop-shadow-2xl animate-float"
                    loading="eager"
                  />
                </div>
                <div className="mt-4 text-center">
                  <div className="text-lg font-black text-white tracking-wide">
                    نظام أزرار
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    النسخة الاحترافية
                  </div>
                </div>
              </div>
            </div>
          }
        />

        {/* Main KPI Section */}
        <section>
          {kpiLoading ? <SkeletonCardGrid variant="kpi" count={6} /> : <KPICards data={dashboardData} />}
        </section>

        {/* Content Layers */}
        <div className="space-y-6">
          <div className={`${DS.components.filterBar} !p-5`}>
            <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-0 w-full" dir="rtl">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0 lg:flex-1 lg:min-w-0 lg:pl-3">
                {layerConfigs.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => setActiveLayer(layer.id)}
                    className={`flex items-center gap-3 px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl font-black whitespace-nowrap transition-all duration-300 ${activeLayer === layer.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 scale-[1.02]' : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    {layer.icon}
                    {layer.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-200/80 dark:border-slate-700/80 pt-4 lg:border-t-0 lg:border-s lg:pt-0 lg:pr-4 lg:min-w-0 lg:max-w-[min(100%,420px)] xl:max-w-[min(100%,520px)]">
                <QuickActionsBar variant="inline" />
              </div>
            </div>
          </div>

          <div className="page-transition min-h-[min(500px,70vh)] md:min-h-[520px]">
            {activeLayer === 'overview' && <OverviewLayer data={dashboardData} />}
            {activeLayer === 'sales' && <SalesTrackingLayer data={dashboardData} />}
            {activeLayer === 'calendar' && <CalendarTasksLayer data={dashboardData} />}
            {activeLayer === 'monitoring' && <MonitoringLayer data={dashboardData} />}
            {activeLayer === 'performance' && (
              <div className={DS.components.card + ' p-6'} dir="rtl">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">الأداء المالي</h2>
                {(() => {
                  const now = new Date();
                  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
                  const perf = dashboardData.performance;
                  const isPerfReady = !!perf && perf.monthKey === monthKey && perf.prevMonthKey === prevMonthKey;

                  let curCol = 0, prevCol = 0, paidCount = 0, dueUnpaid = 0;
                  if (isPerfReady) {
                    curCol = Number(perf?.currentMonthCollections || 0);
                    prevCol = Number(perf?.previousMonthCollections || 0);
                    paidCount = Number(perf?.paidCountThisMonth || 0);
                    dueUnpaid = Number(perf?.dueUnpaidThisMonth || 0);
                  } else {
                    const inst = DbService.getInstallments();
                    const isPaid = (i: الكمبيالات_tbl) => String(i?.حالة_الكمبيالة) === 'مدفوع';
                    const paidSum = (m: string) => inst.filter(i => isPaid(i) && getPaymentMonth(i) === m).reduce((s, i) => s + Number(i.القيمة || 0), 0);
                    curCol = paidSum(monthKey);
                    prevCol = paidSum(prevMonthKey);
                    paidCount = inst.filter(i => isPaid(i) && getPaymentMonth(i) === monthKey).length;
                    dueUnpaid = inst.filter(i => !isPaid(i) && String(i.تاريخ_استحقاق || '').slice(0, 7) === monthKey).reduce((s, i) => s + Number(i.القيمة_المتبقية ?? i.القيمة ?? 0), 0);
                  }

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">تحصيلات الشهر الحالي</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(curCol)}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/20 border border-gray-200 dark:border-slate-700">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">تحصيلات الشهر السابق</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(prevCol)}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">إيرادات العمولات (الشهر الحالي)</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(dashboardData.kpis.totalRevenue || 0)}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">غير مدفوع مستحق هذا الشهر</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(dueUnpaid)}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">مدفوع هذا الشهر: {formatNumber(paidCount)}</div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">جميع القيم بالدينار الأردني (JOD) والأرقام باللغة الإنجليزية.</div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-7 xl:col-span-8 min-w-0 order-1">
            <DailySummaryWidget data={dashboardData} isDesktopFast={isDesktopFast} />
          </div>
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 min-w-0 order-2">
            <div className={`${DS.components.filterBar} flex-col !items-start p-6 sm:p-8`} dir="rtl">
              <h4 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Search size={20} className="text-indigo-500" /> الوصول السريع للروابط
              </h4>
              <div className="relative mb-6 w-full">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="ابحث عن صفحة..."
                  value={pagesSearch}
                  onChange={(e) => setPagesSearch(e.target.value)}
                  className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all text-right"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 max-h-[min(320px,50vh)] overflow-y-auto no-scrollbar pr-1 w-full">
                {pagesLinks.slice(0, 10).map((link, idx) => (
                  <a key={idx} href={`#${link.path}`} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-all text-[11px] font-black border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50">
                    {link.label}
                  </a>
                ))}
              {pagesLinks.length > 10 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2 font-bold">
                  +{pagesLinks.length - 10} صفحة أخرى — ابحث بالاسم للوصول إليها
                </p>
              )}
              </div>
            </div>
          </div>
        </div>
      </PageLayout>

      <div className="mt-8 md:mt-12 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        <p>نظام أزرار العقاري © 2026 - جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
};
