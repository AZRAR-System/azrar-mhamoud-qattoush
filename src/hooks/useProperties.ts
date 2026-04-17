import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DbService } from '@/services/mockDb';
import { العقارات_tbl, العقود_tbl, الأشخاص_tbl, DynamicFormField } from '@/types';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { exportToXlsx, readSpreadsheet } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { SearchEngine, FilterRule } from '@/services/searchEngine';
import { getTenancyStatusScore, isTenancyRelevant } from '@/utils/tenancy';
import { ROUTE_PATHS } from '@/routes/paths';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useClampPage } from '@/hooks/useClampPage';
import { useDebounce } from '@/hooks/useDebounce';
import { useResetPageToZero } from '@/hooks/useResetPageToZero';
import { readSessionFilterJson, writeSessionFilterJson } from '@/utils/sessionFilterStorage';
import { propertyPickerSearchPagedSmart, domainCountsSmart } from '@/services/domainQueries';
import { normalizeSearchText } from '@/utils/searchNormalize';
import {
  PROPERTIES_FAST_PAGE_SIZE,
  PROPERTIES_PAGE_SIZE,
} from '@/components/properties/propertiesConstants';
import type {
  ContractLinkFilter,
  DesktopDbBridge,
  DesktopPropertyPickerItem,
  PropertyExtras,
  RentFilter,
  SaleFilter,
} from '@/components/properties/propertiesTypes';

export function useProperties() {
  const { t } = useTranslation();
  const pageSize = PROPERTIES_PAGE_SIZE;
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);

  const desktopDb =
    typeof window !== 'undefined'
      ? (window as unknown as { desktopDb?: DesktopDbBridge }).desktopDb
      : undefined;
  const isDesktop = !!desktopDb;
  const isDesktopFast = isDesktop && !!desktopDb?.domainPropertyPickerSearch;
  const desktopUnsupported = isDesktop && !isDesktopFast;

  const warnedUnsupportedRef = useRef(false);
  const desktopRequestIdRef = useRef(0);
  const desktopPageRef = useRef(0);

  const [desktopRows, setDesktopRows] = useState<DesktopPropertyPickerItem[]>([]);
  const [desktopTotal, setDesktopTotal] = useState(0);
  const [desktopPage, setDesktopPage] = useState(0);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [deletingPropertyId, setDeletingPropertyId] = useState<string | null>(null);
  const [desktopCounts, setDesktopCounts] = useState<{
    people: number;
    properties: number;
    contracts: number;
  } | null>(null);

  const [uiPage, setUiPage] = useState(0);

  const importRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<number | null>(null);

  const tr = useCallback((text: string) => (/[\u0600-\u06FF]/.test(text) ? t(text) : text), [t]);

  type PropertiesFiltersSaved = {
    searchTerm?: string;
    filters?: {
      status: string;
      type: string;
      furnishing: string;
      sale: SaleFilter;
      rent: RentFilter;
    };
    sortMode?: 'code-asc' | 'code-desc' | 'updated-desc' | 'updated-asc';
    occupancy?: 'all' | 'rented' | 'vacant';
    showAdvanced?: boolean;
    advFilters?: {
      minArea: string;
      maxArea: string;
      minPrice: string;
      maxPrice: string;
      floor: string;
      contractLink: ContractLinkFilter;
    };
  };

  const savedPropFilters = readSessionFilterJson<PropertiesFiltersSaved>('properties');

  const [showDynamicColumns, setShowDynamicColumns] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<DynamicFormField[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => savedPropFilters?.searchTerm ?? '');
  const [filters, setFilters] = useState<{
    status: string;
    type: string;
    furnishing: string;
    sale: SaleFilter;
    rent: RentFilter;
  }>(() => ({
    status: '',
    type: '',
    furnishing: '',
    sale: '',
    rent: '',
    ...(savedPropFilters?.filters || {}),
  }));
  const [sortMode, setSortMode] = useState<
    'code-asc' | 'code-desc' | 'updated-desc' | 'updated-asc'
  >(() => savedPropFilters?.sortMode ?? 'code-asc');
  const [occupancy, setOccupancy] = useState<'all' | 'rented' | 'vacant'>(
    () => savedPropFilters?.occupancy ?? 'all'
  );

  // Advanced Filters
  const [showAdvanced, setShowAdvanced] = useState(() => savedPropFilters?.showAdvanced ?? false);
  const [advFilters, setAdvFilters] = useState({
    minArea: '',
    maxArea: '',
    minPrice: '',
    maxPrice: '',
    floor: '',
    contractLink: 'all' as ContractLinkFilter,
    ...(savedPropFilters?.advFilters || {}),
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  desktopPageRef.current = desktopPage;

  const { openPanel } = useSmartModal();
  const toast = useToast();

  const dbSignal = useDbSignal();

  useEffect(() => {
    writeSessionFilterJson('properties', {
      searchTerm,
      filters,
      sortMode,
      occupancy,
      showAdvanced,
      advFilters,
    });
  }, [searchTerm, filters, sortMode, occupancy, showAdvanced, advFilters]);

  // Support deep links: #/properties?occupancy=rented|vacant&q=...&id=ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
    const q = params.get('q') || params.get('search');
    const occ = params.get('occupancy');
    const id = params.get('id');

    if (q) setSearchTerm(q);
    if (occ === 'rented' || occ === 'vacant') setOccupancy(occ);

    if (id) {
      // Clear ID from URL
      const newUrl = window.location.pathname + window.location.hash.split('?')[0];
      window.history.replaceState({}, '', newUrl);
      openPanel('PROPERTY_DETAILS', id);
    }
  }, [setSearchTerm, setOccupancy, openPanel]);

  // Support deep links: #/properties?occupancy=rented|vacant&q=...
  useEffect(() => {
    const applyFromHash = () => {
      try {
        const raw = String(window.location.hash || '').startsWith('#')
          ? String(window.location.hash || '').slice(1)
          : String(window.location.hash || '');
        const qIndex = raw.indexOf('?');
        const search = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
        const params = new URLSearchParams(search);

        const occ = String(params.get('occupancy') || '').trim();
        if (!occ) {
          setOccupancy('all');
        } else if (occ === 'rented' || occ === 'vacant' || occ === 'all') {
          setOccupancy(occ as 'all' | 'rented' | 'vacant');
          // Keep the visible status filter aligned (best-effort)
          if (occ === 'rented') setFilters((prev) => ({ ...prev, status: prev.status || 'مؤجر' }));
          if (occ === 'vacant') setFilters((prev) => ({ ...prev, status: prev.status || 'شاغر' }));
        }

        if (params.has('q')) {
          setSearchTerm(String(params.get('q') || ''));
        }
      } catch {
        // ignore
      }
    };

    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  const loadData = useCallback(
    async (pageOverride?: number) => {
      if (isDesktopFast) {
        setDesktopLoading(true);
        const requestId = ++desktopRequestIdRef.current;
        try {
          const counts = await domainCountsSmart();
          setDesktopCounts(counts);

          const minArea = showAdvanced ? String(advFilters.minArea || '').trim() : '';
          const maxArea = showAdvanced ? String(advFilters.maxArea || '').trim() : '';
          const floor = showAdvanced ? String(advFilters.floor || '').trim() : '';
          const minPrice = showAdvanced ? String(advFilters.minPrice || '').trim() : '';
          const maxPrice = showAdvanced ? String(advFilters.maxPrice || '').trim() : '';
          const contractLink = showAdvanced ? advFilters.contractLink || 'all' : 'all';

          const res = await propertyPickerSearchPagedSmart({
            query: String(debouncedSearchTerm || ''),
            status: String(filters.status || ''),
            type: String(filters.type || ''),
            furnishing: String(filters.furnishing || ''),
            sort: sortMode,
            offset: (pageOverride ?? desktopPage) * PROPERTIES_FAST_PAGE_SIZE,
            limit: PROPERTIES_FAST_PAGE_SIZE,
            occupancy,
            sale: filters.sale || '',
            rent: filters.rent || '',
            minArea,
            maxArea,
            floor,
            minPrice,
            maxPrice,
            contractLink: contractLink !== 'all' ? contractLink : '',
          });

          // Ignore stale responses (typing / rapid filter changes).
          if (requestId !== desktopRequestIdRef.current) return;
          setDesktopRows(
            Array.isArray(res.items) ? (res.items as DesktopPropertyPickerItem[]) : []
          );
          setDesktopTotal(Number(res.total || 0) || 0);

          try {
            const f = DbService.getFormFields?.('properties') || [];
            setDynamicFields(Array.isArray(f) ? f : []);
          } catch {
            setDynamicFields([]);
          }
        } finally {
          setDesktopLoading(false);
          setListLoading(false);
        }
        return;
      }

      // Desktop focus: never load huge arrays in renderer.
      if (desktopUnsupported) {
        if (!warnedUnsupportedRef.current) {
          warnedUnsupportedRef.current = true;
          toast.warning(t('صفحة العقارات تحتاج وضع السرعة/SQL في نسخة الديسكتوب'));
        }
        setDesktopCounts(null);
        setDesktopRows([]);
        setDesktopTotal(0);
        setProperties([]);
        setContracts([]);
        setPeople([]);
        try {
          const f = DbService.getFormFields?.('properties') || [];
          setDynamicFields(Array.isArray(f) ? f : []);
        } catch {
          setDynamicFields([]);
        }
        setListLoading(false);
        return;
      }

      setProperties(DbService.getProperties());
      setContracts(DbService.getContracts());
      setPeople(DbService.getPeople());
      try {
        const f = DbService.getFormFields?.('properties') || [];
        setDynamicFields(Array.isArray(f) ? f : []);
      } catch {
        setDynamicFields([]);
      }
      setListLoading(false);
    },
    [
      advFilters.floor,
      advFilters.maxArea,
      advFilters.maxPrice,
      advFilters.minArea,
      advFilters.minPrice,
      advFilters.contractLink,
      desktopUnsupported,
      filters.furnishing,
      filters.rent,
      filters.sale,
      filters.status,
      filters.type,
      isDesktopFast,
      occupancy,
      debouncedSearchTerm,
      desktopPage,
      showAdvanced,
      sortMode,
      t,
      toast,
    ]
  );

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useEffect(() => {
    void loadDataRef.current();
  }, [dbSignal]);

  useEffect(() => {
    if (!isDesktopFast) return;
    setDesktopPage((prev) => {
      if (prev === 0) {
        void loadDataRef.current(0);
        return prev;
      }
      return 0;
    });
  }, [
    debouncedSearchTerm,
    filters.status,
    filters.type,
    filters.sale,
    filters.rent,
    filters.furnishing,
    sortMode,
    occupancy,
    showAdvanced,
    advFilters.minArea,
    advFilters.maxArea,
    advFilters.minPrice,
    advFilters.maxPrice,
    advFilters.floor,
    advFilters.contractLink,
    isDesktopFast,
  ]);

  useEffect(() => {
    if (!isDesktopFast) return;
    void loadDataRef.current();
  }, [desktopPage, isDesktopFast]);

  useResetPageToZero(!isDesktopFast, (n) => setUiPage(n), [
    searchTerm,
    filters,
    occupancy,
    showAdvanced,
    advFilters,
    sortMode,
    pageSize,
  ]);

  const peopleMap = useMemo(() => new Map(people.map((p) => [String(p.رقم_الشخص), p])), [people]);
  const getOwnerName = useCallback((id: string) => peopleMap.get(String(id))?.الاسم || t('غير معروف'), [peopleMap, t]);

  const activeContractByPropertyId = useMemo(() => {
    const m = new Map<string, العقود_tbl>();
    for (const c of contracts) {
      if (!c?.رقم_العقار) continue;
      if (!isTenancyRelevant(c)) continue;

      const key = String(c.رقم_العقار);
      const prev = m.get(key);
      if (!prev) {
        m.set(key, c);
        continue;
      }

      const prevScore = getTenancyStatusScore(prev.حالة_العقد);
      const nextScore = getTenancyStatusScore(c.حالة_العقد);
      if (nextScore > prevScore) {
        m.set(key, c);
        continue;
      }
      if (nextScore < prevScore) continue;

      // same score: pick the most recent by start date
      const a = String(prev.تاريخ_البداية || '');
      const b = String(c.تاريخ_البداية || '');
      if (b.localeCompare(a) > 0) m.set(key, c);
    }
    return m;
  }, [contracts]);

  const normalize = (v: unknown) => normalizeSearchText(v);

  const propertySearchIndex = useMemo(() => {
    // Build a searchable blob per property for fast filtering.
    // Includes: internal code, address, type/status, plot/plate/apt, owner name,
    // plus current tenant/guarantor/contract id (if available).
    const idx = new Map<string, string>();

    for (const p of properties) {
      const propertyId = String(p.رقم_العقار ?? '');
      if (!propertyId) continue;

      const ownerName = normalize(peopleMap.get(String(p.رقم_المالك))?.الاسم);

      const currentContract = activeContractByPropertyId.get(propertyId);
      const tenantName = currentContract?.رقم_المستاجر
        ? normalize(peopleMap.get(String(currentContract.رقم_المستاجر))?.الاسم)
        : '';
      const guarantorId = currentContract?.رقم_الكفيل;
      const guarantorName = guarantorId ? normalize(peopleMap.get(String(guarantorId))?.الاسم) : '';

      const parts = [
        p.الكود_الداخلي,
        p.العنوان,
        p.النوع,
        p.حالة_العقار,
        p.رقم_قطعة,
        p.رقم_لوحة,
        p.رقم_شقة,
        ownerName,
        currentContract?.رقم_العقد,
        currentContract?.حالة_العقد,
        tenantName,
        guarantorName,
      ]
        .map(normalize)
        .filter(Boolean);

      idx.set(propertyId, parts.join(' | '));
    }

    return idx;
  }, [properties, peopleMap, activeContractByPropertyId]);

  const filteredProperties = useMemo(() => {
    // 1. Basic Filters
    const searchNeedle = normalize(searchTerm);
    let result = properties.filter((p) => {
      const matchSearch = searchNeedle
        ? (propertySearchIndex.get(String(p.رقم_العقار)) || '').includes(searchNeedle)
        : true;
      const matchType = filters.type ? p.النوع === filters.type : true;
      const furnishingType = (p as العقارات_tbl & PropertyExtras).نوع_التاثيث;
      const matchFurnishing = filters.furnishing
        ? String(furnishingType || '') === filters.furnishing
        : true;
      const matchSale = filters.sale
        ? filters.sale === 'for-sale'
          ? !!p.isForSale
          : !p.isForSale
        : true;
      const isForRent = (p as العقارات_tbl & PropertyExtras).isForRent;
      const matchRent = filters.rent
        ? filters.rent === 'for-rent'
          ? isForRent !== false
          : isForRent === false
        : true;
      const isRentedValue = (p as العقارات_tbl & PropertyExtras).IsRented;
      const isRented =
        typeof isRentedValue === 'boolean'
          ? isRentedValue
          : String(p.حالة_العقار || '').trim() === 'مؤجر';
      const statusFilter = String(filters.status || '').trim();
      const matchStatus = !statusFilter
        ? true
        : statusFilter === 'شاغر'
          ? isRented === false
          : statusFilter === 'مؤجر'
            ? isRented === true
            : String(p.حالة_العقار || '').trim() === statusFilter;
      const matchOccupancy =
        occupancy === 'all'
          ? true
          : occupancy === 'rented'
            ? isRented === true
            : isRented === false;

      return (
        matchSearch &&
        matchStatus &&
        matchType &&
        matchFurnishing &&
        matchSale &&
        matchRent &&
        matchOccupancy
      );
    });

    // 2. Advanced Filters
    if (showAdvanced) {
      const rules: FilterRule[] = [];
      if (advFilters.minArea)
        rules.push({ field: 'المساحة', operator: 'gte', value: advFilters.minArea });
      if (advFilters.maxArea)
        rules.push({ field: 'المساحة', operator: 'lte', value: advFilters.maxArea });
      if (advFilters.floor)
        rules.push({ field: 'الطابق', operator: 'contains', value: advFilters.floor });
      // Price logic handles Rent or Sale price
      if (advFilters.minPrice || advFilters.maxPrice) {
        result = result.filter((p) => {
          const price = p.isForSale ? p.salePrice || 0 : p.الإيجار_التقديري || 0;
          const min = Number(advFilters.minPrice) || 0;
          const max = Number(advFilters.maxPrice) || Infinity;
          return price >= min && price <= max;
        });
      }

      if (advFilters.contractLink === 'linked') {
        result = result.filter((p) => activeContractByPropertyId.has(String(p.رقم_العقار)));
      } else if (advFilters.contractLink === 'unlinked') {
        result = result.filter((p) => !activeContractByPropertyId.has(String(p.رقم_العقار)));
      }
      result = SearchEngine.applyFilters(result, rules);
    }

    // 3. Sorting
    const sorted = [...result];
    const updatedKey = (p: العقارات_tbl) => {
      const anyP = p as unknown as Record<string, unknown>;
      const v = String(anyP['updatedAt'] ?? anyP['تاريخ_التعديل'] ?? '').trim();
      return v;
    };
    const idKey = (p: العقارات_tbl) => String(p.رقم_العقار || '').trim();
    const codeKey = (p: العقارات_tbl) => String(p.الكود_الداخلي || '').trim();

    if (sortMode === 'updated-asc') {
      sorted.sort(
        (a, b) => updatedKey(a).localeCompare(updatedKey(b)) || idKey(a).localeCompare(idKey(b))
      );
    } else if (sortMode === 'updated-desc') {
      sorted.sort(
        (a, b) => updatedKey(b).localeCompare(updatedKey(a)) || idKey(b).localeCompare(idKey(a))
      );
    } else if (sortMode === 'code-desc') {
      sorted.sort(
        (a, b) => codeKey(b).localeCompare(codeKey(a)) || idKey(b).localeCompare(idKey(a))
      );
    } else {
      // code-asc
      sorted.sort(
        (a, b) => codeKey(a).localeCompare(codeKey(b)) || idKey(a).localeCompare(idKey(b))
      );
    }

    return sorted;
  }, [
    properties,
    searchTerm,
    filters,
    showAdvanced,
    advFilters,
    propertySearchIndex,
    occupancy,
    activeContractByPropertyId,
    sortMode,
  ]);

  const desktopPageCount = useMemo(() => {
    if (!isDesktopFast) return 1;
    const total = Number(desktopTotal || 0) || 0;
    if (total > 0) return Math.max(1, Math.ceil(total / PROPERTIES_FAST_PAGE_SIZE));

    // Fallback when total isn't available: infer if next page exists.
    const hasMaybeNext =
      Array.isArray(desktopRows) && desktopRows.length === PROPERTIES_FAST_PAGE_SIZE;
    return Math.max(1, hasMaybeNext ? desktopPage + 2 : desktopPage + 1);
  }, [desktopPage, desktopRows, desktopTotal, isDesktopFast]);

  const uiPageCount = Math.max(1, Math.ceil(filteredProperties.length / pageSize));
  const uiRows = useMemo(() => {
    const start = uiPage * pageSize;
    return filteredProperties.slice(start, start + pageSize);
  }, [filteredProperties, uiPage, pageSize]);

  useClampPage({
    enabled: isDesktopFast,
    page: desktopPage,
    pageCount: desktopPageCount,
    setPage: (n) => setDesktopPage(n),
  });

  useClampPage({
    enabled: !isDesktopFast,
    page: uiPage,
    pageCount: uiPageCount,
    setPage: (n) => setUiPage(n),
  });

  const uniqueStrings = (values: unknown[]) => {
    const s = new Set<string>();
    for (const v of values) {
      const str = String(v ?? '').trim();
      if (str) s.add(str);
    }
    return Array.from(s);
  };

  const lookupLabels = (category: string) => {
    try {
      const raw = DbService.getLookupsByCategory(category) as unknown;
      const list = Array.isArray(raw) ? (raw as unknown[]) : [];
      return list
        .map((x) => {
          const label = (x as { label?: unknown })?.label;
          return typeof label === 'string' ? label : '';
        })
        .filter(Boolean);
    } catch {
      return [] as string[];
    }
  };

  const handleOpenForm = useCallback((id?: string) => {
    openPanel('PROPERTY_FORM', id || 'new', {
      onSuccess: () => setTimeout(loadData, 500),
    });
  }, [openPanel, loadData]);

  const handleDelete = useCallback((id: string) => {
    openPanel('CONFIRM_MODAL', id, {
      title: t('حذف العقار'),
      message: t('هل أنت متأكد من حذف هذا العقار؟ سيتم منع الحذف إذا كان العقار مؤجراً.'),
      confirmText: t('نعم، احذف'),
      onConfirm: () => {
        const sid = String(id);
        setDeletingPropertyId(sid);
        if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = window.setTimeout(() => {
          deleteTimerRef.current = null;
          const res = DbService.deleteProperty(sid);
          setDeletingPropertyId(null);
          if (res.success) {
            toast.success(tr(String(res.message || '')) || t('تم حذف العقار'));
            loadData();
          } else {
            toast.error(tr(String(res.message || '')) || t('فشل حذف العقار'));
          }
        }, 1000);
      },
    });
  }, [openPanel, t, tr, toast, loadData]);

  const normalizeKey = (v: unknown) =>
    String(v ?? '')
      .trim()
      .toLowerCase();

  const handleDownloadTemplate = useCallback(async () => {
    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
    await exportToXlsx(
      'Properties',
      [
        { key: 'Code', header: 'Code' },
        { key: 'OwnerNationalID', header: 'OwnerNationalID' },
        { key: 'OwnerPhone', header: 'OwnerPhone' },
        { key: 'Type', header: 'Type' },
        { key: 'Status', header: 'Status' },
        { key: 'Area', header: 'Area' },
        { key: 'Address', header: 'Address' },
        { key: 'City', header: 'City' },
        { key: 'Region', header: 'Region' },
        { key: 'PlotNo', header: 'PlotNo' },
        { key: 'PlateNo', header: 'PlateNo' },
        { key: 'AptNo', header: 'AptNo' },
        { key: 'Notes', header: 'Notes' },
      ],
      [
        {
          Code: 'PROP-001',
          OwnerNationalID: '0123456789',
          OwnerPhone: '0790000000',
          Type: 'شقة',
          Status: 'شاغر',
          Area: 120,
          Address: 'عمان - ...',
          City: 'عمان',
          Region: '...',
          PlotNo: '',
          PlateNo: '',
          AptNo: '',
          Notes: '',
        },
      ],
      'properties_template.xlsx',
      {
        extraSheets: companySheet ? [companySheet] : [],
      }
    );
    toast.success(t('تم تنزيل قالب العقارات'));
  }, [t, toast]);

  const handlePickImportFile = useCallback(() => importRef.current?.click(), []);

  const handleImportFile = useCallback(
    async (file: File) => {
      const ok = await toast.confirm({
        title: t('استيراد العقارات'),
        message: t(
          'سيتم استيراد العقارات وإضافة الجديد وتحديث الموجود حسب (الكود الداخلي). يجب أن يكون المالك موجوداً (حسب الرقم الوطني أو الهاتف). هل تريد المتابعة؟'
        ),
        confirmText: t('متابعة'),
        cancelText: t('إلغاء'),
      });
      if (!ok) return;

      let rows: Array<Record<string, unknown>> = [];
      try {
        rows = await readSpreadsheet(file);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        toast.error(tr(String(msg || '')) || t('فشل قراءة ملف الاستيراد'));
        return;
      }
      if (!rows.length) {
        toast.warning(t('الملف فارغ'));
        return;
      }

      const pick = (row: Record<string, unknown>, keys: string[]) => {
        for (const k of keys) {
          const v = row[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
        }
        return '';
      };

      const peopleAll = (DbService.getPeople() || []) as الأشخاص_tbl[];
      const existing = (DbService.getProperties() || []) as العقارات_tbl[];
      const byCode = new Map<string, العقارات_tbl>();
      for (const p of existing) {
        const codeKey = normalizeKey(p.الكود_الداخلي);
        if (codeKey) byCode.set(codeKey, p);
      }

      const byNationalId = new Map<string, الأشخاص_tbl>();
      const byPhone = new Map<string, الأشخاص_tbl>();
      for (const p of peopleAll) {
        const nid = normalizeKey(p.الرقم_الوطني);
        if (nid) byNationalId.set(nid, p);
        const ph = normalizeKey(p.رقم_الهاتف);
        if (ph) byPhone.set(ph, p);
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of rows) {
        const code = pick(row, ['Code', 'PropertyCode', 'الكود_الداخلي', 'كود_العقار']);
        const ownerNationalId = pick(row, [
          'OwnerNationalID',
          'NationalID',
          'رقم_وطني_المالك',
          'الرقم_الوطني',
        ]);
        const ownerPhone = pick(row, ['OwnerPhone', 'Phone', 'هاتف_المالك', 'رقم_الهاتف']);
        const type = pick(row, ['Type', 'النوع']) || 'شقة';
        const status = pick(row, ['Status', 'حالة_العقار']) || 'شاغر';
        const areaRaw = pick(row, ['Area', 'المساحة']);
        const address = pick(row, ['Address', 'العنوان']);
        const city = pick(row, ['City', 'المدينة']);
        const region = pick(row, ['Region', 'المنطقة']);
        const plotNo = pick(row, ['PlotNo', 'رقم_قطعة']);
        const plateNo = pick(row, ['PlateNo', 'رقم_لوحة']);
        const aptNo = pick(row, ['AptNo', 'رقم_شقة']);
        const notes = pick(row, ['Notes', 'ملاحظات']);

        const area = Number(areaRaw || 0);
        const owner =
          (ownerNationalId && byNationalId.get(normalizeKey(ownerNationalId))) ||
          (ownerPhone && byPhone.get(normalizeKey(ownerPhone)));

        if (!code || !address || !(area > 0) || !owner) {
          skipped++;
          continue;
        }

        const isRented = String(status) === 'مؤجر';

        const existingProp = byCode.get(normalizeKey(code));
        if (existingProp) {
          const res = DbService.updateProperty(existingProp.رقم_العقار, {
            الكود_الداخلي: code,
            رقم_المالك: owner.رقم_الشخص,
            النوع: type,
            حالة_العقار: status as العقارات_tbl['حالة_العقار'],
            IsRented: isRented,
            المساحة: area,
            العنوان: address,
            المدينة: city || undefined,
            المنطقة: region || undefined,
            رقم_قطعة: plotNo || undefined,
            رقم_لوحة: plateNo || undefined,
            رقم_شقة: aptNo || undefined,
            ملاحظات: notes || undefined,
          } as Partial<العقارات_tbl>);
          if (res.success) {
            updated++;
          } else {
            skipped++;
          }
        } else {
          const res = DbService.addProperty({
            الكود_الداخلي: code,
            رقم_المالك: owner.رقم_الشخص,
            النوع: type,
            العنوان: address,
            المدينة: city || undefined,
            المنطقة: region || undefined,
            حالة_العقار: status as العقارات_tbl['حالة_العقار'],
            الإيجار_التقديري: undefined,
            IsRented: isRented,
            المساحة: area,
            رقم_قطعة: plotNo || undefined,
            رقم_لوحة: plateNo || undefined,
            رقم_شقة: aptNo || undefined,
            ملاحظات: notes || undefined,
          } as Omit<العقارات_tbl, 'رقم_العقار'>);
          if (res.success) {
            created++;
          } else {
            skipped++;
          }
        }
      }

      loadData();
      toast.success(
        t('تم الاستيراد: إضافة {{created}} • تحديث {{updated}} • تخطي {{skipped}}', {
          created,
          updated,
          skipped,
        })
      );
    },
    [loadData, t, toast, tr]
  );

  const handleExport = async () => {
    if (isDesktopFast) {
      if (desktopTotal === 0) return toast.warning(t('لا توجد بيانات للتصدير'));

      const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());

      const minArea = showAdvanced ? String(advFilters.minArea || '').trim() : '';
      const maxArea = showAdvanced ? String(advFilters.maxArea || '').trim() : '';
      const floor = showAdvanced ? String(advFilters.floor || '').trim() : '';
      const minPrice = showAdvanced ? String(advFilters.minPrice || '').trim() : '';
      const maxPrice = showAdvanced ? String(advFilters.maxPrice || '').trim() : '';
      const contractLink = showAdvanced ? advFilters.contractLink || 'all' : 'all';

      const allItems: DesktopPropertyPickerItem[] = [];
      let offset = 0;
      const limit = 500;
      while (true) {
        const res = await propertyPickerSearchPagedSmart({
          query: String(debouncedSearchTerm || ''),
          status: String(filters.status || ''),
          type: String(filters.type || ''),
          furnishing: String(filters.furnishing || ''),
          sort: sortMode,
          offset,
          limit,
          occupancy,
          sale: filters.sale || '',
          rent: filters.rent || '',
          minArea,
          maxArea,
          floor,
          minPrice,
          maxPrice,
          contractLink: contractLink !== 'all' ? contractLink : '',
        });
        const items = Array.isArray(res.items) ? (res.items as DesktopPropertyPickerItem[]) : [];
        if (!items.length) break;
        allItems.push(...items);
        offset += items.length;
        if (items.length < limit) break;
      }

      const rows = allItems.map((it) => {
        const p = it?.property as العقارات_tbl;
        return {
          ID: p.رقم_العقار,
          Code: p.الكود_الداخلي,
          Type: p.النوع,
          Status: p.حالة_العقار,
          Area: p.المساحة,
          Owner: it?.ownerName || '',
          OwnerPhone: it?.ownerPhone || '',
          OwnerNationalID: it?.ownerNationalId || '',
          Address: p.العنوان,
          City: p.المدينة || '',
          Region: p.المنطقة || '',
        };
      });

      await exportToXlsx(
        'Properties',
        [
          { key: 'ID', header: 'ID' },
          { key: 'Code', header: 'Code' },
          { key: 'Type', header: 'Type' },
          { key: 'Status', header: 'Status' },
          { key: 'Area', header: 'Area' },
          { key: 'Owner', header: 'Owner' },
          { key: 'OwnerPhone', header: 'OwnerPhone' },
          { key: 'OwnerNationalID', header: 'OwnerNationalID' },
          { key: 'Address', header: 'Address' },
          { key: 'City', header: 'City' },
          { key: 'Region', header: 'Region' },
        ],
        rows,
        `properties_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
        {
          extraSheets: companySheet ? [companySheet] : [],
        }
      );

      DbService.logEvent('User', 'Export', 'Properties', '-', `Exported ${rows.length} properties`);
      toast.success(t('تم التصدير بنجاح'));
      return;
    }

    if (filteredProperties.length === 0) return toast.warning(t('لا توجد بيانات للتصدير'));

    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());

    const rows = filteredProperties.map((p) => {
      const owner = peopleMap.get(String(p.رقم_المالك));
      return {
        ID: p.رقم_العقار,
        Code: p.الكود_الداخلي,
        Type: p.النوع,
        Status: p.حالة_العقار,
        Area: p.المساحة,
        Owner: owner?.الاسم || '',
        OwnerPhone: owner?.رقم_الهاتف || '',
        OwnerNationalID: owner?.الرقم_الوطني || '',
        Address: p.العنوان,
        City: p.المدينة || '',
        Region: p.المنطقة || '',
      };
    });

    await exportToXlsx(
      'Properties',
      [
        { key: 'ID', header: 'ID' },
        { key: 'Code', header: 'Code' },
        { key: 'Type', header: 'Type' },
        { key: 'Status', header: 'Status' },
        { key: 'Area', header: 'Area' },
        { key: 'Owner', header: 'Owner' },
        { key: 'OwnerPhone', header: 'OwnerPhone' },
        { key: 'OwnerNationalID', header: 'OwnerNationalID' },
        { key: 'Address', header: 'Address' },
        { key: 'City', header: 'City' },
        { key: 'Region', header: 'Region' },
      ],
      rows,
      `properties_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      {
        extraSheets: companySheet ? [companySheet] : [],
      }
    );

    DbService.logEvent(
      'User',
      'Export',
      'Properties',
      '-',
      `Exported ${filteredProperties.length} properties`
    );
    toast.success(t('تم التصدير بنجاح'));
  };

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilters({ status: '', type: '', furnishing: '', sale: '', rent: '' });
    setSortMode('code-asc');
    setOccupancy('all');
    setShowAdvanced(false);
    setAdvFilters({
      minArea: '',
      maxArea: '',
      minPrice: '',
      maxPrice: '',
      floor: '',
      contractLink: 'all',
    });
    setUiPage(0);
    setDesktopPage(0);
  }, []);

  const filterOptions = useMemo(() => {
    // Auto-generate from Lookups (Settings -> جداول البيانات) so any added item appears automatically.
    // Also union with existing data values for backward compatibility.
    const typeFromLookups = lookupLabels('prop_type');
    const statusFromLookups = lookupLabels('prop_status');
    const furnishingFromLookups = lookupLabels('prop_furnishing');

    const typeFromData = uniqueStrings(properties.map((p) => p.النوع));
    const statusFromData = uniqueStrings(properties.map((p) => p.حالة_العقار));
    const furnishingFromData = uniqueStrings(
      properties.map((p) => (p as العقارات_tbl & PropertyExtras).نوع_التاثيث)
    );

    const typeOptions = uniqueStrings([...typeFromLookups, ...typeFromData]).map((v) => ({
      value: v,
      label: tr(v),
    }));
    const statusOptions = uniqueStrings([...statusFromLookups, ...statusFromData]).map((v) => ({
      value: v,
      label: tr(v),
    }));
    const furnishingOptions = uniqueStrings([...furnishingFromLookups, ...furnishingFromData]).map(
      (v) => ({ value: v, label: tr(v) })
    );

    return [
      { key: 'type', label: t('النوع'), options: typeOptions },
      { key: 'status', label: t('الحالة'), options: statusOptions },
      { key: 'furnishing', label: t('صفة العقار'), options: furnishingOptions },
      {
        key: 'sale',
        label: t('البيع'),
        options: [
          { value: 'for-sale', label: t('للبيع فقط') },
          { value: 'not-for-sale', label: t('ليس للبيع') },
        ],
      },
      {
        key: 'rent',
        label: t('الإيجار'),
        options: [
          { value: 'for-rent', label: t('للإيجار') },
          { value: 'not-for-rent', label: t('ليس للإيجار') },
        ],
      },
    ];
  }, [properties, t, tr]);

  const quickListForSale = (propertyId: string) => {
    const pid = String(propertyId || '').trim();
    if (!pid) return;
    try {
      localStorage.setItem('ui_sales_prefill_property_id', pid);
    } catch {
      // ignore
    }
    window.location.hash = '#' + ROUTE_PATHS.SALES;
  };

  const loading = isDesktopFast ? desktopLoading : listLoading;

  const showEmptyNoProperties = isDesktopFast
    ? desktopCounts?.properties === 0 && !desktopLoading
    : properties.length === 0 && !listLoading;
  const noResultsRaw = isDesktopFast
    ? !desktopLoading && desktopTotal === 0
    : filteredProperties.length === 0 && !listLoading;
  const showEmptyNoResults = !showEmptyNoProperties && noResultsRaw;
  const listVisible = !showEmptyNoProperties && !showEmptyNoResults;

  return {
    t,
    tr,
    pageSize,
    properties,
    contracts,
    people,
    isDesktop,
    isDesktopFast,
    desktopUnsupported,
    desktopRows,
    desktopTotal,
    desktopPage,
    setDesktopPage,
    desktopLoading,
    loading,
    deletingPropertyId,
    desktopCounts,
    uiPage,
    setUiPage,
    importRef,
    showDynamicColumns,
    setShowDynamicColumns,
    dynamicFields,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    sortMode,
    setSortMode,
    occupancy,
    setOccupancy,
    showAdvanced,
    setShowAdvanced,
    advFilters,
    setAdvFilters,
    loadData,
    peopleMap,
    getOwnerName,
    activeContractByPropertyId,
    filteredProperties,
    desktopPageCount,
    uiPageCount,
    uiRows,
    handleOpenForm,
    handleDelete,
    handleDownloadTemplate,
    handlePickImportFile,
    handleImportFile,
    handleExport,
    filterOptions,
    quickListForSale,
    openPanel,
    showEmptyNoProperties,
    showEmptyNoResults,
    listVisible,
    clearFilters,
  };

}

export type PropertiesPageModel = ReturnType<typeof useProperties>;
