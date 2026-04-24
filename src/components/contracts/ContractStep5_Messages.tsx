import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MessagesStepProps } from './types';
import { formatCurrencyJOD } from '@/utils/format';
import { DbService } from '@/services/mockDb';
import { Copy, MessageSquare, User, Home, Download, Send, Check } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { openWhatsAppForPhones } from '@/utils/whatsapp';

export const ContractStep5_Messages: React.FC<MessagesStepProps> = ({
  contract,
  setContract,
  t,
  installmentsPreview,
  commOwner,
  commTenant,
}) => {
  const toast = useToast();
  const [tenantMessage, setTenantMessage] = useState('');
  const [ownerMessage, setOwnerMessage] = useState('');
  const [sentStatus, setSentStatus] = useState({ tenant: false, owner: false });

  const data = useMemo(() => {
    const props = DbService.getProperties();
    const people = DbService.getPeople();
    const settings = DbService.getSettings();

    const prop = props.find(p => p.رقم_العقار === contract.رقم_العقار);
    const tenant = people.find(p => p.رقم_الشخص === contract.رقم_المستاجر);
    const owner = prop ? people.find(p => p.رقم_الشخص === prop.رقم_المالك) : null;

    return {
      property: prop,
      tenant,
      owner,
      settings
    };
  }, [contract.رقم_العقار, contract.رقم_المستاجر]);

  const generateMessages = useCallback(() => {
    const { property, tenant, owner, settings } = data;
    if (!tenant) return;

    const propertyCode = property?.الكود_الداخلي || contract.رقم_العقار || '—';
    const propertyAddress = [property?.المدينة, property?.المنطقة, property?.العنوان].filter(Boolean).join(' / ') || '—';
    const ownerName = owner?.الاسم || '—';
    const tenantName = tenant?.الاسم || '—';
    const contractId = contract.رقم_العقد || 'جديد';
    
    const startDate = contract.تاريخ_البداية || '—';
    // Calculate end date (start + months - 1 day)
    const endDate = contract.تاريخ_النهاية || '—'; 
    const duration = contract.مدة_العقد_بالاشهر || 12;
    const annualRent = formatCurrencyJOD(Number(contract.القيمة_السنوية || 0));
    const totalContractValue = formatCurrencyJOD((Number(contract.القيمة_السنوية || 0) / 12) * duration);

    const freqMap: Record<number, string> = {
      12: 'شهري',
      6: 'كل شهرين',
      4: 'ربع سنوي',
      3: 'كل 4 شهور',
      2: 'نصف سنوي',
      1: 'سنوي (دفعة كاملة)'
    };
    const frequencyAr = freqMap[contract.تكرار_الدفع || 12] || '—';

    const installmentsList = installmentsPreview
      .filter(inst => inst.type !== 'تأمين')
      .map(inst => `* ${formatCurrencyJOD(inst.amount)} — ${inst.date} (${inst.type})`)
      .join('\n');

    const totalInstallmentsAmount = formatCurrencyJOD(installmentsPreview.filter(i => i.type !== 'تأمين').reduce((sum, i) => sum + i.amount, 0));
    
    const insuranceInst = installmentsPreview.find(i => i.type === 'تأمين');
    const insuranceLine = insuranceInst ? `* تأمين (كمبيالة ضمان): ${formatCurrencyJOD(insuranceInst.amount)}` : '';


    const elecNumber = property?.رقم_اشتراك_الكهرباء || '—';
    const waterNumber = property?.رقم_اشتراك_المياه || '—';
    
    const footer = settings.companyIdentityText || '';

    const baseMessage = `السيد/السيدة ${tenantName} المحترم،

نحيطكم علماً بأنه تم إبرام/توقيع عقد إيجار رقم (${contractId}).

بيانات العقد:
* العقار: (${propertyCode}) — ${propertyAddress}
* المالك: ${ownerName}
* المستأجر: ${tenantName}
* تاريخ بداية العقد: ${startDate}
* تاريخ نهاية العقد: ${endDate}
* مدة العقد: ${duration} شهر
* قيمة العقد السنوية: ${annualRent}
* القيمة الإجمالية لفترة العقد: ${totalContractValue}
* تكرار الدفع: ${frequencyAr}

جدول الدفعات:
${installmentsList}
الإجمالي حسب جدول الدفعات: ${totalInstallmentsAmount}
${insuranceLine ? `\nالضمانات:\n${insuranceLine}\n` : ''}
بيانات الاشتراكات:
* رقم اشتراك الكهرباء: ${elecNumber}
* رقم اشتراك المياه: ${waterNumber}

مرفقات العقد: عند الحاجة للمرفقات يرجى التواصل معنا لمشاركتها.

يرجى الاحتفاظ بهذه الرسالة للرجوع إليها عند الحاجة.
شاكرين تعاونكم.

${footer}`;

    // Tenant message includes tenant commission
    const tMsg = baseMessage.replace('جدول الدفعات:', `العمولة:\n* عمولة المستأجر: ${formatCurrencyJOD(Number(commTenant || 0))}\n\nجدول الدفعات:`);
    setTenantMessage(tMsg);

    // Owner message includes owner commission (and greeting owner)
    const oMsg = baseMessage
      .replace(`السيد/السيدة ${tenantName} المحترم،`, `السيد/السيدة ${ownerName} المحترم،`)
      .replace('جدول الدفعات:', `العمولة:\n* عمولة المالك: ${formatCurrencyJOD(Number(commOwner || 0))}\n\nجدول الدفعات:`);
    
    setOwnerMessage(oMsg);
  }, [data, contract, installmentsPreview, commOwner, commTenant]);

  useEffect(() => {
    generateMessages();
  }, [generateMessages]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${t('تم نسخ رسالة')} ${label}`);
  };

  const handleWhatsApp = async (text: string, phone?: string, type: 'tenant' | 'owner' = 'tenant') => {
    if (!phone) {
      toast.error(t('رقم الهاتف غير متوفر'));
      return;
    }
    const { settings } = data;
    await openWhatsAppForPhones(text, [phone], {
      target: settings.whatsAppTarget || 'auto',
      defaultCountryCode: settings.countryDialCode || '962',
      delayMs: 0
    });

    // Audit Log
    const currentUser = DbService.getCurrentUser()?.اسم_المستخدم || 'system';
    DbService.logOperation(
      currentUser,
      'WHATSAPP_SEND',
      'العقود',
      contract.رقم_العقد || 'NEW',
      `تم إرسال رسالة العقد إلى ${type === 'tenant' ? 'المستأجر' : 'المالك'} عبر الواتساب`
    );

    setSentStatus(prev => ({ ...prev, [type]: true }));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
         <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg">
            <MessageSquare size={20} />
         </div>
         <div>
            <h5 className="font-black text-indigo-900 dark:text-indigo-100">{t('مسودات الرسائل النهائية')}</h5>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">{t('يرجى مراجعة محتوى الرسائل قبل الحفظ النهائي')}</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tenant Message */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-2 font-black text-slate-700 dark:text-slate-300">
                <User size={16} className="text-indigo-500" /> {t('رسالة المستأجر')}
             </div>
             <div className="flex gap-2">
               <button 
                  onClick={() => copyToClipboard(tenantMessage, t('المستأجر'))}
                  className="flex items-center gap-1.5 text-[10px] font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
               >
                  <Copy size={12} /> {t('نسخ النص')}
               </button>
               <button 
                  onClick={() => handleWhatsApp(tenantMessage, data.tenant?.رقم_الهاتف, 'tenant')}
                  className={`flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full transition-all shadow-sm active:scale-95 ${
                    sentStatus.tenant ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
               >
                  {sentStatus.tenant ? <Check size={12} /> : <Send size={12} />}
                  {sentStatus.tenant ? t('تم الإرسال') : t('إرسال واتساب')}
               </button>
             </div>
          </div>
          <textarea 
            dir="rtl"
            className="w-full h-[450px] p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-xs leading-relaxed font-medium shadow-inner focus:border-indigo-500 outline-none transition-all resize-none overflow-auto scrollbar-thin"
            value={tenantMessage}
            onChange={(e) => setTenantMessage(e.target.value)}
          />
        </div>

        {/* Owner Message */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-2 font-black text-slate-700 dark:text-slate-300">
                <Home size={16} className="text-emerald-500" /> {t('رسالة المالك')}
             </div>
             <div className="flex gap-2">
               <button 
                  onClick={() => copyToClipboard(ownerMessage, t('المالك'))}
                  className="flex items-center gap-1.5 text-[10px] font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
               >
                  <Copy size={12} /> {t('نسخ النص')}
               </button>
               <button 
                  onClick={() => handleWhatsApp(ownerMessage, data.owner?.رقم_الهاتف, 'owner')}
                  className={`flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full transition-all shadow-sm active:scale-95 ${
                    sentStatus.owner ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
               >
                  {sentStatus.owner ? <Check size={12} /> : <Send size={12} />}
                  {sentStatus.owner ? t('تم الإرسال') : t('إرسال واتساب')}
               </button>
             </div>
          </div>
          <textarea 
            dir="rtl"
            className="w-full h-[450px] p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-xs leading-relaxed font-medium shadow-inner focus:border-emerald-500 outline-none transition-all resize-none overflow-auto scrollbar-thin"
            value={ownerMessage}
            onChange={(e) => setOwnerMessage(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/30 flex items-center justify-between gap-4">
         <div className="flex items-start gap-3">
            <Download className="text-amber-600 mt-1 flex-shrink-0" size={18} />
            <div className="text-xs text-amber-800 dark:text-amber-200">
               <p className="font-bold mb-1">{t('تنبيه هام:')}</p>
               <p>{t('هذه الرسائل هي للمراجعة والنسخ اليدوي. الضغط على زر "إنشاء العقد" سيقوم بحفظ البيانات في القاعدة.')}</p>
            </div>
         </div>

         <div className="flex items-center gap-3 bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-amber-200/50">
            <input 
              type="checkbox" 
              id="auto-reminders"
              className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              checked={!!contract.حقول_ديناميكية?.enableAutoReminders}
              onChange={(e) => setContract(prev => ({
                ...prev,
                حقول_ديناميكية: {
                  ...(prev.حقول_ديناميكية || {}),
                  enableAutoReminders: e.target.checked
                }
              }))}
            />
            <label htmlFor="auto-reminders" className="text-xs font-black text-amber-900 dark:text-amber-100 cursor-pointer select-none">
              {t('تفعيل تذكيرات الأقساط تلقائياً؟')}
            </label>
         </div>
      </div>
    </div>
  );
};
