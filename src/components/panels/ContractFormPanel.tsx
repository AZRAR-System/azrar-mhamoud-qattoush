import React, { useId, useState, useEffect, useMemo, useCallback } from 'react';
import { العقود_tbl } from '@/types';
import { useToast } from '@/context/ToastContext';
import { useNotification } from '@/hooks/useNotification';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { todayDateOnlyISO } from '@/utils/dateOnly';
import { ContractFinancialEngine } from '@/services/db/ContractFinancialEngine';
import { DbService } from '@/services/mockDb';

// Modular Components
import { ContractStep1_BasicInfo } from '@/components/contracts/ContractStep1_BasicInfo';
import { ContractStep2_Financial } from '@/components/contracts/ContractStep2_Financial';
import { ContractStep3_Terms } from '@/components/contracts/ContractStep3_Terms';
import { ContractStep4_Preview } from '@/components/contracts/ContractStep4_Preview';
import { ContractSettlement } from '@/components/contracts/ContractSettlement';
import { InstallmentPreviewRow } from '@/components/contracts/types';

interface ContractFormProps {
  id?: string;
  onClose?: () => void;
  onSuccess?: () => void;
}

export const ContractFormPanel: React.FC<ContractFormProps> = ({ id, onClose, onSuccess }) => {
  const t = useCallback((s: string) => s, []);
  const isEditMode = Boolean(id && id !== 'new');
  const baseId = useId();
  const [step, setStep] = useState(1);
  const toast = useToast();
  const { warning } = useNotification();


  const [contract, setContract] = useState<Partial<العقود_tbl>>({
    تاريخ_البداية: todayDateOnlyISO(),
    تكرار_الدفع: 12,
    مدة_العقد_بالاشهر: 12,
    طريقة_الدفع: 'Prepaid',
    يوجد_دفعة_اولى: false,
    تقسيط_الدفعة_الأولى: false,
    احتساب_فرق_ايام: false,
    يوم_الدفع: 1,
    lateFeeType: 'none',
    lateFeeValue: 0,
    lateFeeGraceDays: 0,
  });

  const [commOwner, setCommOwner] = useState<number | ''>('');
  const [commTenant, setCommTenant] = useState<number | ''>('');
  const [commissionPaidMonth, setCommissionPaidMonth] = useState('');
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>({});
  const [hasPaidInstallments] = useState(false);
  const [regenerateInstallments, setRegenerateInstallments] = useState(true);
  const [installmentsPreview, setInstallmentsPreview] = useState<InstallmentPreviewRow[]>([]);
  const [dayDiffValue, setDayDiffValue] = useState(0);

  const contractValueInfo = useMemo(() => {
    const annualValue = Number(contract.القيمة_السنوية || 0);
    const months = Number(contract.مدة_العقد_بالاشهر || 12);
    const monthly = annualValue / 12;
    const total = monthly * months;
    return { monthly, total, months };
  }, [contract.القيمة_السنوية, contract.مدة_العقد_بالاشهر]);

  useEffect(() => {
    const annualValue = Math.max(0, Number(contract.القيمة_السنوية || 0));
    const payDay = Number(contract.يوم_الدفع || 1);
    setDayDiffValue(ContractFinancialEngine.calculateDayDiffValue(contract.تاريخ_البداية || todayDateOnlyISO(), annualValue, payDay));
  }, [contract.تاريخ_البداية, contract.القيمة_السنوية, contract.يوم_الدفع]);

  useEffect(() => {
    if (!contract.رقم_العقار || !contract.القيمة_السنوية || !contract.تاريخ_البداية) return;
    try {
      const generated = ContractFinancialEngine.calculateSchedule(contract, id || 'preview');
      const resolvedPropertyCode = (() => {
        if (!contract.رقم_العقار) return '—';
        try {
          const props = DbService.getProperties();
          const prop = props.find((p) => p.رقم_العقار === contract.رقم_العقار);
          return prop?.الكود_الداخلي || contract.رقم_العقار;
        } catch {
          return contract.رقم_العقار;
        }
      })();
      const preview: InstallmentPreviewRow[] = generated.map((inst, i) => ({
         rank: inst.ترتيب_الكمبيالة || i + 1,
         type: inst.نوع_الدفعة as 'فرق أيام' | 'دفعة أولى' | 'إيجار' | 'تأمين' | 'دورية',
         date: inst.تاريخ_استحقاق,
         amount: inst.القيمة,
         propertyCode: resolvedPropertyCode,
      }));
      setInstallmentsPreview(preview);
    } catch (err) {
      console.warn('Failed to generate preview:', err);
    }
  }, [contract, id]);

  const handleNext = () => {
    if (step === 1 && (!contract.رقم_العقار || !contract.رقم_المستاجر)) {
       warning(t('يرجى اختيار العقار والمستأجر'));
       return;
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    if (!contract.رقم_العقار || !contract.رقم_المستاجر) {
      toast.error(t('يرجى اختيار العقار والمستأجر'));
      return;
    }
    if (!contract.القيمة_السنوية || Number(contract.القيمة_السنوية) <= 0) {
      toast.error(t('يرجى إدخال القيمة السنوية'));
      return;
    }
    try {
      let res;
      if (isEditMode && id) {
        res = DbService.updateContract(
          id,
          contract,
          Number(commOwner || 0),
          Number(commTenant || 0),
          commissionPaidMonth || undefined,
          { regenerateInstallments }
        );
      } else {
        res = DbService.createContract(
          contract,
          Number(commOwner || 0),
          Number(commTenant || 0),
          commissionPaidMonth || undefined
        );
      }
      if (res.success) {
        toast.success(isEditMode ? t('تم تعديل العقد بنجاح') : t('تم إنشاء العقد بنجاح'));
        onSuccess?.();
        onClose?.();
      } else {
        toast.error(res.message || t('فشل في حفظ العقد'));
      }
    } catch (_err) {
      toast.error(t('فشل في حفظ العقد'));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden">
      <div className="p-6 border-b flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
             {isEditMode ? t('تعديل العقد') : t('إنشاء عقد جديد')}
          </h2>
          <div className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-widest">AZRAR — CONTRACT ENGINE v2</div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">✕</button>
      </div>

      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        {step === 1 && <ContractStep1_BasicInfo contract={contract} setContract={setContract} baseId={baseId} t={t} />}
        {step === 2 && <ContractStep2_Financial contract={contract} setContract={setContract} baseId={baseId} t={t} dayDiffValue={dayDiffValue} contractValueInfo={contractValueInfo} />}
        {step === 3 && (
          <ContractStep3_Terms 
            contract={contract} setContract={setContract} baseId={baseId} t={t} 
            commOwner={commOwner} setCommOwner={setCommOwner}
            commTenant={commTenant} setCommTenant={setCommTenant}
            commissionPaidMonth={commissionPaidMonth} setCommissionPaidMonth={setCommissionPaidMonth}
            isEditMode={isEditMode}
            recalcCommissionAuto={() => {}}
            contractValueInfo={contractValueInfo}
            dynamicValues={dynamicValues} setDynamicValues={setDynamicValues}
            hasPaidInstallments={hasPaidInstallments}
            regenerateInstallments={regenerateInstallments} setRegenerateInstallments={setRegenerateInstallments}
          />
        )}
        {step === 4 && <ContractStep4_Preview contract={contract} setContract={setContract} baseId={baseId} t={t} installmentsPreview={installmentsPreview} setInstallmentsPreview={setInstallmentsPreview} isEditMode={isEditMode} id={id} />}
        {step === 5 && <ContractSettlement contract={contract} setContract={setContract} baseId={baseId} t={t} />}
      </div>

      <div className="p-4 border-t flex justify-between bg-gray-50 dark:bg-slate-900">
        {step > 1 && (
          <button onClick={handleBack} className="px-6 py-2 rounded-lg border border-gray-300 flex items-center gap-2 font-bold hover:bg-white transition">
            <ArrowRight size={16} /> {t('رجوع')}
          </button>
        )}
        <div className="flex-1" />
        {step < 4 ? (
          <button onClick={handleNext} className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-2 hover:bg-indigo-700 transition">
             {t('التالي')} <ArrowLeft size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit} className="px-8 py-2 rounded-lg bg-green-600 text-white font-bold flex items-center gap-2 hover:bg-green-700 transition">
             <Check size={18} /> {step === 5 ? t('إغلاق') : t('إنشاء العقد')}
          </button>
        )}
      </div>
    </div>
  );
};
