import React from 'react';
import { X } from 'lucide-react';

export interface AlertModalShellProps {
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** شريط الشارات / المصادر */
  sourcesBar?: React.ReactNode;
  /** قسم سياق للقراءة */
  sectionContext?: React.ReactNode;
  /** حقول وإدخال */
  sectionInput?: React.ReactNode;
  /** معاينة اختيارية */
  sectionPreview?: React.ReactNode;
  footerNote?: React.ReactNode;
  footerButtons?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
}

/**
 * قشرة مودال موحّدة لطبقات التنبيهات (Header → Sources → أقسام → Footer).
 */
export const AlertModalShell: React.FC<AlertModalShellProps> = ({
  open,
  title,
  subtitle,
  icon,
  sourcesBar,
  sectionContext,
  sectionInput,
  sectionPreview,
  footerNote,
  footerButtons,
  onClose,
  children,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2047] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
        aria-label="إغلاق"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/80 dark:bg-slate-800/50">
          {icon ? (
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-700"
            aria-label="إغلاق النافذة"
          >
            <X size={20} />
          </button>
        </header>

        {sourcesBar ? (
          <div className="shrink-0 border-b border-slate-100 dark:border-slate-800 px-5 py-2 bg-white dark:bg-slate-900">
            {sourcesBar}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {sectionContext ? (
            <section className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">{sectionContext}</section>
          ) : null}
          {sectionInput ? (
            <section className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">{sectionInput}</section>
          ) : null}
          {sectionPreview ? <section className="px-5 py-4">{sectionPreview}</section> : null}
          {children ? <div className="px-5 py-4">{children}</div> : null}
        </div>

        <footer className="shrink-0 border-t border-slate-100 dark:border-slate-800 px-5 py-3 bg-slate-50/90 dark:bg-slate-800/80">
          {footerNote ? (
            <p className="mb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">{footerNote}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">{footerButtons}</div>
        </footer>
      </div>
    </div>
  );
};
