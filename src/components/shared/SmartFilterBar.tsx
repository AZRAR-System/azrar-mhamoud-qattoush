
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
  extraActions?: React.ReactNode;
}

export const SmartFilterBar: React.FC<SmartFilterBarProps> = ({
  title,
  subtitle,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = "بحث...",
  showSearch = true,
  filters = [],
  activeFilters = {},
  onFilterChange,
  onAddClick,
  addLabel = "جديد",
  onRefresh,
  extraActions
}) => {
  const shouldShowSearch = showSearch && typeof onSearchChange === 'function';
  const shouldShowBar = shouldShowSearch || (Array.isArray(filters) && filters.length > 0);

  return (
    <div className="mb-6">
      <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm ring-1 ring-black/5 dark:ring-white/5 relative p-4 lg:p-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 text-right">
            <h2 className="text-xl lg:text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 overflow-x-auto no-scrollbar flex-nowrap w-full lg:w-auto lg:flex-wrap lg:overflow-visible">
            {extraActions}

            {onRefresh && (
              <Button
                variant="secondary"
                onClick={onRefresh}
                title="تحديث البيانات"
                size="md"
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
                >
                  {addLabel}
                </Button>
              </RBACGuard>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        {shouldShowBar && (
          <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800">
            <div className="flex flex-col gap-3 md:flex-row md:flex-nowrap md:overflow-x-auto md:no-scrollbar lg:flex-wrap lg:overflow-visible">
              {/* Search */}
              {shouldShowSearch && (
                <div className="flex-1 min-w-[16rem] md:shrink-0 lg:shrink">
                  <Input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    icon={<Search size={18} />}
                  />
                </div>
              )}

              {/* Dynamic Filters */}
              {filters.map((filter) => (
                <div key={filter.key} className="w-full md:w-auto md:min-w-[12rem] shrink-0">
                  <Select
                    options={filter.options}
                    value={activeFilters[filter.key] || ''}
                    onChange={(e) => onFilterChange && onFilterChange(filter.key, e.target.value)}
                    placeholder={filter.label}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
