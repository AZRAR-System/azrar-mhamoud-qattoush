import {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Users, HandCoins, Globe, Filter, Download, Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { SmartFilterBar, FilterOptionItem } from '@/components/shared/SmartFilterBar';
import { المستخدمين_tbl } from '@/types';
import { computePortalPanelLayout } from '@/utils/portalMenuLayout';
import { cn } from '@/utils/cn';

const YM_RE = /^\d{4}-\d{2}$/;

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

function ymKey(y: number, month1to12: number): string {
  return `${y}-${String(month1to12).padStart(2, '0')}`;
}

function parseYmBounds(): { minYm: string; maxYm: string } {
  const endCap = new Date();
  endCap.setMonth(endCap.getMonth() + 24);
  return { minYm: '2000-01', maxYm: ymKey(endCap.getFullYear(), endCap.getMonth() + 1) };
}

function ymInRange(ym: string, minYm: string, maxYm: string): boolean {
  return ym >= minYm && ym <= maxYm;
}

function formatYmLabelAr(ym: string): string {
  if (!YM_RE.test(ym)) return '—';
  const yy = Number(ym.slice(0, 4));
  const mm = Number(ym.slice(5, 7));
  return new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(new Date(yy, mm - 1, 1));
}

const PANEL_W = 300;
const PANEL_MIN_H = 300;

type MonthBoardProps = {
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  minYm: string;
  maxYm: string;
};

/** اختيار شهر بتقويم (شبكة أشهر + تنقل سنوات) — متناسق مع الوضع الداكن */
const CommissionsMonthBoard: FC<MonthBoardProps> = ({
  selectedMonth,
  setSelectedMonth,
  minYm,
  maxYm,
}) => {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const s = String(selectedMonth || '').trim();
    if (YM_RE.test(s)) return Number(s.slice(0, 4));
    return new Date().getFullYear();
  });
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const maxYear = Number(maxYm.slice(0, 4));
  const minYear = Number(minYm.slice(0, 4));

  useEffect(() => {
    const s = String(selectedMonth || '').trim();
    if (YM_RE.test(s)) {
      const y = Number(s.slice(0, 4));
      if (Number.isFinite(y)) setViewYear(y);
    }
  }, [selectedMonth]);

  const syncPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    setPopoverStyle(computePortalPanelLayout(el.getBoundingClientRect(), PANEL_W, PANEL_MIN_H, { gap: 8, viewMargin: 12 }));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    syncPosition();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    let raf: number | null = null;
    const onScrollResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        syncPosition();
      });
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onScrollResize, { passive: true });
    window.addEventListener('scroll', onScrollResize, { capture: true, passive: true });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onScrollResize);
      window.removeEventListener('scroll', onScrollResize, { capture: true } as AddEventListenerOptions);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [open, syncPosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const label = useMemo(() => formatYmLabelAr(String(selectedMonth || '').trim()), [selectedMonth]);

  const pickMonth = (month1to12: number) => {
    const ym = ymKey(viewYear, month1to12);
    if (!ymInRange(ym, minYm, maxYm)) return;
    setSelectedMonth(ym);
    setOpen(false);
  };

  const canPrevYear = viewYear > minYear;
  const canNextYear = viewYear < maxYear;

  const panel = open && popoverStyle && typeof document !== 'undefined' && (
    <div
      ref={panelRef}
      style={popoverStyle}
      className={cn(
        'fixed layer-portal-dropdown box-border overflow-auto rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl shadow-slate-900/10 ring-1 ring-black/[0.04] backdrop-blur-xl',
        'dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-black/45 dark:ring-white/[0.06]'
      )}
    >
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700/80">
        <button
          type="button"
          aria-label="السنة السابقة"
          disabled={!canPrevYear}
          onClick={(e) => {
            e.stopPropagation();
            setViewYear((y) => y - 1);
          }}
          className={cn(
            'rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            !canPrevYear && 'pointer-events-none opacity-30'
          )}
        >
          <ChevronRight size={20} />
        </button>
        <div className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-white">
          <Calendar size={16} className="text-indigo-500" />
          <span dir="ltr">{viewYear}</span>
        </div>
        <button
          type="button"
          aria-label="السنة التالية"
          disabled={!canNextYear}
          onClick={(e) => {
            e.stopPropagation();
            setViewYear((y) => y + 1);
          }}
          className={cn(
            'rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            !canNextYear && 'pointer-events-none opacity-30'
          )}
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        اختر الشهر
      </p>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {MONTHS_AR.map((name, idx) => {
          const m = idx + 1;
          const ym = ymKey(viewYear, m);
          const allowed = ymInRange(ym, minYm, maxYm);
          const isSelected = ym === selectedMonth;
          return (
            <button
              key={ym}
              type="button"
              disabled={!allowed}
              onClick={() => pickMonth(m)}
              className={cn(
                'min-h-[2.75rem] rounded-xl border px-1.5 py-2 text-center text-[11px] font-black leading-tight transition-all',
                allowed
                  ? 'border-slate-200/90 bg-slate-50/80 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/90 dark:border-slate-600/80 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40'
                  : 'cursor-not-allowed border-transparent bg-slate-100/40 text-slate-300 dark:bg-slate-900/40 dark:text-slate-600',
                isSelected &&
                  allowed &&
                  'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/40 hover:bg-indigo-600 dark:ring-indigo-400/30'
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        ref={triggerRef}
        type="button"
        id="commissions-month-picker-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((o) => !o);
          queueMicrotask(() => syncPosition());
        }}
        className={cn(
          'flex min-w-0 max-w-[min(100%,16rem)] items-center gap-2 rounded-xl border px-3 py-2 text-start shadow-sm transition-all',
          'border-slate-200/90 bg-white hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-800/90 dark:hover:border-indigo-500/60',
          open && 'ring-2 ring-indigo-500/40 border-indigo-300 dark:border-indigo-500/50'
        )}
      >
        <Filter size={14} className="shrink-0 text-slate-400" aria-hidden />
        <span className="shrink-0 text-[11px] font-black text-slate-500 dark:text-slate-400">الشهر</span>
        <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-800 dark:text-slate-100">{label}</span>
        <ChevronDown size={16} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {panel && createPortal(panel, document.body)}
    </div>
  );
};

interface CommissionsSmartFilterBarProps {
  activeTab: 'contracts' | 'external' | 'employee';
  setActiveTab: (t: 'contracts' | 'external' | 'employee') => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  contractSearchTerm: string;
  setContractSearchTerm: (s: string) => void;
  filterType: string;
  setFilterType: (t: string) => void;
  employeeUserFilter: string;
  setEmployeeUserFilter: (u: string) => void;
  systemUsers: المستخدمين_tbl[];
  availableTypes: string[];
  onRefresh: () => void;
  onExportEmployeeXlsx: () => void;
  onExportEmployeeCsv: () => void;
  onExportContractCommissionsXlsx: () => void;
  totalResults: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  isLoading?: boolean;
}

export const CommissionsSmartFilterBar: FC<CommissionsSmartFilterBarProps> = ({
  activeTab, setActiveTab,
  selectedMonth, setSelectedMonth,
  searchTerm, setSearchTerm,
  contractSearchTerm, setContractSearchTerm,
  filterType, setFilterType,
  employeeUserFilter, setEmployeeUserFilter,
  systemUsers,
  availableTypes,
  onRefresh,
  onExportEmployeeXlsx,
  onExportEmployeeCsv,
  onExportContractCommissionsXlsx,
  totalResults,
  currentPage,
  totalPages,
  onPageChange,
}) => {

  const isEmployee = activeTab === 'employee';
  const isContracts = activeTab === 'contracts';

  const userOptions: FilterOptionItem[] = [
    { value: '', label: 'كل الموظفين' },
    ...systemUsers.filter(u => !!u?.isActive).map(u => ({
      value: String(u.اسم_المستخدم),
      label: String(u.اسم_للعرض || u.اسم_المستخدم)
    }))
  ];

  const typeOptions: FilterOptionItem[] = (isEmployee ? ['All', 'إيجار', 'بيع'] : ['All', ...availableTypes]).map(t => ({
    value: t,
    label: t === 'All' ? 'كل الأنواع' : t
  }));

  const { minYm, maxYm } = useMemo(() => parseYmBounds(), []);

  const safeSelectedMonth = useMemo(() => {
    const s = String(selectedMonth || '').trim();
    if (YM_RE.test(s) && ymInRange(s, minYm, maxYm)) return s;
    return maxYm;
  }, [selectedMonth, minYm, maxYm]);

  useEffect(() => {
    const s = String(selectedMonth || '').trim();
    if (!YM_RE.test(s) || !ymInRange(s, minYm, maxYm)) {
      setSelectedMonth(maxYm);
    }
  }, [selectedMonth, minYm, maxYm, setSelectedMonth]);

  return (
    <SmartFilterBar
      searchPlaceholder={
        isContracts ? "بحث في العقود والفرص والأسماء..." :
        activeTab === 'external' ? "بحث في العنوان..." :
        "بحث (المرجع، العقار، الموظف)..."
      }
      searchValue={isContracts ? contractSearchTerm : searchTerm}
      onSearchChange={isContracts ? setContractSearchTerm : setSearchTerm}
      tabs={[
        { id: 'contracts', label: 'عمولات العقود', icon: HandCoins },
        { id: 'external', label: 'عمولات خارجية', icon: Globe },
        { id: 'employee', label: 'عمولات الموظفين', icon: Users }
      ]}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as 'contracts' | 'external' | 'employee')}
      onRefresh={onRefresh}
      onExport={isContracts ? onExportContractCommissionsXlsx : onExportEmployeeXlsx}
      totalResults={totalResults}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      filters={[
        ...(isEmployee ? [{
          id: 'user-filter',
          label: 'الموظف',
          options: userOptions,
          value: employeeUserFilter,
          onChange: setEmployeeUserFilter
        }] : []),
        ...(!isContracts ? [{
          id: 'type-filter',
          label: 'النوع',
          options: typeOptions,
          value: filterType,
          onChange: setFilterType
        }] : [])
      ]}
      moreActions={[
        {
          label: 'تصدير CSV (موظفين)',
          icon: Download,
          onClick: onExportEmployeeCsv,
          permission: 'EXPORT_DATA'
        }
      ]}
    >
      <div className="flex items-center gap-2">
        <CommissionsMonthBoard
          selectedMonth={safeSelectedMonth}
          setSelectedMonth={setSelectedMonth}
          minYm={minYm}
          maxYm={maxYm}
        />
      </div>
    </SmartFilterBar>
  );
};
