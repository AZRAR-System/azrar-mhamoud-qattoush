import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DbService } from '@/services/mockDb';
import { العقود_tbl, PaymentMethodType, SmartSuggestion } from '@/types';
import { useToast } from '@/context/ToastContext';
import { useNotification } from '@/hooks/useNotification';
import { DatePicker } from '@/components/ui/DatePicker';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { PropertyPicker } from '@/components/shared/PropertyPicker';
import { Calculator, HandCoins, Check, ArrowRight, ArrowLeft, ShieldAlert } from 'lucide-react';
import { SmartEngine } from '@/services/smartEngine';
import { SmartAssistant } from '@/components/smart/SmartAssistant';
import { DynamicFieldsSection } from '@/components/dynamic/DynamicFieldsSection';
import { formatNumber } from '@/utils/format';
import { normalizeDigitsToLatin, parseIntOrUndefined, parseNumberOrUndefined } from '@/utils/numberInput';
import { domainGetSmart } from '@/services/domainQueries';
import { storage } from '@/services/storage';

const formatDateOnly = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const parseDateOnly = (iso: string) => {
    const parts = iso.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
};

const addMonthsDateOnly = (isoDate: string, months: number) => {
    const d = parseDateOnly(isoDate);
    if (!d) return null;
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    next.setMonth(next.getMonth() + months);
    return next;
};

const addDaysDateOnly = (isoDate: string, days: number) => {
    const d = parseDateOnly(isoDate);
    if (!d) return null;
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    next.setDate(next.getDate() + days);
    return next;
};

const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const calcDayDiffValue = (startIso: string, annualValue: number) => {
    const start = parseDateOnly(startIso);
    if (!start) return 0;
    const day = start.getDate();
    if (day <= 1) return 0;
    const dim = daysInMonth(start);
    const remainingDays = dim - day + 1;
    const monthRent = annualValue / 12;
    return Math.round((monthRent * remainingDays) / dim);
};

interface ContractFormProps {
    id?: string;
  onClose?: () => void;
  onSuccess?: () => void;
}

export const ContractFormPanel: React.FC<ContractFormProps> = ({ id, onClose, onSuccess }) => {
    const isEditMode = Boolean(id && id !== 'new');
  const [step, setStep] = useState(1);
    const commissionTouchedRef = useRef(false);
        const commissionMonthTouchedRef = useRef(false);
  
  // Initialize with empty strings for required fields to keep inputs controlled
  const [contract, setContract] = useState<Partial<العقود_tbl>>({
    تاريخ_البداية: '',
        رقم_الفرصة: '',
    تكرار_الدفع: undefined,
    مدة_العقد_بالاشهر: undefined,
    قيمة_التأمين: undefined,
    طريقة_الدفع: undefined,
    يوجد_دفعة_اولى: false,
        تقسيط_الدفعة_الأولى: false,
        عدد_أقساط_الدفعة_الأولى: undefined,
        قيمة_الدفعة_الاولى: undefined,
    احتساب_فرق_ايام: false,
    رقم_العقار: '',
    رقم_المستاجر: '',
    القيمة_السنوية: undefined
  });
  
    const [commOwner, setCommOwner] = useState<number | ''>('');
    const [commTenant, setCommTenant] = useState<number | ''>('');
    const [commissionPaidMonth, setCommissionPaidMonth] = useState('');
        const [hasPaidInstallments, setHasPaidInstallments] = useState(false);
        const [regenerateInstallments, setRegenerateInstallments] = useState(true);
  const [installmentsPreview, setInstallmentsPreview] = useState<any[]>([]);
  const [dayDiffValue, setDayDiffValue] = useState(0);
  
  // Smart Engine State
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
    const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});

  const toast = useToast();
  const notify = useNotification();

  const isDesktop = storage.isDesktop() && !!(window as any)?.desktopDb;

  if (isDesktop) {
      return (
          <div className="p-10 text-center text-slate-600 dark:text-slate-300">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />
              </div>
              <div className="font-bold">غير مدعوم في وضع الديسكتوب الحالي</div>
              <div className="text-sm mt-2">إنشاء/تعديل العقود يتطلب مسار حفظ SQL عبر IPC (غير متوفر حالياً) لتجنب تجمّد الواجهة.</div>
          </div>
      );
  }

  useEffect(() => {
      // Check for suggestions on mount
      const recs = SmartEngine.predict('contract', contract);
      setSuggestions(recs);
  }, []);

  // Load existing contract when opened in edit mode
  useEffect(() => {
      if (isDesktop) return;
      if (!isEditMode) return;
      const contractId = String(id || '').trim();
      if (!contractId) return;

      const details = DbService.getContractDetails(contractId);
      if (!details?.contract) {
          toast.error('تعذر تحميل بيانات العقد');
          return;
      }

      setContract({
          ...details.contract,
      } as any);

      const dyn = (details.contract as any)?.حقول_ديناميكية;
      setDynamicValues((dyn && typeof dyn === 'object') ? dyn : {});

      const comm = DbService.getCommissions?.().find((x: any) => x.رقم_العقد === contractId);
      setCommOwner(Number(comm?.عمولة_المالك ?? 0) || 0);
      setCommTenant(Number(comm?.عمولة_المستأجر ?? 0) || 0);
      setCommissionPaidMonth(String(comm?.شهر_دفع_العمولة ?? ''));

    // Do not auto-overwrite stored commissions when editing an existing contract.
    commissionTouchedRef.current = true;

      const paid = (details.installments || []).some((i: any) => String(i?.حالة_الكمبيالة || '').trim() === 'مدفوع');
      setHasPaidInstallments(paid);
      setRegenerateInstallments(!paid);
  }, [id, isEditMode, toast]);

  // Auto-calculate end date + day-diff while filling Step 2 so security date shows automatically.
  useEffect(() => {
      if (step !== 2) return;
      if (!contract.مدة_العقد_بالاشهر) return;
      const startBase = contract.تاريخ_البداية || formatDateOnly(new Date());
      const startDate = parseDateOnly(startBase);
      if (!startDate) return;

      const endCandidate = addMonthsDateOnly(startBase, (contract.مدة_العقد_بالاشهر || 12));
      if (!endCandidate) return;
      endCandidate.setDate(endCandidate.getDate() - 1);
      const endBase = formatDateOnly(endCandidate);

      // Avoid infinite loops
      if (contract.تاريخ_البداية !== startBase || contract.تاريخ_النهاية !== endBase) {
          setContract(prev => ({ ...prev, تاريخ_البداية: startBase, تاريخ_النهاية: endBase }));
      }

      const annualValue = Math.max(0, Number(contract.القيمة_السنوية || 0));
      setDayDiffValue(calcDayDiffValue(startBase, annualValue));
  }, [step, contract.تاريخ_البداية, contract.مدة_العقد_بالاشهر, contract.القيمة_السنوية, contract.تاريخ_النهاية]);

  const applySuggestions = (recs: SmartSuggestion[]) => {
      const newValues: any = {};
      recs.forEach(s => newValues[s.field] = s.suggestedValue);
      setContract(prev => ({ ...prev, ...newValues }));
      setSuggestions([]); // Dismiss
      toast.success('تم تعبئة تفاصيل العقد تلقائياً');
  };

  const checkBlacklist = (personId: string, role: string) => {
      const bl = DbService.getPersonBlacklistStatus(personId);
      if (bl) {
          toast.error(`تحذير: ${role} مدرج في القائمة السوداء! السبب: ${bl.reason}`);
      }
  };

  // Auto-calculate commissions when Annual Value changes
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
      return {
          annual,
          months,
          monthly,
          total,
      };
  }, [contract.القيمة_السنوية, contract.مدة_العقد_بالاشهر]);

    const recalcCommissionAuto = () => {
            const settings = DbService.getSettings();
            const ownerPct = settings.rentalCommissionOwnerPercent || 0;
            const tenantPct = settings.rentalCommissionTenantPercent || 0;
            const base = Math.max(0, Number(contractValueInfo.total || 0));
            setCommOwner(Math.round(base * (ownerPct / 100)));
            setCommTenant(Math.round(base * (tenantPct / 100)));
            commissionTouchedRef.current = true;
            toast.success('تمت إعادة احتساب العمولة تلقائياً');
    };

  // Default commission paid month to current month (YYYY-MM) on create.
  // Spec: calculations depend on commission month/date, not contract start.
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
          setCommissionPaidMonth(formatDateOnly(new Date()).slice(0, 7));
      }
  }, [isEditMode, contract.تاريخ_البداية, commissionPaidMonth]);

  const handleNext = (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent any form submission
      
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
          
          // Use pre-computed values from the Step 2 auto-calculation effect.
          const startBase = contract.تاريخ_البداية || formatDateOnly(new Date());
          const endBase = contract.تاريخ_النهاية;
          if (!endBase) {
              toast.error('يرجى التأكد من تاريخ البداية والمدة');
              return;
          }
          
          // Calculate installments preview for Step 3
          const durationMonths = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
          const paymentsPerYear = Math.max(1, Number(contract.تكرار_الدفع || 12));
          const annualValue = Math.max(0, Number(contract.القيمة_السنوية || 0));
          const periodMonths = 12 / paymentsPerYear;
          const normalizedPeriodMonths = Number.isFinite(periodMonths) && periodMonths > 0 ? periodMonths : 1;
          const rentInstallmentsCount = Math.max(1, Math.ceil(durationMonths / normalizedPeriodMonths));
          const totalRent = Math.round((annualValue * durationMonths) / 12);
          const preview = [];

          // Get property code from contract
          const propertyId = contract.رقم_العقار;
          const propertyDetails = DbService.getPropertyDetails(propertyId || '');
          const propertyCode = propertyDetails?.property?.الكود_الداخلي || 'N/A';

          // Extra day-diff installment
          if (contract.احتساب_فرق_ايام) {
              const dayDiff = calcDayDiffValue(startBase, annualValue);
              if (dayDiff > 0) {
                  preview.push({
                      rank: 1,
                      type: 'فرق أيام',
                      date: startBase,
                      amount: dayDiff,
                      propertyCode: propertyCode,
                  });
              }
          }

          const downPaymentValue = (contract.يوجد_دفعة_اولى && contract.قيمة_الدفعة_الاولى && contract.قيمة_الدفعة_الاولى > 0)
              ? contract.قيمة_الدفعة_الاولى
              : 0;

          const rawDownMonths = Number((contract as any).عدد_أشهر_الدفعة_الأولى || 0);
          const downMonths = Number.isFinite(rawDownMonths) ? Math.trunc(rawDownMonths) : 0;
          
          const splitDownPayment = Boolean((contract as any).تقسيط_الدفعة_الأولى);
          const rawSplitCount = Number((contract as any).عدد_أقساط_الدفعة_الأولى || 0);
          const splitCount = Number.isFinite(rawSplitCount) ? Math.trunc(rawSplitCount) : 0;

          if (splitDownPayment && downMonths > 0) {
              toast.warning('لا يمكن الجمع بين تقسيط الدفعة الأولى وعدد أشهر الدفعة الأولى');
              return;
          }

          const hasDown = Boolean(contract.يوجد_دفعة_اولى) && (downPaymentValue > 0 || downMonths > 0);
          const monthRentExact = annualValue / 12;
          const downValueUsed = hasDown
              ? (downMonths > 0 ? Math.round(monthRentExact * downMonths) : downPaymentValue)
              : 0;
          const downCoverageMonths = hasDown
              ? (downMonths > 0 ? downMonths : Math.trunc(normalizedPeriodMonths))
              : 0;

          // إضافة الدفعة الأولى إذا وجدت (في البداية) مع دعم التقسيط
          if (downValueUsed > 0) {
              if (splitDownPayment) {
                  if (splitCount < 2) {
                      toast.warning('عدد أقساط الدفعة الأولى يجب أن يكون 2 أو أكثر');
                      return;
                  }
                  if (splitCount > durationMonths) {
                      toast.warning('عدد أقساط الدفعة الأولى لا يمكن أن يتجاوز مدة العقد بالأشهر');
                      return;
                  }

                  const base = Math.floor(downValueUsed / splitCount);
                  const rem = downValueUsed - (base * splitCount);
                  for (let j = 0; j < splitCount; j++) {
                      const due = addMonthsDateOnly(startBase, j);
                      if (!due) continue;
                      preview.push({
                          rank: preview.length + 1,
                          type: 'دفعة أولى',
                          date: formatDateOnly(due),
                          amount: base + (j === splitCount - 1 ? rem : 0),
                          propertyCode: propertyCode,
                      });
                  }
              } else {
                  preview.push({
                      rank: preview.length + 1,
                      type: 'دفعة أولى',
                      date: startBase,
                      amount: downValueUsed,
                      propertyCode: propertyCode
                  });
              }
          }

          const remainingMonths = Math.max(0, durationMonths - (downValueUsed > 0 ? downCoverageMonths : 0));
          const remainingRentInstallmentsCount = remainingMonths > 0 ? Math.max(1, Math.ceil(remainingMonths / normalizedPeriodMonths)) : 0;
          const remainingRentTotal = Math.max(0, totalRent - downValueUsed);
          const baseAmount = remainingRentInstallmentsCount > 0 ? Math.floor(remainingRentTotal / remainingRentInstallmentsCount) : 0;
          const remainder = remainingRentInstallmentsCount > 0 ? (remainingRentTotal - (baseAmount * remainingRentInstallmentsCount)) : 0;

          // حساب الدفعات العادية (الإيجار فقط)
          for(let i=0; i<remainingRentInstallmentsCount; i++) {
              const baseOffset = (downValueUsed > 0 ? downCoverageMonths : 0) + Math.round(i * normalizedPeriodMonths);
              const paymentOffset = (contract.طريقة_الدفع === 'Postpaid' ? Math.round(normalizedPeriodMonths) : 0);
              const instDate = addMonthsDateOnly(startBase, baseOffset + paymentOffset);
              if (!instDate) continue;
              preview.push({
                  rank: preview.length + 1,
                  type: 'إيجار',
                  date: formatDateOnly(instDate),
                  amount: baseAmount + (i === remainingRentInstallmentsCount - 1 ? remainder : 0),
                  propertyCode: propertyCode
              });
          }
          
          // إضافة التأمين قبل نهاية العقد بيوم واحد فقط (منفصل)
          if (contract.قيمة_التأمين && contract.قيمة_التأمين > 0) {
              const securityDate = addDaysDateOnly(endBase, -1);
              if (!securityDate) {
                  toast.error('تعذر حساب تاريخ التأمين');
                  return;
              }
              
              preview.push({
                  rank: preview.length + 1,
                  type: 'تأمين',
                  date: formatDateOnly(securityDate),
                  amount: contract.قيمة_التأمين,
                  propertyCode: propertyCode
              });
          }
          
          setInstallmentsPreview(preview);
          setStep(3);
      }
  };

  const handleBack = (e: React.MouseEvent) => {
      e.preventDefault();
      setStep(s => Math.max(1, s - 1));
  };

    const handleSubmit = async (e: React.MouseEvent) => {
      e.preventDefault();

      const durationMonths = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
      const splitDownPayment = Boolean((contract as any).تقسيط_الدفعة_الأولى);
      const rawSplitCount = Number((contract as any).عدد_أقساط_الدفعة_الأولى || 0);
      const splitCount = Number.isFinite(rawSplitCount) ? Math.trunc(rawSplitCount) : 0;
      if (splitDownPayment) {
          const maxAllowed = Math.min(60, durationMonths);
          if (splitCount < 2 || splitCount > maxAllowed) {
              toast.warning(`عدد أقساط الدفعة الأولى يجب أن يكون بين 2 و ${maxAllowed}`);
              return;
          }
      }

      const payload: any = {
          ...contract,
          حقول_ديناميكية: Object.keys(dynamicValues || {}).length ? dynamicValues : undefined,
      };

      const opp = String(payload?.رقم_الفرصة ?? '').trim();
      payload.رقم_الفرصة = opp || undefined;

      const res = isEditMode
          ? DbService.updateContract(String(id), payload, Number(commOwner || 0), Number(commTenant || 0), commissionPaidMonth, { regenerateInstallments })
          : DbService.createContract(payload, Number(commOwner || 0), Number(commTenant || 0), commissionPaidMonth);

      if (!res.success) {
          toast.error(res.message);
          return;
      }

      if (isEditMode) {
          toast.success('تم تعديل العقد بنجاح');
          if (onSuccess) onSuccess();
          if (onClose) onClose();
          return;
      }

      // Create-mode notifications
      let tenantName = 'مستأجر';
      const tenantId = String(contract.رقم_المستاجر || '').trim();
      if (tenantId) {
          const isDesktopFast = typeof window !== 'undefined' && !!(window as any)?.desktopDb?.domainGet;
          if (isDesktopFast) {
              try {
                  const t: any = await domainGetSmart('people', tenantId);
                  tenantName = String(t?.الاسم || '').trim() || tenantName;
              } catch {
                  // ignore
              }
          } else {
              const tenants = DbService.getPeople();
              const tenant = tenants.find(p => p.رقم_الشخص === contract.رقم_المستاجر);
              tenantName = tenant?.الاسم || tenantName;
          }
      }

      const newContractId = (res as any).data?.رقم_العقد || 'ن/A';
      toast.success('تم إنشاء العقد بنجاح');
      notify.contractCreated(newContractId, tenantName);
      if (onSuccess) onSuccess();
      if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
            <h3 className="text-xl font-bold">{isEditMode ? 'معالج تعديل العقد' : 'معالج إنشاء عقد جديد'}</h3>
            <div className="flex gap-2">
                {[1,2,3].map(s => (
                    <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-indigo-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        {step > s ? <Check size={16}/> : s}
                    </div>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
            
            {/* Smart Assistant */}
            <SmartAssistant 
                suggestions={suggestions} 
                onAccept={applySuggestions} 
                onDismiss={() => setSuggestions([])} 
            />

            {step === 1 && (
                <div className="space-y-6 animate-fade-in">
                    <h4 className="text-lg font-bold border-b pb-2">1. اختيار الأطراف</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <PropertyPicker 
                            required 
                            value={contract.رقم_العقار} 
                            onChange={(id) => setContract(prev => ({...prev, رقم_العقار: id}))} 
                            filterStatus={isEditMode ? undefined : 'شاغر'}
                            placeholder="اختر العقار الشاغر..."
                            disabled={isEditMode}
                        />
                        <PersonPicker 
                            label="المستأجر" 
                            required 
                            value={contract.رقم_المستاجر}
                            onChange={(id) => {
                                setContract(prev => ({...prev, رقم_المستاجر: id}));
                                checkBlacklist(id, 'المستأجر');
                            }}
                            defaultRole="مستأجر"
                            initialRoleFilter="All"
                            enableUnlinkedFirst
                            unlinkedFirstByDefault
                            disabled={isEditMode}
                        />
                        <PersonPicker 
                            label="الكفيل (اختياري)" 
                            value={contract.رقم_الكفيل}
                            onChange={(id) => {
                                setContract(prev => ({...prev, رقم_الكفيل: id}));
                                checkBlacklist(id, 'الكفيل');
                            }}
                            defaultRole="كفيل"
                            initialRoleFilter="All"
                            enableUnlinkedFirst
                            unlinkedFirstByDefault
                        />

                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold mb-1">رقم الفرصة (اختياري)</label>
                            <input
                                type="text"
                                className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                dir="ltr"
                                value={String(contract.رقم_الفرصة ?? '')}
                                onChange={e => setContract(prev => ({ ...prev, رقم_الفرصة: e.target.value }))}
                                placeholder="مثال: OP-12345"
                            />
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-fade-in">
                    <h4 className="text-lg font-bold border-b pb-2">2. البيانات المالية</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">تاريخ البداية</label>
                            <DatePicker value={contract.تاريخ_البداية} onChange={d => setContract(prev => ({...prev, تاريخ_البداية: d}))} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">المدة (أشهر)</label>
                            <input 
                                type="text" 
                                inputMode="numeric"
                                min="1"
                                max="240"
                                className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                dir="ltr"
                                value={contract.مدة_العقد_بالاشهر ?? ''} 
                                onChange={e => {
                                  const raw = normalizeDigitsToLatin(e.target.value);
                                  const n = parseIntOrUndefined(raw);
                                  const clamped = n === undefined ? undefined : Math.max(1, Math.min(240, n));
                                  setContract(prev => ({ ...prev, مدة_العقد_بالاشهر: clamped as any }));
                                }} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">القيمة السنوية (د.أ)</label>
                            <input 
                                type="text" 
                                inputMode="decimal"
                                min="0"
                                className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                dir="ltr"
                                value={contract.القيمة_السنوية ?? ''} 
                                onChange={e => {
                                  const raw = normalizeDigitsToLatin(e.target.value);
                                  const n = parseNumberOrUndefined(raw);
                                  setContract(prev => ({ ...prev, القيمة_السنوية: n === undefined ? undefined : Math.max(0, n) }));
                                }} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4">
                            <div className="text-xs font-bold text-emerald-800">الإيجار الشهري (محسوب)</div>
                            <div className="text-lg font-extrabold text-emerald-700 mt-1">{formatNumber(Math.round(contractValueInfo.monthly || 0))} د.أ</div>
                            <div className="text-[11px] text-emerald-700/80 mt-1">= القيمة السنوية ÷ 12</div>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4">
                            <div className="text-xs font-bold text-indigo-800">قيمة العقد حسب المدة (محسوبة)</div>
                            <div className="text-lg font-extrabold text-indigo-700 mt-1">{formatNumber(Math.round(contractValueInfo.total || 0))} د.أ</div>
                            <div className="text-[11px] text-indigo-700/80 mt-1">= (القيمة السنوية ÷ 12) × {contractValueInfo.months} شهر</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">ملاحظة</div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                                عند كون العقد أقل من سنة (مثل 6 أشهر)، تعتمد العمولة على قيمة العقد حسب الأشهر وليس على القيمة السنوية كاملة.
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">قيمة التأمين (د.أ)</label>
                            <input 
                                type="text" 
                                inputMode="decimal"
                                min="0"
                                className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                dir="ltr"
                                value={contract.قيمة_التأمين ?? ''} 
                                onChange={e => {
                                  const raw = normalizeDigitsToLatin(e.target.value);
                                  const n = parseNumberOrUndefined(raw);
                                  setContract(prev => ({ ...prev, قيمة_التأمين: n === undefined ? undefined : Math.max(0, n) }));
                                }} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">تاريخ استحقاق التأمين (قبل الانتهاء بيوم)</label>
                            <input 
                                type="date" 
                                className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                value={
                                    contract.تاريخ_النهاية 
                                        ? (() => {
                                            const d = addDaysDateOnly(contract.تاريخ_النهاية, -1);
                                            return d ? formatDateOnly(d) : '';
                                          })()
                                        : ''
                                }
                                disabled
                            />
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                        <h5 className="font-bold mb-3 flex items-center gap-2"><Calculator size={16}/> تفاصيل الدفع</h5>
                        <div className="grid grid-cols-2 gap-6">
                        <div>
                                <label className="block text-sm font-bold mb-1">طريقة الدفع</label>
                                <select 
                                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer" 
                                    value={contract.طريقة_الدفع} 
                                    onChange={e => setContract(prev => ({...prev, طريقة_الدفع: e.target.value as PaymentMethodType}))}
                                >
                                    <option value="Prepaid">دفع مقدم (Prepaid)</option>
                                    <option value="Postpaid">دفع مؤخر (Postpaid)</option>
                                    <option value="DownPayment_Monthly">دفعة أولى + شهري</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">التكرار (عدد الدفعات)</label>
                                <select 
                                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer" 
                                    value={contract.تكرار_الدفع} 
                                    onChange={e => setContract(prev => ({...prev, تكرار_الدفع: Number(e.target.value) as any}))}
                                >
                                    <option value={12}>شهري (12 دفعة)</option>
                                    <option value={6}>كل شهرين (6 دفعات)</option>
                                    <option value={4}>كل ثلاث شهور (4 دفعات)</option>
                                    <option value={3}>كل أربعة أشهر (3 دفعات)</option>
                                    <option value={2}>نصف سنوي (دفعتين)</option>
                                    <option value={1}>سنوي (دفعة واحدة)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="mt-4 flex gap-6">
                             <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded border">
                                <input type="checkbox" checked={contract.احتساب_فرق_ايام} onChange={e => setContract(prev => ({...prev, احتساب_فرق_ايام: e.target.checked}))} />
                                <span className="text-sm font-bold">احتساب كسر الشهر ({dayDiffValue} د.أ)</span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded border">
                                <input type="checkbox" checked={contract.يوجد_دفعة_اولى} onChange={e => setContract(prev => ({...prev, يوجد_دفعة_اولى: e.target.checked}))} />
                                <span className="text-sm font-bold">يوجد دفعة أولى</span>
                             </label>
                        </div>
                        {contract.يوجد_دفعة_اولى && (
                            <div className="mt-2 space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded border">
                                    <input
                                        type="checkbox"
                                        checked={Number((contract as any).عدد_أشهر_الدفعة_الأولى || 0) > 0}
                                        onChange={e => setContract(prev => ({
                                            ...prev,
                                            عدد_أشهر_الدفعة_الأولى: e.target.checked ? 3 : undefined,
                                            قيمة_الدفعة_الاولى: e.target.checked ? undefined : prev.قيمة_الدفعة_الاولى,
                                            تقسيط_الدفعة_الأولى: e.target.checked ? false : (prev as any).تقسيط_الدفعة_الأولى,
                                            عدد_أقساط_الدفعة_الأولى: e.target.checked ? undefined : (prev as any).عدد_أقساط_الدفعة_الأولى,
                                        }))}
                                    />
                                    <span className="text-sm font-bold">الدفعة الأولى عن عدد أشهر</span>
                                </label>

                                {Number((contract as any).عدد_أشهر_الدفعة_الأولى || 0) > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            max={Math.min(60, Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12)))}
                                            placeholder="عدد الأشهر"
                                            className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={Number((contract as any).عدد_أشهر_الدفعة_الأولى || 3)}
                                            onChange={e => {
                                                const dur = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
                                                const maxAllowed = Math.min(60, dur);
                                                const n = Math.trunc(Number(e.target.value));
                                                const clamped = Number.isFinite(n) ? Math.max(1, Math.min(maxAllowed, n)) : 1;
                                                setContract(prev => ({...prev, عدد_أشهر_الدفعة_الأولى: clamped as any}));
                                            }}
                                        />
                                        <input
                                            type="number"
                                            disabled
                                            className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-white"
                                            value={Math.round((Math.max(0, Number(contract.القيمة_السنوية || 0)) / 12) * Math.max(0, Number((contract as any).عدد_أشهر_الدفعة_الأولى || 0)))}
                                        />
                                    </div>
                                ) : (
                                    <input 
                                                                                        type="text" 
                                                                                        inputMode="decimal"
                                        placeholder="قيمة الدفعة" 
                                        min="0"
                                        className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                                                                        dir="ltr"
                                                                                        value={contract.قيمة_الدفعة_الاولى ?? ''} 
                                                                                        onChange={e => {
                                                                                            const raw = normalizeDigitsToLatin(e.target.value);
                                                                                            const n = parseNumberOrUndefined(raw);
                                                                                            setContract(prev => ({ ...prev, قيمة_الدفعة_الاولى: n === undefined ? undefined : Math.max(0, n) }));
                                                                                        }} 
                                    />
                                )}

                                <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded border">
                                    <input
                                        type="checkbox"
                                        checked={Boolean((contract as any).تقسيط_الدفعة_الأولى)}
                                        disabled={Number((contract as any).عدد_أشهر_الدفعة_الأولى || 0) > 0}
                                        onChange={e => setContract(prev => ({
                                            ...prev,
                                            عدد_أشهر_الدفعة_الأولى: e.target.checked ? undefined : (prev as any).عدد_أشهر_الدفعة_الأولى,
                                            تقسيط_الدفعة_الأولى: e.target.checked,
                                            عدد_أقساط_الدفعة_الأولى: e.target.checked ? (Number((prev as any).عدد_أقساط_الدفعة_الأولى || 2) as any) : undefined,
                                        }))}
                                    />
                                    <span className="text-sm font-bold">تقسيط الدفعة الأولى</span>
                                </label>

                                {Boolean((contract as any).تقسيط_الدفعة_الأولى) && (
                                    <input
                                        type="number"
                                        min={2}
                                        max={Math.min(60, Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12)))}
                                        placeholder="عدد أقساط الدفعة الأولى"
                                        className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={Number((contract as any).عدد_أقساط_الدفعة_الأولى || 2)}
                                        onChange={e => {
                                            const dur = Math.max(1, Number(contract.مدة_العقد_بالاشهر || 12));
                                            const maxAllowed = Math.min(60, dur);
                                            const n = Math.trunc(Number(e.target.value));
                                            const clamped = Number.isFinite(n) ? Math.max(2, Math.min(maxAllowed, n)) : 2;
                                            setContract(prev => ({...prev, عدد_أقساط_الدفعة_الأولى: clamped as any}));
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    <DynamicFieldsSection formId="contracts" values={dynamicValues} onChange={setDynamicValues} />
                </div>
            )}

            {step === 3 && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100">
                        <h5 className="font-bold text-indigo-800 flex items-center gap-2"><HandCoins size={18}/> العمولات (محسوبة تلقائياً)</h5>
                        <div className="flex gap-4 mt-2 flex-wrap">
                            <div className="flex-1">
                                <label className="text-xs block mb-1">عمولة مستأجر (د.أ)</label>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    min="0"
                                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                    dir="ltr"
                                    value={commTenant} 
                                    onChange={e => {
                                      commissionTouchedRef.current = true;
                                      const raw = normalizeDigitsToLatin(e.target.value);
                                      const n = parseNumberOrUndefined(raw);
                                      setCommTenant(n === undefined ? '' : Math.max(0, n));
                                    }} 
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs block mb-1">عمولة مالك (د.أ)</label>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    min="0"
                                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                    dir="ltr"
                                    value={commOwner} 
                                    onChange={e => {
                                      commissionTouchedRef.current = true;
                                      const raw = normalizeDigitsToLatin(e.target.value);
                                      const n = parseNumberOrUndefined(raw);
                                      setCommOwner(n === undefined ? '' : Math.max(0, n));
                                    }} 
                                />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-xs block mb-1">شهر دفع العمولة</label>
                                <input
                                    type="month"
                                    className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={commissionPaidMonth}
                                    onChange={e => {
                                        commissionMonthTouchedRef.current = true;
                                        setCommissionPaidMonth(e.target.value);
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
                                    إعادة احتساب العمولة تلقائياً
                                </button>
                                <div className="text-xs text-slate-600 dark:text-slate-300">
                                    الأساس: {formatNumber(Math.round(contractValueInfo.total || 0))} د.أ ({contractValueInfo.months} شهر)
                                </div>
                            </div>
                        )}
                    </div>

                    {isEditMode && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-[240px]">
                                    <div className="font-bold text-amber-800">تحديث الدفعات</div>
                                    <div className="text-xs text-amber-700 mt-1">
                                        عند تفعيل هذا الخيار سيتم استبدال جدول الكمبيالات لهذا العقد بالجدول الجديد.
                                    </div>
                                    {hasPaidInstallments && (
                                        <div className="text-xs text-red-700 mt-2 font-bold">
                                            يوجد دفعات مدفوعة، لذلك لا يمكن إعادة توليد الدفعات.
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
                                    إعادة توليد الدفعات (آمن عند عدم وجود دفعات مدفوعة)
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 max-h-96 overflow-y-auto">
                        <h5 className="font-bold mb-4 flex items-center gap-2">📋 جدول الدفعات المتوقع</h5>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-indigo-100 dark:bg-indigo-900/30 border-b-2 border-indigo-500">
                                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">#</th>
                                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">النوع</th>
                                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">الكود الداخلي</th>
                                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">التاريخ</th>
                                    <th className="p-2 text-right font-bold text-indigo-900 dark:text-indigo-300">المبلغ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {installmentsPreview.map((i, idx) => (
                                    <tr key={idx} className={`border-b transition ${
                                        i.type === 'تأمين' ? 'bg-yellow-50 dark:bg-yellow-900/10' :
                                        i.type === 'دفعة أولى' ? 'bg-green-50 dark:bg-green-900/10' :
                                        idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-900'
                                    } hover:bg-indigo-50 dark:hover:bg-indigo-900/20`}>
                                        <td className="p-2 text-right font-bold text-gray-700 dark:text-gray-300">{i.rank}</td>
                                        <td className="p-2 text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                i.type === 'تأمين' ? 'bg-yellow-200 text-yellow-900' :
                                                i.type === 'دفعة أولى' ? 'bg-green-200 text-green-900' :
                                                'bg-indigo-200 text-indigo-900'
                                            }`}>
                                                {i.type}
                                            </span>
                                        </td>
                                        <td className="p-2 text-right text-gray-600 dark:text-gray-400 font-semibold">{i.propertyCode}</td>
                                        <td className="p-2 text-right text-gray-600 dark:text-gray-400">{i.date}</td>
                                        <td className="p-2 text-right font-bold text-gray-900 dark:text-white">{i.amount.toLocaleString()} د.أ</td>
                                    </tr>
                                ))}
                                <tr className="bg-indigo-100 dark:bg-indigo-900/30 border-t-2 border-indigo-500 font-bold">
                                    <td colSpan={4} className="p-2 text-right">الإجمالي:</td>
                                    <td className="p-2 text-right text-indigo-900 dark:text-indigo-300">{installmentsPreview.reduce((sum, i) => sum + i.amount, 0).toLocaleString()} د.أ</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>
            )}
        </div>

        <div className="p-4 border-t flex justify-between bg-gray-50 dark:bg-slate-900">
            {step === 1 ? (
                <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 transition">إلغاء</button>
            ) : (
                <button type="button" onClick={handleBack} className="px-6 py-2 rounded-lg border border-gray-300 flex items-center gap-2 font-bold hover:bg-white transition">
                    <ArrowRight size={16}/> رجوع
                </button>
            )}

            {step < 3 ? (
                <button type="button" onClick={handleNext} 
                    className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20">
                    التالي <ArrowLeft size={16}/>
                </button>
            ) : (
                <button type="button" onClick={handleSubmit} className="px-8 py-2 rounded-lg bg-green-600 text-white font-bold flex items-center gap-2 hover:bg-green-700 transition shadow-lg shadow-green-500/20">
                    <Check size={18}/> إنشاء العقد
                </button>
            )}
        </div>
    </div>
  );
};
