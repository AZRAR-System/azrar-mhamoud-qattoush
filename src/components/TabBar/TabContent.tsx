import React from 'react';
import { useTabs } from '@/context/TabsContext';
import { RouterPage } from './RouterPage';

export const TabContent: React.FC = () => {
  const { tabs, activeTabId } = useTabs();

  return (
    <div className="w-full h-auto relative">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`w-full h-auto absolute inset-0 transition-opacity duration-200 ${tab.id === activeTabId ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}
          style={{ position: tab.id === activeTabId ? 'relative' : 'absolute' }}
        >
          <RouterPage path={tab.path} />
        </div>
      ))}
    </div>
  );
};
