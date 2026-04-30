import React, { createContext, useContext } from 'react';

const EmbeddedViewContext = createContext<boolean>(false);

export const EmbeddedViewProvider: React.FC<{ value?: boolean; children: React.ReactNode }> = ({
  value = true,
  children,
}) => {
  return <EmbeddedViewContext.Provider value={value}>{children}</EmbeddedViewContext.Provider>;
};

/**
 * Use this at panel/modal boundaries.
 * It provides context + a DOM marker so global CSS can target embedded layouts safely.
 */
export const EmbeddedViewRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <EmbeddedViewProvider>
      <div data-embedded-view className="min-h-0 min-w-0 w-full">
        {children}
      </div>
    </EmbeddedViewProvider>
  );
};

export function useIsEmbeddedView(): boolean {
  return useContext(EmbeddedViewContext);
}

