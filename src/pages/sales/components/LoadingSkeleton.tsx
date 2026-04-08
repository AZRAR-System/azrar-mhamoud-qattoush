import React from 'react';

const ANIMATIONS = {
  skeletonPulse: 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded'
};

export const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className={`app-card p-4 space-y-3 ${ANIMATIONS.skeletonPulse}`}>
        <div className="h-5 w-1/3 rounded" />
        <div className="h-4 w-1/2 rounded" />
        <div className="h-4 w-2/3 rounded" />
        <div className="flex gap-2 mt-2">
          <div className="h-8 w-20 rounded" />
          <div className="h-8 w-20 rounded" />
        </div>
      </div>
    ))}
  </div>
);