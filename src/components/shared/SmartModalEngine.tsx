import React from 'react';
import { useSmartModal, type PanelType } from '@/context/ModalContext';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { AppModal } from '@/components/ui/AppModal';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';

// Panels
import { PersonPanel } from '@/components/panels/PersonPanel';
import { PropertyPanel } from '@/components/panels/PropertyPanel';
import { ContractPanel } from '@/components/panels/ContractPanel';
import { ReportPanel } from '@/components/panels/ReportPanel';
import { LegalNoticePanel } from '@/components/panels/LegalNoticePanel';
import { SalesPanel } from '@/components/panels/SalesPanel';
import { ClearanceReportPanel } from '@/components/panels/ClearanceReportPanel';
import { ClearanceWizardPanel } from '@/components/panels/ClearanceWizardPanel';
import { PersonFormPanel } from '@/components/panels/PersonFormPanel';
import { PropertyFormPanel } from '@/components/panels/PropertyFormPanel';
import { ContractFormPanel } from '@/components/panels/ContractFormPanel';
import { BlacklistFormPanel } from '@/components/panels/BlacklistFormPanel';
import { SmartPromptPanel } from '@/components/panels/SmartPromptPanel';
import { CalendarEventsPanel } from '@/components/panels/CalendarEventsPanel';
import { PaymentNotificationsPanel } from '@/components/panels/PaymentNotificationsPanel';
import { GenericAlertPanel } from '@/components/panels/GenericAlertPanel';
import { SectionViewPanel } from '@/components/panels/SectionViewPanel';
import { ServerDrawerPanel } from '@/components/panels/ServerDrawerPanel';
import { SqlSyncLogPanel } from '@/components/panels/SqlSyncLogPanel';
import { InspectionFormPanel } from '@/components/panels/InspectionFormPanel';
import { BulkWhatsAppPanel } from '@/components/panels/BulkWhatsAppPanel';
import { MarqueeAdsPanel } from '@/components/panels/MarqueeAdsPanel';

type PanelComponentProps = { id?: string; onClose: () => void } & Record<string, unknown>;
type PanelComponent = React.ComponentType<PanelComponentProps>;

const PANEL_COMPONENTS: Record<string, PanelComponent> = {
  PERSON_DETAILS: PersonPanel as unknown as PanelComponent,
  PROPERTY_DETAILS: PropertyPanel as unknown as PanelComponent,
  CONTRACT_DETAILS: ContractPanel as unknown as PanelComponent,
  REPORT_VIEWER: ReportPanel as unknown as PanelComponent,
  LEGAL_NOTICE_GENERATOR: LegalNoticePanel as unknown as PanelComponent,
  BULK_WHATSAPP: BulkWhatsAppPanel as unknown as PanelComponent,
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
  GENERIC_ALERT: GenericAlertPanel as unknown as PanelComponent,
  SECTION_VIEW: SectionViewPanel as unknown as PanelComponent,
  SERVER_DRAWER: ServerDrawerPanel as unknown as PanelComponent,
  SQL_SYNC_LOG: SqlSyncLogPanel as unknown as PanelComponent,
  MARQUEE_ADS: MarqueeAdsPanel as unknown as PanelComponent,
};

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
  SECTION_VIEW: 'عرض القسم',
  SERVER_DRAWER: 'المخدم',
  SQL_SYNC_LOG: 'سجل المزامنة',
  MARQUEE_ADS: 'إعلانات الشريط',
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
                    <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">قيد التشغيل • يمكنك المتابعة داخل النظام</div>
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
                className="modal-content app-modal-content dark:bg-slate-900 w-full max-w-5xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] transform transition-transform duration-300 ease-out animate-scale-up"
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
                  <Component id={panel.dataId} {...panel.props} onClose={doClose} />
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
              title={panel.props?.title ?? PANEL_TITLES[panel.type] ?? ''}
              size="6xl"
              className="items-center p-4 bg-black/20 backdrop-blur-[1px]"
              contentClassName="dark:bg-slate-900 dark:border-slate-800 h-[85vh] rounded-2xl"
              bodyClassName="p-0"
            >
              <Component {...panel.props} onClose={handleClose} />
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
                <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 whitespace-pre-line">{panel.props?.message}</p>
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
              <div key={panel.id} className="modal-overlay app-modal-overlay animate-fade-in" onClick={handleClose}>
                <div
                  className="modal-content app-modal-content w-full max-w-md animate-scale-up overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                >
                  <h3 id={titleId} className="sr-only">
                    {title}
                  </h3>
                  <Component {...panel.props} onClose={handleClose} />
                </div>
              </div>
            );
        }

        // Standard Slide-over Panels (Right-side drawer)
        // Note: keep these *below* AppModal by using `.panel-*` z-index classes.
        const isTop = index === activePanels.length - 1;
        const isSectionView = panel.type === 'SECTION_VIEW';
        const isWidePanel = panel.type === 'CALENDAR_EVENTS' || panel.type === 'SQL_SYNC_LOG';
        const size = isSectionView ? '6xl' : isWidePanel ? '5xl' : '3xl';
        const handleClose = () => closePanel(panel.id);

        return (
          <AppModal
            key={panel.id}
            open={isTop}
            onClose={handleClose}
            title={panel.props?.title ?? PANEL_TITLES[panel.type] ?? ''}
            size={size}
            className="items-center p-4"
            contentClassName="dark:bg-slate-900 dark:border-slate-800 h-[85vh]"
            bodyClassName="p-0"
          >
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
              <Component id={panel.dataId} {...panel.props} onClose={handleClose} />
            </div>
          </AppModal>
        );
      })}
    </>
  );
};
