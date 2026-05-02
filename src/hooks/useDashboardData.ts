/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Hook for gathering all dashboard data from various services
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { kpiCache } from '@/services/kpiCache';

export interface UseDashboardDataOptions {
  autoRefresh?: boolean;
  /** Pass false to pause background updates (hibernation) */
  isVisible?: boolean;
  refreshIntervalMs?: number;
}

/** لقطة تشغيل يومية من مسار الـ cache السريع — أنواع مستقلة عن طبقة الخدمات */
export interface DailyOperationalSnapshot {
  paymentsToday: number;
  revenueToday: number;
  contractsExpiring30: number;
  maintenanceOpen: number;
  dueNext7Payments: number;
}

/** أرقام الملخص اليومي — تُحسب في الـ hook فقط (مصدر واحد، بدون استدعاءات من الويدجت) */
export interface DailySummaryWidgetStats {
  openAlertsTotal: number;
  criticalAlerts: number;
  paymentRemindersNext7: number;
  contractsExpiring30: number;
  maintenanceOpen: number;
  revenueToday: number;
}

function getAlertPriorityField(alert: tbl_Alerts): string | undefined {
  const priority = (alert as unknown as Record<string, unknown>)['الأولوية'];
  return typeof priority === 'string' ? priority : undefined;
}

function getPaymentTargetItemsLength(target: unknown): number {
  if (!target || typeof target !== 'object') return 0;
  const items = (target as { items?: unknown }).items;
  return Array.isArray(items) ? items.length : 0;
}

/** لقطة أرقام الملخص اليومي: مسار سريع من snap أو دائماً DbService عند عدم توفرها */
export function buildDailySummaryWidgetStats(params: {
  fastPath: boolean;
  snap: DailyOperationalSnapshot | undefined;
  alerts: tbl_Alerts[];
  todayYMD: string;
  contracts: العقود_tbl[];
  installments: الكمبيالات_tbl[];
}): DailySummaryWidgetStats {
  const { fastPath, snap, alerts, todayYMD, contracts, installments } = params;
  const openAlerts = alerts.filter((a) => !a.تم_القراءة);
  const criticalAlerts = openAlerts.filter((a) => getAlertPriorityField(a) === 'عالية').length;

  const useSnap = Boolean(fastPath && snap);
  const paymentRemindersNext7 = useSnap
    ? Number(snap!.dueNext7Payments) || 0
    : DbService.getPaymentNotificationTargets(7).reduce(
        (sum, target) => sum + getPaymentTargetItemsLength(target),
        0
      );

  const contractsExpiring30 = useSnap
    ? Number(snap!.contractsExpiring30) || 0
    : contracts.filter((c) => {
        const endDate = new Date(c.تاريخ_النهاية);
        const daysUntilExpiry = Math.ceil(
          (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
      }).length;

  const maintenanceOpen = useSnap
    ? Number(snap!.maintenanceOpen) || 0
    : DbService.getMaintenanceTickets().filter(
        (m) => m.الحالة === 'مفتوح' || m.الحالة === 'قيد التنفيذ'
      ).length;

  const revenueToday = useSnap
    ? Number(snap!.revenueToday) || 0
    : installments
        .filter((i) => i.تاريخ_استحقاق === todayYMD && i.حالة_الكمبيالة === 'مدفوع')
        .reduce((sum, i) => sum + (Number(i.القيمة) || 0), 0);

  return {
    openAlertsTotal: openAlerts.length,
    criticalAlerts,
    paymentRemindersNext7,
    contractsExpiring30,
    maintenanceOpen,
    revenueToday,
  };
}

export interface UseDashboardDataResult {
  data: DashboardData;
  isRefreshing: boolean;
  /** true حتى اكتمال أول تحميل للـ KPIs والبيانات */
  kpiLoading: boolean;
  /** مصدر واحد: نجاح dashboardSummarySmart في آخر دورة تحديث */
  isDesktopFast: boolean;
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

  /** لقطة يومية من الـ cache عند المسار السريع — للملخص اليومي وغيره */
  dailyOperationalSnapshot?: DailyOperationalSnapshot;

  /** أرقام جاهزة لـ DailySummaryWidget — من نفس دورة التحديث (بدون حالة وسط) */
  dailySummaryStats: DailySummaryWidgetStats;
}

function initialDashboardPerformanceBlock(): NonNullable<DashboardData['performance']> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  return {
    monthKey,
    prevMonthKey,
    currentMonthCollections: 0,
    previousMonthCollections: 0,
    paidCountThisMonth: 0,
    dueUnpaidThisMonth: 0,
  };
}

export const useDashboardData = (options?: UseDashboardDataOptions): UseDashboardDataResult => {
  const toast = useToast();
  const isRunningRef = useRef(false);
  const eventRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDesktopFast, setIsDesktopFast] = useState(false);
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
    dailySummaryStats: {
      openAlertsTotal: 0,
      criticalAlerts: 0,
      paymentRemindersNext7: 0,
      contractsExpiring30: 0,
      maintenanceOpen: 0,
      revenueToday: 0,
    },
    performance: initialDashboardPerformanceBlock(),
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const refreshData = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
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

        const cacheKey = `kpi-summary-${todayYMD}`;
        const cachedSnapshot = kpiCache.get<
          ReturnType<typeof dashboardSummarySmart> extends Promise<infer R> ? R : never
        >(cacheKey);
        const desktopSummary = cachedSnapshot ?? (await dashboardSummarySmart({ todayYMD, weekYMD }));
        if (!cachedSnapshot && desktopSummary) {
          kpiCache.set(cacheKey, desktopSummary);
        }
        const fastPath = !!desktopSummary;
        setIsDesktopFast(fastPath);

        // Raw datasets (keep heavy ones empty in Desktop fast mode)
        const people: الأشخاص_tbl[] = fastPath ? [] : DbService.getPeople();
        const properties: العقارات_tbl[] = fastPath ? [] : DbService.getProperties();
        const contracts: العقود_tbl[] = fastPath ? [] : DbService.getContracts();
        const installments: الكمبيالات_tbl[] = fastPath ? [] : DbService.getInstallments();

        // Smaller datasets — load immediately (commissions needed for KPIs)
        const commissionsAll: العمولات_tbl[] = DbService.getCommissions();
        // Secondary datasets — defer in fastPath to unblock main thread
        const salesListings: عروض_البيع_tbl[] = fastPath ? [] : DbService.getSalesListings();
        const followUps: FollowUpTask[] = fastPath ? [] : DbService.getFollowUps();
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

        const activeContracts = fastPath
          ? Number(desktopSummary?.activeContracts || 0) || 0
          : contracts.filter((c) => isTenancyRelevant(c)).length;

        const totalProperties = fastPath
          ? Number(desktopSummary?.totalProperties || 0) || 0
          : properties.length;

        const occupiedProperties = fastPath
          ? Number(desktopSummary?.occupiedProperties || 0) || 0
          : properties.filter((p) => p.IsRented === true).length;

        const occupancyRate =
          totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0;

        // ✅ Payment notifications policy: pre-due reminders only
        // Align KPI counts with PaymentNotificationsPanel (no due-today / overdue reminders).
        const dueNext7Payments = fastPath
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

        const desktopPerf = fastPath
          ? await dashboardPerformanceSmart({ monthKey: currentMonth, prevMonthKey: previousMonth })
          : null;
        const desktopHighlights = fastPath ? await dashboardHighlightsSmart({ todayYMD }) : null;

        // In fastPath, desktopHighlights provides installment/contract stats — avoid heavy DB calls
        const installmentsForStats = fastPath ? [] : DbService.getInstallments();
        const contractsForKpi = fastPath ? [] : (contracts.length > 0 ? contracts : DbService.getContracts());

        const getInstPaymentMonth = (i: الكمبيالات_tbl) =>
          String(i.تاريخ_الدفع || i.تاريخ_استحقاق || '').slice(0, 7);
        const isInstPaidForPerf = (i: الكمبيالات_tbl) => String(i?.حالة_الكمبيالة) === 'مدفوع';
        const performanceBlock: NonNullable<DashboardData['performance']> = desktopPerf
          ? {
              monthKey: currentMonth,
              prevMonthKey: previousMonth,
              currentMonthCollections: Number(desktopPerf.currentMonthCollections || 0) || 0,
              previousMonthCollections: Number(desktopPerf.previousMonthCollections || 0) || 0,
              paidCountThisMonth: Number(desktopPerf.paidCountThisMonth || 0) || 0,
              dueUnpaidThisMonth: Number(desktopPerf.dueUnpaidThisMonth || 0) || 0,
            }
          : {
              monthKey: currentMonth,
              prevMonthKey: previousMonth,
              currentMonthCollections: installmentsForStats
                .filter((i) => isInstPaidForPerf(i) && getInstPaymentMonth(i) === currentMonth)
                .reduce((s, i) => s + Number(i.القيمة || 0), 0),
              previousMonthCollections: installmentsForStats
                .filter((i) => isInstPaidForPerf(i) && getInstPaymentMonth(i) === previousMonth)
                .reduce((s, i) => s + Number(i.القيمة || 0), 0),
              paidCountThisMonth: installmentsForStats.filter(
                (i) => isInstPaidForPerf(i) && getInstPaymentMonth(i) === currentMonth
              ).length,
              dueUnpaidThisMonth: installmentsForStats
                .filter(
                  (i) =>
                    !isInstPaidForPerf(i) &&
                    String(i.تاريخ_استحقاق || '').slice(0, 7) === currentMonth
                )
                .reduce((s, i) => s + Number(i.القيمة_المتبقية ?? i.القيمة ?? 0), 0),
            };

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
          const isPaid = remaining <= 0 || String(inst?.حالة_الكمبيالة || '').trim() === 'مدفوع';
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

        if (fastPath && desktopHighlights?.dueInstallmentsToday?.length) {
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
        if (fastPath && Array.isArray(desktopHighlights?.expiringContracts)) {
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

        const dailyOperationalSnapshot: DailyOperationalSnapshot | undefined =
          fastPath && desktopSummary
            ? {
                paymentsToday: Number(desktopSummary.paymentsToday) || 0,
                revenueToday: Number(desktopSummary.revenueToday) || 0,
                contractsExpiring30: Number(desktopSummary.contractsExpiring30) || 0,
                maintenanceOpen: Number(desktopSummary.maintenanceOpen) || 0,
                dueNext7Payments: Number(desktopSummary.dueNext7Payments) || 0,
              }
            : undefined;

        const dailySummaryStats = buildDailySummaryWidgetStats({
          fastPath,
          snap: dailyOperationalSnapshot,
          alerts,
          todayYMD,
          contracts,
          installments,
        });

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
            totalPeople: fastPath ? Number(desktopSummary?.totalPeople || 0) || 0 : people.length,
            totalProperties,
            totalContracts: fastPath
              ? Number(desktopSummary?.totalContracts || 0) || 0
              : contracts.length,
            occupiedProperties,
            dueTodayInstallmentsCount,
            expiringContracts30dCount,
            overdueCollectionAmount,
          },

          performance: performanceBlock,

          desktopAggregations: fastPath
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
            fastPath && desktopHighlights
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
          dailyOperationalSnapshot,
          dailySummaryStats,
        });
      } catch (error: unknown) {
        console.error('Error refreshing dashboard data:', error);
        setIsDesktopFast(false);
        const detail =
          error instanceof Error && error.message.trim()
            ? error.message
            : 'تعذر تحميل بيانات لوحة التحكم. قد تكون الأرقام المعروضة غير محدثة.';
        toast.error(detail, 'فشل تحميل لوحة التحكم');
      } finally {
        setIsRefreshing(false);
        setInitialLoadDone(true);
        isRunningRef.current = false;
      }
    })();
  }, [toast]);

  useEffect(() => {
    const isVisible = options?.isVisible ?? true;
    if (!isVisible) {
      // Mark as stale if we're hidden but data changed (optional, but good for UX)
      // For now, we'll just not refresh while hidden.
      return;
    }

    refreshData();

    // Update immediately when underlying db_ keys change (Desktop sync and in-app edits).
    const scheduleEventRefresh = () => {
      if (eventRefreshTimerRef.current) return;
      // Collapse bursts of desktop sync events into a single refresh.
      eventRefreshTimerRef.current = setTimeout(() => {
        eventRefreshTimerRef.current = null;
        refreshData();
      }, 350);
    };
    const onTasksChanged = () => scheduleEventRefresh();
    const onMarqueeChanged = () => scheduleEventRefresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (String(e.key).startsWith('db_')) scheduleEventRefresh();
    };
    const onDbChanged = () => {
      kpiCache.invalidate();
      scheduleEventRefresh();
    };
    const onFocus = () => scheduleEventRefresh();

    window.addEventListener('azrar:tasks-changed', onTasksChanged);
    window.addEventListener('azrar:marquee-changed', onMarqueeChanged);
    window.addEventListener('azrar:db-changed', onDbChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);

    const autoRefresh = options?.autoRefresh ?? true;
    const intervalMs = options?.refreshIntervalMs ?? 120_000; // 2min — reduced from 30s to avoid main-thread violations
    const interval = autoRefresh
      ? setInterval(() => {
          if (isRunningRef.current) return;
          refreshData();
        }, intervalMs)
      : null;
    return () => {
      if (interval) clearInterval(interval);
      if (eventRefreshTimerRef.current) {
        clearTimeout(eventRefreshTimerRef.current);
        eventRefreshTimerRef.current = null;
      }
      window.removeEventListener('azrar:tasks-changed', onTasksChanged);
      window.removeEventListener('azrar:marquee-changed', onMarqueeChanged);
      window.removeEventListener('azrar:db-changed', onDbChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [options?.autoRefresh, options?.refreshIntervalMs, options?.isVisible, refreshData]);

  return {
    data,
    isRefreshing,
    kpiLoading: !initialLoadDone,
    isDesktopFast,
    refresh: refreshData,
  };
};
