import React, { createContext, useContext, useState, ReactNode } from 'react';
import type {
  AlertActionPayload,
  AlertLayerModalKind,
  AlertPanelIntent,
} from '@/services/alerts/alertActionTypes';
import type { tbl_Alerts } from '@/types';

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
  /** عند فتح قسم التنبيهات من `openAlertsInSection` */
  alertsIntent?: AlertPanelIntent;
  /** نوافذ التنبيهات المنبثقة عبر `openModal` */
  __alertModalKind?: AlertLayerModalKind;
  alertActionPayload?: AlertActionPayload;
  sourceAlert?: tbl_Alerts;
  onNavigateFull?: () => void;
  onOpenLegalGenerator?: () => void;
  onOpenContract?: () => void;
  onOpenMaintenance?: () => void;
}

/** فتح نافذة طبقة (GENERIC_ALERT + مكوّن متخصص حسب `__alertModalKind`) */
export type OpenModalFn = (kind: AlertLayerModalKind, props?: PanelProps) => void;

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
  openModal: OpenModalFn;
  closePanel: (id: string) => void;
  closeAll: () => void;
  navigateBack: () => void;
  navigateForward: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);
const DEDUPE_WINDOW_MS = 900;

const stableStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === 'function') return '__fn__';
      if (typeof v === 'bigint') return String(v);
      return v;
    });
  } catch {
    return String(value);
  }
};

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
  const lastOpenRef = React.useRef<{ key: string; ts: number }>({ key: '', ts: 0 });

  const openPanel = (type: PanelType, dataId?: string, props?: PanelProps) => {
    const dedupeKey = [type, dataId || '', stableStringify(props || {})].join('|');
    const now = Date.now();
    if (
      lastOpenRef.current.key === dedupeKey &&
      now - lastOpenRef.current.ts < DEDUPE_WINDOW_MS
    ) {
      return;
    }
    lastOpenRef.current = { key: dedupeKey, ts: now };

    const id = Math.random().toString(36).substr(2, 9);
    const newPanel: Panel = {
      id,
      type,
      dataId,
      props: { ...(props || {}), __dedupeKey: dedupeKey },
    };

    if (HISTORY_SUPPORTED_PANELS.includes(type)) {
      const existingActiveHistory = activePanels.find((p) =>
        HISTORY_SUPPORTED_PANELS.includes(p.type)
      );
      const existingKey = String(existingActiveHistory?.props?.__dedupeKey || '');
      if (existingActiveHistory && existingKey === dedupeKey) {
        return;
      }
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

  const openModal: OpenModalFn = (kind, props) => {
    openPanel('GENERIC_ALERT', kind, { ...props, __alertModalKind: kind });
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
        openModal,
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
