import type { tbl_Alerts } from '@/types';
import type { WhatsAppTemplateKey } from '@/services/alerts/alertActionTypes';
import { buildDefaultWhatsAppPrefillBody } from '@/services/alerts/alertActionPayloadBuild';
import { buildAlertTemplateContext } from '@/services/alerts/alertTemplateContext';
import { WHATSAPP_KEY_TO_TEMPLATE_ID } from '@/services/alerts/whatsappTemplateMap';
import { fillTemplate, NotificationTemplates } from '@/services/notificationTemplates';
import { getTemplate } from '@/services/db/messageTemplates';

/**
 * نص واتساب للتنبيه: قالب المستخدم (إن وُجد ومفعّل) ثم الاحتياطي المضمّن.
 */
export function resolveWhatsAppBodyForAlert(
  alert: tbl_Alerts,
  templateKey: WhatsAppTemplateKey
): string {
  const templateId = WHATSAPP_KEY_TO_TEMPLATE_ID[templateKey];
  const meta = NotificationTemplates.getById(templateId);
  if (meta && meta.enabled === false) {
    return buildDefaultWhatsAppPrefillBody(alert, templateKey);
  }

  const rawBody = getTemplate(templateId);
  if (!String(rawBody || '').trim()) {
    return buildDefaultWhatsAppPrefillBody(alert, templateKey);
  }

  const ctx = buildAlertTemplateContext(alert);
  try {
    return fillTemplate(rawBody, ctx);
  } catch {
    return buildDefaultWhatsAppPrefillBody(alert, templateKey);
  }
}
