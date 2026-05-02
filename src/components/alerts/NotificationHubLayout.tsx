import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmartModal } from '@/context/ModalContext';
import {
  executeNavigateForAlert,
  getAlertPrimarySpec,
  resolveSecondaryActions,
} from '@/services/alerts/alertActionPolicy';
import type { UseAlertsResult, AlertItem } from '@/hooks/useAlerts';
import type { AlertLayerModalKind } from '@/services/alerts/alertActionTypes';
import { NotificationCommandBar, type AlertCategoryTab } from './NotificationCommandBar';
import { NotificationList } from './NotificationList';
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

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const NotificationHubLayout: React.FC<NotificationHubLayoutProps> = ({ page }) => {
  const [layerModal, setLayerModal] = useState<AlertLayerModalKind | null>(null);
  const [activeCategory, setActiveCategory] = useState<AlertCategoryTab>('all');
  const { openPanel, openModal } = useSmartModal();
  const navigate = useNavigate();

  /* ── Flat sorted list from kanban columns ── */
  const allAlerts = useMemo(() => {
    const flat = page.columns.flatMap((col) => col.alerts);
    return flat.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 3;
      const pb = PRIORITY_ORDER[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.تاريخ_الانشاء).getTime() - new Date(a.تاريخ_الانشاء).getTime();
    });
  }, [page.columns]);

  const alertCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    page.columns.forEach((col) => {
      col.alerts.forEach((a) => {
        map.set(a.id, col.id);
      });
    });
    return map;
  }, [page.columns]);

  /* ── Category filter ── */
  const filteredAlerts = useMemo(() => {
    if (activeCategory === 'all') return allAlerts;
    return allAlerts.filter((a) => alertCategoryMap.get(a.id) === activeCategory);
  }, [allAlerts, activeCategory, alertCategoryMap]);

  /* ── Column counts for tabs ── */
  const columnCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    page.columns.forEach((col) => { counts[col.id] = col.count; });
    return counts;
  }, [page.columns]);

  /* ── Action handlers ── */
  const handleAction = useCallback(
    (type: string) => {
      if (!page.selectedAlert) return;
      const alert = page.selectedAlert;

      if (type === 'primary') {
        const spec = getAlertPrimarySpec(alert);
        if (spec.mode === 'destination') {
          executeNavigateForAlert(alert, openPanel, openModal);
        } else {
          const secondaries = resolveSecondaryActions(alert);
          const firstLayer = secondaries.find((s) => s.type === 'layer');
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

      const secondaries = resolveSecondaryActions(alert);
      const action = secondaries.find((s) => s.id === type);
      if (action) {
        if (action.type === 'layer') {
          setLayerModal(action.layer);
        } else {
          executeNavigateForAlert(alert, openPanel, openModal);
        }
      }
    },
    [page.selectedAlert, openPanel, openModal]
  );

  const handleQuickAction = useCallback(
    (alert: AlertItem, type: 'primary' | 'whatsapp' | 'open') => {
      page.setSelectedAlert(alert);
      if (type === 'open') {
        executeNavigateForAlert(alert, openPanel, openModal);
      } else if (type === 'primary') {
        const spec = getAlertPrimarySpec(alert);
        if (spec.mode === 'destination') {
          executeNavigateForAlert(alert, openPanel, openModal);
        } else {
          const secondaries = resolveSecondaryActions(alert);
          const firstLayer = secondaries.find((s) => s.type === 'layer');
          if (firstLayer && firstLayer.type === 'layer') {
            setLayerModal(firstLayer.layer);
          } else {
            executeNavigateForAlert(alert, openPanel, openModal);
          }
        }
      } else if (type === 'whatsapp') {
        setLayerModal('whatsapp');
      }
    },
    [page, openPanel, openModal]
  );

  const handleBulkWhatsApp = useCallback(() => {
    navigate(ROUTE_PATHS.ALERTS_BULK);
  }, [navigate]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <NotificationCommandBar
        totalCount={page.totalCount}
        unreadCount={page.unreadCount}
        columnCounts={columnCounts}
        searchQuery={page.searchQuery}
        activeFilter={page.activeFilter}
        activePeriod={page.activePeriod}
        activeCategory={activeCategory}
        isScanning={page.isLoading}
        onSearch={page.setSearchQuery}
        onFilterChange={page.setActiveFilter}
        onPeriodChange={page.setActivePeriod}
        onCategoryChange={setActiveCategory}
        onScan={page.runScan}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Notification List */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
          <NotificationList
            alerts={filteredAlerts}
            selectedAlert={page.selectedAlert}
            selectedIds={page.selectedIds}
            onSelectAlert={page.setSelectedAlert}
            onCheckAlert={page.toggleSelect}
            onQuickAction={handleQuickAction}
          />
        </div>

        {/* Detail Panel */}
        {page.selectedAlert && (
          <NotificationDetailPanel
            alert={page.selectedAlert}
            onClose={() => page.setSelectedAlert(null)}
            onAction={handleAction}
            onSaveNote={(note) => {
              const sel = page.selectedAlert;
              if (sel) page.saveNote(sel.id, note);
            }}
          />
        )}
      </div>

      {/* Bulk Bar */}
      {page.selectedIds.size > 0 && (
        <NotificationBulkBar
          selectedCount={page.selectedIds.size}
          onMarkRead={() => page.markAsRead(Array.from(page.selectedIds))}
          onBulkWhatsApp={handleBulkWhatsApp}
          onArchive={() => page.archiveBulk(Array.from(page.selectedIds))}
          onClear={page.clearSelection}
        />
      )}

      {/* Modals */}
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
              onOpenFullDetails={() => {
                const sel = page.selectedAlert;
                if (sel) void executeNavigateForAlert(sel, openPanel, openModal);
              }}
            />
          )}
          {layerModal === 'whatsapp' && (
            <WhatsAppModal
              open
              onClose={() => setLayerModal(null)}
              alert={page.selectedAlert}
              onSend={() => {
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
              onOpenMaintenance={() => { navigate(ROUTE_PATHS.MAINTENANCE); }}
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
