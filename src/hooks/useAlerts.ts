import { useState, useEffect, useCallback, useMemo } from 'react';
import { DbService } from '@/services/mockDb';
import { tbl_Alerts } from '../types/types';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useToast } from '@/context/ToastContext';

export type KanbanCategory =
  | 'urgent'
  | 'financial'
  | 'contracts'
  | 'dataQuality'
  | 'maintenance';

export type AlertPriority = 'urgent' | 'high' | 'normal' | 'low';

/**
 * AlertItem extends the base tbl_Alerts with UI-specific properties
 * like priority (derived or explicit).
 */
export interface AlertItem extends tbl_Alerts {
  priority: AlertPriority;
}

export interface KanbanColumn {
  id: KanbanCategory;
  label: string;
  alerts: AlertItem[];
  count: number;
}

import { AlertPanelIntent } from '@/services/alerts/alertActionTypes';

export interface UseAlertsResult {
  columns: KanbanColumn[];
  selectedAlert: AlertItem | null;
  selectedIds: Set<string>;
  searchQuery: string;
  activeFilter: 'unread' | 'all';
  activePeriod: 'today' | 'week' | 'month';
  setSelectedAlert: (a: AlertItem | null) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setSearchQuery: (q: string) => void;
  setActiveFilter: (f: 'unread' | 'all') => void;
  setActivePeriod: (p: 'today' | 'week' | 'month') => void;
  isLoading: boolean;
  unreadCount: number;
  totalCount: number;
  markAsRead: (ids: string[]) => void;
  archiveBulk: (ids: string[]) => void;
  runScan: () => Promise<void>;
  saveNote: (id: string, note: string) => void;
}

function categorize(alert: AlertItem): KanbanCategory {
  const cat = String(alert.category || '').toLowerCase();
  if (alert.priority === 'urgent') return 'urgent';
  if (cat.includes('financial') || cat.includes('payment')) return 'financial';
  if (cat.includes('contract') || cat.includes('expiry')) return 'contracts';
  if (cat.includes('maintenance')) return 'maintenance';
  return 'dataQuality';
}

const COLUMN_ORDER: KanbanCategory[] = [
  'urgent',
  'financial',
  'contracts',
  'dataQuality',
  'maintenance',
];

const KANBAN_CONFIG: Record<KanbanCategory, string> = {
  urgent: 'عاجل جداً',
  financial: 'التحصيل المالي',
  contracts: 'العقود والانتهاء',
  dataQuality: 'جودة البيانات',
  maintenance: 'الصيانة والدعم',
};

export const useAlerts = (isVisible: boolean, intent?: AlertPanelIntent): UseAlertsResult => {
  const [rawAlerts, setRawAlerts] = useState<tbl_Alerts[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState(intent?.q || '');
  const [activeFilter, setActiveFilter] = useState<'unread' | 'all'>(intent?.only || 'unread');
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month'>('week');
  const [isLoading, setIsLoading] = useState(false);

  const dbSignal = useDbSignal();
  const toast = useToast();

  const loadAlerts = useCallback(() => {
    setIsLoading(true);
    try {
      const all = DbService.getAlerts() || [];
      setRawAlerts(all);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible) loadAlerts();
  }, [isVisible, dbSignal, loadAlerts]);

  // Derive AlertItem with priority
  const alertsWithPriority = useMemo((): AlertItem[] => {
    return rawAlerts.map((a) => {
      let priority: AlertPriority = 'normal';
      const title = String(a.نوع_التنبيه || '').toLowerCase();
      const cat = String(a.category || '').toLowerCase();

      if (cat === 'risk' || title.includes('عاجل') || title.includes('مخاطر')) {
        priority = 'urgent';
      } else if (cat === 'financial' || title.includes('استحقاق')) {
        priority = 'high';
      } else if (cat === 'expiry') {
        priority = 'high';
      } else if (cat === 'dataquality') {
        priority = 'low';
      }

      return { ...a, priority };
    });
  }, [rawAlerts]);

  const filteredAlerts = useMemo(() => {
    let list = alertsWithPriority;

    if (activeFilter === 'unread') {
      list = list.filter((a) => !a.تم_القراءة);
    }

    const now = new Date();
    if (activePeriod === 'today') {
      list = list.filter(
        (a) => new Date(a.تاريخ_الانشاء).toDateString() === now.toDateString()
      );
    } else if (activePeriod === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      list = list.filter((a) => new Date(a.تاريخ_الانشاء) >= weekAgo);
    } else if (activePeriod === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      list = list.filter((a) => new Date(a.تاريخ_الانشاء) >= monthAgo);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        return (
          String(a.الوصف || '').toLowerCase().includes(q) ||
          String(a.نوع_التنبيه || '').toLowerCase().includes(q) ||
          String(a.tenantName || '').toLowerCase().includes(q) ||
          String(a.propertyCode || '').toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [alertsWithPriority, activeFilter, activePeriod, searchQuery]);

  const columns = useMemo((): KanbanColumn[] => {
    const groups: Record<KanbanCategory, AlertItem[]> = {
      urgent: [],
      financial: [],
      contracts: [],
      dataQuality: [],
      maintenance: [],
    };

    filteredAlerts.forEach((a) => {
      const cat = categorize(a);
      groups[cat].push(a);
    });

    return COLUMN_ORDER.map((id) => ({
      id,
      label: KANBAN_CONFIG[id],
      alerts: groups[id],
      count: groups[id].length,
    }));
  }, [filteredAlerts]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const markAsRead = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      DbService.markMultipleAlertsAsRead(ids);
      loadAlerts();
      clearSelection();
    },
    [loadAlerts, clearSelection]
  );

  const archiveBulk = useCallback(
    (ids: string[]) => {
      // In this system, archiving is equivalent to marking as read for now
      markAsRead(ids);
    },
    [markAsRead]
  );

  const runScan = async () => {
    setIsLoading(true);
    try {
      await DbService.runDailyScheduler();
      loadAlerts();
      toast.success('تم تحديث التنبيهات وإجراء المسح الشامل');
    } catch {
      toast.error('فشل إجراء المسح');
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = useCallback(
    (alertId: string, note: string) => {
      const alert = alertsWithPriority.find((a) => a.id === alertId);
      if (!alert || !note.trim()) return;

      if (alert.مرجع_المعرف && alert.مرجع_المعرف !== 'batch') {
        DbService.addEntityNote(alert.مرجع_الجدول || 'System', alert.مرجع_المعرف, note);
        toast.success('تم حفظ الملاحظة بنجاح');
      } else {
        toast.warning('لا يمكن إضافة ملاحظة لتنبيه مجمّع');
      }
    },
    [alertsWithPriority, toast]
  );

  const unreadCount = useMemo(
    () => alertsWithPriority.filter((a) => !a.تم_القراءة).length,
    [alertsWithPriority]
  );

  return {
    columns,
    selectedAlert,
    selectedIds,
    searchQuery,
    activeFilter,
    activePeriod,
    isLoading,
    totalCount: alertsWithPriority.length,
    unreadCount,
    setSelectedAlert,
    toggleSelect,
    clearSelection,
    setSearchQuery,
    setActiveFilter,
    setActivePeriod,
    markAsRead,
    archiveBulk,
    runScan,
    saveNote,
  };
};
