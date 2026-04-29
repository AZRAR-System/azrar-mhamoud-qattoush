/**
 * بناء حمولات `executeAction` من `tbl_Alerts` + نصوص واتساب افتراضية حسب القالب.
 */

import type { tbl_Alerts } from '@/types';
import {
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  الكمبيالات_tbl,
  تذاكر_الصيانة_tbl,
} from '@/types';
import { DbService } from '@/services/mockDb';
import type {
  AssignTechnicianPayload,
  InsurancePayload,
  PersonProfilePayload,
  ReceiptPayload,
  RenewContractPayload,
  WhatsAppPayload,
  WhatsAppTemplateKey,
} from '@/services/alerts/alertActionTypes';

const titleOf = (a: tbl_Alerts) => String(a.نوع_التنبيه || '').trim();
const refOf = (a: tbl_Alerts) => String(a.مرجع_الجدول || '').trim();
const midOf = (a: tbl_Alerts) => String(a.مرجع_المعرف ?? '').trim();

function collectPhonesForAlert(alert: tbl_Alerts): string[] {
  const phones: Array<string | null | undefined> = [alert.phone];

  if (alert.مرجع_الجدول === 'الأشخاص_tbl' && alert.مرجع_المعرف) {
    const people = (DbService.getPeople?.() || []) as الأشخاص_tbl[];
    const person = people.find((p) => String(p?.رقم_الشخص) === String(alert.مرجع_المعرف));
    phones.push(person?.رقم_الهاتف, person?.رقم_هاتف_اضافي);
  }

  if (alert.مرجع_الجدول === 'العقود_tbl' && alert.مرجع_المعرف) {
    const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
    const contract = contracts.find((c) => String(c?.رقم_العقد) === String(alert.مرجع_المعرف));
    if (contract?.رقم_المستاجر) {
      const people = (DbService.getPeople?.() || []) as الأشخاص_tbl[];
      const tenant = people.find((p) => String(p?.رقم_الشخص) === String(contract.رقم_المستاجر));
      phones.push(tenant?.رقم_الهاتف, tenant?.رقم_هاتف_اضافي);
    }
  }

  if (alert.مرجع_الجدول === 'الكمبيالات_tbl' && alert.مرجع_المعرف) {
    const inst = (DbService.getInstallments?.() || []).find(
      (i: الكمبيالات_tbl) => String(i.رقم_الكمبيالة) === String(alert.مرجع_المعرف)
    );
    const cid = inst ? String(inst.رقم_العقد || '').trim() : '';
    if (cid) {
      const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
      const contract = contracts.find((c) => String(c?.رقم_العقد) === cid);
      if (contract?.رقم_المستاجر) {
        const people = (DbService.getPeople?.() || []) as الأشخاص_tbl[];
        const tenant = people.find((p) => String(p?.رقم_الشخص) === String(contract.رقم_المستاجر));
        phones.push(tenant?.رقم_الهاتف, tenant?.رقم_هاتف_اضافي);
      }
    }
  }

  const uniq = new Set<string>();
  for (const p of phones) {
    const v = String(p ?? '').trim();
    if (v) uniq.add(v);
  }
  return Array.from(uniq);
}

/** يستنتج قالب الرسالة من تصنيف التنبيه والعنوان */
export function inferWhatsAppTemplateKey(alert: tbl_Alerts): WhatsAppTemplateKey {
  const title = titleOf(alert);
  if (/قانون|إخطار|legal/i.test(title) || /قانون|إخطار|legal/i.test(String(alert.الوصف || ''))) {
    return 'legal_notice';
  }
  if (alert.category === 'Financial') return 'payment_reminder';
  if (alert.category === 'Expiry') return 'renewal_offer';
  return 'custom';
}

/** نص المعاينة/الإرسال عندما لا يُمرَّر `prefillBody` في الحمولة */
export function buildDefaultWhatsAppPrefillBody(
  alert: tbl_Alerts,
  templateKey: WhatsAppTemplateKey
): string {
  const name = String(alert.tenantName ?? 'المستأجر الكريم');
  const code = String(alert.propertyCode ?? '—');

  if (templateKey === 'payment_reminder') {
    if (alert.count && alert.count > 1 && alert.category === 'Financial') {
      return `مرحباً ${name}،\nنود تذكيركم قبل الاستحقاق بوجود ${alert.count} دفعات قريبة الاستحقاق للعقار (${code}).\n${alert.الوصف}.\nيرجى السداد قبل موعد الاستحقاق.`;
    }
    if (alert.category === 'Financial') {
      return `مرحباً ${name}،\nنود تذكيركم قبل الاستحقاق بوجود دفعة قريبة الاستحقاق للعقار (${code}).\n${alert.الوصف}.\nيرجى السداد قبل موعد الاستحقاق.`;
    }
    return `مرحباً ${name}،\nتذكير بالسداد بخصوص العقار (${code}):\n${alert.الوصف}`;
  }

  if (templateKey === 'renewal_offer') {
    return `مرحباً ${name}،\nعقد الإيجار الخاص بالعقار (${code}) قارب على الانتهاء.\nيرجى مراجعة المكتب للتجديد.`;
  }

  if (templateKey === 'legal_notice') {
    return `السادة ${name}،\nنود إفادتكم بخصوص إجراءات أو مراسلات قد تتطلّب المتابعة.\n${alert.الوصف}\nالعقار: ${code}.`;
  }

  return `مرحباً ${name}،\nإشعار بخصوص العقار (${code}):\n${alert.الوصف}`;
}

function resolvePersonIdForAlert(alert: tbl_Alerts): string {
  const ref = refOf(alert);
  const mid = midOf(alert);
  if (ref === 'الأشخاص_tbl' && mid) return mid;
  if (ref === 'العقود_tbl' && mid && mid !== 'batch') {
    const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
    const c = contracts.find((x) => String(x?.رقم_العقد) === mid);
    return String(c?.رقم_المستاجر || '').trim();
  }
  if (ref === 'الكمبيالات_tbl' && mid && mid !== 'batch') {
    const inst = (DbService.getInstallments?.() || []).find(
      (i: الكمبيالات_tbl) => String(i.رقم_الكمبيالة) === mid
    );
    const cid = inst ? String(inst.رقم_العقد || '').trim() : '';
    if (cid) {
      const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
      const c = contracts.find((x) => String(x?.رقم_العقد) === cid);
      return String(c?.رقم_المستاجر || '').trim();
    }
  }
  return '';
}

/** يبني حمولة واتساب؛ يعيد `null` إن لم يُعثر على رقم هاتف */
export function buildWhatsAppPayloadFromAlert(alert: tbl_Alerts): WhatsAppPayload | null {
  const phones = collectPhonesForAlert(alert);
  const phone = phones[0];
  if (!phone) return null;
  const personId = resolvePersonIdForAlert(alert) || 'unknown';
  return {
    personId,
    phone,
    templateKey: inferWhatsAppTemplateKey(alert),
  };
}

/** يبني حمولة تجديد العقد من تنبيه مرتبط بعقد */
export function buildRenewContractPayloadFromAlert(alert: tbl_Alerts): RenewContractPayload | null {
  if (refOf(alert) !== 'العقود_tbl') return null;
  const cid = midOf(alert);
  if (!cid || cid === 'batch') return null;
  const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
  const c = contracts.find((x) => String(x?.رقم_العقد) === cid);
  if (!c) return null;
  const personId = String(c.رقم_المستاجر || '').trim();
  const propertyId = String(c.رقم_العقار || '').trim();
  if (!personId || !propertyId) return null;
  const freq = Math.max(1, Number(c.تكرار_الدفع) || 1);
  const annual = Number(c.القيمة_السنوية);
  if (!Number.isFinite(annual)) return null;
  const currentRent = Math.round((annual / freq) * 100) / 100;
  const expiryDate = String(c.تاريخ_النهاية || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(expiryDate)) return null;
  return { contractId: cid, personId, propertyId, currentRent, expiryDate };
}

/** للاختبارات والتحقق من الحمولات الواردة من واجهات أخرى */
export function isValidRenewContractPayload(value: unknown): value is RenewContractPayload {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  const contractId = String(o.contractId ?? '').trim();
  const personId = String(o.personId ?? '').trim();
  const propertyId = String(o.propertyId ?? '').trim();
  const expiryDate = String(o.expiryDate ?? '').trim();
  const rent = o.currentRent;
  if (!contractId || !personId || !propertyId) return false;
  if (!/^\d{4}-\d{2}-\d{2}/.test(expiryDate)) return false;
  if (typeof rent !== 'number' || !Number.isFinite(rent) || rent < 0) return false;
  return true;
}

const readDynString = (dyn: Record<string, unknown> | undefined, keys: string[]): string => {
  if (!dyn) return '';
  for (const k of keys) {
    const v = dyn[k];
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
};

/** حمولة ملف الشخص — `view` للانتقال المباشر، `decision` لمودال القرار */
export function buildPersonProfilePayloadFromAlert(alert: tbl_Alerts): PersonProfilePayload | null {
  const ref = refOf(alert);
  const mid = midOf(alert);
  let personId = '';
  let contractId: string | undefined;

  if (ref === 'الأشخاص_tbl' && mid && mid !== 'batch') {
    personId = mid;
  } else if (ref === 'العقود_tbl' && mid && mid !== 'batch') {
    const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
    const c = contracts.find((x) => String(x?.رقم_العقد) === mid);
    const tenant = c?.رقم_المستاجر ? String(c.رقم_المستاجر).trim() : '';
    if (tenant) {
      personId = tenant;
      contractId = mid;
    }
  }

  if (!personId) return null;

  const openAction: PersonProfilePayload['openAction'] =
    alert.category === 'Risk' && ref === 'الأشخاص_tbl' ? 'decision' : 'view';

  return { personId, ...(contractId ? { contractId } : {}), openAction };
}

/** حمولة التأمين من تنبيه عقار أو عقد */
export function buildInsurancePayloadFromAlert(alert: tbl_Alerts): InsurancePayload | null {
  const ref = refOf(alert);
  const mid = midOf(alert);
  const props = (DbService.getProperties?.() || []) as العقارات_tbl[];

  if (ref === 'العقارات_tbl' && mid && mid !== 'batch') {
    const p = props.find((x) => String(x?.رقم_العقار) === mid);
    if (!p) return null;
    const dyn = (p.حقول_ديناميكية || {}) as Record<string, unknown>;
    const expiryDate = readDynString(dyn, [
      'insurance_expiry_date',
      'تاريخ_انتهاء_التأمين',
      'policy_expiry',
    ]);
    if (!/^\d{4}-\d{2}-\d{2}/.test(expiryDate)) return null;
    const currentPolicyRef = readDynString(dyn, ['insurance_policy_ref', 'policy_ref', 'رقم_البوليصة']);
    const currentProvider = readDynString(dyn, ['insurance_provider', 'مزود_التأمين', 'provider']);
    return {
      propertyId: mid,
      expiryDate,
      ...(currentPolicyRef ? { currentPolicyRef } : {}),
      ...(currentProvider ? { currentProvider } : {}),
    };
  }

  if (ref === 'العقود_tbl' && mid && mid !== 'batch') {
    const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
    const c = contracts.find((x) => String(x?.رقم_العقد) === mid);
    const propertyId = c?.رقم_العقار ? String(c.رقم_العقار).trim() : '';
    const exp = c?.تاريخ_النهاية ? String(c.تاريخ_النهاية).trim() : '';
    if (!propertyId || !/^\d{4}-\d{2}-\d{2}/.test(exp)) return null;
    return { propertyId, expiryDate: exp };
  }

  return null;
}

export function isValidInsurancePayload(value: unknown): value is InsurancePayload {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  const propertyId = String(o.propertyId ?? '').trim();
  const expiryDate = String(o.expiryDate ?? '').trim();
  if (!propertyId) return false;
  if (!/^\d{4}-\d{2}-\d{2}/.test(expiryDate)) return false;
  return true;
}

const mapTicketPriorityToPayload = (p: string): AssignTechnicianPayload['priority'] => {
  const n = String(p || '').trim();
  if (n === 'عالية') return 'high';
  if (n === 'منخفضة') return 'low';
  return 'medium';
};

const normalizeDateOnly = (raw: string): string => {
  const t = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
};

export function buildAssignTechnicianPayloadFromAlert(
  alert: tbl_Alerts
): AssignTechnicianPayload | null {
  const ref = refOf(alert);
  const mid = midOf(alert);
  if (ref !== 'تذاكر_الصيانة_tbl' || !mid || mid === 'batch') return null;
  const tickets = (DbService.getMaintenanceTickets?.() || []) as تذاكر_الصيانة_tbl[];
  const t = tickets.find((x) => String(x?.رقم_التذكرة) === mid);
  if (!t) return null;
  const dyn = (t.حقول_ديناميكية || {}) as Record<string, unknown>;
  const unitRaw = readDynString(dyn, ['unit_ref', 'رقم_الوحدة', 'رقم_الشقة']);
  const unitRef = unitRaw || undefined;
  const propertyId = String(t.رقم_العقار || '').trim();
  if (!propertyId) return null;
  return {
    maintenanceId: String(t.رقم_التذكرة),
    propertyId,
    issueDescription: String(t.الوصف || '').trim() || '—',
    priority: mapTicketPriorityToPayload(String(t.الأولوية || '')),
    ...(unitRef ? { unitRef } : {}),
  };
}

/** `paidAt` من آخر دفعة في `سجل_الدفعات`، أو من `تاريخ_الدفع` عند عدم وجود سجل */
export function buildReceiptPayloadFromAlert(alert: tbl_Alerts): ReceiptPayload | null {
  const ref = refOf(alert);
  const mid = midOf(alert);
  if (ref !== 'الكمبيالات_tbl' || !mid || mid === 'batch') return null;
  const insts = (DbService.getInstallments?.() || []) as الكمبيالات_tbl[];
  const inst = insts.find((i) => String(i?.رقم_الكمبيالة) === mid);
  if (!inst) return null;
  const contractId = String(inst.رقم_العقد || '').trim();
  if (!contractId) return null;
  const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
  const c = contracts.find((x) => String(x?.رقم_العقد) === contractId);
  const personId = c?.رقم_المستاجر ? String(c.رقم_المستاجر).trim() : '';
  if (!personId) return null;

  const ledger = [...(inst.سجل_الدفعات || [])].sort((a, b) =>
    String(b.التاريخ || '').localeCompare(String(a.التاريخ || ''))
  );

  let paidAt = '';
  let amount = 0;
  let paymentMethod = '—';

  if (ledger.length > 0) {
    const last = ledger[0];
    paidAt = normalizeDateOnly(String(last.التاريخ || ''));
    amount = Number(last.المبلغ) || 0;
    paymentMethod = String(last.الملاحظات || last.النوع || '—').trim() || '—';
  } else {
    const payDate = String(inst.تاريخ_الدفع || '').trim();
    if (!payDate) return null;
    paidAt = normalizeDateOnly(payDate);
    amount = Number(inst.القيمة) || 0;
    paymentMethod = String(inst.حالة_الكمبيالة || 'سجل غير مفصل').trim();
  }

  if (!/^\d{4}-\d{2}-\d{2}/.test(paidAt)) return null;

  return {
    installmentId: mid,
    contractId,
    personId,
    amount,
    paidAt,
    paymentMethod,
  };
}
