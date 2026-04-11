import React from 'react';
import { useTabs } from '@/context/TabsContext';
import { RouterPage } from './RouterPage';

export const TabContent: React.FC = () => {
  const { tabs, activeTabId } = useTabs();

  return (
    <div className="w-full h-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="w-full h-auto"
          style={{ 
            display: tab.id === activeTabId ? 'block' : 'none'
          }}
        >
          <RouterPage path={tab.path} />
        </div>
      ))}
    </div>
  );
};
