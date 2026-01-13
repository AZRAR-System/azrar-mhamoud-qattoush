
import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Home, MapPin, Filter, Plus, ChevronDown, Check, Building2, Layers, Hash } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { العقارات_tbl, الأشخاص_tbl, العقود_tbl } from '@/types';
import { useToast } from '@/context/ToastContext';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getTenancyStatusScore, isTenancyRelevant } from '@/utils/tenancy';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { domainGetSmart, propertyPickerSearchPagedSmart } from '@/services/domainQueries';
import { storage } from '@/services/storage';

interface PropertyPickerProps {
  label?: string;
  value?: string;
  onChange: (propertyId: string, propertyObj?: العقارات_tbl) => void;
  required?: boolean;
  filterStatus?: string; // Optional: Force show only 'Vacant' etc.
  placeholder?: string;
  disabled?: boolean;
}

export const PropertyPicker: React.FC<PropertyPickerProps> = ({
  label,
  value,
  onChange,
  required = false,
  filterStatus,
  placeholder = "اختر العقار...",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<العقارات_tbl | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [pickerRows, setPickerRows] = useState<Array<{ property: any; ownerName?: string; active?: any }>>([]);
  const [pickerTotal, setPickerTotal] = useState(0);
  const [pickerOffset, setPickerOffset] = useState(0);
  const pickerLimit = 60;
  
  // Legacy data (web / non-desktop fallback)
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [peopleMap, setPeopleMap] = useState<Map<string, الأشخاص_tbl>>(new Map());
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>(filterStatus || '');
  const [sortConfig, setSortConfig] = useState<{ key: keyof العقارات_tbl; direction: 'asc' | 'desc' } | null>(null);

  const toast = useToast();

  const isDesktop = typeof window !== 'undefined' && storage.isDesktop() && !!(window as any)?.desktopDb;
  const canDomainGet = isDesktop && !!(window as any)?.desktopDb?.domainGet;
  // Desktop-fast: use specialized SQL picker only.
  const useSqlRows = isDesktop && !!(window as any)?.desktopDb?.domainPropertyPickerSearch;
  const desktopUnsupported = isDesktop && !useSqlRows;

  // Load selected property (avoid loading full arrays on Desktop)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!value) {
        if (alive) setSelectedProperty(null);
        return;
      }
      // Desktop focus: never fall back to legacy full-array scans inside Desktop.
      if (isDesktop && !canDomainGet) {
        if (alive) setSelectedProperty(null);
        return;
      }
      const p = (await domainGetSmart('properties', value)) as any;
      if (!alive) return;
      setSelectedProperty((p as العقارات_tbl) || null);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [value, isDesktop, canDomainGet]);

  const loadDataLegacy = () => {
    const props = DbService.getProperties();
    const peeps = DbService.getPeople();
    const conts = DbService.getContracts();

    const pMap = new Map<string, الأشخاص_tbl>();
    peeps.forEach(p => pMap.set(p.رقم_الشخص, p));

    setProperties(props);
    setPeopleMap(pMap);
    setContracts(conts);
  };

  const loadPickerRows = async (q: string, opts?: { append?: boolean }) => {
    setIsLoading(true);
    try {
      const append = !!opts?.append;
      const nextOffset = append ? pickerOffset : 0;

      const res = await propertyPickerSearchPagedSmart({
        query: q,
        status: activeStatusFilter,
        type: activeTypeFilter,
        forceVacant: filterStatus === 'شاغر',
        offset: nextOffset,
        limit: pickerLimit,
      } as any);

      const items = Array.isArray(res?.items) ? res.items : [];
      const total = Number((res as any)?.total || 0) || 0;

      setPickerTotal(total);
      if (append) {
        setPickerRows((prev) => [...prev, ...items]);
        setPickerOffset(nextOffset + items.length);
      } else {
        setPickerRows(items);
        setPickerOffset(items.length);
      }
    } finally {
      setIsLoading(false);
    }
  };

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

        const a = String(prev.تاريخ_البداية || '');
        const b = String(c.تاريخ_البداية || '');
        if (b.localeCompare(a) > 0) m.set(key, c);
      }
      return m;
  }, [contracts]);

  const handleOpen = () => {
    if (disabled) return;
    // Desktop focus: never load full arrays in renderer.
    // If the SQL picker endpoint isn't available, open the modal but show an unsupported message.
    if (desktopUnsupported) {
      setProperties([]);
      setPeopleMap(new Map());
      setContracts([]);
      toast.warning('قائمة العقارات السريعة غير متاحة على الديسكتوب حالياً');
    } else if (!useSqlRows) {
      loadDataLegacy();
    }
    setSearchTerm('');
    setPickerOffset(0);
    setPickerTotal(0);
    setIsOpen(true);
    if (useSqlRows) void loadPickerRows('', { append: false });
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!useSqlRows) return;
    let alive = true;
    const t = setTimeout(async () => {
      if (!alive) return;
      setPickerOffset(0);
      await loadPickerRows(searchTerm, { append: false });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchTerm, activeStatusFilter, activeTypeFilter, filterStatus]);

  const canLoadMoreSql = useMemo(() => {
    if (!useSqlRows) return false;
    if (isLoading) return false;
    if (pickerTotal <= 0) return false;
    return pickerRows.length < pickerTotal;
  }, [useSqlRows, isLoading, pickerRows.length, pickerTotal]);

  const handleLoadMoreSql = async () => {
    if (!useSqlRows) return;
    if (!canLoadMoreSql) return;
    await loadPickerRows(searchTerm, { append: true });
  };

  // --- Filtering Logic (Legacy) ---
  const filteredProperties = useMemo(() => {
    let result = properties;

    // 0. Exclude properties with active contracts (when creating new contract)
    if (filterStatus === 'شاغر') {
            const activePropertyIds = new Set(
                contracts
            .filter(c => isTenancyRelevant(c))
          .map(c => c.رقم_العقار)
      );
      result = result.filter(p => !activePropertyIds.has(p.رقم_العقار));
    }

    // 1. Status Filter
    if (activeStatusFilter) {
        result = result.filter(p => p.حالة_العقار === activeStatusFilter);
    }

    // 2. Type Filter
    if (activeTypeFilter) {
        result = result.filter(p => p.النوع === activeTypeFilter);
    }

    // 3. Smart Search (Multi-field)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => {
        const ownerName = peopleMap.get(p.رقم_المالك)?.الاسم.toLowerCase() || '';
        
        return (
          p.الكود_الداخلي.toLowerCase().includes(term) || // Internal Code (Priority)
          ownerName.includes(term) || // Owner Name
          (p.رقم_قطعة && p.رقم_قطعة.includes(term)) || // Plot
          (p.رقم_لوحة && p.رقم_لوحة.includes(term)) || // Plate
          (p.رقم_شقة && p.رقم_شقة.includes(term)) || // Apt
          (p.العنوان && p.العنوان.includes(term))
        );
      });
    }

    // 4. Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
    }, [properties, contracts, searchTerm, activeStatusFilter, activeTypeFilter, sortConfig, peopleMap]);

  const filteredPickerRows = useMemo(() => {
    if (!useSqlRows) return [];
    // Desktop path already applies search/status/type/vacant server-side; keep a light extra filter.
    let rows = pickerRows;
    if (sortConfig) {
      const key = sortConfig.key;
      const dir = sortConfig.direction;
      rows = [...rows].sort((a, b) => {
        const ap = a.property as any;
        const bp = b.property as any;
        const av = ap?.[key];
        const bv = bp?.[key];
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return rows;
  }, [pickerRows, sortConfig, useSqlRows]);

  const sqlRowByPropertyId = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of filteredPickerRows) {
      const pid = String((r as any)?.property?.رقم_العقار || '');
      if (pid) m.set(pid, r);
    }
    return m;
  }, [filteredPickerRows]);

  const handleSelect = (property: العقارات_tbl) => {
    setSelectedProperty(property);
    onChange(property.رقم_العقار, property);
    setIsOpen(false);
    toast.success(`تم اختيار العقار: ${property.الكود_الداخلي}`);
  };

  const handleSort = (key: keyof العقارات_tbl) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- Render Helpers ---
  const getOwnerName = (id: string) => peopleMap.get(id)?.الاسم || 'غير معروف';
  const getTenantName = (id: string) => peopleMap.get(id)?.الاسم || 'غير معروف';
  const getGuarantorName = (id: string) => peopleMap.get(id)?.الاسم || 'غير معروف';
    const contractIdLabel = (id: unknown) => {
      const s = String(id || '');
      if (!s) return '';
      return formatContractNumberShort(s);
    };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger Input */}
      <div 
        onClick={handleOpen}
        className={`
            relative w-full bg-white dark:bg-slate-900 border text-sm rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all hover:border-indigo-400/70 group
            ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60' : ''}
            ${value ? 'border-indigo-200/70 dark:border-slate-700' : 'border-slate-200/80 dark:border-slate-700'}
        `}
      >
        <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg ${selectedProperty ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500'}`}>
                <Home size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`font-bold whitespace-normal break-words ${selectedProperty ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                    {selectedProperty ? `${selectedProperty.الكود_الداخلي} - ${selectedProperty.النوع}` : placeholder}
                </span>
                {selectedProperty && (
                <span className="text-[10px] text-slate-500 flex items-start gap-2 flex-wrap">
                  <span className="min-w-0 whitespace-normal break-words">{selectedProperty.العنوان}</span>
                        <StatusBadge status={selectedProperty.حالة_العقار} className="scale-75 origin-right"/>
                    </span>
                )}
            </div>
        </div>
        <ChevronDown size={16} className="text-slate-400 group-hover:text-indigo-500 transition" />
      </div>

      {/* MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 ring-1 ring-black/5 dark:ring-white/5 flex flex-col animate-scale-up overflow-hidden">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-600/20">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">اختيار عقار</h3>
                            <p className="text-xs text-slate-500">ابحث واختر العقار المناسب للعملية</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 rounded-full transition text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="p-4 space-y-4 bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="بحث: الكود، اسم المالك، رقم القطعة، الحوض..." 
                        className="w-full pl-4 pr-12 py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute right-4 top-3 text-gray-400" size={20} />
                        </div>
                        
                        <div className="flex gap-2">
                            <select 
                              className="px-4 py-2 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950"
                                value={activeStatusFilter}
                                onChange={e => setActiveStatusFilter(e.target.value)}
                                disabled={!!filterStatus} // Disable if forced
                            >
                                <option value="">كل الحالات</option>
                                <option value="شاغر">شاغر</option>
                                <option value="مؤجر">مؤجر</option>
                                <option value="معروض للبيع">معروض للبيع</option>
                                <option value="تحت الصيانة">تحت الصيانة</option>
                            </select>

                            <select 
                              className="px-4 py-2 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950"
                                value={activeTypeFilter}
                                onChange={e => setActiveTypeFilter(e.target.value)}
                            >
                                <option value="">كل الأنواع</option>
                                <option value="شقة">شقة</option>
                                <option value="محل تجاري">محل تجاري</option>
                                <option value="مكتب">مكتب</option>
                                <option value="فيلا">فيلا</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto bg-slate-50/60 dark:bg-slate-950/20 custom-scrollbar">
                    <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-100/70 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300 text-xs font-bold sticky top-0 z-10 shadow-sm">
                            <tr>
                        <th className="p-4 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('الكود_الداخلي')}>الكود</th>
                                <th className="p-4">المالك</th>
                                <th className="p-4 hidden lg:table-cell">المستأجر</th>
                                <th className="p-4">النوع / المساحة</th>
                                <th className="p-4">العنوان</th>
                                <th className="p-4 hidden md:table-cell">تفاصيل التسجيل</th>
                        <th className="p-4 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('حالة_العقار')}>الحالة</th>
                                <th className="p-4 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                          {desktopUnsupported ? (
                            <tr>
                              <td colSpan={8} className="p-10 text-center text-slate-500">
                                <div className="flex flex-col items-center">
                                  <Search size={44} className="mb-4 opacity-20" />
                                  <p className="font-bold text-slate-700 dark:text-slate-200">غير مدعوم في وضع الديسكتوب الحالي</p>
                                  <p className="text-xs mt-2 text-slate-500">
                                    يرجى تشغيل وضع السرعة/SQL أو تحديث نسخة الديسكتوب لتفعيل البحث.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          {useSqlRows && isLoading ? (
                            <tr>
                              <td colSpan={8} className="p-6 text-center text-slate-500">
                                جاري التحميل...
                              </td>
                            </tr>
                          ) : (!desktopUnsupported && (useSqlRows ? filteredPickerRows.length === 0 : filteredProperties.length === 0)) ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center">
                                            <Search size={48} className="mb-4 opacity-20"/>
                                            <p>لا توجد عقارات مطابقة للبحث</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                            // Prefer SQL-backed rows on Desktop; fallback to legacy list on web.
                                (desktopUnsupported ? [] : (useSqlRows ? filteredPickerRows.map(row => row.property as العقارات_tbl) : filteredProperties)).map(p => (
                                    (() => {
                                const sqlRow = useSqlRows ? (sqlRowByPropertyId.get(String((p as any)?.رقم_العقار)) as any) : null;
                                const sqlActive = sqlRow?.active as any;

                                      const activeC = sqlActive?.contractId
                                        ? ({
                                            رقم_العقد: String(sqlActive.contractId),
                                            رقم_المستاجر: '',
                                            رقم_الكفيل: '',
                                            حالة_العقد: String(sqlActive.status || ''),
                                            تاريخ_البداية: String(sqlActive.startDate || ''),
                                            تاريخ_النهاية: String(sqlActive.endDate || ''),
                                        } as any)
                                        : activeContractByPropertyId.get(String(p.رقم_العقار));
                                      const hasActive = Boolean(activeC);
                                      const tenant = sqlActive?.tenantName
                                        ? ({ الاسم: sqlActive.tenantName, رقم_الهاتف: sqlActive.tenantPhone } as any)
                                        : activeC?.رقم_المستاجر
                                          ? peopleMap.get(String(activeC.رقم_المستاجر))
                                          : undefined;
                                const guarantor = sqlActive?.guarantorName
                                ? ({ الاسم: sqlActive.guarantorName, رقم_الهاتف: sqlActive.guarantorPhone } as any)
                                : (activeC as any)?.رقم_الكفيل
                                  ? peopleMap.get(String((activeC as any).رقم_الكفيل))
                                  : undefined;
                                      const rowAccent = hasActive
                                          ? 'border-r-4 border-indigo-400/70'
                                          : '';

                                      return (
                                    <tr 
                                        key={p.رقم_العقار} 
                                        onClick={() => handleSelect(p)}
                                      className={`group bg-white dark:bg-slate-900 hover:bg-indigo-50/70 dark:hover:bg-indigo-500/10 cursor-pointer transition ${rowAccent}
                                        ${value === p.رقم_العقار ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : ''}
                                        `}
                                    >
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800 dark:text-white font-mono text-sm">{p.الكود_الداخلي}</div>
                                            {p.رقم_شقة && <div className="text-[10px] text-slate-500">شقة: {p.رقم_شقة}</div>}
                                        </td>
                                        <td className="p-4">
                                          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{sqlRow?.ownerName || getOwnerName(p.رقم_المالك)}</div>
                                        </td>
                                        <td className="p-4 hidden lg:table-cell">
                                            {hasActive ? (
                                              <div className="text-xs text-slate-700 dark:text-slate-200">
                                                <div className="font-semibold whitespace-normal break-words">{tenant?.الاسم || getTenantName(String(activeC!.رقم_المستاجر))}</div>
                                                {tenant?.رقم_الهاتف ? (
                                                  <div className="text-[10px] text-slate-500 dir-ltr whitespace-normal break-words">{tenant.رقم_الهاتف} • عقد #{contractIdLabel(activeC!.رقم_العقد)}</div>
                                                ) : (
                                                  <div className="text-[10px] text-slate-500 whitespace-normal break-words">عقد #{contractIdLabel(activeC!.رقم_العقد)}</div>
                                                )}
                                                {(sqlActive?.guarantorName || (activeC as any)?.رقم_الكفيل) ? (
                                                  <div className="text-[10px] text-slate-500 whitespace-normal break-words">
                                                    كفيل: {(guarantor as any)?.الاسم || getGuarantorName(String((activeC as any).رقم_الكفيل))}{guarantor?.رقم_الهاتف ? ` • ${guarantor.رقم_الهاتف}` : ''}
                                                  </div>
                                                ) : null}
                                              </div>
                                            ) : (
                                              <div className="text-xs text-slate-400">—</div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{p.النوع}</span>
                                                <span className="text-xs opacity-70">{p.المساحة} م²</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                          <div className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-1">
                                            <MapPin size={12} className="flex-shrink-0 mt-0.5"/> <span className="min-w-0 whitespace-normal break-words">{p.العنوان}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 hidden md:table-cell">
                                            <div className="flex flex-col text-[10px] text-slate-500 gap-1">
                                                {p.اسم_الحوض && <span>حوض: {p.اسم_الحوض}</span>}
                                                {p.رقم_قطعة && <span>قطعة: {p.رقم_قطعة}</span>}
                                                {p.رقم_لوحة && <span>لوحة: {p.رقم_لوحة}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <StatusBadge status={p.حالة_العقار} />
                                        </td>
                                        <td className="p-4 text-center">
                                            {value === p.رقم_العقار ? (
                                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                                    <Check size={16} />
                                                </div>
                                            ) : (
                                            <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 group-hover:border-indigo-400/70 transition"></div>
                                            )}
                                        </td>
                                    </tr>
                                      );
                                    })()
                                ))
                            )}
                        </tbody>
                    </table>

                    {useSqlRows && (canLoadMoreSql || pickerTotal > 0) ? (
                      <div className="p-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <div>
                          المعروض: {pickerRows.length} / {pickerTotal || pickerRows.length}
                        </div>
                        <button
                          type="button"
                          disabled={!canLoadMoreSql}
                          onClick={handleLoadMoreSql}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition
                            ${canLoadMoreSql ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10' : 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500 cursor-not-allowed'}
                          `}
                        >
                          تحميل المزيد
                        </button>
                      </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
                    <div className="text-xs text-slate-500">
                  العدد الإجمالي: {useSqlRows ? (pickerTotal || filteredPickerRows.length) : filteredProperties.length} عقار
                    </div>
                  <button className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:underline">
                        <Plus size={16}/> إضافة عقار جديد (قريباً)
                    </button>
                </div>

            </div>
        </div>
      )}
    </div>
  );
};
