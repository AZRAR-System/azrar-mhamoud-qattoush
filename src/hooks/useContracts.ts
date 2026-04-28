import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DbService } from '@/services/mockDb';
import {
  العقود_tbl,
  الأشخاص_tbl,
  العقارات_tbl,
  الكمبيالات_tbl,
  type PaymentMethodType,
} from '@/types';
import { exportToXlsx, readSpreadsheet, type XlsxColumn } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { SearchEngine, FilterRule } from '@/services/searchEngine';
import { normalizeDigitsLoose } from '@/utils/searchNormalize';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useDebounce } from '@/hooks/useDebounce';
import { readSessionFilterJson, writeSessionFilterJson } from '@/utils/sessionFilterStorage';
import {
  contractPickerSearchPagedSmart,
  domainCountsSmart,
  peoplePickerSearchPagedSmart,
  propertyContractsSmart,
  propertyPickerSearchPagedSmart,
} from '@/services/domainQueries';
import type {
  ContractPickerItem,
  PeoplePickerItem,
  PropertyPickerItem,
} from '@/types/domain.types';
import {
  CONTRACTS_FAST_PAGE_SIZE,
  CONTRACTS_PAGE_SIZE,
} from '@/components/contracts/contractsConstants';
import type { ContractsAdvFiltersState } from '@/components/contracts/contractsTypes';

export function useContracts(isVisible = true) {
  const { t } = useTranslation();
  const pageSize = CONTRACTS_PAGE_SIZE;

  const tr = useCallback(
    (text: unknown) => {
      const s = String(text ?? '');
      if (!s) return '';
      return /[\u0600-\u06FF]/.test(s) ? t(s) : s;
    },
    [t]
  );

  type ContractsFiltersSaved = {
    searchTerm?: string;
    activeStatus?: 'active' | 'expiring' | 'expired' | 'terminated' | 'archived' | 'collection';
    sortMode?: 'created-desc' | 'created-asc' | 'end-desc' | 'end-asc';
    showAdvanced?: boolean;
    advFilters?: ContractsAdvFiltersState;
  };

  const savedContractFilters = readSessionFilterJson<ContractsFiltersSaved>('contracts');

  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [installments, setInstallments] = useState<الكمبيالات_tbl[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => savedContractFilters?.searchTerm ?? '');
  const [activeStatus, setActiveStatus] = useState<
    'active' | 'expiring' | 'expired' | 'terminated' | 'archived' | 'collection'
  >(() => savedContractFilters?.activeStatus ?? 'active');
  const [sortMode, setSortMode] = useState<'created-desc' | 'created-asc' | 'end-desc' | 'end-asc'>(
    () => savedContractFilters?.sortMode ?? 'created-desc'
  );

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [uiPage, setUiPage] = useState(0);

  const isDesktopFast =
    typeof window !== 'undefined' && !!window.desktopDb?.domainContractPickerSearch;
  const [desktopCounts, setDesktopCounts] = useState<{
    people: number;
    properties: number;
    contracts: number;
  } | null>(null);
  const [fastRows, setFastRows] = useState<ContractPickerItem[]>([]);
  const [fastTotal, setFastTotal] = useState(0);
  const [fastLoading, setFastLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);
  const [fastError, setFastError] = useState<string>('');
  const [fastPage, setFastPage] = useState(1);
  // Desktop fast paging uses a stable SQL page size (do not tie to responsive UI sizing).
  // Keeping this consistent prevents "التالي" from being disabled when the backend returns a fixed page size.
  const fastPageSize = CONTRACTS_FAST_PAGE_SIZE;
  const fastPageCount = useMemo(() => {
    const total = Number(fastTotal || 0) || 0;
    if (total > 0) return Math.max(1, Math.ceil(total / fastPageSize));

    // Fallback when total isn't available: infer if next page exists.
    const hasMaybeNext = Array.isArray(fastRows) && fastRows.length === fastPageSize;
    return Math.max(1, hasMaybeNext ? fastPage + 1 : fastPage);
  }, [fastPage, fastPageSize, fastRows, fastTotal]);
  const [fastReload, setFastReload] = useState(0);
  const warnedFastErrorRef = useRef<string>('');
  const deepLinkOpenedRef = useRef<string>('');

  const { openPanel } = useSmartModal();
  const toast = useToast();
  const dbSignal = useDbSignal();
  const isStaleRef = useRef(false);
  const deleteTimerRef = useRef<number | null>(null);
  const fastStaleRef = useRef(false);
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Support deep links:
  // - #/contracts?status=active|expiring|expired|terminated|archived&q=...
  // - #/contracts?detailsId=<contractId> (opens contract details modal)
  const applyFiltersFromHash = useCallback(() => {
    try {
      const raw = String(window.location.hash || '').startsWith('#')
        ? String(window.location.hash || '').slice(1)
        : String(window.location.hash || '');
      const qIndex = raw.indexOf('?');
      const search = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
      const params = new URLSearchParams(search);

      const status = (params.get('status') || params.get('tab') || '').trim();
      const allowed = ['active', 'expiring', 'expired', 'terminated', 'archived', 'collection'] as const;
      if (status && (allowed as readonly string[]).includes(status)) {
        setActiveStatus(status as (typeof allowed)[number]);
      }

      // Optional prefilled search
      if (params.has('q')) {
        setSearchTerm(String(params.get('q') || ''));
      }

      // Optional deep link to exact contract details
      const detailsId = (
        params.get('detailsId') ||
        params.get('details') ||
        params.get('id') ||
        params.get('contractId') ||
        ''
      ).trim();
      if (detailsId && deepLinkOpenedRef.current !== detailsId) {
        deepLinkOpenedRef.current = detailsId;
        openPanel('CONTRACT_DETAILS', detailsId);
      }
    } catch {
      // ignore
    }
  }, [openPanel]);

  useEffect(() => {
    applyFiltersFromHash();
    let lastHashContracts = window.location.hash;
    const onHashChangeContracts = () => {
      const current = window.location.hash;
      if (current === lastHashContracts) return;
      lastHashContracts = current;
      applyFiltersFromHash();
    };
    window.addEventListener('hashchange', onHashChangeContracts);
    return () => window.removeEventListener('hashchange', onHashChangeContracts);
  }, [applyFiltersFromHash]);

  const importRef = useRef<HTMLInputElement>(null);

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(
    () => savedContractFilters?.showAdvanced ?? false
  );
  const [advFilters, setAdvFilters] = useState<ContractsAdvFiltersState>(() => ({
    startDateFrom: '',
    startDateTo: '',
    endDateFrom: '',
    endDateTo: '',
    minValue: '',
    maxValue: '',
    createdMonth: '',
    ...(savedContractFilters?.advFilters || {}),
  }));

  useEffect(() => {
    writeSessionFilterJson('contracts', {
      searchTerm,
      activeStatus,
      sortMode,
      showAdvanced,
      advFilters,
    });
  }, [searchTerm, activeStatus, sortMode, showAdvanced, advFilters]);

  const currentMonthKey = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const createdMonthApplied = useMemo(
    () => /^\d{4}-\d{2}$/.test(String(advFilters.createdMonth || '').trim()),
    [advFilters.createdMonth]
  );

  // Create Maps for fast lookup
  const peopleMap = useMemo(
    () => new Map(people.map((p) => [String(p.رقم_الشخص), p.الاسم])),
    [people]
  );
  const peopleNationalIdMap = useMemo(
    () => new Map(people.map((p) => [String(p.رقم_الشخص), normalizeDigitsLoose(p.الرقم_الوطني)])),
    [people]
  );
  const peoplePhoneMap = useMemo(
    () => new Map(people.map((p) => [String(p.رقم_الشخص), normalizeDigitsLoose(p.رقم_الهاتف)])),
    [people]
  );
  const peopleExtraPhoneMap = useMemo(
    () => new Map(people.map((p) => [String(p.رقم_الشخص), normalizeDigitsLoose(p.رقم_هاتف_اضافي)])),
    [people]
  );
  const propsById = useMemo(
    () => new Map(properties.map((p) => [String(p.رقم_العقار), p])),
    [properties]
  );
  const propsCodeMap = useMemo(
    () => new Map(properties.map((p) => [String(p.رقم_العقار), p.الكود_الداخلي])),
    [properties]
  );

  const loadData = useCallback(() => {
    if (isDesktopFast) {
      // Desktop fast mode: avoid loading huge arrays into renderer memory.
      setContracts([]);
      setProperties([]);
      setPeople([]);
      setInstallments([]);
      setFastReload((n) => n + 1);
      setListLoading(false);
      return;
    }

    setContracts(DbService.getContracts() || []);
    setProperties(DbService.getProperties() || []);
    setPeople(DbService.getPeople() || []);
    setInstallments(DbService.getInstallments() || []);
    setListLoading(false);
  }, [isDesktopFast]);

  useEffect(() => {
    if (isVisible) {
      const loadData = async () => {
        isStaleRef.current = false;
        setListLoading(true);

        // Phase 6: Run auto-archive scan once per day per session
        const _archiveKey = 'azrar_last_auto_archive';
        const _today = new Date().toDateString();
        if (sessionStorage.getItem(_archiveKey) !== _today) {
          DbService.autoArchiveContracts();
          sessionStorage.setItem(_archiveKey, _today);
        }

        const [allC, allP, allR, allI] = await Promise.all([
          DbService.getContracts(),
          DbService.getProperties(),
          DbService.getPeople(),
          DbService.getInstallments(),
        ]);
        setContracts(allC || []);
        setProperties(allP || []);
        setPeople(allR || []);
        setInstallments(allI || []);
        setListLoading(false);
      };
      loadData();
    } else {
      // background
    }
  }, [isVisible, dbSignal]);

  useEffect(() => {
    if (!isVisible && dbSignal) {
      isStaleRef.current = true;
      fastStaleRef.current = true;
    }
  }, [isVisible, dbSignal]);

  useEffect(() => {
    if (!isDesktopFast || !isVisible) return;
    let alive = true;
    const run = async () => {
      const c = await domainCountsSmart();
      if (!alive) return;
      setDesktopCounts(c);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [isDesktopFast, dbSignal, fastReload, isVisible]);

  // Desktop paged rows (status tab + search)
  useEffect(() => {
    if (!isDesktopFast || !isVisible) return;
    let alive = true;
    setFastLoading(true);
    setFastError('');
    const offset = (Math.max(1, fastPage) - 1) * fastPageSize;
    const run = async () => {
      try {
        const startDateFrom = showAdvanced ? String(advFilters.startDateFrom || '').trim() : '';
        const startDateTo = showAdvanced ? String(advFilters.startDateTo || '').trim() : '';
        const endDateFrom = showAdvanced ? String(advFilters.endDateFrom || '').trim() : '';
        const endDateTo = showAdvanced ? String(advFilters.endDateTo || '').trim() : '';
        const minValue = showAdvanced ? String(advFilters.minValue || '').trim() : '';
        const maxValue = showAdvanced ? String(advFilters.maxValue || '').trim() : '';

        const res = await contractPickerSearchPagedSmart({
          query: debouncedSearchTerm,
          tab: activeStatus,
          sort: sortMode,
          createdMonth: createdMonthApplied ? String(advFilters.createdMonth || '').trim() : '',
          startDateFrom,
          startDateTo,
          endDateFrom,
          endDateTo,
          minValue,
          maxValue,
          offset,
          limit: fastPageSize,
        });
        if (!alive) return;
        setFastRows(res.items || []);
        setFastTotal(res.total || 0);
        if (res.error) {
          const msg = String(res.error || '').trim();
          setFastError(msg);
          if (msg && warnedFastErrorRef.current !== msg) {
            warnedFastErrorRef.current = msg;
            toastRef.current.error(tr(msg));
          }
        }
      } finally {
        if (alive) setFastLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [
    isDesktopFast,
    debouncedSearchTerm,
    activeStatus,
    sortMode,
    fastPage,
    fastPageSize,
    advFilters,
    showAdvanced,
    createdMonthApplied,
    dbSignal,
    fastReload,
    tr,
    isVisible,
  ]);

  useEffect(() => {
    if (!isDesktopFast) return;
    setFastPage(1);
  }, [
    isDesktopFast,
    debouncedSearchTerm,
    activeStatus,
    sortMode,
    advFilters.createdMonth,
    fastPageSize,
  ]);

  useEffect(() => {
    if (!isDesktopFast) return;
    setFastPage((p) => Math.min(Math.max(1, p), fastPageCount));
  }, [fastPageCount, isDesktopFast]);

  useEffect(() => {
    if (isDesktopFast) return;
    setUiPage(0);
  }, [searchTerm, activeStatus, sortMode, showAdvanced, advFilters, pageSize, isDesktopFast]);

  const remainingByContractId = useMemo(() => {
    const map = new Map<string, number>();
    for (const inst of installments) {
      const contractId = String(inst?.رقم_العقد || '').trim();
      if (!contractId) continue;

      // Security deposit is a guarantee, not part of rent remaining.
      if (String(inst?.نوع_الكمبيالة || '').trim() === 'تأمين') continue;

      const { remaining } = getInstallmentPaidAndRemaining(inst);
      if (!remaining || remaining <= 0) continue;

      map.set(contractId, (map.get(contractId) || 0) + remaining);
    }
    return map;
  }, [installments]);

  const filteredContracts = useMemo(() => {
    if (isDesktopFast) return [];
    // 1. Status Filter
    let result = contracts.filter((c) => {
      if (activeStatus === 'archived') return c.isArchived;
      if (c.isArchived) return false;

      const status = String(c.حالة_العقد || '').trim();
      const isArchived = !!c.isArchived;

      switch (activeStatus as string) {
        case 'active':
          return !isArchived && (status === 'نشط' || status === 'Active' || status === 'قريب الانتهاء');
        case 'expiring':
          return !isArchived && (status === 'قريب الانتهاء' || status === 'قريبة الانتهاء');
        case 'collection':
          return !isArchived && (status === 'تحصيل');
        case 'expired':
          return !isArchived && (status === 'منتهي' || status === 'Expired');
        case 'terminated':
          return !isArchived && (status === 'مفسوخ' || status === 'Terminated');
        case 'archived':
          return isArchived || status === 'مؤرشف';
        default:
          return true;
      }
    });

    // 2. Search Filter (Using Maps for O(1) lookup)
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      const needleDigits = normalizeDigitsLoose(searchTerm);
      result = result.filter((c) => {
        const tenantId = String(c.رقم_المستاجر);
        const tenantName = peopleMap.get(tenantId) || '';
        const tenantNationalId = peopleNationalIdMap.get(tenantId) || '';
        const tenantPhone = peoplePhoneMap.get(tenantId) || '';
        const tenantExtraPhone = peopleExtraPhoneMap.get(tenantId) || '';
        const propCode = propsCodeMap.get(String(c.رقم_العقار)) || '';
        const opp = String(c.رقم_الفرصة || '').trim();

        const matchesText =
          c.رقم_العقد.toLowerCase().includes(lower) ||
          tenantName.toLowerCase().includes(lower) ||
          propCode.toLowerCase().includes(lower) ||
          opp.toLowerCase().includes(lower);
        if (matchesText) return true;

        if (!needleDigits) return false;
        return (
          normalizeDigitsLoose(c.رقم_العقد).includes(needleDigits) ||
          normalizeDigitsLoose(opp).includes(needleDigits) ||
          tenantNationalId.includes(needleDigits) ||
          tenantPhone.includes(needleDigits) ||
          tenantExtraPhone.includes(needleDigits)
        );
      });
    }

    // 3. Advanced Search
    // Created-month filter should work even when the advanced panel is hidden.
    if (createdMonthApplied) {
      const targetYm = String(advFilters.createdMonth || '').trim();
      result = result.filter((c) => {
        const createdRaw = String(c.تاريخ_الانشاء || '').trim();
        const basis = /^\d{4}-\d{2}-\d{2}$/.test(createdRaw)
          ? createdRaw
          : String(c.تاريخ_البداية || '').trim();
        const ym = /^\d{4}-\d{2}-\d{2}$/.test(basis) ? basis.slice(0, 7) : '';
        return ym === targetYm;
      });
    }

    if (showAdvanced) {
      const rules: FilterRule[] = [];
      if (advFilters.startDateFrom && advFilters.startDateTo) {
        rules.push({
          field: 'تاريخ_البداية',
          operator: 'dateBetween',
          value: [advFilters.startDateFrom, advFilters.startDateTo],
        });
      }
      if (advFilters.endDateFrom && advFilters.endDateTo) {
        rules.push({
          field: 'تاريخ_النهاية',
          operator: 'dateBetween',
          value: [advFilters.endDateFrom, advFilters.endDateTo],
        });
      }
      if (advFilters.minValue)
        rules.push({ field: 'القيمة_السنوية', operator: 'gte', value: advFilters.minValue });
      if (advFilters.maxValue)
        rules.push({ field: 'القيمة_السنوية', operator: 'lte', value: advFilters.maxValue });

      result = SearchEngine.applyFilters(result, rules);
    }

    // 4. Sorting
    const sorted = [...result];
    const createdKey = (c: العقود_tbl) => {
      const createdRaw = String(c.تاريخ_الانشاء || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(createdRaw)) return createdRaw;
      const start = String(c.تاريخ_البداية || '').trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : '';
    };
    const endKey = (c: العقود_tbl) => {
      const end = String(c.تاريخ_النهاية || '').trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : '';
    };
    if (sortMode === 'created-asc') {
      sorted.sort(
        (a, b) =>
          createdKey(a).localeCompare(createdKey(b)) ||
          String(a.رقم_العقد || '').localeCompare(String(b.رقم_العقد || ''))
      );
    } else if (sortMode === 'end-asc') {
      sorted.sort(
        (a, b) =>
          endKey(a).localeCompare(endKey(b)) ||
          String(a.رقم_العقد || '').localeCompare(String(b.رقم_العقد || ''))
      );
    } else if (sortMode === 'end-desc') {
      sorted.sort(
        (a, b) =>
          endKey(b).localeCompare(endKey(a)) ||
          String(b.رقم_العقد || '').localeCompare(String(a.رقم_العقد || ''))
      );
    } else {
      // created-desc
      sorted.sort(
        (a, b) =>
          createdKey(b).localeCompare(createdKey(a)) ||
          String(b.رقم_العقد || '').localeCompare(String(a.رقم_العقد || ''))
      );
    }

    return sorted;
  }, [
    contracts,
    activeStatus,
    searchTerm,
    peopleMap,
    peopleNationalIdMap,
    peoplePhoneMap,
    peopleExtraPhoneMap,
    propsCodeMap,
    showAdvanced,
    advFilters,
    createdMonthApplied,
    sortMode,
    isDesktopFast,
  ]);

  const uiPageCount = Math.max(1, Math.ceil(filteredContracts.length / pageSize));
  const uiRows = useMemo(() => {
    const start = uiPage * pageSize;
    return filteredContracts.slice(start, start + pageSize);
  }, [filteredContracts, uiPage, pageSize]);

  // Stable Handlers
  const handleOpenDetails = useCallback(
    (id: string) => openPanel('CONTRACT_DETAILS', id),
    [openPanel]
  );
  const handleOpenClearance = useCallback(
    (id: string) => openPanel('CLEARANCE_REPORT', id),
    [openPanel]
  );

  const handleEdit = useCallback(
    (id: string) => {
      openPanel('CONTRACT_FORM', id, {
        onSuccess: () => setTimeout(loadData, 300),
      });
    },
    [openPanel, loadData]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const contract = contracts.find((c) => c.رقم_العقد === id);
      const okConfirm = await toast.confirm({
        title: t('حذف العقد'),
        message: contract
          ? t('سيتم حذف العقد "{{id}}" نهائياً مع البيانات المرتبطة. لا يمكن التراجع.', {
              id: contract.رقم_العقد,
            })
          : t('سيتم حذف العقد نهائياً مع البيانات المرتبطة. لا يمكن التراجع.'),
        confirmText: t('حذف نهائي'),
        cancelText: t('إلغاء'),
        isDangerous: true,
      });
      if (!okConfirm) return;

      const sid = String(id);
      setDeletingContractId(sid);
      if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = window.setTimeout(() => {
        deleteTimerRef.current = null;
        const res = DbService.deleteContract(sid);
        setDeletingContractId(null);
        if (res.success) {
          toast.success(t('تم حذف العقد'));
          loadData();
        } else {
          toast.error(tr(res.message) || t('فشل حذف العقد'));
        }
      }, 1000);
    },
    [contracts, toast, loadData, t, tr]
  );

  const handleArchive = useCallback(
    async (id: string) => {
      const contract = contracts.find((c) => c.رقم_العقد === id);
      if (!contract) return;

      await toast.confirm({
        title: t('أرشفة العقد'),
        message: t('سيتم نقل العقد "{{id}}" للأرشيف. هل أنت متأكد؟', { id: contract.رقم_العقد }),
        confirmText: t('نعم، انقل للأرشيف'),
        cancelText: t('إلغاء'),
        isDangerous: false,
        onConfirm: async () => {
          try {
            DbService.archiveContract(id);
            toast.success(t('تمت أرشفة العقد بنجاح'), t('تم الأرشيف'));
            loadData();
          } catch (error) {
            toast.error(t('خطأ في الأرشفة: {{error}}', { error: String(error) }), t('فشل الأرشيف'));
          }
        },
        onCancel: () => {
          toast.info(t('تم إلغاء الأرشفة'), t('تم الإلغاء'));
        },
      });
    },
    [contracts, toast, loadData, t]
  );

  const canCreateContract = useMemo(() => {
    if (isDesktopFast) {
      // If counts are still loading, do not hard-block creation here; the form panels may still be unsupported on Desktop.
      // We only enforce the check when counts are known.
      if (!desktopCounts) return true;
      return Number(desktopCounts.people || 0) > 0 && Number(desktopCounts.properties || 0) > 0;
    }
    return people.length > 0 && properties.length > 0;
  }, [isDesktopFast, desktopCounts, people.length, properties.length]);

  const handleCreate = useCallback(() => {
    if (!canCreateContract) {
      toast.warning(t('لا يمكن إنشاء عقد بدون أشخاص وعقارات'));
      return;
    }
    openPanel('CONTRACT_FORM', 'new', {
      onSuccess: () => setTimeout(loadData, 500),
    });
  }, [canCreateContract, openPanel, toast, loadData, t]);

  const normalize = (v: unknown) => String(v ?? '').trim();

  const toDateOnly = useCallback((d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const computeEndDate = useCallback((startIso: string, durationMonths: number) => {
    // end = start + durationMonths months - 1 day
    const parts = String(startIso || '')
      .split('-')
      .map(Number);
    if (parts.length < 3) return '';
    const [y, m, d] = parts;
    if (!y || !m || !d) return '';
    const start = new Date(Date.UTC(y, m - 1, d));
    const endCandidate = new Date(start.getTime());
    endCandidate.setUTCMonth(endCandidate.getUTCMonth() + Number(durationMonths || 0));
    endCandidate.setUTCDate(endCandidate.getUTCDate() - 1);
    return toDateOnly(endCandidate);
  }, [toDateOnly]);

  const mapPaymentMethod = (raw: unknown): PaymentMethodType => {
    const v = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!v) return 'Postpaid';
    if (v.includes('pre') || v.includes('مقدم') || v.includes('مسب')) return 'Prepaid';
    if (v.includes('down') || v.includes('دفعة') || v.includes('اول')) return 'DownPayment_Monthly';
    if (v.includes('post') || v.includes('مؤجل') || v.includes('لاحق')) return 'Postpaid';
    // Accept exact enum values
    if (v === 'prepaid') return 'Prepaid';
    if (v === 'postpaid') return 'Postpaid';
    if (v === 'downpayment_monthly') return 'DownPayment_Monthly';
    return 'Postpaid';
  };

  const handleDownloadTemplate = useCallback(async () => {
    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
    await exportToXlsx(
      'Contracts',
      [
        { key: 'PropertyCode', header: 'PropertyCode' },
        { key: 'TenantNationalID', header: 'TenantNationalID' },
        { key: 'TenantPhone', header: 'TenantPhone' },
        { key: 'GuarantorNationalID', header: 'GuarantorNationalID' },
        { key: 'GuarantorPhone', header: 'GuarantorPhone' },
        { key: 'StartDate', header: 'StartDate' },
        { key: 'DurationMonths', header: 'DurationMonths' },
        { key: 'AnnualValue', header: 'AnnualValue' },
        { key: 'PaymentFrequency', header: 'PaymentFrequency' },
        { key: 'PaymentMethod', header: 'PaymentMethod' },
      ],
      [
        {
          PropertyCode: 'PROP-001',
          TenantNationalID: '0123456789',
          TenantPhone: '0790000000',
          GuarantorNationalID: '',
          GuarantorPhone: '',
          StartDate: new Date().toISOString().slice(0, 10),
          DurationMonths: 12,
          AnnualValue: 1200,
          PaymentFrequency: 12,
          PaymentMethod: 'Postpaid',
        },
      ],
      'contracts_template.xlsx',
      {
        extraSheets: companySheet ? [companySheet] : [],
      }
    );
    toast.success(t('تم تنزيل قالب العقود'));
  }, [t, toast]);

  const handlePickImportFile = useCallback(() => importRef.current?.click(), []);

  const handleImportFile = useCallback(async (file: File) => {
    const ok = await toast.confirm({
      title: t('استيراد العقود'),
      message: t(
        'سيتم استيراد العقود من الملف. سيتم تخطي أي سطر لا يمكن ربطه بعقار/مستأجر موجود. هل تريد المتابعة؟'
      ),
      confirmText: t('متابعة'),
      cancelText: t('إلغاء'),
    });
    if (!ok) return;

    let rows: Array<Record<string, string>> = [];
    try {
      rows = await readSpreadsheet(file);
    } catch (e: unknown) {
      const msg = e instanceof Error ? tr(e.message) : t('فشل قراءة ملف الاستيراد');
      toast.error(msg);
      return;
    }
    if (!rows.length) {
      toast.warning(t('الملف فارغ'));
      return;
    }

    const pick = (row: Record<string, string>, keys: string[]) => {
      for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };

    const isDesktopFastImport = isDesktopFast;

    // Desktop fast: resolve links through SQL search without loading full arrays.
    const propByCode = new Map<string, Pick<العقارات_tbl, 'رقم_العقار' | 'الكود_الداخلي'>>();
    const personByNationalId = new Map<
      string,
      Pick<الأشخاص_tbl, 'رقم_الشخص' | 'الرقم_الوطني' | 'رقم_الهاتف'>
    >();
    const personByPhone = new Map<
      string,
      Pick<الأشخاص_tbl, 'رقم_الشخص' | 'الرقم_الوطني' | 'رقم_الهاتف'>
    >();

    // De-dupe cache: for each property, set of "tenantId|startDate" keys.
    const existingByProperty = new Map<string, Set<string>>();

    const ensureExistingForProperty = async (propertyId: string) => {
      const pid = String(propertyId || '').trim();
      if (!pid) return new Set<string>();
      const cached = existingByProperty.get(pid);
      if (cached) return cached;

      const set = new Set<string>();
      if (isDesktopFastImport) {
        const items = (await propertyContractsSmart(pid)) || [];
        for (const it of items) {
          const c = it?.contract;
          const tid = normalize(c?.رقم_المستاجر);
          const sd = normalize(c?.تاريخ_البداية);
          if (tid && sd) set.add(`${tid}|${sd}`);
        }
      } else {
        const existingContracts = (DbService.getContracts() || []) as العقود_tbl[];
        for (const c of existingContracts) {
          if (normalize(c.رقم_العقار) !== normalize(pid)) continue;
          const tid = normalize(c.رقم_المستاجر);
          const sd = normalize(c.تاريخ_البداية);
          if (tid && sd) set.add(`${tid}|${sd}`);
        }
      }

      existingByProperty.set(pid, set);
      return set;
    };

    const findPropertyByCode = async (propertyCode: string) => {
      const codeNorm = normalize(propertyCode);
      if (!codeNorm) return null;
      const cached = propByCode.get(codeNorm);
      if (cached) return cached;

      if (isDesktopFastImport) {
        const res = await propertyPickerSearchPagedSmart({ query: codeNorm, offset: 0, limit: 50 });
        const exact =
          (res.items || [])
            .map((it) => it.property)
            .find(
              (p: PropertyPickerItem['property']) => normalize(p?.الكود_الداخلي) === codeNorm
            ) || null;

        const pid = String(exact?.رقم_العقار || '').trim();
        if (!pid) return null;
        const out = {
          رقم_العقار: pid,
          الكود_الداخلي: String(exact?.الكود_الداخلي || '').trim() || undefined,
        };
        propByCode.set(codeNorm, out);
        return out;
      }

      const propsAll = (DbService.getProperties() || []) as العقارات_tbl[];
      for (const p of propsAll) {
        const c = normalize(p.الكود_الداخلي);
        if (c && !propByCode.has(c)) propByCode.set(c, p);
      }
      return propByCode.get(codeNorm) || null;
    };

    const findPersonByNidOrPhone = async (nidRaw: string, phoneRaw: string) => {
      const nid = normalize(nidRaw);
      const ph = normalize(phoneRaw);
      if (nid && personByNationalId.has(nid)) return personByNationalId.get(nid) ?? null;
      if (ph && personByPhone.has(ph)) return personByPhone.get(ph) ?? null;

      if (isDesktopFastImport) {
        // Desktop safety: do not fall back to in-memory scans.
        if (!window.desktopDb?.domainPeoplePickerSearch) return null;

        // Prefer national ID exact match; else phone exact match.
        if (nid) {
          const res = await peoplePickerSearchPagedSmart({ query: nid, offset: 0, limit: 50 });
          const exact =
            (res.items || [])
              .map((it: PeoplePickerItem) => it.person)
              .find((p: PeoplePickerItem['person']) => normalize(p?.الرقم_الوطني) === nid) || null;
          const id = String(exact?.رقم_الشخص || '').trim();
          if (id) {
            const out = {
              رقم_الشخص: id,
              الرقم_الوطني: String(exact?.الرقم_الوطني || '').trim() || undefined,
              رقم_الهاتف: String(exact?.رقم_الهاتف || '').trim() || undefined,
            };
            if (nid) personByNationalId.set(nid, out);
            if (ph) personByPhone.set(ph, out);
            return out;
          }
        }

        if (ph) {
          const res = await peoplePickerSearchPagedSmart({ query: ph, offset: 0, limit: 50 });
          const exact =
            (res.items || [])
              .map((it: PeoplePickerItem) => it.person)
              .find((p: PeoplePickerItem['person']) => normalize(p?.رقم_الهاتف) === ph) || null;
          const id = String(exact?.رقم_الشخص || '').trim();
          if (id) {
            const out = {
              رقم_الشخص: id,
              الرقم_الوطني: String(exact?.الرقم_الوطني || '').trim() || undefined,
              رقم_الهاتف: String(exact?.رقم_الهاتف || '').trim() || undefined,
            };
            if (nid) personByNationalId.set(nid, out);
            if (ph) personByPhone.set(ph, out);
            return out;
          }
        }

        return null;
      }

      const peopleAll = (DbService.getPeople() || []) as الأشخاص_tbl[];
      for (const p of peopleAll) {
        const pnid = normalize(p.الرقم_الوطني);
        const pph = normalize(p.رقم_الهاتف);
        const out = {
          رقم_الشخص: String(p.رقم_الشخص),
          الرقم_الوطني: String(p.الرقم_الوطني || '').trim() || undefined,
          رقم_الهاتف: String(p.رقم_الهاتف || '').trim() || undefined,
        };
        if (pnid && !personByNationalId.has(pnid)) personByNationalId.set(pnid, out);
        if (pph && !personByPhone.has(pph)) personByPhone.set(pph, out);
      }
      if (nid && personByNationalId.has(nid)) return personByNationalId.get(nid) ?? null;
      if (ph && personByPhone.has(ph)) return personByPhone.get(ph) ?? null;
      return null;
    };

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const propertyCode = pick(row, [
        'PropertyCode',
        'Property',
        'Code',
        'الكود_الداخلي',
        'كود_العقار',
      ]);
      const tenantNationalId = pick(row, [
        'TenantNationalID',
        'NationalID',
        'الرقم_الوطني',
        'رقم_وطني_المستأجر',
      ]);
      const tenantPhone = pick(row, ['TenantPhone', 'Phone', 'رقم_الهاتف', 'هاتف_المستأجر']);
      const guarantorNationalId = pick(row, [
        'GuarantorNationalID',
        'GuarantorNID',
        'رقم_وطني_الكفيل',
      ]);
      const guarantorPhone = pick(row, ['GuarantorPhone', 'GuarantorPhoneNumber', 'هاتف_الكفيل']);
      const startDate = pick(row, ['StartDate', 'تاريخ_البداية', 'From']);
      const durationRaw = pick(row, ['DurationMonths', 'مدة_العقد_بالاشهر']);
      const endDateRaw = pick(row, ['EndDate', 'تاريخ_النهاية', 'To']);
      const annualValueRaw = pick(row, ['AnnualValue', 'القيمة_السنوية', 'Value']);
      const paymentFrequencyRaw = pick(row, ['PaymentFrequency', 'تكرار_الدفع']);
      const paymentMethodRaw = pick(row, ['PaymentMethod', 'طريقة_الدفع']);

      const prop = await findPropertyByCode(propertyCode);
      const tenant = await findPersonByNidOrPhone(tenantNationalId, tenantPhone);
      const guarantor = await findPersonByNidOrPhone(guarantorNationalId, guarantorPhone);

      const durationMonths = Number(durationRaw || 0);
      const annualValue = Number(annualValueRaw || 0);
      const paymentFrequency = Number(paymentFrequencyRaw || 0) || 12;

      if (!prop || !tenant) {
        skipped++;
        continue;
      }
      if (!startDate || !(durationMonths > 0) || !(annualValue > 0)) {
        skipped++;
        continue;
      }

      const endDate = endDateRaw || computeEndDate(startDate, durationMonths);
      if (!endDate) {
        skipped++;
        continue;
      }

      const propertyId = String(prop.رقم_العقار || '').trim();
      const tenantId = String(tenant.رقم_الشخص || '').trim();
      const key = `${normalize(tenantId)}|${normalize(startDate)}`;
      const existingKeysForProp = await ensureExistingForProperty(propertyId);
      if (existingKeysForProp.has(key)) {
        skipped++;
        continue;
      }

      const res = DbService.createContract(
        {
          رقم_العقار: propertyId,
          رقم_المستاجر: tenantId,
          رقم_الكفيل: String(guarantor?.رقم_الشخص || '').trim() || undefined,
          تاريخ_البداية: startDate,
          تاريخ_النهاية: endDate,
          مدة_العقد_بالاشهر: durationMonths,
          القيمة_السنوية: annualValue,
          تكرار_الدفع: paymentFrequency,
          طريقة_الدفع: mapPaymentMethod(paymentMethodRaw),
          حالة_العقد: 'نشط',
          isArchived: false,
        } satisfies Partial<العقود_tbl>,
        0,
        0
      );

      if (res.success) {
        created++;
        existingKeysForProp.add(key);
      } else {
        skipped++;
      }
    }

    loadData();
    toast.success(t('تم الاستيراد: إضافة {{created}} • تخطي {{skipped}}', { created, skipped }));
  }, [t, toast, loadData, isDesktopFast, tr, computeEndDate]);

  const handleExport = useCallback(async () => {
    if (isDesktopFast) {
      if (fastTotal === 0) return toast.warning(t('لا توجد بيانات للتصدير'));

      type DesktopExportRow = {
        ContractId: string;
        PropertyCode: string;
        OwnerName: string;
        TenantName: string;
        StartDate: string;
        EndDate: string;
        AnnualValue: number;
        PaymentFrequency: unknown;
        PaymentMethod: unknown;
        Status: string;
      };

      // Export the currently filtered Desktop set (paged fetch) on demand.
      const createdMonth = createdMonthApplied ? String(advFilters.createdMonth || '').trim() : '';
      const startDateFrom = showAdvanced ? String(advFilters.startDateFrom || '').trim() : '';
      const startDateTo = showAdvanced ? String(advFilters.startDateTo || '').trim() : '';
      const endDateFrom = showAdvanced ? String(advFilters.endDateFrom || '').trim() : '';
      const endDateTo = showAdvanced ? String(advFilters.endDateTo || '').trim() : '';
      const minValue = showAdvanced ? String(advFilters.minValue || '').trim() : '';
      const maxValue = showAdvanced ? String(advFilters.maxValue || '').trim() : '';

      const allItems: ContractPickerItem[] = [];
      const batch = 500;
      for (let off = 0; off < fastTotal; off += batch) {
        const res = await contractPickerSearchPagedSmart({
          query: debouncedSearchTerm,
          tab: activeStatus,
          sort: sortMode,
          createdMonth,
          startDateFrom,
          startDateTo,
          endDateFrom,
          endDateTo,
          minValue,
          maxValue,
          offset: off,
          limit: batch,
        });
        allItems.push(...(res.items || []));
        if ((res.items || []).length < batch) break;
      }

      if (allItems.length === 0) return toast.warning(t('لا توجد بيانات للتصدير'));

      const rows: DesktopExportRow[] = allItems.map((r) => {
        const c = r.contract;
        return {
          ContractId: String(c.رقم_العقد),
          PropertyCode: String(r.propertyCode || c.رقم_العقار || ''),
          OwnerName: r.ownerName || '',
          TenantName: r.tenantName || '',
          StartDate: c.تاريخ_البداية,
          EndDate: c.تاريخ_النهاية,
          AnnualValue: c.القيمة_السنوية,
          // Preserve legacy export behavior: some Desktop payloads may include a non-standard field.
          PaymentFrequency: (c as unknown as Record<string, unknown>)['نظام_الدفع'],
          PaymentMethod: c.طريقة_الدفع,
          Status: c.حالة_العقد,
        };
      });

      const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
      const cols: Array<XlsxColumn<DesktopExportRow>> = [
        { key: 'ContractId', header: 'ContractId' },
        { key: 'PropertyCode', header: 'PropertyCode' },
        { key: 'OwnerName', header: 'OwnerName' },
        { key: 'TenantName', header: 'TenantName' },
        { key: 'StartDate', header: 'StartDate' },
        { key: 'EndDate', header: 'EndDate' },
        { key: 'AnnualValue', header: 'AnnualValue' },
        { key: 'PaymentFrequency', header: 'PaymentFrequency' },
        { key: 'PaymentMethod', header: 'PaymentMethod' },
        { key: 'Status', header: 'Status' },
      ];
      await exportToXlsx(
        'Contracts',
        cols,
        rows,
        `contracts_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
        {
          extraSheets: companySheet ? [companySheet] : [],
        }
      );
      toast.success(t('تم التصدير'));
      return;
    }

    if (filteredContracts.length === 0) return toast.warning(t('لا توجد بيانات للتصدير'));

    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());

    const rows = filteredContracts.map((c) => {
      const tenantName = peopleMap.get(String(c.رقم_المستاجر)) || '';
      const propertyCode = propsCodeMap.get(String(c.رقم_العقار)) || '';
      return {
        ID: c.رقم_العقد,
        PropertyCode: propertyCode,
        Tenant: tenantName,
        StartDate: c.تاريخ_البداية,
        EndDate: c.تاريخ_النهاية,
        DurationMonths: c.مدة_العقد_بالاشهر,
        AnnualValue: c.القيمة_السنوية,
        PaymentFrequency: c.تكرار_الدفع,
        PaymentMethod: c.طريقة_الدفع,
        Status: c.حالة_العقد,
      };
    });

    await exportToXlsx(
      'Contracts',
      [
        { key: 'ID', header: 'ID' },
        { key: 'PropertyCode', header: 'PropertyCode' },
        { key: 'Tenant', header: 'Tenant' },
        { key: 'StartDate', header: 'StartDate' },
        { key: 'EndDate', header: 'EndDate' },
        { key: 'DurationMonths', header: 'DurationMonths' },
        { key: 'AnnualValue', header: 'AnnualValue' },
        { key: 'PaymentFrequency', header: 'PaymentFrequency' },
        { key: 'PaymentMethod', header: 'PaymentMethod' },
        { key: 'Status', header: 'Status' },
      ],
      rows,
      `contracts_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      {
        extraSheets: companySheet ? [companySheet] : [],
      }
    );

    DbService.logEvent(
      'User',
      'Export',
      'Contracts',
      '-',
      `Exported ${filteredContracts.length} contracts`
    );
    toast.success(t('تم التصدير'));
  }, [isDesktopFast, fastTotal, toast, t, createdMonthApplied, advFilters, showAdvanced, debouncedSearchTerm, activeStatus, sortMode, filteredContracts, peopleMap, propsCodeMap]);

  const desktopHasAnyAdvFilter = useMemo(() => {
    // Excluding createdMonth, since it's now a top-level quick filter.
    return Object.entries(advFilters).some(
      ([k, v]) => k !== 'createdMonth' && String(v ?? '').trim() !== ''
    );
  }, [advFilters]);

  const desktopFiltersApplied = useMemo(() => {
    return (
      !!String(searchTerm || '').trim() ||
      activeStatus !== 'active' ||
      createdMonthApplied ||
      (showAdvanced && desktopHasAnyAdvFilter)
    );
  }, [searchTerm, activeStatus, showAdvanced, desktopHasAnyAdvFilter, createdMonthApplied]);

  const desktopCountsKnown = isDesktopFast && desktopCounts !== null;
  const desktopNoContractsKnown = desktopCountsKnown && Number(desktopCounts?.contracts || 0) <= 0;

  // Empty-state decisions (desktop fast mode can operate even if domainCounts is missing).
  const loading = isDesktopFast ? fastLoading : listLoading;

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setActiveStatus('active');
    setSortMode('created-desc');
    setShowAdvanced(false);
    setAdvFilters({
      startDateFrom: '',
      startDateTo: '',
      endDateFrom: '',
      endDateTo: '',
      minValue: '',
      maxValue: '',
      createdMonth: '',
    });
    setUiPage(0);
    setFastPage(1);
  }, []);

  const showEmptyNoContracts = isDesktopFast
    ? !fastLoading &&
      (desktopNoContractsKnown ||
        (!desktopCountsKnown &&
          !desktopFiltersApplied &&
          fastRows.length === 0 &&
          fastTotal === 0 &&
          !fastError))
    : contracts.length === 0 && !listLoading;

  const showEmptyNoResults =
    !showEmptyNoContracts &&
    (isDesktopFast
      ? !fastLoading && fastRows.length === 0
      : filteredContracts.length === 0 && !listLoading);
  return {
    t,
    tr,
    pageSize,
    contracts,
    people,
    properties,
    installments,
    searchTerm,
    setSearchTerm,
    activeStatus,
    setActiveStatus,
    sortMode,
    setSortMode,
    uiPage,
    setUiPage,
    isDesktopFast,
    desktopCounts,
    fastRows,
    fastTotal,
    fastLoading,
    loading,
    deletingContractId,
    fastError,
    fastPage,
    setFastPage,
    fastPageSize,
    fastPageCount,
    importRef,
    showAdvanced,
    setShowAdvanced,
    advFilters,
    setAdvFilters,
    currentMonthKey,
    createdMonthApplied,
    peopleMap,
    propsById,
    propsCodeMap,
    loadData,
    remainingByContractId,
    filteredContracts,
    uiPageCount,
    uiRows,
    handleOpenDetails,
    handleOpenClearance,
    handleEdit,
    handleDelete,
    handleArchive,
    handleCreate,
    handleDownloadTemplate,
    handlePickImportFile,
    handleImportFile,
    handleExport,
    desktopHasAnyAdvFilter,
    desktopFiltersApplied,
    showEmptyNoContracts,
    showEmptyNoResults,
    clearFilters,
  };
}

export type ContractsPageModel = ReturnType<typeof useContracts>;
