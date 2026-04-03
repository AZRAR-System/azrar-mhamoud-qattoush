import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DbService } from '@/services/mockDb';
import {
  DynamicFormField,
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  الكمبيالات_tbl,
} from '@/types';
import { can } from '@/utils/permissions';
import { isTenancyRelevant } from '@/utils/tenancy';
import { exportToXlsx } from '@/utils/xlsx';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import {
  compareDateOnlySafe,
  daysBetweenDateOnlySafe,
  todayDateOnlyISO,
} from '@/utils/dateOnly';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useDebounce } from '@/hooks/useDebounce';
import { readSessionFilterJson, writeSessionFilterJson } from '@/utils/sessionFilterStorage';
import {
  domainCountsSmart,
  domainGetSmart,
  installmentsContractsPagedSmart,
} from '@/services/domainQueries';
import { PAGE_SIZE, INSTALLMENT_STATUS } from '@/components/installments/installmentsConstants';
import {
  getLastPositivePaymentAmount,
  getPaidAndRemaining,
  isRecord,
  normalizeRole,
  parseDateOnlyLocal,
  todayDateOnlyLocal,
} from '@/components/installments/installmentsUtils';
import type { DesktopInstallmentsRow } from '@/components/installments/installmentsTypes';
import type { StatementTemplateData } from '@/components/printing/templates/StatementTemplate';
import {
  buildFullPrintHtmlDocument,
  DEFAULT_PRINT_MARGINS_MM,
  escapeHtml,
} from '@/components/printing/printPreviewTypes';
import { getSettings } from '@/services/db/settings';
import { printHtmlUnifiedWithBrowserFallback } from '@/services/printing/unifiedPrint';

function lastDayOfMonthStr(ym: string): string {
  const [yS, mS] = ym.split('-');
  const y = Number(yS);
  const m = Number(mS);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return `${ym}-28`;
  const d = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthLabelAr(ym: string): string {
  try {
    const [y, mo] = ym.split('-').map(Number);
    const dt = new Date(y, mo - 1, 15);
    return new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(dt);
  } catch {
    return ym;
  }
}

export function useInstallments() {
  // Auth Hook for role checking
  const { user } = useAuth();
  const isAdmin = user?.الدور === 'SuperAdmin' || user?.الدور === 'Admin';
  const userId = user?.id || 'system';
  const userRole = normalizeRole(user?.الدور);

  const toast = useToast();

  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [installments, setInstallments] = useState<الكمبيالات_tbl[]>([]);

  const isDesktop = typeof window !== 'undefined' && !!window.desktopDb;
  const isDesktopFast = isDesktop && !!window.desktopDb?.domainInstallmentsContractsSearch;


  const [desktopRows, setDesktopRows] = useState<DesktopInstallmentsRow[]>([]);
  const [desktopTotal, setDesktopTotal] = useState(0);
  const [desktopPage, setDesktopPage] = useState(0);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [desktopCounts, setDesktopCounts] = useState<{
    people: number;
    properties: number;
    contracts: number;
  } | null>(null);
  const [desktopError, setDesktopError] = useState('');
  const warnedDesktopErrorRef = useRef<string>('');
  const desktopPageRef = useRef(0);

  const [showDynamicColumns] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<DynamicFormField[]>([]);

  type InstallmentsFiltersSaved = {
    filter?: 'all' | 'debt' | 'paid' | 'due';
    search?: string;
    sortMode?:
      | 'tenant-asc'
      | 'tenant-desc'
      | 'due-asc'
      | 'due-desc'
      | 'amount-asc'
      | 'amount-desc';
    isAdvancedFiltersOpen?: boolean;
    filterStartDate?: string;
    filterEndDate?: string;
    filterMinAmount?: number | '';
    filterMaxAmount?: number | '';
    filterPaymentMethod?: string;
    showCharts?: boolean;
  };

  const savedInstFilters = readSessionFilterJson<InstallmentsFiltersSaved>('installments');

  const [filter, setFilter] = useState<'all' | 'debt' | 'paid' | 'due'>(
    () => savedInstFilters?.filter ?? 'all'
  );
  const [search, setSearch] = useState(() => savedInstFilters?.search ?? '');
  const [sortMode, setSortMode] = useState<
    'tenant-asc' | 'tenant-desc' | 'due-asc' | 'due-desc' | 'amount-asc' | 'amount-desc'
  >(() => savedInstFilters?.sortMode ?? 'due-asc');

  const debouncedSearch = useDebounce(search, 300);

  desktopPageRef.current = desktopPage;

  // Advanced Filters State
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(
    () => savedInstFilters?.isAdvancedFiltersOpen ?? false
  );
  const [filterStartDate, setFilterStartDate] = useState(
    () => savedInstFilters?.filterStartDate ?? ''
  );
  const [filterEndDate, setFilterEndDate] = useState(() => savedInstFilters?.filterEndDate ?? '');
  const [filterMinAmount, setFilterMinAmount] = useState<number | ''>(
    () => savedInstFilters?.filterMinAmount ?? ''
  );
  const [filterMaxAmount, setFilterMaxAmount] = useState<number | ''>(
    () => savedInstFilters?.filterMaxAmount ?? ''
  );
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>(
    () => savedInstFilters?.filterPaymentMethod ?? 'all'
  );
  const [statementMonth, setStatementMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showCharts, setShowCharts] = useState(() => savedInstFilters?.showCharts ?? false);

  // Favorite Filters logic
  const [favoriteFilters, setFavoriteFilters] = useState<
    { name: string; filters: Record<string, unknown> }[]
  >(() => {
    try {
      const stored = localStorage.getItem('fav_installment_filters');
      return stored
        ? (JSON.parse(stored) as { name: string; filters: Record<string, unknown> }[])
        : [];
    } catch {
      return [];
    }
  });

  const saveCurrentFilter = (name: string) => {
    if (!name.trim()) return;
    const newFavs = [
      ...favoriteFilters,
      {
        name,
        filters: {
          filter,
          search,
          filterStartDate,
          filterEndDate,
          filterMinAmount,
          filterMaxAmount,
          filterPaymentMethod,
        },
      },
    ];
    setFavoriteFilters(newFavs);
    localStorage.setItem('fav_installment_filters', JSON.stringify(newFavs));
    toast.success('تم حفظ الفلتر في المفضلة');
  };

  const applyFavFilter = (fav: { filters: Record<string, unknown>; name: string }) => {
    const f = fav.filters;
    setFilter((f.filter as 'all' | 'debt' | 'paid' | 'due') || 'all');
    setSearch((f.search as string) || '');
    setFilterStartDate((f.filterStartDate as string) || '');
    setFilterEndDate((f.filterEndDate as string) || '');
    setFilterMinAmount((f.filterMinAmount as number | '') || '');
    setFilterMaxAmount((f.filterMaxAmount as number | '') || '');
    setFilterPaymentMethod((f.filterPaymentMethod as string) || 'all');
    toast.info(`تم تطبيق الفلتر: ${fav.name}`);
  };

  const deleteFavFilter = (name: string) => {
    const newFavs = favoriteFilters.filter((f) => f.name !== name);
    setFavoriteFilters(newFavs);
    localStorage.setItem('fav_installment_filters', JSON.stringify(newFavs));
  };

  const [selectedInstallment, setSelectedInstallment] = useState<الكمبيالات_tbl | null>(null);

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'warning' as 'warning' | 'danger' | 'success' | 'info',
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    action: null as (() => void) | null,
    reverseReason: '', // سبب عكس السداد
    showReasonField: false, // إظهار حقل السبب
  });

  const confirmDialogRef = useRef(confirmDialog);
  useEffect(() => {
    confirmDialogRef.current = confirmDialog;
  }, [confirmDialog]);

  // Message Composer Modal State
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageContext, setMessageContext] = useState<{
    installment: الكمبيالات_tbl;
    contract: العقود_tbl;
    tenant: الأشخاص_tbl;
    property: العقارات_tbl;
    category: 'reminder' | 'due' | 'late' | 'warning' | 'legal';
    overdueInstallmentsCount?: number;
    overdueAmountTotal?: number;
    overdueInstallmentsDetails?: string;
  } | null>(null);

  const { openPanel } = useSmartModal();

  const dbSignal = useDbSignal();

  useEffect(() => {
    writeSessionFilterJson('installments', {
      filter,
      search,
      sortMode,
      isAdvancedFiltersOpen,
      filterStartDate,
      filterEndDate,
      filterMinAmount,
      filterMaxAmount,
      filterPaymentMethod,
      showCharts,
    });
  }, [
    filter,
    search,
    sortMode,
    isAdvancedFiltersOpen,
    filterStartDate,
    filterEndDate,
    filterMinAmount,
    filterMaxAmount,
    filterPaymentMethod,
    showCharts,
  ]);

  // Support deep links: #/installments?filter=due|debt|paid|all&q=...
  useEffect(() => {
    const applyFromHash = () => {
      try {
        const raw = String(window.location.hash || '').startsWith('#')
          ? String(window.location.hash || '').slice(1)
          : String(window.location.hash || '');
        const qIndex = raw.indexOf('?');
        const searchPart = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
        const params = new URLSearchParams(searchPart);

        const nextFilter = String(params.get('filter') || '').trim();
        if (
          nextFilter === 'all' ||
          nextFilter === 'debt' ||
          nextFilter === 'paid' ||
          nextFilter === 'due'
        ) {
          setFilter(nextFilter);
        }

        const q = params.get('q');
        const s = params.get('search');
        if (q !== null) setSearch(String(q));
        else if (s !== null) setSearch(String(s));
      } catch {
        // ignore
      }
    };

    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  const legacyLoadData = useCallback(() => {
    setContracts(DbService.getContracts());
    setPeople(DbService.getPeople());
    setProperties(DbService.getProperties());
    // Sort installments by date for easier processing inside cards
    const allInst = DbService.getInstallments().sort((a, b) =>
      compareDateOnlySafe(a.تاريخ_استحقاق, b.تاريخ_استحقاق)
    );
    setInstallments(allInst);

    try {
      const f = DbService.getFormFields?.('installments') || [];
      setDynamicFields(Array.isArray(f) ? f : []);
    } catch {
      setDynamicFields([]);
    }
  }, []);

  const loadDesktopData = useCallback(async () => {
    setDesktopLoading(true);
    setDesktopError('');
    try {
      const counts = await domainCountsSmart();
      setDesktopCounts(counts);

      // Keep dynamic fields in renderer (not huge).
      try {
        const f = DbService.getFormFields?.('installments') || [];
        setDynamicFields(Array.isArray(f) ? f : []);
      } catch {
        setDynamicFields([]);
      }

      const res = await installmentsContractsPagedSmart({
        query: String(debouncedSearch || ''),
        filter,
        filterStartDate,
        filterEndDate,
        filterMinAmount,
        filterMaxAmount,
        filterPaymentMethod,
        sort: sortMode,
        offset: desktopPageRef.current * PAGE_SIZE,
        limit: PAGE_SIZE,
      });

      if (res?.error) {
        const msg = String(res.error || '').trim();
        setDesktopError(msg);
        if (msg && warnedDesktopErrorRef.current !== msg) {
          warnedDesktopErrorRef.current = msg;
          toast.error(msg);
        }
      }

      setDesktopRows(Array.isArray(res?.items) ? (res.items as DesktopInstallmentsRow[]) : []);
      setDesktopTotal(Number(res?.total || 0) || 0);

      // Clear legacy lists to avoid heavy computations/renders.
      setContracts([]);
      setPeople([]);
      setProperties([]);
      setInstallments([]);
    } finally {
      setDesktopLoading(false);
    }
  }, [
    debouncedSearch,
    filter,
    sortMode,
    toast,
    filterStartDate,
    filterEndDate,
    filterMinAmount,
    filterMaxAmount,
    filterPaymentMethod,
  ]);

  const loadDesktopDataRef = useRef(loadDesktopData);
  loadDesktopDataRef.current = loadDesktopData;

  const loadData = useCallback(() => {
    if (isDesktopFast) {
      void loadDesktopData();
      return;
    }
    // Desktop safety: do not fall back to legacy in-memory scans.
    if (isDesktop) {
      setDesktopRows([]);
      setDesktopTotal(0);
      setDesktopCounts(null);
      setContracts([]);
      setPeople([]);
      setProperties([]);
      setInstallments([]);
      try {
        const f = DbService.getFormFields?.('installments') || [];
        setDynamicFields(Array.isArray(f) ? f : []);
      } catch {
        setDynamicFields([]);
      }
      setListLoading(false);
      return;
    }
    legacyLoadData();
    setListLoading(false);
  }, [isDesktop, isDesktopFast, legacyLoadData, loadDesktopData]);

  useEffect(() => {
    loadData();
  }, [loadData, dbSignal]);

  useEffect(() => {
    const onChanged: EventListener = () => {
      loadData();
    };
    window.addEventListener('azrar:installments-changed', onChanged);
    return () => window.removeEventListener('azrar:installments-changed', onChanged);
  }, [loadData]);

  const desktopPageCount = useMemo(() => {
    if (!isDesktopFast) return 1;
    const total = Number(desktopTotal || 0) || 0;
    if (total > 0) return Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Fallback: if total isn't provided, infer whether there's a next page.
    const hasMaybeNext = Array.isArray(desktopRows) && desktopRows.length === PAGE_SIZE;
    return Math.max(1, hasMaybeNext ? desktopPage + 2 : desktopPage + 1);
  }, [desktopPage, desktopRows, desktopTotal, isDesktopFast]);

  useEffect(() => {
    if (!isDesktopFast) return;
    const maxPage = Math.max(0, desktopPageCount - 1);
    if (desktopPage > maxPage) setDesktopPage(maxPage);
  }, [desktopPage, desktopPageCount, isDesktopFast]);

  useEffect(() => {
    if (!isDesktopFast) return;
    // Reset to first page on filter/search changes.
    if (desktopPageRef.current !== 0) setDesktopPage(0);
    else void loadDesktopDataRef.current();
  }, [
    filter,
    debouncedSearch,
    sortMode,
    filterStartDate,
    filterEndDate,
    filterMinAmount,
    filterMaxAmount,
    filterPaymentMethod,
    isDesktopFast,
  ]);

  useEffect(() => {
    if (!isDesktopFast) return;
    void loadDesktopDataRef.current();
  }, [desktopPage, isDesktopFast]);

  const resolveTenantNameForInstallment = async (installment: الكمبيالات_tbl): Promise<string> => {
    const fallback = 'المستأجر';
    const contractId = String(installment?.رقم_العقد || '').trim();
    if (!contractId) return fallback;

    if (isDesktopFast) {
      try {
        const row = desktopRows.find((r) => String(r?.contract?.رقم_العقد || '') === contractId);
        const fastName = String(row?.tenant?.الاسم || '').trim();
        if (fastName) return fastName;
      } catch {
        // ignore
      }

      try {
        const c = await domainGetSmart('contracts', contractId);
        const tenantId = isRecord(c) ? String(c['رقم_المستاجر'] ?? '').trim() : '';
        if (!tenantId) return fallback;
        const p = await domainGetSmart('people', tenantId);
        const name = isRecord(p) ? String(p['الاسم'] ?? '').trim() : '';
        return name || fallback;
      } catch {
        return fallback;
      }
    }

    // Legacy (web): current behavior
    const allContracts = DbService.getContracts();
    const contract = allContracts.find((c) => c.رقم_العقد === installment.رقم_العقد);
    if (!contract) return fallback;
    const allPeople = DbService.getPeople();
    const tenant = allPeople.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
    return String(tenant?.الاسم || '').trim() || fallback;
  };

  // Handle Full Payment - Direct without modal
  const handleFullPayment = async (installment: الكمبيالات_tbl) => {
    const tenantNameForDialog = await resolveTenantNameForInstallment(installment);

    // Calculate amount to pay (use remaining if partial, else full)
    const amountToPay = installment.القيمة_المتبقية || installment.القيمة;

    // Show confirmation dialog
    setConfirmDialog({
      isOpen: true,
      type: 'warning',
      title: 'تأكيد السداد الكامل',
      message: `المستأجر: ${tenantNameForDialog}\nالمبلغ: ${amountToPay.toLocaleString()} د.أ`,
      confirmText: 'موافق',
      cancelText: 'إلغاء الأمر',
      reverseReason: '',
      showReasonField: false,
      action: () => {
        // Mark as paid (full payment) - pass userId and role
        DbService.markInstallmentPaid(installment.رقم_الكمبيالة, userId, userRole, {
          paidAmount: amountToPay,
          paymentDate: new Date().toISOString().split('T')[0],
          notes: 'سداد كامل مباشر',
          isPartial: false,
        });

        // Show success toast message
        toast.success(`تم سداد الدفعة بنجاح للمستأجر: ${tenantNameForDialog}`);

        // تحديث state مباشرة من قاعدة البيانات (بدون تأخير)
        loadData();
      },
    });
  };

  // Handle Partial Payment - Open modal to input amount
  const handlePartialPayment = (installment: الكمبيالات_tbl) => {
    setSelectedInstallment(installment);
  };

  // Handle Reverse Payment - Undo payment if clicked by mistake
  const handleReversePayment = async (installment: الكمبيالات_tbl) => {
    // ✅ استخدام نظام الصلاحيات - INSTALLMENT_REVERSE
    if (!can(userRole, 'INSTALLMENT_REVERSE')) {
      toast.error(`غير مصرح لك بعكس السداد. فقط ذوي الصلاحية المناسبة يمكنهم إجراء هذا الإجراء.`);
      return;
    }

    const tenantNameForDialog = await resolveTenantNameForInstallment(installment);

    const lastPaidAmount = getLastPositivePaymentAmount(installment);
    const amountToReverse = lastPaidAmount ?? installment.القيمة;

    // Show confirmation dialog with reason field
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'تأكيد عكس السداد',
      message: `المستأجر: ${tenantNameForDialog}\nسيتم عكس آخر عملية دفع بقيمة: ${amountToReverse.toLocaleString()} د.أ`,
      confirmText: 'نعم، ألغ السداد',
      cancelText: 'إلغاء الأمر',
      reverseReason: '',
      showReasonField: true,
      action: () => {
        const reason = confirmDialogRef.current.reverseReason;
        // Validate reason is provided
        if (!reason.trim()) {
          toast.error('يجب تحديد سبب عكس السداد');
          return;
        }

        // Reverse the payment with reason
        DbService.reversePayment(installment.رقم_الكمبيالة, userId, userRole, reason);

        // Show info toast message
        toast.info(`تم إلغاء سداد الدفعة بنجاح - السبب: ${reason}`);

        // Reload data immediately (no setTimeout)
        loadData();
      },
    });
  };

  const handlePay = (id: string) => {
    if (isDesktopFast) {
      for (const row of desktopRows) {
        const list = Array.isArray(row?.installments) ? row.installments : [];
        const inst = list.find((i) => String(i?.رقم_الكمبيالة || '') === id);
        if (inst) {
          setSelectedInstallment(inst);
          return;
        }
      }
      return;
    }

    const inst = installments.find((i) => i.رقم_الكمبيالة === id);
    if (inst) setSelectedInstallment(inst);
  };

  // Group Data Structure
  const groupedData = useMemo(() => {
    if (isDesktopFast) return [];
    const today = todayDateOnlyLocal();
    const isCollectibleDebtInstallment = (i: الكمبيالات_tbl) => {
      if (i.نوع_الكمبيالة === 'تأمين') return false;
      const status = String(i.حالة_الكمبيالة ?? '').trim();
      if (status === INSTALLMENT_STATUS.CANCELLED) return false;
      const { remaining } = getPaidAndRemaining(i);
      if (remaining <= 0) return false;
      const due = parseDateOnlyLocal(i.تاريخ_استحقاق);
      if (!due) return false;
      // عليهم ذمم = يستحق الدفع الآن (اليوم أو متأخر)
      return due.getTime() <= today.getTime();
    };

    const isRealInstallment = (i: الكمبيالات_tbl) => {
      if (i.نوع_الكمبيالة === 'تأمين') return false;
      const status = String(i.حالة_الكمبيالة ?? '').trim();
      return status !== INSTALLMENT_STATUS.CANCELLED;
    };

    const isDueSoonInstallment = (i: الكمبيالات_tbl) => {
      if (!isRealInstallment(i)) return false;
      const { remaining } = getPaidAndRemaining(i);
      if (remaining <= 0) return false;
      const daysUntilDue = daysBetweenDateOnlySafe(todayDateOnlyISO(), i.تاريخ_استحقاق);
      if (typeof daysUntilDue !== 'number') return false;
      // "مستحق" = أي شيء متأخر أو يستحق خلال الـ 7 أيام القادمة
      return daysUntilDue <= 7;
    };

    // Map installments to contracts
    const map = new Map<string, الكمبيالات_tbl[]>();
    installments.forEach((i) => {
      if (i.isArchived) return;
      const existing = map.get(i.رقم_العقد);
      if (existing) {
        existing.push(i);
      } else {
        map.set(i.رقم_العقد, [i]);
      }
    });

    // Join contracts with people/props
    return contracts
      .filter((c) => isTenancyRelevant(c))
      .map((c) => {
        const cInstalls = map.get(c.رقم_العقد) || [];
        const tenant = people.find((p) => p.رقم_الشخص === c.رقم_المستاجر);
        const prop = properties.find((p) => p.رقم_العقار === c.رقم_العقار);

        // Calculations for filtering
        const relevant = cInstalls.filter(isRealInstallment);
        const hasDebt = relevant.some(isCollectibleDebtInstallment);
        const hasDueSoon = relevant.some(isDueSoonInstallment);
        const hasAnyRelevant = relevant.length > 0;
        const isFullyPaid =
          hasAnyRelevant && relevant.every((i) => getPaidAndRemaining(i).remaining <= 0);

        return {
          contract: c,
          tenant,
          property: prop,
          installments: cInstalls,
          hasDebt,
          hasDueSoon,
          isFullyPaid,
        };
      });
  }, [isDesktopFast, contracts, people, properties, installments]);

  // Filtering Logic
  const filteredList = useMemo(() => {
    if (isDesktopFast) return [];
    let data = groupedData;

    // 1. Status Filter
    if (filter === 'debt') data = data.filter((d) => d.hasDebt);
    if (filter === 'due') data = data.filter((d) => d.hasDueSoon);
    if (filter === 'paid') data = data.filter((d) => d.isFullyPaid);

    // 2. Search Text
    if (search.trim()) {
      const lower = search.toLowerCase();
      data = data.filter(
        (d) =>
          d.tenant?.الاسم.toLowerCase().includes(lower) ||
          d.property?.الكود_الداخلي.toLowerCase().includes(lower) ||
          d.contract.رقم_العقد.toLowerCase().includes(lower) ||
          (isRecord(d.tenant) &&
            typeof d.tenant['رقم_الهوية'] === 'string' &&
            d.tenant['رقم_الهوية'].toLowerCase().includes(lower))
      );
    }

    // 3. Advanced Date Filter
    if (filterStartDate) {
      data = data.filter((d) => d.installments.some((i) => i.تاريخ_استحقاق >= filterStartDate));
    }
    if (filterEndDate) {
      data = data.filter((d) => d.installments.some((i) => i.تاريخ_استحقاق <= filterEndDate));
    }

    // 4. Advanced Amount Filter
    if (filterMinAmount !== '') {
      data = data.filter((d) =>
        d.installments.some((i) => i.القيمة >= (filterMinAmount as number))
      );
    }
    if (filterMaxAmount !== '') {
      data = data.filter((d) =>
        d.installments.some((i) => i.القيمة <= (filterMaxAmount as number))
      );
    }

    // 5. Payment Method Filter
    if (filterPaymentMethod !== 'all') {
      data = data.filter(
        (d) =>
          String(d.contract?.طريقة_الدفع || '').toLowerCase() === filterPaymentMethod.toLowerCase()
      );
    }

    const getNextDueISO = (installs: الكمبيالات_tbl[]) => {
      let bestUnpaid: Date | null = null;
      let bestOverall: Date | null = null;
      let lastPaid: Date | null = null;

      for (const i of installs) {
        if (i.نوع_الكمبيالة === 'تأمين') continue;
        const status = String(i.حالة_الكمبيالة ?? '').trim();
        if (status === INSTALLMENT_STATUS.CANCELLED) continue;

        const due = parseDateOnlyLocal(i.تاريخ_استحقاق);
        if (!due) continue;

        // Always track earliest overall for fallback if needed
        if (!bestOverall || due.getTime() < bestOverall.getTime()) bestOverall = due;

        const { remaining } = getPaidAndRemaining(i);
        if (remaining > 0) {
          // First unpaid is the most relevant "due date"
          if (!bestUnpaid || due.getTime() < bestUnpaid.getTime()) bestUnpaid = due;
        } else {
          // Last paid is the second most relevant
          if (!lastPaid || due.getTime() > lastPaid.getTime()) lastPaid = due;
        }
      }

      // Priority: First Unpaid > Last Paid > Earliest Overall > null
      const result = bestUnpaid || lastPaid || bestOverall;
      return result ? result.toISOString() : null;
    };

    data = [...data].sort((a, b) => {
      if (sortMode === 'due-asc' || sortMode === 'due-desc') {
        const aDue = getNextDueISO(Array.isArray(a.installments) ? a.installments : []);
        const bDue = getNextDueISO(Array.isArray(b.installments) ? b.installments : []);
        const aHas = !!aDue;
        const bHas = !!bDue;
        if (aHas !== bHas) return aHas ? -1 : 1; // nulls last
        if (aHas && bHas && aDue !== bDue)
          return sortMode === 'due-asc' ? aDue.localeCompare(bDue) : bDue.localeCompare(aDue);
      }

      if (sortMode === 'amount-asc' || sortMode === 'amount-desc') {
        const aVal = Number(a.contract?.القيمة_السنوية || 0);
        const bVal = Number(b.contract?.القيمة_السنوية || 0);
        if (aVal !== bVal) return sortMode === 'amount-asc' ? aVal - bVal : bVal - aVal;
      }

      const aName = String(a.tenant?.الاسم ?? '').trim();
      const bName = String(b.tenant?.الاسم ?? '').trim();
      if (sortMode === 'tenant-desc') {
        if (aName !== bName) return bName.localeCompare(aName, 'ar');
      } else {
        if (aName !== bName) return aName.localeCompare(bName, 'ar');
      }

      const aId = String(a.contract?.رقم_العقد ?? '').trim();
      const bId = String(b.contract?.رقم_العقد ?? '').trim();
      return aId.localeCompare(bId, 'ar');
    });

    return data;
  }, [
    isDesktopFast,
    groupedData,
    filter,
    search,
    sortMode,
    filterStartDate,
    filterEndDate,
    filterMinAmount,
    filterMaxAmount,
    filterPaymentMethod,
  ]);

  const prepareStatementPrintData = useCallback(async (): Promise<StatementTemplateData | null> => {
    const ym = statementMonth.trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) {
      toast.error('الشهر غير صالح');
      return null;
    }

    const monthLabel = monthLabelAr(ym);
    const rows: StatementTemplateData['rows'] = [];
    let totalPaid = 0;
    let totalRemaining = 0;

    const consume = (
      d: {
        tenant?: الأشخاص_tbl;
        contract: العقود_tbl;
        property?: العقارات_tbl;
      },
      inst: الكمبيالات_tbl
    ) => {
      if (inst.نوع_الكمبيالة === 'تأمين') return;
      if (String(inst.حالة_الكمبيالة ?? '').trim() === INSTALLMENT_STATUS.CANCELLED) return;
      const due = String(inst.تاريخ_استحقاق || '').trim();
      if (!due.startsWith(ym)) return;
      const { paid, remaining } = getPaidAndRemaining(inst);
      totalPaid += paid;
      totalRemaining += remaining;
      const tenantName = String(d.tenant?.الاسم || '').trim() || '—';
      const code = String(d.property?.الكود_الداخلي || '').trim() || '—';
      rows.push({
        description: `${tenantName} — ${code} — عقد ${d.contract.رقم_العقد}`,
        dueDate: due,
        paid,
        remaining,
      });
    };

    if (isDesktopFast) {
      const first = `${ym}-01`;
      const last = lastDayOfMonthStr(ym);
      const res = await installmentsContractsPagedSmart({
        query: debouncedSearch,
        filter,
        filterStartDate: first,
        filterEndDate: last,
        filterMinAmount,
        filterMaxAmount,
        filterPaymentMethod,
        sort: sortMode,
        offset: 0,
        limit: 20000,
      });
      if (res.error) {
        toast.error(res.error);
        return null;
      }
      for (const item of res.items || []) {
        for (const inst of item.installments || []) {
          consume(item, inst);
        }
      }
    } else {
      for (const d of filteredList) {
        for (const inst of d.installments || []) {
          consume(d, inst);
        }
      }
    }

    rows.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

    if (rows.length === 0) {
      toast.warning('لا توجد أقساط في الشهر المحدد ضمن الفلاتر الحالية');
      return null;
    }

    return {
      monthLabel,
      rows,
      totalPaid,
      totalRemaining,
      documentTitle: 'كشف حساب شهري',
    };
  }, [
    statementMonth,
    isDesktopFast,
    filteredList,
    debouncedSearch,
    filter,
    filterMinAmount,
    filterMaxAmount,
    filterPaymentMethod,
    sortMode,
    toast,
  ]);

  // Financial Stats calculation for the dashboard
  const financialStats = useMemo(() => {
    const data = isDesktopFast ? [] : groupedData;
    let totalExpected = 0;
    let totalCollected = 0;
    let totalOverdue = 0;
    let overdueCount = 0;

    if (isDesktopFast && desktopCounts) {
      return null;
    }

    data.forEach((d) => {
      d.installments.forEach((i) => {
        if (i.نوع_الكمبيالة === 'تأمين') return;
        const status = String(i.حالة_الكمبيالة ?? '').trim();
        if (status === INSTALLMENT_STATUS.CANCELLED) return;

        const { paid, remaining } = getPaidAndRemaining(i);
        totalExpected += i.القيمة;
        totalCollected += paid;

        const due = parseDateOnlyLocal(i.تاريخ_استحقاق);
        if (due && due.getTime() < todayDateOnlyLocal().getTime() && remaining > 0) {
          totalOverdue += remaining;
          overdueCount++;
        }
      });
    });

    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    return { totalExpected, totalCollected, totalOverdue, overdueCount, collectionRate };
  }, [isDesktopFast, groupedData, desktopCounts]);

  const handleExportExcel = () => {
    const rows = isDesktopFast ? [] : filteredList; // Basic export for web mode
    if (rows.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }

    const exportData = rows.flatMap((d) =>
      d.installments.map((i) => ({
        tenantName: d.tenant?.الاسم || 'غير معروف',
        contractNo: d.contract.رقم_العقد,
        propertyCode: d.property?.الكود_الداخلي || 'غير معروف',
        dueDate: i.تاريخ_استحقاق,
        total: i.القيمة,
        paid: getPaidAndRemaining(i).paid,
        remaining: getPaidAndRemaining(i).remaining,
        status: i.حالة_الكمبيالة,
      }))
    );

    const columns: Array<{ key: string; header: string }> = [
      { key: 'tenantName', header: 'المستأجر' },
      { key: 'contractNo', header: 'رقم العقد' },
      { key: 'propertyCode', header: 'العقار' },
      { key: 'dueDate', header: 'تاريخ الاستحقاق' },
      { key: 'total', header: 'القيمة' },
      { key: 'paid', header: 'المسدد' },
      { key: 'remaining', header: 'المتبقي' },
      { key: 'status', header: 'الحالة' },
    ];

    const dataForExport = exportData.map((row) => row as Record<string, unknown>);

    exportToXlsx(
      'Installments',
      columns,
      dataForExport,
      `دفعات_مالية_${new Date().toISOString().split('T')[0]}`
    );
    toast.success('تم تصدير ملف Excel بنجاح');
  };

  const handleExportPdf = useCallback(async () => {
    const rows = isDesktopFast ? [] : filteredList;
    if (rows.length === 0) {
      toast.error('لا توجد بيانات للطباعة');
      return;
    }

    const exportRows = rows.flatMap((d) =>
      d.installments.map((i) => ({
        tenantName: d.tenant?.الاسم || 'غير معروف',
        contractNo: d.contract.رقم_العقد,
        propertyCode: d.property?.الكود_الداخلي || 'غير معروف',
        dueDate: i.تاريخ_استحقاق,
        total: i.القيمة,
        paid: getPaidAndRemaining(i).paid,
        remaining: getPaidAndRemaining(i).remaining,
        status: i.حالة_الكمبيالة,
      }))
    );

    try {
      const settings = getSettings();
      const trs = exportRows
        .map((row, idx) => {
          return `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(String(row.tenantName))}</td>
            <td>${escapeHtml(String(row.contractNo))}</td>
            <td>${escapeHtml(String(row.propertyCode))}</td>
            <td>${escapeHtml(String(row.dueDate || ''))}</td>
            <td>${(Number(row.total) || 0).toLocaleString()}</td>
            <td>${(Number(row.paid) || 0).toLocaleString()}</td>
            <td>${(Number(row.remaining) || 0).toLocaleString()}</td>
            <td>${escapeHtml(String(row.status || ''))}</td>
          </tr>`;
        })
        .join('');
      const body = `
        <h1 style="font-size:18px;margin:0 0 12px;">قائمة الدفعات</h1>
        <p style="font-size:12px;color:#64748b;margin:0 0 14px;">${escapeHtml(new Date().toLocaleString('ar'))}</p>
        <table>
          <thead><tr>
            <th>#</th><th>المستأجر</th><th>رقم العقد</th><th>العقار</th><th>تاريخ الاستحقاق</th>
            <th>القيمة</th><th>المسدد</th><th>المتبقي</th><th>الحالة</th>
          </tr></thead>
          <tbody>${trs}</tbody>
        </table>`;
      const fullHtml = buildFullPrintHtmlDocument(settings, body, {
        orientation: 'landscape',
        marginsMm: DEFAULT_PRINT_MARGINS_MM,
      });
      const res = await printHtmlUnifiedWithBrowserFallback({
        documentType: 'installments_list',
        html: fullHtml,
        orientation: 'landscape',
        marginsMm: DEFAULT_PRINT_MARGINS_MM,
        defaultFileName: `دفعات_مالية_${new Date().toISOString().split('T')[0]}`,
      });
      if (res && res.ok === false) {
        toast.error(res.message.trim() || 'تعذرت الطباعة');
      } else if (res?.ok) {
        toast.success('جاري فتح حوار الطباعة');
      } else {
        toast.success('جاري فتح نافذة الطباعة');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشلت الطباعة');
    }
  }, [filteredList, isDesktopFast, toast]);

  const clearFilters = useCallback(() => {
    setFilter('all');
    setSearch('');
    setSortMode('due-asc');
    setIsAdvancedFiltersOpen(false);
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setFilterPaymentMethod('all');
    setShowCharts(false);
    setDesktopPage(0);
  }, []);

  return {
    isAdmin,
    userId,
    userRole,
    toast,
    isDesktop,
    isDesktopFast,
    warnedDesktopErrorRef,
    saveCurrentFilter,
    applyFavFilter,
    deleteFavFilter,
    confirmDialogRef,
    dbSignal,
    legacyLoadData,
    loadDesktopData,
    loadData,
    desktopPageCount,
    resolveTenantNameForInstallment,
    handleFullPayment,
    handlePartialPayment,
    handleReversePayment,
    handlePay,
    groupedData,
    filteredList,
    financialStats,
    handleExportExcel,
    handleExportPdf,
    clearFilters,
    contracts,
    setContracts,
    people,
    setPeople,
    properties,
    setProperties,
    installments,
    setInstallments,
    desktopRows,
    setDesktopRows,
    desktopTotal,
    setDesktopTotal,
    desktopPage,
    setDesktopPage,
    desktopLoading,
    loading: isDesktopFast ? desktopLoading : listLoading,
    setDesktopLoading,
    desktopCounts,
    setDesktopCounts,
    desktopError,
    setDesktopError,
    showDynamicColumns,
    dynamicFields,
    setDynamicFields,
    filter,
    setFilter,
    search,
    setSearch,
    sortMode,
    setSortMode,
    isAdvancedFiltersOpen,
    setIsAdvancedFiltersOpen,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filterMinAmount,
    setFilterMinAmount,
    filterMaxAmount,
    setFilterMaxAmount,
    filterPaymentMethod,
    setFilterPaymentMethod,
    statementMonth,
    setStatementMonth,
    prepareStatementPrintData,
    showCharts,
    setShowCharts,
    favoriteFilters,
    setFavoriteFilters,
    selectedInstallment,
    setSelectedInstallment,
    confirmDialog,
    setConfirmDialog,
    messageModalOpen,
    setMessageModalOpen,
    messageContext,
    setMessageContext,
    user,
    openPanel,
  };
}

export type InstallmentsPageModel = ReturnType<typeof useInstallments>;
