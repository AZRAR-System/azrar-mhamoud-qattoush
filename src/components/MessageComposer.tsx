import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { MessageCircle, Copy, X, Send, ExternalLink } from 'lucide-react';
import {
  NotificationTemplate,
  TemplateContext,
  fillTemplateComplete,
  openWhatsApp,
  openWhatsAppMulti,
} from '@/services/notificationTemplates';
import { getAllTemplates, getTemplate, type MessageTemplateListEntry } from '@/services/db/messageTemplates';
import { applyOfficialBrandSignature } from '@/utils/brandSignature';
import { safeCopyToClipboard } from '@/utils/clipboard';
import {
  buildSettingsMessageTemplatesHref,
  messageTemplateSourceGroupForListEntry,
} from '@/services/messageTemplateSourceGroups';

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

function listEntryToNotificationTemplate(entry: MessageTemplateListEntry): NotificationTemplate {
  const body = getTemplate(entry.id);
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    title: '',
    body,
    enabled: true,
    createdAt: '',
    updatedAt: '',
    tags: entry.isCustom ? ['مخصص'] : [],
  };
}

/**
 * مكون لتكوين ورسل الرسائل باستخدام النماذج
 * يقرأ القوالب من نفس مخزن الإعدادات (`db_message_templates`) حتى يطابق التعديل في «قوالب الرسائل».
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
  const [templateVersion, setTemplateVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');

  const bumpTemplates = useCallback(() => setTemplateVersion((v) => v + 1), []);

  useEffect(() => {
    const onStoreChange = () => bumpTemplates();
    window.addEventListener('azrar:message-templates-changed', onStoreChange);
    return () => window.removeEventListener('azrar:message-templates-changed', onStoreChange);
  }, [bumpTemplates]);

  const templates = useMemo(() => {
    void templateVersion;
    const all = getAllTemplates();
    const list = category ? all.filter((t) => t.category === category) : all;
    return list;
  }, [category, templateVersion]);

  const primaryPhone =
    (tenantPhones && tenantPhones.length ? tenantPhones : [tenantPhone]).filter(Boolean)[0] ||
    tenantPhone;

  const context: TemplateContext = useMemo(
    () => ({
      tenantName,
      propertyCode,
      amount,
      dueDate,
      daysLate,
      contractNumber,
      remainingAmount,

      اسم_المستأجر: tenantName,
      رقم_الهاتف: primaryPhone,
      عدد_الكمبيالات: typeof overdueInstallmentsCount === 'number' ? overdueInstallmentsCount : 1,
      مجموع_المبالغ_المتأخرة:
        typeof overdueAmountTotal === 'number'
          ? overdueAmountTotal
          : typeof remainingAmount === 'number'
            ? remainingAmount
            : amount,
      تفاصيل_الكمبيالات: overdueInstallmentsDetails || '',

      جزء_العقار: propertyCode ? ` للعقار (${propertyCode})` : '',
      المستحقات_القريبة: `• ${Number(typeof remainingAmount === 'number' ? remainingAmount : amount).toLocaleString('en-US')} د.أ — ${dueDate} (قريبة)`,
      المستحقات_اليوم: `• ${Number(typeof remainingAmount === 'number' ? remainingAmount : amount).toLocaleString('en-US')} د.أ — ${dueDate} (اليوم)`,
      المستحقات_المتأخرة: `• ${Number(typeof remainingAmount === 'number' ? remainingAmount : amount).toLocaleString('en-US')} د.أ — ${dueDate} (متأخر ${Number(daysLate || 0)} يوم)`,
      الإجمالي: Number(typeof remainingAmount === 'number' ? remainingAmount : amount).toLocaleString(
        'en-US'
      ),
    }),
    [
      tenantName,
      propertyCode,
      amount,
      dueDate,
      daysLate,
      contractNumber,
      remainingAmount,
      primaryPhone,
      overdueInstallmentsCount,
      overdueAmountTotal,
      overdueInstallmentsDetails,
    ]
  );

  const applyFilledMessage = useCallback(
    (id: string) => {
      const row = getAllTemplates().find((r) => r.id === id);
      if (!row) return;
      const t = listEntryToNotificationTemplate(row);
      const filled = fillTemplateComplete(t, context);
      setMessageText(filled.title ? `${filled.title}\n\n${filled.body}` : filled.body);
    },
    [context]
  );

  const handleSelectTemplate = (entry: MessageTemplateListEntry) => {
    setSelectedId(entry.id);
    applyFilledMessage(entry.id);
  };

  useEffect(() => {
    if (!selectedId) return;
    const exists = getAllTemplates().some((r) => r.id === selectedId);
    if (!exists) {
      setSelectedId(null);
      setMessageText('');
      return;
    }
    applyFilledMessage(selectedId);
  }, [templateVersion, selectedId, applyFilledMessage]);

  const selectedEntry = selectedId ? templates.find((t) => t.id === selectedId) : null;

  const settingsTemplatesHref = useMemo(() => {
    const tid = selectedId?.trim();
    if (!tid) return buildSettingsMessageTemplatesHref({});
    const row = getAllTemplates().find((r) => r.id === tid);
    const g = row ? messageTemplateSourceGroupForListEntry(row) : null;
    return buildSettingsMessageTemplatesHref({ sourceGroup: g, templateId: tid });
  }, [selectedId, templateVersion]);

  const handleCopy = () => {
    const text =
      messageText.trim().length > 0 ? applyOfficialBrandSignature(messageText) : messageText;
    void safeCopyToClipboard(text);
  };

  const handleOpenWhatsApp = () => {
    const phones = (tenantPhones && tenantPhones.length ? tenantPhones : [tenantPhone]).filter(
      Boolean
    ) as string[];
    if (phones.length <= 1) {
      openWhatsApp(messageText, phones[0] || tenantPhone);
    } else {
      void openWhatsAppMulti(messageText, phones, 10_000);
    }
    onSent?.(messageText);
  };

  const handleSend = () => {
    onSent?.(messageText);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
          القوالب مرتبطة بـ «الإعدادات → الرسائل والإشعارات → قوالب الرسائل». أي تعديل هناك يظهر هنا مباشرة.
        </p>
        <Link
          to={settingsTemplatesHref}
          onClick={() => onClose?.()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <ExternalLink size={14} />
          تعديل القوالب
        </Link>
      </div>

      {!selectedId ? (
        <div>
          <h3 className="mb-3 font-bold text-slate-900 dark:text-white">اختر نموذج رسالة</h3>
          <div className="grid gap-2">
            {templates.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد نماذج متاحة</p>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-right transition-colors hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-600"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 dark:text-white">{template.name}</p>
                      {template.isCustom ? (
                        <p className="mt-1 truncate text-xs text-indigo-600 dark:text-indigo-400">
                          قالب مخصص
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`ml-2 shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${
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
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 dark:text-white">
              {selectedEntry?.name ?? selectedId}
            </h3>
            <div className="flex items-center gap-2">
              <Link
                to={settingsTemplatesHref}
                onClick={() => onClose?.()}
                className="text-[11px] font-black text-indigo-600 hover:underline dark:text-indigo-400"
              >
                فتح هذا القالب في الإعدادات
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setMessageText('');
                }}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                aria-label="إغلاق النموذج"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-300 bg-white p-3 font-sans text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />

          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy} className="flex-1 gap-2">
              <Copy size={16} /> نسخ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenWhatsApp}
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
            >
              <MessageCircle size={16} /> واتساب
            </Button>
            {onSent && (
              <Button variant="primary" size="sm" onClick={handleSend} className="flex-1 gap-2">
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
