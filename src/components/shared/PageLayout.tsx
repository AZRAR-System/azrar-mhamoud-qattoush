import React from 'react';
import { DS } from '@/constants/designSystem';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * التخطيط الموحد للصفحة - يضمن اتساق المسافات والترتيب
 * Header -> Stats -> Filters -> Content
 */
export const PageLayout: React.FC<PageLayoutProps> = ({ children, className }) => {
  return (
    <div className={`${DS.layout.pageWrap} ${className || ''}`} dir="rtl">
      {children}
    </div>
  );
};
