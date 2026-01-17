/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة إدارة العقارات (Properties Management Page)
 * - عرض وإدارة جميع العقارات (شقق، فلل، مكاتب، محلات)
 * - البحث والفلترة المتقدمة
 * - إدارة حالات العقارات
 * - التكامل الكامل مع DbService فقط (لا اعتماد عكسي)
 *
 * 📊 مصدر البيانات:
 * - DbService.getProperties() - جلب جميع العقارات
 * - DbService.getPeople() - للحصول على أسماء المالكين
 *
 * 🎯 متى يظهر EmptyState:
 * - عند عدم وجود عقارات في النظام (properties.length === 0)
 * - عند عدم وجود نتائج بحث (filteredProperties.length === 0 && searchTerm)
 * - عند عدم وجود نتائج فلترة (filteredProperties.length === 0 && filters)
 *
 * ⚠️ DataGuard:
 * - غير مستخدم في هذه الصفحة (لا توجد بيانات مطلوبة مسبقاً)
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DbService } from '@/services/mockDb';
import { العقارات_tbl, العقود_tbl, الأشخاص_tbl, DynamicFormField } from '@/types';
import { MapPin, Edit2, Trash2, Home, Eye, Zap, Droplets, Briefcase, SlidersHorizontal, Download, Upload, ArrowRight } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { exportToXlsx, readSpreadsheet } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchEngine, FilterRule } from '@/services/searchEngine';
import { getTenancyStatusScore, isTenancyRelevant } from '@/utils/tenancy';
import { ROUTE_PATHS } from '@/routes/paths';
import { formatDynamicValue, isEmptyDynamicValue } from '@/components/dynamic/dynamicValue';
import { getPersonColorClasses } from '@/utils/personColor';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { useDbSignal } from '@/hooks/useDbSignal';
import { propertyPickerSearchPagedSmart, domainCountsSmart } from '@/services/domainQueries';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { SegmentedTabs } from '@/components/shared/SegmentedTabs';

type DesktopDbBridge = {
    domainPropertyPickerSearch?: unknown;
};

type DesktopPropertyPickerItem = {
    property: العقارات_tbl;
    ownerName?: string;
    ownerPhone?: string;
    ownerNationalId?: string;
    active?:
        | {
              contractId?: string;
              status?: string;
              startDate?: string;
              endDate?: string;
              tenantName?: string;
              tenantPhone?: string;
              guarantorName?: string;
              guarantorPhone?: string;
          }
        | null;
};

type SaleFilter = '' | 'for-sale' | 'not-for-sale';
type RentFilter = '' | 'for-rent' | 'not-for-rent';
type ContractLinkFilter = 'all' | 'linked' | 'unlinked';

type PropertyExtras = {
    IsRented?: boolean;
    isForRent?: boolean;
    نوع_التاثيث?: string;
    حقول_ديناميكية?: Record<string, unknown>;
};

export const Properties: React.FC = () => {
    const pageSize = useResponsivePageSize({ base: 8, sm: 10, md: 12, lg: 18, xl: 24, '2xl': 32 });
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
    const [contracts, setContracts] = useState<العقود_tbl[]>([]);
    const [people, setPeople] = useState<الأشخاص_tbl[]>([]);

                const desktopDb = (typeof window !== 'undefined'
                    ? (window as unknown as { desktopDb?: DesktopDbBridge }).desktopDb
                    : undefined);
                const isDesktop = !!desktopDb;
                const isDesktopFast = isDesktop && !!desktopDb?.domainPropertyPickerSearch;
                const desktopUnsupported = isDesktop && !isDesktopFast;

                const warnedUnsupportedRef = useRef(false);
                const desktopRequestIdRef = useRef(0);

        const [desktopRows, setDesktopRows] = useState<DesktopPropertyPickerItem[]>([]);
        const [desktopTotal, setDesktopTotal] = useState(0);
        const [desktopPage, setDesktopPage] = useState(0);
        const [desktopLoading, setDesktopLoading] = useState(false);
        const [desktopCounts, setDesktopCounts] = useState<{ people: number; properties: number; contracts: number } | null>(null);

        const [uiPage, setUiPage] = useState(0);

        const importRef = useRef<HTMLInputElement>(null);

    const [showDynamicColumns, setShowDynamicColumns] = useState(false);
    const [dynamicFields, setDynamicFields] = useState<DynamicFormField[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
        const [filters, setFilters] = useState<{ status: string; type: string; furnishing: string; sale: SaleFilter; rent: RentFilter }>({
                status: '',
                type: '',
                furnishing: '',
                sale: '',
                rent: '',
        });
        const [occupancy, setOccupancy] = useState<'all' | 'rented' | 'vacant'>('all');
  
  // Advanced Filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters, setAdvFilters] = useState({
      minArea: '', maxArea: '',
      minPrice: '', maxPrice: '',
      floor: '',
      contractLink: 'all' as ContractLinkFilter,
  });

  const { openPanel } = useSmartModal();
  const toast = useToast();

    const dbSignal = useDbSignal();

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
                    if (occ === 'rented') setFilters(prev => ({ ...prev, status: prev.status || 'مؤجر' }));
                    if (occ === 'vacant') setFilters(prev => ({ ...prev, status: prev.status || 'شاغر' }));
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

    const loadData = useCallback(async (pageOverride?: number) => {
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
              const contractLink = showAdvanced ? (advFilters.contractLink || 'all') : 'all';

              const res = await propertyPickerSearchPagedSmart({
                  query: String(searchTerm || ''),
                  status: String(filters.status || ''),
                  type: String(filters.type || ''),
                  offset: (pageOverride ?? desktopPage) * pageSize,
                  limit: pageSize,
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
              setDesktopRows(Array.isArray(res.items) ? (res.items as DesktopPropertyPickerItem[]) : []);
              setDesktopTotal(Number(res.total || 0) || 0);

              try {
                  const f = DbService.getFormFields?.('properties') || [];
                  setDynamicFields(Array.isArray(f) ? f : []);
              } catch {
                  setDynamicFields([]);
              }
          } finally {
              setDesktopLoading(false);
          }
          return;
      }

      // Desktop focus: never load huge arrays in renderer.
      if (desktopUnsupported) {
          if (!warnedUnsupportedRef.current) {
              warnedUnsupportedRef.current = true;
              toast.warning('صفحة العقارات تحتاج وضع السرعة/SQL في نسخة الديسكتوب');
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
    }, [
            advFilters.floor,
            advFilters.maxArea,
            advFilters.maxPrice,
            advFilters.minArea,
            advFilters.minPrice,
            advFilters.contractLink,
            desktopPage,
            desktopUnsupported,
            filters.rent,
            filters.sale,
            filters.status,
            filters.type,
            isDesktopFast,
            occupancy,
            pageSize,
            searchTerm,
            showAdvanced,
            toast,
    ]);

    const loadDataRef = useRef(loadData);
    useEffect(() => {
        loadDataRef.current = loadData;
    }, [loadData]);

    useEffect(() => {
        void loadDataRef.current();
    }, [dbSignal]);

    useEffect(() => {
        if (!isDesktopFast) return;
        if (filters.furnishing) {
            toast.warning('فلتر "صفة العقار" غير مدعوم في وضع السرعة حالياً');
            setFilters(prev => ({ ...prev, furnishing: '' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.furnishing, isDesktopFast]);

    useEffect(() => {
        if (!isDesktopFast) return;

        // Debounce SQL-backed search/filter fetches for a more instant feel while typing.
        const handle = window.setTimeout(() => {
            setDesktopPage(0);
            void loadData(0);
        }, 180);

        return () => window.clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        searchTerm,
        filters.status,
        filters.type,
        filters.sale,
        filters.rent,
        occupancy,
        showAdvanced,
        advFilters.minArea,
        advFilters.maxArea,
        advFilters.minPrice,
        advFilters.maxPrice,
        advFilters.floor,
        advFilters.contractLink,
        pageSize,
        isDesktopFast,
    ]);

    useEffect(() => {
        if (isDesktopFast) return;
        setUiPage(0);
    }, [searchTerm, filters, occupancy, showAdvanced, advFilters, pageSize, isDesktopFast]);

    const peopleMap = useMemo(() => new Map(people.map(p => [String(p.رقم_الشخص), p])), [people]);
    const getOwnerName = (id: string) => peopleMap.get(String(id))?.الاسم || 'غير معروف';

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

    const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();

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
            const guarantorName = guarantorId
                ? normalize(peopleMap.get(String(guarantorId))?.الاسم)
                : '';

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
      let result = properties.filter(p => {
          const matchSearch = searchTerm.trim()
              ? (propertySearchIndex.get(String(p.رقم_العقار)) || '').includes(normalize(searchTerm))
              : true;
          const matchStatus = filters.status ? p.حالة_العقار === filters.status : true;
          const matchType = filters.type ? p.النوع === filters.type : true;
          const furnishingType = (p as العقارات_tbl & PropertyExtras).نوع_التاثيث;
          const matchFurnishing = filters.furnishing ? String(furnishingType || '') === filters.furnishing : true;
          const matchSale = filters.sale
              ? (filters.sale === 'for-sale' ? !!p.isForSale : !p.isForSale)
              : true;
          const isForRent = (p as العقارات_tbl & PropertyExtras).isForRent;
          const matchRent = filters.rent ? (filters.rent === 'for-rent' ? isForRent !== false : isForRent === false) : true;
          const isRentedValue = (p as العقارات_tbl & PropertyExtras).IsRented;
          const isRented = typeof isRentedValue === 'boolean' ? isRentedValue : String(p.حالة_العقار || '').trim() === 'مؤجر';
          const matchOccupancy = occupancy === 'all'
              ? true
              : occupancy === 'rented'
                  ? isRented === true
                  : isRented === false;

          return matchSearch && matchStatus && matchType && matchFurnishing && matchSale && matchRent && matchOccupancy;
      });

      // 2. Advanced Filters
      if (showAdvanced) {
          const rules: FilterRule[] = [];
          if(advFilters.minArea) rules.push({ field: 'المساحة', operator: 'gte', value: advFilters.minArea });
          if(advFilters.maxArea) rules.push({ field: 'المساحة', operator: 'lte', value: advFilters.maxArea });
          if(advFilters.floor) rules.push({ field: 'الطابق', operator: 'contains', value: advFilters.floor });
          // Price logic handles Rent or Sale price
          if(advFilters.minPrice || advFilters.maxPrice) {
              result = result.filter(p => {
                  const price = p.isForSale ? (p.salePrice || 0) : (p.الإيجار_التقديري || 0);
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

      return result;
    }, [properties, searchTerm, filters, showAdvanced, advFilters, propertySearchIndex, occupancy, activeContractByPropertyId]);

        const desktopPageCount = isDesktopFast ? Math.max(1, Math.ceil(desktopTotal / pageSize)) : 1;

        const uiPageCount = Math.max(1, Math.ceil(filteredProperties.length / pageSize));
        const uiRows = useMemo(() => {
                const start = uiPage * pageSize;
                return filteredProperties.slice(start, start + pageSize);
        }, [filteredProperties, uiPage, pageSize]);

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

  const handleOpenForm = (id?: string) => {
      openPanel('PROPERTY_FORM', id || 'new', { 
          onSuccess: () => setTimeout(loadData, 500) 
      });
  };

  const handleDelete = (id: string) => {
      openPanel('CONFIRM_MODAL', id, {
          title: 'حذف العقار',
          message: 'هل أنت متأكد من حذف هذا العقار؟ سيتم منع الحذف إذا كان العقار مؤجراً.',
          confirmText: 'نعم، احذف',
          onConfirm: () => {
              const res = DbService.deleteProperty(id);
              if (res.success) {
                  toast.success(res.message);
                  loadData();
              } else {
                  toast.error(res.message);
              }
          }
      });
  };

    const normalizeKey = (v: unknown) => String(v ?? '').trim().toLowerCase();

  const handleDownloadTemplate = async () => {
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
      toast.success('تم تنزيل قالب العقارات');
  };

  const handlePickImportFile = () => importRef.current?.click();

  const handleImportFile = useCallback(
      async (file: File) => {
          const ok = await toast.confirm({
              title: 'استيراد العقارات',
              message:
                  'سيتم استيراد العقارات وإضافة الجديد وتحديث الموجود حسب (الكود الداخلي). يجب أن يكون المالك موجوداً (حسب الرقم الوطني أو الهاتف). هل تريد المتابعة؟',
              confirmText: 'متابعة',
              cancelText: 'إلغاء',
          });
          if (!ok) return;

          let rows: Array<Record<string, unknown>> = [];
          try {
              rows = await readSpreadsheet(file);
          } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : '';
              toast.error(msg || 'فشل قراءة ملف الاستيراد');
              return;
          }
          if (!rows.length) {
              toast.warning('الملف فارغ');
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
              const ownerNationalId = pick(row, ['OwnerNationalID', 'NationalID', 'رقم_وطني_المالك', 'الرقم_الوطني']);
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
          toast.success(`تم الاستيراد: إضافة ${created} • تحديث ${updated} • تخطي ${skipped}`);
      },
      [loadData, toast]
  );

    const handleExport = async () => {
          if (isDesktopFast) {
              if (desktopTotal === 0) return toast.warning('لا توجد بيانات للتصدير');

              const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());

              const allItems: DesktopPropertyPickerItem[] = [];
              let offset = 0;
              const limit = 500;
              while (true) {
                  const res = await propertyPickerSearchPagedSmart({
                      query: String(searchTerm || ''),
                      status: String(filters.status || ''),
                      type: String(filters.type || ''),
                      offset,
                      limit,
                      occupancy,
                      sale: filters.sale || '',
                      rent: filters.rent || '',
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

              DbService.logEvent('User', 'Export', 'Properties', `Exported ${rows.length} properties`);
              toast.success('تم التصدير بنجاح');
              return;
          }

          if (filteredProperties.length === 0) return toast.warning('لا توجد بيانات للتصدير');

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

      DbService.logEvent('User', 'Export', 'Properties', `Exported ${filteredProperties.length} properties`);
      toast.success('تم التصدير بنجاح');
  };

  const filterOptions = useMemo(() => {
      // Auto-generate from Lookups (Settings -> جداول البيانات) so any added item appears automatically.
      // Also union with existing data values for backward compatibility.
      const typeFromLookups = lookupLabels('prop_type');
      const statusFromLookups = lookupLabels('prop_status');
      const furnishingFromLookups = lookupLabels('prop_furnishing');

    const typeFromData = uniqueStrings(properties.map(p => p.النوع));
    const statusFromData = uniqueStrings(properties.map(p => p.حالة_العقار));
    const furnishingFromData = uniqueStrings(properties.map(p => (p as العقارات_tbl & PropertyExtras).نوع_التاثيث));

      const typeOptions = uniqueStrings([...typeFromLookups, ...typeFromData]).map(v => ({ value: v, label: v }));
      const statusOptions = uniqueStrings([...statusFromLookups, ...statusFromData]).map(v => ({ value: v, label: v }));
      const furnishingOptions = uniqueStrings([...furnishingFromLookups, ...furnishingFromData]).map(v => ({ value: v, label: v }));

      return [
          { key: 'type', label: 'النوع', options: typeOptions },
          { key: 'status', label: 'الحالة', options: statusOptions },
          ...(isDesktopFast ? [] : [{ key: 'furnishing', label: 'صفة العقار', options: furnishingOptions }]),
          {
              key: 'sale',
              label: 'البيع',
              options: [
                  { value: 'for-sale', label: 'للبيع فقط' },
                  { value: 'not-for-sale', label: 'ليس للبيع' },
              ],
          },
          {
              key: 'rent',
              label: 'الإيجار',
              options: [
                  { value: 'for-rent', label: 'للإيجار' },
                  { value: 'not-for-rent', label: 'ليس للإيجار' },
              ],
          },
      ];
  }, [properties, isDesktopFast]);

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

  const advInputClass =
      'w-full py-3 px-4 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm text-slate-900 dark:text-white placeholder-slate-400';
  const advLabelClass = 'block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1';

  return (
    <div className="space-y-6">
             <input
                 ref={importRef}
                 type="file"
                 accept=".xlsx,.xls,.csv"
                 className="hidden"
                 onChange={(e) => {
                         const f = e.target.files?.[0];
                         e.target.value = '';
                         if (f) void handleImportFile(f);
                 }}
             />
       <SmartFilterBar 
          title="إدارة العقارات"
          subtitle="سجل الوحدات السكنية والتجارية المفصل"
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filters={filterOptions}
          activeFilters={filters}
          onFilterChange={(key, val) => setFilters(prev => ({ ...prev, [key]: val }))}
          onAddClick={() => handleOpenForm()}
          addLabel="عقار جديد"
          onRefresh={loadData}
          extraActions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                  <SegmentedTabs
                      tabs={[
                          { id: 'all', label: 'الكل', icon: Home },
                          { id: 'rented', label: 'مؤجر', icon: Briefcase },
                          { id: 'vacant', label: 'شاغر', icon: Zap },
                      ]}
                      activeId={occupancy}
                      onChange={(id) => {
                          setOccupancy(id);
                          // Best-effort: keep the visible status filter aligned when it's not explicitly set.
                          if (id === 'rented') setFilters(prev => (prev.status ? prev : { ...prev, status: 'مؤجر' }));
                          if (id === 'vacant') setFilters(prev => (prev.status ? prev : { ...prev, status: 'شاغر' }));
                          if (id === 'all') {
                              setFilters(prev => (prev.status === 'مؤجر' || prev.status === 'شاغر' ? { ...prev, status: '' } : prev));
                          }
                      }}
                  />

                  <Button
                      variant="secondary"
                      onClick={() => {
                          setShowAdvanced(!showAdvanced);
                      }}
                      leftIcon={<SlidersHorizontal size={18}/>}
                  >
                      {showAdvanced ? 'إخفاء' : 'تصفية'}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowDynamicColumns(v => !v)}>
                      {showDynamicColumns ? 'إخفاء الحقول الإضافية' : 'إظهار الحقول الإضافية'}
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadTemplate} leftIcon={<Download size={18}/>}>قالب Excel</Button>
                  <RBACGuard requiredPermission="ADD_PROPERTY">
                      <Button variant="secondary" onClick={handlePickImportFile} leftIcon={<Upload size={18}/>}>استيراد</Button>
                  </RBACGuard>
                  <Button variant="secondary" onClick={handleExport} leftIcon={<Download size={18}/>}>تصدير</Button>
              </div>
          }
       />

       {/* Advanced Search Panel */}
       {showAdvanced && (
           <Card className="p-5 mb-6 animate-slide-up bg-indigo-50/50 dark:bg-slate-900/40 border-indigo-100/80 dark:border-slate-800">
               <div className="flex items-start justify-between gap-3 mb-4">
                   <div>
                       <div className="font-bold text-slate-800 dark:text-white">تصفية متقدمة</div>
                       <div className="text-xs text-slate-500 dark:text-slate-400">فلترة حسب المساحة والسعر والطابق</div>
                   </div>
                   <Button
                       size="sm"
                       variant="secondary"
                       onClick={() =>
                           setAdvFilters({
                               minArea: '',
                               maxArea: '',
                               minPrice: '',
                               maxPrice: '',
                               floor: '',
                               contractLink: 'all',
                           })
                       }
                   >
                       إعادة ضبط
                   </Button>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                   <div>
                       <label className={advLabelClass}>المساحة (من)</label>
                       <input
                           inputMode="numeric"
                           type="number"
                           placeholder="0"
                           className={advInputClass}
                           value={advFilters.minArea}
                           onChange={e => setAdvFilters({ ...advFilters, minArea: e.target.value })}
                       />
                   </div>
                   <div>
                       <label className={advLabelClass}>المساحة (إلى)</label>
                       <input
                           inputMode="numeric"
                           type="number"
                           placeholder="0"
                           className={advInputClass}
                           value={advFilters.maxArea}
                           onChange={e => setAdvFilters({ ...advFilters, maxArea: e.target.value })}
                       />
                   </div>
                   <div>
                       <label className={advLabelClass}>السعر (من)</label>
                       <input
                           inputMode="numeric"
                           type="number"
                           placeholder="0"
                           className={advInputClass}
                           value={advFilters.minPrice}
                           onChange={e => setAdvFilters({ ...advFilters, minPrice: e.target.value })}
                       />
                   </div>
                   <div>
                       <label className={advLabelClass}>السعر (إلى)</label>
                       <input
                           inputMode="numeric"
                           type="number"
                           placeholder="0"
                           className={advInputClass}
                           value={advFilters.maxPrice}
                           onChange={e => setAdvFilters({ ...advFilters, maxPrice: e.target.value })}
                       />
                   </div>
                   <div>
                       <label className={advLabelClass}>الطابق</label>
                       <input
                           type="text"
                           placeholder="مثال: 3"
                           className={advInputClass}
                           value={advFilters.floor}
                           onChange={e => setAdvFilters({ ...advFilters, floor: e.target.value })}
                       />
                   </div>

                   <div>
                       <label className={advLabelClass}>الارتباط بالعقد</label>
                       <select
                           className={advInputClass}
                           value={advFilters.contractLink}
                           onChange={e => setAdvFilters({ ...advFilters, contractLink: e.target.value as ContractLinkFilter })}
                       >
                           <option value="all">الكل</option>
                           <option value="linked">مرتبط بعقد</option>
                           <option value="unlinked">غير مرتبط بعقد</option>
                       </select>
                   </div>
               </div>
           </Card>
       )}

       {/* عرض EmptyState حسب الحالة */}
       {(isDesktopFast ? (desktopCounts?.properties === 0 && !desktopLoading) : properties.length === 0) ? (
           // حالة: لا توجد عقارات في النظام
           <EmptyState
               type="properties"
               onAction={() => handleOpenForm()}
           />
       ) : (isDesktopFast ? (!desktopLoading && desktopTotal === 0) : filteredProperties.length === 0) ? (
           // حالة: لا توجد نتائج بحث أو فلترة
           <EmptyState
               type={searchTerm ? "search" : "filter"}
               title={searchTerm ? "لا توجد نتائج بحث" : "لا توجد نتائج"}
               message={searchTerm
                   ? `لم يتم العثور على عقارات تطابق "${searchTerm}"`
                   : `لا توجد عقارات تطابق الفلاتر المحددة`
               }
               actionLabel={searchTerm ? "مسح البحث" : "مسح الفلاتر"}
               onAction={() => {
                   setSearchTerm('');
                   setFilters({ status: '', type: '', furnishing: '', sale: '', rent: '' });
                   setShowAdvanced(false);
                   setAdvFilters({ minArea: '', maxArea: '', minPrice: '', maxPrice: '', floor: '', contractLink: 'all' });
               }}
           />
       ) : (
           // حالة: عرض البيانات
           <>
               {isDesktopFast ? (
                   <div className="flex items-center justify-between mb-3">
                       <div className="text-sm text-slate-500 dark:text-slate-400">
                           {desktopTotal.toLocaleString()} نتيجة
                       </div>
                       <div className="flex items-center gap-2">
                           <Button
                               size="sm"
                               variant="secondary"
                               disabled={desktopLoading || desktopPage <= 0}
                               onClick={() => {
                                   const next = Math.max(0, desktopPage - 1);
                                   setDesktopPage(next);
                                   void loadData(next);
                               }}
                           >
                               السابق
                           </Button>
                           <div className="text-sm text-slate-600 dark:text-slate-300">
                               {desktopPage + 1} / {desktopPageCount}
                           </div>
                           <Button
                               size="sm"
                               variant="secondary"
                               disabled={desktopLoading || desktopPage + 1 >= desktopPageCount}
                               onClick={() => {
                                   const next = desktopPage + 1;
                                   setDesktopPage(next);
                                   void loadData(next);
                               }}
                           >
                               التالي
                           </Button>
                       </div>
                   </div>
               ) : (
                   <div className="flex items-center justify-between mb-3">
                       <div className="text-sm text-slate-500 dark:text-slate-400">
                           {filteredProperties.length.toLocaleString()} نتيجة
                       </div>
                       <div className="flex items-center gap-2">
                           <Button
                               size="sm"
                               variant="secondary"
                               disabled={uiPage <= 0}
                               onClick={() => setUiPage((p) => Math.max(0, p - 1))}
                           >
                               السابق
                           </Button>
                           <div className="text-sm text-slate-600 dark:text-slate-300">
                               {uiPage + 1} / {uiPageCount}
                           </div>
                           <Button
                               size="sm"
                               variant="secondary"
                               disabled={uiPage + 1 >= uiPageCount}
                               onClick={() => setUiPage((p) => p + 1)}
                           >
                               التالي
                           </Button>
                       </div>
                   </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                   {(isDesktopFast ? desktopRows : uiRows).map((rowOrProperty: DesktopPropertyPickerItem | العقارات_tbl, idx: number) => (
                       (() => {
                           const desktopItem = isDesktopFast ? (rowOrProperty as DesktopPropertyPickerItem) : null;
                           const p = isDesktopFast ? desktopItem?.property : (rowOrProperty as العقارات_tbl);
                           if (!p) return null;
                           const activeDesktop = isDesktopFast ? desktopItem?.active : null;
                           const activeLegacy = !isDesktopFast ? activeContractByPropertyId.get(String(p.رقم_العقار)) : null;

                           const tenant = activeLegacy?.رقم_المستاجر ? peopleMap.get(String(activeLegacy.رقم_المستاجر)) : undefined;
                           const guarantor = activeLegacy?.رقم_الكفيل ? peopleMap.get(String(activeLegacy.رقم_الكفيل)) : undefined;
                           const hasActive = Boolean(isDesktopFast ? activeDesktop : activeLegacy);

                       const accentIcon = hasActive
                           ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                           : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400';
                       const accentRing = hasActive
                           ? 'ring-2 ring-indigo-500/10 border-indigo-500/20'
                           : '';

                       const ownerColor = getPersonColorClasses(String(p.رقم_المالك ?? ''));

                       const ownerName = isDesktopFast ? String(desktopItem?.ownerName || 'غير معروف') : getOwnerName(p.رقم_المالك);
                       const tenantName = isDesktopFast
                           ? String(activeDesktop?.tenantName || (hasActive ? 'غير معروف' : ''))
                           : String(tenant?.الاسم || '');
                       const tenantPhone = isDesktopFast ? String(activeDesktop?.tenantPhone || '') : String(tenant?.رقم_الهاتف || '');
                       const contractId = isDesktopFast ? String(activeDesktop?.contractId || '') : String(activeLegacy?.رقم_العقد || '');
                       const guarantorName = isDesktopFast ? String(activeDesktop?.guarantorName || '') : String(guarantor?.الاسم || '');
                       const guarantorPhone = isDesktopFast ? String(activeDesktop?.guarantorPhone || '') : String(guarantor?.رقم_الهاتف || '');

                       return (
                   <Card key={p.رقم_العقار || idx} className={`group animate-slide-up ${accentRing}`}>
                       <div className={`h-1 w-full ${ownerColor.stripe}`}></div>
                       <div className="p-5 flex flex-col h-full">
                           <div className="flex justify-between items-start mb-4">
                               <div className="flex items-center gap-3">
                                   <div className={`w-12 h-12 rounded-xl ${accentIcon} flex items-center justify-center font-bold text-xl shadow-sm`}>
                                       <Home size={22} />
                                   </div>
                                   <div>
                                       <h3 className="font-bold text-slate-800 dark:text-white font-mono text-lg">{p.الكود_الداخلي}</h3>
                                       <p className="text-xs text-slate-500">{p.النوع} - {p.المساحة} م²</p>
                                       <div className="mt-1">
                                           {hasActive ? (
                                               <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200 font-bold">
                                                   مرتبط بعقد
                                               </span>
                                           ) : (
                                               <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 font-bold">
                                                   غير مرتبط بعقد
                                               </span>
                                           )}
                                       </div>
                                   </div>
                               </div>
                               <StatusBadge status={p.حالة_العقار} />
                           </div>

                           <div className="space-y-3 mb-5 flex-1">
                               <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                   <MapPin size={16} className="text-slate-400"/>
                                   <span className="min-w-0 whitespace-normal break-words">{p.العنوان}</span>
                               </div>
                               <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                   <span className="font-bold text-slate-500 flex-shrink-0">المالك:</span>
                                   <span className={`inline-block w-2.5 h-2.5 rounded-full ${ownerColor.dot} flex-shrink-0 mt-1`}></span>
                                   <span className="min-w-0 whitespace-normal break-words">{ownerName}</span>
                               </div>

                               <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                   <span className="font-bold text-slate-500 flex-shrink-0">المستأجر:</span>
                                   {hasActive ? (
                                       <div className="min-w-0">
                                           <div className="font-semibold text-slate-700 dark:text-slate-200 whitespace-normal break-words">
                                               {tenantName || 'غير معروف'}
                                           </div>
                                           <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                                               {tenantPhone ? <span className="font-mono dir-ltr">{tenantPhone}</span> : null}
                                               {tenantPhone ? <span>•</span> : null}
                                               {contractId ? <span>عقد #{formatContractNumberShort(contractId)}</span> : null}
                                           </div>
                                       </div>
                                   ) : (
                                       <span className="text-slate-400">—</span>
                                   )}
                               </div>

                               {hasActive && (isDesktopFast ? Boolean(guarantorName) : Boolean(activeLegacy?.رقم_الكفيل)) ? (
                                   <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                       <span className="font-bold text-slate-500 flex-shrink-0">الكفيل:</span>
                                       <div className="min-w-0">
                                           <div className="font-semibold text-slate-700 dark:text-slate-200 whitespace-normal break-words">
                                               {guarantorName || 'غير معروف'}
                                           </div>
                                           {guarantorPhone ? (
                                               <div className="text-xs text-slate-500 mt-0.5 font-mono dir-ltr">
                                                   {guarantorPhone}
                                               </div>
                                           ) : null}
                                       </div>
                                   </div>
                               ) : null}

                               <div className="flex gap-2 mt-2 flex-wrap">
                                   {p.رقم_اشتراك_الكهرباء && (
                                       <span className="text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">
                                           <Zap size={10} /> كهرباء
                                       </span>
                                   )}
                                   {p.رقم_اشتراك_المياه && (
                                       <span className="text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20">
                                           <Droplets size={10} /> مياه
                                       </span>
                                   )}
                                   {p.isForSale && (
                                       <span className="text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 font-bold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20">
                                           <Briefcase size={10} /> {(p as العقارات_tbl & PropertyExtras).isForRent === false ? 'للبيع فقط' : 'للبيع'}
                                       </span>
                                   )}
                               </div>

                               {showDynamicColumns && dynamicFields.length > 0 ? (
                                   (() => {
                                       const values = (p as العقارات_tbl & PropertyExtras)?.حقول_ديناميكية || {};
                                       const visible = dynamicFields
                                           .map((f) => ({ f, v: values?.[f.name] }))
                                           .filter(({ v }) => !isEmptyDynamicValue(v));

                                       if (!visible.length) return null;

                                       return (
                                           <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-950/20 p-3">
                                               <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">حقول إضافية</div>
                                               <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                   {visible.map(({ f, v }) => (
                                                       <div key={f.id} className="text-xs text-slate-600 dark:text-slate-300">
                                                           <span className="font-bold text-slate-500 dark:text-slate-400">{f.label}:</span>{' '}
                                                           <span className="font-semibold text-slate-800 dark:text-white">{formatDynamicValue(f.type, v)}</span>
                                                       </div>
                                                   ))}
                                               </div>
                                           </div>
                                       );
                                   })()
                               ) : null}
                           </div>

                           <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex gap-2">
                               <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 justify-center gap-2 whitespace-nowrap min-w-[140px] rounded-xl shadow-sm"
                                  onClick={() => openPanel('PROPERTY_DETAILS', p.رقم_العقار)}
                                  title="تفاصيل العقار"
                                  aria-label="تفاصيل العقار"
                                  rightIcon={<Eye size={14} className="shrink-0" />}
                                  leftIcon={<ArrowRight size={14} className="shrink-0 opacity-80" />}
                               >
                                   التفاصيل
                               </Button>
                               <RBACGuard requiredPermission="EDIT_PROPERTY">
                                   <Button
                                      size="icon"
                                      variant="ghost"
                                      className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                      onClick={() => quickListForSale(String(p.رقم_العقار))}
                                      title="عرض للبيع"
                                      aria-label="عرض للبيع"
                                    >
                                        <Briefcase size={16} />
                                    </Button>
                                   <Button size="icon" variant="ghost" onClick={() => handleOpenForm(p.رقم_العقار)}><Edit2 size={16} /></Button>
                               </RBACGuard>
                               <RBACGuard requiredPermission="DELETE_PROPERTY">
                                   <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDelete(p.رقم_العقار)}><Trash2 size={16} /></Button>
                               </RBACGuard>
                           </div>
                       </div>
                   </Card>
                       );
                   })()
               ))}
           </div>
           </>
       )}
    </div>
  );
};

