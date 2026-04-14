import React from 'react';
import { useTabs } from '@/context/TabsContext';
import { RouterPage } from './RouterPage';

export const TabContent: React.FC = () => {
  const { tabs, activeTabId } = useTabs();

  return (
    <div className="w-full h-auto relative bg-transparent">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="w-full h-auto transition-opacity duration-150 ease-in-out"
          style={{
            display: tab.id === activeTabId ? 'block' : 'none',
            opacity: tab.id === activeTabId ? 1 : 0,
          }}
        >
          <RouterPage path={tab.path} />
        </div>
      ))}
    </div>
  );
};
