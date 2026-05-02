/**
 * نظام نماذج الرسائل والإشعارات
 * يوفر قوالب رسائل قابلة للتعديل لمختلف الحالات
 * مع دعم placeholders وتعديل النماذج بشكل ديناميكي
 *
 * نصوص القوالب (body) من `db_message_templates` — إعدادات الرسائل؛
 * البيانات الوصفية المدمجة من `notificationTemplateDefaults`.
 */

export type { NotificationTemplate } from './notificationTemplateDefaults';
export {
  COLLECTION_FIXED_PAYMENT_FOOTER,
  getBuiltinNotificationTemplates,
} from './notificationTemplateDefaults';

import type { NotificationTemplate } from './notificationTemplateDefaults';
import { getBuiltinNotificationTemplates } from './notificationTemplateDefaults';
import {
  deleteCustomTemplateById,
  getAllTemplates,
  getTemplate,
  isTemplateEnabled,
  putCustomTemplate,
  resetAllMessageTemplatesStore,
  saveTemplate,
  setBuiltinTemplateEnabled,
  type MessageTemplateListEntry,
} from '@/services/db/messageTemplates';
import { buildWhatsAppLink, openWhatsAppForPhones } from '@/utils/whatsapp';
import { openExternalUrl } from '@/utils/externalLink';
import { getMessageGlobalContext } from '@/utils/messageGlobalContext';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';

export interface TemplateContext {
  tenantName?: string;
  propertyCode?: string;
  amount?: number;
  dueDate?: string;
  paymentDate?: string;
  daysLate?: number;
  contractNumber?: string;
  remainingAmount?: number;
  notes?: string;
  [key: string]: unknown;
}

function templateFromListEntry(entry: MessageTemplateListEntry): NotificationTemplate {
  const builtin = getBuiltinNotificationTemplates().find((b) => b.id === entry.id);
  if (entry.isCustom) {
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      title: '',
      body: getTemplate(entry.id),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    };
  }
  if (!builtin) {
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      title: '',
      body: getTemplate(entry.id),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    };
  }
  const clone = JSON.parse(JSON.stringify(builtin)) as NotificationTemplate;
  clone.body = getTemplate(entry.id);
  clone.enabled = isTemplateEnabled(entry.id);
  return clone;
}

function getByIdInternal(id: string): NotificationTemplate | undefined {
  const entry = getAllTemplates().find((e) => e.id === id);
  if (!entry) return undefined;
  return templateFromListEntry(entry);
}

/**
 * ملء النموذج بالبيانات
 * يستبدل جميع placeholders من نوع {{ key }} بالقيم المقابلة
 */
export function fillTemplate(
  template: NotificationTemplate | string,
  context: TemplateContext
): string {
  const content = typeof template === 'string' ? template : template.body;
  const mergedContext: Record<string, unknown> = {
    ...getMessageGlobalContext(),
    ...(context || {}),
  };

  return content.replace(/\{\{\s*([\w\u0600-\u06FF]+)\s*\}\}/g, (match, key) => {
    const value = mergedContext[key];

    if (value === undefined || value === null) {
      return match;
    }

    if (typeof value === 'number') {
      return value.toLocaleString('en-US');
    }

    return String(value);
  });
}

/**
 * الحصول على رابط واتساب مع الرسالة المملوءة
 */
export function getWhatsAppLink(message: string, phoneNumber: string): string {
  return buildWhatsAppLink(message, phoneNumber, {
    defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
  });
}

/**
 * فتح واتساب بالرسالة المحددة
 */
export function openWhatsApp(message: string, phoneNumber: string): void {
  const link = getWhatsAppLink(message, phoneNumber);
  openExternalUrl(link);
}

/**
 * فتح واتساب لأكثر من رقم (مع تأخير بين الأرقام)
 */
export async function openWhatsAppMulti(
  message: string,
  phoneNumbers: string[],
  delayMs: number = 10_000
): Promise<void> {
  await openWhatsAppForPhones(message, phoneNumbers, {
    defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
    delayMs,
  });
}

/**
 * الحصول على معلومات النموذج المملوء
 */
export interface FilledTemplateInfo {
  title: string;
  body: string;
  category: NotificationTemplate['category'];
  enabled: boolean;
}

/**
 * ملء النموذج كاملاً (العنوان والنص)
 */
export function fillTemplateComplete(
  template: NotificationTemplate,
  context: TemplateContext
): FilledTemplateInfo {
  return {
    title: fillTemplate(template.title, context),
    body: fillTemplate(template.body, context),
    category: template.category,
    enabled: template.enabled,
  };
}

export const NotificationTemplates = {
  getAll: (): NotificationTemplate[] => getAllTemplates().map(templateFromListEntry),

  getById: (id: string): NotificationTemplate | undefined => getByIdInternal(id),

  getByCategory: (category: NotificationTemplate['category']): NotificationTemplate[] =>
    NotificationTemplates.getAll().filter((t) => t.category === category && t.enabled),

  add: (template: Omit<NotificationTemplate, 'createdAt' | 'updatedAt'>): NotificationTemplate => {
    putCustomTemplate({
      id: template.id,
      name: template.name,
      category: template.category,
      body: template.body,
    });
    return {
      ...template,
      body: getTemplate(template.id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  update: (
    id: string,
    updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt'>>
  ): NotificationTemplate | undefined => {
    if (!getAllTemplates().some((e) => e.id === id)) return undefined;
    if (updates.body !== undefined) {
      saveTemplate(id, updates.body);
    }
    if (updates.enabled !== undefined && getBuiltinNotificationTemplates().some((b) => b.id === id)) {
      setBuiltinTemplateEnabled(id, updates.enabled);
    }
    return getByIdInternal(id);
  },

  delete: (id: string): boolean => deleteCustomTemplateById(id),

  toggleEnabled: (id: string): NotificationTemplate | undefined => {
    if (!getByIdInternal(id)) return undefined;
    if (getBuiltinNotificationTemplates().some((b) => b.id === id)) {
      setBuiltinTemplateEnabled(id, !isTemplateEnabled(id));
      return getByIdInternal(id);
    }
    return undefined;
  },

  reset: (): void => {
    resetAllMessageTemplatesStore();
  },

  fill: (template: NotificationTemplate | string, context: TemplateContext) =>
    fillTemplate(template, context),

  fillComplete: (template: NotificationTemplate, context: TemplateContext) =>
    fillTemplateComplete(template, context),

  getWhatsAppLink: (message: string, phoneNumber: string) => getWhatsAppLink(message, phoneNumber),

  openWhatsApp: (message: string, phoneNumber: string) => openWhatsApp(message, phoneNumber),
};

export default NotificationTemplates;
