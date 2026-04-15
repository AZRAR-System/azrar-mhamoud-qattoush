import React from 'react';
import { QuickActionsBar } from '@/components/dashboard/layers/QuickActionsBar';
import { Plus } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const QuickAddPanel: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/20" dir="rtl">
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Plus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white">إضافة سجل جديد</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Select what you want to create</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-xl border border-slate-200/60 dark:border-slate-800">
            <QuickActionsBar variant="inline" />
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-2">تلميحة</h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                يمكنك الضغط على <strong>Ctrl+N</strong> في أي وقت ومن أي مكان في النظام للوصول لهذه القائمة بشكل فوري.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
