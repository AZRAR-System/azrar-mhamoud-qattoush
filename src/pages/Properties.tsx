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
import { MapPin, Edit2, Trash2, Home, Eye, Zap, Droplets, Briefcase, SlidersHorizontal, Download } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { exportToXlsx, readSpreadsheet } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DS } from '@/constants/designSystem';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchEngine, FilterRule } from '@/services/searchEngine';
import { getTenancyStatusScore, isTenancyRelevant } from '@/utils/tenancy';
import { formatDynamicValue, isEmptyDynamicValue } from '@/components/dynamic/dynamicValue';
import { getPersonColorClasses } from '@/utils/personColor';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { useDbSignal } from '@/hooks/useDbSignal';
import { propertyPickerSearchPagedSmart, domainCountsSmart } from '@/services/domainQueries';

const PAGE_SIZE = 48;

export const Properties: React.FC = () => {
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
    const [contracts, setContracts] = useState<العقود_tbl[]>([]);
    const [people, setPeople] = useState<الأشخاص_tbl[]>([]);

                const isDesktop = typeof window !== 'undefined' && !!(window as any)?.desktopDb;
                const isDesktopFast = isDesktop && !!(window as any)?.desktopDb?.domainPropertyPickerSearch;
                const desktopUnsupported = isDesktop && !isDesktopFast;

                const warnedUnsupportedRef = useRef(false);

        const [desktopRows, setDesktopRows] = useState<any[]>([]);
        const [desktopTotal, setDesktopTotal] = useState(0);
        const [desktopPage, setDesktopPage] = useState(0);
        const [desktopLoading, setDesktopLoading] = useState(false);
        const [desktopCounts, setDesktopCounts] = useState<{ people: number; properties: number; contracts: number } | null>(null);

        const importRef = useRef<HTMLInputElement>(null);

    const [showDynamicColumns, setShowDynamicColumns] = useState(false);
    const [dynamicFields, setDynamicFields] = useState<DynamicFormField[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ status: '', type: '', furnishing: '', sale: '' });
        const [occupancy, setOccupancy] = useState<'all' | 'rented' | 'vacant'>('all');
  
  // Advanced Filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters, setAdvFilters] = useState({
      minArea: '', maxArea: '',
      minPrice: '', maxPrice: '',
      floor: ''
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
                    setOccupancy(occ as any);
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

  useEffect(() => {
    void loadData();
    }, [dbSignal]);

  const loadData = async () => {
      if (isDesktopFast) {
          setDesktopLoading(true);
          try {
              const counts = await domainCountsSmart();
              setDesktopCounts(counts);

              const res = await propertyPickerSearchPagedSmart({
                  query: String(searchTerm || ''),
                  status: String(filters.status || ''),
                  type: String(filters.type || ''),
                  offset: desktopPage * PAGE_SIZE,
                  limit: PAGE_SIZE,
                  occupancy,
                  sale: (filters.sale as any) || '',
              });
              setDesktopRows(Array.isArray(res.items) ? res.items : []);
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
  };

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
        if (showAdvanced) {
            toast.warning('التصفية المتقدمة غير مدعومة في وضع السرعة حالياً');
            setShowAdvanced(false);
            setAdvFilters({ minArea: '', maxArea: '', minPrice: '', maxPrice: '', floor: '' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAdvanced, isDesktopFast]);

    useEffect(() => {
        if (!isDesktopFast) return;
        // Reset to first page on query/filter changes.
        if (desktopPage !== 0) {
            setDesktopPage(0);
        } else {
            void loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, filters.status, filters.type, filters.sale, occupancy, isDesktopFast]);

    useEffect(() => {
        if (!isDesktopFast) return;
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [desktopPage, isDesktopFast]);

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

    const normalize = (v: any) => String(v ?? '').trim().toLowerCase();

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
            const guarantorName = (currentContract as any)?.رقم_الكفيل
                ? normalize(peopleMap.get(String((currentContract as any).رقم_الكفيل))?.الاسم)
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
          const matchFurnishing = filters.furnishing ? String((p as any).نوع_التاثيث || '') === filters.furnishing : true;
          const matchSale = filters.sale
              ? (filters.sale === 'for-sale' ? !!p.isForSale : !p.isForSale)
              : true;
          const isRented = typeof (p as any).IsRented === 'boolean'
              ? (p as any).IsRented
              : String((p as any).حالة_العقار || '').trim() === 'مؤجر';
          const matchOccupancy = occupancy === 'all'
              ? true
              : occupancy === 'rented'
                  ? isRented === true
                  : isRented === false;

          return matchSearch && matchStatus && matchType && matchFurnishing && matchSale && matchOccupancy;
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
          result = SearchEngine.applyFilters(result, rules);
      }

      return result;
    }, [properties, searchTerm, filters, showAdvanced, advFilters, propertySearchIndex, occupancy]);

    const desktopPageCount = isDesktopFast ? Math.max(1, Math.ceil(desktopTotal / PAGE_SIZE)) : 1;

    const uniqueStrings = (values: any[]) => {
        const s = new Set<string>();
        for (const v of values) {
            const str = String(v ?? '').trim();
            if (str) s.add(str);
        }
        return Array.from(s);
    };

    const lookupLabels = (category: string) => {
        try {
            return (DbService.getLookupsByCategory(category) || []).map((x: any) => x.label).filter(Boolean);
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

    const normalizeKey = (v: any) => String(v ?? '').trim().toLowerCase();

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

          let rows: Array<Record<string, any>> = [];
          try {
              rows = await readSpreadsheet(file);
          } catch (e: any) {
              toast.error(e?.message || 'فشل قراءة ملف الاستيراد');
              return;
          }
          if (!rows.length) {
              toast.warning('الملف فارغ');
              return;
          }

          const pick = (row: Record<string, any>, keys: string[]) => {
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
              const nid = normalizeKey((p as any).الرقم_الوطني);
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
                      حالة_العقار: status as any,
                      IsRented: isRented,
                      المساحة: area,
                      العنوان: address,
                      المدينة: city || undefined,
                      المنطقة: region || undefined,
                      رقم_قطعة: plotNo || undefined,
                      رقم_لوحة: plateNo || undefined,
                      رقم_شقة: aptNo || undefined,
                      ملاحظات: notes || undefined,
                  } as any);
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
                      حالة_العقار: status as any,
                      الإيجار_التقديري: undefined,
                      IsRented: isRented,
                      المساحة: area,
                      رقم_قطعة: plotNo || undefined,
                      رقم_لوحة: plateNo || undefined,
                      رقم_شقة: aptNo || undefined,
                      ملاحظات: notes || undefined,
                  } as any);
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
      [toast]
  );

    const handleExport = async () => {
          if (isDesktopFast) {
              if (desktopTotal === 0) return toast.warning('لا توجد بيانات للتصدير');

              const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());

              const allItems: any[] = [];
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
                      sale: (filters.sale as any) || '',
                  });
                  const items = Array.isArray(res.items) ? res.items : [];
                  if (!items.length) break;
                  allItems.push(...items);
                  offset += items.length;
                  if (items.length < limit) break;
              }

              const rows = allItems.map((it) => {
                  const p = (it?.property || {}) as any;
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
              OwnerNationalID: (owner as any)?.الرقم_الوطني || '',
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

      const typeFromData = uniqueStrings(properties.map(p => (p as any).النوع));
      const statusFromData = uniqueStrings(properties.map(p => (p as any).حالة_العقار));
      const furnishingFromData = uniqueStrings(properties.map(p => (p as any).نوع_التاثيث));

      const typeOptions = uniqueStrings([...typeFromLookups, ...typeFromData]).map(v => ({ value: v, label: v }));
      const statusOptions = uniqueStrings([...statusFromLookups, ...statusFromData]).map(v => ({ value: v, label: v }));
      const furnishingOptions = uniqueStrings([...furnishingFromLookups, ...furnishingFromData]).map(v => ({ value: v, label: v }));

      return [
          { key: 'type', label: 'النوع', options: typeOptions },
          { key: 'status', label: 'الحالة', options: statusOptions },
          ...(isDesktopFast
              ? ([] as any[])
              : [{ key: 'furnishing', label: 'صفة العقار', options: furnishingOptions }]),
          {
              key: 'sale',
              label: 'البيع',
              options: [
                  { value: 'for-sale', label: 'للبيع فقط' },
                  { value: 'not-for-sale', label: 'ليس للبيع' },
              ],
          },
      ];
  }, [properties, isDesktopFast]);

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
              <>
                <Button
                    variant="secondary"
                    onClick={() => {
                        if (isDesktopFast) {
                            toast.warning('التصفية المتقدمة غير مدعومة في وضع السرعة حالياً');
                            return;
                        }
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
                    <Button variant="secondary" onClick={handlePickImportFile} leftIcon={<Download size={18}/>}>استيراد</Button>
                </RBACGuard>
                <Button variant="secondary" onClick={handleExport} leftIcon={<Download size={18}/> } />
              </>
          }
       />

       {/* Advanced Search Panel */}
       {showAdvanced && (
           <Card className="p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up bg-indigo-50/50 dark:bg-slate-800/50 border-indigo-100 dark:border-slate-700">
               <input 
                   type="number" placeholder="المساحة (من)" 
                   className="p-2 rounded-lg border text-sm" 
                   value={advFilters.minArea} onChange={e => setAdvFilters({...advFilters, minArea: e.target.value})}
               />
               <input 
                   type="number" placeholder="المساحة (إلى)" 
                   className="p-2 rounded-lg border text-sm" 
                   value={advFilters.maxArea} onChange={e => setAdvFilters({...advFilters, maxArea: e.target.value})}
               />
               <input 
                   type="number" placeholder="السعر (من)" 
                   className="p-2 rounded-lg border text-sm" 
                   value={advFilters.minPrice} onChange={e => setAdvFilters({...advFilters, minPrice: e.target.value})}
               />
               <input 
                   type="number" placeholder="السعر (إلى)" 
                   className="p-2 rounded-lg border text-sm" 
                   value={advFilters.maxPrice} onChange={e => setAdvFilters({...advFilters, maxPrice: e.target.value})}
               />
               <input 
                   type="text" placeholder="الطابق" 
                   className="p-2 rounded-lg border text-sm" 
                   value={advFilters.floor} onChange={e => setAdvFilters({...advFilters, floor: e.target.value})}
               />
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
                   setFilters({ status: '', type: '', furnishing: '', sale: '' });
                   setShowAdvanced(false);
                   setAdvFilters({ minArea: '', maxArea: '', minPrice: '', maxPrice: '', floor: '' });
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
                               onClick={() => setDesktopPage((p) => Math.max(0, p - 1))}
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
                               onClick={() => setDesktopPage((p) => p + 1)}
                           >
                               التالي
                           </Button>
                       </div>
                   </div>
               ) : null}

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                   {(isDesktopFast ? desktopRows : filteredProperties).map((rowOrProperty: any, idx: number) => (
                       (() => {
                           const desktopItem = isDesktopFast ? rowOrProperty : null;
                           const p = isDesktopFast ? desktopItem?.property : rowOrProperty;
                           if (!p) return null;
                           const activeC = isDesktopFast ? desktopItem?.active : activeContractByPropertyId.get(String(p.رقم_العقار));
                           const tenant = !isDesktopFast && activeC?.رقم_المستاجر ? peopleMap.get(String(activeC.رقم_المستاجر)) : undefined;
                           const guarantor = !isDesktopFast && activeC?.رقم_الكفيل ? peopleMap.get(String(activeC.رقم_الكفيل)) : undefined;
                           const hasActive = Boolean(activeC);

                       const accentIcon = hasActive
                           ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                           : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400';
                       const accentRing = hasActive
                           ? 'ring-2 ring-indigo-500/10 border-indigo-500/20'
                           : '';

                       const ownerColor = getPersonColorClasses(String(p.رقم_المالك ?? ''));

                       const ownerName = isDesktopFast ? String(desktopItem?.ownerName || 'غير معروف') : getOwnerName(p.رقم_المالك);
                       const tenantName = isDesktopFast ? String(activeC?.tenantName || (hasActive ? 'غير معروف' : '')) : String(tenant?.الاسم || '');
                       const tenantPhone = isDesktopFast ? String(activeC?.tenantPhone || '') : String(tenant?.رقم_الهاتف || '');
                       const contractId = isDesktopFast ? String(activeC?.contractId || '') : String(activeC?.رقم_العقد || '');
                       const guarantorName = isDesktopFast ? String(activeC?.guarantorName || '') : String(guarantor?.الاسم || '');
                       const guarantorPhone = isDesktopFast ? String(activeC?.guarantorPhone || '') : String(guarantor?.رقم_الهاتف || '');

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

                               {hasActive && (isDesktopFast ? Boolean(guarantorName) : Boolean(activeC?.رقم_الكفيل)) ? (
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
                                   {p.رقم_اشتراك_الكهرباء && <span className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200 flex items-center gap-1"><Zap size={10}/> كهرباء</span>}
                                   {p.رقم_اشتراك_المياه && <span className="text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-200 flex items-center gap-1"><Droplets size={10}/> مياه</span>}
                                   {p.isForSale && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1 font-bold"><Briefcase size={10}/> للبيع</span>}
                               </div>

                               {showDynamicColumns && dynamicFields.length > 0 ? (
                                   (() => {
                                       const values = (p as any)?.حقول_ديناميكية || {};
                                       const visible = dynamicFields
                                           .map((f) => ({ f, v: values?.[f.name] }))
                                           .filter(({ v }) => !isEmptyDynamicValue(v));

                                       if (!visible.length) return null;

                                       return (
                                           <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
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
                                  variant="secondary"
                                  className="flex-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50"
                                  onClick={() => openPanel('PROPERTY_DETAILS', p.رقم_العقار)}
                                  leftIcon={<Eye size={14} />}
                               >
                                   التفاصيل
                               </Button>
                               <RBACGuard requiredPermission="EDIT_PROPERTY">
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

