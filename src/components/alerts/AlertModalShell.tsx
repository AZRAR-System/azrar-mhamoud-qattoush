import React from 'react';
import { AppModal } from '@/components/ui/AppModal';
import { X } from 'lucide-react';

interface AlertModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  sourcesBar?: React.ReactNode;
  sectionContext?: React.ReactNode;
  sectionPreview?: React.ReactNode;
  sectionInput?: React.ReactNode;
  footerNote?: string;
  footerButtons?: React.ReactNode;
}

export const AlertModalShell: React.FC<AlertModalShellProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon,
  sourcesBar,
  sectionContext,
  sectionPreview,
  sectionInput,
  footerNote,
  footerButtons,
}) => {
  return (
    <AppModal open={open} onClose={onClose} size="lg" title={title} hideHeader={true}>
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">{icon}</div>}
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {sourcesBar && <div>{sourcesBar}</div>}
          {sectionContext && <div>{sectionContext}</div>}
          {sectionPreview && (
             <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
               {sectionPreview}
             </div>
          )}
          {sectionInput && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
              {sectionInput}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800">
          {footerNote && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-4 text-center italic">
              {footerNote}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            {footerButtons}
          </div>
        </div>
      </div>
    </AppModal>
  );
};
