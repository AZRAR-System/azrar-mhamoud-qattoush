import React from 'react';
import { Search, FileText, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';

interface DocumentsSmartFilterBarProps {
  search: string;
  setSearch: (val: string) => void;
  totalCount: number;
  filteredCount: number;
}

export const DocumentsSmartFilterBar: React.FC<DocumentsSmartFilterBarProps> = ({
  search,
  setSearch,
  totalCount,
  filteredCount,
}) => {
  return (
    <SmartFilterBar
      filters={
        <div className="relative group max-w-xl w-full">
          <Search
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في اسم الملف أو المرجع (عقار، شخص، عقد)..."
            className="pr-12 py-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm"
          />
        </div>
      }
      pagination={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <FileText size={14} className="text-indigo-500" />
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
              {filteredCount.toLocaleString()} من {totalCount.toLocaleString()} مستند
            </span>
          </div>
          <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-xl border border-purple-100 dark:border-purple-800/50 text-purple-600 dark:text-purple-400">
            <ImageIcon size={14} />
            <span className="text-xs font-black">مرفقات مجمعة</span>
          </div>
        </div>
      }
    />
  );
};
