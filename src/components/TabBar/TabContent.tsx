import React from 'react';
import { useTabs } from '@/context/TabsContext';
import { RouterPage } from './RouterPage';
import { PageVisibilityProvider } from '@/context/PageVisibilityContext';

export const TabContent: React.FC = () => {
  const { tabs, activeTabId } = useTabs();

  return (
    <div className="w-full h-auto relative bg-transparent">
      {tabs.map((tab) => {
        const isVisible = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className="w-full h-auto transition-opacity duration-150 ease-in-out"
            style={{
              display: isVisible ? 'block' : 'none',
              opacity: isVisible ? 1 : 0,
            }}
          >
            <PageVisibilityProvider isVisible={isVisible}>
              <RouterPage path={tab.path} />
            </PageVisibilityProvider>
          </div>
        );
      })}
    </div>
  );
};
