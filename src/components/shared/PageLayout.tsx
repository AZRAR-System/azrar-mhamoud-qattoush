import React from 'react';
import { DS } from '@/constants/designSystem';
import { useIsEmbeddedView } from '@/context/EmbeddedViewContext';

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
  const embedded = useIsEmbeddedView();
  // داخل النوافذ (Embedded) نُفضّل استخدام عرض النافذة بالكامل مع padding متناسق،
  // بدل تضييق العرض الذي قد يجعل البطاقات/الجريد صغيرة جداً.
  const effectiveContain = embedded ? false : (containWidth ?? false);
  return (
    <div
      className={`${DS.layout.pageWrap}${embedded ? ' space-y-6 min-h-0 min-w-0 w-full px-4 sm:px-6 lg:px-8' : ''}${
        effectiveContain ? ` ${DS.layout.pageShell}` : ''
      }${className ? ` ${className}` : ''}`}
      dir="rtl"
    >
      {children}
    </div>
  );
};
