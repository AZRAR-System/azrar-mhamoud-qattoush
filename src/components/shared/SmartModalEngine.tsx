import React, { Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSmartModal, type PanelType } from '@/context/ModalContext';
import { ChevronDown, ChevronUp, Loader2, ServerCog, X } from 'lucide-react';
import { AppModal } from '@/components/ui/AppModal';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';

/** Lazy panels keep mockDb and heavy UI out of the initial bundle (Layout shell). */
const PersonPanel = React.lazy(() =>
  import('@/components/panels/PersonPanel').then((m) => ({ default: m.PersonPanel }))
);
const PropertyPanel = React.lazy(() =>
  import('@/components/panels/PropertyPanel').then((m) => ({ default: m.PropertyPanel }))
);
const ContractPanel = React.lazy(() =>
  import('@/components/panels/ContractPanel').then((m) => ({ default: m.ContractPanel }))
);
const ReportPanel = React.lazy(() =>
  import('@/components/panels/ReportPanel').then((m) => ({ default: m.ReportPanel }))
);
const LegalNoticePanel = React.lazy(() =>
  import('@/components/panels/LegalNoticePanel').then((m) => ({ default: m.LegalNoticePanel }))
);
const SalesPanel = React.lazy(() =>
  import('@/components/panels/SalesPanel').then((m) => ({ default: m.SalesPanel }))
);
const ClearanceReportPanel = React.lazy(() =>
  import('@/components/panels/ClearanceReportPanel').then((m) => ({
    default: m.ClearanceReportPanel,
  }))
);
const ClearanceWizardPanel = React.lazy(() =>
  import('@/components/panels/ClearanceWizardPanel').then((m) => ({
    default: m.ClearanceWizardPanel,
  }))
);
const PersonFormPanel = React.lazy(() =>
  import('@/components/panels/PersonFormPanel').then((m) => ({ default: m.PersonFormPanel }))
);
const PropertyFormPanel = React.lazy(() =>
  import('@/components/panels/PropertyFormPanel').then((m) => ({ default: m.PropertyFormPanel }))
);
const ContractFormPanel = React.lazy(() =>
  import('@/components/panels/ContractFormPanel').then((m) => ({ default: m.ContractFormPanel }))
);
const BlacklistFormPanel = React.lazy(() =>
  import('@/components/panels/BlacklistFormPanel').then((m) => ({ default: m.BlacklistFormPanel }))
);
const SmartPromptPanel = React.lazy(() =>
  import('@/components/panels/SmartPromptPanel').then((m) => ({ default: m.SmartPromptPanel }))
);
const CalendarEventsPanel = React.lazy(() =>
  import('@/components/panels/CalendarEventsPanel').then((m) => ({
    default: m.CalendarEventsPanel,
  }))
);
const PaymentNotificationsPanel = React.lazy(() =>
  import('@/components/panels/PaymentNotificationsPanel').then((m) => ({
    default: m.PaymentNotificationsPanel,
  }))
);
const NotificationCenterPanel = React.lazy(() =>
  import('@/components/shared/NotificationCenterPanel').then((m) => ({
    default: m.NotificationCenterPanel,
  }))
);
const GenericAlertPanel = React.lazy(() =>
  import('@/components/panels/GenericAlertPanel').then((m) => ({ default: m.GenericAlertPanel }))
);
const SectionViewPanel = React.lazy(() =>
  import('@/components/panels/SectionViewPanel').then((m) => ({ default: m.SectionViewPanel }))
);
const ServerDrawerPanel = React.lazy(() =>
  import('@/components/panels/ServerDrawerPanel').then((m) => ({ default: m.ServerDrawerPanel }))
);
const SqlSyncLogPanel = React.lazy(() =>
  import('@/components/panels/SqlSyncLogPanel').then((m) => ({ default: m.SqlSyncLogPanel }))
);
const InspectionFormPanel = React.lazy(() =>
  import('@/components/panels/InspectionFormPanel').then((m) => ({
    default: m.InspectionFormPanel,
  }))
);
const BulkWhatsAppPanel = React.lazy(() =>
  import('@/components/panels/BulkWhatsAppPanel').then((m) => ({ default: m.BulkWhatsAppPanel }))
);
const MarqueeAdsPanel = React.lazy(() =>
  import('@/components/panels/MarqueeAdsPanel').then((m) => ({ default: m.MarqueeAdsPanel }))
);
const FinancialReportPrintPanel = React.lazy(() =>
  import('@/components/panels/FinancialReportPrintPanel').then((m) => ({
    default: m.FinancialReportPrintPanel,
  }))
);
const NotificationTemplatesPanel = React.lazy(() =>
  import('@/components/panels/NotificationTemplatesPanel').then((m) => ({
    default: m.NotificationTemplatesPanel,
  }))
);
const ContractWhatsAppSendPanel = React.lazy(() =>
  import('@/components/panels/ContractWhatsAppSendPanel').then((m) => ({
    default: m.ContractWhatsAppSendPanel,
  }))
);

const panelChunkFallback = (
  <div className="flex items-center justify-center min-h-[200px] p-8">
    <Loader2 className="animate-spin text-indigo-600" size={32} aria-hidden />
  </div>
);

type PanelComponentProps = { id?: string; onClose: () => void } & Record<string, unknown>;
type PanelComponent = React.ComponentType<PanelComponentProps>;

const PANEL_COMPONENTS: Record<string, PanelComponent> = {
  PERSON_DETAILS: PersonPanel as unknown as PanelComponent,
  PROPERTY_DETAILS: PropertyPanel as unknown as PanelComponent,
  CONTRACT_DETAILS: ContractPanel as unknown as PanelComponent,
  REPORT_VIEWER: ReportPanel as unknown as PanelComponent,
  LEGAL_NOTICE_GENERATOR: LegalNoticePanel as unknown as PanelComponent,
  BULK_WHATSAPP: BulkWhatsAppPanel as unknown as PanelComponent,
  CONTRACT_WHATSAPP_SEND: ContractWhatsAppSendPanel as unknown as PanelComponent,
  SALES_LISTING_DETAILS: SalesPanel as unknown as PanelComponent,
  CLEARANCE_REPORT: ClearanceReportPanel as unknown as PanelComponent,
  CLEARANCE_WIZARD: ClearanceWizardPanel as unknown as PanelComponent,
  PERSON_FORM: PersonFormPanel as unknown as PanelComponent,
  PROPERTY_FORM: PropertyFormPanel as unknown as PanelComponent,
  CONTRACT_FORM: ContractFormPanel as unknown as PanelComponent,
  INSPECTION_FORM: InspectionFormPanel as unknown as PanelComponent,
  BLACKLIST_FORM: BlacklistFormPanel as unknown as PanelComponent,
  SMART_PROMPT: SmartPromptPanel as unknown as PanelComponent,
  CALENDAR_EVENTS: CalendarEventsPanel as unknown as PanelComponent,
  PAYMENT_NOTIFICATIONS: PaymentNotificationsPanel as unknown as PanelComponent,
  NOTIFICATION_CENTER: NotificationCenterPanel as unknown as PanelComponent,
  NOTIFICATION_TEMPLATES: NotificationTemplatesPanel as unknown as PanelComponent,
  GENERIC_ALERT: GenericAlertPanel as unknown as PanelComponent,
  SECTION_VIEW: SectionViewPanel as unknown as PanelComponent,
  SERVER_DRAWER: ServerDrawerPanel as unknown as PanelComponent,
  SQL_SYNC_LOG: SqlSyncLogPanel as unknown as PanelComponent,
  MARQUEE_ADS: MarqueeAdsPanel as unknown as PanelComponent,
  FINANCIAL_REPORT_PRINT: FinancialReportPrintPanel as unknown as PanelComponent,
};

/** لوحات عرض تفاصيل (ليست نماذج إدخال) — تُعرض كمنزلق جانبي بدل النافذة المنبثقة المركزية */
const SLIDE_OVER_DETAIL_PANELS = new Set<PanelType>([
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
]);

const PANEL_TITLES: Partial<Record<PanelType, string>> = {
  PERSON_DETAILS: 'تفاصيل الملف',
  PROPERTY_DETAILS: 'تفاصيل العقار',
  CONTRACT_DETAILS: 'تفاصيل العقد',
  INSTALLMENT_DETAILS: 'تفاصيل الدفعة',
  MAINTENANCE_DETAILS: 'تفاصيل الصيانة',
  GENERIC_ALERT: 'تنبيه',
  REPORT_VIEWER: 'عرض التقرير',
  LEGAL_NOTICE_GENERATOR: 'إنشاء إشعار قانوني',
  BULK_WHATSAPP: 'إرسال واتساب جماعي',
  CONTRACT_WHATSAPP_SEND: 'إرسال واتساب',
  NOTIFICATION_TEMPLATES: 'قوالب الرسائل والإشعارات',
  SALES_LISTING_DETAILS: 'تفاصيل البيع',
  CLEARANCE_REPORT: 'تقرير براءة الذمة',
  CLEARANCE_WIZARD: 'إنهاء / براءة ذمة',
  PERSON_FORM: 'بيانات الملف',
  PROPERTY_FORM: 'بيانات العقار',
  CONTRACT_FORM: 'بيانات العقد',
  BLACKLIST_FORM: 'القائمة السوداء',
  SMART_PROMPT: 'مساعد ذكي',
  CALENDAR_EVENTS: 'مهام اليوم',
  PAYMENT_NOTIFICATIONS: 'تنبيهات الدفعات',
  NOTIFICATION_CENTER: 'مركز الإشعارات',
  SECTION_VIEW: 'عرض القسم',
  SERVER_DRAWER: 'المخدم',
  SQL_SYNC_LOG: 'سجل المزامنة',
  MARQUEE_ADS: 'إعلانات الشريط',
  FINANCIAL_REPORT_PRINT: 'تقرير مالي مجدول',
  CONFIRM_MODAL: 'تأكيد',
  INSPECTION_FORM: 'الكشف',
};

export const SmartModalEngine: React.FC = () => {
  const { activePanels, closePanel } = useSmartModal();
  const [minimized, setMinimized] = React.useState<Record<string, boolean>>({});

  const shouldLockScroll = React.useMemo(() => {
    return activePanels.some((panel) => panel.type !== 'BULK_WHATSAPP' || !minimized[panel.id]);
  }, [activePanels, minimized]);

  React.useEffect(() => {
    if (shouldLockScroll) {
      lockBodyScroll();
      return () => unlockBodyScroll();
    }
  }, [shouldLockScroll]);

  React.useEffect(() => {
    if (!shouldLockScroll) return;
    if (typeof window === 'undefined') return;
    if (activePanels.length === 0) return;

    const topPanel = activePanels[activePanels.length - 1];
    // CONFIRM_MODAL uses AppModal which already handles ESC and calls onCancel.
    if (topPanel.type === 'CONFIRM_MODAL') return;

    const closeTopPanel = () => {
      if (topPanel.type === 'BULK_WHATSAPP') {
        setMinimized((prev) => {
          const next = { ...prev };
          delete next[topPanel.id];
          return next;
        });
        closePanel(topPanel.id);
        return;
      }

      if (topPanel.type === 'SMART_PROMPT') {
        try {
          if (topPanel.props?.onClose) topPanel.props.onClose();
        } finally {
          closePanel(topPanel.id);
        }
        return;
      }

      closePanel(topPanel.id);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeTopPanel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanels, closePanel, shouldLockScroll]);

  if (activePanels.length === 0) return null;

  return (
    <>
      {activePanels.map((panel, index) => {
        const Component = PANEL_COMPONENTS[panel.type];
        if (!Component && panel.type !== 'CONFIRM_MODAL') return null;

        // Bulk WhatsApp: in-app popup with minimize-to-bottom
        if (panel.type === 'BULK_WHATSAPP') {
          const isTop = index === activePanels.length - 1;
          const isMin = !!minimized[panel.id];
          const title = panel.props?.title ?? PANEL_TITLES[panel.type] ?? '';
          const titleId = `panel-title-${panel.id}`;

          const doClose = () => {
            setMinimized((prev) => {
              const next = { ...prev };
              delete next[panel.id];
              return next;
            });
            closePanel(panel.id);
          };

          if (isMin) {
            return (
              <div
                key={panel.id}
                className={`fixed bottom-4 left-4 right-4 layer-toast ${isTop ? '' : 'hidden'}`}
              >
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 dark:text-white truncate">
                      {title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      قيد التشغيل • يمكنك المتابعة داخل النظام
                    </div>
                  </div>

                  <button
                    onClick={() => setMinimized((p) => ({ ...p, [panel.id]: false }))}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition text-slate-600 dark:text-slate-200"
                    title="إظهار"
                    aria-label="إظهار"
                  >
                    <ChevronUp size={20} />
                  </button>

                  <button
                    onClick={doClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition text-slate-500 dark:text-slate-300"
                    title="إغلاق"
                    aria-label="إغلاق"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={panel.id}
              className={`modal-overlay app-modal-overlay animate-fade-in ${isTop ? '' : 'hidden'}`}
              onClick={doClose}
            >
              <div
                className="modal-content app-modal-content app-surface-pulse-primary dark:bg-slate-900 w-full max-w-5xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] transform transition-transform duration-300 ease-out animate-scale-up"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <div className="no-print flex items-start gap-3 p-4 border-b border-gray-100 dark:border-slate-800">
                  <button
                    onClick={() => setMinimized((p) => ({ ...p, [panel.id]: true }))}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition text-slate-600 dark:text-slate-200"
                    title="تصغير"
                    aria-label="تصغير"
                  >
                    <ChevronDown size={20} />
                  </button>

                  <button
                    onClick={doClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition text-slate-500 dark:text-slate-300"
                    title="إغلاق"
                    aria-label="إغلاق"
                  >
                    <X size={20} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3
                      id={titleId}
                      className="text-sm font-bold text-slate-800 dark:text-white whitespace-normal break-words leading-snug"
                    >
                      {title}
                    </h3>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
                  <Suspense fallback={panelChunkFallback}>
                    <Component id={panel.dataId} {...panel.props} onClose={doClose} />
                  </Suspense>
                </div>
              </div>
            </div>
          );
        }

        // Server Drawer -> centered modal (consistent sizing/behavior)
        if (panel.type === 'SERVER_DRAWER') {
          const handleClose = () => closePanel(panel.id);
          return (
            <AppModal
              key={panel.id}
              open
              onClose={handleClose}
              title={
                <span className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-slate-700 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/10"
                    aria-hidden
                  >
                    <ServerCog size={22} strokeWidth={2} />
                  </span>
                  <span className="font-black text-slate-800 dark:text-white">
                    {panel.props?.title ?? PANEL_TITLES[panel.type] ?? ''}
                  </span>
                </span>
              }
              size="6xl"
              className="items-center p-4 bg-black/20 backdrop-blur-[1px]"
              contentClassName="app-surface-pulse-primary dark:bg-slate-900 dark:border-slate-800 h-[85vh] rounded-2xl"
              bodyClassName="p-0"
            >
              <Suspense fallback={panelChunkFallback}>
                <Component {...panel.props} onClose={handleClose} />
              </Suspense>
            </AppModal>
          );
        }

        // Special Case for Confirmation Modal (Center)
        if (panel.type === 'CONFIRM_MODAL') {
          const showCancel = panel.props?.cancelText !== null && panel.props?.showCancel !== false;
          const handleCancel = () => {
            try {
              if (panel.props?.onCancel) panel.props.onCancel();
            } finally {
              closePanel(panel.id);
            }
          };
          const handleConfirm = () => {
            try {
              if (panel.props?.onConfirm) panel.props.onConfirm();
            } finally {
              closePanel(panel.id);
            }
          };
          return (
            <AppModal
              key={panel.id}
              open
              onClose={handleCancel}
              title={panel.props?.title || 'تأكيد'}
              size="sm"
              closeOnBackdrop={false}
              showCloseButton={false}
            >
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 whitespace-pre-line">
                {panel.props?.message}
              </p>
              <div className="flex justify-end gap-3">
                {showCancel && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-slate-600 dark:text-slate-200 font-bold hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                  >
                    {panel.props?.cancelText || 'إلغاء'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-white font-bold rounded-lg shadow-lg ${panel.props?.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {panel.props?.confirmText || 'نعم'}
                </button>
              </div>
            </AppModal>
          );
        }

        // Smart Prompt (Center Small)
        if (panel.type === 'SMART_PROMPT') {
          const handleClose = () => {
            try {
              if (panel.props?.onClose) panel.props.onClose();
            } finally {
              closePanel(panel.id);
            }
          };
          const titleId = `panel-title-${panel.id}`;
          const title = panel.props?.title ?? PANEL_TITLES[panel.type] ?? '';
          return (
            <div
              key={panel.id}
              className="modal-overlay app-modal-overlay animate-fade-in"
              onClick={handleClose}
            >
              <div
                className="modal-content app-modal-content app-surface-pulse-primary w-full max-w-md animate-scale-up overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <h3 id={titleId} className="sr-only">
                  {title}
                </h3>
                <Suspense fallback={panelChunkFallback}>
                  <Component {...panel.props} onClose={handleClose} />
                </Suspense>
              </div>
            </div>
          );
        }

        // عرض التفاصيل: منزلق من بداية السطر (في RTL من اليمين) — وليس نافذة منبثقة وسط الشاشة
        const isTop = index === activePanels.length - 1;
        const isSectionView = panel.type === 'SECTION_VIEW';
        const isWidePanel = panel.type === 'CALENDAR_EVENTS' || panel.type === 'SQL_SYNC_LOG';
        const size = isSectionView ? '6xl' : isWidePanel ? '5xl' : '3xl';
        const handleClose = () => closePanel(panel.id);
        const titleStr = String(panel.props?.title ?? PANEL_TITLES[panel.type] ?? '');
        const titleId = `panel-drawer-title-${panel.id}`;

        const useSlideOver = Component && SLIDE_OVER_DETAIL_PANELS.has(panel.type);
        const drawerMaxClass = isSectionView
          ? 'max-w-6xl'
          : isWidePanel
            ? 'max-w-5xl'
            : 'max-w-3xl';

        if (useSlideOver && typeof document !== 'undefined') {
          return createPortal(
            <div
              key={panel.id}
              className={`panel-overlay app-panel-overlay fixed inset-0 flex animate-fade-in ${isTop ? '' : 'hidden'}`}
              onClick={handleClose}
              role="presentation"
            >
              <aside
                className={`panel-content app-surface-pulse-primary relative flex h-full w-full flex-col overflow-hidden border border-slate-200/80 bg-white shadow-2xl ring-1 ring-black/5 animate-slide-left dark:border-slate-800 dark:bg-slate-900 dark:ring-white/10 ${drawerMaxClass}`}
                style={{ zIndex: 'var(--z-panel-content)' }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <div className="no-print flex shrink-0 items-center gap-3 border-b border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="shrink-0 rounded-xl p-2.5 text-slate-400 transition-all hover:bg-slate-200/60 hover:text-slate-600 active:scale-90 dark:hover:bg-slate-700/60 dark:hover:text-slate-300"
                    aria-label="إغلاق"
                    title="إغلاق"
                  >
                    <X size={20} />
                  </button>
                  <h2
                    id={titleId}
                    className="min-w-0 flex-1 text-base font-black leading-snug text-slate-800 dark:text-white sm:text-lg"
                  >
                    {titleStr}
                  </h2>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar relative">
                  <Suspense fallback={panelChunkFallback}>
                    <Component id={panel.dataId} {...panel.props} onClose={handleClose} />
                  </Suspense>
                </div>
              </aside>
            </div>,
            document.body
          );
        }

        return (
          <AppModal
            key={panel.id}
            open={isTop}
            onClose={handleClose}
            title={panel.props?.title ?? PANEL_TITLES[panel.type] ?? ''}
            size={size}
            className="items-center p-4"
            contentClassName="app-surface-pulse-primary dark:bg-slate-900 dark:border-slate-800 h-[85vh]"
            bodyClassName="p-0"
          >
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
              <Suspense fallback={panelChunkFallback}>
                <Component id={panel.dataId} {...panel.props} onClose={handleClose} />
              </Suspense>
            </div>
          </AppModal>
        );
      })}
    </>
  );
};
