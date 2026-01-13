
import React from 'react';
import { Search, Plus, RefreshCcw } from 'lucide-react';
import { RBACGuard } from './RBACGuard';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface SmartFilterBarProps {
  title: string;
  subtitle?: string;
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
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
  searchValue,
  onSearchChange,
  searchPlaceholder = "بحث...",
  filters = [],
  activeFilters = {},
  onFilterChange,
  onAddClick,
  addLabel = "جديد",
  onRefresh,
  extraActions
}) => {
  return (
    <div className="space-y-6 mb-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
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
      <Card className="p-2 flex flex-col md:flex-row gap-3">
        
        {/* Search Input (RTL: First) */}
        <div className="flex-1">
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            icon={<Search size={18} />}
          />
        </div>

        {/* Dynamic Filters */}
        {filters.map((filter) => (
          <div key={filter.key} className="w-full md:w-auto">
            <Select
              options={filter.options}
              value={activeFilters[filter.key] || ''}
              onChange={(e) => onFilterChange && onFilterChange(filter.key, e.target.value)}
              placeholder={filter.label}
            />
          </div>
        ))}
      </Card>
    </div>
  );
};
