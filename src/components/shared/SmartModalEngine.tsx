import React from 'react';
import { useSmartModal, type PanelType } from '@/context/ModalContext';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

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

const PANEL_COMPONENTS: Record<string, React.FC<any>> = {
  'PERSON_DETAILS': PersonPanel,
  'PROPERTY_DETAILS': PropertyPanel,
  'CONTRACT_DETAILS': ContractPanel,
  'REPORT_VIEWER': ReportPanel,
  'LEGAL_NOTICE_GENERATOR': LegalNoticePanel,
  'BULK_WHATSAPP': BulkWhatsAppPanel,
  'SALES_LISTING_DETAILS': SalesPanel,
  'CLEARANCE_REPORT': ClearanceReportPanel,
  'CLEARANCE_WIZARD': ClearanceWizardPanel,
  'PERSON_FORM': PersonFormPanel,
  'PROPERTY_FORM': PropertyFormPanel,
  'CONTRACT_FORM': ContractFormPanel,
  'INSPECTION_FORM': InspectionFormPanel,
  'BLACKLIST_FORM': BlacklistFormPanel,
  'SMART_PROMPT': SmartPromptPanel,
  'CALENDAR_EVENTS': CalendarEventsPanel,
  'PAYMENT_NOTIFICATIONS': PaymentNotificationsPanel,
  'GENERIC_ALERT': GenericAlertPanel,
  'SECTION_VIEW': SectionViewPanel,
  'SERVER_DRAWER': ServerDrawerPanel,
  'SQL_SYNC_LOG': SqlSyncLogPanel,
  'MARQUEE_ADS': MarqueeAdsPanel,
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
                className={`fixed bottom-4 left-4 right-4 z-[210] ${isTop ? '' : 'hidden'}`}
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
              className={`modal-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-300 ${isTop ? 'bg-black/20 backdrop-blur-[1px]' : 'hidden'}`}
              onClick={doClose}
            >
              <div
                className="w-full max-w-5xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] transform transition-transform duration-300 ease-out animate-scale-up"
                onClick={(e) => e.stopPropagation()}
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
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white whitespace-normal break-words leading-snug">{title}</h3>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
                  <Component id={panel.dataId} {...panel.props} onClose={doClose} />
                </div>
              </div>
            </div>
          );
        }

        // Right-side Drawer Panels
        if (panel.type === 'SERVER_DRAWER') {
          const isTop = index === activePanels.length - 1;
          return (
            <div
              key={panel.id}
              className={`modal-overlay fixed inset-0 z-[200] transition-all duration-300 ${isTop ? 'bg-black/20 backdrop-blur-[1px]' : 'hidden'}`}
              onClick={() => closePanel(panel.id)}
            >
              <div
                className="absolute inset-y-0 right-0 w-full max-w-3xl bg-white dark:bg-slate-900 shadow-2xl border-l border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="no-print flex items-start gap-3 p-4 border-b border-gray-100 dark:border-slate-800">
                  <button
                    onClick={() => closePanel(panel.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition text-slate-500 dark:text-slate-300"
                    title="إغلاق"
                  >
                    <X size={20} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white whitespace-normal break-words leading-snug">
                      {panel.props?.title ?? PANEL_TITLES[panel.type] ?? ''}
                    </h3>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
                  <Component {...panel.props} onClose={() => closePanel(panel.id)} />
                </div>
              </div>
            </div>
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
                <div key={panel.id} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleCancel}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-slate-700 animate-scale-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{panel.props?.title || 'تأكيد'}</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 whitespace-pre-line">{panel.props?.message}</p>
                        <div className="flex justify-end gap-3">
                            {showCancel && (
                              <button onClick={handleCancel} className="px-4 py-2 text-slate-600 dark:text-slate-200 font-bold hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                                {panel.props?.cancelText || 'إلغاء'}
                              </button>
                            )}
                            <button 
                                onClick={handleConfirm} 
                              className={`px-4 py-2 text-white font-bold rounded-lg shadow-lg ${panel.props?.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                {panel.props?.confirmText || 'نعم'}
                            </button>
                        </div>
                    </div>
                </div>
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
            return (
                <div key={panel.id} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleClose}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-slate-700 animate-scale-up overflow-hidden" onClick={e => e.stopPropagation()}>
                        <Component {...panel.props} onClose={handleClose} />
                    </div>
                </div>
            );
        }

        // Standard Slide-over Panels
        const isTop = index === activePanels.length - 1;
        const isSectionView = panel.type === 'SECTION_VIEW';
        const isWidePanel = panel.type === 'CALENDAR_EVENTS' || panel.type === 'SQL_SYNC_LOG';
        
        return (
          <div 
            key={panel.id} 
            className={`modal-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-300 ${isTop ? 'bg-black/20 backdrop-blur-[1px]' : 'hidden'}`}
            onClick={() => closePanel(panel.id)}
          >
            <div 
              className={`
                w-full ${isSectionView ? 'max-w-6xl' : isWidePanel ? 'max-w-5xl' : 'max-w-2xl'} bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700
                rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]
                transform transition-transform duration-300 ease-out animate-scale-up
              `}
              onClick={e => e.stopPropagation()}
            >
               {/* Panel Header */}
               <div className="no-print flex items-start gap-3 p-4 border-b border-gray-100 dark:border-slate-800">
                    <button onClick={() => closePanel(panel.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition text-slate-500 dark:text-slate-300">
                      <X size={20} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white whitespace-normal break-words leading-snug">
                      {panel.props?.title ?? PANEL_TITLES[panel.type] ?? ''}
                    </h3>
                  </div>
               </div>
               
               {/* Panel Body */}
               <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
                   <Component id={panel.dataId} {...panel.props} onClose={() => closePanel(panel.id)} />
               </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
