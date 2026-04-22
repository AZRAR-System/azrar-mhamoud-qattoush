import React from 'react';
import { Search, Plus, RefreshCcw, HardDrive, FileArchive } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';

interface BackupSmartFilterBarProps {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  onNewBackup: () => void;
  onRefresh: () => void;
  loading: boolean;
  totalBackups: number;
  totalSize: string;
}

export const BackupSmartFilterBar: React.FC<BackupSmartFilterBarProps> = ({
  searchTerm,
  setSearchTerm,
  onNewBackup,
  onRefresh,
  loading,
  totalBackups,
  totalSize,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={onNewBackup}
            leftIcon={<Plus size={20} />}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 shadow-lg shadow-blue-500/20"
          >
            نسخة احتياطية جديدة
          </Button>
          <Button
            variant="secondary"
            onClick={onRefresh}
            disabled={loading}
            leftIcon={<RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6"
          >
            تحديث البيانات
          </Button>
        </div>
      }
      filters={
        <div className="relative group max-w-xl w-full">
          <Search
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث في قائمة النسخ الاحتياطية (الاسم، التاريخ)..."
            className="pr-12 py-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm"
          />
        </div>
      }
      pagination={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-800/50">
            <FileArchive size={14} className="text-blue-500" />
            <span className="text-xs font-black text-blue-700 dark:text-blue-300">
              {totalBackups} ملفات أرشفة
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <HardDrive size={14} />
            <span className="text-xs font-black">
              {totalSize} مستخدمة
            </span>
          </div>
        </div>
      }
    />
  );
};
