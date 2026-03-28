/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Hook for gathering all dashboard data from various services
 */

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { DbService } from '@/services/mockDb';
import { isTenancyRelevant } from '@/utils/tenancy';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';
import type { PaymentNotificationTarget } from '@/services/mockDb';
import type {
  FollowUpTask,
  اتفاقيات_البيع_tbl,
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  العمولات_tbl,
  الكمبيالات_tbl,
  عروض_البيع_tbl,
  tbl_Alerts,
} from '@/types';
import type { SystemHealth } from '@/types/types';
import {
  dashboardHighlightsSmart,
  dashboardPerformanceSmart,
  dashboardSummarySmart,
} from '@/services/domainQueries';

export interface UseDashboardDataOptions {
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

export interface UseDashboardDataResult {
  data: DashboardData;
  isRefreshing: boolean;
  /** true حتى اكتمال أول تحميل للـ KPIs والبيانات */
  kpiLoading: boolean;
  refresh: () => void;
}

export interface DashboardData {
  meta: {
    updatedAt: number;
  };

  systemHealth: SystemHealth | null;
  logsRaw: unknown[];

  // KPIs
  kpis: {
    totalRevenue: number;
    previousMonthRevenue: number;
    currentYearRevenue: number;
    previousYearRevenue: number;
    activeContracts: number;
    occupancyRate: number;
    latePayments: number;
    dueTodayPayments: number;
    dueNext7Payments: number;
    dueTotalPayments: number;
    totalPeople: number;
    totalProperties: number;
    totalContracts: number;
    occupiedProperties: number;
    /** أقساط مستحقة اليوم (متبقٍ > 0) */
    dueTodayInstallmentsCount: number;
    /** عقود سارية تنتهي خلال 30 يوماً */
    expiringContracts30dCount: number;
    /** مجموع المتبقي للأقساط المتأخرة (غير مدفوعة بعد تاريخ الاستحقاق) */
    overdueCollectionAmount: number;
  };

  performance?: {
    monthKey: string;
    prevMonthKey: string;
    currentMonthCollections: number;
    previousMonthCollections: number;
    paidCountThisMonth: number;
    dueUnpaidThisMonth: number;
  };

  desktopAggregations?: {
    propertyTypeCounts: Array<{ name: string; value: number }>;
    contractStatusCounts: Array<{ name: string; value: number }>;
  };

  desktopHighlights?: {
    dueInstallmentsToday: Array<{
      contractId: string;
      tenantName: string;
      dueDate: string;
      remaining: number;
    }>;
    expiringContracts: Array<{
      contractId: string;
      propertyId: string;
      propertyCode: string;
      tenantId: string;
      tenantName: string;
      endDate: string;
    }>;
    incompleteProperties: Array<{
      propertyId: string;
      propertyCode: string;
      missingWater: boolean;
      missingElectric: boolean;
      missingArea: boolean;
    }>;
  };

  // Sales
  sales: {
    newOffers: number;
    inNegotiation: number;
    completed: number;
    totalValue: number;
  };

  // Tasks
  tasks: {
    today: number;
    overdue: number;
    upcoming: number;
  };

  // Alerts
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };

  // Raw data
  people: الأشخاص_tbl[];
  properties: العقارات_tbl[];
  contracts: العقود_tbl[];
  commissions: العمولات_tbl[];

  // Additional raw datasets (used by charts/layers)
  commissionsAll: العمولات_tbl[];
  installments: الكمبيالات_tbl[];
  salesListings: عروض_البيع_tbl[];
  salesAgreements: اتفاقيات_البيع_tbl[];
  followUps: FollowUpTask[];
  alertsRaw: tbl_Alerts[];

  /** توزيع أقساط للمخطط الدائري: مدفوع / متأخر / قادم */
  installmentStatusDonut: {
    paid: number;
    overdue: number;
    upcoming: number;
  };

  /** آخر عمليات للواجهة: مدفوعات أو عقود */
  recentOperations: Array<{
    id: string;
    kind: 'payment' | 'contract';
    title: string;
    detail: string;
    at: string;
  }>;
}

export const useDashboardData = (options?: UseDashboardDataOptions): UseDashboardDataResult => {
  const toast = useToast();
  const [data, setData] = useState<DashboardData>({
    meta: {
      updatedAt: Date.now(),
    },

    systemHealth: null,
    logsRaw: [],
    kpis: {
      totalRevenue: 0,
      previousMonthRevenue: 0,
      currentYearRevenue: 0,
      previousYearRevenue: 0,
      activeContracts: 0,
      occupancyRate: 0,
      latePayments: 0,
      dueTodayPayments: 0,
      dueNext7Payments: 0,
      dueTotalPayments: 0,
      totalPeople: 0,
      totalProperties: 0,
      totalContracts: 0,
      occupiedProperties: 0,
      dueTodayInstallmentsCount: 0,
      expiringContracts30dCount: 0,
      overdueCollectionAmount: 0,
    },
    sales: {
      newOffers: 0,
      inNegotiation: 0,
      completed: 0,
      totalValue: 0,
    },
    tasks: {
      today: 0,
      overdue: 0,
      upcoming: 0,
    },
    alerts: {
      critical: 0,
      warning: 0,
      info: 0,
    },
    people: [],
    properties: [],
    contracts: [],
    commissions: [],

    commissionsAll: [],
    installments: [],
    salesListings: [],
    salesAgreements: [],
    followUps: [],
    alertsRaw: [],
    installmentStatusDonut: { paid: 0, overdue: 0, upcoming: 0 },
    recentOperations: [],
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const refreshData = useCallback(() => {
    void (async () => {
      try {
        setIsRefreshing(true);

        const toRecord = (v: unknown): Record<string, unknown> =>
          typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM (local)
        const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;

        const currentYear = String(now.getFullYear());
        const previousYear = String(now.getFullYear() - 1);

        const toYMD = (d: Date) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };

        const today = new Date();
        const todayYMD = toYMD(today);
        const weekFromNow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
        const weekYMD = toYMD(weekFromNow);

        const desktopSummary = await dashboardSummarySmart({ todayYMD, weekYMD });
        const isDesktopFast = !!desktopSummary;

        // Raw datasets (keep heavy ones empty in Desktop fast mode)
        const people: الأشخاص_tbl[] = isDesktopFast ? [] : DbService.getPeople();
        const properties: العقارات_tbl[] = isDesktopFast ? [] : DbService.getProperties();
        const contracts: العقود_tbl[] = isDesktopFast ? [] : DbService.getContracts();
        const installments: الكمبيالات_tbl[] = isDesktopFast ? [] : DbService.getInstallments();

        // Smaller datasets / services (still used by charts/panels)
        const commissionsAll: العمولات_tbl[] = DbService.getCommissions();
        const salesListings: عروض_البيع_tbl[] = DbService.getSalesListings();
        const followUps: FollowUpTask[] = DbService.getFollowUps();
        const alerts: tbl_Alerts[] = DbService.getAlerts();

        const dbExt = DbService as unknown as Partial<{
          getSalesAgreements: () => اتفاقيات_البيع_tbl[];
          checkSystemHealth: () => SystemHealth | null;
          getLogs: () => unknown[];
        }>;

        const salesAgreements: اتفاقيات_البيع_tbl[] = dbExt.getSalesAgreements?.() ?? [];
        const systemHealth: SystemHealth | null = dbExt.checkSystemHealth?.() ?? null;
        const logsRaw: unknown[] = dbExt.getLogs?.() ?? [];

        const getMonthKey = (comm: unknown) => {
          // Prefer explicit paid month if present (YYYY-MM)
          const rec = toRecord(comm);
          const paidMonth = String(rec['شهر_دفع_العمولة'] ?? '');
          if (/^\d{4}-\d{2}$/.test(paidMonth)) return paidMonth;
          const rawDate = String(rec['تاريخ_الإنشاء'] ?? rec['تاريخ_العقد'] ?? '');
          return rawDate.slice(0, 7);
        };
        const getYearKey = (comm: unknown) => {
          const rec = toRecord(comm);
          const paidMonth = String(rec['شهر_دفع_العمولة'] ?? '');
          if (/^\d{4}-\d{2}$/.test(paidMonth)) return paidMonth.slice(0, 4);
          const rawDate = String(rec['تاريخ_الإنشاء'] ?? rec['تاريخ_العقد'] ?? '');
          return rawDate.slice(0, 4);
        };

        // ✅ Dashboard cards show current month only (commissions/revenue)
        const commissions = commissionsAll.filter((c) => getMonthKey(c) === currentMonth);

        // ✅ Comparisons: current vs previous month, current vs previous year
        const previousMonthRevenue = commissionsAll
          .filter((c) => getMonthKey(c) === previousMonth)
          .reduce((sum, c) => sum + (c.المجموع || 0), 0);

        const currentYearRevenue = commissionsAll
          .filter((c) => getYearKey(c) === currentYear)
          .reduce((sum, c) => sum + (c.المجموع || 0), 0);

        const previousYearRevenue = commissionsAll
          .filter((c) => getYearKey(c) === previousYear)
          .reduce((sum, c) => sum + (c.المجموع || 0), 0);

        // ✅ Calculate KPIs from real data (current month for revenue)
        const totalRevenue = commissions.reduce((sum, c) => sum + (c.المجموع || 0), 0);

        const activeContracts = isDesktopFast
          ? Number(desktopSummary?.activeContracts || 0) || 0
          : contracts.filter((c) => isTenancyRelevant(c)).length;

        const totalProperties = isDesktopFast
          ? Number(desktopSummary?.totalProperties || 0) || 0
          : properties.length;

        const occupiedProperties = isDesktopFast
          ? Number(desktopSummary?.occupiedProperties || 0) || 0
          : properties.filter((p) => p.IsRented === true).length;

        const occupancyRate =
          totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0;

        // ✅ Payment notifications policy: pre-due reminders only
        // Align KPI counts with PaymentNotificationsPanel (no due-today / overdue reminders).
        const dueNext7Payments = isDesktopFast
          ? Number(desktopSummary?.dueNext7Payments || 0) || 0
          : (() => {
              const targets: PaymentNotificationTarget[] =
                DbService.getPaymentNotificationTargets(7);
              return targets.reduce<number>((sum, t) => sum + (t.items?.length || 0), 0);
            })();
        const latePayments = 0;
        const dueTodayPayments = 0;
        const dueTotalPayments = dueNext7Payments;

        // ✅ Sales calculation from real data
        const activeSalesListings = salesListings.filter((s) => s.الحالة === 'Active');
        const newOffers = activeSalesListings.length;
        const pendingSales = salesListings.filter((s) => s.الحالة === 'Pending').length;
        const completedSales = salesListings.filter((s) => s.الحالة === 'Sold').length;
        const totalSalesValue = salesListings
          .filter((s) => s.الحالة === 'Sold')
          .reduce((sum, s) => sum + (s.السعر_المطلوب || 0), 0);

        // ✅ Tasks from follow-ups (DbService model: dueDate/status)

        const pendingFollowUps = (followUps || []).filter((f) => String(f?.status) !== 'Done');
        const todayTasks = pendingFollowUps.filter((f) => String(f?.dueDate) === todayYMD).length;
        const overdueTasks = pendingFollowUps.filter((f) => String(f?.dueDate) < todayYMD).length;
        const upcomingTasks = pendingFollowUps.filter((f) => {
          const due = String(f?.dueDate);
          return due > todayYMD && due <= weekYMD;
        }).length;

        // ✅ Alerts (open/unread only) so counts match dismissal behavior
        const openAlerts = alerts.filter((a) => !a.تم_القراءة);
        const criticalAlerts = openAlerts.filter(
          (a) => String(a.category) === 'Critical' || a.نوع_التنبيه === 'عاجل'
        ).length;
        const warningAlerts = openAlerts.filter(
          (a) => String(a.category) === 'Warning' || a.نوع_التنبيه === 'تحذير'
        ).length;
        const infoAlerts = openAlerts.filter(
          (a) => String(a.category) === 'Info' || a.نوع_التنبيه === 'معلومة'
        ).length;

        const desktopPerf = isDesktopFast
          ? await dashboardPerformanceSmart({ monthKey: currentMonth, prevMonthKey: previousMonth })
          : null;
        const desktopHighlights = isDesktopFast
          ? await dashboardHighlightsSmart({ todayYMD })
          : null;

        const installmentsForStats = DbService.getInstallments();
        const contractsForKpi =
          !isDesktopFast && contracts.length > 0 ? contracts : DbService.getContracts();

        const limit30d = toYMD(
          new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30)
        );

        let dueTodayInstallmentsCount = 0;
        let overdueCollectionAmount = 0;
        let donutPaid = 0;
        let donutOverdue = 0;
        let donutUpcoming = 0;

        for (const inst of installmentsForStats) {
          if (String(inst?.نوع_الكمبيالة || '').trim() === 'تأمين') continue;
          const due = String(inst.تاريخ_استحقاق || '').slice(0, 10);
          const { remaining } = getInstallmentPaidAndRemaining(inst);
          const isPaid =
            remaining <= 0 || String(inst?.حالة_الكمبيالة || '').trim() === 'مدفوع';
          if (isPaid) {
            donutPaid++;
            continue;
          }
          if (due < todayYMD) {
            donutOverdue++;
            overdueCollectionAmount += Math.max(0, remaining);
          } else {
            donutUpcoming++;
          }
          if (due === todayYMD && remaining > 0) dueTodayInstallmentsCount++;
        }

        if (isDesktopFast && desktopHighlights?.dueInstallmentsToday?.length) {
          dueTodayInstallmentsCount = desktopHighlights.dueInstallmentsToday.filter(
            (r) => Number(r.remaining ?? 0) > 0
          ).length;
        }

        let expiringContracts30dCount = 0;
        for (const c of contractsForKpi) {
          if (!isTenancyRelevant(c)) continue;
          const end = String(c.تاريخ_النهاية || '').slice(0, 10);
          if (!end || end < todayYMD || end > limit30d) continue;
          expiringContracts30dCount++;
        }
        if (isDesktopFast && Array.isArray(desktopHighlights?.expiringContracts)) {
          expiringContracts30dCount = desktopHighlights.expiringContracts.filter((row) => {
            const end = String(row.endDate || '').slice(0, 10);
            return end >= todayYMD && end <= limit30d;
          }).length;
        }

        const recentOperations: DashboardData['recentOperations'] = (() => {
          type Row = DashboardData['recentOperations'][number] & { ts: number };
          const rows: Row[] = [];
          for (const i of installmentsForStats) {
            if (String(i?.حالة_الكمبيالة || '').trim() !== 'مدفوع') continue;
            const paidAt = toRecord(i as unknown)['تاريخ_الدفع'];
            const at =
              typeof paidAt === 'string' && paidAt.trim()
                ? paidAt.slice(0, 10)
                : String(i.تاريخ_استحقاق || '').slice(0, 10);
            const ts = new Date(at).getTime();
            if (!Number.isFinite(ts)) continue;
            rows.push({
              id: `pay-${i.رقم_الكمبيالة}`,
              kind: 'payment',
              title: 'سداد قسط',
              detail: `عقد ${i.رقم_العقد}`,
              at,
              ts,
            });
          }
          for (const c of contractsForKpi) {
            const cr = c as unknown as Record<string, unknown>;
            const raw = cr['تاريخ_الانشاء'] ?? cr['تاريخ_الإنشاء'];
            const created = typeof raw === 'string' && raw.trim() ? raw.slice(0, 10) : '';
            if (!created) continue;
            const ts = new Date(created).getTime();
            if (!Number.isFinite(ts)) continue;
            rows.push({
              id: `ctr-${c.رقم_العقد}`,
              kind: 'contract',
              title: 'تسجيل عقد',
              detail: String(c.رقم_العقد),
              at: created,
              ts,
            });
          }
          return rows
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 5)
            .map(({ ts: _t, ...rest }) => rest);
        })();

        setData({
          meta: {
            updatedAt: Date.now(),
          },

          systemHealth,
          logsRaw,

          kpis: {
            totalRevenue,
            previousMonthRevenue,
            currentYearRevenue,
            previousYearRevenue,
            activeContracts,
            occupancyRate: Math.round(occupancyRate),
            latePayments,
            dueTodayPayments,
            dueNext7Payments,
            dueTotalPayments,
            totalPeople: isDesktopFast
              ? Number(desktopSummary?.totalPeople || 0) || 0
              : people.length,
            totalProperties,
            totalContracts: isDesktopFast
              ? Number(desktopSummary?.totalContracts || 0) || 0
              : contracts.length,
            occupiedProperties,
            dueTodayInstallmentsCount,
            expiringContracts30dCount,
            overdueCollectionAmount,
          },

          performance: desktopPerf
            ? {
                monthKey: currentMonth,
                prevMonthKey: previousMonth,
                currentMonthCollections: Number(desktopPerf.currentMonthCollections || 0) || 0,
                previousMonthCollections: Number(desktopPerf.previousMonthCollections || 0) || 0,
                paidCountThisMonth: Number(desktopPerf.paidCountThisMonth || 0) || 0,
                dueUnpaidThisMonth: Number(desktopPerf.dueUnpaidThisMonth || 0) || 0,
              }
            : undefined,

          desktopAggregations: isDesktopFast
            ? {
                propertyTypeCounts: Array.isArray(desktopSummary?.propertyTypeCounts)
                  ? desktopSummary.propertyTypeCounts
                  : [],
                contractStatusCounts: Array.isArray(desktopSummary?.contractStatusCounts)
                  ? desktopSummary.contractStatusCounts
                  : [],
              }
            : undefined,

          desktopHighlights:
            isDesktopFast && desktopHighlights
              ? {
                  dueInstallmentsToday: Array.isArray(desktopHighlights?.dueInstallmentsToday)
                    ? desktopHighlights.dueInstallmentsToday
                    : [],
                  expiringContracts: Array.isArray(desktopHighlights?.expiringContracts)
                    ? desktopHighlights.expiringContracts
                    : [],
                  incompleteProperties: Array.isArray(desktopHighlights?.incompleteProperties)
                    ? desktopHighlights.incompleteProperties
                    : [],
                }
              : undefined,
          sales: {
            newOffers,
            inNegotiation: pendingSales,
            completed: completedSales,
            totalValue: totalSalesValue,
          },
          tasks: {
            today: todayTasks,
            overdue: overdueTasks,
            upcoming: upcomingTasks,
          },
          alerts: {
            critical: criticalAlerts,
            warning: warningAlerts,
            info: infoAlerts,
          },
          people,
          properties,
          contracts,
          commissions,

          commissionsAll,
          installments,
          salesListings,
          salesAgreements,
          followUps,
          alertsRaw: alerts,
          installmentStatusDonut: {
            paid: donutPaid,
            overdue: donutOverdue,
            upcoming: donutUpcoming,
          },
          recentOperations,
        });
      } catch (error: unknown) {
        console.error('Error refreshing dashboard data:', error);
        const detail =
          error instanceof Error && error.message.trim()
            ? error.message
            : 'تعذر تحميل بيانات لوحة التحكم. قد تكون الأرقام المعروضة غير محدثة.';
        toast.error(detail, 'فشل تحميل لوحة التحكم');
      } finally {
        setIsRefreshing(false);
        setInitialLoadDone(true);
      }
    })();
  }, [toast]);

  useEffect(() => {
    refreshData();

    // Update immediately when underlying db_ keys change (Desktop sync and in-app edits).
    const onTasksChanged = () => refreshData();
    const onMarqueeChanged = () => refreshData();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (String(e.key).startsWith('db_')) refreshData();
    };
    const onDbChanged = () => refreshData();
    const onFocus = () => refreshData();

    window.addEventListener('azrar:tasks-changed', onTasksChanged);
    window.addEventListener('azrar:marquee-changed', onMarqueeChanged);
    window.addEventListener('azrar:db-changed', onDbChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);

    const autoRefresh = options?.autoRefresh ?? true;
    const intervalMs = options?.refreshIntervalMs ?? 30_000;
    const interval = autoRefresh ? setInterval(refreshData, intervalMs) : null;
    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('azrar:tasks-changed', onTasksChanged);
      window.removeEventListener('azrar:marquee-changed', onMarqueeChanged);
      window.removeEventListener('azrar:db-changed', onDbChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [options?.autoRefresh, options?.refreshIntervalMs, refreshData]);

  return {
    data,
    isRefreshing,
    kpiLoading: !initialLoadDone,
    refresh: refreshData,
  };
};
