import React from 'react';
import { Search, Plus, Filter, Download, Activity, Users, ShieldAlert, BarChart3, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { PaginationControls } from '@/components/shared/PaginationControls';

interface LogFilter {
  user: string;
  action: string;
  dateFrom: string;
  dateTo: string;
}

interface AdminSmartFilterBarProps {
  activeTab: 'analytics' | 'activity' | 'users' | 'blacklist';
  // Logs
  logFilter: LogFilter;
  setLogFilter?: (f: LogFilter) => void;
  onExportLogs?: () => void;
  onRefreshLogs?: () => void;
  logsCount?: number;
  logsPage?: number;
  logsPageCount?: number;
  setLogsPage?: (p: number) => void;
  // Users
  userSearch?: string;
  setUserSearch?: (s: string) => void;
  onAddUser?: () => void;
  usersCount?: number;
  usersPage?: number;
  usersPageCount?: number;
  setUsersPage?: (p: number) => void;
  // Blacklist
  blacklistSearch?: string;
  setBlacklistSearch?: (s: string) => void;
  showArchivedBlacklist?: boolean;
  setShowArchivedBlacklist?: (val: boolean) => void;
  blacklistCount?: number;
  // Analytics actions
  onRefreshAnalytics?: () => void;
}

export const AdminSmartFilterBar: React.FC<AdminSmartFilterBarProps> = (props) => {
  const { activeTab } = props;

  const renderActions = () => {
    switch (activeTab) {
      case 'activity':
        return (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={props.onRefreshLogs}
              leftIcon={<RefreshCw size={18} />}
              className="bg-white dark:bg-slate-800"
            >
              تحديث السجل
            </Button>
            <Button
              variant="primary"
              onClick={props.onExportLogs}
              leftIcon={<Download size={18} />}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
            >
              تصدير Excel
            </Button>
          </div>
        );
      case 'users':
        return (
          <Button
            variant="primary"
            onClick={props.onAddUser}
            leftIcon={<Plus size={18} />}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6"
          >
            مستخدم جديد
          </Button>
        );
      case 'blacklist':
        return (
          <label className="flex items-center gap-2 cursor-pointer text-sm font-black text-slate-700 dark:text-slate-300 select-none bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-indigo-600"
              checked={props.showArchivedBlacklist}
              onChange={(e) => props.setShowArchivedBlacklist?.(e.target.checked)}
            />
            عرض السجلات المرفوعة (الأرشيف)
          </label>
        );
      default:
        return (
          <Button
             variant="secondary"
             onClick={props.onRefreshAnalytics}
             leftIcon={<RefreshCw size={18} />}
             className="bg-white dark:bg-slate-800"
           >
             تحديث البيانات العملياتية
           </Button>
        );
    }
  };

  const renderFilters = () => {
    switch (activeTab) {
      case 'activity':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            <div className="relative group">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" />
              <Input
                placeholder="الموظف..."
                className="pr-9 py-2 text-xs"
                value={props.logFilter.user}
                onChange={(e) => props.setLogFilter?.({ ...props.logFilter, user: e.target.value })}
              />
            </div>
            <div className="relative group">
              <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" />
              <Input
                placeholder="نوع الإجراء..."
                className="pr-9 py-2 text-xs"
                value={props.logFilter.action}
                onChange={(e) => props.setLogFilter?.({ ...props.logFilter, action: e.target.value })}
              />
            </div>
            <Input
              type="date"
              className="py-2 text-xs"
              value={props.logFilter.dateFrom}
              onChange={(e) => props.setLogFilter?.({ ...props.logFilter, dateFrom: e.target.value })}
              placeholder="من تاريخ"
            />
            <Input
              type="date"
              className="py-2 text-xs"
              value={props.logFilter.dateTo}
              onChange={(e) => props.setLogFilter?.({ ...props.logFilter, dateTo: e.target.value })}
              placeholder="إلى تاريخ"
            />
          </div>
        );
      case 'users':
        return (
          <div className="relative group max-w-sm w-full">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" />
            <Input
              value={props.userSearch}
              onChange={(e) => props.setUserSearch?.(e.target.value)}
              placeholder="بحث عن مستخدم (الاسم، المعرف)..."
              className="pr-12"
            />
          </div>
        );
      case 'blacklist':
        return (
          <div className="relative group max-w-sm w-full">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" />
            <Input
              value={props.blacklistSearch}
              onChange={(e) => props.setBlacklistSearch?.(e.target.value)}
              placeholder="البحث في القائمة السوداء..."
              className="pr-12"
            />
          </div>
        );
      default:
        return null;
    }
  };

  const renderPaginationRow = () => {
    switch (activeTab) {
      case 'activity':
        return (
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
              <Activity size={14} className="text-indigo-500" />
              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                {props.logsCount?.toLocaleString()} سجل متوفر
              </span>
            </div>
            <PaginationControls
              page={props.logsPage ?? 1}
              pageCount={props.logsPageCount ?? 1}
              onPageChange={props.setLogsPage ?? (() => {})}
            />
          </div>
        );
      case 'users':
        return (
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
              <Users size={14} className="text-indigo-500" />
              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                {props.usersCount?.toLocaleString()} مستخدم
              </span>
            </div>
            <PaginationControls
              page={props.usersPage ?? 1}
              pageCount={props.usersPageCount ?? 1}
              onPageChange={props.setUsersPage ?? (() => {})}
            />
          </div>
        );
      case 'blacklist':
        return (
          <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-800/50 text-rose-600 dark:text-rose-400">
            <ShieldAlert size={14} />
            <span className="text-xs font-black">
              {props.blacklistCount} سجلات محظورة
            </span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400">
            <BarChart3 size={14} />
            <span className="text-xs font-black">
              تحليلات حية للنظام
            </span>
          </div>
        );
    }
  };

  return (
    <SmartFilterBar
      actions={renderActions()}
      filters={renderFilters()}
      pagination={renderPaginationRow()}
    />
  );
};
