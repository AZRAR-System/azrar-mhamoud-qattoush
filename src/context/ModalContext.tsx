import React, { createContext, useContext, useState, ReactNode, startTransition } from 'react';
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
  /**
   * Internal: allow stacking slide-over panels (open multiple at once) instead of using the
   * single-drawer history slot behavior.
   */
  __stack?: boolean;
  /** Internal: force centered modal (not slide-over). */
  __centerModal?: boolean;
  /** Internal: allow minimize-to-bottom behavior (centered modals). */
  __minimizable?: boolean;
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
  bringToFront: (id: string) => void;
  navigateBack: () => void;
  navigateForward: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);
const DEDUPE_WINDOW_MS = 900;

/**
 * Lightweight fingerprint for dedupe (avoid expensive JSON.stringify on large/ReactNode props).
 * Only includes small, stable, serializable bits that actually affect the opened panel identity.
 */
const dedupeFingerprint = (props?: PanelProps): string => {
  if (!props) return '';
  const p = props as Record<string, unknown>;
  const intent = (p.alertsIntent || null) as AlertPanelIntent | null;
  const alertKind = String(p.__alertModalKind || '');
  const payload = p.alertActionPayload as Record<string, unknown> | undefined;
  const panelTitle = typeof p.title === 'string' ? p.title.trim() : '';
  const intentTitle = typeof intent?.title === 'string' ? intent.title.trim() : '';

  const parts: string[] = [];
  if (alertKind) parts.push(`k=${alertKind}`);
  if (panelTitle) parts.push(`pt=${panelTitle}`);
  if (intentTitle) parts.push(`t=${intentTitle}`);

  if (intent) {
    if (intent.only) parts.push(`only=${intent.only}`);
    if (intent.category !== undefined) parts.push(`cat=${String(intent.category)}`);
    if (intent.q !== undefined) parts.push(`q=${String(intent.q)}`);
    if (intent.id) parts.push(`id=${String(intent.id)}`);
  }

  // Keep payload fingerprint shallow (ids/refs only) to avoid huge objects.
  if (payload) {
    const idishKeys = ['installmentId', 'contractId', 'personId', 'propertyId', 'caseRef', 'entityId'];
    for (const k of idishKeys) {
      if (payload[k] !== undefined) parts.push(`${k}=${String(payload[k])}`);
    }
  }

  return parts.join('&');
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
    const dedupeKey = [type, dataId || '', dedupeFingerprint(props)].join('|');
    const now = Date.now();
    if (
      lastOpenRef.current.key === dedupeKey &&
      now - lastOpenRef.current.ts < DEDUPE_WINDOW_MS
    ) {
      return;
    }
    lastOpenRef.current = { key: dedupeKey, ts: now };

    const id = Math.random().toString(36).substr(2, 9);
    const normalizedProps: PanelProps = {
      ...(props || {}),
      // Default behavior: centered + minimizable for all panels (except confirm),
      // and allow opening multiple windows at once.
      __centerModal: props?.__centerModal ?? type !== 'CONFIRM_MODAL',
      __minimizable: props?.__minimizable ?? type !== 'CONFIRM_MODAL',
      __stack: props?.__stack ?? true,
    };
    const newPanel: Panel = {
      id,
      type,
      dataId,
      props: { ...normalizedProps, __dedupeKey: dedupeKey },
    };

    // Always stack: allow multiple windows/pages/modals open simultaneously.
    startTransition(() => {
      setActivePanels((prev) => [...prev, newPanel]);
    });
  };

  const openModal: OpenModalFn = (kind, props) => {
    openPanel('GENERIC_ALERT', kind, { ...props, __alertModalKind: kind });
  };

  const closePanel = (id: string) => {
    setActivePanels((prev) => {
      const closing = prev.find(p => p.id === id);
      if (closing && HISTORY_SUPPORTED_PANELS.includes(closing.type) && !closing.props?.__stack) {
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

  const bringToFront = (id: string) => {
    startTransition(() => {
      setActivePanels((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx === -1) return prev;
        if (idx === prev.length - 1) return prev;
        const target = prev[idx];
        const next = prev.slice(0, idx).concat(prev.slice(idx + 1));
        return [...next, target];
      });
    });
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
        bringToFront,
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
