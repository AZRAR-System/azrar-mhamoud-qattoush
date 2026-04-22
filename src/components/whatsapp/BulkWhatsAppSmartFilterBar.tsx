import React from 'react';
import { Search, Users, MessageCircle, CheckCheck } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { PaginationControls } from '@/components/shared/PaginationControls';

interface BulkWhatsAppSmartFilterBarProps {
  q: string;
  setQ: (val: string) => void;
  onToggleSelectAll: () => void;
  selectedCount: number;
  totalCount: number;
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  isRunning: boolean;
}

export const BulkWhatsAppSmartFilterBar: React.FC<BulkWhatsAppSmartFilterBarProps> = ({
  q,
  setQ,
  onToggleSelectAll,
  selectedCount,
  totalCount,
  currentPage,
  pageCount,
  onPageChange,
  isRunning,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={onToggleSelectAll}
            disabled={isRunning || totalCount === 0}
            leftIcon={<CheckCheck size={18} />}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6"
          >
            تحديد/إلغاء الكل
          </Button>
          <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
            <Users size={18} className="text-indigo-500" />
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">{selectedCount}</span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">/ {totalCount} تم اختيارهم</span>
            </div>
          </div>
        </div>
      }
      filters={
        <div className="relative group max-w-xl w-full">
          <Search
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="البحث في جهات الاتصال..."
            className="pr-12 py-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm"
            disabled={isRunning}
          />
        </div>
      }
      pagination={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <MessageCircle size={16} />
            <span className="text-xs font-black">جاهز للإرسال</span>
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
