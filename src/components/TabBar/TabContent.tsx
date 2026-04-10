import React from 'react';
import { useTabs } from '@/context/TabsContext';
import { RouterPage } from './RouterPage';

export const TabContent: React.FC = () => {
  const { tabs, activeTabId } = useTabs();

  return (
    <div className="flex-1 relative w-full h-full overflow-hidden">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="absolute inset-0 w-full h-full overflow-auto bg-slate-50 dark:bg-slate-950"
          style={{ 
            display: tab.id === activeTabId ? 'block' : 'none',
            zIndex: tab.id === activeTabId ? 10 : 0 
          }}
        >
          <RouterPage path={tab.path} />
        </div>
      ))}
    </div>
  );
};
