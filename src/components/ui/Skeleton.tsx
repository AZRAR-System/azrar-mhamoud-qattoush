import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, count = 1 }) => {
  return (
    <div className="space-y-2 w-full animate-pulse">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className={`bg-slate-200 dark:bg-slate-700 rounded-lg ${className || 'h-4 w-full'}`}
        />
      ))}
    </div>
  );
};
