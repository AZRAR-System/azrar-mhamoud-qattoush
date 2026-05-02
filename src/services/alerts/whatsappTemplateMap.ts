import type { WhatsAppTemplateKey } from '@/services/alerts/alertActionTypes';

/** ربط مفتاح معاينة واتساب مع معرف القالب في `messageTemplates` / القوالب المدمجة */
export const WHATSAPP_KEY_TO_TEMPLATE_ID: Record<WhatsAppTemplateKey, string> = {
  payment_reminder: 'wa_payment_reminder',
  renewal_offer: 'wa_renewal_offer',
  legal_notice: 'wa_legal_notice',
  custom: 'wa_custom',
};

/** العكس — لاستدعاء `onAfterSaveForWhatsAppKey` بعد الحفظ من محرر القوالب */
export const WA_TEMPLATE_ID_TO_KEY: Partial<Record<string, WhatsAppTemplateKey>> = {
  wa_payment_reminder: 'payment_reminder',
  wa_renewal_offer: 'renewal_offer',
  wa_legal_notice: 'legal_notice',
  wa_custom: 'custom',
};
