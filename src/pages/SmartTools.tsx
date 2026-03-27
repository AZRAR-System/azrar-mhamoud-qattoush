/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Smart Tools - helper utilities workspace
 */

import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Select } from '@/components/ui/Select';
import { DS } from '@/constants/designSystem';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { DbService } from '@/services/mockDb';
import { العقارات_tbl, الأشخاص_tbl, العقود_tbl, الكمبيالات_tbl, PaymentMethodType } from '@/types';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { useDbSignal } from '@/hooks/useDbSignal';
import { formatNumber } from '@/utils/format';
import { parseIntOrUndefined } from '@/utils/numberInput';
import { storage } from '@/services/storage';
import { PropertyPicker } from '@/components/shared/PropertyPicker';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { ContractPicker } from '@/components/shared/ContractPicker';
import { domainGetSmart } from '@/services/domainQueries';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { PaginationControls } from '@/components/shared/PaginationControls';

const computeEndDateFromStartAndMonths = (startIso: string, months: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startIso))) return '';
  const parts = startIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return '';
  const start = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(start.getTime())) return '';

  const endCandidate = new Date(start.getFullYear(), start.getMonth() + Math.max(1, months), start.getDate());
  endCandidate.setDate(endCandidate.getDate() - 1);

  const yyyy = endCandidate.getFullYear();
  const mm = String(endCandidate.getMonth() + 1).padStart(2, '0');
  const dd = String(endCandidate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const SmartTools: React.FC = () => {
  const toast = useToast();
  const dialogs = useAppDialogs();
  const { openPanel } = useSmartModal();

  const isDesktopFast = typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb?.domainGet;

  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);

  const dbSignal = useDbSignal();

  // Contract + installments calculator state
  const [propertyId, setPropertyId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [annualValue, setAnnualValue] = useState<number | ''>('');
  const [paymentsPerYear, setPaymentsPerYear] = useState<number>(12);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Prepaid');
  const [securityDeposit, setSecurityDeposit] = useState<number | ''>('');
  const [includeDayDiff, setIncludeDayDiff] = useState<boolean>(false);
  const [hasDownPayment, setHasDownPayment] = useState<boolean>(false);
  const [downPaymentValue, setDownPaymentValue] = useState<number | ''>('');
  const [downPaymentMonths, setDownPaymentMonths] = useState<number>(0);
  const [splitDownPayment, setSplitDownPayment] = useState<boolean>(false);
  const [downPaymentSplitCount, setDownPaymentSplitCount] = useState<number>(2);
  const [previewInstallments, setPreviewInstallments] = useState<الكمبيالات_tbl[]>([]);
  const [previewPage, setPreviewPage] = useState(1);

  useEffect(() => {
    if (!hasDownPayment || !splitDownPayment) return;
    const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
    setDownPaymentSplitCount(prev => Math.max(2, Math.min(maxAllowed, Math.trunc(Number(prev) || 2))));
  }, [hasDownPayment, splitDownPayment, durationMonths]);

  useEffect(() => {
    if (!hasDownPayment) return;
    const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
    setDownPaymentMonths(prev => Math.max(0, Math.min(maxAllowed, Math.trunc(Number(prev) || 0))));
  }, [hasDownPayment, durationMonths]);

  // Commission calculator state
  const [commissionContractId, setCommissionContractId] = useState('');
  const [commissionContractObj, setCommissionContractObj] = useState<العقود_tbl | null>(null);
  const [commOwner, setCommOwner] = useState<number | ''>('');
  const [commTenant, setCommTenant] = useState<number | ''>('');
  const [commissionPaidMonth, setCommissionPaidMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  const selectedCommissionContract = useMemo(() => {
    if (!commissionContractId) return null;
    if (isDesktopFast) return commissionContractObj;
    return contracts.find(c => String(c.رقم_العقد) === String(commissionContractId)) || null;
  }, [contracts, commissionContractId, commissionContractObj, isDesktopFast]);

  const selectedCommissionBase = useMemo(() => {
    if (!selectedCommissionContract) return { monthly: 0, total: 0, months: 0 };
    const annual = Math.max(0, Number(selectedCommissionContract.القيمة_السنوية || 0));
    const months = Math.max(1, Number(selectedCommissionContract.مدة_العقد_بالاشهر || 12));
    const monthly = annual / 12;
    const total = Math.round((annual * months) / 12);
    return { monthly, total, months };
  }, [selectedCommissionContract]);

  useEffect(() => {
    if (!commissionContractId) {
      setCommOwner('');
      setCommTenant('');
      return;
    }

    if (isDesktopFast && !selectedCommissionContract) {
      // Avoid any legacy fallbacks inside Desktop; compute will resume once contract is resolved.
      return;
    }

    // If there is already a stored commission, prefer it.
    const existing = DbService.getCommissions?.().find(x => String(x.رقم_العقد) === String(commissionContractId));
    if (existing) {
      setCommOwner(Math.max(0, Number(existing.عمولة_المالك || 0)));
      setCommTenant(Math.max(0, Number(existing.عمولة_المستأجر || 0)));
      const m = String(existing.شهر_دفع_العمولة || '');
      if (/^\d{4}-\d{2}$/.test(m)) setCommissionPaidMonth(m);
      else if (selectedCommissionContract?.تاريخ_البداية) setCommissionPaidMonth(String(selectedCommissionContract.تاريخ_البداية).slice(0, 7));
      return;
    }

    // Otherwise calculate from settings using the contract's value-by-months.
    const settings = DbService.getSettings();
    const ownerPct = settings.rentalCommissionOwnerPercent || 0;
    const tenantPct = settings.rentalCommissionTenantPercent || 0;
    setCommOwner(Math.round(selectedCommissionBase.total * (ownerPct / 100)));
    setCommTenant(Math.round(selectedCommissionBase.total * (tenantPct / 100)));

    if (selectedCommissionContract?.تاريخ_البداية) {
      const mm = String(selectedCommissionContract.تاريخ_البداية).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(mm)) setCommissionPaidMonth(mm);
    }
  }, [commissionContractId, selectedCommissionContract, selectedCommissionBase.total, isDesktopFast]);

  useEffect(() => {
    // Desktop focus: do not load full arrays into renderer.
    if (isDesktopFast) {
      setProperties([]);
      setPeople([]);
      setContracts([]);
      return;
    }
    setProperties(DbService.getProperties());
    setPeople(DbService.getPeople());
    setContracts(DbService.getContracts());
  }, [dbSignal, isDesktopFast]);

  // Desktop: resolve the selected commission contract via SQL.
  useEffect(() => {
    if (!isDesktopFast) return;
    let alive = true;
    const run = async () => {
      if (!commissionContractId) {
        if (alive) setCommissionContractObj(null);
        return;
      }
      const c = await domainGetSmart('contracts', commissionContractId);
      if (!alive) return;
      setCommissionContractObj(c || null);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [commissionContractId, isDesktopFast]);

  const propertiesOptions = useMemo(
    () => properties.map(p => ({ value: p.رقم_العقار, label: p.الكود_الداخلي })),
    [properties]
  );
  const peopleOptions = useMemo(
    () => people.map(p => ({ value: p.رقم_الشخص, label: `${p.الاسم}${p.رقم_الهاتف ? ` — ${p.رقم_الهاتف}` : ''}` })),
    [people]
  );
  const contractsOptions = useMemo(
    () => contracts.map(c => ({ value: c.رقم_العقد, label: `#${formatContractNumberShort(c.رقم_العقد)} — ${c.رقم_العقار}` })),
    [contracts]
  );

  const endDate = useMemo(() => computeEndDateFromStartAndMonths(startDate, durationMonths), [startDate, durationMonths]);

  const previewTotals = useMemo(() => {
    const annualN = Math.max(0, Number(annualValue || 0));
    const rentTotalExpected = Math.round((annualN * Math.max(1, durationMonths)) / 12);
    const down = previewInstallments.filter(i => i.نوع_الكمبيالة === 'دفعة أولى').reduce((s, i) => s + (Number(i.القيمة) || 0), 0);
    const rent = previewInstallments.filter(i => i.نوع_الكمبيالة === 'إيجار').reduce((s, i) => s + (Number(i.القيمة) || 0), 0);
    const dayDiff = previewInstallments.filter(i => i.نوع_الكمبيالة === 'فرق أيام').reduce((s, i) => s + (Number(i.القيمة) || 0), 0);
    const deposit = previewInstallments.filter(i => i.نوع_الكمبيالة === 'تأمين').reduce((s, i) => s + (Number(i.القيمة) || 0), 0);
    const totalAll = previewInstallments.reduce((s, i) => s + (Number(i.القيمة) || 0), 0);
    const rentTotalActual = rent + down;
    const rentDelta = rentTotalActual - rentTotalExpected;
    return {
      rentTotalExpected,
      rentTotalActual,
      rentDelta,
      down,
      rent,
      dayDiff,
      deposit,
      totalAll,
    };
  }, [annualValue, durationMonths, previewInstallments]);

  const previewPageSize = 12;
  const previewPageCount = Math.max(1, Math.ceil(previewInstallments.length / previewPageSize));

  useEffect(() => {
    setPreviewPage(1);
  }, [previewInstallments.length]);

  useEffect(() => {
    setPreviewPage((p) => Math.min(Math.max(1, p), previewPageCount));
  }, [previewPageCount]);

  const visiblePreviewInstallments = useMemo(
    () => previewInstallments.slice((previewPage - 1) * previewPageSize, previewPage * previewPageSize),
    [previewInstallments, previewPage]
  );

  const handleGeneratePreview = () => {
    if (!startDate || !endDate) {
      toast.error('يرجى تحديد تاريخ بداية صالح ومدة العقد');
      return;
    }
    if (durationMonths <= 0) {
      toast.error('مدة العقد يجب أن تكون أكبر من صفر');
      return;
    }
    if (paymentsPerYear <= 0) {
      toast.error('التكرار غير صالح');
      return;
    }

    if (hasDownPayment && splitDownPayment && downPaymentMonths > 0) {
      toast.error('لا يمكن الجمع بين تقسيط الدفعة الأولى وعدد أشهر الدفعة الأولى');
      return;
    }

    if (hasDownPayment && splitDownPayment) {
      const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
      const n = Math.trunc(Number(downPaymentSplitCount || 0));
      if (!Number.isFinite(n) || n < 2 || n > maxAllowed) {
        toast.error(`عدد أقساط الدفعة الأولى يجب أن يكون بين 2 و ${maxAllowed}`);
        return;
      }
    }

    if (hasDownPayment && downPaymentMonths > 0) {
      const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
      const n = Math.trunc(Number(downPaymentMonths || 0));
      if (!Number.isFinite(n) || n < 1 || n > maxAllowed) {
        toast.error(`عدد أشهر الدفعة الأولى يجب أن يكون بين 1 و ${maxAllowed}`);
        return;
      }
    }

    const draft: Partial<العقود_tbl> = {
      تاريخ_البداية: startDate,
      تاريخ_النهاية: endDate,
      مدة_العقد_بالاشهر: durationMonths,
      القيمة_السنوية: Number(annualValue || 0),
      تكرار_الدفع: paymentsPerYear,
      طريقة_الدفع: paymentMethod,
      قيمة_التأمين: Number(securityDeposit || 0),
      احتساب_فرق_ايام: includeDayDiff,
      يوجد_دفعة_اولى: hasDownPayment,
      قيمة_الدفعة_الاولى: hasDownPayment ? Number(downPaymentValue || 0) : 0,
      عدد_أشهر_الدفعة_الأولى: (hasDownPayment && downPaymentMonths > 0) ? downPaymentMonths : undefined,
      تقسيط_الدفعة_الأولى: hasDownPayment ? splitDownPayment : false,
      عدد_أقساط_الدفعة_الأولى: (hasDownPayment && splitDownPayment) ? downPaymentSplitCount : undefined,
    };

    const res = DbService.previewContractInstallments(draft);

    if (!res.success || !res.data) {
      toast.error(res.message || 'تعذر توليد الدفعات');
      return;
    }

    const list = [...res.data.installments].sort((a, b) => (a.ترتيب_الكمبيالة || 0) - (b.ترتيب_الكمبيالة || 0));
    setPreviewInstallments(list);
    toast.success('تم توليد معاينة الدفعات');
  };

  const handleApproveContract = async () => {
    if (!propertyId || !tenantId) {
      toast.error('يرجى اختيار العقار والمستأجر');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('تواريخ العقد غير صالحة');
      return;
    }
    if (previewInstallments.length === 0) {
      toast.error('قم بتوليد معاينة الدفعات أولاً');
      return;
    }
    if (previewTotals.rentDelta !== 0) {
      toast.error('لا يمكن الاعتماد: مجموع دفعات الإيجار لا يطابق إجمالي الإيجار');
      return;
    }

    if (hasDownPayment && splitDownPayment && downPaymentMonths > 0) {
      toast.error('لا يمكن الجمع بين تقسيط الدفعة الأولى وعدد أشهر الدفعة الأولى');
      return;
    }

    if (hasDownPayment && splitDownPayment) {
      const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
      const n = Math.trunc(Number(downPaymentSplitCount || 0));
      if (!Number.isFinite(n) || n < 2 || n > maxAllowed) {
        toast.error(`عدد أقساط الدفعة الأولى يجب أن يكون بين 2 و ${maxAllowed}`);
        return;
      }
    }

    if (hasDownPayment && downPaymentMonths > 0) {
      const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
      const n = Math.trunc(Number(downPaymentMonths || 0));
      if (!Number.isFinite(n) || n < 1 || n > maxAllowed) {
        toast.error(`عدد أشهر الدفعة الأولى يجب أن يكون بين 1 و ${maxAllowed}`);
        return;
      }
    }

    const prop = properties.find(p => p.رقم_العقار === propertyId);
    const tenant = people.find(p => p.رقم_الشخص === tenantId);

    const ok = await dialogs.confirm({
      title: 'اعتماد العقد',
      message: `سيتم إنشاء عقد جديد للعقار (${prop?.الكود_الداخلي || propertyId}) للمستأجر (${tenant?.الاسم || tenantId}) مع إنشاء جدول الدفعات. هل تريد المتابعة؟`,
      confirmText: 'اعتماد',
      cancelText: 'إلغاء',
      isDangerous: false,
    });
    if (!ok) return;

    const draft: Partial<العقود_tbl> = {
        رقم_العقار: propertyId,
        رقم_المستاجر: tenantId,
        تاريخ_البداية: startDate,
        تاريخ_النهاية: endDate,
        مدة_العقد_بالاشهر: durationMonths,
        القيمة_السنوية: Number(annualValue || 0),
        تكرار_الدفع: paymentsPerYear,
        طريقة_الدفع: paymentMethod,
        قيمة_التأمين: Number(securityDeposit || 0),
        احتساب_فرق_ايام: includeDayDiff,
        يوجد_دفعة_اولى: hasDownPayment,
        قيمة_الدفعة_الاولى: hasDownPayment ? Number(downPaymentValue || 0) : 0,
        عدد_أشهر_الدفعة_الأولى: (hasDownPayment && downPaymentMonths > 0) ? downPaymentMonths : undefined,
        تقسيط_الدفعة_الأولى: hasDownPayment ? splitDownPayment : false,
        عدد_أقساط_الدفعة_الأولى: (hasDownPayment && splitDownPayment) ? downPaymentSplitCount : undefined,
      };

    const res = DbService.createContract(
      draft,
      0,
      0,
      /^\d{4}-\d{2}-\d{2}$/.test(String(startDate)) ? String(startDate).slice(0, 7) : undefined
    );

    if (!res.success || !res.data) {
      toast.error(res.message || 'فشل إنشاء العقد');
      return;
    }

    toast.success('تم اعتماد العقد وإنشاء الدفعات');
    setContracts(DbService.getContracts());
    openPanel('CONTRACT_DETAILS', res.data.رقم_العقد);
  };

  const commissionTotal = useMemo(() => Math.max(0, Number(commOwner || 0)) + Math.max(0, Number(commTenant || 0)), [commOwner, commTenant]);

  const handleApproveCommission = async () => {
    if (!commissionContractId) {
      toast.error('يرجى اختيار عقد');
      return;
    }
    const ok = await dialogs.confirm({
      title: 'اعتماد العمولة',
      message: `سيتم حفظ العمولة لهذا العقد. المجموع: ${formatNumber(commissionTotal)} د.أ. هل تريد المتابعة؟`,
      confirmText: 'اعتماد',
      cancelText: 'إلغاء',
      isDangerous: false,
    });
    if (!ok) return;

    const res = DbService.upsertCommissionForContract(commissionContractId, {
      commOwner: Math.max(0, Number(commOwner || 0)),
      commTenant: Math.max(0, Number(commTenant || 0)),
      commissionPaidMonth,
    });

    if (!res.success || !res.data) {
      toast.error(res.message || 'فشل حفظ العمولة');
      return;
    }

    toast.success('تم حفظ العمولة بنجاح');
    openPanel('CONTRACT_DETAILS', commissionContractId);
  };

  return (
    <div className="space-y-6">
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={DS.components.pageTitle}>أدوات ذكية</h2>
          <p className={DS.components.pageSubtitle}>
            أدوات مساعدة للعمل. لا يتم حفظ أي نتيجة داخل النظام إلا بعد الضغط على "اعتماد".
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">حاسبة العقد والدفعات</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              توليد معاينة جدول الدفعات، ثم اعتماد العقد لإنشائه فعلياً.
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">العقار</div>
            {isDesktopFast ? (
              <PropertyPicker label={undefined} value={String(propertyId || '')} onChange={(id) => setPropertyId(String(id || ''))} placeholder="اختر العقار" />
            ) : (
              <Select options={propertiesOptions} placeholder="اختر العقار" value={propertyId} onChange={e => setPropertyId(e.target.value)} />
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">المستأجر</div>
            {isDesktopFast ? (
              <PersonPicker label={undefined} value={String(tenantId || '')} onChange={(id) => setTenantId(String(id || ''))} placeholder="اختر المستأجر" defaultRole="مستأجر" />
            ) : (
              <Select options={peopleOptions} placeholder="اختر المستأجر" value={tenantId} onChange={e => setTenantId(e.target.value)} />
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">تاريخ البداية</div>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مدة العقد (بالأشهر)</div>
            <Input
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={durationMonths}
              onChange={e => {
                const n = parseIntOrUndefined(e.target.value);
                setDurationMonths(n === undefined ? 0 : Math.max(1, n));
              }}
            />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">تاريخ النهاية (محسوب)</div>
            <Input type="date" value={endDate} disabled />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">القيمة السنوية (د.أ)</div>
            <MoneyInput
              dir="ltr"
              min={0}
              value={typeof annualValue === 'number' ? annualValue : undefined}
              onValueChange={(v) => setAnnualValue(v === undefined ? '' : Math.max(0, v))}
            />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">التكرار</div>
            <Select
              options={[
                { value: '12', label: 'كل شهر (12)' },
                { value: '6', label: 'كل شهرين (6)' },
                { value: '4', label: 'كل ثلاث شهور (4)' },
                { value: '3', label: 'كل أربع شهور (3)' },
                { value: '2', label: 'نصف سنوي (2)' },
                { value: '1', label: 'سنوي (1)' },
              ]}
              value={String(paymentsPerYear)}
              onChange={e => setPaymentsPerYear(Number(e.target.value))}
            />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">طريقة الدفع</div>
            <Select
              options={[
                { value: 'Prepaid', label: 'دفع مقدم' },
                { value: 'Postpaid', label: 'دفع مؤخر' },
                { value: 'DownPayment_Monthly', label: 'دفعة أولى + شهري' },
              ]}
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethodType)}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">قيمة التأمين (د.أ)</div>
            <MoneyInput
              dir="ltr"
              min={0}
              value={typeof securityDeposit === 'number' ? securityDeposit : undefined}
              onValueChange={(v) => setSecurityDeposit(v === undefined ? '' : Math.max(0, v))}
            />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="st_daydiff" type="checkbox" checked={includeDayDiff} onChange={e => setIncludeDayDiff(e.target.checked)} />
            <label htmlFor="st_daydiff" className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">احتساب فرق أيام</label>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="st_down" type="checkbox" checked={hasDownPayment} onChange={e => setHasDownPayment(e.target.checked)} />
            <label htmlFor="st_down" className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">يوجد دفعة أولى</label>
          </div>
        </div>

        {hasDownPayment && (
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">قيمة الدفعة الأولى</div>
            {downPaymentMonths > 0 ? (
              <Input type="text" disabled value={formatNumber(Math.round((Math.max(0, Number(annualValue || 0)) / 12) * Math.max(0, downPaymentMonths)))} />
            ) : (
              <MoneyInput
                dir="ltr"
                min={0}
                value={typeof downPaymentValue === 'number' ? downPaymentValue : undefined}
                onValueChange={(v) => setDownPaymentValue(v === undefined ? '' : Math.max(0, v))}
              />
            )}

            <div className="mt-3 flex items-center gap-2">
              <input
                id="st_down_months"
                type="checkbox"
                checked={downPaymentMonths > 0}
                onChange={e => {
                  const on = e.target.checked;
                  setDownPaymentMonths(on ? 3 : 0);
                  if (on) {
                    setSplitDownPayment(false);
                    setDownPaymentValue(0);
                  }
                }}
              />
              <label htmlFor="st_down_months" className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">الدفعة الأولى عن عدد أشهر</label>
            </div>

            {downPaymentMonths > 0 && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عدد الأشهر</div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    min={1}
                    max={Math.min(60, Math.max(1, Number(durationMonths || 12)))}
                    value={downPaymentMonths}
                    onChange={e => {
                      const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
                      const n = parseIntOrUndefined(e.target.value);
                      const clamped = Number.isFinite(n) ? Math.max(1, Math.min(maxAllowed, n)) : 1;
                      setDownPaymentMonths(clamped);
                    }}
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">قيمة محسوبة (تقريباً)</div>
                  <Input type="text" disabled value={formatNumber(Math.round((Math.max(0, Number(annualValue || 0)) / 12) * Math.max(0, downPaymentMonths)))} />
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <input
                id="st_down_split"
                type="checkbox"
                checked={splitDownPayment}
                disabled={downPaymentMonths > 0}
                onChange={e => {
                  const on = e.target.checked;
                  setSplitDownPayment(on);
                  if (on) setDownPaymentMonths(0);
                }}
              />
              <label htmlFor="st_down_split" className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">تقسيط الدفعة الأولى</label>
            </div>

            {splitDownPayment && (
              <div className="mt-2">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عدد أقساط الدفعة الأولى</div>
                <Input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  min={2}
                  max={Math.min(60, Math.max(1, Number(durationMonths || 12)))}
                  value={downPaymentSplitCount}
                  onChange={e => {
                    const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
                    const n = parseIntOrUndefined(e.target.value);
                    const clamped = Number.isFinite(n) ? Math.max(2, Math.min(maxAllowed, n)) : 2;
                    setDownPaymentSplitCount(clamped);
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleGeneratePreview}>توليد الدفعات (معاينة)</Button>
          <Button variant="primary" onClick={handleApproveContract}>اعتماد العقد</Button>
        </div>

        {previewInstallments.length > 0 && (
          <div className="mt-8 space-y-6">
            <div className={`p-5 rounded-[2rem] border transition-all duration-500 ${previewTotals.rentDelta === 0 ? 'bg-emerald-50/30 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30 shadow-lg shadow-emerald-500/5' : 'bg-rose-50/30 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30 shadow-lg shadow-rose-500/5'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${previewTotals.rentDelta === 0 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'}`}>
                  {previewTotals.rentDelta === 0 ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div>
                  <div className="text-lg font-black text-slate-800 dark:text-white">تحقق الحساب</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                    الإيجار المتوقع: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{formatNumber(previewTotals.rentTotalExpected)}</span> د.أ — 
                    الفعلي: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{formatNumber(previewTotals.rentTotalActual)}</span> د.أ
                  </div>
                  {previewTotals.rentDelta !== 0 && (
                    <div className="text-xs font-black text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle size={12} />
                      فرق الحساب: {formatNumber(previewTotals.rentDelta)} د.أ (يجب أن يكون 0 قبل الاعتماد)
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="app-table-wrapper">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">معاينة جدول الدفعات ({previewInstallments.length})</div>
                <PaginationControls page={previewPage} pageCount={previewPageCount} onPageChange={setPreviewPage} />
              </div>
              <div className="max-h-[500px] overflow-auto no-scrollbar">
                <table className="app-table">
                  <thead className="app-table-thead">
                    <tr>
                      <th className="app-table-th w-16 text-center">#</th>
                      <th className="app-table-th">النوع</th>
                      <th className="app-table-th">تاريخ الاستحقاق</th>
                      <th className="app-table-th text-center">المبلغ</th>
                      <th className="app-table-th text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                    {visiblePreviewInstallments.map((i, idx) => (
                      <tr key={i.رقم_الكمبيالة || idx} className="app-table-row app-table-row-striped group">
                        <td className="app-table-td text-center font-black text-slate-400 group-hover:text-indigo-500 transition-colors">
                          {i.ترتيب_الكمبيالة ?? (previewPage - 1) * previewPageSize + idx + 1}
                        </td>
                        <td className="app-table-td">
                          <span className={`px-3 py-1 rounded-xl text-[10px] font-black border transition-colors ${
                            i.نوع_الكمبيالة === 'إيجار' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-100 dark:border-indigo-800/50' :
                            i.نوع_الكمبيالة === 'دفعة أولى' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-100 dark:border-emerald-800/50' :
                            'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700'
                          }`}>
                            {i.نوع_الكمبيالة}
                          </span>
                        </td>
                        <td className="app-table-td font-mono text-xs font-bold text-slate-500">
                          {i.تاريخ_استحقاق}
                        </td>
                        <td className="app-table-td text-center">
                          <span className="text-sm font-black text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 group-hover:border-indigo-200 transition-colors">
                            {formatNumber(Number(i.القيمة || 0))} د.أ
                          </span>
                        </td>
                        <td className="app-table-td">
                          <div className="flex justify-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              {i.حالة_الكمبيالة}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="text-lg font-bold text-slate-800 dark:text-white">حاسبة العمولة</div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          يتم حفظ العمولة فقط بعد الضغط على "اعتماد".
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">العقد</div>
            {isDesktopFast ? (
              <ContractPicker
                label={undefined}
                value={String(commissionContractId || '')}
                onChange={(id, obj) => {
                  setCommissionContractId(String(id || ''));
                  setCommissionContractObj(obj || null);
                }}
                placeholder="اختر العقد"
              />
            ) : (
              <Select options={contractsOptions} placeholder="اختر العقد" value={commissionContractId} onChange={e => setCommissionContractId(e.target.value)} />
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">شهر دفع العمولة</div>
            <Input type="month" value={commissionPaidMonth} onChange={e => setCommissionPaidMonth(e.target.value)} />
          </div>
        </div>

        {commissionContractId && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4">
              <div className="text-xs font-bold text-emerald-800">الإيجار الشهري (محسوب)</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">{formatNumber(Math.round(selectedCommissionBase.monthly || 0))} د.أ</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4">
              <div className="text-xs font-bold text-indigo-800">قيمة العقد حسب المدة (محسوب)</div>
              <div className="text-lg font-extrabold text-indigo-700 mt-1">{formatNumber(Math.round(selectedCommissionBase.total || 0))} د.أ</div>
              <div className="text-[11px] text-indigo-700/80 mt-1">للـ {selectedCommissionBase.months} شهر</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">أساس العمولة</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">تُحتسب العمولة على قيمة العقد حسب الأشهر، وليس على القيمة السنوية كاملة.</div>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عمولة المالك (د.أ)</div>
            <MoneyInput
              dir="ltr"
              min={0}
              value={typeof commOwner === 'number' ? commOwner : undefined}
              onValueChange={(v) => setCommOwner(v === undefined ? '' : Math.max(0, v))}
            />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عمولة المستأجر (د.أ)</div>
            <MoneyInput
              dir="ltr"
              min={0}
              value={typeof commTenant === 'number' ? commTenant : undefined}
              onValueChange={(v) => setCommTenant(v === undefined ? '' : Math.max(0, v))}
            />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">المجموع</div>
            <Input type="text" value={`${formatNumber(commissionTotal)} د.أ`} disabled />
          </div>
        </div>

        <div className="mt-5">
          <Button variant="primary" onClick={handleApproveCommission}>اعتماد العمولة</Button>
        </div>
      </Card>
    </div>
  );
};
