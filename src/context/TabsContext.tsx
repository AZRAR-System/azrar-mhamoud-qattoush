import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ROUTE_PATHS } from '@/routes/paths';
import { useAuth } from './AuthContext';

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

const MAX_TABS = 10;
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
  const { user } = useAuth();
  const userId = user ? String(user.id || (user as unknown as { اسم_المستخدم: string }).اسم_المستخدم || '').trim() : null;
  const STORAGE_KEY = userId ? `azrar_tabs_v2_${userId}` : null;

  const [state, setState] = useState<TabsState>({ tabs: DEFAULT_TABS, activeTabId: 'home' });

  // تنظيف الكاش القديم من النسخ السابقة
  useEffect(() => {
    localStorage.removeItem('azrar_tabs_state_v1');
  }, []);

  // Load user-specific tabs on login
  useEffect(() => {
    if (STORAGE_KEY) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.tabs && parsed.tabs.length > 0) {
            setState(parsed);
            return;
          }
        } catch {
          // ignore
        }
      }
    }
    // If no storage key (logged out) or no saved data, reset to default
    setState({ tabs: DEFAULT_TABS, activeTabId: 'home' });
  }, [STORAGE_KEY]);

  // Save pinned tabs on change
  useEffect(() => {
    if (STORAGE_KEY && state.tabs.length > 0) {
      // Per user request: Only pinned tabs are permanently stored
      const stateToSave = {
        ...state,
        tabs: state.tabs.filter(t => t.isPinned)
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [state, STORAGE_KEY]);


  const openTab = useCallback((path: string, title: string, icon: string) => {
    setState((prev) => {
      // 1. If page is already open, just switch to it
      const existingIdx = prev.tabs.findIndex((t) => t.path === path);
      if (existingIdx !== -1) {
        return { ...prev, activeTabId: prev.tabs[existingIdx].id };
      }

      // 2. Look for a "preview" tab (the active tab if unpinned OR the first unpinned one)
      // We prioritize replacing the active tab if it's unpinned and not being modified
      const activeTab = prev.tabs.find(t => t.id === prev.activeTabId);
      const canReplaceActive = activeTab && !activeTab.isPinned && !activeTab.isModified;
      
      const replaceIdx = canReplaceActive 
        ? prev.tabs.findIndex(t => t.id === prev.activeTabId)
        : prev.tabs.findIndex(t => !t.isPinned && !t.isModified);

      if (replaceIdx !== -1) {
        const newTabs = [...prev.tabs];
        newTabs[replaceIdx] = {
          ...newTabs[replaceIdx],
          path,
          title,
          icon,
          isPinned: false,
        };
        return {
          ...prev,
          tabs: newTabs,
          activeTabId: newTabs[replaceIdx].id,
        };
      }

      // 3. Otherwise, create a new tab if within limits
      if (prev.tabs.length >= MAX_TABS) return prev;

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
      const targetTab = prev.tabs.find(t => t.id === id);
      if (!targetTab || targetTab.isPinned) return prev;
      
      const filteredTabs = prev.tabs.filter((t) => t.id !== id);

      // If no tabs left, reset to default home (but honor system choice)
      if (filteredTabs.length === 0) {
        return { tabs: DEFAULT_TABS, activeTabId: 'home' };
      }

      let newActiveId = prev.activeTabId;
      if (prev.activeTabId === id) {
        const idx = prev.tabs.findIndex((t) => t.id === id);
        newActiveId = filteredTabs[Math.max(0, idx - 1)].id;
      }

      return {
        tabs: filteredTabs,
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
