import React, { FC } from 'react';
import { Search, Filter as FilterIcon } from 'lucide-react';
import { DS } from '@/constants/designSystem';

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  title?: string;
}

/**
 * شريط الفلاتر الموحد - يدمج البحث والتصفية في مكون زجاجي واحد
 * البحث على اليمين (RTL) والفلاتر/الإجراءات على اليسار
 */
export const FilterBar: FC<FilterBarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'ابحث هنا...',
  filters,
  actions,
  className,
}) => {
  return (
    <div className={`${DS.components.filterBar} ${className || ''}`}>
      {/* البحث - يمين (RTL) */}
      <div className="relative flex-1 w-full lg:max-w-md">
        <Search
          size={16}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pr-12 pl-4 py-3 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
        />
      </div>

      {/* الفلاتر والإجراءات - يسار (RTL) */}
      <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto no-scrollbar lg:justify-end">
        {filters && (
          <div className="flex items-center gap-2 shrink-0 border-r lg:border-r-0 lg:border-l border-slate-200 dark:border-slate-700 px-3 h-8">
            <FilterIcon size={14} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter hidden sm:inline">
              تصفية:
            </span>
            {filters}
          </div>
        )}
        
        {actions && (
          <div className="flex items-center gap-2 shrink-0 pr-3">
             {actions}
          </div>
        )}
      </div>
    </div>
  );
};
