import { getMessageGlobalContext } from '@/utils/messageGlobalContext';
/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 */

import {
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  الكمبيالات_tbl,
  SystemLookup,
  LookupCategory,
  RoleType,
  المستخدمين_tbl,
  تذاكر_الصيانة_tbl,
  عروض_البيع_tbl,
  عروض_الشراء_tbl,
  اتفاقيات_البيع_tbl,
  العمليات_tbl,
  tbl_Alerts,
  DynamicTable,
  DynamicRecord,
  DynamicFormField,
  LegalNoticeTemplate,
  LegalNoticeRecord,
  ActivityRecord,
  NoteRecord,
  Attachment,
  SystemHealth,
  PredictiveInsight,
  ClearanceRecord,
  شخص_دور_tbl,
  مستخدم_صلاحية_tbl,
  العمولات_tbl,
  العمولات_الخارجية_tbl,
  MarqueeMessage,
  DbResult,
  DashboardNote,
  SystemReminder,
  ClientInteraction,
  FollowUpTask,
  PropertyInspection,
  ReferenceType,
  سجل_الملكية_tbl,
} from '../types';
import { storage } from '@/services/storage';
import { isTenancyRelevant, pickBestTenancyContract } from '@/utils/tenancy';
import { computeEmployeeCommission, getRentalTier } from '@/utils/employeeCommission';
import { isSuperAdmin, normalizeRole } from '@/utils/roles';
import { formatCurrencyJOD } from '@/utils/format';
import { hashPassword, isHashedPassword, verifyPassword } from '@/services/passwordHash';

export { INSTALLMENT_STATUS, type InstallmentStatusType } from './db/installmentConstants';
import { INSTALLMENT_STATUS } from './db/installmentConstants';
import { buildCache, DbCache } from './dbCache';
import { KEYS } from './db/keys';
import { get, save } from './db/kv';
import { createContractWrites, getContracts, getContractDetails } from './db/contracts';
import {
  createInstallmentPaymentHandlers,
  generateContractInstallmentsInternal,
  getInstallmentPaymentSummary,
  getInstallmentPaidAndRemaining,
} from './db/installments';
import { getSettings, saveSettings } from './db/settings';
import {
  getSalesListings,
  createSalesListing,
  cancelOpenSalesListingsForProperty,
  getSalesOffers,
  submitSalesOffer,
  updateOfferStatus,
  getSalesAgreements,
  updateSalesAgreement,
  deleteSalesAgreement,
  createSalesAgreement,
} from './db/sales';
import { validateAllData } from '@/services/dataValidation';
import { purgeRefs, isDesktop, getDesktopBridge } from './db/refs';
import { makeCascadeDeletes } from './db/cascade';
import {
  createMarqueeActionSanitizers,
  getActiveMarqueeAdsInternal,
  getNonExpiredMarqueeAdsInternal,
  type MarqueeAdRecord,
} from './db/marqueeInternal';
import { buildAttachmentEntityFolder } from './db/attachmentPaths';
import {
  stableAlertId,
  buildContractAlertContext,
  upsertAlert,
  markAlertsReadByPrefix,
} from './db/alertsCore';
import { createHandleSmartEngine } from './db/smartEngineBridge';
import {
  addNotificationSendLogInternal,
  deleteNotificationSendLogInternal,
  getPaymentNotificationTargetsInternal,
  updateNotificationSendLogInternal,
  type NotificationSendLogRecord,
} from './db/paymentNotifications';
import { createBackgroundScansRuntime } from './db/backgroundScans';
import { runInitData } from './db/initData';
import { resetOperationalData } from './db/resetOperationalData';
import { lookupKeyFor, normKeySimple } from './db/lookupKeys';
import { MOCK_REPORTS } from './db/mockDbConstants';
import { getProperties, addProperty, updateProperty, getPropertyDetails } from './db/properties';
import {
  addPersonWithAutoLinkInternal,
  updatePersonWithAutoLinkInternal,
  upsertContactBookInternal,
  getContactsDirectoryInternal,
  getContactsBook,
  getPeople,
  getPersonById,
  getPersonRoles,
  updatePersonRoles,
  getPersonDetails,
  getPersonBlacklistStatus,
  getBlacklist,
  getBlacklistRecord,
  addToBlacklist,
  updateBlacklistRecord,
  removeFromBlacklist,
  generateWhatsAppLink,
} from './db/people';

export {
  getPeople,
  getPersonById,
  getPersonRoles,
  updatePersonRoles,
  addPerson,
  updatePerson,
  deletePerson,
  getPersonDetails,
  getPersonBlacklistStatus,
  getBlacklist,
  getBlacklistRecord,
  addToBlacklist,
  updateBlacklistRecord,
  removeFromBlacklist,
  generateWhatsAppLink,
} from './db/people';

export {
  getProperties,
  addProperty,
  updateProperty,
  deleteProperty,
  getPropertyDetails,
} from './db/properties';

export type {
  PaymentDueItem,
  PaymentNotificationTarget,
  NotificationSendLogRecord,
} from './db/paymentNotifications';

type UnknownRecord = Record<string, unknown>;

const isUnknownRecord = (value: unknown): value is UnknownRecord => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const asUnknownRecord = (value: unknown): UnknownRecord => {
  return (isUnknownRecord(value) ? value : Object.create(null)) as UnknownRecord;
};

// --- Aggregation wiring (domain logic under src/services/db/) ---
type LogMeta = {
  ipAddress?: string;
  deviceInfo?: string;
};

const logOperationInternal = (
  user: string,
  action: string,
  table: string,
  recordId: string,
  details: string,
  meta?: LogMeta
) => {
  const logs = get<العمليات_tbl>(KEYS.LOGS);
  const newLog: العمليات_tbl = {
    id: Math.random().toString(36).substr(2, 9),
    اسم_المستخدم: user || 'System',
    نوع_العملية: action,
    اسم_الجدول: table,
    رقم_السجل: recordId,
    تاريخ_العملية: new Date().toISOString(),
    details: details,
    ipAddress: meta?.ipAddress,
    deviceInfo: meta?.deviceInfo,
  };
  save(KEYS.LOGS, [...logs, newLog]);
};

const {
  deletePersonCascadeInternal,
  deletePropertyCascadeInternal,
  deleteContractCascadeInternal,
} = makeCascadeDeletes(logOperationInternal);

const fail = <T>(message: string): DbResult<T> => ({ success: false, message });
const ok = <T>(data?: T, message = 'تمت العملية بنجاح'): DbResult<T> => ({
  success: true,
  message,
  data,
});

const formatDateOnly = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDateOnly = (iso: string) => {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};
const daysBetweenDateOnly = (from: Date, to: Date) => {
  const a = toDateOnly(from).getTime();
  const b = toDateOnly(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

const addMonthsDateOnly = (isoDate: string, months: number) => {
  const d = parseDateOnly(isoDate);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setMonth(next.getMonth() + months);
  return next;
};

const addDaysIso = (isoDate: string, days: number) => {
  const d = parseDateOnly(isoDate);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return formatDateOnly(d);
};

const handleSmartEngine = createHandleSmartEngine(asUnknownRecord);

const contractWrites = createContractWrites({
  logOperation: logOperationInternal,
  handleSmartEngine,
  formatDateOnly,
  addDaysIso,
  addMonthsDateOnly,
});

const backgroundScans = createBackgroundScansRuntime({
  asUnknownRecord,
  toDateOnly,
  formatDateOnly,
  parseDateOnly,
  daysBetweenDateOnly,
  addDaysIso,
  addMonthsDateOnly,
  createContract: contractWrites.createContract,
  logOperationInternal,
});

const {
  dedupeAndCleanupAlertsInternal,
  runInstallmentReminderScanInternal,
  runAutoRenewContractsInternal,
  runDataQualityScanInternal,
  runExpiryScanInternal,
  runRiskScanInternal,
} = backgroundScans;

const updateTenantRatingImpl = (tenantId: string, paymentType: 'full' | 'partial' | 'late') => {
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const idx = people.findIndex((p) => p.رقم_الشخص === tenantId);
  if (idx === -1) return;

  const person = people[idx];
  const oldPoints = person.تصنيف_السلوك?.points ?? 100;
  const oldType = person.تصنيف_السلوك?.type ?? 'جديد';

  if (!person.تصنيف_السلوك) {
    person.تصنيف_السلوك = { type: 'جيد', points: 100, history: [] };
  }

  let pointsChange = 0;
  if (paymentType === 'full') {
    pointsChange = 5;
    person.تصنيف_السلوك.points = Math.min(100, person.تصنيف_السلوك.points + 5);
  } else if (paymentType === 'partial') {
    pointsChange = -10;
    person.تصنيف_السلوك.points = Math.max(0, person.تصنيف_السلوك.points - 10);
  } else if (paymentType === 'late') {
    pointsChange = -20;
    person.تصنيف_السلوك.points = Math.max(0, person.تصنيف_السلوك.points - 20);
  }

  const pts = person.تصنيف_السلوك.points;
  if (pts >= 90) person.تصنيف_السلوك.type = 'ممتاز';
  else if (pts >= 70) person.تصنيف_السلوك.type = 'جيد';
  else if (pts >= 50) person.تصنيف_السلوك.type = 'متوسط';
  else if (pts >= 30) person.تصنيف_السلوك.type = 'ضعيف';
  else person.تصنيف_السلوك.type = 'سيء';

  if (!Array.isArray(person.تصنيف_السلوك.history)) person.تصنيف_السلوك.history = [];
  person.تصنيف_السلوك.history.push({
    date: formatDateOnly(toDateOnly(new Date())),
    paymentType,
    pointsChange,
    points: person.تصنيف_السلوك.points,
  });

  people[idx] = person;
  save(KEYS.PEOPLE, people);

  const ratingDesc = `تحديث تصنيف السلوك - من ${oldType} (${oldPoints}) إلى ${person.تصنيف_السلوك.type} (${person.تصنيف_السلوك.points}) - التغيير: ${pointsChange > 0 ? '+' : ''}${pointsChange} نقاط (${paymentType === 'full' ? 'سداد كامل' : paymentType === 'partial' ? 'سداد جزئي' : 'سداد متأخر'})`;
  logOperationInternal('System', 'تحديث التصنيف', 'People', tenantId, ratingDesc);
};

const installmentPayments = createInstallmentPaymentHandlers({
  logOperation: logOperationInternal,
  markAlertsReadByPrefix,
  updateTenantRating: updateTenantRatingImpl,
});

const initData = async () => {
  await runInitData({ dedupeAndCleanupAlertsInternal });
};

initData();

export const DbService = {
  refreshFromServer: () => initData(),

  logEvent: (user: string, action: string, table: string, details: string) => {
    logOperationInternal(user, action, table, 'N/A', details);
  },

  // People domain: ./db/people (+ cascade delete stays here)
  getPeople,
  getPersonById,
  getPersonRoles,
  updatePersonRoles,
  addPerson: (data: Omit<الأشخاص_tbl, 'رقم_الشخص'>, roles: string[]) =>
    addPersonWithAutoLinkInternal(data, roles),
  updatePerson: (id: string, patch: Partial<الأشخاص_tbl>) =>
    updatePersonWithAutoLinkInternal(id, patch),
  deletePerson: deletePersonCascadeInternal,
  getPersonDetails,
  getPersonBlacklistStatus,
  getBlacklist,
  getBlacklistRecord,
  addToBlacklist,
  updateBlacklistRecord,
  removeFromBlacklist,
  generateWhatsAppLink,

  // Contacts book (local-only phonebook entries that do NOT have to exist in People)
  getContacts: () => getContactsBook(),
  upsertContact: (payload: { name: string; phone: string; extraPhone?: string }) =>
    upsertContactBookInternal(payload),
  getContactsDirectory: () => getContactsDirectoryInternal(),

  // Phase 3A Part 2: Properties domain functions (re-exported from propertiesService.ts)
  getProperties,
  addProperty,
  updateProperty,
  deleteProperty: deletePropertyCascadeInternal,
  getPropertyDetails,

  // Contract writes / cascade remain in mockDb; reads in ./db/contracts
  getContracts,
  getInstallments: () => get<الكمبيالات_tbl>(KEYS.INSTALLMENTS),
  getCommissions: () => get<العمولات_tbl>(KEYS.COMMISSIONS),

  updateCommission: (id: string, patch: Partial<العمولات_tbl>): DbResult<العمولات_tbl> => {
    const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const idx = all.findIndex((c) => c.رقم_العمولة === id);
    if (idx === -1) return fail('العمولة غير موجودة');

    const next: العمولات_tbl = {
      ...all[idx],
      ...patch,
    };

    // ✅ حسب المواصفة: اعتماد الحساب على شهر/تاريخ العمولة.
    // نُبقي شهر_دفع_العمولة بصيغة YYYY-MM فقط، ونشتقه من تاريخ_العقد (تاريخ العملية/العمولة) إذا كان فارغاً.
    const paidMonthRaw = String(next.شهر_دفع_العمولة ?? '').trim();
    if (paidMonthRaw && !/^\d{4}-\d{2}$/.test(paidMonthRaw)) {
      next.شهر_دفع_العمولة = undefined;
    }
    if (!String(next.شهر_دفع_العمولة ?? '').trim()) {
      const d = String(next.تاريخ_العقد ?? '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) next.شهر_دفع_العمولة = d.slice(0, 7);
      else if (/^\d{4}-\d{2}$/.test(d)) next.شهر_دفع_العمولة = d;
    }

    next.عمولة_المالك = Number(next.عمولة_المالك || 0);
    next.عمولة_المستأجر = Number(next.عمولة_المستأجر || 0);
    next.المجموع = Number(next.عمولة_المالك || 0) + Number(next.عمولة_المستأجر || 0);

    const updated = [...all];
    updated[idx] = next;
    save(KEYS.COMMISSIONS, updated);

    // Keep contract opportunity number in sync when edited from commissions UI
    if (Object.prototype.hasOwnProperty.call(patch, 'رقم_الفرصة')) {
      const contractId = String(next.رقم_العقد || '').trim();
      if (contractId) {
        const oppRaw = String(patch.رقم_الفرصة ?? '').trim();
        const allContracts = get<العقود_tbl>(KEYS.CONTRACTS);
        const cIdx = allContracts.findIndex((c) => c.رقم_العقد === contractId);
        if (cIdx > -1) {
          const nextContracts = [...allContracts];
          nextContracts[cIdx] = {
            ...nextContracts[cIdx],
            رقم_الفرصة: oppRaw || undefined,
          };
          save(KEYS.CONTRACTS, nextContracts);
        }
      }
    }

    logOperationInternal('Admin', 'تعديل', 'Commissions', id, `تعديل عمولة عقد: ${next.رقم_العقد}`);
    return ok(next);
  },

  postponeCommissionCollection: (
    commissionId: string,
    newDate: string,
    target?: 'Owner' | 'Tenant',
    note?: string
  ): DbResult<العمولات_tbl> => {
    const date = String(newDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('تاريخ غير صالح');

    const who: العمولات_tbl['جهة_تحصيل_مؤجل'] =
      target === 'Tenant' ? 'مستأجر' : target === 'Owner' ? 'مالك' : undefined;

    const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const idx = all.findIndex((c) => c.رقم_العمولة === commissionId);
    if (idx === -1) return fail('العمولة غير موجودة');

    // ✅ حسب المطلوب: إذا صار التحصيل بشهر جديد، تُحسب ضمن الشهر الجديد.
    // لذلك نُحدّث شهر_دفع_العمولة وتاريخ_العقد (المستخدم كتاريخ عمولة/عملية).
    const next: العمولات_tbl = {
      ...all[idx],
      تاريخ_تحصيل_مؤجل: date,
      جهة_تحصيل_مؤجل: who,
      شهر_دفع_العمولة: date.slice(0, 7),
      تاريخ_العقد: date,
    };
    const updated = [...all];
    updated[idx] = next;
    save(KEYS.COMMISSIONS, updated);

    const contractId = String(next.رقم_العقد || '').trim();
    const title = `تحصيل عمولة${who ? ` (${who})` : ''} عقد #${contractId}`;
    DbService.addReminder({ title, date, type: 'Payment' });

    const msg = `تم تأجيل تحصيل عمولة${who ? ` (${who})` : ''} عقد #${contractId} إلى ${date}${note ? ` — ${String(note).trim()}` : ''}`;
    DbService.createAlert(
      'تأجيل تحصيل',
      msg,
      'Financial',
      undefined,
      buildContractAlertContext(contractId)
    );

    logOperationInternal('Admin', 'تأجيل تحصيل', 'Commissions', commissionId, msg);
    return ok(next);
  },

  postponeInstallmentCollection: (
    installmentId: string,
    newDueDate: string,
    note?: string
  ): DbResult<الكمبيالات_tbl> => {
    const date = String(newDueDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('تاريخ غير صالح');

    const all = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const idx = all.findIndex((i) => i.رقم_الكمبيالة === installmentId);
    if (idx === -1) return fail('الكمبيالة غير موجودة');

    const inst = JSON.parse(JSON.stringify(all[idx])) as الكمبيالات_tbl;
    const oldDate = String(inst.تاريخ_استحقاق || '').trim();
    inst.تاريخ_استحقاق = date;

    // Persist explicit deferral metadata
    const now = new Date().toISOString().split('T')[0];
    inst.تاريخ_التأجيل = now;
    inst.تاريخ_الاستحقاق_السابق = oldDate || undefined;
    const extra = (note || '').trim();
    const line = `تأجيل تحصيل: من ${oldDate || '-'} إلى ${date}${extra ? ` | ${extra}` : ''}`;
    inst.ملاحظات = (inst.ملاحظات || '').trim();
    inst.ملاحظات += (inst.ملاحظات ? '\n' : '') + `[${now}] ${line}`;

    all[idx] = inst;
    save(KEYS.INSTALLMENTS, all);

    const contractId = String(inst.رقم_العقد || '').trim();
    const title = `تحصيل دفعة مؤجلة (عقد #${contractId}) — مؤجل بتاريخ ${now}`;
    DbService.addReminder({ title, date, type: 'Payment' });

    const msg = `تم تأجيل تحصيل دفعة لعقد #${contractId} من ${oldDate || '-'} إلى ${date} (تاريخ التأجيل: ${now})${extra ? ` — ${extra}` : ''}`;
    DbService.createAlert('تأجيل تحصيل', msg, 'Financial', undefined, {
      ...buildContractAlertContext(contractId),
      مرجع_الجدول: 'الكمبيالات_tbl',
      مرجع_المعرف: String(installmentId),
    });

    logOperationInternal('Admin', 'تأجيل تحصيل', 'الكمبيالات', installmentId, msg);
    return ok(inst);
  },

  upsertCommissionForContract: (
    contractId: string,
    values: {
      commOwner: number;
      commTenant: number;
      commissionPaidMonth?: string;
      employeeUsername?: string;
    }
  ): DbResult<العمولات_tbl> => {
    const contract = get<العقود_tbl>(KEYS.CONTRACTS).find((c) => c.رقم_العقد === contractId);
    if (!contract) return fail('العقد غير موجود');

    const commOwner = Number(values.commOwner || 0);
    const commTenant = Number(values.commTenant || 0);
    const now = new Date();
    const nowYMD = now.toISOString().slice(0, 10);
    const nowYM = now.toISOString().slice(0, 7);
    const month =
      values.commissionPaidMonth && /^\d{4}-\d{2}$/.test(String(values.commissionPaidMonth))
        ? String(values.commissionPaidMonth)
        : nowYM;

    const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const existing = all.find((c) => c.رقم_العقد === contractId);

    const employeeUsername = String(values.employeeUsername || '').trim() || undefined;

    if (existing) {
      const patch: Partial<العمولات_tbl> & { اسم_المستخدم?: string } = {
        عمولة_المالك: commOwner,
        عمولة_المستأجر: commTenant,
        شهر_دفع_العمولة: month,
      };
      if (employeeUsername) patch.اسم_المستخدم = employeeUsername;
      return DbService.updateCommission(existing.رقم_العمولة, patch);
    }

    const record: العمولات_tbl & { اسم_المستخدم?: string } = {
      رقم_العمولة: `COM-${contractId}`,
      رقم_العقد: contractId,
      // تاريخ_العقد هنا = تاريخ العملية/العمولة (وليس تاريخ العقد)
      تاريخ_العقد: nowYMD,
      شهر_دفع_العمولة: month,
      عمولة_المالك: commOwner,
      عمولة_المستأجر: commTenant,
      المجموع: commOwner + commTenant,
    };
    if (employeeUsername) record.اسم_المستخدم = employeeUsername;

    save(KEYS.COMMISSIONS, [...all, record]);
    logOperationInternal(
      'Admin',
      'إضافة',
      'Commissions',
      record.رقم_العمولة,
      `إنشاء عمولة عقد: ${contractId}`
    );
    return ok(record);
  },

  deleteCommission: (id: string): DbResult<null> => {
    const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const target = all.find((c) => c.رقم_العمولة === id);
    if (!target) return ok();

    save(
      KEYS.COMMISSIONS,
      all.filter((c) => c.رقم_العمولة !== id)
    );
    logOperationInternal('Admin', 'حذف', 'Commissions', id, `حذف عمولة عقد: ${target.رقم_العقد}`);
    return ok();
  },

  getLogs: () => get<العمليات_tbl>(KEYS.LOGS),
  getSystemUsers: () =>
    get<unknown>(KEYS.USERS).filter(
      (u): u is المستخدمين_tbl => isUnknownRecord(u) && typeof u['id'] === 'string'
    ),
  getAlerts: () => get<tbl_Alerts>(KEYS.ALERTS),

  getPaymentNotificationTargets: (daysAhead: number = 7) =>
    getPaymentNotificationTargetsInternal(daysAhead),
  getNotificationSendLogs: () => get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS),
  addNotificationSendLog: (log: Omit<NotificationSendLogRecord, 'id'>) =>
    addNotificationSendLogInternal(log),
  updateNotificationSendLog: (
    id: string,
    patch: Partial<Pick<NotificationSendLogRecord, 'note' | 'reply'>>
  ) => updateNotificationSendLogInternal(id, patch),
  deleteNotificationSendLog: (id: string) => deleteNotificationSendLogInternal(id),

  // Create alert with optional callback for notifications
  createAlert: (
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

      // Hard guarantee: every alert has a source.
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
  },

  clearOldAlerts: (daysOld: number = 30): void => {
    const alerts = get<tbl_Alerts>(KEYS.ALERTS);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const filtered = alerts.filter((a) => {
      const alertDate = new Date(a.تاريخ_الانشاء);
      return alertDate > cutoffDate;
    });

    save(KEYS.ALERTS, filtered);
  },

  getLookupsByCategory: (cat: string) => {
    const targetCat = String(cat || '').trim();
    if (!targetCat) return [];

    const rawAll = get<SystemLookup>(KEYS.LOOKUPS);
    const byKey = new Map<string, SystemLookup>();
    const outAll: SystemLookup[] = [];

    const ensureId = () => `LK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (const l of rawAll) {
      const category = String(l?.category || '').trim();
      const label = String(l?.label || '').trim();
      if (!category || !label) continue;

      const key = String(l?.key || lookupKeyFor(category, label) || '').trim() || undefined;
      const normalized: SystemLookup = {
        ...l,
        id: String(l?.id || '').trim() || ensureId(),
        category,
        label,
        key,
      };

      const dkey = `${normKeySimple(category)}||${normKeySimple(key) || normKeySimple(label)}`;
      if (!dkey || dkey === '||') continue;

      const prev = byKey.get(dkey);
      if (!prev) {
        byKey.set(dkey, normalized);
        outAll.push(normalized);
        continue;
      }

      // Prefer system lookup if there is a conflict.
      const prevSystem = prev.isSystem === true;
      const curSystem = normalized.isSystem === true;
      if (!prevSystem && curSystem) {
        byKey.set(dkey, normalized);
        const idx = outAll.findIndex((x) => x === prev);
        if (idx >= 0) outAll[idx] = normalized;
      }
    }

    if (outAll.length !== rawAll.length) {
      save(KEYS.LOOKUPS, outAll);
    }

    return outAll.filter((l) => l.category === targetCat);
  },
  addLookup: (category: string, label: string) => {
    const cat = String(category || '').trim();
    const lab = String(label || '').trim();
    if (!cat || !lab) return;
    const all = get<SystemLookup>(KEYS.LOOKUPS);

    const key = lookupKeyFor(cat, lab);
    const exists = all.some(
      (x) =>
        String(x.category || '').trim() === cat &&
        (normKeySimple(x.label) === normKeySimple(lab) ||
          (!!key && normKeySimple(x.key) === normKeySimple(key)))
    );
    if (exists) return;

    save(KEYS.LOOKUPS, [...all, { id: `LK-${Date.now()}`, category: cat, label: lab, key }]);
    logOperationInternal('Admin', 'إضافة', 'Lookups', category, `إضافة عنصر: ${label}`);
  },
  deleteLookup: (id: string) => {
    const all = get<SystemLookup>(KEYS.LOOKUPS).filter((l) => l.id !== id);
    save(KEYS.LOOKUPS, all);
    logOperationInternal('Admin', 'حذف', 'Lookups', id, 'حذف عنصر قائمة');
  },
  getLookupCategories: () => {
    const raw = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
    const byKey = new Map<string, LookupCategory>();
    const out: LookupCategory[] = [];

    for (const c of raw) {
      const id = String(c?.id || '').trim();
      const name = String(c?.name || id).trim();
      const label = String(c?.label || name).trim();
      const key = String(c?.key || name || id).trim();
      if (!name || !label) continue;

      const normalized: LookupCategory = {
        ...c,
        id: id || name,
        name,
        label,
        key,
      };

      const dkey = normKeySimple(key) || normKeySimple(name) || normKeySimple(id);
      if (!dkey) continue;

      const prev = byKey.get(dkey);
      if (!prev) {
        byKey.set(dkey, normalized);
        out.push(normalized);
        continue;
      }

      const prevSystem = prev.isSystem === true;
      const curSystem = normalized.isSystem === true;
      if (!prevSystem && curSystem) {
        byKey.set(dkey, normalized);
        const idx = out.findIndex((x) => x === prev);
        if (idx >= 0) out[idx] = normalized;
      }
    }

    if (out.length !== raw.length) {
      save(KEYS.LOOKUP_CATEGORIES, out);
    }

    return out;
  },
  addLookupCategory: (name: string, label: string): DbResult<null> => {
    const all = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
    if (all.some((c) => c.name === name)) return fail('المعرف البرمجي موجود مسبقاً');
    save(KEYS.LOOKUP_CATEGORIES, [...all, { id: name, name, key: name, label, isSystem: false }]);
    logOperationInternal(
      'Admin',
      'إضافة فئة',
      'LookupCategories',
      name,
      `إنشاء جدول بيانات جديد: ${label}`
    );
    return ok();
  },
  updateLookupCategory: (id: string, data: Partial<LookupCategory>): DbResult<null> => {
    const all = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
    const idx = all.findIndex((c) => c.id === id);
    if (idx > -1) {
      const oldLabel = all[idx].label;
      all[idx] = { ...all[idx], ...data };
      save(KEYS.LOOKUP_CATEGORIES, all);
      logOperationInternal(
        'Admin',
        'تعديل فئة',
        'LookupCategories',
        id,
        `تحديث اسم الجدول من "${oldLabel}" إلى "${data.label}"`
      );
      return ok();
    }
    return fail('الجدول غير موجود');
  },
  deleteLookupCategory: (id: string): DbResult<null> => {
    const all = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES).filter((c) => c.id !== id);
    save(KEYS.LOOKUP_CATEGORIES, all);
    const lookups = get<SystemLookup>(KEYS.LOOKUPS).filter((l) => l.category !== id);
    save(KEYS.LOOKUPS, lookups);
    logOperationInternal(
      'Admin',
      'حذف فئة',
      'LookupCategories',
      id,
      `حذف جدول البيانات "${id}" وكافة عناصره`
    );
    return ok();
  },
  importLookups: (category: string, items: string[]) => {
    const cat = String(category || '').trim();
    if (!cat) return;
    const all = get<SystemLookup>(KEYS.LOOKUPS);
    const seen = new Set<string>();

    const incoming = (Array.isArray(items) ? items : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .filter((lab) => {
        const k = normKeySimple(lab);
        if (!k) return false;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

    const existingKeys = new Set(
      all
        .filter((x) => String(x.category || '').trim() === cat)
        .map((x) => normKeySimple(x.key) || normKeySimple(x.label))
        .filter(Boolean)
    );

    const newItems = incoming
      .map((lab) => {
        const key = lookupKeyFor(cat, lab);
        const dkey = normKeySimple(key) || normKeySimple(lab);
        if (!dkey || existingKeys.has(dkey)) return null;
        existingKeys.add(dkey);
        return {
          id: `LK-${Math.random().toString(36).slice(2, 11)}`,
          category: cat,
          label: lab,
          key,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    if (newItems.length === 0) return;
    save(KEYS.LOOKUPS, [...all, ...newItems]);
    logOperationInternal('Admin', 'استيراد', 'Lookups', category, `استيراد ${items.length} عنصر`);
  },

  createContract: contractWrites.createContract,
  updateContract: contractWrites.updateContract,

  previewContractInstallments: (
    data: Partial<العقود_tbl>
  ): DbResult<{ installments: الكمبيالات_tbl[] }> => {
    const contractId = `PREVIEW-${Date.now()}`;
    const contract = {
      ...data,
      رقم_العقد: contractId,
    } as العقود_tbl;

    const res = generateContractInstallmentsInternal(contract, contractId);
    if (!res.success || !res.data) return fail(res.message || 'تعذر توليد الدفعات');
    return ok({ installments: res.data });
  },
  getContractDetails,
  archiveContract: contractWrites.archiveContract,
  terminateContract: contractWrites.terminateContract,

  setContractAutoRenew: (id: string, enabled: boolean): DbResult<null> => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const idx = all.findIndex((c) => c.رقم_العقد === id);
    if (idx === -1) return fail('العقد غير موجود');
    all[idx].autoRenew = enabled;
    save(KEYS.CONTRACTS, all);
    logOperationInternal(
      'Admin',
      'تعديل',
      'Contracts',
      id,
      `تجديد تلقائي: ${enabled ? 'مفعل' : 'متوقف'}`
    );
    return ok();
  },

  renewContract: contractWrites.renewContract,

  deleteContract: deleteContractCascadeInternal,
  getClearanceRecord: (contractId: string) => {
    return get<ClearanceRecord>(KEYS.CLEARANCE_RECORDS).find((r) => r.contractId === contractId);
  },

  markInstallmentPaid: installmentPayments.markInstallmentPaid,
  updateTenantRating: updateTenantRatingImpl,
  setInstallmentLateFee: installmentPayments.setInstallmentLateFee,

  updateInstallmentDynamicFields: (
    installmentId: string,
    userId: string,
    role: RoleType,
    dynamicFields: Record<string, unknown> | null | undefined
  ): DbResult<null> => {
    const ALLOWED_ROLES: RoleType[] = ['SuperAdmin', 'Admin'];
    if (!ALLOWED_ROLES.includes(role)) {
      return fail(`الصلاحية غير كافية (${role}): يُسمح فقط بـ ${ALLOWED_ROLES.join(', ')}`);
    }

    const all = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const idx = all.findIndex((i) => i.رقم_الكمبيالة === installmentId);
    if (idx === -1) return fail('الكمبيالة غير موجودة');

    const inst = JSON.parse(JSON.stringify(all[idx])) as الكمبيالات_tbl;
    const cleaned: Record<string, unknown> =
      dynamicFields && typeof dynamicFields === 'object' ? dynamicFields : {};
    const hasAny = Object.keys(cleaned).length > 0;
    asUnknownRecord(inst)['حقول_ديناميكية'] = hasAny ? cleaned : undefined;

    all[idx] = inst;
    save(KEYS.INSTALLMENTS, all);

    logOperationInternal(
      userId,
      'تحديث حقول ديناميكية',
      'الكمبيالات',
      installmentId,
      `[${role}] ${userId} - تحديث الحقول الإضافية`
    );
    return ok();
  },

  reversePayment: installmentPayments.reversePayment,

  getInstallmentPaymentSummary,

  markAllAlertsAsRead: () => {
    const all = get<tbl_Alerts>(KEYS.ALERTS);
    all.forEach((a) => (a.تم_القراءة = true));
    save(KEYS.ALERTS, all);
  },
  markAlertAsRead: (id: string) => {
    const all = get<tbl_Alerts>(KEYS.ALERTS);
    const idx = all.findIndex((a) => a.id === id);
    if (idx > -1) {
      all[idx].تم_القراءة = true;
      save(KEYS.ALERTS, all);
    }
  },
  markMultipleAlertsAsRead: (ids: string[]) => {
    const all = get<tbl_Alerts>(KEYS.ALERTS);
    all.forEach((a) => {
      if (ids.includes(a.id)) a.تم_القراءة = true;
    });
    save(KEYS.ALERTS, all);
  },

  getDashboardConfig: (userId: string) => {
    const configs = get<unknown>(KEYS.DASHBOARD_CONFIG).filter(isUnknownRecord);
    return configs.find((c) => String(c.userId) === userId) || null;
  },
  saveDashboardConfig: (userId: string, config: Record<string, unknown>) => {
    const configs = get<unknown>(KEYS.DASHBOARD_CONFIG)
      .filter(isUnknownRecord)
      .filter((c) => String(c.userId) !== userId);
    save(KEYS.DASHBOARD_CONFIG, [...configs, { userId, ...config }]);
  },
  getAdminAnalytics: () => DbCache.dashboardStats,

  // --- Security helpers (Marquee) ---
  // Marquee content is user-controlled (and may arrive via sync). Today it's rendered as plain text,
  // but we still sanitize to prevent:
  // - future HTML sinks (XSS)
  // - bidi/control-char spoofing
  // - prototype pollution via action.options
  // Keep this logic local and conservative.

  // Allowed panel IDs (matches src/context/ModalContext.tsx PanelType)
  // Note: keep in sync if new panels are added.
  // We intentionally do not allow arbitrary panel names from synced data.

  _marqueeAllowedPanels: [
    'PERSON_DETAILS',
    'PROPERTY_DETAILS',
    'CONTRACT_DETAILS',
    'INSTALLMENT_DETAILS',
    'MAINTENANCE_DETAILS',
    'GENERIC_ALERT',
    'REPORT_VIEWER',
    'LEGAL_NOTICE_GENERATOR',
    'BULK_WHATSAPP',
    'CONFIRM_MODAL',
    'SALES_LISTING_DETAILS',
    'CLEARANCE_REPORT',
    'CLEARANCE_WIZARD',
    'PERSON_FORM',
    'PROPERTY_FORM',
    'CONTRACT_FORM',
    'INSPECTION_FORM',
    'BLACKLIST_FORM',
    'SMART_PROMPT',
    'CALENDAR_EVENTS',
    'PAYMENT_NOTIFICATIONS',
    'SECTION_VIEW',
    'SERVER_DRAWER',
    'SQL_SYNC_LOG',
    'MARQUEE_ADS',
  ] as const,

  // --- Marquee Ads (Custom) ---
  getMarqueeAds: (): MarqueeAdRecord[] => {
    return getNonExpiredMarqueeAdsInternal().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
  addMarqueeAd: (data: {
    content: string;
    durationHours: number;
    priority?: 'Normal' | 'High';
    type?: 'alert' | 'info' | 'success';
    action?: MarqueeMessage['action'];
  }): DbResult<string> => {
    const { sanitizeMarqueeText, sanitizeAction } = createMarqueeActionSanitizers(
      DbService._marqueeAllowedPanels
    );

    const content = sanitizeMarqueeText(data?.content, 300);
    if (!content) return fail('نص الإعلان مطلوب');

    const hours = Number(data?.durationHours);
    // Allow 0 => permanent (no expiry)
    if (!Number.isFinite(hours) || hours < 0) return fail('مدة الظهور غير صحيحة');
    const hoursClamped = Math.min(hours, 24 * 365 * 5); // cap at 5 years

    const now = Date.now();
    const expiresAt =
      hoursClamped > 0 ? new Date(now + hoursClamped * 60 * 60 * 1000).toISOString() : undefined;
    const ad: MarqueeAdRecord = {
      id: `MAR-${now}`,
      content,
      priority: data.priority || 'Normal',
      type: data.type || 'info',
      createdAt: new Date(now).toISOString(),
      expiresAt,
      enabled: true,
      action: sanitizeAction(data?.action),
    };

    const existing = getNonExpiredMarqueeAdsInternal();
    save(KEYS.MARQUEE, [ad, ...existing]);
    try {
      window.dispatchEvent(new Event('azrar:marquee-changed'));
    } catch {
      void 0;
    }
    return ok(ad.id);
  },
  updateMarqueeAd: (
    id: string,
    patch: Partial<
      Pick<MarqueeAdRecord, 'content' | 'priority' | 'type' | 'expiresAt' | 'enabled'>
    > & { action?: MarqueeMessage['action'] | null }
  ): DbResult<null> => {
    const all = getNonExpiredMarqueeAdsInternal();
    const idx = all.findIndex((a) => String(a.id) === String(id));
    if (idx < 0) return fail('الإعلان غير موجود');

    const next = { ...all[idx] } as MarqueeAdRecord;

    const { sanitizeMarqueeText, sanitizeAction } = createMarqueeActionSanitizers(
      DbService._marqueeAllowedPanels
    );

    if (typeof patch.content === 'string') {
      const content = sanitizeMarqueeText(patch.content, 300);
      if (!content) return fail('نص الإعلان مطلوب');
      next.content = content;
    }
    if (patch.priority === 'Normal' || patch.priority === 'High') next.priority = patch.priority;
    if (patch.type === 'alert' || patch.type === 'info' || patch.type === 'success')
      next.type = patch.type;
    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
    if (typeof patch.expiresAt !== 'undefined') {
      const exp = String(patch.expiresAt || '').trim();
      next.expiresAt = exp ? exp : undefined;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'action')) {
      const a = patch.action as MarqueeMessage['action'] | null | undefined;
      if (a === null) {
        next.action = undefined;
      } else if (!a) {
        next.action = undefined;
      } else {
        next.action = sanitizeAction(a);
      }
    }

    const updated = [...all];
    updated[idx] = next;
    save(KEYS.MARQUEE, updated);
    try {
      window.dispatchEvent(new Event('azrar:marquee-changed'));
    } catch {
      void 0;
    }
    return ok();
  },
  deleteMarqueeAd: (id: string): DbResult<null> => {
    const all = get<MarqueeAdRecord>(KEYS.MARQUEE);
    const next = all.filter((a) => String(a.id) !== String(id));
    save(KEYS.MARQUEE, next);
    try {
      window.dispatchEvent(new Event('azrar:marquee-changed'));
    } catch {
      void 0;
    }
    return ok();
  },

  getMarqueeMessages: (): MarqueeMessage[] => {
    const messages: MarqueeMessage[] = [];

    const { sanitizeMarqueeText, sanitizeAction } = createMarqueeActionSanitizers(
      DbService._marqueeAllowedPanels
    );

    // 0) Custom ads (user-added, time-bound)
    try {
      const ads = getActiveMarqueeAdsInternal();
      for (const ad of ads.slice(0, 10)) {
        const content = sanitizeMarqueeText(ad.content, 300);
        if (!content) continue;
        const action = ad.action ? sanitizeAction(ad.action) : undefined;
        messages.push({
          id: `ad_${ad.id}`,
          content,
          priority: ad.priority === 'High' ? 'High' : 'Normal',
          type: ad.type === 'alert' || ad.type === 'success' ? ad.type : 'info',
          ...(action ? { action } : {}),
        });
      }
    } catch {
      // ignore
    }

    const todayYMD = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();

    const isYmdBefore = (a: string, b: string) => String(a || '') < String(b || '');

    // 1) Urgent unread alerts
    try {
      const unreadCritical = (get<tbl_Alerts>(KEYS.ALERTS) || [])
        .filter((a) => !a.تم_القراءة)
        .filter((a) => a.category === 'Financial' || a.category === 'Risk');

      const criticalCount = unreadCritical.length;

      if (criticalCount > 0) {
        messages.push({
          id: 'alerts_unread',
          content: `🔔 لديك ${criticalCount} تنبيه حرِج غير مقروء`,
          priority: 'High',
          type: 'alert',
          action: { kind: 'hash', hash: '/alerts' },
        });

        // Show a couple of concrete examples for quick context
        const top = unreadCritical.slice(0, 2);
        for (const a of top) {
          const base: MarqueeMessage = {
            id: `alert_${a.id}`,
            content: `تنبيه: ${String(a.الوصف || '').trim()}`,
            priority: 'High',
            type: 'alert',
          };

          const refTable = String(a.مرجع_الجدول || '');
          const refId = String(a.مرجع_المعرف || '');
          if (refTable === 'العقود_tbl' && refId) {
            base.action = { kind: 'panel', panel: 'CONTRACT_DETAILS', id: refId };
          } else if (refTable === 'الكمبيالات_tbl') {
            base.action = { kind: 'hash', hash: '/installments?filter=all' };
          } else if (refTable === 'العقارات_tbl') {
            base.action =
              refId === 'batch'
                ? { kind: 'hash', hash: '/properties' }
                : { kind: 'panel', panel: 'PROPERTY_DETAILS', id: refId };
          } else if (refTable === 'الأشخاص_tbl') {
            base.action =
              refId === 'batch'
                ? { kind: 'hash', hash: '/people' }
                : { kind: 'panel', panel: 'PERSON_DETAILS', id: refId };
          } else {
            base.action = { kind: 'hash', hash: '/alerts' };
          }

          if (base.content !== 'تنبيه:') messages.push(base);
        }
      }
    } catch {
      // ignore
    }

    // 2) Open follow-up tasks (show ALL until completed)
    try {
      const allOpen = (get<FollowUpTask>(KEYS.FOLLOW_UPS) || [])
        .filter((f) => f.status === 'Pending')
        .slice();

      // Sort by due date (earliest first), then createdAt (newest last)
      allOpen.sort((a, b) => {
        const ad = String(a.dueDate || '');
        const bd = String(b.dueDate || '');
        if (ad !== bd) {
          if (!ad) return 1;
          if (!bd) return -1;
          return ad.localeCompare(bd);
        }
        const ac = new Date(String(a.createdAt || '')).getTime();
        const bc = new Date(String(b.createdAt || '')).getTime();
        if (Number.isFinite(ac) && Number.isFinite(bc)) return ac - bc;
        if (Number.isFinite(ac)) return -1;
        if (Number.isFinite(bc)) return 1;
        return 0;
      });

      const openCount = allOpen.length;
      const overdueCount = allOpen.filter((f) =>
        isYmdBefore(String(f.dueDate || ''), todayYMD)
      ).length;
      const firstDate = openCount > 0 ? String(allOpen[0]?.dueDate || todayYMD) : todayYMD;

      if (openCount > 0) {
        messages.push({
          id: 'tasks_open',
          content: `📝 لديك ${openCount} مهام مفتوحة${overdueCount > 0 ? ` (${overdueCount} متأخرة)` : ''}`,
          priority: overdueCount > 0 ? 'High' : 'Normal',
          type: 'info',
          action: {
            kind: 'panel',
            panel: 'CALENDAR_EVENTS',
            id: firstDate,
            options: { title: 'المهام' },
          },
        });

        for (const f of allOpen) {
          const dueDate = String(f.dueDate || '').trim();
          const overdue = dueDate ? isYmdBefore(dueDate, todayYMD) : false;
          const taskTitle = String(f.task || '').trim();
          if (!taskTitle) continue;
          messages.push({
            id: `followup_${String(f.id || dueDate || taskTitle)}`,
            content: `${overdue ? '⚠️' : '📝'} مهمة: ${taskTitle}${dueDate ? ` (موعد: ${dueDate})` : ''}`,
            priority: overdue ? 'High' : 'Normal',
            type: 'info',
            action: {
              kind: 'panel',
              panel: 'CALENDAR_EVENTS',
              id: dueDate || todayYMD,
              options: { title: 'المهام' },
            },
          });
        }
      }
    } catch {
      // ignore
    }

    // 3) Open reminders (show ALL until done)
    try {
      const allOpen = (get<SystemReminder>(KEYS.REMINDERS) || []).filter((r) => !r.isDone).slice();

      allOpen.sort((a, b) => {
        const ad = String(a.date || '');
        const bd = String(b.date || '');
        if (ad !== bd) {
          if (!ad) return 1;
          if (!bd) return -1;
          return ad.localeCompare(bd);
        }
        const at = String(a.time || '');
        const bt = String(b.time || '');
        if (at !== bt) return at.localeCompare(bt);
        const ac = new Date(String(asUnknownRecord(a)['createdAt'] || '')).getTime();
        const bc = new Date(String(asUnknownRecord(b)['createdAt'] || '')).getTime();
        if (Number.isFinite(ac) && Number.isFinite(bc)) return ac - bc;
        return 0;
      });

      const openCount = allOpen.length;
      const overdueCount = allOpen.filter((r) =>
        isYmdBefore(String(r.date || ''), todayYMD)
      ).length;
      const firstDate = openCount > 0 ? String(allOpen[0]?.date || todayYMD) : todayYMD;

      if (openCount > 0) {
        messages.push({
          id: 'reminders_open',
          content: `⏰ لديك ${openCount} تذكيرات مفتوحة${overdueCount > 0 ? ` (${overdueCount} متأخرة)` : ''}`,
          priority: overdueCount > 0 ? 'High' : 'Normal',
          type: 'info',
          action: {
            kind: 'panel',
            panel: 'CALENDAR_EVENTS',
            id: firstDate,
            options: { title: 'التذكيرات' },
          },
        });

        for (const r of allOpen) {
          const date = String(r.date || '').trim();
          const overdue = date ? isYmdBefore(date, todayYMD) : false;
          const title = String(r.title || '').trim();
          if (!title) continue;
          messages.push({
            id: `rem_${String(r.id || date || title)}`,
            content: `${overdue ? '⚠️' : '⏰'} تذكير: ${title}${date ? ` (موعد: ${date})` : ''}`,
            priority: overdue ? 'High' : 'Normal',
            type: 'info',
            action: {
              kind: 'panel',
              panel: 'CALENDAR_EVENTS',
              id: date || todayYMD,
              options: { title: 'التذكيرات' },
            },
          });
        }
      }
    } catch {
      // ignore
    }

    // 4) Installments overdue + due today (unpaid/partial)
    try {
      const norm = (v: unknown) => String(v ?? '').trim();
      const today = toDateOnly(new Date());
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter((c) => isTenancyRelevant(c));
      const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);

      const peopleById = new Map<string, الأشخاص_tbl>();
      for (const p of people) {
        if (p.رقم_الشخص) peopleById.set(p.رقم_الشخص, p);
      }

      const propsById = new Map<string, العقارات_tbl>();
      for (const pr of properties) {
        if (pr.رقم_العقار) propsById.set(pr.رقم_العقار, pr);
      }

      const contractsById = new Map<string, العقود_tbl>();
      for (const c of contracts) {
        if (c.رقم_العقد) contractsById.set(c.رقم_العقد, c);
      }

      const overdue = (installments || [])
        .filter((i) => i.isArchived !== true)
        .filter((i) => norm(i.نوع_الكمبيالة) !== 'تأمين')
        .filter((i) => {
          const status = norm(i.حالة_الكمبيالة);
          return status !== INSTALLMENT_STATUS.CANCELLED && status !== INSTALLMENT_STATUS.PAID;
        })
        .filter((i) => {
          const due = String(i.تاريخ_استحقاق || '').trim();
          return !!due && isYmdBefore(due, todayYMD);
        })
        .map((i) => {
          const pr = getInstallmentPaidAndRemaining(i);
          const due = String(i.تاريخ_استحقاق || '').trim();
          const dueDate = due ? parseDateOnly(due) : null;
          const daysUntil = dueDate ? daysBetweenDateOnly(today, dueDate) : 0; // negative for overdue
          const daysOverdue = daysUntil < 0 ? Math.abs(daysUntil) : 0;
          return { i, remaining: Number(pr?.remaining) || 0, daysOverdue };
        })
        .filter((x) => x.remaining > 0)
        .sort((a, b) => b.daysOverdue - a.daysOverdue || b.remaining - a.remaining);

      const overdueCount = overdue.length;
      const overdueTotal = overdue.reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);

      if (overdueCount > 0) {
        messages.push({
          id: 'installments_overdue',
          content: `⚠️ لديك ${overdueCount} دفعات متأخرة بقيمة إجمالية ${formatCurrencyJOD(overdueTotal)}`,
          priority: 'High',
          type: 'alert',
          action: { kind: 'hash', hash: '/installments' },
        });

        for (const x of overdue) {
          const inst = x.i;
          const contractId = String(inst.رقم_العقد || '').trim();
          const contract = contractId ? contractsById.get(contractId) : undefined;
          const tenantId = String(contract?.رقم_المستاجر || '').trim();
          const tenantName = tenantId ? peopleById.get(tenantId)?.الاسم : undefined;
          const propertyId = String(contract?.رقم_العقار || '').trim();
          const propCode = propertyId ? propsById.get(propertyId)?.الكود_الداخلي : undefined;

          const who = String(tenantName || 'مستأجر');
          const where = String(propCode || '').trim();
          const amount = formatCurrencyJOD(Number(x.remaining) || 0);
          const t = norm(inst?.نوع_الكمبيالة) || 'دفعة';
          const due = String(inst?.تاريخ_استحقاق || '').trim();
          const days = Number(x.daysOverdue) || 0;

          messages.push({
            id: `inst_overdue_${String(inst.رقم_الكمبيالة || contractId || Math.random())}`,
            content: `⚠️ دفعة متأخرة: ${who}${where ? ` • عقار ${where}` : ''} • ${amount} • تاريخ ${due}${days ? ` • منذ ${days} يوم` : ''} • ${t}`,
            priority: 'High',
            type: 'alert',
            action: { kind: 'hash', hash: '/installments' },
          });
        }
      }

      const dueToday = (installments || [])
        .filter((i) => i.isArchived !== true)
        .filter((i) => norm(i.نوع_الكمبيالة) !== 'تأمين')
        .filter((i) => {
          const status = norm(i.حالة_الكمبيالة);
          return status !== INSTALLMENT_STATUS.CANCELLED && status !== INSTALLMENT_STATUS.PAID;
        })
        .filter((i) => {
          const due = String(i.تاريخ_استحقاق || '').trim();
          return !!due && due === todayYMD;
        })
        .map((i) => {
          const pr = getInstallmentPaidAndRemaining(i);
          return { i, remaining: Number(pr?.remaining) || 0 };
        })
        .filter((x) => x.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining);

      const count = dueToday.length;
      const total = dueToday.reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);

      if (count > 0) {
        messages.push({
          id: 'installments_today',
          content: `💰 لديك ${count} دفعات مستحقة اليوم بقيمة إجمالية ${formatCurrencyJOD(total)}`,
          priority: 'High',
          type: 'info',
          action: { kind: 'hash', hash: '/installments' },
        });

        for (const x of dueToday) {
          const inst = x.i;
          const contractId = String(inst.رقم_العقد || '').trim();
          const contract = contractId ? contractsById.get(contractId) : undefined;
          const tenantId = String(contract?.رقم_المستاجر || '').trim();
          const tenantName = tenantId ? peopleById.get(tenantId)?.الاسم : undefined;
          const propertyId = String(contract?.رقم_العقار || '').trim();
          const propCode = propertyId ? propsById.get(propertyId)?.الكود_الداخلي : undefined;

          const who = String(tenantName || 'مستأجر');
          const where = String(propCode || '').trim();
          const amount = formatCurrencyJOD(Number(x.remaining) || 0);
          const t = norm(inst?.نوع_الكمبيالة) || 'دفعة';

          messages.push({
            id: `inst_today_${String(inst.رقم_الكمبيالة || contractId || Math.random())}`,
            content: `💵 دفعة اليوم: ${who}${where ? ` • عقار ${where}` : ''} • ${amount} • ${t}`,
            priority: 'High',
            type: 'info',
            action: { kind: 'hash', hash: '/installments' },
          });
        }
      }
    } catch {
      // ignore
    }

    // Policy: pre-due only. Show upcoming reminders (next 7 days), not due-today/overdue.
    try {
      const targets = getPaymentNotificationTargetsInternal(7);
      const count = targets.reduce((sum, t) => sum + (t.items?.length || 0), 0);
      const total = targets.reduce(
        (sum, t) =>
          sum + (t.items || []).reduce((s: number, it) => s + (Number(it.amountRemaining) || 0), 0),
        0
      );

      if (count > 0) {
        messages.push({
          id: 'pre_due_7',
          content: `⏳ يوجد ${count} دفعات قريبة الاستحقاق خلال 7 أيام بقيمة إجمالية ${formatCurrencyJOD(total)}`,
          priority: 'High',
          type: 'info',
          action: { kind: 'panel', panel: 'PAYMENT_NOTIFICATIONS', options: { daysAhead: 7 } },
        });
      }
    } catch {
      // ignore
    }

    if (messages.length === 0) {
      return [];
    }

    return messages;
  },

  authenticateUser: async (u: string, p: string): Promise<DbResult<المستخدمين_tbl>> => {
    const username = String(u || '').trim();
    const password = String(p || '');
    if (!username || !password) return fail('Invalid credentials');

    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const idx = all.findIndex((x) => String(x.اسم_المستخدم || '').trim() === username);
    if (idx < 0) return fail('Invalid credentials');

    const user = all[idx];
    if (!user || !user.isActive) return fail('Invalid credentials');

    const stored = String(user.كلمة_المرور || '');
    const okPass = await verifyPassword(password, stored);
    if (!okPass) return fail('Invalid credentials');

    // Opportunistic upgrade: if we matched a legacy plaintext password, replace with a hash.
    try {
      if (stored && !isHashedPassword(stored)) {
        const upgraded = await hashPassword(password);
        all[idx] = { ...user, كلمة_المرور: upgraded };
        save(KEYS.USERS, all);
      }
    } catch {
      // ignore
    }

    return ok(user);
  },
  logAuthAttempt: (payload: {
    username: string;
    result: 'SUCCESS' | 'FAILED' | 'LOCKED';
    reason?: string;
    userId?: string;
    fails?: number;
    lockedUntil?: number;
    deviceInfo?: string;
  }) => {
    try {
      const username = String(payload?.username || '').trim();
      if (!username) return;

      const result = String(payload?.result || '').trim() as 'SUCCESS' | 'FAILED' | 'LOCKED';
      const action =
        result === 'SUCCESS'
          ? 'AUTH_LOGIN_SUCCESS'
          : result === 'LOCKED'
            ? 'AUTH_LOGIN_LOCKED'
            : 'AUTH_LOGIN_FAILED';

      const recordId = String(payload?.userId || username).trim();

      const parts: string[] = [];
      if (payload?.reason) parts.push(String(payload.reason));
      if (typeof payload?.fails === 'number' && Number.isFinite(payload.fails))
        parts.push(`fails=${payload.fails}`);
      if (
        typeof payload?.lockedUntil === 'number' &&
        Number.isFinite(payload.lockedUntil) &&
        payload.lockedUntil > 0
      ) {
        try {
          parts.push(`lockedUntil=${new Date(payload.lockedUntil).toISOString()}`);
        } catch {
          parts.push(`lockedUntil=${payload.lockedUntil}`);
        }
      }

      logOperationInternal(username, action, 'Auth', recordId, parts.join(' | '), {
        // No reliable IP in local-first offline app.
        ipAddress: 'local',
        deviceInfo: String(payload?.deviceInfo || '').slice(0, 220),
      });
    } catch {
      // ignore
    }
  },
  userHasPermission: (userId: string, permission: string) => {
    const user = get<المستخدمين_tbl>(KEYS.USERS).find((u) => u.id === userId);
    if (!user) return false;
    // SuperAdmin should bypass all permission checks, even if role value is not exactly 'SuperAdmin'
    // (e.g., different casing, localized labels, or legacy values).
    if (isSuperAdmin(normalizeRole(user.الدور))) return true;
    const perms = get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS)
      .filter((p) => p.userId === userId)
      .map((p) => p.permissionCode);
    return perms.includes(permission);
  },
  getUserPermissions: (userId: string) =>
    get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS)
      .filter((p) => p.userId === userId)
      .map((p) => p.permissionCode),
  updateUserPermissions: (userId: string, perms: string[]) => {
    const all = get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS).filter((p) => p.userId !== userId);
    perms.forEach((code) => all.push({ userId, permissionCode: code }));
    save(KEYS.USER_PERMISSIONS, all);
  },
  updateUserRole: (userId: string, role: RoleType) => {
    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const idx = all.findIndex((u) => u.id === userId);
    if (idx > -1) {
      all[idx].الدور = role;
      save(KEYS.USERS, all);
    }
  },
  updateUserStatus: (id: string, status: boolean) => {
    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const idx = all.findIndex((u) => u.id === id);
    if (idx > -1) {
      all[idx].isActive = status;
      save(KEYS.USERS, all);
    }
  },
  deleteSystemUser: (id: string) => {
    const all = get<المستخدمين_tbl>(KEYS.USERS).filter((u) => u.id !== id);
    save(KEYS.USERS, all);
  },
  addSystemUser: async (user: Partial<المستخدمين_tbl>) => {
    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const candidateUsername = String(user.اسم_المستخدم || '').trim();
    if (!candidateUsername) {
      throw new Error('اسم المستخدم مطلوب');
    }
    if (all.some((u) => String(u.اسم_المستخدم || '').trim() === candidateUsername)) {
      throw new Error('اسم المستخدم موجود مسبقاً');
    }

    const rawPassword = String(user.كلمة_المرور || '');
    const storedPassword = rawPassword ? await hashPassword(rawPassword) : '';

    const newUser: المستخدمين_tbl = {
      id: `USR-${Date.now()}`,
      اسم_المستخدم: candidateUsername,
      اسم_للعرض: user.اسم_للعرض,
      كلمة_المرور: storedPassword,
      الدور: user.الدور || 'Employee',
      linkedPersonId: user.linkedPersonId,
      isActive: true,
    };
    save(KEYS.USERS, [...all, newUser]);
  },
  changeUserPassword: async (userId: string, newPassword: string, actorUserId?: string) => {
    const targetId = String(userId || '').trim();
    const actorId = String(actorUserId || '').trim();
    const password = String(newPassword || '');

    if (!targetId) throw new Error('معرّف المستخدم غير صالح');
    if (!password.trim()) throw new Error('كلمة المرور مطلوبة');
    if (password.trim().length < 6) throw new Error('كلمة المرور قصيرة جداً (الحد الأدنى 6 أحرف)');

    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const idx = all.findIndex((u) => String(u.id || '').trim() === targetId);
    if (idx < 0) throw new Error('المستخدم غير موجود');

    // Permission enforcement (do not rely on the UI).
    if (actorId && actorId !== targetId) {
      const actor = all.find((u) => String(u.id || '').trim() === actorId);
      if (!actor) throw new Error('المستخدم الحالي غير معروف');
      if (!DbService.userHasPermission(actorId, 'MANAGE_USERS')) {
        throw new Error('لا تملك صلاحية تغيير كلمة مرور مستخدم آخر');
      }
    }

    const storedPassword = await hashPassword(password.trim());
    const beforeUsername = String(all[idx]?.اسم_المستخدم || '').trim();

    all[idx] = { ...all[idx], كلمة_المرور: storedPassword };
    save(KEYS.USERS, all);

    try {
      const actorName = actorId
        ? String(all.find((u) => String(u.id || '').trim() === actorId)?.اسم_المستخدم || '').trim()
        : '';
      logOperationInternal(
        actorName || 'System',
        'USERS_CHANGE_PASSWORD',
        'Users',
        targetId,
        beforeUsername ? `target=${beforeUsername}` : ''
      );
    } catch {
      // ignore
    }
  },
  getPermissionDefinitions: () => [
    { code: 'ADD_PERSON', label: 'إضافة أشخاص', category: 'Persons' },
    { code: 'EDIT_PERSON', label: 'تعديل أشخاص', category: 'Persons' },
    { code: 'DELETE_PERSON', label: 'حذف أشخاص', category: 'Persons' },
    { code: 'ADD_PROPERTY', label: 'إضافة عقارات', category: 'Properties' },
    { code: 'EDIT_PROPERTY', label: 'تعديل عقارات', category: 'Properties' },
    { code: 'DELETE_PROPERTY', label: 'حذف عقارات', category: 'Properties' },
    { code: 'CREATE_CONTRACT', label: 'إنشاء عقود', category: 'Contracts' },
    { code: 'DELETE_CONTRACT', label: 'حذف/أرشفة عقود', category: 'Contracts' },
    { code: 'EDIT_MAINTENANCE', label: 'تعديل تذاكر الصيانة', category: 'Maintenance' },
    { code: 'CLOSE_MAINTENANCE', label: 'إنهاء/إغلاق تذاكر الصيانة', category: 'Maintenance' },
    { code: 'DELETE_MAINTENANCE', label: 'حذف تذاكر الصيانة', category: 'Maintenance' },
    { code: 'SETTINGS_ADMIN', label: 'إدارة الإعدادات', category: 'System' },
    { code: 'SETTINGS_AUDIT', label: 'سجل العمليات', category: 'System' },
    { code: 'MANAGE_USERS', label: 'إدارة المستخدمين', category: 'System' },
    { code: 'BLACKLIST_VIEW', label: 'عرض القائمة السوداء', category: 'Security' },
    { code: 'BLACKLIST_ADD', label: 'إضافة للقائمة السوداء', category: 'Security' },
    { code: 'BLACKLIST_REMOVE', label: 'رفع الحظر (إزالة)', category: 'Security' },
    // Printing (Enterprise)
    { code: 'PRINT_PREVIEW', label: 'فتح معاينة الطباعة', category: 'Printing' },
    { code: 'PRINT_EXECUTE', label: 'تنفيذ الطباعة', category: 'Printing' },
    { code: 'PRINT_EXPORT', label: 'تصدير ملفات (Word/PDF)', category: 'Printing' },
    { code: 'PRINT_SETTINGS_EDIT', label: 'تعديل إعدادات الطباعة', category: 'Printing' },
    { code: 'PRINT_TEMPLATES_EDIT', label: 'إدارة قوالب الطباعة', category: 'Printing' },
  ],

  getSettings,
  saveSettings,

  backupSystem: () => {
    // In desktop mode, localStorage is a cache hydrated from SQLite.
    // Export what the app currently sees (db_* keys in localStorage) for a consistent backup format.
    const data = { ...localStorage };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    return URL.createObjectURL(blob);
  },

  restoreSystem: (data: Record<string, string>) => {
    // Restore into persistent storage (SQLite in desktop mode, localStorage in browser mode)
    Object.keys(data).forEach((k) => {
      void storage.setItem(k, data[k]);
      localStorage.setItem(k, data[k]);
    });
    buildCache();
  },

  previewRestore: (data: unknown) => {
    const rec = asUnknownRecord(data);
    const safeArrayLength = (raw: unknown): number => {
      if (typeof raw !== 'string') return 0;
      try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    };
    return {
      people: safeArrayLength(rec[KEYS.PEOPLE]),
      contracts: safeArrayLength(rec[KEYS.CONTRACTS]),
    };
  },

  runDailyScheduler: () => {
    // Simulated daily scheduled tasks (runs after login)
    // Avoid repeating heavy work multiple times per session
    const todayKey = new Date().toISOString().split('T')[0];
    const lastRun = localStorage.getItem('daily_scheduler_last_run');
    if (lastRun === todayKey) return;
    void storage.setItem('daily_scheduler_last_run', todayKey);

    // 1) Generate installment reminders/alerts
    try {
      runInstallmentReminderScanInternal();
    } catch (e) {
      console.warn('Daily scheduler: installment scan failed', e);
    }

    // 2) Auto renew contracts (if enabled per contract)
    try {
      runAutoRenewContractsInternal();
    } catch (e) {
      console.warn('Daily scheduler: auto renew failed', e);
    }

    // 3) Data quality alerts (linked to real records)
    try {
      runDataQualityScanInternal();
    } catch (e) {
      console.warn('Daily scheduler: data quality scan failed', e);
    }

    // 4) Expiry alerts (linked to contracts)
    try {
      runExpiryScanInternal();
    } catch (e) {
      console.warn('Daily scheduler: expiry scan failed', e);
    }

    // 5) Risk alerts (blacklist + overdue)
    try {
      runRiskScanInternal();
    } catch (e) {
      console.warn('Daily scheduler: risk scan failed', e);
    }
  },

  // Manual trigger (optional): refresh reminders/alerts immediately
  runInstallmentReminderScan: () => {
    runInstallmentReminderScanInternal();
  },

  getSalesListings,
  createSalesListing,
  cancelOpenSalesListingsForProperty,
  getSalesOffers,
  submitSalesOffer,
  updateOfferStatus,
  getSalesAgreements,
  updateSalesAgreement,
  deleteSalesAgreement,
  createSalesAgreement,

  finalizeOwnershipTransfer: (id: string, txId: string): DbResult<null> => {
    const all = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
    const idx = all.findIndex((a) => a.id === id);
    if (idx > -1) {
      if (all[idx].isCompleted) return fail('تم إتمام نقل الملكية مسبقاً');
      all[idx].isCompleted = true;
      all[idx].transactionId = txId;
      all[idx].transferDate = new Date().toISOString().split('T')[0];
      save(KEYS.SALES_AGREEMENTS, all);

      const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
      const listingIdx = listings.findIndex((l) => l.id === all[idx].listingId);
      const listing = listingIdx > -1 ? listings[listingIdx] : null;
      if (!listing) return fail('عرض البيع غير موجود');

      const oldOwnerId = listing.رقم_المالك;
      const newOwnerId = all[idx].رقم_المشتري;

      // Require new title deed attachment (Property + Buyer)
      try {
        const attachments = get<Attachment>(KEYS.ATTACHMENTS);
        const propHasAny = attachments.some(
          (a) => a.referenceType === 'Property' && a.referenceId === listing.رقم_العقار
        );
        const buyerHasAny = attachments.some(
          (a) => a.referenceType === 'Person' && a.referenceId === newOwnerId
        );
        if (!propHasAny || !buyerHasAny) {
          return fail(
            'لا يمكن إتمام النقل: يجب رفع مستندات البيع/نقل الملكية ضمن مرفقات العقار ومرفقات المشتري قبل إتمام النقل (مثل سند الملكية الجديد أو أي مستندات رسمية مطلوبة)'
          );
        }
      } catch {
        return fail('لا يمكن إتمام النقل: تحقق من مرفقات العقار/المشتري');
      }

      // Validate property and current ownership
      const props = get<العقارات_tbl>(KEYS.PROPERTIES);
      const pIdx = props.findIndex((p) => p.رقم_العقار === listing.رقم_العقار);
      if (pIdx === -1) return fail('العقار غير موجود');
      if (props[pIdx].رقم_المالك !== listing.رقم_المالك) {
        return fail(
          'لا يمكن نقل الملكية: مالك العقار الحالي لا يطابق مالك عرض البيع (يرجى مراجعة بيانات المالك)'
        );
      }

      // If there is an active/renewed rental contract, terminate it as part of the ownership transfer.
      // This keeps property state consistent (sale completes -> not rented).
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const activeContracts = contracts.filter(
        (c) => c.رقم_العقار === listing.رقم_العقار && isTenancyRelevant(c)
      );
      if (activeContracts.length > 0) {
        const reason = 'تم بيع العقار - نقل ملكية';
        const date = all[idx].transferDate || new Date().toISOString().split('T')[0];
        for (const c of activeContracts) {
          try {
            const tRes = DbService.terminateContract(c.رقم_العقد, reason, date);
            if (!tRes.success) {
              return fail(`تعذر إتمام نقل الملكية: ${tRes.message}`);
            }
          } catch {
            return fail('تعذر إنهاء عقد الإيجار أثناء نقل الملكية');
          }
        }
      }

      // Mark listing as sold
      listings[listingIdx].الحالة = 'Sold';
      save(KEYS.SALES_LISTINGS, listings);

      // Update property owner + flags
      props[pIdx].رقم_المالك = newOwnerId;
      props[pIdx].isForSale = false;
      props[pIdx].salePrice = all[idx].السعر_النهائي;
      props[pIdx].minSalePrice = undefined;
      props[pIdx].حالة_العقار = 'شاغر';
      props[pIdx].IsRented = false;
      save(KEYS.PROPERTIES, props);

      // Ownership history (previous owner record)
      try {
        const hist = get<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
        hist.push({
          id: `OWN-${Date.now()}`,
          رقم_العقار: listing.رقم_العقار,
          رقم_المالك_القديم: oldOwnerId,
          رقم_المالك_الجديد: newOwnerId,
          تاريخ_نقل_الملكية: all[idx].transferDate || new Date().toISOString().split('T')[0],
          رقم_المعاملة: txId,
          agreementId: id,
          listingId: listing.id,
          السعر_النهائي: all[idx].السعر_النهائي,
        });
        save(KEYS.OWNERSHIP_HISTORY, hist);
      } catch (e) {
        console.warn('Failed to save ownership history', e);
      }

      // Audit log
      try {
        logOperationInternal(
          'system',
          'OWNERSHIP_TRANSFER',
          'sales_agreements',
          id,
          JSON.stringify({
            transactionId: txId,
            listingId: listing.id,
            propertyId: listing.رقم_العقار,
            sellerId: oldOwnerId,
            buyerId: newOwnerId,
            finalPrice: all[idx].السعر_النهائي,
            transferDate: all[idx].transferDate,
          })
        );
      } catch (e) {
        console.warn('Failed to log ownership transfer', e);
      }

      // Ensure buyer has "مالك" role
      try {
        const buyerId = newOwnerId;
        const currentRoles = getPersonRoles(buyerId);
        if (!currentRoles.includes('مالك')) {
          updatePersonRoles(buyerId, Array.from(new Set([...currentRoles, 'مالك'])));
        }
      } catch (e) {
        console.warn('Failed to update buyer roles after transfer', e);
      }

      // If the previous owner no longer owns any properties, remove "مالك" role
      try {
        const stillOwnsAny = get<العقارات_tbl>(KEYS.PROPERTIES).some(
          (p) => p.رقم_المالك === oldOwnerId
        );
        if (!stillOwnsAny) {
          const roles = getPersonRoles(oldOwnerId);
          if (roles.includes('مالك')) {
            updatePersonRoles(
              oldOwnerId,
              roles.filter((r) => r !== 'مالك')
            );
          }
        }
      } catch (e) {
        console.warn('Failed to update old owner roles after transfer', e);
      }

      // Reject any remaining pending offers for this listing
      const offers = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
      let offersChanged = false;
      for (const o of offers) {
        if (o.listingId === listing.id && o.الحالة === 'Pending') {
          o.الحالة = 'Rejected';
          offersChanged = true;
        }
      }
      if (offersChanged) save(KEYS.SALES_OFFERS, offers);

      return ok(null, 'تم نقل الملكية بنجاح');
    }
    return fail('Agreement not found');
  },

  addSalesOfferNote: (offerId: string, note: string): DbResult<null> => {
    const clean = (note || '').trim();
    if (!clean) return fail('يرجى كتابة ملاحظة');
    const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
    const idx = all.findIndex((o) => o.id === offerId);
    if (idx === -1) return fail('العرض غير موجود');

    const stamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const prev = (all[idx].ملاحظات_التفاوض || '').trim();
    const line = `• ${stamp}: ${clean}`;
    all[idx].ملاحظات_التفاوض = prev ? `${prev}\n${line}` : line;
    save(KEYS.SALES_OFFERS, all);
    return ok();
  },

  getOwnershipHistory: (propertyId?: string, personId?: string): سجل_الملكية_tbl[] => {
    // Prefer cache indexes when available
    if (DbCache.isInitialized) {
      if (propertyId) {
        return DbCache.ownershipHistoryByPropertyId.get(propertyId) || [];
      }
      if (personId) {
        return DbCache.ownershipHistoryByPersonId.get(personId) || [];
      }
    }
    const all = get<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
    if (propertyId) return all.filter((x) => x.رقم_العقار === propertyId);
    if (personId)
      return all.filter(
        (x) => x.رقم_المالك_القديم === personId || x.رقم_المالك_الجديد === personId
      );
    return all;
  },

  getMaintenanceTickets: () => get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE),
  addMaintenanceTicket: (data: تذاكر_الصيانة_tbl): DbResult<null> => {
    const all = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
    save(KEYS.MAINTENANCE, [...all, { ...data, رقم_التذكرة: `MNT-${Date.now()}` }]);
    buildCache();
    return ok();
  },
  updateMaintenanceTicket: (id: string, data: Partial<تذاكر_الصيانة_tbl>) => {
    const all = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
    const idx = all.findIndex((t) => t.رقم_التذكرة === id);
    if (idx > -1) {
      // If ticket is being closed, stamp closure date if not provided.
      const patch: Partial<تذاكر_الصيانة_tbl> = { ...data };
      if (patch.الحالة === 'مغلق' && !patch.تاريخ_الإغلاق) {
        patch.تاريخ_الإغلاق = new Date().toISOString().split('T')[0];
      }
      all[idx] = { ...all[idx], ...patch };
      save(KEYS.MAINTENANCE, all);
      buildCache();
    }
  },
  deleteMaintenanceTicket: (id: string): DbResult<null> => {
    const all = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
    const idx = all.findIndex((t) => t.رقم_التذكرة === id);
    if (idx === -1) return ok();

    // Remove ticket
    const next = all.filter((t) => t.رقم_التذكرة !== id);
    save(KEYS.MAINTENANCE, next);

    // Remove attachments/activities/notes linked to this maintenance ticket
    purgeRefs('Maintenance', id);

    logOperationInternal('Admin', 'حذف', 'Maintenance', id, 'حذف تذكرة صيانة نهائياً');
    buildCache();
    return ok();
  },

  getExternalCommissions: () => get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS),
  addExternalCommission: (data: Partial<العمولات_الخارجية_tbl>): DbResult<null> => {
    const all = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
    save(KEYS.EXTERNAL_COMMISSIONS, [
      ...all,
      { ...data, id: `EXT-${Date.now()}` } as العمولات_الخارجية_tbl,
    ]);
    return ok();
  },
  updateExternalCommission: (
    id: string,
    patch: Partial<العمولات_الخارجية_tbl>
  ): DbResult<العمولات_الخارجية_tbl> => {
    const all = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
    const idx = all.findIndex((x) => x.id === id);
    if (idx === -1) return fail('السجل غير موجود');

    const next: العمولات_الخارجية_tbl = {
      ...all[idx],
      ...patch,
    } as العمولات_الخارجية_tbl;

    next.القيمة = Number(next.القيمة || 0);

    const updated = [...all];
    updated[idx] = next;
    save(KEYS.EXTERNAL_COMMISSIONS, updated);
    logOperationInternal(
      'Admin',
      'تعديل',
      'ExternalCommissions',
      id,
      `تعديل عمولة خارجية: ${next.العنوان || ''}`
    );
    return ok(next);
  },
  deleteExternalCommission: (id: string): DbResult<null> => {
    const all = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
    const target = all.find((x) => x.id === id);
    if (!target) return ok();
    save(
      KEYS.EXTERNAL_COMMISSIONS,
      all.filter((x) => x.id !== id)
    );
    logOperationInternal(
      'Admin',
      'حذف',
      'ExternalCommissions',
      id,
      `حذف عمولة خارجية: ${target.العنوان || ''}`
    );
    return ok();
  },

  getDynamicTables: () => get<DynamicTable>(KEYS.DYNAMIC_TABLES),
  createDynamicTable: (name: string) => {
    const id = `DT-${Date.now()}`;
    const all = get<DynamicTable>(KEYS.DYNAMIC_TABLES);
    const newT = { id, title: name, fields: [] };
    save(KEYS.DYNAMIC_TABLES, [...all, newT]);
    return newT;
  },
  getDynamicRecords: (tableId: string) =>
    get<DynamicRecord>(KEYS.DYNAMIC_RECORDS).filter((r) => r.tableId === tableId),
  addDynamicRecord: (data: Partial<DynamicRecord>) => {
    const all = get<DynamicRecord>(KEYS.DYNAMIC_RECORDS);
    save(KEYS.DYNAMIC_RECORDS, [...all, { ...data, id: `DR-${Date.now()}` } as DynamicRecord]);
  },
  addFieldToTable: (tableId: string, field: Omit<DynamicTable['fields'][number], 'id'>) => {
    const all = get<DynamicTable>(KEYS.DYNAMIC_TABLES);
    const idx = all.findIndex((t) => t.id === tableId);
    if (idx > -1) {
      all[idx].fields.push({ ...field, id: `FLD-${Date.now()}` });
      save(KEYS.DYNAMIC_TABLES, all);
    }
  },
  getFormFields: (formId: string) =>
    get<DynamicFormField>(KEYS.DYNAMIC_FORM_FIELDS).filter((f) => f.formId === formId),
  addFormField: (formId: string, field: Partial<DynamicFormField>) => {
    const all = get<DynamicFormField>(KEYS.DYNAMIC_FORM_FIELDS);
    save(KEYS.DYNAMIC_FORM_FIELDS, [
      ...all,
      { ...field, formId, id: `FF-${Date.now()}` } as DynamicFormField,
    ]);
  },
  deleteFormField: (id: string) => {
    save(
      KEYS.DYNAMIC_FORM_FIELDS,
      get<DynamicFormField>(KEYS.DYNAMIC_FORM_FIELDS).filter((f) => f.id !== id)
    );
  },

  getAttachments: (type: ReferenceType, id: string) =>
    get<Attachment>(KEYS.ATTACHMENTS).filter(
      (a) => a.referenceType === type && a.referenceId === id
    ),
  getAllAttachments: () => get<Attachment>(KEYS.ATTACHMENTS),
  uploadAttachment: async (
    type: ReferenceType,
    id: string,
    file: File
  ): Promise<DbResult<Attachment>> => {
    // Desktop (Electron): save as a real file under userData/attachments
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (desktopDb?.saveAttachmentFile) {
      try {
        const entityFolder = buildAttachmentEntityFolder(type, id);
        const bytes = await file.arrayBuffer();
        const resultUnknown = await desktopDb.saveAttachmentFile({
          referenceType: type,
          entityFolder,
          originalFileName: file.name,
          bytes,
        });

        const result = asUnknownRecord(resultUnknown);

        if (result['success'] !== true || typeof result['relativePath'] !== 'string') {
          return fail(String(result['message'] || 'فشل حفظ الملف على القرص'));
        }

        const all = get<Attachment>(KEYS.ATTACHMENTS);
        const att: Attachment = {
          id: `ATT-${Date.now()}`,
          referenceType: type,
          referenceId: id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileExtension: file.name.split('.').pop() || '',
          uploadDate: new Date().toISOString(),
          uploadedBy: 'Admin',
          filePath: result['relativePath'],
        };

        save(KEYS.ATTACHMENTS, [...all, att]);
        return ok(att);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'فشل حفظ الملف';
        return fail(message);
      }
    }

    // Browser fallback: store as DataURL (Base64)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const all = get<Attachment>(KEYS.ATTACHMENTS);
        const att: Attachment = {
          id: `ATT-${Date.now()}`,
          referenceType: type,
          referenceId: id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileExtension: file.name.split('.').pop() || '',
          uploadDate: new Date().toISOString(),
          uploadedBy: 'Admin',
          fileData: reader.result as string,
        };
        try {
          save(KEYS.ATTACHMENTS, [...all, att]);
          resolve(ok(att));
        } catch {
          reject('File too large for mock storage');
        }
      };
      reader.onerror = reject;
    });
  },
  deleteAttachment: async (id: string): Promise<DbResult<null>> => {
    const all = get<Attachment>(KEYS.ATTACHMENTS);
    const att = all.find((a) => a.id === id);

    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (att?.filePath && desktopDb?.deleteAttachmentFile) {
      try {
        await desktopDb.deleteAttachmentFile(att.filePath);
      } catch {
        // best-effort: still remove record
      }
    }

    save(
      KEYS.ATTACHMENTS,
      all.filter((a) => a.id !== id)
    );
    return ok();
  },

  readWordTemplate: async (
    templateName: string,
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<DbResult<ArrayBuffer>> => {
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (!desktopDb?.readTemplateFile) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }

    try {
      const resUnknown = await desktopDb.readTemplateFile({ templateName, templateType });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true || typeof res['dataUri'] !== 'string') {
        return fail(String(res['message'] || 'فشل تحميل قالب Word'));
      }

      const dataUri = String(res['dataUri'] || '').trim();
      // Avoid `fetch(data:...)` because it can be blocked by CSP `connect-src`.
      // Decode the `data:` URI directly into an ArrayBuffer.
      if (!dataUri.startsWith('data:')) {
        return fail('قالب Word غير صالح (dataUri)');
      }

      const commaIdx = dataUri.indexOf(',');
      if (commaIdx < 0) return fail('قالب Word غير صالح (dataUri)');
      const meta = dataUri.slice(5, commaIdx); // after `data:`
      const payload = dataUri.slice(commaIdx + 1);

      const isBase64 = /;base64\s*$/i.test(meta);
      if (isBase64) {
        const bin = atob(payload);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return ok(bytes.buffer);
      }

      // Non-base64: interpret as URL-encoded bytes.
      const text = decodeURIComponent(payload);
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
      return ok(bytes.buffer);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'فشل تحميل قالب Word';
      return fail(message);
    }
  },

  listWordTemplates: async (
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<DbResult<string[]>> => {
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (!desktopDb?.listTemplates) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }

    try {
      const resUnknown = await desktopDb.listTemplates({ templateType });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true)
        return fail(String(res['message'] || 'تعذر قراءة قائمة القوالب'));
      const items = res['items'];
      return ok(Array.isArray(items) ? items.filter((x) => typeof x === 'string') : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر قراءة قائمة القوالب';
      return fail(message);
    }
  },

  listWordTemplatesDetailed: async (
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<
    DbResult<{
      items: string[];
      dir: string;
      templateType: string;
      details?: Array<{ fileName: string; kvKey?: string; key?: string; updatedAt?: string }>;
    }>
  > => {
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (!desktopDb?.listTemplates) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }

    try {
      const resUnknown = await desktopDb.listTemplates({ templateType });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true)
        return fail(String(res['message'] || 'تعذر قراءة قائمة القوالب'));
      const itemsRaw = res['items'];
      const items = Array.isArray(itemsRaw) ? itemsRaw.filter((x) => typeof x === 'string') : [];
      const detailsRaw = res['details'];
      const details = Array.isArray(detailsRaw)
        ? detailsRaw
            .map((x) => asUnknownRecord(x))
            .filter((r) => typeof r['fileName'] === 'string')
            .map((r) => {
              return {
                fileName: String(r['fileName'] || ''),
                kvKey: typeof r['kvKey'] === 'string' ? String(r['kvKey']) : undefined,
                key: typeof r['key'] === 'string' ? String(r['key']) : undefined,
                updatedAt: typeof r['updatedAt'] === 'string' ? String(r['updatedAt']) : undefined,
              };
            })
        : undefined;
      const dir = typeof res['dir'] === 'string' ? String(res['dir']) : '';
      const t =
        typeof res['templateType'] === 'string'
          ? String(res['templateType'])
          : String(templateType || 'contracts');
      return ok({ items, details, dir, templateType: t });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر قراءة قائمة القوالب';
      return fail(message);
    }
  },

  importWordTemplate: async (
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<DbResult<string>> => {
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (!desktopDb?.importTemplate) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }

    try {
      const resUnknown = await desktopDb.importTemplate({ templateType });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true || typeof res['fileName'] !== 'string') {
        return fail(String(res['message'] || 'تم الإلغاء'));
      }
      return ok(String(res['fileName']));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'فشل استيراد القالب';
      return fail(message);
    }
  },

  deleteWordTemplate: async (
    templateName: string,
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<DbResult<null>> => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }
    if (!bridge.deleteTemplate) {
      return fail('ميزة حذف قالب Word تحتاج تحديث نسخة سطح المكتب أو إعادة تشغيل التطبيق');
    }

    try {
      const resUnknown = await bridge.deleteTemplate({
        templateName: String(templateName || ''),
        templateType,
      });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true) {
        return fail(String(res['message'] || 'فشل حذف القالب'));
      }
      return ok();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'فشل حذف القالب';
      return fail(message);
    }
  },
  downloadAttachment: async (id: string) => {
    const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

    // Desktop: prefer reading attachment metadata from SQLite KV via IPC.
    if (isDesktop() && (window as unknown as { desktopDb?: unknown }).desktopDb) {
      const bridge = (window as unknown as { desktopDb?: unknown }).desktopDb;
      if (isObj(bridge) && typeof bridge.get === 'function') {
        try {
          const raw = await (bridge.get as (key: string) => Promise<unknown>)(KEYS.ATTACHMENTS);
          const s = typeof raw === 'string' ? raw : String(raw ?? '');
          const parsed: unknown = s.trim() ? JSON.parse(s) : [];
          const arr: unknown[] = Array.isArray(parsed) ? parsed : [];
          const match = arr.find((x) => isObj(x) && String(x.id || '') === id);
          if (match && isObj(match)) {
            const filePath = typeof match.filePath === 'string' ? match.filePath : '';
            const fileData = typeof match.fileData === 'string' ? match.fileData : '';

            if (filePath && isObj(bridge) && typeof bridge.readAttachmentFile === 'function') {
              try {
                const res = await (bridge.readAttachmentFile as (p: string) => Promise<unknown>)(
                  filePath
                );
                const rr = isObj(res) ? res : null;
                if (rr && rr.success) return typeof rr.dataUri === 'string' ? rr.dataUri : null;

                // If the file is missing locally (common right after a remote pull of metadata),
                // ask main process to pull missing attachment files then retry once.
                if (isObj(bridge) && typeof bridge.pullAttachmentsNow === 'function') {
                  try {
                    await (bridge.pullAttachmentsNow as () => Promise<unknown>)();
                    const res2 = await (
                      bridge.readAttachmentFile as (p: string) => Promise<unknown>
                    )(filePath);
                    const rr2 = isObj(res2) ? res2 : null;
                    return rr2 && rr2.success
                      ? typeof rr2.dataUri === 'string'
                        ? rr2.dataUri
                        : null
                      : null;
                  } catch {
                    return null;
                  }
                }

                return null;
              } catch {
                return null;
              }
            }

            return fileData || null;
          }
        } catch {
          // fall back below
        }
      }
    }

    const att = get<Attachment>(KEYS.ATTACHMENTS).find((a) => a.id === id);
    if (!att) return null;

    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (att.filePath && desktopDb?.readAttachmentFile) {
      try {
        const resUnknown = await desktopDb.readAttachmentFile(att.filePath);
        const res = asUnknownRecord(resUnknown);
        if (res['success'] === true)
          return typeof res['dataUri'] === 'string' ? res['dataUri'] : null;

        // Best-effort: pull missing files from remote SQL then retry once.
        if (typeof desktopDb.pullAttachmentsNow === 'function') {
          try {
            await desktopDb.pullAttachmentsNow();
            const res2Unknown = await desktopDb.readAttachmentFile(att.filePath);
            const res2 = asUnknownRecord(res2Unknown);
            return res2['success'] === true
              ? typeof res2['dataUri'] === 'string'
                ? res2['dataUri']
                : null
              : null;
          } catch {
            return null;
          }
        }

        return null;
      } catch {
        return null;
      }
    }

    return att.fileData ?? null;
  },

  getActivities: (refId: string, type: string) =>
    get<ActivityRecord>(KEYS.ACTIVITIES).filter(
      (a) => a.referenceId === refId && a.referenceType === type
    ),
  getNotes: (refId: string, type: string) =>
    get<NoteRecord>(KEYS.NOTES).filter((n) => n.referenceId === refId && n.referenceType === type),
  addNote: (data: Partial<NoteRecord>): DbResult<null> => {
    const all = get<NoteRecord>(KEYS.NOTES);
    save(KEYS.NOTES, [
      ...all,
      {
        ...data,
        id: `NT-${Date.now()}`,
        date: new Date().toISOString(),
        employee: 'Admin',
      } as NoteRecord,
    ]);
    return ok();
  },
  addEntityNote: (table: string, id: string, note: string): DbResult<null> => {
    const clean = String(note || '').trim();
    if (!clean) return fail('يرجى كتابة ملاحظة');
    const t = String(table || '').trim();
    const rawId = String(id || '').trim();
    if (!t || !rawId) return fail('مرجع غير صالح');

    // Map table names (UI) to ReferenceType/Id (notes system)
    if (t === 'الأشخاص_tbl') {
      return DbService.addNote({ referenceType: 'Person', referenceId: rawId, content: clean });
    }
    if (t === 'العقارات_tbl') {
      return DbService.addNote({ referenceType: 'Property', referenceId: rawId, content: clean });
    }
    if (t === 'العقود_tbl') {
      return DbService.addNote({ referenceType: 'Contract', referenceId: rawId, content: clean });
    }
    if (t === 'الكمبيالات_tbl') {
      const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find(
        (x) => String(x.رقم_الكمبيالة) === rawId
      );
      const contractId = String(inst?.رقم_العقد || '').trim();
      if (!contractId) return fail('تعذر ربط الملاحظة: الكمبيالة غير موجودة');
      return DbService.addNote({
        referenceType: 'Contract',
        referenceId: contractId,
        content: `[كمبيالة ${rawId}] ${clean}`,
      });
    }

    return fail('نوع السجل غير مدعوم لإضافة الملاحظات');
  },
  quickUpdateEntity: (table: string, id: string, updates: unknown): DbResult<null> => {
    const t = String(table || '').trim();
    const rawId = String(id || '').trim();
    if (!t || !rawId) return fail('مرجع غير صالح');
    if (!updates || typeof updates !== 'object') return fail('بيانات التحديث غير صالحة');

    // Defensive: never allow changing primary identifiers via quick edit.
    const updatesRec = asUnknownRecord(updates);
    const patch: Record<string, unknown> = { ...updatesRec };
    delete patch['رقم_الشخص'];
    delete patch['رقم_العقار'];
    delete patch['رقم_العقد'];
    delete patch['رقم_الكمبيالة'];

    const upsertBy = <T extends object>(key: string, idField: keyof T) => {
      const all = get<T>(key);
      const idx = all.findIndex((x) => String(asUnknownRecord(x)[String(idField)] ?? '') === rawId);
      if (idx === -1) return fail('السجل غير موجود');
      const next = { ...all[idx], ...patch } as T;
      (next as unknown as Record<string, unknown>)[String(idField)] = asUnknownRecord(all[idx])[
        String(idField)
      ];
      const updated = [...all];
      updated[idx] = next;
      save(key, updated);
      return ok(null, 'تم التحديث');
    };

    if (t === 'الأشخاص_tbl') {
      return upsertBy<الأشخاص_tbl>(KEYS.PEOPLE, 'رقم_الشخص');
    }
    if (t === 'العقارات_tbl') {
      return upsertBy<العقارات_tbl>(KEYS.PROPERTIES, 'رقم_العقار');
    }
    if (t === 'العقود_tbl') {
      return upsertBy<العقود_tbl>(KEYS.CONTRACTS, 'رقم_العقد');
    }
    if (t === 'الكمبيالات_tbl') {
      return upsertBy<الكمبيالات_tbl>(KEYS.INSTALLMENTS, 'رقم_الكمبيالة');
    }

    return fail('نوع السجل غير مدعوم للتعديل السريع');
  },

  searchGlobal: (query: string) => {
    const lower = query.toLowerCase();
    const people = get<الأشخاص_tbl>(KEYS.PEOPLE)
      .filter((p) => p.الاسم.toLowerCase().includes(lower) || p.رقم_الهاتف.includes(lower))
      .slice(0, 5);
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES)
      .filter(
        (p) =>
          p.الكود_الداخلي.toLowerCase().includes(lower) || p.العنوان.toLowerCase().includes(lower)
      )
      .slice(0, 5);
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS)
      .filter((c) => c.رقم_العقد.includes(lower))
      .slice(0, 5);
    return { people, properties, contracts };
  },

  getAvailableReports: () => MOCK_REPORTS,

  runReport: (id: string) => {
    const generatedAt = new Date().toLocaleString('ar-JO', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const today = new Date();
    const todayDateOnly = toDateOnly(today);
    const norm = (v: unknown) => String(v ?? '').trim();
    const isArchived = (rec: unknown) => asUnknownRecord(rec)['isArchived'] === true;

    // Financial Summary Report
    if (id === 'financial_summary') {
      const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS)
        .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
        .filter((i) => !isArchived(i))
        .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED);

      const withAmounts = installments
        .map((inst) => {
          const { paid, remaining } = getInstallmentPaidAndRemaining(inst);
          const due = parseDateOnly(inst.تاريخ_استحقاق);
          return { inst, paid, remaining, due };
        })
        .filter((x) => !!x.due);

      const totalExpected = installments.reduce((sum, inst) => sum + (Number(inst.القيمة) || 0), 0);
      const totalPaid = withAmounts.reduce((sum, x) => sum + (Number(x.paid) || 0), 0);

      const totalLate = withAmounts
        .filter(
          (x) =>
            (Number(x.remaining) || 0) > 0 &&
            toDateOnly(x.due as Date).getTime() < todayDateOnly.getTime()
        )
        .reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);

      const totalUpcoming = withAmounts
        .filter(
          (x) =>
            (Number(x.remaining) || 0) > 0 &&
            toDateOnly(x.due as Date).getTime() >= todayDateOnly.getTime()
        )
        .reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);

      return {
        title: 'الملخص المالي',
        generatedAt,
        columns: [
          { key: 'item', header: 'البند' },
          { key: 'value', header: 'القيمة', type: 'currency' as const },
        ],
        data: [
          { item: 'إجمالي المتوقع', value: totalExpected },
          { item: 'إجمالي المحصل', value: totalPaid },
          { item: 'إجمالي المتأخر', value: totalLate },
          { item: 'إجمالي القادم', value: totalUpcoming },
          { item: 'المتبقي', value: totalExpected - totalPaid },
        ],
        summary: [
          {
            label: 'نسبة التحصيل',
            value: `${totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0}%`,
          },
        ],
      };
    }

    // Late Installments Report
    if (id === 'late_installments') {
      const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const lateInst = installments
        .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
        .filter((i) => !isArchived(i))
        .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED)
        .map((inst) => {
          const { paid, remaining } = getInstallmentPaidAndRemaining(inst);
          const due = parseDateOnly(inst.تاريخ_استحقاق);
          return { inst, paid, remaining, due };
        })
        .filter(
          (x): x is { inst: الكمبيالات_tbl; paid: number; remaining: number; due: Date } => !!x.due
        )
        .filter((x) => x.remaining > 0 && toDateOnly(x.due).getTime() < todayDateOnly.getTime());

      const data = lateInst.map((x) => {
        const inst = x.inst;
        const contract = contracts.find((c) => c.رقم_العقد === inst.رقم_العقد);
        const tenant = contract ? people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر) : null;
        const property = contract
          ? properties.find((p) => p.رقم_العقار === contract.رقم_العقار)
          : null;

        const daysLate = daysBetweenDateOnly(toDateOnly(x.due), todayDateOnly);

        return {
          tenant: tenant?.الاسم || 'غير معروف',
          property: property?.الكود_الداخلي || 'غير معروف',
          dueDate: inst.تاريخ_استحقاق,
          amount: x.remaining,
          daysLate: `${daysLate} يوم`,
          status: inst.حالة_الكمبيالة,
        };
      });

      return {
        title: 'الأقساط المتأخرة',
        generatedAt,
        columns: [
          { key: 'tenant', header: 'المستأجر' },
          { key: 'property', header: 'العقار' },
          { key: 'dueDate', header: 'تاريخ الاستحقاق', type: 'date' as const },
          { key: 'amount', header: 'المبلغ', type: 'currency' as const },
          { key: 'daysLate', header: 'أيام التأخير' },
          { key: 'status', header: 'الحالة', type: 'status' as const },
        ],
        data,
        summary: [
          { label: 'عدد الأقساط المتأخرة', value: lateInst.length },
          {
            label: 'إجمالي المبلغ المتأخر',
            value: `${formatCurrencyJOD(lateInst.reduce((sum, i) => sum + (Number(i.remaining) || 0), 0))}`,
          },
        ],
      };
    }

    // Employee Commissions (Rent + Sale) with Opportunity Number
    if (id === 'employee_commissions') {
      const commissions = get<العمولات_tbl>(KEYS.COMMISSIONS);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const users = get<المستخدمين_tbl>(KEYS.USERS);
      const displayNameByUsername: Record<string, string> = {};
      for (const u of users) {
        const username = String(u.اسم_المستخدم || '').trim();
        if (!username) continue;
        const display = String(u.اسم_للعرض || u.اسم_المستخدم || '').trim();
        if (display) displayNameByUsername[username] = display;
      }

      const toEmployee = (usernameRaw: unknown) => {
        const username = String(usernameRaw || '').trim();
        const display = username ? displayNameByUsername[username] || username : '';
        return { employeeUsername: username, employee: display };
      };

      const agreements = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
      const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);

      type EmployeeCommissionRow = {
        type: 'إيجار' | 'بيع';
        date: string;
        reference: string;
        employeeUsername: string;
        employee: string;
        property: string;
        opportunity: string;
        officeCommission: number;
        tier: string;
        employeeBase: number;
        intro: number;
        employeeTotal: number;
      };
      const rows: EmployeeCommissionRow[] = [];

      const getCommissionMonthKey = (c: العمولات_tbl) => {
        // ✅ حسب المواصفة: الحساب على تاريخ/شهر العمولة وليس تاريخ العقد.
        const paidMonth = String(c.شهر_دفع_العمولة || '').trim();
        if (/^\d{4}-\d{2}$/.test(paidMonth)) return paidMonth;

        // تاريخ_العقد هنا يمثل تاريخ العملية/العمولة في السجل.
        const commissionDate = String(c.تاريخ_العقد || '').trim();
        if (/^\d{4}-\d{2}/.test(commissionDate)) return commissionDate.slice(0, 7);

        return '';
      };

      // ✅ Spec: rental tier is based on TOTAL rental office commission (per month).
      const rentalOfficeTotalByMonth: Record<string, number> = {};
      for (const c of commissions) {
        const monthKey = getCommissionMonthKey(c);
        const rentalTotal = Number(c.المجموع || 0) || 0;
        if (!monthKey) continue;
        rentalOfficeTotalByMonth[monthKey] =
          (rentalOfficeTotalByMonth[monthKey] || 0) + rentalTotal;
      }

      // Rent operations
      for (const c of commissions) {
        const contract = contracts.find((x) => x.رقم_العقد === c.رقم_العقد);
        const property = contract
          ? properties.find((p) => p.رقم_العقار === contract.رقم_العقار)
          : undefined;

        const { employeeUsername, employee } = toEmployee(c.اسم_المستخدم);

        const rentalTotal = Number(c.المجموع || 0) || 0;
        const introEnabled = !!c.يوجد_ادخال_عقار;
        const monthKey = getCommissionMonthKey(c);
        const monthRentalTotal = monthKey ? rentalOfficeTotalByMonth[monthKey] || 0 : 0;
        const tier = getRentalTier(monthRentalTotal);
        const employeeBase = rentalTotal * tier.rate;
        const intro = introEnabled ? rentalTotal * 0.05 : 0;
        const employeeTotal = employeeBase + intro;

        const rowDate = (() => {
          const d = String(c.تاريخ_العقد || '').trim();
          if (d) return d;
          if (monthKey) return `${monthKey}-01`;
          return '';
        })();

        rows.push({
          type: 'إيجار',
          date: rowDate,
          reference: String(c.رقم_العقد || ''),
          employeeUsername,
          employee,
          property: String(property?.الكود_الداخلي || ''),
          opportunity: String(c.رقم_الفرصة || ''),
          officeCommission: rentalTotal,
          tier: tier.tierId,
          employeeBase,
          intro,
          employeeTotal,
        });
      }

      // Sale operations
      for (const a of agreements) {
        const listing = listings.find((l) => l.id === a.listingId);
        const prop =
          a.رقم_العقار || listing?.رقم_العقار
            ? properties.find((p) => p.رقم_العقار === (a.رقم_العقار || listing?.رقم_العقار))
            : undefined;

        const { employeeUsername, employee } = toEmployee(a.اسم_المستخدم);

        // ✅ Include external broker commission fully (per request).
        // Prefer إجمالي_العمولات (buyer + seller + external). Fallback to explicit sum.
        const saleTotal =
          Number(
            a.إجمالي_العمولات ??
              (Number(a.العمولة_الإجمالية ?? 0) || 0) + (Number(a.عمولة_وسيط_خارجي ?? 0) || 0)
          ) || 0;
        const introEnabled = !!a.يوجد_ادخال_عقار;
        const breakdown = computeEmployeeCommission({
          rentalOfficeCommissionTotal: 0,
          saleOfficeCommissionTotal: saleTotal,
          propertyIntroEnabled: introEnabled,
        });

        rows.push({
          type: 'بيع',
          date: String(a.تاريخ_الاتفاقية || ''),
          reference: String(a.id || ''),
          employeeUsername,
          employee,
          property: String(prop?.الكود_الداخلي || ''),
          opportunity: String(a.رقم_الفرصة || ''),
          officeCommission: saleTotal,
          tier: '—',
          employeeBase: breakdown.totals.baseEarned,
          intro: breakdown.propertyIntro.earned,
          employeeTotal: breakdown.totals.finalEarned,
        });
      }

      // Sort by date desc if possible
      rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      const totalOffice = rows.reduce((sum, r) => sum + (Number(r.officeCommission) || 0), 0);
      const totalEmployee = rows.reduce((sum, r) => sum + (Number(r.employeeTotal) || 0), 0);
      const totalIntro = rows.reduce((sum, r) => sum + (Number(r.intro) || 0), 0);

      return {
        title: 'عمولات الموظفين (مع رقم الفرصة)',
        generatedAt,
        columns: [
          { key: 'type', header: 'النوع' },
          { key: 'date', header: 'التاريخ', type: 'date' as const },
          { key: 'reference', header: 'المرجع' },
          { key: 'employee', header: 'الموظف' },
          { key: 'property', header: 'العقار' },
          { key: 'opportunity', header: 'رقم الفرصة' },
          {
            key: 'officeCommission',
            header: 'إجمالي عمولة العملية (للمكتب)',
            type: 'currency' as const,
          },
          { key: 'tier', header: 'الشريحة' },
          {
            key: 'employeeBase',
            header: 'عمولة الموظف (قبل إدخال العقار)',
            type: 'currency' as const,
          },
          { key: 'intro', header: 'إدخال عقار (5% من إجمالي العمولة)', type: 'currency' as const },
          { key: 'employeeTotal', header: 'الإجمالي النهائي للموظف', type: 'currency' as const },
        ],
        data: rows,
        summary: [
          { label: 'عدد العمليات', value: rows.length },
          {
            label: 'إجمالي عمولات العمليات (للمكتب)',
            value: `${formatCurrencyJOD(totalOffice)}`,
          },
          { label: 'إجمالي إدخال العقار', value: `${formatCurrencyJOD(totalIntro)}` },
          { label: 'إجمالي عمولة الموظفين', value: `${formatCurrencyJOD(totalEmployee)}` },
        ],
      };
    }

    // Tenant List Report
    if (id === 'tenant_list') {
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const roles = get<شخص_دور_tbl>(KEYS.ROLES);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const tenants = people.filter((p) =>
        roles.some((r) => r.رقم_الشخص === p.رقم_الشخص && r.الدور === 'مستأجر')
      );

      const data = tenants.map((tenant) => {
        const tenantContracts = contracts.filter((c) => c.رقم_المستاجر === tenant.رقم_الشخص);
        const activeContract = pickBestTenancyContract(tenantContracts);
        const property = activeContract
          ? properties.find((p) => p.رقم_العقار === activeContract.رقم_العقار)
          : null;

        return {
          name: tenant.الاسم,
          phone: tenant.رقم_الهاتف || '-',
          property: property?.الكود_الداخلي || 'لا يوجد',
          contractStatus: activeContract?.حالة_العقد || 'منتهي',
          totalContracts: tenantContracts.length,
        };
      });

      return {
        title: 'قائمة المستأجرين',
        generatedAt,
        columns: [
          { key: 'name', header: 'الاسم' },
          { key: 'phone', header: 'رقم الهاتف' },
          { key: 'property', header: 'العقار الحالي' },
          { key: 'contractStatus', header: 'حالة العقد', type: 'status' as const },
          { key: 'totalContracts', header: 'عدد العقود' },
        ],
        data,
        summary: [
          { label: 'إجمالي المستأجرين', value: tenants.length },
          {
            label: 'المستأجرين النشطين',
            value: data.filter(
              (d) =>
                d.contractStatus !== 'منتهي' &&
                d.contractStatus !== 'ملغي' &&
                d.contractStatus !== 'مفسوخ'
            ).length,
          },
        ],
      };
    }

    // Active Contracts Report
    if (id === 'contracts_active') {
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const activeContracts = contracts.filter((c) => isTenancyRelevant(c));

      const data = activeContracts.map((contract) => {
        const tenant = people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
        const property = properties.find((p) => p.رقم_العقار === contract.رقم_العقار);

        return {
          contractNo: contract.رقم_العقد,
          tenant: tenant?.الاسم || 'غير معروف',
          property: property?.الكود_الداخلي || 'غير معروف',
          startDate: contract.تاريخ_البداية,
          endDate: contract.تاريخ_النهاية,
          monthlyRent: contract.القيمة_السنوية / 12,
          status: contract.حالة_العقد,
        };
      });

      return {
        title: 'العقود السارية',
        generatedAt,
        columns: [
          { key: 'contractNo', header: 'رقم العقد' },
          { key: 'tenant', header: 'المستأجر' },
          { key: 'property', header: 'العقار' },
          { key: 'startDate', header: 'تاريخ البداية', type: 'date' as const },
          { key: 'endDate', header: 'تاريخ النهاية', type: 'date' as const },
          { key: 'monthlyRent', header: 'الإيجار الشهري', type: 'currency' as const },
          { key: 'status', header: 'الحالة', type: 'status' as const },
        ],
        data,
        summary: [
          { label: 'عدد العقود النشطة', value: activeContracts.length },
          {
            label: 'إجمالي الإيرادات الشهرية',
            value: `${formatCurrencyJOD(activeContracts.reduce((sum, c) => sum + c.القيمة_السنوية / 12, 0))}`,
          },
        ],
      };
    }

    // Expiring Contracts Report
    if (id === 'contracts_expiring') {
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      const expiringContracts = contracts.filter((c) => {
        const endDate = new Date(c.تاريخ_النهاية);
        return isTenancyRelevant(c) && endDate >= today && endDate <= thirtyDaysFromNow;
      });

      const data = expiringContracts.map((contract) => {
        const tenant = people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
        const property = properties.find((p) => p.رقم_العقار === contract.رقم_العقار);
        const daysRemaining = Math.ceil(
          (new Date(contract.تاريخ_النهاية).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          contractNo: contract.رقم_العقد,
          tenant: tenant?.الاسم || 'غير معروف',
          property: property?.الكود_الداخلي || 'غير معروف',
          endDate: contract.تاريخ_النهاية,
          daysRemaining: `${daysRemaining} يوم`,
          monthlyRent: contract.القيمة_السنوية / 12,
        };
      });

      return {
        title: 'العقود التي ستنتهي قريباً',
        generatedAt,
        columns: [
          { key: 'contractNo', header: 'رقم العقد' },
          { key: 'tenant', header: 'المستأجر' },
          { key: 'property', header: 'العقار' },
          { key: 'endDate', header: 'تاريخ الانتهاء', type: 'date' as const },
          { key: 'daysRemaining', header: 'الأيام المتبقة' },
          { key: 'monthlyRent', header: 'الإيجار الشهري', type: 'currency' as const },
        ],
        data,
        summary: [{ label: 'عدد العقود', value: expiringContracts.length }],
      };
    }

    // Vacant Properties Report
    if (id === 'properties_vacant') {
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);

      const vacantProperties = properties.filter((p) => !p.IsRented);

      const data = vacantProperties.map((property) => {
        const owner = people.find((p) => p.رقم_الشخص === property.رقم_المالك);

        return {
          code: property.الكود_الداخلي,
          type: property.النوع,
          area: property.المساحة ? `${property.المساحة} م²` : '-',
          floor: property.الطابق || '-',
          rooms: property.عدد_الغرف || '-',
          owner: owner?.الاسم || 'غير معروف',
          location: property.العنوان || '-',
        };
      });

      return {
        title: 'العقارات الشاغرة',
        generatedAt,
        columns: [
          { key: 'code', header: 'كود العقار' },
          { key: 'type', header: 'النوع' },
          { key: 'area', header: 'المساحة' },
          { key: 'floor', header: 'الطابق' },
          { key: 'rooms', header: 'الغرف' },
          { key: 'owner', header: 'المالك' },
          { key: 'location', header: 'الموقع' },
        ],
        data,
        summary: [{ label: 'عدد العقارات الشاغرة', value: vacantProperties.length }],
      };
    }

    // Properties Data Quality Report
    if (id === 'properties_data_quality') {
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const incompleteProperties = properties.filter(
        (p) => !p.رقم_اشتراك_الكهرباء || !p.رقم_اشتراك_المياه || !p.المساحة || !p.العنوان
      );

      const data = incompleteProperties.map((property) => {
        const missing: string[] = [];
        if (!property.رقم_اشتراك_الكهرباء) missing.push('عداد الكهرباء');
        if (!property.رقم_اشتراك_المياه) missing.push('عداد الماء');
        if (!property.المساحة) missing.push('المساحة');
        if (!property.العنوان) missing.push('العنوان');

        return {
          code: property.الكود_الداخلي,
          type: property.النوع,
          missingData: missing.join(', '),
          completeness: `${Math.round(((4 - missing.length) / 4) * 100)}%`,
        };
      });

      return {
        title: 'جودة بيانات العقارات',
        generatedAt,
        columns: [
          { key: 'code', header: 'كود العقار' },
          { key: 'type', header: 'النوع' },
          { key: 'missingData', header: 'البيانات الناقصة' },
          { key: 'completeness', header: 'نسبة الاكتمال' },
        ],
        data,
        summary: [
          { label: 'عقارات تحتاج تحديث', value: incompleteProperties.length },
          {
            label: 'نسبة الجودة الإجمالية',
            value: `${Math.round(((properties.length - incompleteProperties.length) / properties.length) * 100)}%`,
          },
        ],
      };
    }

    // Maintenance Open Tickets Report
    if (id === 'maintenance_open_tickets') {
      const tickets = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);

      const openTickets = tickets.filter((t) => t.الحالة !== 'مغلق');

      const data = openTickets.map((ticket) => {
        const property = properties.find((p) => p.رقم_العقار === ticket.رقم_العقار);
        const contract = pickBestTenancyContract(
          contracts.filter((c) => c.رقم_العقار === ticket.رقم_العقار)
        );
        const tenant = contract ? people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر) : null;

        return {
          ticketNo: ticket.رقم_التذكرة,
          property: property?.الكود_الداخلي || 'غير معروف',
          tenant: tenant?.الاسم || '-',
          issue: ticket.الوصف,
          priority: ticket.الأولوية,
          status: ticket.الحالة,
          createdDate: ticket.تاريخ_الطلب,
        };
      });

      return {
        title: 'طلبات الصيانة المفتوحة',
        generatedAt,
        columns: [
          { key: 'ticketNo', header: 'رقم الطلب' },
          { key: 'property', header: 'العقار' },
          { key: 'tenant', header: 'المستأجر' },
          { key: 'issue', header: 'المشكلة' },
          { key: 'priority', header: 'الأولوية', type: 'status' as const },
          { key: 'status', header: 'الحالة', type: 'status' as const },
          { key: 'createdDate', header: 'تاريخ الإنشاء', type: 'date' as const },
        ],
        data,
        summary: [
          { label: 'عدد الطلبات المفتوحة', value: openTickets.length },
          {
            label: 'طلبات عالية الأولوية',
            value: openTickets.filter((t) => t.الأولوية === 'عالية').length,
          },
        ],
      };
    }

    // Tenant Risk Analysis Report
    if (id === 'tenant_risk_analysis') {
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const roles = get<شخص_دور_tbl>(KEYS.ROLES);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);

      const tenants = people.filter((p) =>
        roles.some((r) => r.رقم_الشخص === p.رقم_الشخص && r.الدور === 'مستأجر')
      );

      const data = tenants.map((tenant) => {
        const tenantContracts = contracts.filter((c) => c.رقم_المستاجر === tenant.رقم_الشخص);
        const tenantInstallments = installments
          .filter((i) => tenantContracts.some((c) => c.رقم_العقد === i.رقم_العقد))
          .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
          .filter((i) => !isArchived(i))
          .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED);

        const computed = tenantInstallments.map((inst) => {
          const { remaining } = getInstallmentPaidAndRemaining(inst);
          const due = parseDateOnly(inst.تاريخ_استحقاق);
          return { inst, remaining, due };
        });

        const totalInst = computed.length;
        const paidInst = computed.filter((x) => (Number(x.remaining) || 0) === 0).length;
        const lateInst = computed
          .filter((x) => (Number(x.remaining) || 0) > 0 && x.due)
          .filter((x) => toDateOnly(x.due as Date).getTime() < todayDateOnly.getTime()).length;

        const paymentRatio = totalInst > 0 ? Math.round((paidInst / totalInst) * 100) : 100;

        let riskLevel = 'منخفض';
        if (paymentRatio < 50) riskLevel = 'عالي';
        else if (paymentRatio < 80) riskLevel = 'متوسط';

        return {
          name: tenant.الاسم,
          totalInstallments: totalInst,
          paidInstallments: paidInst,
          lateInstallments: lateInst,
          paymentRatio: `${paymentRatio}%`,
          riskLevel,
        };
      });

      return {
        title: 'تحليل مخاطر المستأجرين',
        generatedAt,
        columns: [
          { key: 'name', header: 'المستأجر' },
          { key: 'totalInstallments', header: 'إجمالي الأقساط' },
          { key: 'paidInstallments', header: 'المدفوع' },
          { key: 'lateInstallments', header: 'المتأخر' },
          { key: 'paymentRatio', header: 'نسبة الالتزام' },
          { key: 'riskLevel', header: 'مستوى المخاطر', type: 'status' as const },
        ],
        data,
        summary: [
          {
            label: 'مستأجرين عالي المخاطر',
            value: data.filter((d) => d.riskLevel === 'عالي').length,
          },
          {
            label: 'مستأجرين منخفض المخاطر',
            value: data.filter((d) => d.riskLevel === 'منخفض').length,
          },
        ],
      };
    }

    // Default fallback
    return {
      title: 'تقرير',
      generatedAt,
      columns: [{ key: 'message', header: 'رسالة' }],
      data: [{ message: 'التقرير غير متوفر حالياً' }],
      summary: [],
    };
  },

  getLegalTemplates: () => get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES),
  getMergePlaceholderCatalog: (): {
    contract: Array<{ key: string; label: string }>;
    property: Array<{ key: string; label: string }>;
    tenant: Array<{ key: string; label: string }>;
    installment: Array<{ key: string; label: string }>;
  } => {
    const prettify = (raw: string) =>
      String(raw || '')
        .replace(/_/g, ' ')
        .trim();
    const uniqSorted = (arr: string[]) =>
      Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'));

    const contractFields: string[] = [];
    const propertyFields: string[] = [];
    const tenantFields: string[] = [];
    const installmentFields: string[] = [];

    for (const c of get<العقود_tbl>(KEYS.CONTRACTS)) {
      contractFields.push(...Object.keys(c));
    }
    for (const p of get<العقارات_tbl>(KEYS.PROPERTIES)) {
      propertyFields.push(...Object.keys(p));
    }
    for (const person of get<الأشخاص_tbl>(KEYS.PEOPLE)) {
      tenantFields.push(...Object.keys(person));
    }
    for (const inst of get<الكمبيالات_tbl>(KEYS.INSTALLMENTS)) {
      installmentFields.push(...Object.keys(inst));
    }

    const contract = uniqSorted(contractFields).map((f) => ({
      key: `العقد_${f}`,
      label: `العقد: ${prettify(f)}`,
    }));
    const property = uniqSorted(propertyFields).map((f) => ({
      key: `العقار_${f}`,
      label: `العقار: ${prettify(f)}`,
    }));
    const tenant = uniqSorted(tenantFields).map((f) => ({
      key: `المستأجر_${f}`,
      label: `المستأجر: ${prettify(f)}`,
    }));
    const installment = uniqSorted(installmentFields).map((f) => ({
      key: `الكمبيالة_${f}`,
      label: `الكمبيالة: ${prettify(f)}`,
    }));

    // Derived installment/dues placeholders (useful for legal notices and future merges)
    const derivedInstallment: Array<{ key: string; label: string }> = [
      { key: 'دفعات_اجمالي_المتبقي', label: 'الدفعات (محسوب): إجمالي المبلغ المتبقي' },
      { key: 'دفعات_عدد_الاقساط_المتأخرة', label: 'الدفعات (محسوب): عدد الأقساط المتأخرة' },
      { key: 'دفعات_مجموع_المتأخر', label: 'الدفعات (محسوب): مجموع المبالغ المتأخرة' },
      { key: 'دفعات_اقدم_تاريخ_استحقاق_متأخر', label: 'الدفعات (محسوب): أقدم تاريخ استحقاق متأخر' },
      { key: 'دفعات_اقصى_عدد_ايام_تأخر', label: 'الدفعات (محسوب): أقصى عدد أيام تأخر' },
    ];

    return { contract, property, tenant, installment: [...derivedInstallment, ...installment] };
  },
  getLegalNoticePlaceholderCatalog: (): {
    standard: string[];
    financial: string[];
    contractFields: string[];
    propertyFields: string[];
    tenantFields: string[];
  } => {
    const standard = [
      'contract_id',
      'contract_start_date',
      'contract_end_date',
      'tenant_name',
      'tenant_phone',
      'property_code',
      'property_address',
    ];

    const financial = [
      'total_remaining_amount',
      'overdue_installments_count',
      'overdue_amount_total',
      'overdue_oldest_due_date',
      'overdue_max_days_late',
    ];

    const contractFieldsSet = new Set<string>();
    const propertyFieldsSet = new Set<string>();
    const tenantFieldsSet = new Set<string>();

    for (const c of get<العقود_tbl>(KEYS.CONTRACTS)) {
      for (const k of Object.keys(c)) contractFieldsSet.add(String(k));
    }
    for (const p of get<العقارات_tbl>(KEYS.PROPERTIES)) {
      for (const k of Object.keys(p)) propertyFieldsSet.add(String(k));
    }
    for (const person of get<الأشخاص_tbl>(KEYS.PEOPLE)) {
      for (const k of Object.keys(person)) tenantFieldsSet.add(String(k));
    }

    const sort = (arr: string[]) => arr.filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar'));

    return {
      standard,
      financial,
      contractFields: sort(Array.from(contractFieldsSet)),
      propertyFields: sort(Array.from(propertyFieldsSet)),
      tenantFields: sort(Array.from(tenantFieldsSet)),
    };
  },
  addLegalTemplate: (t: Partial<LegalNoticeTemplate>): DbResult<null> => {
    const all = get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES);
    save(KEYS.LEGAL_TEMPLATES, [...all, { ...t, id: `TMPL-${Date.now()}` } as LegalNoticeTemplate]);
    return ok();
  },
  deleteLegalTemplate: (id: string) => {
    save(
      KEYS.LEGAL_TEMPLATES,
      get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES).filter((t) => t.id !== id)
    );
  },
  generateLegalNotice: (
    tmplId: string,
    contractId: string,
    ctx?: {
      date?: string;
      time?: string;
      extra?: Record<string, string | number | null | undefined>;
    }
  ) => {
    const tmpl = get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES).find((t) => t.id === tmplId);
    const contract = get<العقود_tbl>(KEYS.CONTRACTS).find((c) => c.رقم_العقد === contractId);
    if (!tmpl || !contract) return null;

    const property = get<العقارات_tbl>(KEYS.PROPERTIES).find(
      (p) => p.رقم_العقار === contract.رقم_العقار
    );
    const tenant = get<الأشخاص_tbl>(KEYS.PEOPLE).find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
    const owner = property?.رقم_المالك
      ? get<الأشخاص_tbl>(KEYS.PEOPLE).find((p) => p.رقم_الشخص === property.رقم_المالك)
      : undefined;

    // Financial context from installments (Single Source of Truth = installments table)
    const today = toDateOnly(new Date());
    const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter(
      (i) => i.رقم_العقد === contractId
    );
    const installmentsWithRemaining = installments
      .map((inst) => {
        const due = parseDateOnly(String(inst.تاريخ_استحقاق || ''));
        const remaining = getInstallmentPaidAndRemaining(inst).remaining;
        return { inst, due, remaining };
      })
      .filter((x) => x.remaining > 0);

    const overdue = installmentsWithRemaining
      .filter((x) => x.due && daysBetweenDateOnly(x.due, today) > 0)
      .sort((a, b) => (a.due?.getTime() || 0) - (b.due?.getTime() || 0));

    const totalRemaining = Math.round(
      installmentsWithRemaining.reduce((sum, x) => sum + (x.remaining || 0), 0)
    );
    const overdueCount = overdue.length;
    const overdueTotal = Math.round(overdue.reduce((sum, x) => sum + (x.remaining || 0), 0));
    const overdueOldestDueDate = overdue[0]?.inst?.تاريخ_استحقاق
      ? String(overdue[0].inst.تاريخ_استحقاق)
      : '';
    const overdueMaxDaysLate = overdue.length
      ? Math.max(
          0,
          ...overdue
            .map((x) => (x.due ? daysBetweenDateOnly(x.due, today) : 0))
            .filter((n) => Number.isFinite(n))
        )
      : 0;

    const replacements: Record<string, string> = {
      ...getMessageGlobalContext(),
      contract_id: String(contract.رقم_العقد || ''),
      contract_start_date: String(contract.تاريخ_البداية || ''),
      contract_end_date: String(contract.تاريخ_النهاية || ''),
      tenant_name: String(tenant?.الاسم || ''),
      tenant_phone: String(tenant?.رقم_الهاتف || ''),
      property_code: String(property?.الكود_الداخلي || contract.رقم_العقار || ''),
      property_address: String(property?.العنوان || ''),

      // Arabic aliases used by fixed legal/renewal templates
      اسم_المستأجر: String(tenant?.الاسم || ''),
      رقم_الهاتف: String(tenant?.رقم_الهاتف || ''),
      اسم_المالك: String(owner?.الاسم || ''),
      عنوان_العقار: String(property?.العنوان || ''),
      الكود_الداخلي: String(property?.الكود_الداخلي || contract.رقم_العقار || ''),
      تاريخ_نهاية_العقد: String(contract.تاريخ_النهاية || ''),

      // Installments-derived placeholders
      total_remaining_amount: String(totalRemaining || 0),
      overdue_installments_count: String(overdueCount || 0),
      overdue_amount_total: String(overdueTotal || 0),
      overdue_oldest_due_date: String(overdueOldestDueDate || ''),
      overdue_max_days_late: String(overdueMaxDaysLate || 0),

      // Arabic aliases for computed installments placeholders
      دفعات_اجمالي_المتبقي: String(totalRemaining || 0),
      دفعات_عدد_الاقساط_المتأخرة: String(overdueCount || 0),
      دفعات_مجموع_المتأخر: String(overdueTotal || 0),
      دفعات_اقدم_تاريخ_استحقاق_متأخر: String(overdueOldestDueDate || ''),
      دفعات_اقصى_عدد_ايام_تأخر: String(overdueMaxDaysLate || 0),
    };

    // Add all contract/property/tenant fields as dynamic placeholders
    // Usage in templates: {{العقد_<field>}}, {{العقار_<field>}}, {{المستأجر_<field>}}
    // (Also supports legacy: {{contract_*}}, {{property_*}}, {{tenant_*}})
    for (const [k, v] of Object.entries(contract)) {
      const value = v === null || v === undefined ? '' : String(v);
      replacements[`العقد_${String(k)}`] = value;
      replacements[`contract_${String(k)}`] = value;
    }
    if (property) {
      for (const [k, v] of Object.entries(property)) {
        const value = v === null || v === undefined ? '' : String(v);
        replacements[`العقار_${String(k)}`] = value;
        replacements[`property_${String(k)}`] = value;
      }
    }
    if (tenant) {
      for (const [k, v] of Object.entries(tenant)) {
        const value = v === null || v === undefined ? '' : String(v);
        replacements[`المستأجر_${String(k)}`] = value;
        replacements[`tenant_${String(k)}`] = value;
      }
    }

    if (ctx?.extra) {
      for (const [key, value] of Object.entries(ctx.extra)) {
        replacements[key] = value === null || value === undefined ? '' : String(value);
      }
    }

    let text = String(tmpl.content || '');

    // Replace {{tokens}}
    for (const [key, value] of Object.entries(replacements)) {
      text = text.split(`{{${key}}}`).join(value);
    }

    // Replace common Arabic bracket placeholders
    if (ctx?.date) text = text.split('[التاريخ]').join(String(ctx.date));
    if (ctx?.time) text = text.split('[الوقت]').join(String(ctx.time));

    return { text };
  },
  saveLegalNoticeHistory: (rec: Partial<LegalNoticeRecord>) => {
    const all = get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);
    save(KEYS.LEGAL_HISTORY, [
      ...all,
      { ...rec, id: `LH-${Date.now()}`, sentDate: new Date().toISOString() } as LegalNoticeRecord,
    ]);
  },
  getLegalNoticeHistory: () => get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY),

  updateLegalNoticeHistory: (
    id: string,
    patch: Partial<Pick<LegalNoticeRecord, 'note' | 'reply'>>
  ): DbResult<null> => {
    const all = get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);
    const idx = all.findIndex((x) => x.id === id);
    if (idx === -1) return fail('السجل غير موجود');
    all[idx] = { ...all[idx], ...patch } as LegalNoticeRecord;
    save(KEYS.LEGAL_HISTORY, all);
    return ok();
  },

  deleteLegalNoticeHistory: (id: string): DbResult<null> => {
    const all = get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);
    const next = all.filter((x) => x.id !== id);
    if (next.length === all.length) return fail('السجل غير موجود');
    save(KEYS.LEGAL_HISTORY, next);
    // remove attachments/notes/activities related to this legal notice record
    purgeRefs('LegalNotice', id);
    return ok();
  },

  checkSystemHealth: () => {
    try {
      const validation = validateAllData();
      const integrityWarnings = validation.warnings.length;
      const logicErrors = validation.errors.length;

      // Orphans isn't directly reported; approximate via FK errors count
      const orphans = validation.errors.filter((e) => e.includes('غير موجود')).length;

      const score = Math.max(0, Math.min(100, 100 - (logicErrors * 10 + integrityWarnings * 3)));
      const status: SystemHealth['status'] =
        score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Warning' : 'Critical';

      const categorize = (msg: string) => {
        if (msg.startsWith('تكرار')) return 'فهرسة/تكرار';
        if (msg.includes('غير موجود')) return 'علاقات/ربط';
        if (msg.includes('تاريخ')) return 'تواريخ';
        if (msg.includes('مدة')) return 'منطق/مدة';
        return 'بيانات';
      };

      const issues: SystemHealth['issues'] = [
        ...validation.errors.map((e, idx) => ({
          id: `E-${idx}`,
          type: 'Critical' as const,
          category: categorize(e),
          description: e,
        })),
        ...validation.warnings.map((w, idx) => ({
          id: `W-${idx}`,
          type: 'Warning' as const,
          category: categorize(w),
          description: w,
        })),
      ];

      return {
        score,
        status,
        issues,
        stats: {
          integrityWarnings,
          orphans,
          logicErrors,
        },
      } as SystemHealth;
    } catch (e: unknown) {
      return {
        score: 0,
        status: 'Critical',
        issues: [
          {
            id: 'HEALTH-ERR',
            type: 'Critical',
            category: 'نظام',
            description: `فشل حساب صحة النظام: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        stats: {
          integrityWarnings: 0,
          orphans: 0,
          logicErrors: 1,
        },
      } as SystemHealth;
    }
  },
  runPredictiveAnalysis: () =>
    ({
      score: 88,
      status: 'Safe',
      trend: 'Stable',
      riskFactors: [],
      recommendations: ['مراجعة العقود المنتهية'],
    }) as PredictiveInsight,
  runPerformanceBenchmark: () => [{ name: 'Query', before: 120, after: 40 }],
  optimizeSystem: () => {
    // ✅ (A) Safe cleanup: remove orphan roles referencing missing people
    const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
    const peopleIds = new Set(people.map((p) => p.رقم_الشخص));

    const rolesBefore = get<شخص_دور_tbl>(KEYS.ROLES);
    const rolesAfter = rolesBefore.filter((r) => peopleIds.has(r.رقم_الشخص));

    const removedOrphans = rolesBefore.length - rolesAfter.length;
    if (removedOrphans > 0) {
      save(KEYS.ROLES, rolesAfter);
      logOperationInternal(
        'System',
        'تنظيف بيانات',
        'Roles',
        'db_roles',
        `حذف أدوار يتيمة: ${removedOrphans}`
      );
    }

    // Rebuild cache
    buildCache();
    return ok(
      null,
      removedOrphans > 0 ? `تم تحسين النظام + حذف ${removedOrphans} دور يتيم` : 'تم تحسين النظام'
    );
  },

  // --- NEW METHODS FOR DASHBOARD WIDGETS ---

  getDashboardNotes: () =>
    get<DashboardNote>(KEYS.DASHBOARD_NOTES)
      .filter((n) => !n.isArchived)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  addDashboardNote: (note: Omit<DashboardNote, 'id' | 'createdAt' | 'isArchived'>) => {
    const all = get<DashboardNote>(KEYS.DASHBOARD_NOTES);
    save(KEYS.DASHBOARD_NOTES, [
      ...all,
      {
        ...note,
        id: `DNOTE-${Date.now()}`,
        createdAt: new Date().toISOString(),
        isArchived: false,
      },
    ]);
  },
  archiveDashboardNote: (id: string) => {
    const all = get<DashboardNote>(KEYS.DASHBOARD_NOTES);
    const idx = all.findIndex((n) => n.id === id);
    if (idx > -1) {
      all[idx].isArchived = true;
      save(KEYS.DASHBOARD_NOTES, all);
    }
  },

  getReminders: () => get<SystemReminder>(KEYS.REMINDERS).filter((r) => !r.isDone),
  addReminder: (reminder: Omit<SystemReminder, 'id' | 'isDone'>) => {
    const all = get<SystemReminder>(KEYS.REMINDERS);
    const id = `REM-${Date.now()}`;
    save(KEYS.REMINDERS, [...all, { ...reminder, id, isDone: false }]);
    try {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    } catch {
      void 0;
    }
    return id;
  },
  updateReminder: (id: string, patch: Partial<Omit<SystemReminder, 'id'>>) => {
    const all = get<SystemReminder>(KEYS.REMINDERS);
    const idx = all.findIndex((r) => r.id === id);
    if (idx > -1) {
      all[idx] = { ...all[idx], ...patch };
      save(KEYS.REMINDERS, all);
      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },
  setReminderDone: (id: string, isDone: boolean) => {
    const all = get<SystemReminder>(KEYS.REMINDERS);
    const idx = all.findIndex((r) => r.id === id);
    if (idx > -1) {
      all[idx].isDone = isDone;
      save(KEYS.REMINDERS, all);
      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },
  toggleReminder: (id: string) => {
    const all = get<SystemReminder>(KEYS.REMINDERS);
    const idx = all.findIndex((r) => r.id === id);
    if (idx > -1) {
      all[idx].isDone = !all[idx].isDone;
      save(KEYS.REMINDERS, all);
      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },

  getClientInteractions: () =>
    get<ClientInteraction>(KEYS.CLIENT_INTERACTIONS)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10),
  addClientInteraction: (data: Omit<ClientInteraction, 'id'>) => {
    const all = get<ClientInteraction>(KEYS.CLIENT_INTERACTIONS);
    save(KEYS.CLIENT_INTERACTIONS, [...all, { ...data, id: `INT-${Date.now()}` }]);
  },

  getFollowUps: () =>
    get<FollowUpTask>(KEYS.FOLLOW_UPS)
      .filter((f) => f.status === 'Pending')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
  getAllFollowUps: () =>
    get<FollowUpTask>(KEYS.FOLLOW_UPS).sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    ),
  addFollowUp: (task: Omit<FollowUpTask, 'id' | 'status'>) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const id = `FUP-${Date.now()}`;
    const nowIso = new Date().toISOString();

    // Link general tasks to reminders for unified notifications/alerts
    let reminderId: string | undefined = task.reminderId;
    if (!reminderId && task.type === 'Task' && task.dueDate && task.task) {
      const dueTime = asUnknownRecord(task)['dueTime'];
      reminderId = DbService.addReminder({
        title: task.task,
        date: task.dueDate,
        time: typeof dueTime === 'string' ? dueTime : undefined,
        type: 'Task',
      });
    }

    save(KEYS.FOLLOW_UPS, [
      ...all,
      {
        ...task,
        id,
        status: 'Pending',
        reminderId,
        createdAt: task.createdAt || nowIso,
        updatedAt: nowIso,
      },
    ]);
    try {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    } catch {
      void 0;
    }
    return id;
  },
  updateFollowUp: (id: string, patch: Partial<Omit<FollowUpTask, 'id'>>) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const idx = all.findIndex((f) => f.id === id);
    if (idx > -1) {
      const next = { ...all[idx], ...patch, updatedAt: new Date().toISOString() } as FollowUpTask;
      all[idx] = next;
      save(KEYS.FOLLOW_UPS, all);

      // Keep linked reminder aligned when task changes
      if (next.reminderId) {
        if (typeof patch.task === 'string')
          DbService.updateReminder(next.reminderId, { title: next.task });
        if (typeof patch.dueDate === 'string')
          DbService.updateReminder(next.reminderId, { date: next.dueDate });
        const patchRec = asUnknownRecord(patch);
        const dueTime = patchRec['dueTime'];
        if (typeof dueTime === 'string')
          DbService.updateReminder(next.reminderId, { time: dueTime });
        if (patch.status === 'Pending' || patch.status === 'Done')
          DbService.setReminderDone(next.reminderId, next.status === 'Done');
      }

      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },
  deleteFollowUp: (id: string) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const target = all.find((f) => f.id === id);
    save(
      KEYS.FOLLOW_UPS,
      all.filter((f) => f.id !== id)
    );
    // We intentionally do NOT delete linked reminders to preserve audit trail.
    // (They can be marked done via completion.)
    if (target?.reminderId) {
      DbService.setReminderDone(target.reminderId, true);
    }
    try {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    } catch {
      void 0;
    }
  },
  completeFollowUp: (id: string) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const idx = all.findIndex((f) => f.id === id);
    if (idx > -1) {
      all[idx].status = 'Done';
      all[idx].updatedAt = new Date().toISOString();
      save(KEYS.FOLLOW_UPS, all);
      if (all[idx].reminderId) {
        DbService.setReminderDone(all[idx].reminderId, true);
      }
      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🧾 PROPERTY INSPECTIONS - الكشوفات
  // ═══════════════════════════════════════════════════════════════════════════════
  getPropertyInspections: (propertyId: string) => {
    return get<PropertyInspection>(KEYS.INSPECTIONS)
      .filter((x) => String(x.propertyId) === String(propertyId))
      .slice()
      .sort((a, b) => String(b.inspectionDate || '').localeCompare(String(a.inspectionDate || '')));
  },
  getInspection: (id: string) =>
    get<PropertyInspection>(KEYS.INSPECTIONS).find((x) => x.id === id) || null,
  getLatestInspectionForProperty: (propertyId: string) => {
    const all = DbService.getPropertyInspections(propertyId);
    return all.length ? all[0] : null;
  },
  createInspection: (
    data: Omit<PropertyInspection, 'id' | 'createdAt' | 'updatedAt'>
  ): DbResult<PropertyInspection> => {
    if (!data?.propertyId) return fail('رقم العقار مطلوب');
    if (!data?.inspectionDate) return fail('تاريخ الكشف مطلوب');

    const all = get<PropertyInspection>(KEYS.INSPECTIONS);
    const nowIso = new Date().toISOString();
    const newRec: PropertyInspection = {
      ...data,
      id: `INS-${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    save(KEYS.INSPECTIONS, [...all, newRec]);
    logOperationInternal(
      'Admin',
      'إضافة',
      'Inspections',
      newRec.id,
      `إضافة كشف للعقار ${data.propertyId}`
    );
    return ok(newRec, 'تم إضافة الكشف');
  },
  updateInspection: (
    id: string,
    patch: Partial<Omit<PropertyInspection, 'id' | 'createdAt'>>
  ): DbResult<PropertyInspection> => {
    const all = get<PropertyInspection>(KEYS.INSPECTIONS);
    const idx = all.findIndex((x) => x.id === id);
    if (idx === -1) return fail('الكشف غير موجود');

    const next: PropertyInspection = {
      ...all[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    const updated = [...all];
    updated[idx] = next;
    save(KEYS.INSPECTIONS, updated);
    logOperationInternal('Admin', 'تعديل', 'Inspections', id, 'تعديل بيانات الكشف');
    return ok(next, 'تم تعديل الكشف');
  },
  deleteInspection: (id: string): DbResult<null> => {
    const all = get<PropertyInspection>(KEYS.INSPECTIONS);
    const target = all.find((x) => x.id === id);
    if (!target) return ok(null, 'الكشف غير موجود');
    purgeRefs('Inspection', id);
    save(
      KEYS.INSPECTIONS,
      all.filter((x) => x.id !== id)
    );
    logOperationInternal(
      'Admin',
      'حذف',
      'Inspections',
      id,
      'حذف كشف (مع المرفقات/الملاحظات/السجل)'
    );
    return ok(null, 'تم حذف الكشف');
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🗑️ RESET / CLEANUP - مسح البيانات التجريبية فقط (حفظ Users/Roles/Permissions)
  // ═══════════════════════════════════════════════════════════════════════════════
  resetAllData: () => resetOperationalData(),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 PUBLIC API: إتاحة resetAllData من خارج الملف (للـ Console / Admin Panel)
// ═══════════════════════════════════════════════════════════════════════════════
const globalRec = globalThis as unknown as Record<string, unknown>;
globalRec['resetAllData'] = () => DbService.resetAllData();
