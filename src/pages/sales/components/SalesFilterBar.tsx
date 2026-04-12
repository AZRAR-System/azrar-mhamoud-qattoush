import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/Input';


interface SalesFilterBarProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  STATUS_FILTERS: { id: string; label: string; color: string }[];
}

export const SalesFilterBar: React.FC<SalesFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  STATUS_FILTERS
}) => {
  return (
    <div className="p-4 bg-slate-50/30 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="بحث بالعقار، المالك، السعر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={18} className="text-gray-400" />
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === filter.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};