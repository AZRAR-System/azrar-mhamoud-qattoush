import React, { useId, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DbService } from '@/services/mockDb';
import { الأشخاص_tbl, العقارات_tbl, العقود_tbl, PaymentMethodType, SmartSuggestion } from '@/types';
import { useToast } from '@/context/ToastContext';
import { useNotification } from '@/hooks/useNotification';
import { useSmartModal } from '@/context/ModalContext';
import { DatePicker } from '@/components/ui/DatePicker';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { PropertyPicker } from '@/components/shared/PropertyPicker';
import { Calculator, HandCoins, Check, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import { SmartEngine } from '@/services/smartEngine';
import { SmartAssistant } from '@/components/smart/SmartAssistant';
import { DynamicFieldsSection } from '@/components/dynamic/DynamicFieldsSection';
import { formatDateOnly, parseDateOnly, toDateOnly, todayDateOnlyISO, daysBetweenDateOnly } from '@/utils/dateOnly';
import { formatCurrencyJOD, roundCurrency } from '@/utils/format';
import { ContractFinancialEngine } from '@/services/db/ContractFinancialEngine';
import { CurrencySuffix } from '@/components/ui/CurrencySuffix';
import {
  normalizeDigitsToLatin,
  parseIntOrUndefined,
  parseNumberOrUndefined,
} from '@/utils/numberInput';
import { domainGetSmart } from '@/services/domainQueries';
import { listAttachmentsSmart } from '@/services/refsDataSmart';

type InstallmentPreviewRow = {
  rank: number;
  type: 'فرق أيام' | 'دفعة أولى' | 'إيجار' | 'تأمين';
  date: string;
  amount: number;
  propertyCode: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const addMonthsDateOnly = (isoDate: string, months: number) => {
  const d = parseDateOnly(isoDate);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setMonth(next.getMonth() + months);
  return formatDateOnly(next);
};

const addDaysDateOnly = (isoDate: string, days: number) => {
  const d = parseDateOnly(isoDate);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + days);
  return formatDateOnly(next);
};

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
  const commissionTouchedRef = useRef(false);
  const commissionMonthTouchedRef = useRef(false);
  const rentPaymentTextTouchedRef = useRef(false);
  const contractDurationTextTouchedRef = useRef(false);

  const [contract, setContract] = useState<Partial<العقود_tbl>>({
    تاريخ_البداية: todayDateOnlyISO(),
    رقم_الفرصة: '',
    تكرار_الدفع: 12,
    مدة_العقد_بالاشهر: 12,
    نص_مدة_العقد: '',
    نص_كيفية_أداء_البدل: '',
    قيمة_التأمين: undefined,
    طريقة_الدفع: 'Prepaid',
    يوجد_دفعة_اولى: false,
    تقسيط_الدفعة_الأولى: false,
    عدد_أقساط_الدفعة_الأولى: undefined,
    قيمة_الدفعة_الاولى: undefined,
    احتساب_فرق_ايام: false,
    يوم_الدفع: 1,
    مبلغ_الفرقية: undefined,
    رقم_العقار: '',
    رقم_المستاجر: '',
    القيمة_السنوية: undefined,
    lateFeeType: 'none',
    lateFeeValue: 0,
    lateFeeGraceDays: 0,
    lateFeeMaxAmount: undefined,
  });

  const initialContractRef = useRef(contract);

  const [commOwner, setCommOwner] = useState<number | ''>('');
  const [commTenant, setCommTenant] = useState<number | ''>('');
  const [commissionPaidMonth, setCommissionPaidMonth] = useState('');
  const [hasPaidInstallments, setHasPaidInstallments] = useState(false);
  const [regenerateInstallments, setRegenerateInstallments] = useState(true);
  const [installmentsPreview, setInstallmentsPreview] = useState<InstallmentPreviewRow[]>([]);
  const [dayDiffValue, setDayDiffValue] = useState(0);

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>({});

  const toast = useToast();
  const notify = useNotification();
  const { openPanel } = useSmartModal();

  useEffect(() => {
    const recs = SmartEngine.predict('contract', initialContractRef.current);
    setSuggestions(recs);
  }, []);

  useEffect(() => {
    if (!isEditMode) return;
    const contractId = String(id || '').trim();
    if (!contractId) return;

    const details = DbService.getContractDetails(contractId);
    if (!details?.contract) {
      toast.error(t('تعذر تحميل بيانات العقد'));
      return;
    }

    setContract(details.contract);

    const dyn = details.contract.حقول_ديناميكية;
    setDynamicValues(isRecord(dyn) ? dyn : {});

    const comm = DbService.getCommissions?.().find((x) => x.رقم_العقد === contractId);
    setCommOwner(Number(comm?.عمولة_المالك ?? 0) || 0);
    setCommTenant(Number(comm?.عمولة_المستأجر ?? 0) || 0);
    setCommissionPaidMonth(String(comm?.شهر_دفع_العمولة ?? ''));

    commissionTouchedRef.current = true;
    rentPaymentTextTouchedRef.current = Boolean(
      String(details.contract.نص_كيفية_أداء_البدل ?? '').trim()
    );
    contractDurationTextTouchedRef.current = Boolean(
      String(details.contract.نص_مدة_العقد ?? '').trim()
    );

    const paid = (details.installments || []).some(
      (i) => String(i?.حالة_الكمبيالة || '').trim() === 'مدفوع'
    );
    setHasPaidInstallments(paid);
    setRegenerateInstallments(!paid);
  }, [id, isEditMode, t, toast]);

  useEffect(() => {
    if (step !== 2) return;
    if (contractDurationTextTouchedRef.current) return;

    const monthsRaw = Number(contract.مدة_العقد_بالاشهر ?? 0);
    if (!Number.isFinite(monthsRaw) || monthsRaw <= 0) return;
    const months = Math.max(1, Math.trunc(monthsRaw));

    const monthText = (m: number) => {
      switch (m) {
        case 1: return 'شهر واحد';
        case 2: return 'شهرين';
        case 3: return 'ثلاثة أشهر';
        case 4: return 'أربعة أشهر';
        case 5: return 'خمسة أشهر';
        case 6: return 'ستة أشهر';
        case 7: return 'سبعة أشهر';
        case 8: return 'ثمانية أشهر';
        case 9: return 'تسعة أشهر';
        case 10: return 'عشرة أشهر';
        case 11: return 'أحد عشر شهراً';
        default: return `${m} شهر`;
      }
    };

    const years = Math.floor(months / 12);
    const rem = months % 12;

    const yearsText = (() => {
      if (years <= 0) return '';
      if (years === 1) return 'سنة واحدة';
      if (years === 2) return 'سنتين';
      if (years <= 10) return `${years} سنوات`;
      return `${years} سنة`;
    })();

    const remText = rem > 0 ? monthText(rem) : '';
    const joined = yearsText && remText ? `${yearsText} و${remText}` : yearsText || remText;

    const generated = joined ? `${joined} فقط تجدد تلقائيا برضى الطرفين` : '';
    if (String(contract.نص_مدة_العقد || '').trim() !== String(generated).trim()) {
      setContract((prev) => ({ ...prev, نص_مدة_العقد: generated }));
    }
  }, [step, contract.مدة_العقد_بالاشهر, contract.نص_مدة_العقد]);

  useEffect(() => {
    if (step !== 2) return;
    if (rentPaymentTextTouchedRef.current) return;

    const annual = Math.max(0, Number(contract.القيمة_السنوية || 0));
    if (!annual) return;

    const paymentsPerYearRaw = Number(contract.تكرار_الدفع ?? 12);
    if (!Number.isFinite(paymentsPerYearRaw) || paymentsPerYearRaw <= 0) return;

    const paymentsPerYear = Math.max(1, paymentsPerYearRaw);
    const perPayment = roundCurrency(annual / paymentsPerYear);
    const installmentsText = (() => {
      switch (paymentsPerYear) {
        case 12: return 'بأقساط شهرية';
        case 6: return 'بأقساط كل شهرين';
        case 4: return 'بأقساط كل ثلاثة أشهر';
        case 3: return 'بأقساط كل أربعة أشهر';
        case 2: return 'بأقساط كل ستة أشهر';
        case 1: return 'بقسط سنوي واحد';
        default: return '';
      }
    })();

    const payMethod = String(contract.طريقة_الدفع || 'Prepaid').trim();
    const isPostpaid = payMethod === 'Postpaid';
    const timingText = isPostpaid ? 'مؤخراً' : 'مقدماً';

    const periodEndText = (() => {
      switch (paymentsPerYear) {
        case 12: return 'نهاية كل شهر';
        case 6: return 'نهاية كل شهرين';
        case 4: return 'نهاية كل ثلاثة أشهر';
        case 3: return 'نهاية كل أربعة أشهر';
        case 2: return 'نهاية كل ستة أشهر';
        case 1: return 'نهاية كل سنة';
        default: return 'نهاية كل فترة';
      }
    })();

    const amountText = `(${perPayment} دينار اردني فقط)`;

    const generated = isPostpaid
      ? `تدفع ${timingText} ${periodEndText} بقيمة ${amountText}.`
      : `تدفع ${timingText} بداية المدة ${installmentsText || `على ${paymentsPerYear} دفعات`} بقيمة ${amountText}.`;
    if (String(contract.نص_كيفية_أداء_البدل || '').trim() !== generated.trim()) {
      setContract((prev) => ({ ...prev, نص_كيفية_أداء_البدل: generated }));
    }
  }, [
    isEditMode,
    step,
    contract.القيمة_السنوية,
    contract.تكرار_الدفع,
    contract.طريقة_الدفع,
    contract.نص_كيفية_أداء_البدل,
  ]);

  useEffect(() => {
    if (step !== 2) return;
    if (!contract.مدة_العقد_بالاشهر) return;
    const startBase = contract.تاريخ_البداية || todayDateOnlyISO();
    const endCandidate = addMonthsDateOnly(startBase, contract.مدة_العقد_بالاشهر || 12);
    if (!endCandidate) return;
    const endBase = addDaysDateOnly(endCandidate, -1) || endCandidate;

    if (contract.تاريخ_البداية !== startBase || contract.تاريخ_النهاية !== endBase) {
      setContract((prev) => ({ ...prev, تاريخ_البداية: startBase, تاريخ_النهاية: endBase }));
    }

    const annualValue = Math.max(0, Number(contract.القيمة_السنوية || 0));
    const payDay = Number(contract.يوم_الدفع || 1);
    setDayDiffValue(ContractFinancialEngine.calculateDayDiffValue(startBase, annualValue, payDay));
  }, [
    step,
    contract.تاريخ_البداية,
    contract.مدة_العقد_بالاشهر,
    contract.القيمة_السنوية,
    contract.تاريخ_النهاية,
    contract.يوم_الدفع,
  ]);

  const applySuggestions = (recs: SmartSuggestion[]) => {
    const patch = recs.reduce<Partial<العقود_tbl>>((acc, s) => {
      (acc as Record<string, unknown>)[s.field] = s.suggestedValue;
      return acc;
    }, {});
    setContract((prev) => ({ ...prev, ...patch }));
    setSuggestions([]);
    toast.success(t('تم تعبئة تفاصيل العقد تلقائياً'));
  };

  const checkBlacklist = (personId: string, role: string) => {
    const bl = DbService.getPersonBlacklistStatus(personId);
    if (bl) {
      toast.error(`${t('تحذير:')} ${t(role)} ${t('مدرج في القائمة السوداء! السبب:')} ${bl.reason}`);
    }
  };

  useEffect(() => {
    if (commissionTouchedRef.current) return;

    const annual = Math.max(0, Number(contract.القيمة_السنوية || 0));
    if (!annual) return;

    const months = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
    const contractValueByMonths = Math.round((annual * months) / 12);

    const settings = DbService.getSettings();
    const ownerPct = settings.rentalCommissionOwnerPercent || 0;
    const tenantPct = settings.rentalCommissionTenantPercent || 0;

    setCommOwner(Math.round(contractValueByMonths * (ownerPct / 100)));
    setCommTenant(Math.round(contractValueByMonths * (tenantPct / 100)));
  }, [contract.القيمة_السنوية, contract.مدة_العقد_بالاشهر]);

  const contractValueInfo = useMemo(() => {
    const annual = Math.max(0, Number(contract.القيمة_السنوية || 0));
    const months = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
    const monthly = annual / 12;
    const total = Math.round((annual * months) / 12);
    return { annual, months, monthly, total };
  }, [contract.القيمة_السنوية, contract.مدة_العقد_بالاشهر]);

  const recalcCommissionAuto = () => {
    const settings = DbService.getSettings();
    const ownerPct = settings.rentalCommissionOwnerPercent || 0;
    const tenantPct = settings.rentalCommissionTenantPercent || 0;
    const base = Math.max(0, Number(contractValueInfo.total || 0));
    setCommOwner(Math.round(base * (ownerPct / 100)));
    setCommTenant(Math.round(base * (tenantPct / 100)));
    commissionTouchedRef.current = true;
    toast.success(t('تمت إعادة احتساب العمولة تلقائياً'));
  };

  const contractDurationTextOptions = useMemo(() => DbService.getLookupsByCategory('contract_duration_text'), []);
  const contractRentPaymentTextOptions = useMemo(() => DbService.getLookupsByCategory('contract_rent_payment_text'), []);

  useEffect(() => {
    if (isEditMode) return;
    if (commissionMonthTouchedRef.current) return;

    const startRaw = String(contract.تاريخ_البداية || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(startRaw)) {
      const ym = startRaw.slice(0, 7);
      if (commissionPaidMonth !== ym) setCommissionPaidMonth(ym);
      return;
    }

    if (!commissionPaidMonth) {
      setCommissionPaidMonth(todayDateOnlyISO().slice(0, 7));
    }
  }, [isEditMode, contract.تاريخ_البداية, commissionPaidMonth]);

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();

    if (step === 1) {
      if (!contract.رقم_العقار || !contract.رقم_المستاجر) {
        toast.warning('يرجى اختيار العقار والمستأجر للمتابعة');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!contract.القيمة_السنوية || !contract.مدة_العقد_بالاشهر) {
        toast.warning('يرجى إدخال القيمة السنوية والمدة');
        return;
      }

      const startBase = contract.تاريخ_البداية || todayDateOnlyISO();
      const endBase = contract.تاريخ_النهاية;
      if (!endBase) {
        toast.error(t('يرجى التأكد من تاريخ البداية والمدة'));
        return;
      }

      // Delegate preview generation to the Engine
      const propertyId = contract.رقم_العقار;
      const propertyDetails = DbService.getPropertyDetails(propertyId || '');
      const propertyCode = propertyDetails?.property?.الكود_الداخلي || 'N/A';

      const generated = ContractFinancialEngine.calculateSchedule(contract as العقود_tbl, id || 'preview');
      const preview: InstallmentPreviewRow[] = generated.map((inst, i) => ({
         rank: inst.ترتيب_الكمبيالة || i + 1,
         type: inst.نوع_الدفعة as InstallmentPreviewRow['type'],
         date: inst.تاريخ_استحقاق,
         amount: inst.القيمة,
         propertyCode
      }));

      setInstallmentsPreview(preview);
      setStep(3);
    }
  };

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();

    const durationMonths = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
    const splitDownPayment = Boolean(contract.تقسيط_الدفعة_الأولى);
    const rawSplitCount = Number(contract.عدد_أقساط_الدفعة_الأولى || 0);
    const splitCount = Number.isFinite(rawSplitCount) ? Math.trunc(rawSplitCount) : 0;
    if (splitDownPayment) {
      const maxAllowed = Math.min(60, durationMonths);
      if (splitCount < 2 || splitCount > maxAllowed) {
        toast.warning(`عدد أقساط الدفعة الأولى يجب أن يكون بين 2 و ${maxAllowed}`);
        return;
      }
    }

    const payload: Partial<العقود_tbl> = {
      ...contract,
      حقول_ديناميكية: Object.keys(dynamicValues || {}).length ? dynamicValues : undefined,
    };

    const opp = String(payload.رقم_الفرصة ?? '').trim();
    payload.رقم_الفرصة = opp || undefined;

    const res = isEditMode
      ? DbService.updateContract(String(id), payload, Number(commOwner || 0), Number(commTenant || 0), commissionPaidMonth, { regenerateInstallments })
      : DbService.createContract(payload, Number(commOwner || 0), Number(commTenant || 0), commissionPaidMonth);

    if (!res.success) {
      toast.error(res.message);
      return;
    }

    if (isEditMode) {
      toast.success(t('تم تعديل العقد بنجاح'));
      if (onSuccess) onSuccess();
      if (onClose) onClose();
      return;
    }

    let tenantName = 'مستأجر';
    const tenantId = String(contract.رقم_المستاجر || '').trim();
    if (tenantId) {
      const isDesktopFast = typeof window !== 'undefined' && !!window.desktopDb?.domainGet;
      if (isDesktopFast) {
        try {
          const t = await domainGetSmart('people', tenantId);
          tenantName = String(t?.الاسم || '').trim() || tenantName;
        } catch {}
      } else {
        const tenants = DbService.getPeople();
        const tenant = tenants.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
        tenantName = tenant?.الاسم || tenantName;
      }
    }

    const newContractId = res.data?.رقم_العقد || 'ن/A';
    toast.success(t('تم إنشاء العقد بنجاح'));
    notify.contractCreated(newContractId, tenantName);

    try {
      const contractData = res.data as العقود_tbl;
      const appSettings = DbService.getSettings?.();
      const isEnabled = appSettings?.contractWhatsAppPromptAfterCreate !== false;
      if (!isEnabled) {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
        return;
      }

      const openWhatsAppPanel = async () => {
        try {
          const propertyId = String(contractData?.رقم_العقار || '').trim();
          const tenantId2 = String(contractData?.رقم_المستاجر || '').trim();
          const guarantorId = String(contractData?.رقم_الكفيل || '').trim();

          const property = propertyId ? ((await domainGetSmart('properties', propertyId)) as العقارات_tbl | null) : null;
          const tenant = tenantId2 ? ((await domainGetSmart('people', tenantId2)) as الأشخاص_tbl | null) : null;
          const ownerId = String(property?.رقم_المالك || '').trim();
          const owner = ownerId ? ((await domainGetSmart('people', ownerId)) as الأشخاص_tbl | null) : null;
          const guarantor = guarantorId ? ((await domainGetSmart('people', guarantorId)) as الأشخاص_tbl | null) : null;

          const atts = await listAttachmentsSmart('Contract', String(contractData.رقم_العقد || ''));
          const installments = (installmentsPreview || []).map((x) => ({
            rank: x.rank,
            type: x.type,
            date: x.date,
            amount: Number(x.amount || 0),
          }));

          openPanel('CONTRACT_WHATSAPP_SEND', contractData.رقم_العقد, {
            contract: contractData,
            property,
            tenant,
            owner,
            guarantor,
            commissionOwner: Number(commOwner || 0),
            commissionTenant: Number(commTenant || 0),
            installments,
            attachments: (atts || []).map((a) => ({ fileName: a.fileName })),
          });
        } catch {}
      };

      const contractKey = String(contractData?.رقم_العقد || '').trim();
      const promptKey = contractKey ? `contract_whatsapp_prompt_${contractKey}` : 'contract_whatsapp_prompt';

      openPanel('CONFIRM_MODAL', promptKey, {
        title: t('إرسال واتساب'),
        message: t('هل تريد فتح شاشة إرسال واتساب لرسالة توقيع العقد الآن؟\n\nيمكنك اختيار المستأجر/المالك/الكفيل، ثم تأكيد الإرسال من داخل الشاشة.'),
        confirmText: t('نعم، افتح شاشة الإرسال'),
        cancelText: t('لاحقاً'),
        onConfirm: () => { void openWhatsAppPanel(); },
      });
    } catch {}
    if (onSuccess) onSuccess();
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
      <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
        <h3 className="text-xl font-bold">
          {isEditMode ? t('معالج تعديل العقد') : t('معالج إنشاء عقد جديد')}
        </h3>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-indigo-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'}`}
            >
              {step > s ? <Check size={16} /> : s}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <SmartAssistant
          suggestions={suggestions}
          onAccept={applySuggestions}
          onDismiss={() => setSuggestions([])}
        />

        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <h4 className="text-lg font-bold border-b pb-2">{t('1. اختيار الأطراف')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PropertyPicker
                required
                value={contract.رقم_العقار}
                onChange={(id) => setContract((prev) => ({ ...prev, رقم_العقار: id }))}
                filterStatus={isEditMode ? undefined : 'شاغر'}
                placeholder={t('اختر العقار الشاغر...')}
                purpose="rent"
                disabled={isEditMode}
              />
              <PersonPicker
                label={t('المستأجر')}
                required
                value={contract.رقم_المستاجر}
                onChange={(id) => {
                  setContract((prev) => ({ ...prev, رقم_المستاجر: id }));
                  checkBlacklist(id, 'المستأجر');
                }}
                defaultRole="مستأجر"
                initialRoleFilter="All"
                enableUnlinkedFirst
                unlinkedFirstByDefault
                disabled={isEditMode}
              />
              <PersonPicker
                label={t('الكفيل (اختياري)')}
                value={contract.رقم_الكفيل}
                onChange={(id) => {
                  setContract((prev) => ({ ...prev, رقم_الكفيل: id }));
                  checkBlacklist(id, 'الكفيل');
                }}
                defaultRole="كفيل"
                initialRoleFilter="All"
                enableUnlinkedFirst
                unlinkedFirstByDefault
              />

              <div className="md:col-span-2">
                <label htmlFor={`${baseId}-opportunity`} className="block text-sm font-bold mb-1">
                  {t('رقم الفرصة (اختياري)')}
                </label>
                <input
                  id={`${baseId}-opportunity`}
                  type="text"
                  className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="ltr"
                  value={String(contract.رقم_الفرصة ?? '')}
                  onChange={(e) => setContract((prev) => ({ ...prev, رقم_الفرصة: e.target.value }))}
                  placeholder={t('مثال: OP-12345')}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <h4 className="text-lg font-bold border-b pb-2">{t('2. البيانات المالية')}</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1">{t('تاريخ البداية')}</label>
                <DatePicker
                  value={contract.تاريخ_البداية}
                  onChange={(d) => setContract((prev) => ({ ...prev, تاريخ_البداية: d }))}
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-months`} className="block text-sm font-bold mb-1">
                  {t('المدة (أشهر)')}
                </label>
                <input
                  id={`${baseId}-months`}
                  type="text"
                  inputMode="numeric"
                  min="1"
                  max="240"
                  className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="ltr"
                  value={contract.مدة_العقد_بالاشهر ?? ''}
                  onChange={(e) => {
                    const raw = normalizeDigitsToLatin(e.target.value);
                    const n = parseIntOrUndefined(raw);
                    const clamped = n === undefined ? undefined : Math.max(1, Math.min(240, n));
                    setContract((prev) => ({ ...prev, مدة_العقد_بالاشهر: clamped }));
                  }}
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-annual`} className="block text-sm font-bold mb-1">
                  {t('القيمة السنوية')}
                </label>
                <div className="relative">
                  <input
                    id={`${baseId}-annual`}
                    type="text"
                    inputMode="decimal"
                    min="0"
                    className="w-full border border-gray-300 dark:border-slate-600 p-2 pr-10 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    dir="ltr"
                    value={contract.القيمة_السنوية ?? ''}
                    onChange={(e) => {
                      const raw = normalizeDigitsToLatin(e.target.value);
                      const n = parseNumberOrUndefined(raw);
                      setContract((prev) => ({
                        ...prev,
                        القيمة_السنوية: n === undefined ? undefined : Math.max(0, n),
                      }));
                    }}
                    aria-label={t('القيمة السنوية')}
                    title={t('القيمة السنوية')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                    <CurrencySuffix />
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor={`${baseId}-duration-text-pick`}
                  className="block text-sm font-bold mb-1"
                >
                  {t('مدة الإيجار (من الجدول المساعد)')}
                </label>
                <select
                  id={`${baseId}-duration-text-pick`}
                  className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  value=""
                  onChange={(e) => {
                    const val = String(e.target.value || '');
                    if (!val) return;
                    contractDurationTextTouchedRef.current = true;
                    setContract((prev) => ({ ...prev, نص_مدة_العقد: val }));
                  }}
                >
                  <option value="">{t('اختر...')}</option>
                  {contractDurationTextOptions.map((x) => (
                    <option key={x.id} value={x.label}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor={`${baseId}-duration-text`} className="block text-sm font-bold mb-1">
                  {t('مدة الإيجار (كتابة)')}
                </label>
                <textarea
                  id={`${baseId}-duration-text`}
                  className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  value={String(contract.نص_مدة_العقد ?? '')}
                  onChange={(e) => {
                    contractDurationTextTouchedRef.current = true;
                    setContract((prev) => ({ ...prev, نص_مدة_العقد: e.target.value }));
                  }}
                  placeholder={t('مثال: سنة واحدة تجدد تلقائي برضى الطرفين')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4">
                <div className="text-xs font-bold text-emerald-800">
                  {t('الإيجار الشهري (محسوب)')}
                </div>
                <div className="text-lg font-extrabold text-emerald-700 mt-1">
                  {formatCurrencyJOD(Math.round(contractValueInfo.monthly || 0))}
                </div>
                <div className="text-[11px] text-emerald-700/80 mt-1">
                  {t('= القيمة السنوية ÷ 12')}
                </div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4">
                <div className="text-xs font-bold text-indigo-800">
                  {t('قيمة العقد حسب المدة (محسوبة)')}
                </div>
                <div className="text-lg font-extrabold text-indigo-700 mt-1">
                  {formatCurrencyJOD(Math.round(contractValueInfo.total || 0))}
                </div>
                <div className="text-[11px] text-indigo-700/80 mt-1">
                  {t('= (القيمة السنوية ÷ 12) ×')} {contractValueInfo.months} {t('شهر')}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {t('ملاحظة')}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  {t(
                    'عند كون العقد أقل من سنة (مثل 6 أشهر)، تعتمد العمولة على قيمة العقد حسب الأشهر وليس على القيمة السنوية كاملة.'
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={`${baseId}-deposit`} className="block text-sm font-bold mb-1">
                  {t('قيمة التأمين')}
                </label>
                <div className="relative">
                  <input
                    id={`${baseId}-deposit`}
                    type="text"
                    inputMode="decimal"
                    min="0"
                    className="w-full border border-gray-300 dark:border-slate-600 p-2 pr-10 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    dir="ltr"
                    value={contract.قيمة_التأمين ?? ''}
                    onChange={(e) => {
                      const raw = normalizeDigitsToLatin(e.target.value);
                      const n = parseNumberOrUndefined(raw);
                      setContract((prev) => ({
                        ...prev,
                        قيمة_التأمين: n === undefined ? undefined : Math.max(0, n),
                      }));
                    }}
                    aria-label={t('قيمة التأمين')}
                    title={t('قيمة التأمين')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                    <CurrencySuffix />
                  </span>
                </div>
              </div>
              <div>
                <label
                  htmlFor={`${baseId}-deposit-duedate`}
                  className="block text-sm font-bold mb-1"
                >
                  {t('تاريخ استحقاق التأمين (قبل الانتهاء بيوم)')}
                </label>
                <input
                  id={`${baseId}-deposit-duedate`}
                  type="date"
                  className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={
                    contract.تاريخ_النهاية
                      ? (() => {
                          const d = addDaysDateOnly(contract.تاريخ_النهاية, -1);
                          return d ? d : '';
                        })()
                      : ''
                  }
                  disabled
                />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
              <h5 className="font-bold mb-3 flex items-center gap-2">
                <Calculator size={16} /> {t('تفاصيل الدفع')}
              </h5>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label htmlFor={`${baseId}-paymethod`} className="block text-sm font-bold mb-1">
                    {t('طريقة الدفع')}
                  </label>
                  <select
                    id={`${baseId}-paymethod`}
                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    value={contract.طريقة_الدفع}
                    onChange={(e) =>
                      setContract((prev) => ({
                        ...prev,
                        طريقة_الدفع: e.target.value as PaymentMethodType,
                      }))
                    }
                  >
                    <option value="Prepaid">{t('دفع مقدم (Prepaid)')}</option>
                    <option value="Postpaid">{t('دفع مؤخر (Postpaid)')}</option>
                    <option value="DownPayment_Monthly">{t('دفعة أولى + شهري')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`${baseId}-freq`} className="block text-sm font-bold mb-1">
                    {t('التكرار (عدد الدفعات)')}
                  </label>
                  <select
                    id={`${baseId}-freq`}
                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    value={contract.تكرار_الدفع}
                    onChange={(e) =>
                      setContract((prev) => ({ ...prev, تكرار_الدفع: Number(e.target.value) }))
                    }
                  >
                    <option value={12}>{t('شهري')}</option>
                    <option value={6}>{t('كل شهرين')}</option>
                    <option value={4}>{t('ربع سنوي')}</option>
                    <option value={2}>{t('نصف سنوي')}</option>
                    <option value={1}>{t('سنوي')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`${baseId}-payday`} className="block text-sm font-bold mb-1">
                    {t('يوم الدفع الشهري')}
                  </label>
                  <select
                    id={`${baseId}-payday`}
                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    value={contract.يوم_الدفع || 1}
                    onChange={(e) =>
                      setContract((prev) => ({ ...prev, يوم_الدفع: Number(e.target.value) }))
                    }
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <input
                      id={`${baseId}-enable-daydiff`}
                      type="checkbox"
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                      checked={contract.احتساب_فرق_ايام}
                      onChange={(e) =>
                        setContract((prev) => ({ ...prev, احتساب_فرق_ايام: e.target.checked }))
                      }
                    />
                    <label htmlFor={`${baseId}-enable-daydiff`} className="text-sm font-bold cursor-pointer">
                      {t('تفعيل فرقية الأيام (مبلغ إضافي)')}
                    </label>
                  </div>
                  {contract.احتساب_فرق_ايام && (
                    <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                      {t('محسوب تلقائياً:')} {formatCurrencyJOD(dayDiffValue)}
                    </div>
                  )}
                </div>

                {contract.احتساب_فرق_ايام && (
                  <div className="animate-slide-down">
                    <label htmlFor={`${baseId}-daydiff-amount`} className="block text-xs font-bold text-slate-500 mb-1">
                      {t('مبلغ الفرقية النهائي (يمكنك تعديله)')}
                    </label>
                    <div className="relative">
                      <input
                        id={`${baseId}-daydiff-amount`}
                        type="text"
                        inputMode="decimal"
                        className="w-full border border-gray-300 dark:border-slate-600 p-2 pr-10 rounded-lg bg-indigo-50/30 dark:bg-slate-700 text-indigo-900 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        dir="ltr"
                        value={contract.مبلغ_الفرقية !== undefined ? contract.مبلغ_الفرقية : dayDiffValue}
                        onChange={(e) => {
                          const raw = normalizeDigitsToLatin(e.target.value);
                          const n = parseNumberOrUndefined(raw);
                          setContract((prev) => ({ ...prev, مبلغ_الفرقية: n }));
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                        <CurrencySuffix />
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor={`${baseId}-rentpay-text-pick`}
                    className="block text-sm font-bold mb-1"
                  >
                    {t('كيفية أداء البدل (من الجدول المساعد)')}
                  </label>
                  <select
                    id={`${baseId}-rentpay-text-pick`}
                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    value=""
                    onChange={(e) => {
                      const val = String(e.target.value || '');
                      if (!val) return;
                      rentPaymentTextTouchedRef.current = true;
                      setContract((prev) => ({ ...prev, نص_كيفية_أداء_البدل: val }));
                    }}
                  >
                    <option value="">{t('اختر...')}</option>
                    {contractRentPaymentTextOptions.map((x) => (
                      <option key={x.id} value={x.label}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor={`${baseId}-rentpay-text`}
                    className="block text-sm font-bold mb-1"
                  >
                    {t('كيفية أداء البدل (كتابة)')}
                  </label>
                  <textarea
                    id={`${baseId}-rentpay-text`}
                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={2}
                    value={String(contract.نص_كيفية_أداء_البدل ?? '')}
                    onChange={(e) => {
                      rentPaymentTextTouchedRef.current = true;
                      setContract((prev) => ({ ...prev, نص_كيفية_أداء_البدل: e.target.value }));
                    }}
                    placeholder={t('مثال: يلتزم المستأجر بدفع بدل الإيجار مقدماً في بداية كل شهر')}
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded border">
                  <input
                    type="checkbox"
                    checked={contract.احتساب_فرق_ايام}
                    onChange={(e) =>
                      setContract((prev) => ({ ...prev, احتساب_فرق_ايام: e.target.checked }))
                    }
                  />
                  <span className="text-sm font-bold">
                    {t('احتساب كسر الشهر')} ({formatCurrencyJOD(dayDiffValue)})
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded border">
                  <input
                    type="checkbox"
                    checked={contract.يوجد_دفعة_اولى}
                    onChange={(e) =>
                      setContract((prev) => ({ ...prev, يوجد_دفعة_اولى: e.target.checked }))
                    }
                  />
                  <span className="text-sm font-bold">{t('يوجد دفعة أولى')}</span>
                </label>
              </div>
              {contract.يوجد_دفعة_اولى && (
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded border">
                    <input
                      type="checkbox"
                      checked={Number(contract.عدد_أشهر_الدفعة_الأولى || 0) > 0}
                      onChange={(e) =>
                        setContract((prev) => ({
                          ...prev,
                          عدد_أشهر_الدفعة_الأولى: e.target.checked ? 3 : undefined,
                          قيمة_الدفعة_الاولى: e.target.checked
                            ? undefined
                            : prev.قيمة_الدفعة_الاولى,
                          تقسيط_الدفعة_الأولى: e.target.checked ? false : prev.تقسيط_الدفعة_الأولى,
                          عدد_أقساط_الدفعة_الأولى: e.target.checked
                            ? undefined
                            : prev.عدد_أقساط_الدفعة_الأولى,
                        }))
                      }
                    />
                    <span className="text-sm font-bold">{t('الدفعة الأولى عن عدد أشهر')}</span>
                  </label>

                  {Number(contract.عدد_أشهر_الدفعة_الأولى || 0) > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={1}
                        max={Math.min(60, Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12)))}
                        placeholder={t('عدد الأشهر')}
                        aria-label={t('عدد أشهر الدفعة الأولى')}
                        title={t('عدد أشهر الدفعة الأولى')}
                        className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={Number(contract.عدد_أشهر_الدفعة_الأولى || 3)}
                        onChange={(e) => {
                          const dur = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
                          const maxAllowed = Math.min(60, dur);
                          const n = Math.trunc(Number(e.target.value));
                          const clamped = Number.isFinite(n)
                            ? Math.max(1, Math.min(maxAllowed, n))
                            : 1;
                          setContract((prev) => ({ ...prev, عدد_أشهر_الدفعة_الأولى: clamped }));
                        }}
                      />
                      <div className="relative">
                        <input
                          type="number"
                          disabled
                          aria-label={t('قيمة الدفعة الأولى (محسوبة)')}
                          title={t('قيمة الدفعة الأولى (محسوبة)')}
                          className="w-full border border-gray-300 dark:border-slate-600 p-2 pr-10 rounded-lg bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-white"
                          value={roundCurrency(
                            (Math.max(0, Number(contract.القيمة_السنوية || 0)) / 12) *
                              Math.max(0, Number(contract.عدد_أشهر_الدفعة_الأولى || 0))
                          )}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                          <CurrencySuffix />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={t('قيمة الدفعة')}
                        min="0"
                        className="w-full border border-gray-300 dark:border-slate-600 p-2 pr-10 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        dir="ltr"
                        value={contract.قيمة_الدفعة_الاولى ?? ''}
                        onChange={(e) => {
                          const raw = normalizeDigitsToLatin(e.target.value);
                          const n = parseNumberOrUndefined(raw);
                          setContract((prev) => ({
                            ...prev,
                            قيمة_الدفعة_الاولى: n === undefined ? undefined : Math.max(0, n),
                          }));
                        }}
                        aria-label={t('قيمة الدفعة الأولى')}
                        title={t('قيمة الدفعة الأولى')}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                        <CurrencySuffix />
                      </span>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded border">
                    <input
                      type="checkbox"
                      checked={Boolean(contract.تقسيط_الدفعة_الأولى)}
                      disabled={Number(contract.عدد_أشهر_الدفعة_الأولى || 0) > 0}
                      onChange={(e) =>
                        setContract((prev) => ({
                          ...prev,
                          عدد_أشهر_الدفعة_الأولى: e.target.checked
                            ? undefined
                            : prev.عدد_أشهر_الدفعة_الأولى,
                          تقسيط_الدفعة_الأولى: e.target.checked,
                          عدد_أقساط_الدفعة_الأولى: e.target.checked
                            ? Math.max(2, Number(prev.عدد_أقساط_الدفعة_الأولى || 2))
                            : undefined,
                        }))
                      }
                    />
                    <span className="text-sm font-bold">{t('تقسيط الدفعة الأولى')}</span>
                  </label>

                  {Boolean(contract.تقسيط_الدفعة_الأولى) && (
                    <input
                      type="number"
                      min={2}
                      max={Math.min(60, Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12)))}
                      placeholder={t('عدد أقساط الدفعة الأولى')}
                      className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={Number(contract.عدد_أقساط_الدفعة_الأولى || 2)}
                      onChange={(e) => {
                        const dur = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
                        const maxAllowed = Math.min(60, dur);
                        const n = Math.trunc(Number(e.target.value));
                        const clamped = Number.isFinite(n)
                          ? Math.max(2, Math.min(maxAllowed, n))
                          : 2;
                      }}
                    />
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
              <h5 className="font-bold mb-3 flex items-center gap-2 text-red-800 dark:text-red-400">
                <AlertTriangle size={16} /> {t('إعدادات غرامات التأخير')}
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1">{t('نوع الغرامة')}</label>
                  <select
                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-sm"
                    value={contract.lateFeeType || 'none'}
                    onChange={(e) => setContract(prev => ({ ...prev, lateFeeType: e.target.value as 'fixed' | 'percentage' | 'daily' | 'none' }))}
                  >
                    <option value="none">{t('بدون غرامات')}</option>
                    <option value="fixed">{t('مبلغ ثابت')}</option>
                    <option value="percentage">{t('نسبة مئوية من القسط')}</option>
                    <option value="daily">{t('غرامة يومية تراكمية')}</option>
                  </select>
                </div>
                {contract.lateFeeType !== 'none' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold mb-1">{t('القيمة')}</label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-sm"
                        value={contract.lateFeeValue || 0}
                        onChange={(e) => setContract(prev => ({ ...prev, lateFeeValue: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">{t('فترة السماح (أيام)')}</label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-sm"
                        value={contract.lateFeeGraceDays || 0}
                        onChange={(e) => setContract(prev => ({ ...prev, lateFeeGraceDays: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">{t('الحد الأقصى (اختياري)')}</label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-sm"
                        value={contract.lateFeeMaxAmount || ''}
                        onChange={(e) => setContract(prev => ({ ...prev, lateFeeMaxAmount: e.target.value ? Number(e.target.value) : undefined }))}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <DynamicFieldsSection
              formId="contracts"
              values={dynamicValues}
              onChange={setDynamicValues}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100">
              <h5 className="font-bold text-indigo-800 flex items-center gap-2">
                <HandCoins size={18} /> {t('العمولات (محسوبة تلقائياً)')}
              </h5>
              <div className="flex gap-4 mt-2 flex-wrap">
                <div className="flex-1">
                  <label htmlFor={`${baseId}-comm-tenant`} className="text-xs block mb-1">
                    {t('عمولة مستأجر')}
                  </label>
                  <div className="relative">
                    <input
                      id={`${baseId}-comm-tenant`}
                      type="text"
                      inputMode="decimal"
                      min="0"
                      className="w-full border border-gray-300 dark:border-slate-600 p-2 pr-10 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      dir="ltr"
                      value={commTenant}
                      onChange={(e) => {
                        commissionTouchedRef.current = true;
                        const raw = normalizeDigitsToLatin(e.target.value);
                        const n = parseNumberOrUndefined(raw);
                        setCommTenant(n === undefined ? '' : Math.max(0, n));
                      }}
                      aria-label={t('عمولة المستأجر')}
                      title={t('عمولة المستأجر')}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                      <CurrencySuffix />
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <label htmlFor={`${baseId}-comm-owner`} className="text-xs block mb-1">
                    {t('عمولة مالك')}
                  </label>
                  <div className="relative">
                    <input
                      id={`${baseId}-comm-owner`}
                      type="text"
                      inputMode="decimal"
                      min="0"
                      className="w-full border border-gray-300 dark:border-slate-600 p-2 pr-10 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      dir="ltr"
                      value={commOwner}
                      onChange={(e) => {
                        commissionTouchedRef.current = true;
                        const raw = normalizeDigitsToLatin(e.target.value);
                        const n = parseNumberOrUndefined(raw);
                        setCommOwner(n === undefined ? '' : Math.max(0, n));
                      }}
                      aria-label={t('عمولة المالك')}
                      title={t('عمولة المالك')}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                      <CurrencySuffix />
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor={`${baseId}-comm-month`} className="text-xs block mb-1">
                    {t('شهر دفع العمولة')}
                  </label>
                  <input
                    id={`${baseId}-comm-month`}
                    type="text"
                    inputMode="numeric"
                    placeholder={t('YYYY-MM')}
                    pattern="\\d{4}-\\d{2}"
                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label={t('شهر دفع العمولة (YYYY-MM)')}
                    title={t('شهر دفع العمولة (YYYY-MM)')}
                    value={commissionPaidMonth}
                    onChange={(e) => {
                      commissionMonthTouchedRef.current = true;
                      const raw = normalizeDigitsToLatin(e.target.value);
                      setCommissionPaidMonth(raw);
                    }}
                  />
                </div>
              </div>

              {isEditMode && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={recalcCommissionAuto}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition"
                  >
                    {t('إعادة احتساب العمولة تلقائياً')}
                  </button>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {t('الأساس:')} {formatCurrencyJOD(Math.round(contractValueInfo.total || 0))} (
                    {contractValueInfo.months} {t('شهر')})
                  </div>
                </div>
              )}
            </div>

            {isEditMode && (
              <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-[240px]">
                    <div className="font-bold text-amber-800">{t('تحديث الدفعات')}</div>
                    <div className="text-xs text-amber-700 mt-1">
                      {t(
                        'عند تفعيل هذا الخيار سيتم استبدال جدول الكمبيالات لهذا العقد بالجدول الجديد.'
                      )}
                    </div>
                    {hasPaidInstallments && (
                      <div className="text-xs text-red-700 mt-2 font-bold">
                        {t('يوجد دفعات مدفوعة، لذلك لا يمكن إعادة توليد الدفعات.')}
                      </div>
                    )}
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm font-bold text-amber-900 select-none">
                    <input
                      type="checkbox"
                      checked={regenerateInstallments}
                      disabled={hasPaidInstallments}
                      onChange={(e) => setRegenerateInstallments(e.target.checked)}
                    />
                    {t('إعادة توليد الدفعات (آمن عند عدم وجود دفعات مدفوعة)')}
                  </label>
                </div>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 max-h-96 overflow-auto">
              <h5 className="font-bold mb-4 flex items-center gap-2">
                📋 {t('جدول الدفعات المتوقع')}
              </h5>
              <table className="w-full text-sm table-fixed min-w-[760px]">
                <thead>
                  <tr className="bg-indigo-100 dark:bg-indigo-900/30 border-b-2 border-indigo-500">
                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">
                      #
                    </th>
                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">
                      {t('النوع')}
                    </th>
                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">
                      {t('الكود الداخلي')}
                    </th>
                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">
                      {t('التاريخ')}
                    </th>
                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">
                      {t('المبلغ')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {installmentsPreview.map((i, idx) => (
                    <tr
                      key={idx}
                      className={`border-b transition ${
                        i.type === 'تأمين'
                          ? 'bg-yellow-50 dark:bg-yellow-900/10'
                          : i.type === 'دفعة أولى'
                            ? 'bg-green-50 dark:bg-green-900/10'
                            : idx % 2 === 0
                              ? 'bg-white dark:bg-slate-800'
                              : 'bg-gray-50 dark:bg-slate-900'
                      } hover:bg-indigo-50 dark:hover:bg-indigo-900/20`}
                    >
                      <td className="p-2 text-right font-bold text-gray-700 dark:text-gray-300">
                        {i.rank}
                      </td>
                      <td className="p-2 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            i.type === 'تأمين'
                              ? 'bg-yellow-200 text-yellow-900'
                              : i.type === 'دفعة أولى'
                                ? 'bg-green-200 text-green-900'
                                : 'bg-indigo-200 text-indigo-900'
                          }`}
                        >
                          {t(i.type)}
                        </span>
                      </td>
                      <td className="p-2 text-right text-gray-600 dark:text-gray-400 font-semibold">
                        {i.propertyCode}
                      </td>
                      <td className="p-2 text-right text-gray-600 dark:text-gray-400">{i.date}</td>
                      <td className="p-2 text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrencyJOD(i.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-indigo-100 dark:bg-indigo-900/30 border-t-2 border-indigo-500 font-bold">
                    <td colSpan={4} className="p-2 text-right">
                      {t('الإجمالي:')}
                    </td>
                    <td className="p-2 text-right text-indigo-900 dark:text-indigo-300">
                      {formatCurrencyJOD(installmentsPreview.reduce((sum, i) => sum + i.amount, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t flex justify-between bg-gray-50 dark:bg-slate-900">
        {step === 1 ? (
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 transition"
          >
            {t('إلغاء')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            className="px-6 py-2 rounded-lg border border-gray-300 flex items-center gap-2 font-bold hover:bg-white transition"
          >
            <ArrowRight size={16} /> {t('رجوع')}
          </button>
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
          >
            {t('التالي')} <ArrowLeft size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            className="px-8 py-2 rounded-lg bg-green-600 text-white font-bold flex items-center gap-2 hover:bg-green-700 transition shadow-lg shadow-green-500/20"
          >
            <Check size={18} /> {t('إنشاء العقد')}
          </button>
        )}
      </div>
    </div>
  );
};
