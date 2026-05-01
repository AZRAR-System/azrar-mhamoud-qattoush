import React from 'react';
import { 
  Search, 
  RefreshCw, 
  Bell, 
  Calendar, 
  CheckCircle,
  Filter,
  Layers,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { KanbanColumn } from '@/hooks/useAlerts';

interface NotificationCommandBarProps {
  totalCount: number;
  unreadCount: number;
  columns: KanbanColumn[];
  searchQuery: string;
  activeFilter: 'unread' | 'all';
  activePeriod: 'today' | 'week' | 'month';
  isScanning: boolean;
  onSearch: (q: string) => void;
  onFilterChange: (f: 'unread' | 'all') => void;
  onPeriodChange: (p: 'today' | 'week' | 'month') => void;
  onScan: () => void;
}

export const NotificationCommandBar: React.FC<NotificationCommandBarProps> = ({
  totalCount,
  unreadCount,
  columns,
  searchQuery,
  activeFilter,
  activePeriod,
  isScanning,
  onSearch,
  onFilterChange,
  onPeriodChange,
  onScan,
}) => {
  return (
    <div className="flex flex-col gap-5 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      {/* Row 1: Title, Search, Scan */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
            <Bell size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white leading-none">مركز الإشعارات</h1>
            <p className="text-xs text-slate-400 font-bold mt-1.5">{totalCount} إشعار — {unreadCount} غير مقروء</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1 group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="بحث في الإشعارات، الأشخاص، العقارات..."
              className="w-full h-12 pr-12 pl-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium transition-all"
            />
          </div>
          <button
            onClick={onScan}
            disabled={isScanning}
            className="flex items-center gap-2 h-12 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 transition-all font-bold text-sm shadow-sm"
          >
            <RefreshCw size={18} className={cn(isScanning && "animate-spin")} />
            <span className="hidden sm:inline">فحص الآن</span>
          </button>
        </div>
      </div>

      {/* Row 2: Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {columns.map((col) => (
          <div
            key={col.id}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 whitespace-nowrap"
          >
            <div className={cn(
              "w-2 h-2 rounded-full",
              col.id === 'urgent' ? "bg-rose-500" :
              col.id === 'financial' ? "bg-amber-500" :
              col.id === 'contracts' ? "bg-blue-500" :
              col.id === 'maintenance' ? "bg-emerald-500" : "bg-indigo-500"
            )} />
            <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">{col.label}</span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm">{col.count}</span>
          </div>
        ))}
      </div>

      {/* Row 3: Filters & Counters */}
      <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-4">
        <div className="flex items-center gap-4">
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => onFilterChange('unread')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                activeFilter === 'unread' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              غير مقروء
            </button>
            <button
              onClick={() => onFilterChange('all')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                activeFilter === 'all' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              الكل
            </button>
          </div>

          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black transition-all capitalize",
                  activePeriod === p ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {p === 'today' ? 'اليوم' : p === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
          <Filter size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">ترتيب: الأحدث</span>
        </div>
      </div>
    </div>
  );
};
