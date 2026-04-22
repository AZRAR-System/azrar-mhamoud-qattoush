import React from 'react';
import { Search, Plus, Copy, FileText, Clock } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';

interface LegalSmartFilterBarProps {
  historySearch: string;
  setHistorySearch: (val: string) => void;
  onAddTemplate: () => void;
  onOpenVariables: () => void;
  templatesCount: number;
  historyCount: number;
}

export const LegalSmartFilterBar: React.FC<LegalSmartFilterBarProps> = ({
  historySearch,
  setHistorySearch,
  onAddTemplate,
  onOpenVariables,
  templatesCount,
  historyCount,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            className="bg-purple-600 hover:bg-purple-700 text-white font-black px-6 shadow-lg shadow-purple-500/20"
            onClick={onAddTemplate}
            leftIcon={<Plus size={18} />}
          >
            نموذج جديد
          </Button>
          <Button
            variant="secondary"
            onClick={onOpenVariables}
            leftIcon={<Copy size={18} />}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6"
          >
            دليل المتغيرات
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
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="البحث في سجل الإخطارات (اسم المستأجر، رقم العقد، نوع الإخطار)..."
            className="pr-12 py-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm"
          />
        </div>
      }
      pagination={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-xl border border-purple-100 dark:border-purple-800/50">
            <FileText size={14} className="text-purple-500" />
            <span className="text-xs font-black text-purple-700 dark:text-purple-300">
              {templatesCount} نماذج محفوظة
            </span>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400">
            <Clock size={14} />
            <span className="text-xs font-black">
              {historyCount} إخطارات سابقة
            </span>
          </div>
        </div>
      }
    />
  );
};
