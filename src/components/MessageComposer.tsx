import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  MessageCircle,
  Copy,
  X,
  Send,
} from 'lucide-react';
import {
  NotificationTemplates,
  NotificationTemplate,
  TemplateContext,
  fillTemplateComplete,
  openWhatsApp,
  openWhatsAppMulti,
} from '@/services/notificationTemplates';
import { applyOfficialBrandSignature } from '@/utils/brandSignature';

/**
 * خصائص مكون منشئ الرسائل
 */
interface MessageComposerProps {
  category?: NotificationTemplate['category'];
  tenantName?: string;
  tenantPhone?: string;
  tenantPhones?: string[];
  propertyCode?: string;
  amount?: number;
  dueDate?: string;
  daysLate?: number;
  contractNumber?: string;
  remainingAmount?: number;
  overdueInstallmentsCount?: number;
  overdueAmountTotal?: number;
  overdueInstallmentsDetails?: string;
  onClose?: () => void;
  onSent?: (message: string) => void;
}

/**
 * مكون لتكوين ورسل الرسائل باستخدام النماذج
 * يستخدم في الصفحات والمودالات المختلفة
 */
export const MessageComposer: React.FC<MessageComposerProps> = ({
  category,
  tenantName = 'المستأجر',
  tenantPhone = '962790000000',
  tenantPhones,
  propertyCode = 'E-101',
  amount = 5000,
  dueDate = new Date().toISOString().split('T')[0],
  daysLate = 0,
  contractNumber = 'CONT-2024-001',
  remainingAmount = amount,
  overdueInstallmentsCount,
  overdueAmountTotal,
  overdueInstallmentsDetails,
  onClose,
  onSent,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(
    null
  );
  const [messageText, setMessageText] = useState('');

  // الحصول على القوالب المناسبة
  const templates = category
    ? NotificationTemplates.getByCategory(category)
    : NotificationTemplates.getAll().filter(t => t.enabled);

  // السياق المستخدم لملء النموذج
  const primaryPhone = (tenantPhones && tenantPhones.length ? tenantPhones : [tenantPhone]).filter(Boolean)[0] || tenantPhone;

  const context: TemplateContext = {
    tenantName,
    propertyCode,
    amount,
    dueDate,
    daysLate,
    contractNumber,
    remainingAmount,

    // Arabic placeholder aliases (for fixed legal/collection message templates)
    اسم_المستأجر: tenantName,
    رقم_الهاتف: primaryPhone,
    عدد_الكمبيالات: typeof overdueInstallmentsCount === 'number' ? overdueInstallmentsCount : 1,
    مجموع_المبالغ_المتأخرة: typeof overdueAmountTotal === 'number' ? overdueAmountTotal : (typeof remainingAmount === 'number' ? remainingAmount : amount),
    تفاصيل_الكمبيالات: overdueInstallmentsDetails || '',

    // Fixed summary template helpers (used by approved fixed templates)
    جزء_العقار: propertyCode ? ` للعقار (${propertyCode})` : '',
    المستحقات_القريبة: `• ${Number(typeof remainingAmount === 'number' ? remainingAmount : amount).toLocaleString('en-US')} د.أ — ${dueDate} (قريبة)`,
    المستحقات_اليوم: `• ${Number(typeof remainingAmount === 'number' ? remainingAmount : amount).toLocaleString('en-US')} د.أ — ${dueDate} (اليوم)`,
    المستحقات_المتأخرة: `• ${Number(typeof remainingAmount === 'number' ? remainingAmount : amount).toLocaleString('en-US')} د.أ — ${dueDate} (متأخر ${Number(daysLate || 0)} يوم)`,
    الإجمالي: Number(typeof remainingAmount === 'number' ? remainingAmount : amount).toLocaleString('en-US'),
  };

  // معالج اختيار النموذج
  const handleSelectTemplate = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    const filled = fillTemplateComplete(template, context);
    setMessageText(filled.title ? `${filled.title}\n\n${filled.body}` : filled.body);
  };

  // معالج نسخ الرسالة
  const handleCopy = () => {
    const text = messageText.trim().length > 0 ? applyOfficialBrandSignature(messageText) : messageText;
    navigator.clipboard.writeText(text);
  };

  // معالج فتح في واتساب
  const handleOpenWhatsApp = () => {
    const phones = (tenantPhones && tenantPhones.length ? tenantPhones : [tenantPhone]).filter(Boolean) as string[];
    if (phones.length <= 1) {
      openWhatsApp(messageText, phones[0] || tenantPhone);
    } else {
      void openWhatsAppMulti(messageText, phones, 10_000);
    }
    onSent?.(messageText);
  };

  // معالج إرسال مخصص
  const handleSend = () => {
    onSent?.(messageText);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="space-y-4">
      {!selectedTemplate ? (
        // قائمة اختيار النموذج
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white mb-3">
            اختر نموذج رسالة
          </h3>
          <div className="grid gap-2">
            {templates.length === 0 ? (
              <p className="text-sm text-slate-500">
                لا توجد نماذج متاحة
              </p>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="p-3 text-right rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors bg-white dark:bg-slate-800"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {template.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {template.title}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-bold whitespace-nowrap ml-2 ${
                        template.category === 'reminder'
                          ? 'bg-indigo-100 text-indigo-700'
                          : template.category === 'due'
                          ? 'bg-green-100 text-green-700'
                          : template.category === 'late'
                          ? 'bg-orange-100 text-orange-700'
                          : template.category === 'warning'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {template.category === 'reminder' && 'تذكير'}
                      {template.category === 'due' && 'استحقاق'}
                      {template.category === 'late' && 'تأخر'}
                      {template.category === 'warning' && 'إنذار'}
                      {template.category === 'legal' && 'قانوني'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        // عرض وتحرير الرسالة
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">
              {selectedTemplate.name}
            </h3>
            <button
              onClick={() => {
                setSelectedTemplate(null);
                setMessageText('');
              }}
              className="text-slate-500 hover:text-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={8}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans"
          />

          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="gap-2 flex-1"
            >
              <Copy size={16} /> نسخ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenWhatsApp}
              className="bg-green-600 hover:bg-green-700 gap-2 flex-1"
            >
              <MessageCircle size={16} /> واتساب
            </Button>
            {onSent && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSend}
                className="gap-2 flex-1"
              >
                <Send size={16} /> إرسال
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageComposer;
