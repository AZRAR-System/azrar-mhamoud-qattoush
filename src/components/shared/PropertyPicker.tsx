
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Home, MapPin, Plus, ChevronDown, Check, Building2, Filter } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { العقارات_tbl, الأشخاص_tbl, العقود_tbl, تذاكر_الصيانة_tbl, سجل_الملكية_tbl } from '@/types';
import type { PropertyPickerItem } from '@/types/domain.types';
import { useToast } from '@/context/ToastContext';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AppModal } from '@/components/ui/AppModal';
import { getTenancyStatusScore, isTenancyRelevant } from '@/utils/tenancy';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { domainGetSmart, propertyPickerSearchPagedSmart } from '@/services/domainQueries';
import { storage } from '@/services/storage';

type PickerRow = Omit<PropertyPickerItem, 'active'> & { active?: unknown };

type ActiveContractLike = {
  contractId: string;
  tenantId?: string;
  guarantorId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const asTrimmedString = (value: unknown): string => asString(value).trim();

const getRecordProp = (record: Record<string, unknown> | null, key: string): unknown => (record ? record[key] : undefined);

interface PropertyPickerProps {
  label?: string;
  value?: string;
  onChange: (propertyId: string, propertyObj?: العقارات_tbl) => void;
  required?: boolean;
  filterStatus?: string; // Optional: Force show only 'Vacant' etc.
  defaultLinkedOnly?: boolean; // Optional: default state for "مرتبطة فقط" filter when opening the picker.
  purpose?: 'any' | 'rent'; // Optional: exclude sale-only properties in rent workflows.
  placeholder?: string;
  disabled?: boolean;
}

export const PropertyPicker: React.FC<PropertyPickerProps> = ({
  label,
  value,
  onChange,
  required = false,
  filterStatus,
  defaultLinkedOnly = true,
  purpose = 'any',
  placeholder = "اختر العقار...",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<العقارات_tbl | null>(null);

  const modalSearchInputId = useId();

  const isRtl = typeof document !== 'undefined' && document?.documentElement?.dir === 'rtl';

  const [isLoading, setIsLoading] = useState(false);
  const [pickerRows, setPickerRows] = useState<PickerRow[]>([]);
  const [pickerTotal, setPickerTotal] = useState(0);
  const [pickerOffset, setPickerOffset] = useState(0);
  const pickerOffsetRef = useRef(0);
  const pickerLimit = 60;
  
  // Legacy data (web / non-desktop fallback)
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [peopleMap, setPeopleMap] = useState<Map<string, الأشخاص_tbl>>(new Map());
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<تذاكر_الصيانة_tbl[]>([]);
  const [ownershipHistory, setOwnershipHistory] = useState<سجل_الملكية_tbl[]>([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>(filterStatus || '');
  const [sortConfig, setSortConfig] = useState<{ key: keyof العقارات_tbl; direction: 'asc' | 'desc' } | null>(null);
  const [linkedOnly, setLinkedOnly] = useState(defaultLinkedOnly);
  const [listingMode, setListingMode] = useState<'all' | 'sale' | 'rent'>('all');

  const toast = useToast();

  const formatArea = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return '';
    // Keep it compact and consistent
    return String(Math.round(n));
  };

  const isDesktop = typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb;
  const canDomainGet = isDesktop && typeof window.desktopDb?.domainGet === 'function';
  // Desktop-fast: use specialized SQL picker only.
  const useSqlRows = isDesktop && typeof window.desktopDb?.domainPropertyPickerSearch === 'function';
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
      const p = await domainGetSmart('properties', value);
      if (!alive) return;
      setSelectedProperty(p || null);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [value, isDesktop, canDomainGet]);

  useEffect(() => {
    pickerOffsetRef.current = pickerOffset;
  }, [pickerOffset]);

  const loadDataLegacy = () => {
    const props = DbService.getProperties();
    const peeps = DbService.getPeople();
    const conts = DbService.getContracts();
    const tickets = (DbService.getMaintenanceTickets?.() || []) as تذاكر_الصيانة_tbl[];
    const ownership = (DbService.getOwnershipHistory?.() || []) as سجل_الملكية_tbl[];

    const pMap = new Map<string, الأشخاص_tbl>();
    peeps.forEach(p => pMap.set(p.رقم_الشخص, p));

    setProperties(props);
    setPeopleMap(pMap);
    setContracts(conts);
    setMaintenanceTickets(Array.isArray(tickets) ? tickets : []);
    setOwnershipHistory(Array.isArray(ownership) ? ownership : []);
  };

  const legacyLinkedPropertyIds = useMemo(() => {
    const ids = new Set<string>();

    for (const p of properties) {
      const pid = String(p.رقم_العقار || '').trim();
      if (!pid) continue;
      if (String(p.رقم_المالك || '').trim()) ids.add(pid);
      if (p.isForSale) ids.add(pid);
    }

    for (const c of contracts) {
      if (!c?.رقم_العقار) continue;
      if (!isTenancyRelevant(c)) continue;
      ids.add(String(c.رقم_العقار));
    }

    for (const t of maintenanceTickets) {
      const pid = String(t.رقم_العقار || '').trim();
      if (pid) ids.add(pid);
    }

    for (const h of ownershipHistory) {
      const pid = String(h.رقم_العقار || '').trim();
      if (pid) ids.add(pid);
    }

    return ids;
  }, [properties, contracts, maintenanceTickets, ownershipHistory]);

  const loadPickerRows = useCallback(
    async (q: string, opts?: { append?: boolean }) => {
      setIsLoading(true);
      try {
        const append = !!opts?.append;
        const nextOffset = append ? pickerOffsetRef.current : 0;

        const res = await propertyPickerSearchPagedSmart({
          query: q,
          status: activeStatusFilter,
          type: activeTypeFilter,
          forceVacant: filterStatus === 'شاغر',
          offset: nextOffset,
          limit: pickerLimit,
        });

        const items: PickerRow[] = Array.isArray(res.items) ? (res.items as PickerRow[]) : [];
        const total = Number(res.total || 0) || 0;

        setPickerTotal(total);
        if (append) {
          setPickerRows((prev) => [...prev, ...items]);
          const newOffset = nextOffset + items.length;
          setPickerOffset(newOffset);
          pickerOffsetRef.current = newOffset;
        } else {
          setPickerRows(items);
          setPickerOffset(items.length);
          pickerOffsetRef.current = items.length;
        }
      } finally {
        setIsLoading(false);
      }
    },
    [activeStatusFilter, activeTypeFilter, filterStatus]
  );

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
    setLinkedOnly(defaultLinkedOnly);
    setListingMode('all');
    setIsOpen(true);
    if (useSqlRows) void loadPickerRows('', { append: false });
  };

  const isPropertyForSale = (p: العقارات_tbl) => Boolean(p.isForSale) || String(p.حالة_العقار || '').trim() === 'معروض للبيع';

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
  }, [isOpen, useSqlRows, searchTerm, activeStatusFilter, activeTypeFilter, filterStatus, loadPickerRows]);

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

    // 0.25 Purpose filter: rent workflows should exclude sale-only properties (but keep selected always)
    if (purpose === 'rent') {
      const selectedId = String(value || '').trim();
      result = result.filter((p) => {
        const pid = String(p?.رقم_العقار || '').trim();
        if (selectedId && pid === selectedId) return true;
        const isForRent = p.isForRent;
        return isForRent !== false;
      });
    }

    // 0.5 Linked-only: hide properties without owner linkage (keep selected always)
    if (linkedOnly) {
      const selectedId = String(value || '').trim();
      result = result.filter((p) => {
        const pid = String(p?.رقم_العقار || '').trim();
        if (selectedId && pid === selectedId) return true;
        // Broader linkage: owner, active contract, for-sale, maintenance ticket, ownership history
        if (legacyLinkedPropertyIds.size === 0) return true;
        return legacyLinkedPropertyIds.has(pid);
      });
    }

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
    }, [properties, contracts, searchTerm, activeStatusFilter, activeTypeFilter, sortConfig, peopleMap, linkedOnly, value, legacyLinkedPropertyIds, purpose, filterStatus]);

  const filteredPickerRows = useMemo(() => {
    if (!useSqlRows) return [] as PickerRow[];
    // Desktop path already applies search/status/type/vacant server-side; keep a light extra filter.
    let rows: PickerRow[] = pickerRows;

    if (purpose === 'rent') {
      const selectedId = String(value || '').trim();
      rows = rows.filter((r) => {
        const p = r.property;
        const pid = String(p.رقم_العقار || '').trim();
        if (selectedId && pid === selectedId) return true;
        const isForRent = p.isForRent;
        return isForRent !== false;
      });
    }

    if (linkedOnly) {
      const selectedId = String(value || '').trim();
      rows = rows.filter((r) => {
        const p = r.property;
        const pid = String(p.رقم_العقار || '').trim();
        if (selectedId && pid === selectedId) return true;
        // Desktop-safe linkage: owner, active contract, or for-sale flag.
        const ownerId = String(p.رقم_المالك || '').trim();
        const ownerName = String(r.ownerName || '').trim();
        const isForSale = Boolean(p.isForSale);
        const activeRec = isRecord(r.active) ? r.active : null;
        const hasActive = Boolean(asTrimmedString(getRecordProp(activeRec, 'contractId')));
        return Boolean(ownerId || ownerName || isForSale || hasActive);
      });
    }

    if (sortConfig) {
      const key = sortConfig.key;
      const dir = sortConfig.direction;
      rows = [...rows].sort((a, b) => {
        const av = a.property[key];
        const bv = b.property[key];
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return rows;
  }, [pickerRows, sortConfig, useSqlRows, linkedOnly, value, purpose]);

  const sqlRowByPropertyId = useMemo(() => {
    const m = new Map<string, PickerRow>();
    for (const r of filteredPickerRows) {
      const pid = String(r.property.رقم_العقار || '');
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
              <span className={`font-bold whitespace-normal break-words ${selectedProperty ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    {selectedProperty
                      ? `${selectedProperty.الكود_الداخلي}${selectedProperty.النوع ? ` - ${selectedProperty.النوع}` : ''}`
                      : placeholder}
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
        <AppModal
          open={isOpen}
          onClose={() => setIsOpen(false)}
          size="6xl"
          initialFocusSelector={`#${modalSearchInputId}`}
          className="items-center p-4 bg-black/20 backdrop-blur-[1px]"
          contentClassName="dark:bg-slate-900 dark:border-slate-800 h-[85vh] rounded-2xl"
          bodyClassName="p-0 overflow-hidden flex flex-col"
          title={
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-600/20">
                <Building2 size={22} />
              </div>
              <div>
                <div className="font-bold text-lg">اختيار عقار</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">ابحث واختر العقار المناسب للعملية</div>
              </div>
            </div>
          }
        >

                {/* Search & Filters */}
                <div className="p-4 space-y-4 bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <input 
                                id={modalSearchInputId}
                                type="text" 
                                placeholder="بحث: الكود، اسم المالك، رقم القطعة، الحوض..." 
                              dir={isRtl ? 'rtl' : 'ltr'}
                              className={`w-full py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm text-slate-900 dark:text-white placeholder-slate-400 ${isRtl ? 'pr-4 pl-12 text-right' : 'pl-4 pr-12 text-left'}`}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                      <Search className={`absolute top-3 text-gray-400 ${isRtl ? 'left-4' : 'right-4'}`} size={20} />
                        </div>
                        
                        <div className="flex gap-2 flex-wrap justify-end">
                            <select 
                              className="px-4 py-2 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 text-slate-900 dark:text-white"
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
                              className="px-4 py-2 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 text-slate-900 dark:text-white"
                                value={activeTypeFilter}
                                onChange={e => setActiveTypeFilter(e.target.value)}
                            >
                                <option value="">كل الأنواع</option>
                                <option value="شقة">شقة</option>
                                <option value="محل تجاري">محل تجاري</option>
                                <option value="مكتب">مكتب</option>
                                <option value="فيلا">فيلا</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => setLinkedOnly((v) => !v)}
                              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition border flex items-center gap-2
                                ${linkedOnly
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-slate-50/70 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                                }
                              `}
                              title={
                                linkedOnly
                                  ? 'إخفاء العقارات غير المرتبطة (مالك/عقد/بيع/صيانة/سجل ملكية)'
                                  : 'إظهار جميع العقارات بما فيها غير المرتبطة'
                              }
                            >
                              <Filter size={14} />
                              مرتبطة فقط
                            </button>
                        </div>
                    </div>
                </div>

                {/* List Content (مثل ContractPicker) */}
                <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900/50 p-2 custom-scrollbar">
                  {desktopUnsupported ? (
                    <div className="flex flex-col items-center justify-center h-60 text-slate-400">
                      <Search size={44} className="mb-3 opacity-40" />
                      <p className="font-bold text-slate-700 dark:text-slate-200">غير مدعوم في وضع الديسكتوب الحالي</p>
                      <p className="text-xs mt-2 text-slate-500">يرجى تشغيل وضع السرعة/SQL أو تحديث نسخة الديسكتوب لتفعيل البحث.</p>
                    </div>
                  ) : (
                    <>
                      {isLoading ? (
                        <div className="p-4 text-center text-slate-500 text-sm">جاري التحميل...</div>
                      ) : null}

                      {(!isLoading && (useSqlRows ? filteredPickerRows.length === 0 : filteredProperties.length === 0)) ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                          <Search size={40} className="mb-2 opacity-50" />
                          <p>لا توجد عقارات مطابقة</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 px-2 text-[11px] text-slate-500">
                            <button
                              type="button"
                              onClick={() => handleSort('الكود_الداخلي')}
                              className="font-bold hover:text-indigo-600"
                            >
                              ترتيب حسب الكود
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSort('حالة_العقار')}
                              className="font-bold hover:text-indigo-600"
                            >
                              ترتيب حسب الحالة
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 px-2">
                            <div className="text-[11px] text-slate-500 font-bold">العرض:</div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setListingMode('all')}
                                className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  listingMode === 'all'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-800 hover:border-indigo-300/70'
                                }`}
                              >
                                الكل
                              </button>
                              <button
                                type="button"
                                onClick={() => setListingMode('sale')}
                                className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  listingMode === 'sale'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-800 hover:border-emerald-300/70'
                                }`}
                              >
                                للبيع
                              </button>
                              <button
                                type="button"
                                onClick={() => setListingMode('rent')}
                                className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  listingMode === 'rent'
                                    ? 'bg-sky-600 text-white border-sky-600'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-800 hover:border-sky-300/70'
                                }`}
                              >
                                للإيجار
                              </button>
                            </div>
                          </div>

                          {(() => {
                            const allItems = (useSqlRows ? filteredPickerRows.map((row) => row.property) : filteredProperties);
                            const byMode = listingMode === 'all'
                              ? allItems
                              : listingMode === 'sale'
                                ? allItems.filter((p) => isPropertyForSale(p))
                                : allItems.filter((p) => !isPropertyForSale(p));

                            const saleItems = listingMode === 'all' ? allItems.filter((p) => isPropertyForSale(p)) : [];
                            const rentItems = listingMode === 'all' ? allItems.filter((p) => !isPropertyForSale(p)) : [];

                            const renderItem = (p: العقارات_tbl) => {
                              const sqlRow = useSqlRows ? sqlRowByPropertyId.get(String(p.رقم_العقار || '')) : undefined;
                              const sqlActiveRec = isRecord(sqlRow?.active) ? sqlRow.active : null;

                              const sqlContractId = asTrimmedString(getRecordProp(sqlActiveRec, 'contractId'));
                              const legacyActive = activeContractByPropertyId.get(String(p.رقم_العقار));

                              const activeC: ActiveContractLike | null = sqlContractId
                                ? {
                                    contractId: sqlContractId,
                                    status: asString(getRecordProp(sqlActiveRec, 'status')),
                                    startDate: asString(getRecordProp(sqlActiveRec, 'startDate')),
                                    endDate: asString(getRecordProp(sqlActiveRec, 'endDate')),
                                  }
                                : legacyActive
                                  ? {
                                      contractId: String(legacyActive.رقم_العقد || ''),
                                      tenantId: String(legacyActive.رقم_المستاجر || ''),
                                      guarantorId: legacyActive.رقم_الكفيل ? String(legacyActive.رقم_الكفيل) : undefined,
                                      status: String(legacyActive.حالة_العقد || ''),
                                      startDate: String(legacyActive.تاريخ_البداية || ''),
                                      endDate: String(legacyActive.تاريخ_النهاية || ''),
                                    }
                                  : null;

                              const hasActive = Boolean(activeC?.contractId);

                              const sqlTenantName = asTrimmedString(getRecordProp(sqlActiveRec, 'tenantName'));
                              const activeTenantId = asTrimmedString(activeC?.tenantId);
                              const tenantName = sqlTenantName || (activeTenantId ? getTenantName(activeTenantId) : '');
                              const fallbackTenantName = activeTenantId ? getTenantName(activeTenantId) : '—';

                              const sqlGuarantorName = asTrimmedString(getRecordProp(sqlActiveRec, 'guarantorName'));
                              const sqlGuarantorPhone = asTrimmedString(getRecordProp(sqlActiveRec, 'guarantorPhone'));
                              const activeGuarantorId = asTrimmedString(activeC?.guarantorId);
                              const guarantorName = sqlGuarantorName || (activeGuarantorId ? getGuarantorName(activeGuarantorId) : '');
                              const guarantorPhone =
                                sqlGuarantorPhone || (activeGuarantorId ? asTrimmedString(peopleMap.get(activeGuarantorId)?.رقم_الهاتف) : '');
                              const hasGuarantor = Boolean(sqlGuarantorName || activeGuarantorId);

                              const isSelected = value === p.رقم_العقار;
                              const ownerName = (sqlRow?.ownerName ? String(sqlRow.ownerName) : '') || getOwnerName(p.رقم_المالك);
                              const area = formatArea(p.المساحة);
                              const activeContractId = activeC?.contractId;
                              const isForSale = isPropertyForSale(p);

                              return (
                                <div
                                  key={p.رقم_العقار}
                                  onClick={() => handleSelect(p)}
                                  className={
                                    `app-card p-3 rounded-xl border cursor-pointer transition flex flex-col gap-2 ` +
                                    (isSelected
                                      ? 'border-indigo-500 ring-2 ring-indigo-200/60 dark:ring-indigo-500/20'
                                      : isForSale
                                        ? 'border-emerald-300/70 dark:border-emerald-500/30 hover:border-emerald-400/80 dark:hover:border-emerald-400/40'
                                        : 'border-slate-200/70 dark:border-slate-800 hover:border-indigo-400/70 dark:hover:border-indigo-400/30')
                                  }
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-slate-800 dark:text-white">
                                          <span dir="ltr" className="font-mono tabular-nums">{p.الكود_الداخلي}</span>
                                          {p.رقم_شقة ? <span className="text-xs text-slate-500"> • شقة {p.رقم_شقة}</span> : null}
                                        </span>
                                        <StatusBadge status={p.حالة_العقار} className="scale-90 origin-right" />
                                        {isForSale ? (
                                          <span className="text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20">
                                            للبيع
                                          </span>
                                        ) : (
                                          <span className="text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20">
                                            للإيجار
                                          </span>
                                        )}
                                        {hasActive ? (
                                          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">• مؤجر</span>
                                        ) : null}
                                      </div>

                                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                        <span className="whitespace-normal break-words">المالك: {ownerName || '-'}</span>
                                        <span className="whitespace-normal break-words">
                                          المستأجر: {tenantName || (hasActive ? fallbackTenantName : '—')}
                                        </span>
                                        {hasActive ? (
                                          <span className="whitespace-nowrap" dir="ltr">عقد #{contractIdLabel(activeContractId)}</span>
                                        ) : null}
                                      </div>

                                      {hasGuarantor ? (
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 whitespace-normal break-words">
                                          كفيل: {guarantorName || '-'}
                                          {guarantorPhone ? <span dir="ltr"> • {guarantorPhone}</span> : null}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {isSelected ? (
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                          <Check size={16} />
                                        </div>
                                      ) : (
                                        <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700" />
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2 flex-wrap">
                                      <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap">
                                        {p.النوع || '—'}
                                      </span>
                                      {area ? (
                                        <span className="text-[11px] opacity-80 font-mono tabular-nums whitespace-nowrap" dir="ltr">
                                          {area} <span dir="rtl">م²</span>
                                        </span>
                                      ) : null}
                                      {p.اسم_الحوض ? <span className="text-[11px]">حوض: {p.اسم_الحوض}</span> : null}
                                      {p.رقم_قطعة ? <span className="text-[11px]">قطعة: {p.رقم_قطعة}</span> : null}
                                      {p.رقم_لوحة ? <span className="text-[11px]">لوحة: {p.رقم_لوحة}</span> : null}
                                    </div>

                                    <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1">
                                      <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                                      <span className="min-w-0 whitespace-normal break-words">{p.العنوان || '—'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            };

                            if (listingMode === 'all') {
                              return (
                                <div className="space-y-3">
                                  {saleItems.length ? (
                                    <div>
                                      <div className="px-2 text-[12px] font-bold text-emerald-700 dark:text-emerald-300">عقارات للبيع ({saleItems.length})</div>
                                      <div className="mt-2 space-y-2">{saleItems.map(renderItem)}</div>
                                    </div>
                                  ) : null}

                                  {rentItems.length ? (
                                    <div>
                                      <div className="px-2 text-[12px] font-bold text-sky-700 dark:text-sky-300">عقارات للإيجار ({rentItems.length})</div>
                                      <div className="mt-2 space-y-2">{rentItems.map(renderItem)}</div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            }

                            return <div className="space-y-2">{byMode.map(renderItem)}</div>;
                          })()}
                        </div>
                      )}

                      {useSqlRows && (canLoadMoreSql || pickerTotal > 0) ? (
                        <div className="p-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                          <div>
                            المعروض: {pickerRows.length} / {pickerTotal || pickerRows.length}
                          </div>
                          <button
                            type="button"
                            disabled={!canLoadMoreSql}
                            onClick={handleLoadMoreSql}
                            className={
                              `px-3 py-1.5 rounded-lg border text-xs font-bold transition ` +
                              (canLoadMoreSql
                                ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10'
                                : 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500 cursor-not-allowed')
                            }
                          >
                            تحميل المزيد
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
                    <div className="text-xs text-slate-500">
                  العدد الإجمالي: {useSqlRows ? (pickerTotal || filteredPickerRows.length) : filteredProperties.length} عقار
                    </div>
                  <button
                    type="button"
                    disabled
                    className="text-slate-400 text-sm font-bold flex items-center gap-1 cursor-not-allowed"
                    title="قريباً"
                  >
                    <Plus size={16}/> إضافة عقار جديد (قريباً)
                  </button>
                </div>

        </AppModal>
      )}
    </div>
  );
};
