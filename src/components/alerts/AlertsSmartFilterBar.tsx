import React from 'react';
import { Search, Filter, Bell, Clock, CheckCheck } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { PaginationControls } from '@/components/shared/PaginationControls';

interface AlertsSmartFilterBarProps {
  q: string;
  setQ: (val: string) => void;
  only: 'all' | 'unread';
  setOnly: (val: 'all' | 'unread') => void;
  category: string;
  setCategory: (val: string) => void;
  availableCategories: string[];
  totalCount: number;
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  hasAlerts: boolean;
}

export const AlertsSmartFilterBar: React.FC<AlertsSmartFilterBarProps> = ({
  q,
  setQ,
  only,
  setOnly,
  category,
  setCategory,
  availableCategories,
  totalCount,
  currentPage,
  pageCount,
  onPageChange,
  onRefresh,
  onMarkAllRead,
  hasAlerts,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={onRefresh}
            className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-black px-6"
            leftIcon={<Clock size={20} />}
          >
            تحديث ومسح شامل
          </Button>
          {hasAlerts && (
            <Button
              variant="secondary"
              onClick={onMarkAllRead}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6"
              leftIcon={<CheckCheck size={20} />}
            >
              تعليم الكل كمقروء
            </Button>
          )}
        </div>
      }
      filters={
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center w-full">
          {/* Search */}
          <div className="relative group">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
            />
            <Input
              type="text"
              placeholder="بحث في التنبيهات..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pr-11 py-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm"
            />
          </div>

          {/* Status Tab-like Filter */}
          <div className="flex items-center gap-2 bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setOnly('unread')}
              className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${
                only === 'unread'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              غير مقروء
            </button>
            <button
              onClick={() => setOnly('all')}
              className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${
                only === 'all'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              الكل
            </button>
          </div>

          {/* Category Select */}
          <div className="relative group">
            <Filter
              size={18}
              className="pointer-events-none absolute right-4 top-1/2 z-[1] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500"
            />
            <Select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: '', label: 'كل التصنيفات' },
                ...availableCategories.map((c) => ({ value: c, label: c })),
              ]}
              className="w-full [&_button]:border-2 [&_button]:border-slate-100 [&_button]:bg-slate-50 [&_button]:py-3 [&_button]:pr-11 [&_button]:text-xs [&_button]:font-black dark:[&_button]:border-slate-800 dark:[&_button]:bg-slate-950/30"
            />
          </div>
        </div>
      }
      pagination={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
              <Bell size={14} className="text-indigo-500" />
              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                {totalCount.toLocaleString()} تنبيه
              </span>
            </div>
          </div>
          <PaginationControls
            page={currentPage}
            pageCount={pageCount}
            onPageChange={onPageChange}
          />
        </div>
      }
    />
  );
};
