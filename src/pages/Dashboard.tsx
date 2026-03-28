/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * لوحة التحكم الاحترافية - Dashboard Professional Edition
 * Multi-layer, Real-time Dashboard with Advanced Analytics
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import type { الكمبيالات_tbl } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { NAV_ITEMS } from '@/constants';
import { ROUTE_PATHS } from '@/routes/paths';
import { isRole } from '@/utils/roles';

// Components
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
import { useSmartModal } from '@/context/ModalContext';
// Hooks
import { useDashboardData } from '@/hooks/useDashboardData';

type LayerTab = 'overview' | 'sales' | 'calendar' | 'monitoring' | 'performance';

interface LayerConfig {
  id: LayerTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

/** محاذاة موحّدة مع بقية الصفحات — مرنة على كل العرض */
const DASHBOARD_PAGE_WRAP = 'max-w-[1600px] mx-auto w-full px-4 sm:px-6';

const toRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const layerConfigs: LayerConfig[] = [
  {
    id: 'overview',
    label: 'نظرة عامة',
    icon: <BarChart3 size={20} />,
    description: 'التحليلات والملخصات المالية',
  },
  {
    id: 'sales',
    label: 'تتبع المبيعات',
    icon: <TrendingUp size={20} />,
    description: 'خط أنابيب المبيعات والأداء',
  },
  {
    id: 'calendar',
    label: 'التقويم والمهام',
    icon: <Calendar size={20} />,
    description: 'الأحداث والمهام والمتابعة',
  },
  {
    id: 'monitoring',
    label: 'نظام المراقبة',
    icon: <AlertCircle size={20} />,
    description: 'التنبيهات والمشاكل المعلقة',
  },
  {
    id: 'performance',
    label: 'الأداء المالي',
    icon: <DollarSign size={20} />,
    description: 'التقارير المالية والإيرادات',
  },
];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { openPanel: _openPanel } = useSmartModal();
  const toast = useToast();
  const [activeLayer, setActiveLayer] = useState<LayerTab>('overview');
  const [autoRefresh, _setAutoRefresh] = useState(true);
  const [, setTasksTick] = useState(0);
  const [syncBusy, setSyncBusy] = useState(false);
  const [pagesSearch, setPagesSearch] = useState('');

  // Get dashboard data
  const {
    data: dashboardData,
    isRefreshing,
    kpiLoading,
    refresh,
  } = useDashboardData({
    autoRefresh,
    refreshIntervalMs: 30_000,
  });

  // Live update when tasks/reminders change
  useEffect(() => {
    const handler = () => setTasksTick((t) => t + 1);
    window.addEventListener('azrar:tasks-changed', handler);
    return () => window.removeEventListener('azrar:tasks-changed', handler);
  }, []);

  // Persist active layer
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dashboard_active_layer');
      const valid = (layerConfigs.map((l) => l.id) as string[]).includes(String(stored));
      if (stored && valid) setActiveLayer(stored as LayerTab);
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('dashboard_active_layer', activeLayer);
    } catch {
      // ignore
    }
  }, [activeLayer]);

  const todayYMD = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const userRecord = useMemo(() => toRecord(user), [user]);
  const currentUsername = useMemo(
    () => String(userRecord['اسم_المستخدم'] ?? userRecord['name'] ?? '').trim(),
    [userRecord]
  );

  const _employeeCommissionsThisMonth = useMemo(() => {
    // Preserve original behavior: re-evaluate on dashboard refresh.
    void dashboardData.meta.updatedAt;
    try {
      const username = currentUsername;
      const reportApi = DbService as unknown as { runReport?: (name: string) => unknown };
      const report = reportApi.runReport?.('employee_commissions');
      const reportRec = toRecord(report);
      const data = reportRec['data'];
      const rows = Array.isArray(data) ? (data as unknown[]) : [];

      const monthRowsAll = rows.filter(
        (r) => String(toRecord(r)['date'] ?? '').slice(0, 7) === currentMonth
      );
      const monthRows = username
        ? monthRowsAll.filter(
            (r) => String(toRecord(r)['employeeUsername'] ?? '').trim() === username
          )
        : monthRowsAll;

      const totalOffice = monthRows.reduce<number>(
        (sum, r) => sum + toNumber(toRecord(r)['officeCommission']),
        0
      );
      const totalIntro = monthRows.reduce<number>(
        (sum, r) => sum + toNumber(toRecord(r)['intro']),
        0
      );
      const totalEmployee = monthRows.reduce<number>(
        (sum, r) => sum + toNumber(toRecord(r)['employeeTotal']),
        0
      );

      return {
        count: monthRows.length,
        totalOffice,
        totalIntro,
        totalEmployee,
      };
    } catch {
      return {
        count: 0,
        totalOffice: 0,
        totalIntro: 0,
        totalEmployee: 0,
      };
    }
    // Recompute when dashboard data changes (sync/refresh)
  }, [currentMonth, dashboardData.meta.updatedAt, currentUsername]);

  const todayFollowUps = DbService.getFollowUps().filter(
    (t) => String(toRecord(t)['dueDate'] ?? '') === todayYMD
  );
  const todayReminders = DbService.getReminders().filter(
    (r) =>
      String(toRecord(r)['date'] ?? '') === todayYMD && String(toRecord(r)['type'] ?? '') === 'Task'
  );
  const todayTaskTitles = [
    ...todayFollowUps.map((t) => String(toRecord(t)['task'] ?? '').trim()).filter(Boolean),
    ...todayReminders.map((r) => String(toRecord(r)['title'] ?? '').trim()).filter(Boolean),
  ];
  const _todayTasksCount = todayTaskTitles.length;

  const handleManualRefresh = () => {
    refresh();
  };

  const lastUpdatedAt = useMemo(
    () => new Date(dashboardData.meta.updatedAt || Date.now()),
    [dashboardData.meta.updatedAt]
  );

  const _handleSqlSyncNow = async () => {
    if (!window.desktopDb?.sqlSyncNow) {
      toast.error('المزامنة متاحة فقط في نسخة Desktop');
      return;
    }
    if (syncBusy) return;
    setSyncBusy(true);
    try {
      const res = (await window.desktopDb.sqlSyncNow()) as unknown as {
        ok?: boolean;
        message?: string;
      } | null;
      if (res?.ok) toast.success(res?.message || 'تمت المزامنة');
      else toast.error(res?.message || 'فشل المزامنة');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'فشل المزامنة';
      toast.error(msg);
    } finally {
      setSyncBusy(false);
    }
  };

  const _employeeOps = useMemo(() => {
    const logs = Array.isArray(dashboardData.logsRaw) ? dashboardData.logsRaw : [];
    const username = currentUsername;
    const userId = String(userRecord['id'] ?? '').trim();

    const matchesUser = (l: unknown) => {
      const rec = toRecord(l);
      const byName = username && String(rec['اسم_المستخدم'] ?? '').trim() === username;
      const byId =
        userId &&
        String(rec['userId'] ?? rec['user_id'] ?? rec['رقم_المستخدم'] ?? '').trim() === userId;
      return byName || byId;
    };

    const userLogs = logs.filter(matchesUser).slice().reverse();
    return {
      total: userLogs.length,
      recent: userLogs.slice(0, 8),
    };
  }, [dashboardData.logsRaw, currentUsername, userRecord]);

  const pagesLinks = useMemo(() => {
    type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
    type LinkItem = { label: string; path: string; icon?: IconComponent; group?: string };

    const out: LinkItem[] = [];
    const add = (label: string, path: string, icon?: IconComponent, group?: string) => {
      if (!path || !path.startsWith('/')) return;
      if (out.some((x) => x.path === path && x.label === label)) return;
      out.push({ label, path, icon, group });
    };

    const visit = (item: unknown, group?: string) => {
      const itemRec = toRecord(item);
      const childrenRaw = itemRec['children'];
      const children = Array.isArray(childrenRaw) ? (childrenRaw as unknown[]) : [];

      if (children.length) {
        const visible = children.filter((child) => {
          const childRec = toRecord(child);
          const requiredRole = childRec['role'];
          if (requiredRole && !isRole(userRecord['الدور'], requiredRole)) return false;
          return true;
        });
        visible.forEach((child) => visit(child, String(itemRec['label'] ?? '')));
        return;
      }
      add(
        String(itemRec['label'] ?? '').trim(),
        String(itemRec['path'] ?? ''),
        itemRec['icon'] as IconComponent | undefined,
        group
      );
    };

    NAV_ITEMS.forEach((n) => visit(n));

    // Utility pages not always present in sidebar
    add('اتصالات', ROUTE_PATHS.CONTACTS, undefined, 'أدوات');
    add('إرسال واتساب جماعي', ROUTE_PATHS.BULK_WHATSAPP, undefined, 'أدوات');
    add('مستندات', ROUTE_PATHS.DOCUMENTS, undefined, 'أدوات');

    const q = pagesSearch.trim().toLowerCase();
    const filtered = q
      ? out.filter(
          (x) =>
            x.label.toLowerCase().includes(q) ||
            x.path.toLowerCase().includes(q) ||
            String(x.group || '')
              .toLowerCase()
              .includes(q)
        )
      : out;

    // Grouped display: primary first, then admin/tools
    const groupOrder = ['أدوات', 'المشرفين'];
    return filtered.sort((a, b) => {
      const ag = a.group ? groupOrder.indexOf(a.group) : -1;
      const bg = b.group ? groupOrder.indexOf(b.group) : -1;
      if (ag !== bg) return ag - bg;
      return a.label.localeCompare(b.label, 'ar');
    });
  }, [pagesSearch, userRecord]);

  const _runtimeRequirements = useMemo(() => {
    const isDesktop = !!window.desktopDb;
    const hasSqlSync = !!window.desktopDb?.sqlSyncNow;
    const hasBackup = !!window.desktopDb?.chooseBackupDir;
    const hasUpdater = !!(window as unknown as { desktopUpdater?: unknown })?.desktopUpdater;
    return { isDesktop, hasSqlSync, hasBackup, hasUpdater };
  }, []);

  return (
    <div className="pb-16 md:pb-20">
      <div className={`${DASHBOARD_PAGE_WRAP} space-y-8 md:space-y-10`}>
      {/* Dynamic Hero Header */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-slate-900 dark:bg-slate-900 p-6 sm:p-8 lg:p-12 shadow-2xl">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/20 to-transparent skew-x-12 transform translate-x-24" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />

        <div
          className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 text-right"
          dir="rtl"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md">
              <Activity size={14} className="text-indigo-400 animate-pulse" />
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">
                حالة النظام: متصل
              </span>
            </div>

            <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter leading-none">
              أهلاً بك،{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-indigo-100">
                {String(userRecord['اسم_للعرض'] || userRecord['name'] || 'مستخدم')}
              </span>
            </h1>
            <p className="text-slate-400 font-bold max-w-xl text-lg leading-relaxed">
              إليك نظرة سريعة على أداء نظام <span className="text-white">AZRAR</span> لهذا اليوم.
              كافة البيانات محدثة ولحظية.
            </p>

            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={handleManualRefresh}
                className="group flex items-center gap-3 bg-white text-slate-900 px-6 py-3 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/10"
              >
                <RefreshCw
                  size={20}
                  className={`group-hover:rotate-180 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                تحديث البيانات
              </button>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase">آخر تحديث</span>
                <span className="text-xs font-black text-slate-300">
                  {formatTimeHM(lastUpdatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Section — نفس هوامش الصفحة دون px إضافي */}
      <section>
        {kpiLoading ? (
          <SkeletonCardGrid variant="kpi" count={6} />
        ) : (
          <KPICards data={dashboardData} />
        )}
      </section>

      {/* Content Layers: تبويبات + اختصارات داخل إطار واحد */}
      <div className="space-y-6">
        <div className="app-card p-4 sm:p-5 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-700/80 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-0" dir="rtl">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0 lg:flex-1 lg:min-w-0 lg:pl-3">
              {layerConfigs.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`
                   flex items-center gap-3 px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl font-black whitespace-nowrap transition-all duration-300
                   ${
                     activeLayer === layer.id
                       ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 scale-[1.02]'
                       : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                   }
                 `}
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

        {/* Animated Layer Content */}
        <div className="page-transition min-h-[min(500px,70vh)] md:min-h-[520px]">
          {activeLayer === 'overview' && <OverviewLayer data={dashboardData} />}
          {activeLayer === 'sales' && <SalesTrackingLayer data={dashboardData} />}
          {activeLayer === 'calendar' && <CalendarTasksLayer data={dashboardData} />}
          {activeLayer === 'monitoring' && <MonitoringLayer data={dashboardData} />}
          {activeLayer === 'performance' && (
            <div className="app-card p-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">الأداء المالي</h2>
              {(() => {
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

                const perf = dashboardData.performance;
                const isPerfReady =
                  !!perf && perf.monthKey === monthKey && perf.prevMonthKey === prevMonthKey;

                let currentMonthCollections = 0;
                let previousMonthCollections = 0;
                let paidCountThisMonth = 0;
                let dueUnpaidThisMonth = 0;

                if (isPerfReady) {
                  currentMonthCollections = Number(perf?.currentMonthCollections || 0) || 0;
                  previousMonthCollections = Number(perf?.previousMonthCollections || 0) || 0;
                  paidCountThisMonth = Number(perf?.paidCountThisMonth || 0) || 0;
                  dueUnpaidThisMonth = Number(perf?.dueUnpaidThisMonth || 0) || 0;
                } else {
                  const dashRec = toRecord(dashboardData);
                  const wnd = window as unknown as {
                    desktopDb?: { domainDashboardPerformance?: unknown };
                  };
                  const isDesktopFast =
                    !!dashRec['desktopAggregations'] ||
                    !!dashRec['desktopHighlights'] ||
                    !!wnd.desktopDb?.domainDashboardPerformance;
                  if (!isDesktopFast) {
                    const installments = DbService.getInstallments();
                    const isPaid = (i: الكمبيالات_tbl) => String(i?.حالة_الكمبيالة) === 'مدفوع';
                    const getMonth = (d?: string) => String(d || '').slice(0, 7);
                    const paidMonthSum = (m: string) =>
                      installments
                        .filter((i) => isPaid(i) && getMonth(i.تاريخ_الدفع || i.تاريخ_استحقاق) === m)
                        .reduce((s, i) => s + Number(i.القيمة || 0), 0);

                    currentMonthCollections = paidMonthSum(monthKey);
                    previousMonthCollections = paidMonthSum(prevMonthKey);
                    paidCountThisMonth = installments.filter(
                      (i) => isPaid(i) && getMonth(i.تاريخ_الدفع || i.تاريخ_استحقاق) === monthKey
                    ).length;
                    dueUnpaidThisMonth = installments
                      .filter((i) => !isPaid(i) && getMonth(i.تاريخ_استحقاق) === monthKey)
                      .reduce((s, i) => s + Number(i.القيمة_المتبقية ?? i.القيمة ?? 0), 0);
                  }
                }

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                          تحصيلات الشهر الحالي
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatCurrencyJOD(currentMonthCollections)}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/20 border border-gray-200 dark:border-slate-700">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                          تحصيلات الشهر السابق
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatCurrencyJOD(previousMonthCollections)}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                          إيرادات العمولات (الشهر الحالي)
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatCurrencyJOD(dashboardData.kpis.totalRevenue || 0)}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                          غير مدفوع مستحق هذا الشهر
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatCurrencyJOD(dueUnpaidThisMonth)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          مدفوع هذا الشهر: {formatNumber(paidCountThisMonth)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      جميع القيم بالدينار الأردني (JOD) والأرقام باللغة الإنجليزية.
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Secondary Widgets: ملخص يومي واسع + عمود جانبي مرن */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-7 xl:col-span-8 min-w-0 order-1">
          <DailySummaryWidget />
        </div>
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 min-w-0 order-2">
          <MarqueeWidget />
          <div className="glass-card p-6 sm:p-8">
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Search size={20} className="text-indigo-500" />
              الوصول السريع للروابط
            </h4>
            <div className="relative mb-6">
              <Search
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="ابحث عن صفحة..."
                value={pagesSearch}
                onChange={(e) => setPagesSearch(e.target.value)}
                className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all text-right"
                dir="rtl"
              />
            </div>
            <div
              className="grid grid-cols-2 gap-3 max-h-[min(320px,50vh)] overflow-y-auto no-scrollbar pr-1"
              dir="rtl"
            >
              {pagesLinks.slice(0, 10).map((link, idx) => (
                <a
                  key={idx}
                  href={`#${link.path}`}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-all text-[11px] font-black border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 md:mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>نظام AZRAR لإدارة العقارات © 2025 - جميع الحقوق محفوظة</p>
      </div>
      </div>
    </div>
  );
};
