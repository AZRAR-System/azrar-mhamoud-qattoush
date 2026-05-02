/**
 * مجموعات منطقية لقوالب الرسائل — تُربَط بالتنبيهات وتُمرَّر عبر
 * `#/settings?section=messages&msgGroup=...` لعرض القوالب ذات الصلة فقط.
 */

import type { tbl_Alerts } from '@/types';
import type { AlertClass, WhatsAppTemplateKey } from '@/services/alerts/alertActionTypes';
import type { NotificationTemplate } from '@/services/notificationTemplateDefaults';
import { getBuiltinNotificationTemplates } from '@/services/notificationTemplateDefaults';
import { WHATSAPP_KEY_TO_TEMPLATE_ID } from '@/services/alerts/whatsappTemplateMap';
import { classifyAlert } from '@/services/alerts/alertActionPolicy';
import { ROUTE_PATHS } from '@/routes/paths';

export const MESSAGE_TEMPLATE_SOURCE_GROUPS = [
  'data_quality',
  'collection',
  'reminder',
  'renewal',
  'legal',
  'whatsapp_general',
] as const;

export type MessageTemplateSourceGroup = (typeof MESSAGE_TEMPLATE_SOURCE_GROUPS)[number];

/** ترتيب حل التعارض عندما يطابق القالب المخصص أكثر من مجموعة (فئة مشتركة). */
const SOURCE_GROUP_RESOLUTION_ORDER: MessageTemplateSourceGroup[] = [
  'data_quality',
  'renewal',
  'whatsapp_general',
  'reminder',
  'collection',
  'legal',
];

/** معرفات القوالب المدمجة لكل مجموعة (لا تشمل القوالب المخصصة). */
export const GROUP_TEMPLATE_IDS: Record<MessageTemplateSourceGroup, readonly string[]> = {
  data_quality: ['data_quality_missing_property_utils_fixed'],
  collection: [
    'collection_friendly_late_payment_fixed',
    'collection_legal_late_payment_fixed',
    'collection_pay_notice_7_days_fixed',
    'collection_eviction_notice_fixed',
  ],
  reminder: [
    'pre_due_reminder',
    'due_day_reminder',
    'post_late_reminder',
    'installment_reminder_upcoming_summary_fixed',
    'installment_reminder_due_today_summary_fixed',
    'installment_reminder_overdue_summary_fixed',
    'wa_payment_reminder',
  ],
  renewal: ['wa_renewal_offer'],
  legal: ['legal_warning', 'legal_notice', 'wa_legal_notice'],
  whatsapp_general: ['wa_custom'],
};

export const GROUP_LABELS_AR: Record<MessageTemplateSourceGroup, string> = {
  data_quality: 'نقص بيانات',
  collection: 'تحصيل',
  reminder: 'تذكير واستحقاق',
  renewal: 'تجديد عقد',
  legal: 'إنذارات وإخطارات قانونية',
  whatsapp_general: 'واتساب — رسالة عامة',
};

/** فئات القوالب المخصصة التي تُعرض ضمن المجموعة (إن وُجدت). */
const GROUP_CUSTOM_CATEGORIES: Record<MessageTemplateSourceGroup, readonly NotificationTemplate['category'][]> = {
  data_quality: ['warning'],
  collection: ['late', 'warning', 'legal'],
  reminder: ['reminder', 'due', 'late'],
  renewal: ['reminder'],
  legal: ['warning', 'legal'],
  whatsapp_general: ['warning'],
};

export function listTemplateIdsForSourceGroup(group: MessageTemplateSourceGroup): readonly string[] {
  return GROUP_TEMPLATE_IDS[group];
}

/** تصنيف التنبيه → مجموعة قوالب؛ `null` = لا تخصيص (عرض كل القوالب). */
export function templateSourceGroupForAlertClass(cls: AlertClass): MessageTemplateSourceGroup | null {
  switch (cls) {
    case 'data_quality':
      return 'data_quality';
    case 'collection_board':
      return 'collection';
    case 'financial':
    case 'installment':
      return 'reminder';
    case 'expiry':
      return 'renewal';
    case 'risk':
      return 'legal';
    default:
      return null;
  }
}

export function parseMessageTemplateSourceGroup(raw: string | null | undefined): MessageTemplateSourceGroup | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  return (MESSAGE_TEMPLATE_SOURCE_GROUPS as readonly string[]).includes(s)
    ? (s as MessageTemplateSourceGroup)
    : null;
}

export function buildSettingsMessageTemplatesHref(opts: {
  sourceGroup?: MessageTemplateSourceGroup | null;
  templateId?: string | null;
}): string {
  const p = new URLSearchParams();
  p.set('section', 'messages');
  if (opts.sourceGroup) p.set('msgGroup', opts.sourceGroup);
  const tid = String(opts.templateId || '').trim();
  if (tid) p.set('template', tid);
  return `${ROUTE_PATHS.SETTINGS}?${p.toString()}`;
}

export function buildSettingsMessageTemplatesHrefForAlert(alert: tbl_Alerts): string {
  const cls = classifyAlert(alert);
  const g = templateSourceGroupForAlertClass(cls);
  return buildSettingsMessageTemplatesHref({ sourceGroup: g });
}

/** مفتاح قالب واتساب التنبيهات → مجموعة القوالب في الإعدادات. */
export function sourceGroupForWhatsAppTemplateKey(key: WhatsAppTemplateKey): MessageTemplateSourceGroup {
  switch (key) {
    case 'payment_reminder':
      return 'reminder';
    case 'renewal_offer':
      return 'renewal';
    case 'legal_notice':
      return 'legal';
    case 'custom':
      return 'whatsapp_general';
  }
}

/**
 * رابط تعديل قالب واتساب التنبيه: يجمع `template` مع مجموعة تتسع للقالب،
 * مع تفضيل مجموعة تنبيه التنبيه إن كانت تحتوي نفس القالب.
 */
export function buildSettingsMessageTemplatesHrefForWhatsApp(
  alert: tbl_Alerts,
  templateKey: WhatsAppTemplateKey
): string {
  const templateId = WHATSAPP_KEY_TO_TEMPLATE_ID[templateKey];
  const builtin = getBuiltinNotificationTemplates().find((t) => t.id === templateId);
  const row = {
    id: templateId,
    category: (builtin?.category ?? 'reminder') as NotificationTemplate['category'],
    isCustom: false,
  };
  const gAlert = templateSourceGroupForAlertClass(classifyAlert(alert));
  const gKey = sourceGroupForWhatsAppTemplateKey(templateKey);
  const group = gAlert && templateRowMatchesSourceGroup(row, gAlert) ? gAlert : gKey;
  return buildSettingsMessageTemplatesHref({ sourceGroup: group, templateId });
}

/** أول مجموعة تطابق القالب (مدمج بالمعرّف أو مخصص بالفئة). */
export function messageTemplateSourceGroupForListEntry(row: {
  id: string;
  category: NotificationTemplate['category'];
  isCustom: boolean;
}): MessageTemplateSourceGroup | null {
  for (const g of SOURCE_GROUP_RESOLUTION_ORDER) {
    if (templateRowMatchesSourceGroup(row, g)) return g;
  }
  return null;
}

/** تصفية صف القوالب حسب المجموعة (مدمج + مخصص ضمن الفئات المسموحة). */
export function templateRowMatchesSourceGroup(
  row: { id: string; category: NotificationTemplate['category']; isCustom: boolean },
  group: MessageTemplateSourceGroup | null
): boolean {
  if (!group) return true;
  if ((GROUP_TEMPLATE_IDS[group] as readonly string[]).includes(row.id)) return true;
  if (!row.isCustom) return false;
  return GROUP_CUSTOM_CATEGORIES[group].includes(row.category);
}
