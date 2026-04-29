/**
 * سياسة موحّدة لتنبيهات tbl_Alerts: تصنيف النوع → زر القائمة → وجهة الفتح (مودال / منزلق / قسم / لوحة دفع).
 * يفصل منطق التوجيه عن واجهة الصفحة ويسهّل المراجعة والاختبار.
 */

import type { tbl_Alerts } from '@/types';
import type { PanelProps, PanelType } from '@/context/ModalContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { DbService } from '@/services/mockDb';
import type { OpenModalFn } from '@/context/ModalContext';
import type { OpenSectionPanelFn } from '@/services/alerts/alertNavigation';
import type {
  AlertActionPayload,
  AlertClass,
  AlertLayerModalKind,
  AlertPrimaryAction,
  AlertSecondaryAction,
} from '@/services/alerts/alertActionTypes';

/** عناوين ثابتة من `backgroundScans` ومصادر أخرى — لا تعتمد على الوصف فقط */
export const ALERT_TITLE_REMINDER_7D = 'تذكير قبل الاستحقاق (7 أيام)';
export const ALERT_TITLE_RISK_COLLECTION = 'مخاطر تحصيل (دفعات متأخرة)';
export const ALERT_TITLE_EXPIRY_NEAR = 'قرب انتهاء العقد';
export const ALERT_TITLE_AUTO_RENEW = 'تجديد تلقائي قادم';

export type AlertPrimaryMode = 'modal' | 'destination';

export interface AlertPrimarySpec {
  mode: AlertPrimaryMode;
  /** نص زر البطاقة الرئيسي */
  label: string;
  /** وصف قصير لشارة المساعدة (اختياري) */
  hint?: string;
}

type OpenPanel = (type: PanelType, dataId?: string, props?: PanelProps) => void;

const refOf = (a: tbl_Alerts) => String(a.مرجع_الجدول || '').trim();
const midOf = (a: tbl_Alerts) => String(a.مرجع_المعرف ?? '').trim();
export const titleOf = (a: tbl_Alerts) => String(a.نوع_التنبيه || '').trim();
export const intentKeyOf = (a: tbl_Alerts) => {
  const id = String(a.id || '').trim();
  const title = titleOf(a);
  const ref = refOf(a);
  const mid = midOf(a);
  return ['alerts', id || title || 'unknown', ref || 'no-ref', mid || 'no-id'].join('|');
};

/** تنبيهات «المهام / المتابعة» (مثلاً مزامنة الشريط أو تنبيهات لاحقة) */
export function isTasksFollowUpTitle(title: string): boolean {
  const t = String(title || '').trim();
  if (!t) return false;
  if (t.includes('مهام')) return true;
  if (t.includes('متابعة') && (t.includes('تقويم') || t.includes('مفتوحة'))) return true;
  return false;
}

/** فتح لوحة السداد مع تهيئة فلترة/استهداف من التنبيه */
function openInstallmentsWithTarget(
  openPanel: OpenPanel,
  target: {
    contractId?: string;
    installmentId?: string;
    filter?: 'all' | 'debt' | 'due' | 'paid';
    onlyTargetPanel?: boolean;
    intentKey?: string;
  }
) {
  openPanel('SECTION_VIEW', ROUTE_PATHS.INSTALLMENTS, {
    title: 'لوحة السداد الرئيسية',
    fromAlert: true,
    ...target,
  });
}

/** فتح لوحة السداد المخصصة للتنبيه (مع استهداف عقد/دفعة عند التوفر) */
function openCollectionDetailsOrSettlement(alert: tbl_Alerts, openPanel: OpenPanel) {
  const ref = refOf(alert);
  const mid = midOf(alert);
  let contractId = '';
  let installmentId = '';

  if (ref === 'العقود_tbl' && mid && mid !== 'batch') {
    contractId = mid;
    const firstFromDetails = String(alert.details?.[0]?.id || '').trim();
    if (firstFromDetails) installmentId = firstFromDetails;
  }
  if (ref === 'الكمبيالات_tbl' && mid && mid !== 'batch') {
    installmentId = mid;
    if (!contractId) {
      const inst = (DbService.getInstallments?.() || []).find((i) => String(i.رقم_الكمبيالة) === mid);
      const cid = inst ? String(inst.رقم_العقد || '').trim() : '';
      if (cid) contractId = cid;
    }
  }

  if (!installmentId && contractId) {
    const list = (DbService.getInstallments?.() || []).filter(
      (i) =>
        String(i.رقم_العقد || '').trim() === contractId &&
        String(i.حالة_الكمبيالة || '').trim() !== 'مدفوع' &&
        String(i.حالة_الكمبيالة || '').trim() !== 'ملغي'
    );
    if (list.length > 0) {
      list.sort((a, b) => String(a.تاريخ_استحقاق || '').localeCompare(String(b.تاريخ_استحقاق || '')));
      installmentId = String(list[0]?.رقم_الكمبيالة || '').trim();
    }
  }

  openInstallmentsWithTarget(openPanel, {
    contractId,
    installmentId,
    filter: 'debt',
    onlyTargetPanel: true,
    intentKey: intentKeyOf(alert),
  });
}

/** لوحة المهام والمتابعة (تقويم الأحداث) */
function openTasksFollowUpPanel(openPanel: OpenPanel) {
  const ymd = new Date().toISOString().slice(0, 10);
  openPanel('CALENDAR_EVENTS', ymd, { title: 'المهام والمتابعة' });
}

/** تنبيهات تحتاج مودال الإجراءات (واتساب، جدول تفاصيل، …) */
export function shouldOpenModalFirst(alert: tbl_Alerts): boolean {
  const title = titleOf(alert);
  if (title === ALERT_TITLE_REMINDER_7D || title === ALERT_TITLE_RISK_COLLECTION) return false;
  if (isTasksFollowUpTitle(title)) return false;

  const cat = alert.category;
  if (cat === 'Financial' || cat === 'DataQuality') return true;
  if (cat === 'Risk') {
    const ref = refOf(alert);
    if (ref === 'العقود_tbl') return true;
    const n = alert.details?.length ?? 0;
    if (n > 1) return true;
    return false;
  }
  return false;
}

/**
 * زر البطاقة: إمّا فتح المودال أو الانتقال مباشرة للوجهة (أقل نقرات) عندما الإجراءات كلها في لوحة التفاصيل.
 */
export function getAlertPrimarySpec(alert: tbl_Alerts): AlertPrimarySpec {
  const title = titleOf(alert);

  if (title === ALERT_TITLE_REMINDER_7D || title === ALERT_TITLE_RISK_COLLECTION) {
    return {
      mode: 'destination',
      label: 'لوحة السداد',
      hint: title === ALERT_TITLE_REMINDER_7D ? 'تنبيهات الدفعات قريبة الاستحقاق' : 'متابعة التأخير والتحصيل',
    };
  }

  if (isTasksFollowUpTitle(title)) {
    return { mode: 'destination', label: 'المهام والمتابعة', hint: 'التقويم والمتابعات' };
  }

  if (shouldOpenModalFirst(alert)) {
    if (alert.category === 'Financial') {
      return { mode: 'modal', label: 'مراجعة وتحصيل', hint: 'واتساب، إخطار، ملاحظة' };
    }
    if (alert.category === 'DataQuality') {
      return { mode: 'modal', label: 'مراجعة البيانات', hint: 'إرسال واتساب، تفاصيل النقص' };
    }
    return { mode: 'modal', label: 'مراجعة المخاطر', hint: 'قائمة المتأخرات أو المخاطر' };
  }

  const ref = refOf(alert);
  const mid = midOf(alert);

  if (alert.category === 'Expiry' && ref === 'العقود_tbl' && mid && mid !== 'batch') {
    if (title === ALERT_TITLE_EXPIRY_NEAR || title === ALERT_TITLE_AUTO_RENEW) {
      return { mode: 'destination', label: 'تفاصيل العقد', hint: 'انتهاء أو تجديد' };
    }
    return { mode: 'destination', label: 'فتح العقد', hint: 'انتهاء / تجديد' };
  }

  if (ref === 'تذاكر_الصيانة_tbl') {
    return { mode: 'destination', label: 'فتح الصيانة', hint: 'تذاكر ومهام الصيانة' };
  }

  if (alert.category === 'Risk' && ref === 'الأشخاص_tbl' && mid && mid !== 'batch') {
    return { mode: 'destination', label: 'فتح الملف', hint: 'قائمة سوداء / مخاطر شخص' };
  }

  if (alert.category === 'SmartBehavior') {
    if (ref === 'العقود_tbl' && mid && mid !== 'batch') {
      return { mode: 'destination', label: 'فتح العقد', hint: 'سلوك غير اعتيادي' };
    }
    return { mode: 'destination', label: 'فتح الأدوات الذكية', hint: 'تحليل السلوك' };
  }

  if (ref === 'العقود_tbl' && mid && mid !== 'batch') {
    return { mode: 'destination', label: 'فتح العقد' };
  }

  if (ref === 'الكمبيالات_tbl' && mid && mid !== 'batch') {
    return { mode: 'destination', label: 'فتح العقد والدفعات' };
  }

  if (ref === 'العقارات_tbl' && mid && mid !== 'batch') {
    return { mode: 'destination', label: 'فتح العقار' };
  }

  if (ref === 'الأشخاص_tbl' && mid && mid !== 'batch') {
    return { mode: 'destination', label: 'فتح الملف' };
  }

  if (ref === 'System') {
    return { mode: 'destination', label: 'فتح العمليات', hint: 'تنبيه نظام عام' };
  }

  if (ref === 'الكمبيالات_tbl' && (mid === 'batch' || !mid)) {
    return { mode: 'destination', label: 'متابعة الدفعات المستحقة', hint: 'مجمّع أو بدون معرّف' };
  }
  if (ref === 'العقارات_tbl' && (mid === 'batch' || !mid)) {
    return { mode: 'destination', label: 'فتح قائمة العقارات' };
  }
  if (ref === 'الأشخاص_tbl' && (mid === 'batch' || !mid)) {
    return { mode: 'destination', label: 'فتح قائمة الأشخاص' };
  }
  if (ref === 'العقود_tbl' && (mid === 'batch' || !mid)) {
    return { mode: 'destination', label: 'فتح قائمة العقود' };
  }

  return { mode: 'modal', label: 'مراجعة وإجراء' };
}

const openSection = (openPanel: OpenPanel, path: string, title: string) => {
  openPanel('SECTION_VIEW', path, { title });
};

/**
 * فتح الوجهة المناسبة للتنبيه دون تغيير hash — يُستدعى من المودال أو من زر البطاقة المباشر.
 */
export function executeAlertOpen(alert: tbl_Alerts, openPanel: OpenPanel): void {
  const title = titleOf(alert);
  const ref = refOf(alert);
  const mid = midOf(alert);

  if (title === ALERT_TITLE_REMINDER_7D) {
    openCollectionDetailsOrSettlement(alert, openPanel);
    return;
  }
  if (title === ALERT_TITLE_RISK_COLLECTION) {
    openCollectionDetailsOrSettlement(alert, openPanel);
    return;
  }
  if (isTasksFollowUpTitle(title)) {
    openTasksFollowUpPanel(openPanel);
    return;
  }

  if (ref === 'تذاكر_الصيانة_tbl') {
    openSection(openPanel, ROUTE_PATHS.MAINTENANCE, 'الصيانة');
    return;
  }

  if (ref === 'العقود_tbl') {
    if (mid && mid !== 'batch') {
      openPanel('CONTRACT_DETAILS', mid);
    } else {
      openSection(openPanel, ROUTE_PATHS.CONTRACTS, 'العقود');
    }
    return;
  }

  if (ref === 'الكمبيالات_tbl') {
    if (mid && mid !== 'batch') {
      const inst = (DbService.getInstallments?.() || []).find((i) => String(i.رقم_الكمبيالة) === mid);
      const cid = inst ? String(inst.رقم_العقد || '').trim() : '';
      if (cid) {
        openPanel('CONTRACT_DETAILS', cid);
      } else {
        openSection(openPanel, ROUTE_PATHS.INSTALLMENTS, 'الدفعات');
      }
    } else {
      openSection(openPanel, ROUTE_PATHS.INSTALLMENTS, 'الدفعات — مستحقات');
    }
    return;
  }

  if (ref === 'العقارات_tbl') {
    if (mid === 'batch') {
      openSection(openPanel, ROUTE_PATHS.PROPERTIES, 'العقارات');
    } else if (mid) {
      openPanel('PROPERTY_DETAILS', mid);
    } else {
      openSection(openPanel, ROUTE_PATHS.PROPERTIES, 'العقارات');
    }
    return;
  }

  if (ref === 'الأشخاص_tbl') {
    if (mid === 'batch') {
      openSection(openPanel, ROUTE_PATHS.PEOPLE, 'الأشخاص');
    } else if (mid) {
      openPanel('PERSON_DETAILS', mid);
    } else {
      openSection(openPanel, ROUTE_PATHS.PEOPLE, 'الأشخاص');
    }
    return;
  }

  if (ref === 'System') {
    openSection(openPanel, ROUTE_PATHS.OPERATIONS, 'العمليات');
    return;
  }

  if (alert.category === 'SmartBehavior') {
    openSection(openPanel, ROUTE_PATHS.SMART_TOOLS, 'الأدوات الذكية');
    return;
  }

  openSection(openPanel, ROUTE_PATHS.DASHBOARD, 'الرئيسية');
}

/** نفس `getAlertPrimarySpec` — اسم المستند: resolvePrimaryAction */
export const resolvePrimaryAction = getAlertPrimarySpec;

/** بناء لاحقة الاستعلام لمسار التنبيهات في الـ hash router */
export function buildAlertsHashSuffix(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && String(v).trim() !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function classifyAlert(alert: tbl_Alerts): AlertClass {
  const title = titleOf(alert);
  if (title === ALERT_TITLE_REMINDER_7D || title === ALERT_TITLE_RISK_COLLECTION) {
    return 'collection_board';
  }
  if (isTasksFollowUpTitle(title)) return 'tasks_followup';

  const ref = refOf(alert);
  const cat = String(alert.category || '').trim();

  if (ref === 'تذاكر_الصيانة_tbl') return 'maintenance';
  if (cat === 'Financial') return 'financial';
  if (cat === 'DataQuality') return 'data_quality';
  if (cat === 'Risk') return 'risk';
  if (cat === 'Expiry') return 'expiry';
  if (cat === 'SmartBehavior') return 'smart_behavior';

  if (ref === 'الأشخاص_tbl') return 'person';
  if (ref === 'العقارات_tbl') return 'property';
  if (ref === 'العقود_tbl') return 'contract';
  if (ref === 'الكمبيالات_tbl') return 'installment';
  if (ref === 'System') return 'system';

  return 'generic';
}

const pushLayer = (
  list: AlertSecondaryAction[],
  id: string,
  label: string,
  layer: AlertLayerModalKind
) => {
  list.push({ id, label, type: 'layer', layer });
};

/**
 * إجراءات ثانوية (طبقات مودال أو انتقال كامل) لشريط التفاصيل في Inbox/Triage.
 */
export function resolveSecondaryActions(alert: tbl_Alerts): AlertSecondaryAction[] {
  const actions: AlertSecondaryAction[] = [];
  const ref = refOf(alert);
  const mid = midOf(alert);
  const cls = classifyAlert(alert);
  const spec = getAlertPrimarySpec(alert);

  if (spec.mode === 'destination') {
    actions.push({ id: 'nav_primary', label: 'التفاصيل الكاملة', type: 'navigate' });
  }

  if (cls === 'financial' || cls === 'collection_board') {
    pushLayer(actions, 'layer_whatsapp', 'واتساب (موسّع)', 'whatsapp');
    pushLayer(actions, 'layer_payment', 'السداد والكمبيالة', 'record_payment');
    pushLayer(actions, 'layer_receipt', 'ملخص مالي / إيصال', 'receipt');
    if (alert.مرجع_المعرف !== 'batch') {
      pushLayer(actions, 'layer_legal', 'إخطار قانوني', 'legal_file');
    }
  }

  if (cls === 'data_quality') {
    pushLayer(actions, 'layer_whatsapp', 'واتساب (موسّع)', 'whatsapp');
  }

  if (cls === 'risk') {
    pushLayer(actions, 'layer_whatsapp', 'واتساب (موسّع)', 'whatsapp');
    if (alert.مرجع_المعرف !== 'batch') {
      pushLayer(actions, 'layer_legal', 'إخطار قانوني', 'legal_file');
    }
    if (ref === 'الأشخاص_tbl' && mid && mid !== 'batch') {
      pushLayer(actions, 'layer_person', 'ملف الشخص', 'person_profile');
    }
  }

  if (cls === 'expiry' && ref === 'العقود_tbl' && mid && mid !== 'batch') {
    pushLayer(actions, 'layer_renew', 'رسائل التجديد والانتهاء', 'renew_contract');
    pushLayer(actions, 'layer_whatsapp', 'واتساب (موسّع)', 'whatsapp');
    pushLayer(actions, 'layer_insurance', 'التأمين والعقد', 'insurance');
    pushLayer(actions, 'layer_legal', 'إخطار قانوني', 'legal_file');
  }

  if (cls === 'maintenance') {
    pushLayer(actions, 'layer_tech', 'تعيين فني / الصيانة', 'assign_technician');
  }

  if (actions.length === 0) {
    pushLayer(actions, 'layer_whatsapp', 'واتساب (موسّع)', 'whatsapp');
    if (alert.مرجع_المعرف !== 'batch') {
      pushLayer(actions, 'layer_legal', 'إخطار قانوني', 'legal_file');
    }
  }

  const seen = new Set<string>();
  return actions.filter((a) => {
    const k = `${a.type}:${a.type === 'layer' ? a.layer : a.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

let lastExecuteIntent: { key: string; at: number } = { key: '', at: 0 };
const EXECUTE_DEDUPE_MS = 750;

/** لاختبارات الوحدة — إعادة ضبط حارس التنفيذ المزدوج */
export function resetExecuteActionDedupeForTests(): void {
  lastExecuteIntent = { key: '', at: 0 };
}

export interface ExecuteActionOptions {
  /** تجاوز حارس التنفيذ المزدوج (اختبارات فقط) */
  skipDedupe?: boolean;
}

/**
 * تنفيذ إجراء تنبيه: تنقّل عبر `openPanel` أو نافذة طبقة عبر `openModal` حسب الحمولة.
 * `execute_alert_open` يحتفظ بحارس التنفيذ المزدوج على `intentKey`.
 */
export function executeAction(
  action: AlertPrimaryAction | AlertSecondaryAction,
  payload: AlertActionPayload,
  openPanel: OpenSectionPanelFn,
  openModal: OpenModalFn,
  options?: ExecuteActionOptions
): void {
  void action;

  if (payload.variant === 'execute_alert_open') {
    const key = intentKeyOf(payload.alert);
    const now = Date.now();
    if (
      !options?.skipDedupe &&
      lastExecuteIntent.key === key &&
      now - lastExecuteIntent.at < EXECUTE_DEDUPE_MS
    ) {
      return;
    }
    lastExecuteIntent = { key, at: now };
    executeAlertOpen(payload.alert, openPanel as OpenPanel);
    return;
  }

  if (payload.variant === 'record_payment') {
    openModal('record_payment', {
      sourceAlert: payload.alert,
      alertActionPayload: payload,
      onNavigateFull: () => {
        executeAlertOpen(payload.alert, openPanel as OpenPanel);
      },
    });
    return;
  }

  if (payload.variant === 'legal_file') {
    openModal('legal_file', {
      sourceAlert: payload.alert,
      alertActionPayload: payload,
      onOpenLegalGenerator: () => {
        openPanel('LEGAL_NOTICE_GENERATOR', payload.data.contractId);
      },
    });
    return;
  }

  if (payload.variant === 'whatsapp') {
    openModal('whatsapp', {
      sourceAlert: payload.alert,
      alertActionPayload: payload,
      onNavigateFull: () => {
        executeAlertOpen(payload.alert, openPanel as OpenPanel);
      },
    });
    return;
  }

  if (payload.variant === 'renew_contract') {
    openModal('renew_contract', {
      sourceAlert: payload.alert,
      alertActionPayload: payload,
      onNavigateFull: () => {
        executeAlertOpen(payload.alert, openPanel as OpenPanel);
      },
    });
    return;
  }

  if (payload.variant === 'person_profile') {
    if (payload.data.openAction === 'view') {
      // ليس ضمن حارس التنفيذ المزدوج لـ `execute_alert_open`. `intentKeyOf` يضم `مرجع_الجدول|مرجع_المعرف`
      // فيتغيّر المفتاح عن التنبيه الأصلي عند التوجيه الاصطناعي للشخص (مع ثبات `alert.id`).
      executeAlertOpen(
        {
          ...payload.alert,
          مرجع_الجدول: 'الأشخاص_tbl',
          مرجع_المعرف: payload.data.personId,
        } as tbl_Alerts,
        openPanel as OpenPanel
      );
      return;
    }
    openModal('person_profile', {
      sourceAlert: payload.alert,
      alertActionPayload: payload,
      onNavigateFull: () => {
        executeAlertOpen(payload.alert, openPanel as OpenPanel);
      },
    });
    return;
  }

  if (payload.variant === 'insurance') {
    openModal('insurance', {
      sourceAlert: payload.alert,
      alertActionPayload: payload,
      onOpenContract: () => {
        openPanel('PROPERTY_DETAILS', payload.data.propertyId);
      },
    });
    return;
  }

  if (payload.variant === 'assign_technician') {
    openModal('assign_technician', {
      sourceAlert: payload.alert,
      alertActionPayload: payload,
      onNavigateFull: () => {
        executeAlertOpen(payload.alert, openPanel as OpenPanel);
      },
      onOpenMaintenance: () => {
        try {
          window.location.hash = ROUTE_PATHS.MAINTENANCE;
        } catch {
          /* ignore */
        }
      },
    });
    return;
  }

  if (payload.variant === 'receipt') {
    openModal('receipt', {
      sourceAlert: payload.alert,
      alertActionPayload: payload,
      onNavigateFull: () => {
        executeAlertOpen(payload.alert, openPanel as OpenPanel);
      },
    });
    return;
  }

  const _exhaustive: never = payload;
  void _exhaustive;
}

/** فتح وجهة التنبيه الكلاسيكية (مكافئ سابق `executeAction(alert, openPanel)`) */
export function executeNavigateForAlert(
  alert: tbl_Alerts,
  openPanel: OpenPanel,
  openModal: OpenModalFn,
  options?: ExecuteActionOptions
): void {
  executeAction(
    { role: 'primary', mode: 'destination', label: '' },
    { variant: 'execute_alert_open', alert },
    openPanel as OpenSectionPanelFn,
    openModal,
    options
  );
}
