import { useState, useEffect, useCallback, useMemo } from 'react';
import { DbService } from '@/services/mockDb';
import { tbl_Alerts, AlertCategory } from '../types/types';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useToast } from '@/context/ToastContext';
import { notificationCenter } from '@/services/notificationCenter';

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
  activePeriod: 'today' | 'week' | 'month' | 'all';
  setSelectedAlert: (a: AlertItem | null) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setSearchQuery: (q: string) => void;
  setActiveFilter: (f: 'unread' | 'all') => void;
  setActivePeriod: (p: 'today' | 'week' | 'month' | 'all') => void;
  isLoading: boolean;
  unreadCount: number;
  totalCount: number;
  markAsRead: (ids: string[]) => void;
  archiveBulk: (ids: string[]) => void;
  runScan: () => Promise<void>;
  saveNote: (id: string, note: string) => void;
}

/** Infer DB table for مرجع_المعرف from notification-center category strings. */
function inferMerjeaAljadwalFromNcCategory(category: string): string | undefined {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('contract') || cat === 'contract_renewal' || cat.includes('expiry')) return 'العقود_tbl';
  if (cat.includes('person') || cat === 'blacklist' || cat === 'risk') return 'الأشخاص_tbl';
  if (cat.includes('propert')) return 'العقارات_tbl';
  if (cat === 'maintenance') return 'تذاكر_الصيانة_tbl';
  if (
    ['payment', 'payments', 'overdue', 'collection', 'financial', 'installment', 'installments'].some(
      (k) => cat === k || cat.includes(k)
    )
  ) {
    return 'الكمبيالات_tbl';
  }
  return undefined;
}

function enrichAlert(raw: tbl_Alerts): AlertItem {
  let tenantName = raw.tenantName || '';
  let propertyCode = raw.propertyCode || '';

  if ((!tenantName || !propertyCode) && raw.مرجع_المعرف && raw.مرجع_المعرف !== 'batch') {
    const table = raw.مرجع_الجدول || '';

    if (table === 'الكمبيالات_tbl' || table === 'العقود_tbl') {
      let contract = DbService.getContracts().find((c) => String(c.رقم_العقد) === String(raw.مرجع_المعرف));
      if (!contract && table === 'الكمبيالات_tbl') {
        const inst = (DbService.getInstallments?.() || []).find(
          (i) => String(i.رقم_الكمبيالة) === String(raw.مرجع_المعرف)
        );
        if (inst) {
          contract = DbService.getContracts().find((c) => String(c.رقم_العقد) === String(inst.رقم_العقد));
        }
      }
      if (contract) {
        const person = DbService.getPeople()
          .find(p => String(p.رقم_الشخص) === String(contract.رقم_المستاجر));
        const property = DbService.getProperties()
          .find(pr => String(pr.رقم_العقار) === String(contract.رقم_العقار));
        tenantName = tenantName || person?.الاسم || '';
        propertyCode = propertyCode || property?.الكود_الداخلي || property?.العنوان || '';
      }
    }

    if (table === 'الأشخاص_tbl') {
      const person = DbService.getPeople()
        .find(p => String(p.رقم_الشخص) === String(raw.مرجع_المعرف));
      tenantName = tenantName || person?.الاسم || '';
    }

    if (table === 'العقارات_tbl') {
      const property = DbService.getProperties()
        .find(pr => String(pr.رقم_العقار) === String(raw.مرجع_المعرف));
      propertyCode = propertyCode || property?.الكود_الداخلي || property?.العنوان || '';
    }
  }

  return {
    ...raw,
    tenantName: tenantName || 'إشعار نظام',
    propertyCode: propertyCode || '—',
    priority: (raw.priority as AlertPriority) || 'normal',
  };
}

const NC_TBL_PREFIX = 'nc-tbl-';

/** One logical tbl alert id for merge/dedup (handles `nc-tbl-X`, `Nc-Tbl-X`, or bare `X`). */
function normalizeAlertIdForDedup(id: string): string {
  const s = String(id || '').trim();
  const lower = s.toLowerCase();
  if (lower.startsWith(NC_TBL_PREFIX)) {
    return s.slice(NC_TBL_PREFIX.length);
  }
  return s;
}

/** Collapse multiple notification-center rows that refer to the same tbl alert id. */
function dedupeNcMappedAlerts(rows: AlertItem[]): AlertItem[] {
  const pick = (a: AlertItem, b: AlertItem): AlertItem => {
    const aTbl = a.id.toLowerCase().startsWith(NC_TBL_PREFIX);
    const bTbl = b.id.toLowerCase().startsWith(NC_TBL_PREFIX);
    if (aTbl !== bTbl) return aTbl ? a : b;
    const ta = new Date(a.تاريخ_الانشاء).getTime();
    const tb = new Date(b.تاريخ_الانشاء).getTime();
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta >= tb ? a : b;
    return a;
  };

  const byKey = new Map<string, AlertItem>();
  for (const row of rows) {
    const k = normalizeAlertIdForDedup(row.id);
    const prev = byKey.get(k);
    byKey.set(k, prev ? pick(prev, row) : row);
  }
  return Array.from(byKey.values());
}

function categorize(alert: AlertItem): KanbanCategory {
  const cat = String(alert?.category || '').toLowerCase();
  const title = String(alert?.نوع_التنبيه || '').toLowerCase();
  
  if (alert?.priority === 'urgent' || cat === 'risk' || title.includes('مخاطر') || title.includes('عاجل')) return 'urgent';
  if (cat.includes('financial') || cat.includes('pay') || cat.includes('money')) return 'financial';
  if (cat.includes('contract') || cat.includes('rent') || cat.includes('expiry') || title.includes('انتهاء')) return 'contracts';
  if (cat.includes('maintenance') || cat.includes('ticket') || cat.includes('fix') || cat.includes('system')) return 'maintenance';
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
  const [rawAlerts, setRawAlerts] = useState<AlertItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState(intent?.q || '');
  const [activeFilter, setActiveFilter] = useState<'unread' | 'all'>(intent?.only || 'all');
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const dbSignal = useDbSignal();
  const toast = useToast();

  const loadAlerts = useCallback(() => {
    setIsLoading(true);
    try {
      const dbAlerts = DbService.getAlerts() || [];
      const ncItems = notificationCenter.getItems() || [];

      // Map NC items to tbl_Alerts structure with safety checks
      const mappedNc: AlertItem[] = ncItems.map((item): AlertItem => {
        let dateStr = new Date().toISOString();
        try {
          if (item.timestamp) {
            const d = new Date(item.timestamp);
            if (!isNaN(d.getTime())) dateStr = d.toISOString();
          }
        } catch { /* ignore */ }

        const raw: tbl_Alerts = {
          id: String(item.id),
          نوع_التنبيه: String(item.title || 'إشعار نظام'),
          الوصف: String(item.message || ''),
          تاريخ_الانشاء: String(dateStr),
          تم_القراءة: !!item.read,
          category: ((item.category as AlertCategory) || 'System') as AlertCategory,
          مرجع_الجدول: inferMerjeaAljadwalFromNcCategory(String(item.category || '')),
          مرجع_المعرف: item.entityId ? String(item.entityId) : undefined,
          priority: item.urgent ? 'urgent' : 'normal',
        };
        return enrichAlert(raw);
      });

      const mappedNcDeduped = dedupeNcMappedAlerts(mappedNc);

      // Merge and deduplicate by ID (NC items take priority)
      const merged: AlertItem[] = [...mappedNcDeduped];
      const seenBaseIds = new Set(merged.map(a => normalizeAlertIdForDedup(a.id)));

      for (const da of dbAlerts) {
        if (!seenBaseIds.has(normalizeAlertIdForDedup(da.id))) {
          merged.push(enrichAlert(da));
          seenBaseIds.add(normalizeAlertIdForDedup(da.id));
        }
      }

      setRawAlerts(merged);
    } catch (err) {
      console.error('[useAlerts] Critical failure in loadAlerts:', err);
      setRawAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible !== false) loadAlerts();
  }, [isVisible, dbSignal, loadAlerts]);

  // Also subscribe to notificationCenter changes
  useEffect(() => {
    if (isVisible === false) return;
    return notificationCenter.subscribe(() => {
      loadAlerts();
    });
  }, [isVisible, loadAlerts]);

  // Derive AlertItem with priority
  const alertsWithPriority = useMemo((): AlertItem[] => {
    return rawAlerts.map((a) => {
      // Keep explicit priority when present (NC), otherwise derive.
      let priority: AlertPriority = a.priority || 'normal';
      const title = String(a.نوع_التنبيه || '').toLowerCase();
      const cat = String(a.category || '').toLowerCase();

      if (cat === 'risk' || title.includes('عاجل') || title.includes('مخاطر') || a.priority === 'urgent') {
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
    // 'all' doesn't filter by date

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
      if (groups[cat]) {
        groups[cat].push(a);
      } else {
        groups.dataQuality.push(a);
      }
    });

    return COLUMN_ORDER.map((id) => ({
      id,
      label: KANBAN_CONFIG[id] || id,
      alerts: groups[id] || [],
      count: (groups[id] || []).length,
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
