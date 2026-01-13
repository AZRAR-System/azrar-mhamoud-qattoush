
import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  | 'SECTION_VIEW'
  | 'SERVER_DRAWER'
  | 'SQL_SYNC_LOG'
  | 'MARQUEE_ADS';

export interface Panel {
  id: string;
  type: PanelType;
  dataId?: string;
  props?: any;
}

interface ModalContextType {
  activePanels: Panel[];
  openPanel: (type: PanelType, dataId?: string, props?: any) => void;
  closePanel: (id: string) => void;
  closeAll: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activePanels, setActivePanels] = useState<Panel[]>([]);

  const openPanel = (type: PanelType, dataId?: string, props?: any) => {
    const id = Math.random().toString(36).substr(2, 9);
    setActivePanels((prev) => [...prev, { id, type, dataId, props }]);
  };

  const closePanel = (id: string) => {
    setActivePanels((prev) => prev.filter((p) => p.id !== id));
  };

  const closeAll = () => {
    setActivePanels([]);
  };

  return (
    <ModalContext.Provider value={{ activePanels, openPanel, closePanel, closeAll }}>
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