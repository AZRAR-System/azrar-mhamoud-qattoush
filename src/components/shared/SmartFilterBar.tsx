import React from 'react';
import { Search, Plus, RefreshCcw } from 'lucide-react';
import { RBACGuard } from './RBACGuard';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

export interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface SmartFilterBarProps {
  title: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  filters?: FilterOption[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (key: string, val: string) => void;
  onAddClick?: () => void;
  addLabel?: string;
  onRefresh?: () => void;
  /** When set, shows a secondary control to reset search + list filters */
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  extraActions?: React.ReactNode;
  /** إخفاء صف العنوان/الوصف عند استخدام `PageHero` فوق الشريط */
  omitTitle?: boolean;
}

export const SmartFilterBar: React.FC<SmartFilterBarProps> = ({
  title,
  subtitle,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'بحث...',
  showSearch = true,
  filters = [],
  activeFilters = {},
  onFilterChange,
  onAddClick,
  addLabel = 'جديد',
  onRefresh,
  onClearFilters,
  clearFiltersLabel = 'مسح الفلاتر',
  extraActions,
  omitTitle = false,
}) => {
  const shouldShowSearch = showSearch && typeof onSearchChange === 'function';
  const shouldShowBar = shouldShowSearch || (Array.isArray(filters) && filters.length > 0);

  return (
    <div className="mb-8">
      <div className={DS.components.filterBar + ' flex-col !items-stretch !p-6 lg:!p-8'}>
        {/* Header Section */}
        <div
          className={`flex flex-col lg:flex-row lg:items-center gap-6 ${omitTitle ? '' : 'justify-between'}`}
        >
          {!omitTitle ? (
            <div className="min-w-0 text-right">
              <h2 className="text-xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          ) : null}

          <div
            className={
              omitTitle
                ? 'flex flex-wrap items-center justify-end gap-3 w-full'
                : 'flex items-center justify-end gap-3 overflow-x-auto no-scrollbar flex-nowrap w-full lg:w-auto lg:flex-wrap lg:overflow-visible'
            }
          >
            {extraActions}

            {onRefresh && (
              <Button 
                variant="secondary" 
                onClick={onRefresh} 
                title="تحديث البيانات" 
                size="md"
                className="!rounded-2xl"
              >
                <RefreshCcw size={18} />
              </Button>
            )}

            {onAddClick && (
              <RBACGuard requiredRole={['Admin', 'SuperAdmin', 'Employee']}>
                <Button 
                  variant="primary" 
                  onClick={onAddClick} 
                  rightIcon={<Plus size={18} />}
                  className="!rounded-2xl !px-6"
                >
                  {addLabel}
                </Button>
              </RBACGuard>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        {shouldShowBar && (
          <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700/50">
            <div className="flex flex-col gap-4 md:flex-row md:flex-nowrap md:overflow-x-auto md:no-scrollbar lg:flex-wrap lg:overflow-visible">
              {/* Search */}
              {shouldShowSearch && (
                <div className="flex-1 min-w-[16rem] md:shrink-0 lg:shrink">
                  <Input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    icon={<Search size={18} className="text-indigo-500" />}
                    className="!rounded-2xl !py-3.5 !border-slate-200 focus:!border-indigo-500"
                  />
                </div>
              )}

              {/* Dynamic Filters */}
              {filters.map((filter) => (
                <div key={filter.key} className="w-full md:w-auto md:min-w-[14rem] shrink-0">
                  <Select
                    options={filter.options}
                    value={activeFilters[filter.key] || ''}
                    onChange={(e) => onFilterChange && onFilterChange(filter.key, e.target.value)}
                    placeholder={filter.label}
                    className="!rounded-2xl !py-3 !bg-slate-50/50 dark:!bg-slate-800/30"
                  />
                </div>
              ))}

              {typeof onClearFilters === 'function' ? (
                <div className="flex items-center shrink-0">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="md" 
                    onClick={onClearFilters}
                    className="text-slate-500 hover:text-indigo-600 font-black h-12"
                  >
                    {clearFiltersLabel}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
