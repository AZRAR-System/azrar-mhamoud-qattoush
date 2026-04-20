interface StatsCardRowProps {
  children: React.ReactNode;
  className?: string;
  /** 
   * Number of columns on large screens. 
   * Default is 4 (xl:grid-cols-4)
   */
  cols?: 2 | 3 | 4;
}

/**
 * صف بطاقات الإحصاء - يوزع البطاقات بشكل متجاوب
 * Default Grid: 1 col (mobile), 2 cols (sm), 4 cols (xl)
 */
export const StatsCardRow: React.FC<StatsCardRowProps> = ({ children, className, cols = 4 }) => {
  const gridColsClass = cols === 2 ? 'lg:grid-cols-2' : cols === 3 ? 'lg:grid-cols-3' : 'xl:grid-cols-4';
  
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridColsClass} gap-6 ${className || ''}`}>
      {children}
    </div>
  );
};
