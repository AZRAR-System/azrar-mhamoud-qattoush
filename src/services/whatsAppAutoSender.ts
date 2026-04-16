/**
 * إرسال واتساب تلقائي للدفعات — سياسات زمنية + ساعات عمل + منع التكرار خلال 24 ساعة.
 */

import type { SystemSettings } from '@/types';
import type { الكمبيالات_tbl, العقود_tbl, الأشخاص_tbl, العقارات_tbl } from '@/types';
import { formatCurrencyJOD } from '@/utils/format';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import {
  addNotificationSendLogInternal,
  type NotificationSendLogRecord,
} from '@/services/db/paymentNotifications';
import { get } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { getInstallmentPaidAndRemaining } from '@/services/db/installments';
import { getTemplate } from '@/services/db/messageTemplates';
import { fillTemplate } from '@/services/notificationTemplates';

const LATE_DAYS_AFTER_DUE = 3;

export type WhatsAppAutoKind = 'before_due' | 'due_today' | 'late';

function isWithinWorkHours(settings: SystemSettings): boolean {
  const start = Math.max(0, Math.min(23, Math.floor(Number(settings.whatsAppWorkHoursStart ?? 8))));
  const end = Math.max(0, Math.min(24, Math.floor(Number(settings.whatsAppWorkHoursEnd ?? 20))));
  const h = new Date().getHours();
  if (end <= start) return h >= start || h < end;
  return h >= start && h < end;
}

/** أي إرسال واتساب تلقائي لنفس الكمبيالة خلال آخر 24 ساعة */
export function hasRecentAutoSendForInstallment(installmentId: string): boolean {
  const logs = get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS) || [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const log of logs) {
    if (!log.installmentIds?.includes(installmentId)) continue;
    if (!String(log.category || '').startsWith('whatsapp_auto')) continue;
    const t = Date.parse(log.sentAt);
    if (Number.isFinite(t) && t >= cutoff) return true;
  }
  return false;
}

/**
 * يحدد نوع الإرسال التلقائي لهذا اليوم، أو null إن لم يكن اليوم مناسباً.
 */
export function classifyAutoSendKind(
  daysUntilDue: number,
  delayDays: number
): WhatsAppAutoKind | null {
  const d = Math.max(1, Math.min(30, Math.floor(delayDays) || 3));
  if (daysUntilDue === d) return 'before_due';
  if (daysUntilDue === 0) return 'due_today';
  if (daysUntilDue === -LATE_DAYS_AFTER_DUE) return 'late';
  return null;
}

export function classifyAlertType(daysUntilDue: number): string | null {
  if (daysUntilDue === 0) return 'due_today';
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7) return 'upcoming';
  return null;
}

function buildMessage(
  kind: WhatsAppAutoKind,
  ctx: {
    tenantName: string;
    amount: number;
    dueDate: string;
    contractId: string;
    propertyCode?: string;
    delayDays: number;
  }
): string {
  const prop = ctx.propertyCode ? ` — العقار: ${ctx.propertyCode}` : '';
  const amt = formatCurrencyJOD(ctx.amount);
  const templateId =
    kind === 'before_due'
      ? 'pre_due_reminder'
      : kind === 'due_today'
        ? 'due_day_reminder'
        : 'post_late_reminder';

  const raw = getTemplate(templateId);
  if (raw.trim().length > 0) {
    const filled = fillTemplate(raw, {
      tenantName: ctx.tenantName,
      amount: ctx.amount,
      dueDate: ctx.dueDate,
      contractNumber: ctx.contractId,
      propertyCode: ctx.propertyCode ?? '',
      remainingAmount: ctx.amount,
      daysLate: LATE_DAYS_AFTER_DUE,
    });
    if (filled.trim().length > 0) return filled;
  }

  switch (kind) {
    case 'before_due':
      return `مرحباً ${ctx.tenantName}،\nتذكير ودي: لديك دفعة مستحقة خلال ${ctx.delayDays} أيام بقيمة ${amt} د.أ — تاريخ الاستحقاق ${ctx.dueDate} — عقد ${ctx.contractId}${prop}\nشكراً لتعاونكم.`;
    case 'due_today':
      return `${ctx.tenantName}،\nتنبيه استحقاق: اليوم موعد دفعة بقيمة ${amt} د.أ — تاريخ الاستحقاق ${ctx.dueDate} — عقد ${ctx.contractId}${prop}\nيرجى التنسيق لإتمام السداد.`;
    case 'late':
      return `${ctx.tenantName}،\nتنبيه تأخر: مرّت ${LATE_DAYS_AFTER_DUE} أيام على استحقاق دفعة بقيمة ${amt} د.أ — كان الاستحقاق ${ctx.dueDate} — عقد ${ctx.contractId}${prop}\nيرجى السداد في أقرب وقت.`;
    default:
      return '';
  }
}

function categoryForKind(kind: WhatsAppAutoKind): string {
  switch (kind) {
    case 'before_due':
      return 'whatsapp_auto_before';
    case 'due_today':
      return 'whatsapp_auto_due';
    case 'late':
      return 'whatsapp_auto_late';
    default:
      return 'whatsapp_auto';
  }
}

export type SendReminderParams = {
  installment: الكمبيالات_tbl;
  contract: العقود_tbl;
  tenant: الأشخاص_tbl | undefined;
  property: العقارات_tbl | undefined;
  settings: SystemSettings;
  kind: WhatsAppAutoKind;
};

/**
 * يفتح واتساب ويسجّل الإرسال. يُستدعى فقط بعد اجتياز كل الشروط.
 */
export async function sendReminder(p: SendReminderParams): Promise<void> {
  const { installment, contract, tenant, property, settings, kind } = p;
  const phones = [tenant?.رقم_الهاتف, tenant?.رقم_هاتف_اضافي].filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0
  );
  if (phones.length === 0) return;

  const { remaining } = getInstallmentPaidAndRemaining(installment);

  const delayDays = Math.max(
    1,
    Math.min(30, Math.floor(Number(settings.whatsAppAutoDelayDays ?? 3)))
  );

  const message = buildMessage(kind, {
    tenantName: String(tenant?.الاسم || 'المستأجر').trim() || 'المستأجر',
    amount: remaining,
    dueDate: String(installment.تاريخ_استحقاق || ''),
    contractId: String(contract.رقم_العقد || ''),
    propertyCode: property?.الكود_الداخلي ? String(property.الكود_الداخلي) : undefined,
    delayDays,
  });

  const target = settings.whatsAppTarget ?? 'auto';
  const delayMs = Math.max(0, Number(settings.whatsAppDelayMs ?? 10_000));

  try {
    await openWhatsAppForPhones(message, phones, {
      defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
      delayMs,
      target,
    });
  } catch (err: unknown) {
    console.warn('[WhatsApp] فشل فتح واتساب:', err);
  }
  addNotificationSendLogInternal({
    category: categoryForKind(kind),
    tenantId: tenant?.رقم_الشخص,
    tenantName: String(tenant?.الاسم || '—'),
    phone: tenant?.رقم_الهاتف,
    contractId: String(contract.رقم_العقد || ''),
    propertyId: property?.رقم_العقار,
    propertyCode: property?.الكود_الداخلي ? String(property.الكود_الداخلي) : undefined,
    installmentIds: [String(installment.رقم_الكمبيالة)],
    sentAt: new Date().toISOString(),
    message,
  });
}

/**
 * يتحقق من الإعدادات والوقت والتكرار ثم يستدعي الإرسال.
 */
export async function tryAutoSendIfEligible(params: {
  installment: الكمبيالات_tbl;
  contract: العقود_tbl;
  tenant: الأشخاص_tbl | undefined;
  property: العقارات_tbl | undefined;
  settings: SystemSettings;
  daysUntilDue: number;
}): Promise<void> {
  const { installment, contract, tenant, property, settings, daysUntilDue } = params;

  if (!settings.whatsAppAutoEnabled) return;
  if (!isWithinWorkHours(settings)) return;

  const delayDays = Math.max(
    1,
    Math.min(30, Math.floor(Number(settings.whatsAppAutoDelayDays ?? 3)))
  );
  const kind = classifyAutoSendKind(daysUntilDue, delayDays);
  if (!kind) return;

  const iid = String(installment.رقم_الكمبيالة || '').trim();
  if (!iid) return;
  if (hasRecentAutoSendForInstallment(iid)) return;

  await sendReminder({
    installment,
    contract,
    tenant,
    property,
    settings,
    kind,
  });
}

export async function sendContractTerminationNotice(
  phone: string,
  contract: العقود_tbl,
  reason: string,
  terminationDate: string
): Promise<void> {
  const message = `عزيزي المستأجر،\nنحيط علمك بأنه تم فسخ عقد الإيجار رقم ${contract.رقم_العقد} بتاريخ ${terminationDate}.\nالسبب: ${reason}\nيرجى مراجعة الإدارة لإتمام إجراءات التسوية وتسليم العقار.\nشكراً لتعاونكم.`;

  await openWhatsAppForPhones(message, [phone], {
    defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
    delayMs: 1000,
    target: 'auto',
  });

  addNotificationSendLogInternal({
    category: 'whatsapp_termination',
    contractId: String(contract.رقم_العقد || ''),
    phone,
    sentAt: new Date().toISOString(),
    message,
    tenantName: ''
  });
}
