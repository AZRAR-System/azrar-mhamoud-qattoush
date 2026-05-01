import React, { useState, useCallback } from 'react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { 
  executeNavigateForAlert, 
  getAlertPrimarySpec, 
  resolveSecondaryActions 
} from '@/services/alerts/alertActionPolicy';
import type { UseAlertsResult, AlertItem } from '@/hooks/useAlerts';
import type { AlertLayerModalKind } from '@/services/alerts/alertActionTypes';
import { NotificationCommandBar } from './NotificationCommandBar';
import { NotificationKanbanBoard } from './NotificationKanbanBoard';
import { NotificationDetailPanel } from './NotificationDetailPanel';
import { NotificationBulkBar } from './NotificationBulkBar';
import {
  InstallmentAlertBlock,
  alertHasInstallmentPreview,
} from '@/components/alerts/InstallmentAlertBlock';
import {
  RecordPaymentModal,
  RenewContractModal,
  WhatsAppModal,
  AssignTechnicianModal,
  LegalFileModal,
  PersonProfileModal,
  ReceiptModal,
  InsuranceModal,
} from '@/components/alerts/modals';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { ROUTE_PATHS } from '@/routes/paths';

interface NotificationHubLayoutProps {
  page: UseAlertsResult;
}

export const NotificationHubLayout: React.FC<NotificationHubLayoutProps> = ({ page }) => {
  const [layerModal, setLayerModal] = useState<AlertLayerModalKind | null>(null);
  const { openPanel, openModal } = useSmartModal();
  const toast = useToast();

  const handleAction = useCallback((type: string) => {
    if (!page.selectedAlert) return;
    const alert = page.selectedAlert;

    if (type === 'primary') {
      const spec = getAlertPrimarySpec(alert);
      if (spec.mode === 'destination') {
        executeNavigateForAlert(alert, openPanel, openModal);
      } else {
        // If modal mode, we need to pick a default layer or open a general one
        // For now, let's open the first available layer action if it's a modal spec
        const secondaries = resolveSecondaryActions(alert);
        const firstLayer = secondaries.find(s => s.type === 'layer');
        if (firstLayer && firstLayer.type === 'layer') {
          setLayerModal(firstLayer.layer);
        } else {
          executeNavigateForAlert(alert, openPanel, openModal);
        }
      }
      return;
    }

    if (type === 'open_original') {
      executeNavigateForAlert(alert, openPanel, openModal);
      return;
    }

    // Secondary actions
    const secondaries = resolveSecondaryActions(alert);
    const action = secondaries.find(s => s.id === type);
    
    if (action) {
      if (action.type === 'layer') {
        setLayerModal(action.layer);
      } else {
        executeNavigateForAlert(alert, openPanel, openModal);
      }
    }
  }, [page.selectedAlert, openPanel, openModal]);

  const handleQuickAction = useCallback((alert: AlertItem, type: 'pay' | 'whatsapp' | 'open') => {
    if (type === 'open') {
      executeNavigateForAlert(alert, openPanel, openModal);
    } else if (type === 'pay') {
      page.setSelectedAlert(alert);
      setLayerModal('record_payment');
    } else if (type === 'whatsapp') {
      page.setSelectedAlert(alert);
      setLayerModal('whatsapp');
    }
  }, [page, openPanel, openModal]);

  const handleBulkWhatsApp = useCallback(() => {
    toast.info('سيتم فتح نافذة إرسال واتساب للعملاء المحددين');
    // Implement bulk logic if needed, or just open a general panel
  }, [toast]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <NotificationCommandBar
        totalCount={page.totalCount}
        unreadCount={page.unreadCount}
        columns={page.columns}
        searchQuery={page.searchQuery}
        activeFilter={page.activeFilter}
        activePeriod={page.activePeriod}
        isScanning={page.isLoading}
        onSearch={page.setSearchQuery}
        onFilterChange={page.setActiveFilter}
        onPeriodChange={page.setActivePeriod}
        onScan={page.runScan}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        <NotificationKanbanBoard
          columns={page.columns}
          selectedAlert={page.selectedAlert}
          selectedIds={page.selectedIds}
          onSelectAlert={page.setSelectedAlert}
          onCheckAlert={page.toggleSelect}
          onQuickAction={handleQuickAction}
        />

        {page.selectedAlert && (
          <NotificationDetailPanel
            alert={page.selectedAlert}
            onClose={() => page.setSelectedAlert(null)}
            onAction={handleAction}
            onSaveNote={(note) => page.saveNote(page.selectedAlert!.id, note)}
          />
        )}
      </div>

      {page.selectedIds.size > 0 && (
        <NotificationBulkBar
          selectedCount={page.selectedIds.size}
          onMarkRead={() => page.markAsRead(Array.from(page.selectedIds))}
          onBulkWhatsApp={handleBulkWhatsApp}
          onArchive={() => page.archiveBulk(Array.from(page.selectedIds))}
          onClear={page.clearSelection}
        />
      )}

      {/* Modals Container */}
      {page.selectedAlert && (
        <>
          {layerModal === 'renew_contract' && (
            <RenewContractModal
              open
              onClose={() => setLayerModal(null)}
              alert={page.selectedAlert}
              expiryKind="pre_notice"
              onExpiryKindChange={() => {}}
              onSendTenant={() => {}}
              onSendOwner={() => {}}
            />
          )}
          {layerModal === 'record_payment' && (
            <RecordPaymentModal
              open
              onClose={() => setLayerModal(null)}
              alert={page.selectedAlert}
              installmentBody={
                alertHasInstallmentPreview(page.selectedAlert) ? (
                  <InstallmentAlertBlock alert={page.selectedAlert} />
                ) : undefined
              }
              onOpenFullDetails={() => executeNavigateForAlert(page.selectedAlert!, openPanel, openModal)}
            />
          )}
          {layerModal === 'whatsapp' && (
            <WhatsAppModal
              open
              onClose={() => setLayerModal(null)}
              alert={page.selectedAlert}
              onSend={() => {
                // Implementation for simple WhatsApp send if payload not provided
                const message = `مرحباً، إشعار بخصوص العقار: ${page.selectedAlert?.الوصف}`;
                const phones = page.selectedAlert?.phone ? [page.selectedAlert.phone] : [];
                if (phones.length > 0) {
                  void openWhatsAppForPhones(message, phones, {
                    defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
                  });
                }
              }}
            />
          )}
          {layerModal === 'assign_technician' && (
            <AssignTechnicianModal
              open
              onClose={() => setLayerModal(null)}
              alert={page.selectedAlert}
              onOpenMaintenance={() => {
                window.location.hash = ROUTE_PATHS.MAINTENANCE;
              }}
            />
          )}
          {layerModal === 'legal_file' && (
            <LegalFileModal
              open
              onClose={() => setLayerModal(null)}
              alert={page.selectedAlert}
              onOpenGenerator={() => {
                if (page.selectedAlert?.مرجع_المعرف) {
                  openPanel('LEGAL_NOTICE_GENERATOR', page.selectedAlert.مرجع_المعرف);
                }
              }}
            />
          )}
          {layerModal === 'person_profile' && (
            <PersonProfileModal
              open
              onClose={() => setLayerModal(null)}
              alert={page.selectedAlert}
              onOpenPerson={(personId) => openPanel('PERSON_DETAILS', personId)}
            />
          )}
          {layerModal === 'receipt' && (
            <ReceiptModal open onClose={() => setLayerModal(null)} alert={page.selectedAlert} />
          )}
          {layerModal === 'insurance' && (
            <InsuranceModal
              open
              onClose={() => setLayerModal(null)}
              alert={page.selectedAlert}
              onOpenContract={() => {
                if (page.selectedAlert?.مرجع_المعرف) {
                  openPanel('CONTRACT_DETAILS', page.selectedAlert.مرجع_المعرف);
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
