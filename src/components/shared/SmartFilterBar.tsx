import React from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, RefreshCw, Download, ChevronDown, X, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { computePortalMenuLayout } from '@/utils/portalMenuLayout';

export interface FilterOptionItem {
  value: string;
  label: string;
}

export interface FilterChipProps {
  id: string;
  label: string;
  options: FilterOptionItem[];
  value?: string;
  onChange: (value: string) => void;
  permission?: string;
  icon?: React.ElementType | LucideIcon;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, options, value, onChange, icon: Icon }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});
  const [menuListMaxHeightPx, setMenuListMaxHeightPx] = React.useState(320);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const syncDropdownPosition = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { outerStyle, listMaxHeightPx } = computePortalMenuLayout(rect, {
      chromeReserve: 18,
      footerReserve: value ? 50 : 0,
    });
    setMenuListMaxHeightPx(listMaxHeightPx);
    setDropdownStyle(outerStyle);
  }, [value]);

  const toggleOpen = () => {
    if (!isOpen) {
      syncDropdownPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  React.useLayoutEffect(() => {
    if (!isOpen) return;
    syncDropdownPosition();
    let rafId: number | null = null;
    const onScrollOrResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncDropdownPosition();
      });
    };
    const scrollOpts: AddEventListenerOptions = { capture: true, passive: true };
    const resizeOpts: AddEventListenerOptions = { passive: true };
    window.addEventListener('scroll', onScrollOrResize, scrollOpts);
    window.addEventListener('resize', onScrollOrResize, resizeOpts);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, scrollOpts);
      window.removeEventListener('resize', onScrollOrResize, resizeOpts);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isOpen, syncDropdownPosition]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const dropdownPanel = (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="layer-portal-dropdown overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl py-1.5 shadow-2xl shadow-slate-900/10 dark:shadow-black/45 ring-1 ring-black/[0.04] dark:ring-white/[0.06] animate-in fade-in zoom-in-95 duration-200"
    >
      <div
        className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1.5 custom-scrollbar"
        style={{ maxHeight: menuListMaxHeightPx }}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
            className={`w-full whitespace-normal break-words rounded-xl px-3 py-2 text-right text-xs font-bold leading-snug transition-colors
              ${value === opt.value
                ? 'bg-indigo-600/[0.12] text-indigo-800 ring-1 ring-inset ring-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-400/25'
                : 'text-slate-600 hover:bg-slate-100/90 dark:text-slate-300 dark:hover:bg-slate-800/90'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {value ? (
        <div className="mx-1.5 mt-1 border-t border-slate-200/70 pt-1 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className="w-full rounded-xl px-3 py-2 text-right text-[11px] font-bold text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/15"
          >
            مسح الاختيار
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold transition-all border
          ${value 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300' 
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
          }`}
      >
        {Icon && <Icon size={14} />}
        <span>{selectedOption ? `${label}: ${selectedOption.label}` : label}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {typeof document !== 'undefined' && isOpen && createPortal(dropdownPanel, document.body)}
    </div>
  );
};

export interface SmartFilterBarProps {
  /** Row 1: Actions, buttons, etc. */
  actions?: React.ReactNode;
  /** Row 2: Filtering inputs, search bars, etc. (Can be ReactNode or array of objects) */
  filters?: React.ReactNode | FilterChipProps[];
  /** Row 3: Pagination, totals, stats, etc. */
  pagination?: React.ReactNode;
  /** Children for extra custom content */
  children?: React.ReactNode;

  /** Legacy props (for backward compatibility) */
  addButton?: { label: string; onClick: () => void; permission?: string };
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  tabs?: { id: string; label: string; count?: number; icon?: React.ElementType | LucideIcon }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onClearFilters?: () => void;
  moreActions?: { label: string; icon?: React.ElementType | LucideIcon; onClick: () => void; permission?: string }[];
  totalResults?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  sortOptions?: { value: string; label: string }[];
  sortValue?: string;
  onSortChange?: (val: string) => void;
}

export const SmartFilterBar: React.FC<SmartFilterBarProps> = (props) => {
  const { actions, filters, pagination, children } = props;

  // Compatibility Logic: Row 1
  const finalActions = actions || (
    <>
      {props.addButton && (
        <button
          type="button"
          onClick={props.addButton.onClick}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black text-white transition-all active:scale-95 shadow-lg shadow-purple-500/30 whitespace-nowrap bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus size={20} strokeWidth={3} />
          <span>{props.addButton.label}</span>
        </button>
      )}
      {(props.onSearchChange || props.searchPlaceholder) && (
        <div className="flex-1 min-w-[300px] relative">
          <input
            type="text"
            placeholder={props.searchPlaceholder || 'بحث...'}
            value={props.searchValue || ''}
            onChange={(e) => props.onSearchChange?.(e.target.value)}
            className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-[1.25rem] text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 transition-all placeholder:text-slate-400"
          />
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      )}
      {props.tabs && props.tabs.length > 0 && (
         <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-[1.25rem]">
           {props.tabs.map((tab) => {
             const TabIcon = tab.icon;
             return (
               <button
                 key={tab.id}
                 type="button"
                 onClick={() => props.onTabChange?.(tab.id)}
                 className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${props.activeTab === tab.id ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-sm' : 'text-slate-500'}`}
               >
                 {TabIcon && <TabIcon size={14} />}
                 <span>{tab.label}</span>
                 {tab.count !== undefined && (
                   <span className="px-2 py-0.5 rounded-md text-[10px] bg-purple-50 text-purple-600">{tab.count}</span>
                 )}
               </button>
             );
           })}
         </div>
      )}
    </>
  );

  // Compatibility Logic: Row 2 (Filters)
  const renderFilters = () => {
    if (React.isValidElement(filters) || typeof filters === 'string') {
        return filters;
    }
    if (Array.isArray(filters)) {
        return (filters as FilterChipProps[]).map((f) => <FilterChip key={f.id} {...f} />);
    }
    return null;
  };

  const finalFilters = renderFilters() || children;

  // Compatibility Logic: Row 3
  const finalPagination = pagination || (
    <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
      {props.totalResults !== undefined && <span>{props.totalResults} نتيجة</span>}
      {props.currentPage !== undefined && props.totalPages !== undefined && (
        <span dir="ltr">صفحة {props.currentPage} / {props.totalPages}</span>
      )}
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-5 mb-10 select-none page-transition" dir="rtl">
      {/* Row 1: Actions & Commands */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center flex-1 gap-3 flex-wrap">
          {finalActions}
          {props.moreActions && props.moreActions.length > 0 && (
              <div className="flex items-center gap-2">
                {props.moreActions.map((action, idx) => (
                    <Button 
                        key={idx} 
                        variant="ghost" 
                        size="sm" 
                        onClick={action.onClick}
                        className="!rounded-xl gap-2 font-bold text-xs"
                    >
                        {action.icon && <action.icon size={16} />}
                        {action.label}
                    </Button>
                ))}
              </div>
          )}
        </div>
        <div className="flex items-center gap-2">
            {props.onRefresh && (
              <Button variant="secondary" size="icon" onClick={props.onRefresh} className="!rounded-2xl !w-11 !h-11">
                <RefreshCw size={18} />
              </Button>
            )}
            {props.onExport && (
              <Button variant="secondary" size="icon" onClick={props.onExport} className="!rounded-2xl !w-11 !h-11">
                <Download size={18} />
              </Button>
            )}
            {props.onClearFilters && (
              <Button variant="secondary" size="sm" onClick={props.onClearFilters} className="!rounded-2xl h-11 px-4 gap-2 text-xs font-black">
                <X size={16} />
                <span>مسح الفلاتر</span>
              </Button>
            )}
        </div>
      </div>

      {/* Row 2: Filters */}
      {finalFilters && (
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-soft flex flex-col lg:flex-row items-center gap-6 ring-1 ring-slate-100 dark:ring-slate-900/20">
          <div className="flex-1 w-full flex flex-wrap items-center gap-4 text-sm font-bold">
            <span className="text-xs font-black text-slate-400 px-2 uppercase tracking-widest whitespace-nowrap">تصفية:</span>
            {finalFilters}
            {props.sortOptions && props.sortOptions.length > 0 && (
                <FilterChip 
                    id="sort" 
                    label="الترتيب" 
                    options={props.sortOptions} 
                    value={props.sortValue} 
                    onChange={(v) => props.onSortChange?.(v)} 
                />
            )}
          </div>
        </div>
      )}

      {/* Row 3: Pagination & Metadata */}
      {finalPagination && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            {finalPagination}
          </div>
        </div>
      )}
    </div>
  );
};
