import React from 'react';
import { Check, Loader2, Info, Settings as SettingsIcon } from 'lucide-react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';

interface SettingsSmartFilterBarProps {
  saveStatus: 'idle' | 'saving' | 'saved';
  activeSectionLabel: string;
}

export const SettingsSmartFilterBar: React.FC<SettingsSmartFilterBarProps> = ({
  saveStatus,
  activeSectionLabel,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 shadow-sm animate-pulse">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-black">جاري الحفظ تلقائياً...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
              <Check size={16} />
              <span className="text-xs font-black">كافة التغييرات محفوظة</span>
            </div>
          )}
        </div>
      }
      filters={
         <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
           <Info size={18} className="text-indigo-500" />
           <p className="text-sm font-bold">
             أنت الآن في قسم: <span className="text-slate-800 dark:text-white">{activeSectionLabel}</span>. يتم حفظ التعديلات فور إدخالها.
           </p>
         </div>
      }
      pagination={
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
          <SettingsIcon size={14} className="text-indigo-500" />
          <span className="text-xs font-black uppercase tracking-widest">
            Configuration Hub
          </span>
        </div>
      }
    />
  );
};
