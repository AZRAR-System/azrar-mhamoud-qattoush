import React, { Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSmartModal, type PanelType } from '@/context/ModalContext';
import {
  Activity,
  BarChart3,
  Bell,
  Building,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Loader2,
  MessageCircle,
  ScrollText,
  ServerCog,
  Settings,
  Sparkles,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { AppModal } from '@/components/ui/AppModal';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';
import { ScrollToTopButton } from '@/components/shared/ScrollToTopButton';
import { ROUTE_ICONS, ROUTE_TITLES } from '@/routes/registry';
import { EmbeddedViewRoot } from '@/context/EmbeddedViewContext';

/**
 * Defer mounting heavy panel content by 1 frame so click/focus handlers return quickly.
 * This reduces long-task warnings when opening large panels/modals.
 */
const DeferredMount: React.FC<{ mountKey: string; fallback?: React.ReactNode; children: React.ReactNode }> = ({
  mountKey,
  fallback,
  children,
}) => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setReady(false);
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, [mountKey]);

  return <>{ready ? children : fallback ?? null}</>;
};

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
const ContractWhatsAppSendPanel = React.lazy(() =>
  import('@/components/panels/ContractWhatsAppSendPanel').then((m) => ({
    default: m.ContractWhatsAppSendPanel,
  }))
);
const ShortcutsHelpPanel = React.lazy(() => import('@/components/shared/KeyboardShortcutsHelp').then(m => ({ default: m.KeyboardShortcutsHelp })));
const QuickAddPanel = React.lazy(() => import('@/components/panels/QuickAddPanel').then(m => ({ default: m.QuickAddPanel })));


const panelChunkFallback = (
  <div className="flex items-center justify-center min-h-[200px] p-8">
    <Loader2 className="animate-spin text-indigo-600" size={32} aria-hidden />
  </div>
);

type PanelComponentProps = { id?: string; onClose: () => void } & Record<string, unknown>;
type PanelComponent = React.ComponentType<PanelComponentProps>;

function minimizedPanelMeta(panel: { type: PanelType; dataId?: string; props?: Record<string, unknown> }): {
  title: string;
  subtitle: string;
  Icon?: React.ComponentType<{ size?: number; className?: string }>;
} {
  const titleRaw = String((panel.props as { title?: unknown } | undefined)?.title ?? PANEL_TITLES[panel.type] ?? '');
  const title = titleRaw || 'نافذة';

  if (panel.type === 'SECTION_VIEW') {
    const path = String(panel.dataId || '').trim();
    const routeTitle = (path && ROUTE_TITLES[path]) || title;
    const Icon = (path && ROUTE_ICONS[path]) || undefined;
    return {
      title: routeTitle,
      subtitle: 'صفحة مفتوحة • يمكنك المتابعة داخل النظام',
      Icon,
    };
  }

  return {
    title,
    subtitle: 'قيد التشغيل • يمكنك المتابعة داخل النظام',
    Icon:
      ({
        PERSON_DETAILS: Users,
        PROPERTY_DETAILS: Building,
        CONTRACT_DETAILS: FileText,
        INSTALLMENT_DETAILS: CreditCard,
        MAINTENANCE_DETAILS: Wrench,
        REPORT_VIEWER: BarChart3,
        LEGAL_NOTICE_GENERATOR: ScrollText,
        SALES_LISTING_DETAILS: Activity,
        CLEARANCE_REPORT: ScrollText,
        CLEARANCE_WIZARD: ScrollText,
        PERSON_FORM: User,
        PROPERTY_FORM: Building,
        CONTRACT_FORM: FileText,
        INSPECTION_FORM: FileText,
        BLACKLIST_FORM: Users,
        SMART_PROMPT: Sparkles,
        CALENDAR_EVENTS: CalendarDays,
        PAYMENT_NOTIFICATIONS: Bell,
        NOTIFICATION_CENTER: Bell,
        GENERIC_ALERT: Bell,
        SERVER_DRAWER: ServerCog,
        SQL_SYNC_LOG: Activity,
        MARQUEE_ADS: MessageCircle,
        FINANCIAL_REPORT_PRINT: BarChart3,
        SHORTCUTS_HELP: Sparkles,
        QUICK_ADD: Sparkles,
        CONFIRM_MODAL: undefined,
        BULK_WHATSAPP: MessageCircle,
        CONTRACT_WHATSAPP_SEND: MessageCircle,
      } as Partial<Record<PanelType, React.ComponentType<{ size?: number; className?: string }>>>)[panel.type] ??
      undefined,
  };
}

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
  GENERIC_ALERT: GenericAlertPanel as unknown as PanelComponent,
  SECTION_VIEW: SectionViewPanel as unknown as PanelComponent,
  SERVER_DRAWER: ServerDrawerPanel as unknown as PanelComponent,
  SQL_SYNC_LOG: SqlSyncLogPanel as unknown as PanelComponent,
  MARQUEE_ADS: MarqueeAdsPanel as unknown as PanelComponent,
  FINANCIAL_REPORT_PRINT: FinancialReportPrintPanel as unknown as PanelComponent,
  SHORTCUTS_HELP: ShortcutsHelpPanel as unknown as PanelComponent,
  QUICK_ADD: QuickAddPanel as unknown as PanelComponent,
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
  SHORTCUTS_HELP: 'اختصارات لوحة المفاتيح',
  QUICK_ADD: 'إضافة جديد',
};

export const SmartModalEngine: React.FC = () => {
  const { activePanels, closePanel, bringToFront } = useSmartModal();
  const [minimized, setMinimized] = React.useState<Record<string, boolean>>({});
  const minimizedStackIndex = React.useMemo(() => {
    const ids = activePanels.filter((p) => minimized[p.id]).map((p) => p.id);
    const m = new Map<string, number>();
    ids.forEach((id, i) => m.set(id, i));
    return m;
  }, [activePanels, minimized]);

  const shouldLockScroll = React.useMemo(() => {
    // Lock body scroll only when there is at least one visible (non-minimized) panel.
    // Minimized cards should not lock scrolling.
    return activePanels.some((panel) => !minimized[panel.id]);
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

        const dynamicZIndex = 2000 + index * 100;

        // Centered + minimizable panels (minimize to bottom, restore later)
        const isMinimizableCenter =
          panel.type === 'BULK_WHATSAPP' ||
          (panel.props?.__centerModal && panel.props?.__minimizable);

        if (isMinimizableCenter) {
          const isTop = index === activePanels.length - 1;
          const isMin = !!minimized[panel.id];
          const title = panel.props?.title ?? PANEL_TITLES[panel.type] ?? '';
          const titleId = `panel-title-${panel.id}`;
          const meta = minimizedPanelMeta(panel);
          const MetaIcon = meta.Icon;
          const isWide =
            panel.type === 'SECTION_VIEW' ||
            panel.type === 'SERVER_DRAWER' ||
            panel.type === 'SQL_SYNC_LOG' ||
            panel.type === 'CALENDAR_EVENTS';
          const maxW = isWide ? 'max-w-6xl' : 'max-w-5xl';

          const doClose = () => {
            setMinimized((prev) => {
              const next = { ...prev };
              delete next[panel.id];
              return next;
            });
            closePanel(panel.id);
          };

          if (isMin) {
            const stackIdx = minimizedStackIndex.get(panel.id) ?? 0;
            const bottom = 16 + stackIdx * 76;
            // Keep minimized panels above modals and toasts.
            const minimizedZIndex = 4050 + stackIdx;
            return (
              <div
                key={panel.id}
                className="fixed bottom-4 left-4 layer-toast animate-slide-up"
                style={{ bottom, zIndex: minimizedZIndex }}
              >
                <div className="w-[320px] sm:w-[360px] bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-gray-200/80 dark:border-slate-700 shadow-2xl rounded-2xl px-3.5 py-3 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_60px_-22px_rgba(0,0,0,0.55)]">
                  <button
                    type="button"
                    onClick={() => {
                      bringToFront(panel.id);
                      setMinimized((p) => ({ ...p, [panel.id]: false }));
                    }}
                    className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 flex items-center justify-center ring-1 ring-indigo-600/10 dark:ring-indigo-400/10 shrink-0 hover:bg-indigo-600/15 dark:hover:bg-indigo-500/20 transition-colors"
                    title="استرجاع"
                    aria-label="استرجاع"
                  >
                    {MetaIcon ? <MetaIcon size={18} /> : <span className="text-sm font-black">A</span>}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-black text-slate-800 dark:text-white truncate">
                      {meta.title}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                      {meta.subtitle}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        bringToFront(panel.id);
                        setMinimized((p) => ({ ...p, [panel.id]: false }));
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition text-slate-600 dark:text-slate-200"
                      title="إظهار"
                      aria-label="إظهار"
                    >
                      <ChevronUp size={18} />
                    </button>

                    <button
                      type="button"
                      onClick={doClose}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition text-slate-500 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-300"
                      title="إغلاق"
                      aria-label="إغلاق"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={panel.id}
              className={`modal-overlay app-modal-overlay animate-fade-in ${isTop ? '' : 'hidden'}`}
              style={{ zIndex: dynamicZIndex }}
              onClick={doClose}
            >
              <div
                className={`modal-content app-modal-content app-surface-pulse-primary dark:bg-slate-900 w-full ${maxW} overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] transform transition-transform duration-300 ease-out animate-scale-up`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <div className="no-print flex items-start gap-3 p-4 border-b border-gray-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 flex items-center justify-center ring-1 ring-indigo-600/10 dark:ring-indigo-400/10 shrink-0">
                    {MetaIcon ? <MetaIcon size={18} /> : <span className="text-sm font-black">A</span>}
                  </div>
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
                      {String(title || meta.title)}
                    </h3>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {meta.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
                  <DeferredMount mountKey={panel.id} fallback={panelChunkFallback}>
                    <Suspense fallback={panelChunkFallback}>
                      <EmbeddedViewRoot>
                        <Component id={panel.dataId} {...panel.props} onClose={doClose} />
                      </EmbeddedViewRoot>
                    </Suspense>
                  </DeferredMount>
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
              zIndex={dynamicZIndex}
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
              <DeferredMount mountKey={panel.id} fallback={panelChunkFallback}>
                <Suspense fallback={panelChunkFallback}>
                  <Component {...panel.props} onClose={handleClose} />
                </Suspense>
              </DeferredMount>
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
              zIndex={dynamicZIndex}
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
              style={{ zIndex: dynamicZIndex }}
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

        // NOTIFICATION_CENTER: dropdown أسفل أيقونة الجرس
        if (panel.type === 'NOTIFICATION_CENTER') {
          const handleClose = () => closePanel(panel.id);
          const isTop = index === activePanels.length - 1;
          return createPortal(
            <div
              key={panel.id}
              className={`fixed inset-0 ${isTop ? '' : 'hidden'}`}
              style={{ zIndex: dynamicZIndex }}
              onClick={handleClose}
            >
              <div
                className="absolute top-[56px] left-4 w-[420px] max-h-[calc(100vh-80px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-up origin-top-left"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="مركز الإشعارات"
              >
                <Suspense fallback={panelChunkFallback}>
                  <Component id={panel.dataId} {...panel.props} onClose={handleClose} />
                </Suspense>
              </div>
            </div>,
            document.body
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

        const useSlideOver = false;
        const drawerMaxClass = isSectionView
          ? 'max-w-6xl'
          : isWidePanel
            ? 'max-w-5xl'
            : 'max-w-3xl';

        // Slide-over drawers are disabled. All panels open as centered modals with minimize support.

        return (
          <AppModal
            key={panel.id}
            open={isTop}
            onClose={handleClose}
            zIndex={dynamicZIndex}
            title={panel.props?.title ?? PANEL_TITLES[panel.type] ?? ''}
            size={size}
            className="items-center p-4"
            contentClassName="app-surface-pulse-primary dark:bg-slate-900 dark:border-slate-800 h-[85vh]"
            bodyClassName="p-0"
          >
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
              <Suspense fallback={panelChunkFallback}>
                <EmbeddedViewRoot>
                  <Component id={panel.dataId} {...panel.props} onClose={handleClose} />
                </EmbeddedViewRoot>
              </Suspense>
            </div>
          </AppModal>
        );
      })}
    </>
  );
};
