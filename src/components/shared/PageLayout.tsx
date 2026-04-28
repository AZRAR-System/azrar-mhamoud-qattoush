import React from 'react';
import { DS } from '@/constants/designSystem';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  /** Max-width + centering for new/refactored pages; default false to preserve wide dashboards */
  containWidth?: boolean;
}

/**
 * التخطيط الموحد للصفحة - يضمن اتساق المسافات والترتيب
 * Header -> Stats -> Filters -> Content
 */
export const PageLayout: React.FC<PageLayoutProps> = ({ children, className, containWidth }) => {
  return (
    <div
      className={`${DS.layout.pageWrap}${containWidth ? ` ${DS.layout.pageShell}` : ''}${className ? ` ${className}` : ''}`}
      dir="rtl"
    >
      {children}
    </div>
  );
};
