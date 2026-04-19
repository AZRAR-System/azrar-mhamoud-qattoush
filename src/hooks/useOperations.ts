import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DbService } from '@/services/mockDb';
import {
  الكمبيالات_tbl,
  العقود_tbl,
  الأشخاص_tbl,
  العقارات_tbl,
  RoleType,
} from '@/types';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notificationService';
import { useDbSignal } from '@/hooks/useDbSignal';
import { storage } from '@/services/storage';
import { installmentsContractsPagedSmart } from '@/services/domainQueries';
import type { InstallmentsContractsItem } from '@/types/domain.types';

export type StepType =
  | 'select-contract'
  | 'select-installment'
  | 'payment-details'
  | 'confirmation'
  | 'complete';

export const useOperations = () => {
  const dbSignal = useDbSignal();
  const isDesktop = typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb;
  const isDesktopFast = isDesktop && !!window.desktopDb?.domainInstallmentsContractsSearch;
  const desktopUnsupported = isDesktop && !isDesktopFast;
  const warnedUnsupportedRef = useRef(false);

  // --- State Management ---
  const [currentStep, setCurrentStep] = useState<StepType>('select-contract');
  const [selectedContract, setSelectedContract] = useState<العقود_tbl | null>(null);
  const [selectedInstallment, setSelectedInstallment] = useState<الكمبيالات_tbl | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // --- Data ---
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [installments, setInstallments] = useState<الكمبيالات_tbl[]>([]);
  const [search, setSearch] = useState('');

  const [contractsPage, setContractsPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);

  // Desktop fast mode
  const [fastRows, setFastRows] = useState<InstallmentsContractsItem[]>([]);
  const [fastLoading, setFastLoading] = useState(false);

  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id || 'system';

  const isRoleType = (v: unknown): v is RoleType =>
    v === 'SuperAdmin' || v === 'Admin' || v === 'Employee';
  const userRole: RoleType = isRoleType(user?.الدور) ? user.الدور : 'Employee';

  // --- Notifications ---
  const notifyInfo = useCallback((message: string, title?: string) =>
    notificationService.info(message, title, { sound: false }), []);
  const notifySuccess = useCallback((message: string, title?: string) =>
    notificationService.success(message, title, { sound: false }), []);
  const notifyWarning = useCallback((message: string, title?: string) =>
    notificationService.warning(message, title, { sound: false }), []);
  const notifyInstallmentPaid = useCallback((amount: number, tenantName: string) =>
    notificationService.installmentPaid(amount, tenantName), []);

  const loadData = useCallback(() => {
    if (isDesktopFast) {
      setContracts([]);
      setPeople([]);
      setProperties([]);
      setInstallments([]);
      return;
    }

    if (desktopUnsupported) {
      setContracts([]);
      setPeople([]);
      setProperties([]);
      setInstallments([]);
      if (!warnedUnsupportedRef.current) {
        warnedUnsupportedRef.current = true;
        toast.warning('صفحة العمليات تحتاج وضع السرعة/SQL في نسخة الديسكتوب');
      }
      return;
    }

    setContracts(DbService.getContracts().filter((c) => !c.isArchived));
    setPeople(DbService.getPeople());
    setProperties(DbService.getProperties());
    setInstallments(DbService.getInstallments());
  }, [desktopUnsupported, isDesktopFast, toast]);

  // Load data
  useEffect(() => {
    loadData();
  }, [dbSignal, loadData]);

  useEffect(() => {
    if (!isDesktopFast) return;
    let alive = true;
    setFastLoading(true);

    const run = async () => {
      try {
        const res = await installmentsContractsPagedSmart({
          query: String(search || '').trim(),
          filter: 'all',
          offset: 0,
          limit: 50,
        });
        if (!alive) return;
        setFastRows(Array.isArray(res.items) ? res.items : []);
      } finally {
        if (alive) setFastLoading(false);
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, [isDesktopFast, dbSignal, search]);

  // --- Search & Filtering ---
  const filteredContracts = useMemo(() => {
    if (isDesktopFast) return [];
    return contracts.filter((c) => {
      const tenant = people.find((p) => p.رقم_الشخص === c.رقم_المستاجر);
      const property = properties.find((p) => p.رقم_العقار === c.رقم_العقار);
      const lower = String(search || '').toLowerCase();

      return (
        String(tenant?.الاسم || '')
          .toLowerCase()
          .includes(lower) ||
        String(property?.الكود_الداخلي || '')
          .toLowerCase()
          .includes(lower) ||
        String(c.رقم_العقد || '')
          .toLowerCase()
          .includes(lower)
      );
    });
  }, [isDesktopFast, contracts, people, properties, search]);

  const contractsPageSize = 12;
  const contractsTotal = desktopUnsupported
    ? 0
    : isDesktopFast
      ? fastRows.length
      : filteredContracts.length;
  const contractsPageCount = Math.max(1, Math.ceil(contractsTotal / contractsPageSize));

  useEffect(() => {
    setContractsPage(1);
  }, [search, currentStep, isDesktopFast, desktopUnsupported]);

  // Get unpaid installments for selected contract
  const pendingInstallments = useMemo(() => {
    if (!selectedContract) return [];
    return installments.filter(
      (i) =>
        i.رقم_العقد === selectedContract.رقم_العقد &&
        i.حالة_الكمبيالة !== 'مدفوع' &&
        i.نوع_الكمبيالة !== 'تأمين'
    );
  }, [selectedContract, installments]);

  const pendingPageSize = 10;
  const pendingPageCount = Math.max(1, Math.ceil(pendingInstallments.length / pendingPageSize));

  useEffect(() => {
    setPendingPage(1);
  }, [selectedContract?.رقم_العقد]);

  // --- Helpers to get tenant/property info ---
  const getTenant = useCallback((contract: العقود_tbl) => {
    if (isDesktopFast) {
      const contractId = String(contract?.رقم_العقد || '').trim();
      const row = fastRows.find((r) => String(r.contract?.رقم_العقد || '').trim() === contractId);
      return row?.tenant;
    }
    return people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
  }, [isDesktopFast, fastRows, people]);

  const getProperty = useCallback((contract: العقود_tbl) => {
    if (isDesktopFast) {
      const contractId = String(contract?.رقم_العقد || '').trim();
      const row = fastRows.find((r) => String(r.contract?.رقم_العقد || '').trim() === contractId);
      return row?.property;
    }
    return properties.find((p) => p.رقم_العقار === contract.رقم_العقار);
  }, [isDesktopFast, fastRows, properties]);

  // --- Form Reset ---
  const resetForm = useCallback(() => {
    setCurrentStep('select-contract');
    setSelectedContract(null);
    setSelectedInstallment(null);
    setPaidAmount(0);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setSearch('');
    loadData();
  }, [loadData]);

  // --- Handlers ---
  const handleSelectContract = useCallback((contract: العقود_tbl) => {
    setSelectedContract(contract);
    setPaidAmount(0);
    setPaymentNotes('');
    setSelectedInstallment(null);
    setCurrentStep('select-installment');
    notifyInfo('تم اختيار العقد - اختر الدفعة', 'خطوة 2');
  }, [notifyInfo]);

  const handleSelectContractFast = useCallback((row: InstallmentsContractsItem) => {
    const contract = row.contract;
    setSelectedContract(contract);
    setPaidAmount(0);
    setPaymentNotes('');
    setSelectedInstallment(null);
    setInstallments(Array.isArray(row.installments) ? row.installments : []);
    setCurrentStep('select-installment');
    notifyInfo('تم اختيار العقد - اختر الدفعة', 'خطوة 2');
  }, [notifyInfo]);

  const handleSelectInstallment = useCallback((inst: الكمبيالات_tbl) => {
    setSelectedInstallment(inst);
    setPaidAmount(inst.القيمة);
    setCurrentStep('payment-details');
    notifyInfo('تم اختيار الدفعة - أدخل تفاصيل السداد', 'خطوة 3');
  }, [notifyInfo]);

  const handlePaymentDetailsSubmit = useCallback(() => {
    if (!selectedInstallment) return;
    if (paidAmount <= 0) {
      toast.error('يجب إدخال مبلغ أكبر من صفر');
      return;
    }
    if (paidAmount > selectedInstallment.القيمة) {
      toast.error(`المبلغ لا يمكن أن يتجاوز ${selectedInstallment.القيمة} د.أ`);
      return;
    }

    setCurrentStep('confirmation');
    notifySuccess('تم التحقق من البيانات - مراجعة نهائية', 'خطوة 4');
  }, [selectedInstallment, paidAmount, toast, notifySuccess]);

  const handleConfirmPayment = useCallback(() => {
    if (!selectedInstallment || !selectedContract) return;

    const isPartial = paidAmount < selectedInstallment.القيمة;
    const remainingAmount = selectedInstallment.القيمة - paidAmount;

    // Process Payment
    DbService.markInstallmentPaid(selectedInstallment.رقم_الكمبيالة, userId, userRole, {
      paidAmount: paidAmount,
      paymentDate: paymentDate,
      notes: paymentNotes,
      isPartial: isPartial,
    });

    // Notifications
    if (isPartial) {
      notifyWarning(
        `دفعة جزئية: ${paidAmount} د.أ من ${selectedInstallment.القيمة} د.أ\nالمتبقي: ${remainingAmount} د.أ`,
        'سداد جزئي'
      );
    } else {
      const tenantName = getTenant(selectedContract)?.الاسم;
      notifyInstallmentPaid(paidAmount, tenantName || 'مستأجر');
      notifySuccess(`✅ تم سداد الدفعة كاملة بمبلغ ${paidAmount} د.أ`);
    }

    // Reset and show completion
    setCurrentStep('complete');

    // Auto-reset after 3 seconds
    setTimeout(() => {
      resetForm();
    }, 3000);
  }, [selectedInstallment, selectedContract, paidAmount, userId, userRole, paymentDate, paymentNotes, notifyWarning, notifyInstallmentPaid, notifySuccess, getTenant, resetForm]);

  return {
    isDesktopFast,
    desktopUnsupported,
    currentStep,
    setCurrentStep,
    selectedContract,
    setSelectedContract,
    selectedInstallment,
    setSelectedInstallment,
    paidAmount,
    setPaidAmount,
    paymentDate,
    setPaymentDate,
    paymentNotes,
    setPaymentNotes,
    search,
    setSearch,
    contractsPage,
    setContractsPage,
    pendingPage,
    setPendingPage,
    fastRows,
    fastLoading,
    contractsTotal,
    contractsPageCount,
    contractsPageSize,
    pendingInstallments,
    pendingPageCount,
    pendingPageSize,
    filteredContracts,
    loadData,
    handleSelectContract,
    handleSelectContractFast,
    handleSelectInstallment,
    handlePaymentDetailsSubmit,
    handleConfirmPayment,
    resetForm,
    getTenant,
    getProperty,
  };
};
