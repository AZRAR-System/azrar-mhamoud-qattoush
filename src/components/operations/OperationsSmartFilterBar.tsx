import React from 'react';
import { Search, RefreshCcw, FileText, Wallet, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';

interface OperationsSmartFilterBarProps {
  search: string;
  setSearch: (val: string) => void;
  onRefresh: () => void;
  onReset?: () => void;
  currentStep: string;
  totalContracts: number;
  pendingCount: number;
}

export const OperationsSmartFilterBar: React.FC<OperationsSmartFilterBarProps> = ({
  search,
  setSearch,
  onRefresh,
  onReset,
  currentStep,
  totalContracts,
  pendingCount,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={onRefresh}
            leftIcon={<RefreshCcw size={18} />}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6"
          >
            تحديث البيانات
          </Button>
          {currentStep !== 'select-contract' && onReset && (
            <Button
              variant="secondary"
              onClick={onReset}
              leftIcon={<RotateCcw size={18} />}
              className="border-amber-200 text-amber-700 dark:border-amber-900/30 dark:text-amber-400 font-black px-6"
            >
              إعادة البدء
            </Button>
          )}
        </div>
      }
      filters={
        currentStep === 'select-contract' ? (
          <div className="relative group max-w-xl w-full">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في العقود (اسم المستأجر، رقم العقد، كود العقار)..."
              className="pr-12 py-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm"
            />
          </div>
        ) : null
      }
      pagination={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <FileText size={14} className="text-indigo-500" />
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
              {totalContracts.toLocaleString()} عقد متاح
            </span>
          </div>
          {currentStep !== 'select-contract' && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-800/50 text-amber-600 dark:text-amber-400">
              <Wallet size={14} />
              <span className="text-xs font-black">
                {pendingCount} دفعات معلقة
              </span>
            </div>
          )}
        </div>
      }
    />
  );
};
