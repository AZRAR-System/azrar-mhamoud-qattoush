import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSmartModal } from '@/context/ModalContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { usePageVisibility } from '@/context/PageVisibilityContext';
import { DbService } from '@/services/mockDb';
import { runWithSqlSyncBlocking } from '@/utils/sqlSyncBlockingUi';
import { clearCommissionsDesktopEntityCache } from '@/services/commissionsDesktopEntityCache';
import { NAV_ITEMS } from '@/constants';
import { ROUTE_PATHS } from '@/routes/paths';
import { isRole } from '@/utils/roles';
import type { الكمبيالات_tbl } from '@/types';

export type LayerTab = 'overview' | 'sales' | 'calendar' | 'monitoring' | 'performance';

export interface LayerConfig {
  id: LayerTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

/* ── Helpers ── */

const toRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const getPaymentMonth = (i: الكمبيالات_tbl): string =>
  String(i.تاريخ_الدفع || i.تاريخ_استحقاق || '').slice(0, 7);

/* ── Hook ── */

export function useDashboard() {
  const { user } = useAuth();
  const { openPanel: _openPanel } = useSmartModal();
  const toast = useToast();
  const { isVisible } = usePageVisibility();
  const [activeLayer, setActiveLayer] = useState<LayerTab>('overview');
  const [autoRefresh] = useState(true);
  const [, setTasksTick] = useState(0);
  const sqlSyncInFlightRef = useRef(false);
  const [pagesSearch, setPagesSearch] = useState('');

  // Get dashboard data
  const {
    data: dashboardData,
    isRefreshing,
    kpiLoading,
    isDesktopFast,
    refresh,
  } = useDashboardData({
    autoRefresh,
    isVisible,
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
      if (stored) setActiveLayer(stored as LayerTab);
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

  const todayYMD = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const userRecord = useMemo(() => toRecord(user), [user]);
  const currentUsername = useMemo(
    () => String(userRecord['اسم_المستخدم'] ?? userRecord['name'] ?? '').trim(),
    [userRecord]
  );

  const employeeCommissionsThisMonth = useMemo(() => {
    // Preserve original logic: trigger re-calc on meta.updatedAt change.
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

      return {
        count: monthRows.length,
        totalOffice: monthRows.reduce<number>((s, r) => s + toNumber(toRecord(r)['officeCommission']), 0),
        totalIntro: monthRows.reduce<number>((s, r) => s + toNumber(toRecord(r)['intro']), 0),
        totalEmployee: monthRows.reduce<number>((s, r) => s + toNumber(toRecord(r)['employeeTotal']), 0),
      };
    } catch {
      return { count: 0, totalOffice: 0, totalIntro: 0, totalEmployee: 0 };
    }
  }, [currentMonth, dashboardData.meta.updatedAt, currentUsername]);

  const todayFollowUps = useMemo(() => 
    DbService.getFollowUps().filter((t) => String(toRecord(t)['dueDate'] ?? '') === todayYMD),
    [todayYMD]
  );
  const todayReminders = useMemo(() => 
    DbService.getReminders().filter((r) => String(toRecord(r)['date'] ?? '') === todayYMD && String(toRecord(r)['type'] ?? '') === 'Task'),
    [todayYMD]
  );
  const todayTaskTitles = useMemo(() => [
    ...todayFollowUps.map((t) => String(toRecord(t)['task'] ?? '').trim()).filter(Boolean),
    ...todayReminders.map((r) => String(toRecord(r)['title'] ?? '').trim()).filter(Boolean),
  ], [todayFollowUps, todayReminders]);

  const handleManualRefresh = () => { refresh(); };

  const lastUpdatedAt = useMemo(
    () => new Date(dashboardData.meta.updatedAt || Date.now()),
    [dashboardData.meta.updatedAt]
  );

  const handleSqlSyncNow = async () => {
    if (!window.desktopDb?.sqlSyncNow) {
      toast.error('المزامنة متاحة فقط في نسخة Desktop');
      return;
    }
    if (sqlSyncInFlightRef.current) return;
    sqlSyncInFlightRef.current = true;
    try {
      await runWithSqlSyncBlocking(async () => {
        const res = (await window.desktopDb.sqlSyncNow()) as { ok?: boolean; message?: string } | null;
        if (res?.ok) {
          clearCommissionsDesktopEntityCache();
          toast.success(res?.message || 'تمت المزامنة');
        } else toast.error(res?.message || 'فشل المزامنة');
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'فشل المزامنة';
      toast.error(msg);
    } finally {
      sqlSyncInFlightRef.current = false;
    }
  };

  const employeeOps = useMemo(() => {
    const logs = Array.isArray(dashboardData.logsRaw) ? dashboardData.logsRaw : [];
    const username = currentUsername;
    const userId = String(userRecord['id'] ?? '').trim();

    const matchesUser = (l: unknown) => {
      const rec = toRecord(l);
      const byName = username && String(rec['اسم_المستخدم'] ?? '').trim() === username;
      const byId = userId && String(rec['userId'] ?? rec['user_id'] ?? rec['رقم_المستخدم'] ?? '').trim() === userId;
      return byName || byId;
    };

    const userLogs = logs.filter(matchesUser).slice().reverse();
    return { total: userLogs.length, recent: userLogs.slice(0, 8) };
  }, [dashboardData.logsRaw, currentUsername, userRecord]);

  const pagesLinks = useMemo(() => {
    type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
    type LinkItem = { label: string; path: string; icon?: IconComponent; group?: string };
    const out: LinkItem[] = [];
    
    const visit = (item: unknown, group?: string) => {
      const r = toRecord(item);
      const children = Array.isArray(r['children']) ? r['children'] : [];
      if (children.length) {
        children.filter(c => {
          const role = String(toRecord(c)['role'] || '');
          return !role || isRole(userRecord['الدور'], role);
        }).forEach(c => visit(c, String(r['label'] ?? '')));
        return;
      }
      const path = String(r['path'] || '');
      if (path && path.startsWith('/')) {
        out.push({ label: String(r['label'] || '').trim(), path, icon: r['icon'] as IconComponent | undefined, group });
      }
    };

    NAV_ITEMS.forEach(n => visit(n));
    out.push({ label: 'اتصالات', path: ROUTE_PATHS.CONTACTS, group: 'أدوات' });
    out.push({ label: 'إرسال واتساب جماعي', path: ROUTE_PATHS.BULK_WHATSAPP, group: 'أدوات' });
    out.push({ label: 'مستندات', path: ROUTE_PATHS.DOCUMENTS, group: 'أدوات' });

    const q = pagesSearch.trim().toLowerCase();
    const filtered = q ? out.filter(x => x.label.toLowerCase().includes(q) || x.path.toLowerCase().includes(q) || String(x.group || '').toLowerCase().includes(q)) : out;

    const groupOrder = ['أدوات', 'المشرفين'];
    return filtered.sort((a, b) => {
      const ag = a.group ? groupOrder.indexOf(a.group) : -1;
      const bg = b.group ? groupOrder.indexOf(b.group) : -1;
      if (ag !== bg) return ag - bg;
      return a.label.localeCompare(b.label, 'ar');
    });
  }, [pagesSearch, userRecord]);

  const runtimeRequirements = useMemo(() => ({
    isDesktop: !!window.desktopDb,
    hasSqlSync: !!window.desktopDb?.sqlSyncNow,
    hasBackup: !!window.desktopDb?.chooseBackupDir,
    hasUpdater: !!(window as { desktopUpdater?: unknown })?.desktopUpdater,
  }), []);

  return {
    userRecord, dashboardData, isRefreshing, kpiLoading, isDesktopFast, lastUpdatedAt,
    activeLayer, setActiveLayer, handleManualRefresh, handleSqlSyncNow,
    pagesSearch, setPagesSearch, pagesLinks,
    employeeCommissionsThisMonth, todayTaskTitles, employeeOps, runtimeRequirements,
  };
}

export type UseDashboardReturn = ReturnType<typeof useDashboard>;

/* ── Exported helpers needed for View ── */
export { getPaymentMonth };
