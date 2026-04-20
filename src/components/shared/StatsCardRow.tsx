import React from 'react';

interface StatsCardRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * صف بطاقات الإحصاء - يوزع البطاقات بشكل متجاوب
 * Grid: 1 col (mobile), 2 cols (sm), 4 cols (xl)
 */
export const StatsCardRow: React.FC<StatsCardRowProps> = ({ children, className }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 ${className || ''}`}>
      {children}
    </div>
  );
};
