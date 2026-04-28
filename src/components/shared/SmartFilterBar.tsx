import React from 'react';
import { Search, Plus, RefreshCw, Download, ChevronDown, X, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
  const containerRef = React.useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
        minWidth: '12rem',
        zIndex: 'var(--z-dropdown)',
      });
    }
    setIsOpen(!isOpen);
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

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

      {isOpen && (
        <div
          style={dropdownStyle}
          className="layer-dropdown min-w-[12rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-2 overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-right px-4 py-2.5 text-sm font-bold transition-colors
                ${value === opt.value 
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
            >
              {opt.label}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="w-full text-right px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 border-t border-slate-100 dark:border-slate-700 mt-1"
            >
              مسح الاختيار
            </button>
          )}
        </div>
      )}
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
