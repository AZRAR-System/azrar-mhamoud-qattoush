import React, { createContext, useContext, ReactNode } from 'react';

interface PageVisibilityContextType {
  isVisible: boolean;
}

const PageVisibilityContext = createContext<PageVisibilityContextType>({ isVisible: true });

export const PageVisibilityProvider: React.FC<{ isVisible: boolean; children: ReactNode }> = ({
  isVisible,
  children,
}) => {
  return (
    <PageVisibilityContext.Provider value={{ isVisible }}>
      {children}
    </PageVisibilityContext.Provider>
  );
};

export const usePageVisibility = () => useContext(PageVisibilityContext);
