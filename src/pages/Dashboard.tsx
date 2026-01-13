/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 * 
 * لوحة التحكم الاحترافية - Dashboard Professional Edition
 * Multi-layer, Real-time Dashboard with Advanced Analytics
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, TrendingUp, AlertCircle, Calendar, CheckSquare2, DollarSign, RefreshCw, Server, Activity, Search
} from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { NAV_ITEMS } from '@/constants';
import { ROUTE_PATHS } from '@/routes/paths';
import { isRole } from '@/utils/roles';

// Components
import { KPICards } from '@/components/dashboard/layers/KPICards';
import { OverviewLayer } from '@/components/dashboard/layers/OverviewLayer';
import { SalesTrackingLayer } from '@/components/dashboard/layers/SalesTrackingLayer';
import { CalendarTasksLayer } from '@/components/dashboard/layers/CalendarTasksLayer';
import { MonitoringLayer } from '@/components/dashboard/layers/MonitoringLayer';
import { formatCurrencyJOD, formatNumber, formatTimeHM } from '@/utils/format';
import { QuickActionsBar } from '@/components/dashboard/layers/QuickActionsBar';
import { DailySummaryWidget } from '@/components/dashboard/DailySummaryWidget';
import { PaymentCollectionSendLog } from '@/components/dashboard/PaymentCollectionSendLog';
import { MarqueeWidget } from '@/components/dashboard/MarqueeWidget';
import { useSmartModal } from '@/context/ModalContext';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';

// Hooks
import { useDashboardData } from '@/hooks/useDashboardData';

type LayerTab = 'overview' | 'sales' | 'calendar' | 'monitoring' | 'performance';

interface LayerConfig {
  id: LayerTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const layerConfigs: LayerConfig[] = [
  {
    id: 'overview',
    label: 'نظرة عامة',
    icon: <BarChart3 size={20} />,
    description: 'التحليلات والملخصات المالية'
  },
  {
    id: 'sales',
    label: 'تتبع المبيعات',
    icon: <TrendingUp size={20} />,
    description: 'خط أنابيب المبيعات والأداء'
  },
  {
    id: 'calendar',
    label: 'التقويم والمهام',
    icon: <Calendar size={20} />,
    description: 'الأحداث والمهام والمتابعة'
  },
  {
    id: 'monitoring',
    label: 'نظام المراقبة',
    icon: <AlertCircle size={20} />,
    description: 'التنبيهات والمشاكل المعلقة'
  },
  {
    id: 'performance',
    label: 'الأداء المالي',
    icon: <DollarSign size={20} />,
    description: 'التقارير المالية والإيرادات'
  }
];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { openPanel } = useSmartModal();
  const toast = useToast();
  const [activeLayer, setActiveLayer] = useState<LayerTab>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [, setTasksTick] = useState(0);
  const [syncBusy, setSyncBusy] = useState(false);
  const [pagesSearch, setPagesSearch] = useState('');
  
  // Get dashboard data
  const { data: dashboardData, isRefreshing, refresh } = useDashboardData({
    autoRefresh,
    refreshIntervalMs: 30_000,
  });

  // Live update when tasks/reminders change
  useEffect(() => {
    const handler = () => setTasksTick(t => t + 1);
    window.addEventListener('azrar:tasks-changed', handler);
    return () => window.removeEventListener('azrar:tasks-changed', handler);
  }, []);

  // Persist active layer
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dashboard_active_layer');
      const valid = (layerConfigs.map(l => l.id) as string[]).includes(String(stored));
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

  const employeeCommissionsThisMonth = useMemo(() => {
    try {
      const username = String((user as any)?.اسم_المستخدم || (user as any)?.name || '').trim();
      const report: any = (DbService as any).runReport?.('employee_commissions');
      const rows: any[] = Array.isArray(report?.data) ? report.data : [];

      const monthRowsAll = rows.filter((r: any) => String(r?.date || '').slice(0, 7) === currentMonth);
      const monthRows = username
        ? monthRowsAll.filter((r: any) => String(r?.employeeUsername || '').trim() === username)
        : monthRowsAll;

      const totalOffice = monthRows.reduce((sum: number, r: any) => sum + (Number(r?.officeCommission) || 0), 0);
      const totalIntro = monthRows.reduce((sum: number, r: any) => sum + (Number(r?.intro) || 0), 0);
      const totalEmployee = monthRows.reduce((sum: number, r: any) => sum + (Number(r?.employeeTotal) || 0), 0);

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
  }, [currentMonth, dashboardData.meta.updatedAt, user]);

  const todayFollowUps = DbService.getFollowUps().filter((t: any) => String(t?.dueDate) === todayYMD);
  const todayReminders = DbService.getReminders().filter((r: any) => String(r?.date) === todayYMD && String(r?.type) === 'Task');
  const todayTaskTitles = [
    ...todayFollowUps.map((t: any) => String(t?.task || '').trim()).filter(Boolean),
    ...todayReminders.map((r: any) => String(r?.title || '').trim()).filter(Boolean),
  ];
  const todayTasksCount = todayTaskTitles.length;

  const handleManualRefresh = () => {
    refresh();
  };

  const lastUpdatedAt = useMemo(() => new Date(dashboardData.meta.updatedAt || Date.now()), [dashboardData.meta.updatedAt]);

  const handleSqlSyncNow = async () => {
    if (!window.desktopDb?.sqlSyncNow) {
      toast.error('المزامنة متاحة فقط في نسخة Desktop');
      return;
    }
    if (syncBusy) return;
    setSyncBusy(true);
    try {
      const res = (await window.desktopDb.sqlSyncNow()) as unknown as { ok?: boolean; message?: string } | null;
      if (res?.ok) toast.success(res?.message || 'تمت المزامنة');
      else toast.error(res?.message || 'فشل المزامنة');
    } catch (e: any) {
      toast.error(e?.message || 'فشل المزامنة');
    } finally {
      setSyncBusy(false);
    }
  };

  const employeeOps = useMemo(() => {
    const logs = Array.isArray(dashboardData.logsRaw) ? dashboardData.logsRaw : [];
    const username = String((user as any)?.اسم_المستخدم || (user as any)?.name || '').trim();
    const userId = String((user as any)?.id || '').trim();

    const matchesUser = (l: any) => {
      const byName = username && String(l?.اسم_المستخدم || '').trim() === username;
      const byId = userId && String(l?.userId || l?.user_id || l?.رقم_المستخدم || '').trim() === userId;
      return byName || byId;
    };

    const userLogs = logs.filter(matchesUser).slice().reverse();
    return {
      total: userLogs.length,
      recent: userLogs.slice(0, 8),
    };
  }, [dashboardData.logsRaw, user]);

  const pagesLinks = useMemo(() => {
    type LinkItem = { label: string; path: string; icon?: any; group?: string };

    const out: LinkItem[] = [];
    const add = (label: string, path: string, icon?: any, group?: string) => {
      if (!path || !path.startsWith('/')) return;
      if (out.some(x => x.path === path && x.label === label)) return;
      out.push({ label, path, icon, group });
    };

    const visit = (item: any, group?: string) => {
      if (item?.children?.length) {
        const children = (item.children as any[]).filter((child: any) => {
          if (child?.role && !isRole((user as any)?.الدور, child.role)) return false;
          return true;
        });
        children.forEach((child: any) => visit(child, item.label));
        return;
      }
      add(String(item?.label || '').trim(), String(item?.path || ''), item?.icon, group);
    };

    NAV_ITEMS.forEach((n: any) => visit(n));

    // Utility pages not always present in sidebar
    add('اتصالات', ROUTE_PATHS.CONTACTS, undefined, 'أدوات');
    add('إرسال واتساب جماعي', ROUTE_PATHS.BULK_WHATSAPP, undefined, 'أدوات');
    add('مستندات', ROUTE_PATHS.DOCUMENTS, undefined, 'أدوات');

    const q = pagesSearch.trim().toLowerCase();
    const filtered = q
      ? out.filter((x) => x.label.toLowerCase().includes(q) || x.path.toLowerCase().includes(q) || String(x.group || '').toLowerCase().includes(q))
      : out;

    // Grouped display: primary first, then admin/tools
    const groupOrder = ['أدوات', 'المشرفين'];
    return filtered.sort((a, b) => {
      const ag = a.group ? groupOrder.indexOf(a.group) : -1;
      const bg = b.group ? groupOrder.indexOf(b.group) : -1;
      if (ag !== bg) return ag - bg;
      return a.label.localeCompare(b.label, 'ar');
    });
  }, [pagesSearch, user]);

  const runtimeRequirements = useMemo(() => {
    const isDesktop = !!window.desktopDb;
    const hasSqlSync = !!window.desktopDb?.sqlSyncNow;
    const hasBackup = !!window.desktopDb?.chooseBackupDir;
    const hasUpdater = !!(window as any)?.desktopUpdater;
    return { isDesktop, hasSqlSync, hasBackup, hasUpdater };
  }, []);

  return (
    <div className="pb-20 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className={DS.components.pageHeader}>
          <div>
            <h2 className={`${DS.components.pageTitle} flex items-center gap-2`}>
              <BarChart3 size={22} />
              لوحة القيادة الاحترافية
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              نظام مراقبة شامل متعدد الطبقات مع تحديثات فورية
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              آخر تحديث: {formatTimeHM(lastUpdatedAt, { locale: 'ar-EG', hour12: true })}{isRefreshing ? ' (جاري التحديث...)' : ''}
            </div>

            {window.desktopDb?.sqlSyncNow && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSqlSyncNow}
                isLoading={syncBusy}
                title="مزامنة الآن"
                rightIcon={<Server size={16} />}
              >
                مزامنة الآن
              </Button>
            )}

            <Button
              variant="secondary"
              size="icon"
              onClick={handleManualRefresh}
              title="تحديث يدوي"
              aria-label="تحديث يدوي"
              isLoading={isRefreshing}
            >
              <RefreshCw size={18} />
            </Button>

            <Button
              variant={autoRefresh ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'إيقاف التحديث التلقائي' : 'تفعيل التحديث التلقائي'}
            >
              {autoRefresh ? 'تحديث تلقائي' : 'موقوف'}
            </Button>
          </div>
        </div>

        {/* Urgent Alerts / Tasks / Reminders Marquee */}
        <MarqueeWidget />

        {/* KPI Cards - Always Visible */}
        <KPICards data={dashboardData} />

      </div>

      {/* Daily Summary Widget */}
      <div className="mb-6">
        <DailySummaryWidget />
      </div>

      {/* Today Tasks Banner */}
      <button
        type="button"
        onClick={() => openPanel('CALENDAR_EVENTS', todayYMD, { title: 'مهام اليوم' })}
        className="mb-6 w-full text-right bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition overflow-hidden"
        title="اضغط لفتح مهام اليوم"
      >
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 flex-shrink-0">
              <CheckSquare2 size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-800 dark:text-white">
                مهام اليوم ({formatNumber(todayTasksCount)})
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {todayTasksCount === 0 ? 'لا توجد مهام اليوم — اضغط لإضافة مهمة' : todayTaskTitles.slice(0, 3).join(' • ') + (todayTasksCount > 3 ? ` • +${todayTasksCount - 3}` : '')}
              </div>
            </div>
          </div>
          <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
            فتح
          </div>
        </div>
      </button>

      {/* Quick Actions Bar */}
      <QuickActionsBar />

      {/* Employee Operations + Runtime Requirements */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                <Activity size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">عمليات الموظف</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  آخر عملياتك المسجلة في النظام ({formatNumber(employeeOps.total)})
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a href={`#${ROUTE_PATHS.OPERATIONS}`}>
                <Button variant="secondary" size="sm" title="فتح سجل العمليات">
                  فتح السجل
                </Button>
              </a>
              <a
                href={`#${ROUTE_PATHS.COMMISSIONS}?tab=employee&month=${encodeURIComponent(currentMonth)}&user=${encodeURIComponent(String((user as any)?.اسم_المستخدم || ''))}`}
              >
                <Button variant="secondary" size="sm" title="فتح تقرير عمولات الموظفين">
                  العمولات
                </Button>
              </a>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => refresh()}
                title="تحديث البيانات"
                rightIcon={<RefreshCw size={16} />}
              >
                تحديث
              </Button>
            </div>
          </div>

          <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/40 dark:bg-slate-900/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-800 dark:text-white">
                عمولات الموظف لهذا الشهر ({currentMonth})
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                عدد العمليات: <b className="text-slate-800 dark:text-white">{formatNumber(employeeCommissionsThisMonth.count)}</b>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي عمولة الموظفين</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(employeeCommissionsThisMonth.totalEmployee)}</div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">عمولة المكتب (إجمالي العمليات)</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(employeeCommissionsThisMonth.totalOffice)}</div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إدخال عقار (5%)</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(employeeCommissionsThisMonth.totalIntro)}</div>
              </div>
            </div>
          </div>

          <div className="p-4">
            {employeeOps.recent.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">لا توجد عمليات مسجلة باسمك حتى الآن.</div>
            ) : (
              <div className="space-y-2">
                {employeeOps.recent.map((l: any) => (
                  <div
                    key={String(l?.id || `${l?.تاريخ_العملية || ''}-${l?.نوع_العملية || ''}-${l?.اسم_الجدول || ''}`)}
                    className="p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 dark:text-white truncate">
                          {String(l?.نوع_العملية || 'عملية')}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {String(l?.اسم_الجدول || '')}{l?.details ? ` • ${String(l.details)}` : ''}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {String(l?.تاريخ_العملية || '').slice(0, 16).replace('T', ' ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700">
            <div className="text-sm font-bold text-slate-900 dark:text-white">متطلبات التشغيل</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              ملخص سريع للميزات المتاحة حسب وضع التشغيل
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">وضع Desktop (Electron)</span>
              <span className={runtimeRequirements.isDesktop ? 'text-green-600 dark:text-green-400 font-bold' : 'text-orange-600 dark:text-orange-400 font-bold'}>
                {runtimeRequirements.isDesktop ? 'متاح' : 'غير متاح'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">مزامنة SQL Server</span>
              <span className={runtimeRequirements.hasSqlSync ? 'text-green-600 dark:text-green-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-bold'}>
                {runtimeRequirements.hasSqlSync ? 'مدعومة' : 'غير مدعومة'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">النسخ الاحتياطي (اختيار مجلد)</span>
              <span className={runtimeRequirements.hasBackup ? 'text-green-600 dark:text-green-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-bold'}>
                {runtimeRequirements.hasBackup ? 'مدعومة' : 'غير مدعومة'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">التحديثات (Updater)</span>
              <span className={runtimeRequirements.hasUpdater ? 'text-green-600 dark:text-green-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-bold'}>
                {runtimeRequirements.hasUpdater ? 'متاح' : 'غير متاح'}
              </span>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <a href={`#${ROUTE_PATHS.SETTINGS}`} className="flex-1">
                <Button variant="secondary" size="sm" className="w-full" title="فتح الإعدادات">
                  الإعدادات
                </Button>
              </a>
              <a href={`#${ROUTE_PATHS.SYS_MAINTENANCE}`} className="flex-1">
                <Button variant="secondary" size="sm" className="w-full" title="فتح صيانة النظام">
                  صيانة النظام
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* All Pages Links */}
      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">روابط جميع الصفحات</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">انتقل مباشرة لأي صفحة من مكان واحد</div>
          </div>
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={pagesSearch}
              onChange={(e) => setPagesSearch(e.target.value)}
              placeholder="بحث سريع عن صفحة..."
              className="w-full pr-9 pl-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="p-4">
          {pagesLinks.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">لا توجد نتائج.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {pagesLinks.map((p) => {
                const Icon = p.icon;
                return (
                  <a
                    key={`${p.path}-${p.label}`}
                    href={`#${p.path}`}
                    className="p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/20 hover:bg-white dark:hover:bg-slate-900/40 hover:shadow-sm transition flex items-center gap-2"
                    title={p.group ? `${p.label} • ${p.group}` : p.label}
                  >
                    {Icon ? <Icon size={16} className="text-indigo-600 dark:text-indigo-300" /> : <div className="w-4 h-4 rounded bg-indigo-100 dark:bg-indigo-900/30" />}
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.label}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Layer Navigation Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
        {layerConfigs.map((layer) => (
          <Button
            key={layer.id}
            onClick={() => setActiveLayer(layer.id)}
            variant={activeLayer === layer.id ? 'primary' : 'secondary'}
            size="sm"
            className="flex-shrink-0 whitespace-nowrap"
            title={layer.description}
            rightIcon={layer.icon}
          >
            {layer.label}
          </Button>
        ))}
      </div>

      {/* Layer Content */}
      <div className="transition-all duration-300">
        {activeLayer === 'overview' && <OverviewLayer data={dashboardData} />}
        {activeLayer === 'sales' && <SalesTrackingLayer data={dashboardData} />}
        {activeLayer === 'calendar' && <CalendarTasksLayer data={dashboardData} />}
        {activeLayer === 'monitoring' && <MonitoringLayer data={dashboardData} />}
        {activeLayer === 'performance' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">الأداء المالي</h2>
            {(() => {
              const now = new Date();
              const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

              const perf = dashboardData.performance;
              const isPerfReady = !!perf && perf.monthKey === monthKey && perf.prevMonthKey === prevMonthKey;

              let currentMonthCollections = 0;
              let previousMonthCollections = 0;
              let paidCountThisMonth = 0;
              let dueUnpaidThisMonth = 0;

              if (isPerfReady) {
                currentMonthCollections = Number(perf!.currentMonthCollections || 0) || 0;
                previousMonthCollections = Number(perf!.previousMonthCollections || 0) || 0;
                paidCountThisMonth = Number(perf!.paidCountThisMonth || 0) || 0;
                dueUnpaidThisMonth = Number(perf!.dueUnpaidThisMonth || 0) || 0;
              } else {
                const isDesktopFast = !!(dashboardData as any)?.desktopAggregations || !!(dashboardData as any)?.desktopHighlights || !!(window as any)?.desktopDb?.domainDashboardPerformance;
                if (!isDesktopFast) {
                  // Web / legacy fallback
                  const installments = DbService.getInstallments();
                  const isPaid = (i: any) => String(i?.حالة_الكمبيالة) === 'مدفوع';
                  const getMonth = (d?: string) => String(d || '').slice(0, 7);
                  const paidMonthSum = (m: string) => installments
                    .filter((i: any) => isPaid(i) && (getMonth(i.تاريخ_الدفع || i.تاريخ_استحقاق) === m))
                    .reduce((s: number, i: any) => s + Number(i.القيمة || 0), 0);

                  currentMonthCollections = paidMonthSum(monthKey);
                  previousMonthCollections = paidMonthSum(prevMonthKey);
                  paidCountThisMonth = installments.filter((i: any) => isPaid(i) && (getMonth(i.تاريخ_الدفع || i.تاريخ_استحقاق) === monthKey)).length;
                  dueUnpaidThisMonth = installments.filter((i: any) => !isPaid(i) && (getMonth(i.تاريخ_استحقاق) === monthKey)).reduce((s: number, i: any) => s + Number(i.القيمة_المتبقية ?? i.القيمة ?? 0), 0);
                }
              }

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">تحصيلات الشهر الحالي</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(currentMonthCollections)}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/20 border border-gray-200 dark:border-slate-700">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">تحصيلات الشهر السابق</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(previousMonthCollections)}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">إيرادات العمولات (الشهر الحالي)</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(dashboardData.kpis.totalRevenue || 0)}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">غير مدفوع مستحق هذا الشهر</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(dueUnpaidThisMonth)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">مدفوع هذا الشهر: {formatNumber(paidCountThisMonth)}</div>
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

      {/* Footer Info */}
      <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>نظام AZRAR لإدارة العقارات © 2025 - جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
};

