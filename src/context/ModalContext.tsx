import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface PanelProps extends Record<string, unknown> {
  title?: ReactNode;
  message?: ReactNode;
  confirmText?: ReactNode;
  cancelText?: ReactNode | null;
  showCancel?: boolean;
  variant?: string;
  onClose?(): void;
  onConfirm?(value?: string): void;
  onCancel?(): void;
}

export type PanelType =
  | 'PERSON_DETAILS'
  | 'PROPERTY_DETAILS'
  | 'CONTRACT_DETAILS'
  | 'INSTALLMENT_DETAILS'
  | 'MAINTENANCE_DETAILS'
  | 'GENERIC_ALERT'
  | 'REPORT_VIEWER'
  | 'LEGAL_NOTICE_GENERATOR'
  | 'BULK_WHATSAPP'
  | 'CONTRACT_WHATSAPP_SEND'
  | 'CONFIRM_MODAL'
  | 'SALES_LISTING_DETAILS'
  | 'CLEARANCE_REPORT'
  | 'CLEARANCE_WIZARD'
  | 'PERSON_FORM'
  | 'PROPERTY_FORM'
  | 'CONTRACT_FORM'
  | 'INSPECTION_FORM'
  | 'BLACKLIST_FORM'
  | 'SMART_PROMPT'
  | 'CALENDAR_EVENTS'
  | 'PAYMENT_NOTIFICATIONS'
  | 'NOTIFICATION_CENTER'
  | 'NOTIFICATION_TEMPLATES'
  | 'SECTION_VIEW'
  | 'SERVER_DRAWER'
  | 'SQL_SYNC_LOG'
  | 'MARQUEE_ADS'
  | 'FINANCIAL_REPORT_PRINT'
  | 'SHORTCUTS_HELP'
  | 'QUICK_ADD';

export interface Panel {
  id: string;
  type: PanelType;
  dataId?: string;
  props?: PanelProps;
}

interface ModalContextType {
  activePanels: Panel[];
  drawerHistory: Panel[];
  historyIndex: number;
  openPanel: (type: PanelType, dataId?: string, props?: PanelProps) => void;
  closePanel: (id: string) => void;
  closeAll: () => void;
  navigateBack: () => void;
  navigateForward: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

// Panels that support history (drawn as slide-overs)
const HISTORY_SUPPORTED_PANELS: PanelType[] = [
  'PERSON_DETAILS',
  'PROPERTY_DETAILS',
  'CONTRACT_DETAILS',
  'SALES_LISTING_DETAILS',
  'REPORT_VIEWER',
  'LEGAL_NOTICE_GENERATOR',
  'CLEARANCE_REPORT',
  'CLEARANCE_WIZARD',
  'PAYMENT_NOTIFICATIONS',
  'NOTIFICATION_CENTER',
  'NOTIFICATION_TEMPLATES',
  'SECTION_VIEW',
  'CONTRACT_WHATSAPP_SEND',
  'MARQUEE_ADS',
  'CALENDAR_EVENTS',
  'SQL_SYNC_LOG',
  'FINANCIAL_REPORT_PRINT',
];

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activePanels, setActivePanels] = useState<Panel[]>([]);
  const [drawerHistory, setDrawerHistory] = useState<Panel[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const openPanel = (type: PanelType, dataId?: string, props?: PanelProps) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newPanel: Panel = { id, type, dataId, props };

    if (HISTORY_SUPPORTED_PANELS.includes(type)) {
      setDrawerHistory((prev) => {
        // Truncate future history if we're opening something new from back-state
        const truncated = prev.slice(0, historyIndex + 1);
        const next = [...truncated, newPanel];
        setHistoryIndex(next.length - 1);
        return next;
      });
      // For drawers, we replace the single active "drawer" slot in activePanels
      // so the back/forward experience feels like a single window/tab
      setActivePanels((prev) => {
        const others = prev.filter(p => !HISTORY_SUPPORTED_PANELS.includes(p.type));
        return [...others, newPanel];
      });
    } else {
      // Regular modals just stack on top
      setActivePanels((prev) => [...prev, newPanel]);
    }
  };

  const closePanel = (id: string) => {
    setActivePanels((prev) => {
      const closing = prev.find(p => p.id === id);
      if (closing && HISTORY_SUPPORTED_PANELS.includes(closing.type)) {
        setDrawerHistory([]);
        setHistoryIndex(-1);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const closeAll = () => {
    setActivePanels([]);
    setDrawerHistory([]);
    setHistoryIndex(-1);
  };

  const navigateBack = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      const panel = drawerHistory[prevIdx];
      setActivePanels((prev) => {
        const others = prev.filter(p => !HISTORY_SUPPORTED_PANELS.includes(p.type));
        return [...others, panel];
      });
    }
  };

  const navigateForward = () => {
    if (historyIndex < drawerHistory.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      const panel = drawerHistory[nextIdx];
      setActivePanels((prev) => {
        const others = prev.filter(p => !HISTORY_SUPPORTED_PANELS.includes(p.type));
        return [...others, panel];
      });
    }
  };

  return (
    <ModalContext.Provider 
      value={{ 
        activePanels, 
        drawerHistory, 
        historyIndex, 
        openPanel, 
        closePanel, 
        closeAll, 
        navigateBack, 
        navigateForward 
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useSmartModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useSmartModal must be used within a ModalProvider');
  }
  return context;
};
