import React from 'react';
import { DS } from '@/constants/designSystem';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, action, footer }) => {
  return (
    <div className={`${DS.components.card} overflow-hidden flex flex-col ${className}`}>
      {(title || action) && (
        <div className="px-6 py-4 border-b border-slate-200/70 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-950/40">
          {title && <h3 className="font-bold text-lg text-slate-900 dark:text-white">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-0 flex-1">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          {footer}
        </div>
      )}
    </div>
  );
};
