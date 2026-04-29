import React, { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { AlertModalShell } from '@/components/alerts/AlertModalShell';
import type { tbl_Alerts } from '@/types';
import type { WhatsAppPayload } from '@/services/alerts/alertActionTypes';
import { buildDefaultWhatsAppPrefillBody } from '@/services/alerts/alertActionPayloadBuild';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';

export interface WhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  alert: tbl_Alerts;
  /** حمولة من Policy — عندها يُبنى النص من `prefillBody` أو من `templateKey` + التنبيه، والإرسال للرقم المحدد */
  payload?: WhatsAppPayload;
  onSend: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ open, onClose, alert, payload, onSend }) => {
  const preview = useMemo(() => {
    if (payload) {
      const raw = payload.prefillBody?.trim();
      if (raw) return raw;
      return buildDefaultWhatsAppPrefillBody(alert, payload.templateKey);
    }
    if (alert.count && alert.count > 1 && alert.category === 'Financial') {
      return `مرحباً ${alert.tenantName}،\nنود تذكيركم قبل الاستحقاق بوجود ${alert.count} دفعات قريبة الاستحقاق للعقار (${alert.propertyCode}).\n${alert.الوصف}.\nيرجى السداد قبل موعد الاستحقاق.`;
    }
    if (alert.category === 'Financial') {
      return `مرحباً ${alert.tenantName}،\nنود تذكيركم قبل الاستحقاق بوجود دفعة قريبة الاستحقاق للعقار (${alert.propertyCode}).\n${alert.الوصف}.\nيرجى السداد قبل موعد الاستحقاق.`;
    }
    if (alert.category === 'Expiry') {
      return `مرحباً ${alert.tenantName}،\nعقد الإيجار الخاص بالعقار (${alert.propertyCode}) قارب على الانتهاء.\nيرجى مراجعة المكتب للتجديد.`;
    }
    if (alert.category === 'Risk') {
      return `مرحباً ${alert.tenantName}،\nيرجى مراجعة المكتب للأهمية بخصوص تسوية الذمم المالية العالقة.`;
    }
    return `مرحباً ${alert.tenantName}،\nإشعار بخصوص العقار (${alert.propertyCode}):\n${alert.الوصف}`;
  }, [alert, payload]);

  const handleSend = () => {
    if (payload?.phone) {
      void openWhatsAppForPhones(preview, [payload.phone], {
        defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
        delayMs: 10_000,
      });
      onClose();
      return;
    }
    onSend();
    onClose();
  };

  return (
    <AlertModalShell
      open={open}
      onClose={onClose}
      icon={<MessageCircle size={22} />}
      title="معاينة واتساب"
      subtitle="للتنبيهات غير المجمّعة الخاصة بجودة بيانات العقارات يُفضّل زر الإرسال من لوحة التفاصيل الرئيسية."
      sourcesBar={
        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-black text-green-800 dark:bg-green-900/40 dark:text-green-200">
          WhatsApp
        </span>
      }
      sectionContext={
        payload ? (
          <dl className="mb-3 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs font-bold text-slate-700 dark:text-slate-200">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">القالب</dt>
              <dd dir="ltr">{payload.templateKey}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">الهاتف</dt>
              <dd dir="ltr">{payload.phone}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">الشخص</dt>
              <dd dir="ltr">{payload.personId}</dd>
            </div>
          </dl>
        ) : null
      }
      sectionPreview={
        <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-4 text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
          {preview}
        </pre>
      }
      footerButtons={
        <>
          <button
            type="button"
            onClick={handleSend}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-green-700"
          >
            <MessageCircle size={16} /> إرسال
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-xs font-black text-slate-600 dark:text-slate-300"
          >
            إلغاء
          </button>
        </>
      }
    />
  );
};
