import React from 'react';
import { 
  CheckCheck, 
  MessageSquare, 
  Archive, 
  X,
  Zap
} from 'lucide-react';

interface NotificationBulkBarProps {
  selectedCount: number;
  onMarkRead: () => void;
  onBulkWhatsApp: () => void;
  onArchive: () => void;
  onClear: () => void;
}

export const NotificationBulkBar: React.FC<NotificationBulkBarProps> = ({
  selectedCount,
  onMarkRead,
  onBulkWhatsApp,
  onArchive,
  onClear,
}) => {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-indigo-500/20 animate-slide-up">
      <div className="flex items-center gap-3 pr-4 border-l border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white shadow-lg">
          <Zap size={16} fill="currentColor" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-800 dark:text-white leading-none">تحديد {selectedCount} إشعارات</p>
          <button 
            onClick={onClear}
            className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 transition-colors mt-1 flex items-center gap-1"
          >
            إلغاء التحديد <X size={10} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onMarkRead}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all text-xs font-black"
        >
          <CheckCheck size={16} />
          تعليم مقروء
        </button>
        <button
          onClick={onBulkWhatsApp}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all text-xs font-black"
        >
          <MessageSquare size={16} />
          واتساب جماعي
        </button>
        <button
          onClick={onArchive}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all text-xs font-black"
        >
          <Archive size={16} />
          أرشفة
        </button>
      </div>
    </div>
  );
};
