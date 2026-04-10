import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ROUTE_PATHS } from '@/routes/paths';

export type Tab = {
  id: string;
  path: string;
  title: string;
  icon: string; // Icon name or emoji string
  isPinned: boolean;
  isModified: boolean;
};

type TabsState = {
  tabs: Tab[];
  activeTabId: string;
};

type TabsActions = {
  openTab: (path: string, title: string, icon: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  pinTab: (id: string) => void;
  reorderTabs: (from: number, to: number) => void;
  markModified: (id: string, modified: boolean) => void;
  switchToNext: () => void;
  switchToPrev: () => void;
};

const TabsContext = createContext<(TabsState & TabsActions) | undefined>(undefined);

const STORAGE_KEY = 'azrar_tabs_state_v1';
const MAX_TABS = 8;
const HOME_PATH = ROUTE_PATHS.DASHBOARD;

const DEFAULT_TABS: Tab[] = [
  {
    id: 'home',
    path: HOME_PATH,
    title: 'الرئيسية',
    icon: '🏠',
    isPinned: true,
    isModified: false,
  },
];

export const TabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TabsState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.tabs && parsed.tabs.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    return { tabs: DEFAULT_TABS, activeTabId: 'home' };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const openTab = useCallback((path: string, title: string, icon: string) => {
    setState((prev) => {
      // Check if already open
      const existing = prev.tabs.find((t) => t.path === path);
      if (existing) {
        return { ...prev, activeTabId: existing.id };
      }

      // Check limit
      if (prev.tabs.length >= MAX_TABS) {
        // Find first unpinned tab to replace, or just don't open
        return prev;
      }

      const newTab: Tab = {
        id: Math.random().toString(36).substr(2, 9),
        path,
        title,
        icon,
        isPinned: false,
        isModified: false,
      };

      return {
        tabs: [...prev.tabs, newTab],
        activeTabId: newTab.id,
      };
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    setState((prev) => {
      // Don't close home/pinned if it's the only one
      if (id === 'home' || prev.tabs.find(t => t.id === id)?.isPinned) return prev;
      
      const newTabs = prev.tabs.filter((t) => t.id !== id);
      let newActiveId = prev.activeTabId;

      if (prev.activeTabId === id) {
        // Switch to adjacent tab
        const idx = prev.tabs.findIndex((t) => t.id === id);
        newActiveId = newTabs[Math.max(0, idx - 1)].id;
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    });
  }, []);

  const switchTab = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeTabId: id }));
  }, []);

  const pinTab = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === id ? { ...t, isPinned: !t.isPinned } : t)),
    }));
  }, []);

  const reorderTabs = useCallback((from: number, to: number) => {
    setState((prev) => {
      const newTabs = [...prev.tabs];
      const [moved] = newTabs.splice(from, 1);
      newTabs.splice(to, 0, moved);
      return { ...prev, tabs: newTabs };
    });
  }, []);

  const markModified = useCallback((id: string, modified: boolean) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === id ? { ...t, isModified: modified } : t)),
    }));
  }, []);

  const switchToNext = useCallback(() => {
    setState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === prev.activeTabId);
      const nextIdx = (idx + 1) % prev.tabs.length;
      return { ...prev, activeTabId: prev.tabs[nextIdx].id };
    });
  }, []);

  const switchToPrev = useCallback(() => {
    setState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === prev.activeTabId);
      const prevIdx = (idx - 1 + prev.tabs.length) % prev.tabs.length;
      return { ...prev, activeTabId: prev.tabs[prevIdx].id };
    });
  }, []);

  return (
    <TabsContext.Provider
      value={{
        ...state,
        openTab,
        closeTab,
        switchTab,
        pinTab,
        reorderTabs,
        markModified,
        switchToNext,
        switchToPrev,
      }}
    >
      {children}
    </TabsContext.Provider>
  );
};

export const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within a TabsProvider');
  }
  return context;
};
