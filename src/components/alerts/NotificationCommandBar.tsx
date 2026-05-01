import React from 'react';
import { Search, RefreshCw, Bell, AlertCircle, CreditCard, FileText, Wrench } from 'lucide-react';
import { cn } from '@/utils/cn';

export type AlertCategoryTab = 'all' | 'urgent' | 'financial' | 'contracts' | 'dataQuality' | 'maintenance';

interface NotificationCommandBarProps {
  totalCount: number;
  unreadCount: number;
  columnCounts: Record<string, number>;
  searchQuery: string;
  activeFilter: 'unread' | 'all';
  activePeriod: 'today' | 'week' | 'month';
  activeCategory: AlertCategoryTab;
  isScanning: boolean;
  onSearch: (q: string) => void;
  onFilterChange: (f: 'unread' | 'all') => void;
  onPeriodChange: (p: 'today' | 'week' | 'month') => void;
  onCategoryChange: (c: AlertCategoryTab) => void;
  onScan: () => void;
}

const CATEGORY_TABS: {
  id: AlertCategoryTab;
  label: string;
  icon: React.ElementType;
  color: string;
  activeColor: string;
}[] = [
  { id: 'all',         label: 'الكل',         icon: Bell,         color: 'text-slate-400',   activeColor: 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' },
  { id: 'urgent',      label: 'عاجل',         icon: AlertCircle,  color: 'text-rose-400',    activeColor: 'bg-rose-500 text-white' },
  { id: 'financial',   label: 'مالي',         icon: CreditCard,   color: 'text-amber-400',   activeColor: 'bg-amber-500 text-white' },
  { id: 'contracts',   label: 'العقود',       icon: FileText,     color: 'text-blue-400',    activeColor: 'bg-blue-500 text-white' },
  { id: 'dataQuality', label: 'جودة البيانات', icon: Bell,        color: 'text-indigo-400',  activeColor: 'bg-indigo-500 text-white' },
  { id: 'maintenance', label: 'الصيانة',      icon: Wrench,       color: 'text-emerald-400', activeColor: 'bg-emerald-500 text-white' },
];

export const NotificationCommandBar: React.FC<NotificationCommandBarProps> = ({
  totalCount,
  unreadCount,
  columnCounts,
  searchQuery,
  activeFilter,
  activePeriod,
  activeCategory,
  isScanning,
  onSearch,
  onFilterChange,
  onPeriodChange,
  onCategoryChange,
  onScan,
}) => {
  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
      {/* Row 1: Title + Search + Scan */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
            <Bell size={18} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800 dark:text-white leading-none">
              مركز الإشعارات
            </h1>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              {totalCount} إشعار —{' '}
              <span className="text-indigo-500 font-bold">{unreadCount} غير مقروء</span>
            </p>
          </div>
        </div>

        <div className="relative flex-1 group">
          <Search
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
            size={15}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="بحث بالاسم، العقار، نوع التنبيه..."
            className="w-full h-10 pr-10 pl-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium transition-all"
          />
        </div>

        <button
          onClick={onScan}
          disabled={isScanning}
          title="فحص الآن"
          className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-all font-bold text-sm shadow-sm shrink-0 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(isScanning && 'animate-spin')} />
          <span className="hidden sm:inline text-xs">فحص</span>
        </button>
      </div>

      {/* Row 2: Read/All + Period */}
      <div className="flex items-center justify-between gap-3 px-5 pb-3">
        <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
          {(['unread', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-black transition-all',
                activeFilter === f
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {f === 'unread' ? `غير مقروء${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'الكل'}
            </button>
          ))}
        </div>

        <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-black transition-all',
                activePeriod === p
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {p === 'today' ? 'اليوم' : p === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Category tabs */}
      <div className="flex items-center gap-1.5 px-5 pb-3 overflow-x-auto scrollbar-hide">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.id === 'all' ? totalCount : (columnCounts[tab.id] ?? 0);
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onCategoryChange(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0',
                isActive
                  ? tab.activeColor + ' shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              <Icon size={11} className={isActive ? '' : tab.color} />
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    'text-[9px] font-black px-1 rounded-full',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
