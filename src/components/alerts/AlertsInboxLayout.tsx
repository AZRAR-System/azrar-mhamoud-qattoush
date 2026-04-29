import React from 'react';
import { Bell, AlertTriangle, Clock, CheckCheck } from 'lucide-react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { StatCard } from '@/components/shared/StatCard';
import { AlertsSmartFilterBar } from '@/components/alerts/AlertsSmartFilterBar';
import { AlertsListPane } from '@/components/alerts/AlertsListPane';
import { AlertDetailPane } from '@/components/alerts/AlertDetailPane';
import { AlertBulkActions } from '@/components/alerts/AlertBulkActions';
import {
  InstallmentAlertBlock,
  alertHasInstallmentPreview,
} from '@/components/alerts/InstallmentAlertBlock';
import type { useAlerts } from '@/hooks/useAlerts';
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
import { useSmartModal } from '@/context/ModalContext';
import { ROUTE_PATHS } from '@/routes/paths';

export type AlertsInboxLayoutProps = {
  page: ReturnType<typeof useAlerts>;
};

export const AlertsInboxLayout: React.FC<AlertsInboxLayoutProps> = ({ page }) => {
  const {
    alerts,
    selectedAlert,
    layerModal,
    closeLayerModal,
    expiryKind,
    setExpiryKind,
    sendFixedExpiryWhatsApp,
    sendWhatsApp,
    handleNavigate,
    openLegalNotice,
  } = page;

  const { openPanel } = useSmartModal();

  return (
    <div className="animate-fade-in pb-24 space-y-8">
      <SmartPageHero
        title="التنبيهات والإشعارات"
        description="Inbox/Triage: قائمة، تفاصيل، إجراءات موحّدة عبر Policy، وطبقات مودال للمهام المتخصصة."
        icon={Bell}
      />

      <AlertsSmartFilterBar
        q={page.q}
        setQ={page.setQ}
        only={page.only}
        setOnly={page.setOnly}
        category={page.category}
        setCategory={page.setCategory}
        availableCategories={page.availableCategories}
        totalCount={alerts.length}
        currentPage={page.page}
        pageCount={page.pageCount}
        onPageChange={page.setPage}
        onRefresh={page.handleUpdateAndScan}
        onMarkAllRead={page.handleMarkAllRead}
        hasAlerts={alerts.length > 0}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="إجمالي التنبيهات" value={alerts.length} icon={Bell} color="indigo" />
        <StatCard
          label="غير مقروء"
          value={alerts.filter((a) => !a.تم_القراءة).length}
          icon={AlertTriangle}
          color="rose"
        />
        <StatCard
          label="تنبيهات اليوم"
          value={
            alerts.filter((a) => new Date(a.تاريخ_الانشاء).toDateString() === new Date().toDateString())
              .length
          }
          icon={Clock}
          color="amber"
        />
      </div>

      {page.pagedAlerts.length === 0 ? (
        <div className="app-card p-20 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center text-slate-300 mb-6">
            <CheckCheck size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-white">لا توجد تنبيهات حالياً</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-bold">
            لقد قمت بمراجعة كافة الإشعارات الهامة أو الفلتر لا يطابق أي تنبيه.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-6 items-start">
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">القائمة</h3>
            <AlertsListPane page={page} />
          </div>
          <div className="space-y-2 min-w-0">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">التفاصيل</h3>
            <AlertDetailPane page={page} />
          </div>
        </div>
      )}

      <AlertBulkActions page={page} />

      {selectedAlert && layerModal === 'renew_contract' ? (
        <RenewContractModal
          open
          onClose={closeLayerModal}
          alert={selectedAlert}
          expiryKind={expiryKind}
          onExpiryKindChange={setExpiryKind}
          onSendTenant={() => sendFixedExpiryWhatsApp('tenant')}
          onSendOwner={() => sendFixedExpiryWhatsApp('owner')}
        />
      ) : null}

      {selectedAlert && layerModal === 'whatsapp' ? (
        <WhatsAppModal
          open
          onClose={closeLayerModal}
          alert={selectedAlert}
          onSend={() => {
            void sendWhatsApp();
          }}
        />
      ) : null}

      {selectedAlert && layerModal === 'record_payment' ? (
        <RecordPaymentModal
          open
          onClose={closeLayerModal}
          alert={selectedAlert}
          installmentBody={
            alertHasInstallmentPreview(selectedAlert) ? (
              <InstallmentAlertBlock alert={selectedAlert} />
            ) : undefined
          }
          onOpenFullDetails={() => handleNavigate(selectedAlert)}
        />
      ) : null}

      {selectedAlert && layerModal === 'legal_file' ? (
        <LegalFileModal
          open
          onClose={closeLayerModal}
          alert={selectedAlert}
          onOpenGenerator={() => openLegalNotice()}
        />
      ) : null}

      {selectedAlert && layerModal === 'person_profile' ? (
        <PersonProfileModal
          open
          onClose={closeLayerModal}
          alert={selectedAlert}
          onOpenPerson={(personId) => openPanel('PERSON_DETAILS', personId)}
        />
      ) : null}

      {selectedAlert && layerModal === 'assign_technician' ? (
        <AssignTechnicianModal
          open
          onClose={closeLayerModal}
          alert={selectedAlert}
          onOpenMaintenance={() => {
            window.location.hash = ROUTE_PATHS.MAINTENANCE;
          }}
        />
      ) : null}

      {selectedAlert && layerModal === 'receipt' ? (
        <ReceiptModal open onClose={closeLayerModal} alert={selectedAlert} />
      ) : null}

      {selectedAlert && layerModal === 'insurance' ? (
        <InsuranceModal
          open
          onClose={closeLayerModal}
          alert={selectedAlert}
          onOpenContract={() => {
            const cid = String(selectedAlert.مرجع_المعرف || '').trim();
            if (cid && cid !== 'batch') openPanel('CONTRACT_DETAILS', cid);
          }}
        />
      ) : null}
    </div>
  );
};
