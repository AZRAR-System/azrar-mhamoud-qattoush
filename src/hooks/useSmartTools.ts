import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { DbService } from '@/services/mockDb';
import { العقارات_tbl, الأشخاص_tbl, العقود_tbl, الكمبيالات_tbl, PaymentMethodType } from '@/types';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { useDbSignal } from '@/hooks/useDbSignal';
import { formatNumber } from '@/utils/format';
import { storage } from '@/services/storage';
import { domainGetSmart } from '@/services/domainQueries';

const computeEndDateFromStartAndMonths = (startIso: string, months: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startIso))) return '';
  const parts = startIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return '';
  const start = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(start.getTime())) return '';

  const endCandidate = new Date(
    start.getFullYear(),
    start.getMonth() + Math.max(1, months),
    start.getDate()
  );
  endCandidate.setDate(endCandidate.getDate() - 1);

  const yyyy = endCandidate.getFullYear();
  const mm = String(endCandidate.getMonth() + 1).padStart(2, '0');
  const dd = String(endCandidate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const useSmartTools = (isVisible: boolean) => {
  const toast = useToast();
  const dialogs = useAppDialogs();
  const { openPanel } = useSmartModal();

  const isDesktopFast =
    typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb?.domainGet;

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

  // Commission calculator state
  const [commissionContractId, setCommissionContractId] = useState('');
  const [commissionContractObj, setCommissionContractObj] = useState<العقود_tbl | null>(null);
  const [commOwner, setCommOwner] = useState<number | ''>('');
  const [commTenant, setCommTenant] = useState<number | ''>('');
  const [commissionPaidMonth, setCommissionPaidMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    if (!hasDownPayment || !splitDownPayment) return;
    const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
    setDownPaymentSplitCount((prev) =>
      Math.max(2, Math.min(maxAllowed, Math.trunc(Number(prev) || 2)))
    );
  }, [hasDownPayment, splitDownPayment, durationMonths]);

  useEffect(() => {
    if (!hasDownPayment) return;
    const maxAllowed = Math.min(60, Math.max(1, Number(durationMonths || 12)));
    setDownPaymentMonths((prev) =>
      Math.max(0, Math.min(maxAllowed, Math.trunc(Number(prev) || 0)))
    );
  }, [hasDownPayment, durationMonths]);

  const selectedCommissionContract = useMemo(() => {
    if (!commissionContractId) return null;
    if (isDesktopFast) return commissionContractObj;
    return contracts.find((c) => String(c.رقم_العقد) === String(commissionContractId)) || null;
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
      return;
    }

    const existing = DbService.getCommissions?.().find(
      (x) => String(x.رقم_العقد) === String(commissionContractId)
    );
    if (existing) {
      setCommOwner(Math.max(0, Number(existing.عمولة_المالك || 0)));
      setCommTenant(Math.max(0, Number(existing.عمولة_المستأجر || 0)));
      const m = String(existing.شهر_دفع_العمولة || '');
      if (/^\d{4}-\d{2}$/.test(m)) setCommissionPaidMonth(m);
      else if (selectedCommissionContract?.تاريخ_البداية)
        setCommissionPaidMonth(String(selectedCommissionContract.تاريخ_البداية).slice(0, 7));
      return;
    }

    const settings = DbService.getSettings();
    const ownerPct = settings.rentalCommissionOwnerPercent || 0;
    const tenantPct = settings.rentalCommissionTenantPercent || 0;
    setCommOwner(Math.round(selectedCommissionBase.total * (ownerPct / 100)));
    setCommTenant(Math.round(selectedCommissionBase.total * (tenantPct / 100)));

    if (selectedCommissionContract?.تاريخ_البداية) {
      const mm = String(selectedCommissionContract.تاريخ_البداية).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(mm)) setCommissionPaidMonth(mm);
    }
  }, [
    commissionContractId,
    selectedCommissionContract,
    selectedCommissionBase.total,
    isDesktopFast,
  ]);

  useEffect(() => {
    if (!isVisible) return;
    if (isDesktopFast) {
      setProperties([]);
      setPeople([]);
      setContracts([]);
      return;
    }
    setProperties(DbService.getProperties());
    setPeople(DbService.getPeople());
    setContracts(DbService.getContracts());
  }, [dbSignal, isDesktopFast, isVisible]);

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
    () => properties.map((p) => ({ value: p.رقم_العقار, label: p.الكود_الداخلي })),
    [properties]
  );
  const peopleOptions = useMemo(
    () =>
      people.map((p) => ({
        value: p.رقم_الشخص,
        label: `${p.الاسم}${p.رقم_الهاتف ? ` — ${p.رقم_الهاتف}` : ''}`,
      })),
    [people]
  );
  const contractsOptions = useMemo(
    () =>
      contracts.map((c) => {
        const prop = properties.find((p) => String(p.رقم_العقار) === String(c.رقم_العقار));
        const code = String(prop?.الكود_الداخلي || c.رقم_العقار || '').trim();
        return {
          value: c.رقم_العقد,
          label: `#${formatContractNumberShort(c.رقم_العقد)} — ${code}`,
        };
      }),
    [contracts, properties]
  );

  const endDate = useMemo(
    () => computeEndDateFromStartAndMonths(startDate, durationMonths),
    [startDate, durationMonths]
  );

  const previewTotals = useMemo(() => {
    const annualN = Math.max(0, Number(annualValue || 0));
    const rentTotalExpected = Math.round((annualN * Math.max(1, durationMonths)) / 12);
    const down = previewInstallments
      .filter((i) => i.نوع_الكمبيالة === 'دفعة أولى')
      .reduce((s, i) => s + (Number(i.القيمة) || 0), 0);
    const rent = previewInstallments
      .filter((i) => i.نوع_الكمبيالة === 'إيجار')
      .reduce((s, i) => s + (Number(i.القيمة) || 0), 0);
    const dayDiff = previewInstallments
      .filter((i) => i.نوع_الكمبيالة === 'فرق أيام')
      .reduce((s, i) => s + (Number(i.القيمة) || 0), 0);
    const deposit = previewInstallments
      .filter((i) => i.نوع_الكمبيالة === 'تأمين')
      .reduce((s, i) => s + (Number(i.القيمة) || 0), 0);
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
    () =>
      previewInstallments.slice((previewPage - 1) * previewPageSize, previewPage * previewPageSize),
    [previewInstallments, previewPage]
  );

  const handleGeneratePreview = useCallback(() => {
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
      عدد_أشهر_الدفعة_الأولى:
        hasDownPayment && downPaymentMonths > 0 ? downPaymentMonths : undefined,
      تقسيط_الدفعة_الأولى: hasDownPayment ? splitDownPayment : false,
      عدد_أقساط_الدفعة_الأولى:
        hasDownPayment && splitDownPayment ? downPaymentSplitCount : undefined,
    };

    const res = DbService.previewContractInstallments(draft as العقود_tbl, 'preview');

    if (!res.success || !res.data) {
      toast.error(res.message || 'تعذر توليد الدفعات');
      return;
    }

    const list = [...res.data].sort(
      (a, b) => (a.ترتيب_الكمبيالة || 0) - (b.ترتيب_الكمبيالة || 0)
    );
    setPreviewInstallments(list);
    toast.success('تم توليد معاينة الدفعات');
  }, [
    startDate,
    endDate,
    durationMonths,
    paymentsPerYear,
    hasDownPayment,
    splitDownPayment,
    downPaymentMonths,
    downPaymentSplitCount,
    downPaymentValue,
    annualValue,
    paymentMethod,
    securityDeposit,
    includeDayDiff,
    toast,
  ]);

  const handleApproveContract = useCallback(async () => {
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

    // على Desktop Fast ، properties وpeople مصفوفتان فارغتان
    // الرسالة تعرض المعرّف (ID) بدل الاسم — acceptable graceful degradation
    const prop = properties.find((p) => p.رقم_العقار === propertyId);
    const tenant = people.find((p) => p.رقم_الشخص === tenantId);

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
      عدد_أشهر_الدفعة_الأولى:
        hasDownPayment && downPaymentMonths > 0 ? downPaymentMonths : undefined,
      تقسيط_الدفعة_الأولى: hasDownPayment ? splitDownPayment : false,
      عدد_أقساط_الدفعة_الأولى:
        hasDownPayment && splitDownPayment ? downPaymentSplitCount : undefined,
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
    if (!isDesktopFast) setContracts(DbService.getContracts());
    openPanel('CONTRACT_DETAILS', res.data.رقم_العقد);
  }, [
    propertyId,
    tenantId,
    startDate,
    endDate,
    previewInstallments.length,
    previewTotals.rentDelta,
    hasDownPayment,
    splitDownPayment,
    downPaymentMonths,
    durationMonths,
    downPaymentValue,
    downPaymentSplitCount,
    properties,
    people,
    annualValue,
    paymentsPerYear,
    paymentMethod,
    securityDeposit,
    includeDayDiff,
    isDesktopFast,
    dialogs,
    toast,
    openPanel,
  ]);

  const commissionTotal = useMemo(
    () => Math.max(0, Number(commOwner || 0)) + Math.max(0, Number(commTenant || 0)),
    [commOwner, commTenant]
  );

  const handleApproveCommission = useCallback(async () => {
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
  }, [commissionContractId, commissionTotal, commissionPaidMonth, dialogs, toast, openPanel, commOwner, commTenant]);

  return {
    isDesktopFast,
    properties,
    people,
    contracts,
    propertyId,
    setPropertyId,
    tenantId,
    setTenantId,
    startDate,
    setStartDate,
    durationMonths,
    setDurationMonths,
    annualValue,
    setAnnualValue,
    paymentsPerYear,
    setPaymentsPerYear,
    paymentMethod,
    setPaymentMethod,
    securityDeposit,
    setSecurityDeposit,
    includeDayDiff,
    setIncludeDayDiff,
    hasDownPayment,
    setHasDownPayment,
    downPaymentValue,
    setDownPaymentValue,
    downPaymentMonths,
    setDownPaymentMonths,
    splitDownPayment,
    setSplitDownPayment,
    downPaymentSplitCount,
    setDownPaymentSplitCount,
    previewInstallments,
    setPreviewInstallments,
    previewPage,
    setPreviewPage,
    commissionContractId,
    setCommissionContractId,
    commissionContractObj,
    setCommissionContractObj,
    commOwner,
    setCommOwner,
    commTenant,
    setCommTenant,
    commissionPaidMonth,
    setCommissionPaidMonth,
    selectedCommissionContract,
    selectedCommissionBase,
    propertiesOptions,
    peopleOptions,
    contractsOptions,
    endDate,
    previewTotals,
    previewPageCount,
    visiblePreviewInstallments,
    commissionTotal,
    handleGeneratePreview,
    handleApproveContract,
    handleApproveCommission,
    openPanel,
  };
};
