/**
 * Core alert KV helpers (upsert / stable ids / contract context / mark read by prefix).
 */

import type { tbl_Alerts } from '@/types';
import { العقود_tbl, الأشخاص_tbl, العقارات_tbl, الكمبيالات_tbl } from '@/types';
import { notificationCenter } from '@/services/notificationCenter';
import { get, save } from './kv';
import { KEYS } from './keys';
import { logOperationInternal } from './operations/logger';

/**
 * مزامنة جميع التنبيهات الموجودة في tbl_Alerts مع مركز الاشعارات
 * تُستدعى مرة واحدة عند بدء تشغيل النظام
 */
export function syncExistingAlertsToNotificationCenter() {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  const existingIds = new Set(notificationCenter.getItems().map(i => i.id));
  
  all
    .filter(alert => !alert.تم_القراءة)
    .forEach(alert => {
      const ncId = `nc-tbl-${alert.id}`;
      if (!existingIds.has(ncId)) {
        pushNewTblAlertToNotificationCenter(alert);
      }
    });
}

function pushNewTblAlertToNotificationCenter(alert: tbl_Alerts) {
  try {
    notificationCenter.add({
      id: `nc-tbl-${alert.id}`,
      type: alert.نوع_التنبيه === 'error' ? 'error' : 'warning',
      title: String(alert.category ?? 'تنبيه'),
      message: String(alert.الوصف ?? ''),
      category: String(alert.category ?? 'alerts'),
      entityId: alert.مرجع_المعرف ? String(alert.مرجع_المعرف) : undefined,
      urgent: alert.نوع_التنبيه === 'error',
    });
  } catch {
    // ignore
  }
}

export function upsertAlert(alert: tbl_Alerts) {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  const indices: number[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i]?.id === alert.id) indices.push(i);
  }

  if (indices.length > 0) {
    const wasRead = indices.some((i) => !!all[i]?.تم_القراءة);
    const primaryIdx = indices[0];
    const prev = all[primaryIdx];
    all[primaryIdx] = { ...prev, ...alert, تم_القراءة: wasRead };

    if (indices.length > 1) {
      const keep = new Set<number>([primaryIdx]);
      const deduped: tbl_Alerts[] = [];
      for (let i = 0; i < all.length; i++) {
        if (all[i]?.id !== alert.id || keep.has(i)) {
          deduped.push(all[i]);
        }
      }
      save(KEYS.ALERTS, deduped);
      return;
    }

    save(KEYS.ALERTS, all);
    return;
  }

  pushNewTblAlertToNotificationCenter(alert);
  save(KEYS.ALERTS, [alert, ...all]);
}

export const stableAlertId = (dateISO: string, type: string, message: string, category: string) => {
  const input = `${dateISO}|${category}|${type}|${message}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ALR-GEN-${category}-${(hash >>> 0).toString(36)}`;
};

export const buildContractAlertContext = (
  contractIdRaw: string
): Partial<
  Pick<tbl_Alerts, 'tenantName' | 'phone' | 'propertyCode' | 'مرجع_الجدول' | 'مرجع_المعرف'>
> => {
  const contractId = String(contractIdRaw || '').trim();
  if (!contractId) return {};

  const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

  const contract = contracts.find((c) => String(c?.رقم_العقد) === contractId);
  if (!contract) {
    return { مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: contractId };
  }

  const tenant = people.find((p) => String(p?.رقم_الشخص) === String(contract.رقم_المستاجر));
  const property = properties.find((p) => String(p?.رقم_العقار) === String(contract.رقم_العقار));

  return {
    tenantName: tenant?.الاسم,
    phone: tenant?.رقم_الهاتف,
    propertyCode: property?.الكود_الداخلي,
    مرجع_الجدول: 'العقود_tbl',
    مرجع_المعرف: contractId,
  };
};

export const markAlertsReadByPrefix = (prefix: string) => {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  let changed = false;
  for (const a of all) {
    if (a.id.startsWith(prefix) && !a.تم_القراءة) {
      a.تم_القراءة = true;
      changed = true;
    }
  }
  if (changed) save(KEYS.ALERTS, all);
};

/**
 * إنشاء تنبيه جديد مع اختياري لترشيح البيانات وربطها بالسجلات
 */
export const createAlert = (
  type: string,
  message: string,
  category: string,
  onNotify?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void,
  ctx?: Partial<
    Pick<
      tbl_Alerts,
      | 'tenantName'
      | 'phone'
      | 'propertyCode'
      | 'مرجع_الجدول'
      | 'مرجع_المعرف'
      | 'details'
      | 'count'
    >
  >
): void => {
  const todayISO = new Date().toISOString().split('T')[0];
  const id = stableAlertId(todayISO, type, message, category);

  const existing = (get<tbl_Alerts>(KEYS.ALERTS) || []).some((a) => a.id === id);
  if (existing) return;

  const normalizedCtx: Partial<
    Pick<
      tbl_Alerts,
      | 'tenantName'
      | 'phone'
      | 'propertyCode'
      | 'مرجع_الجدول'
      | 'مرجع_المعرف'
      | 'details'
      | 'count'
    >
  > = {
    ...(ctx || {}),
  };

  const hasRef =
    !!String(normalizedCtx.مرجع_الجدول || '').trim() &&
    !!String(normalizedCtx.مرجع_المعرف || '').trim();
  if (!hasRef) {
    const text = String(message || '').trim();

    const contractMatch = text.match(/عقد\s*#?\s*([^\s،,.;]+)/);
    const installmentMatch = text.match(/كمبيالة\s*#?\s*([^\s،,.;]+)/);

    const contractId = String(contractMatch?.[1] || '').trim();
    const installmentId = String(installmentMatch?.[1] || '').trim();

    if (contractId) {
      Object.assign(normalizedCtx, buildContractAlertContext(contractId));
    } else if (installmentId) {
      normalizedCtx.مرجع_الجدول = 'الكمبيالات_tbl';
      normalizedCtx.مرجع_المعرف = installmentId;

      try {
        const inst = (get<الكمبيالات_tbl>(KEYS.INSTALLMENTS) || []).find(
          (x) => String(x?.رقم_الكمبيالة) === installmentId
        );
        const cId = String(inst?.رقم_العقد || '').trim();
        if (cId) Object.assign(normalizedCtx, buildContractAlertContext(cId));
      } catch {
        // ignore
      }
    }

    if (!String(normalizedCtx.مرجع_الجدول || '').trim()) normalizedCtx.مرجع_الجدول = 'System';
    if (!String(normalizedCtx.مرجع_المعرف || '').trim()) normalizedCtx.مرجع_المعرف = 'batch';
  }

  const alert: tbl_Alerts = {
    id,
    تاريخ_الانشاء: todayISO,
    نوع_التنبيه: type,
    الوصف: message,
    category: category as tbl_Alerts['category'],
    تم_القراءة: false,
    ...normalizedCtx,
  };

  upsertAlert(alert);

  if (onNotify) onNotify(message, type as 'success' | 'error' | 'warning' | 'info');

  logOperationInternal('System', 'إشعار جديد', category, alert.id, message);
};

/**
 * تنظيف التنبيهات القديمة
 */
export const clearOldAlerts = (daysOld: number = 30): void => {
  const alerts = get<tbl_Alerts>(KEYS.ALERTS);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const filtered = alerts.filter((a) => {
    const alertDate = new Date(a.تاريخ_الانشاء);
    return alertDate > cutoffDate;
  });

  save(KEYS.ALERTS, filtered);
};

export const markAlertAsRead = (id: string) => {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  const idx = all.findIndex((a) => a.id === id);
  if (idx > -1) {
    all[idx].تم_القراءة = true;
    save(KEYS.ALERTS, all);
  }
};

export const markAllAlertsAsRead = () => {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  all.forEach((a) => {
    a.تم_القراءة = true;
  });
  save(KEYS.ALERTS, all);
};

export const markMultipleAlertsAsRead = (ids: string[]) => {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  let changed = false;
  const idSet = new Set(ids);
  for (const a of all) {
    if (idSet.has(a.id) && !a.تم_القراءة) {
      a.تم_القراءة = true;
      changed = true;
    }
  }
  if (changed) save(KEYS.ALERTS, all);
};
