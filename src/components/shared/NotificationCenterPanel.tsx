import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Trash2,
  CheckCheck,
  Bell,
  CreditCard,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { DbService } from '@/services/mockDb';
import { getLastScheduledReportSnapshot } from '@/services/scheduledReports';
import type { NotificationCenterItem, NotificationCenterType } from '@/services/notificationCenter';
import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import { Button } from '@/components/ui/Button';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { applyOfficialBrandSignature } from '@/utils/brandSignature';
import { openExternalUrl } from '@/utils/externalLink';

const categoryLabels: Record<string, string> = {
  'Financial': 'مالي',
  'Expiry': 'انتهاء عقد',
  'payment': 'تحصيل',
  'overdue': 'متأخرات',
  'reminders': 'تذكيرات',
  'scheduled_financial_report': 'تقرير مالي',
  'whatsapp_auto': 'واتساب تلقائي',
  'payments': 'دفعات',
  'collection': 'تحصيل',
  'contracts': 'عقود',
  'installments': 'أقساط',
  'maintenance': 'صيانة',
  'system': 'نظام',
  'info': 'معلومات',
  'contract_renewal': 'تجديد عقد',
};

type FilterTab = 'all' | 'unread' | 'urgent' | 'reminders' | 'collection' | 'contracts' | 'installments' | 'maintenance' | 'system';

function formatRelativeTimeAr(ts: number): string {
  const now = Date.now();
  const diffSec = Math.floor((now - ts) / 1000);
  if (diffSec < 45) return 'الآن';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return m <= 1 ? 'منذ دقيقة' : `منذ ${m} دقائق`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return h <= 1 ? 'منذ ساعة' : `منذ ${h} ساعات`;
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const d = new Date(ts);
  const yesterday = new Date(startOfToday);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d >= yesterday && d < startOfToday) return 'أمس';
  const days = Math.floor(diffSec / 86400);
  return days <= 1 ? 'أمس' : `منذ ${days} أيام`;
}

function TypeIcon({ type }: { type: NotificationCenterType }) {
  const cls = 'shrink-0';
  switch (type) {
    case 'success':
      return <CheckCircle className={`${cls} text-emerald-500`} size={20} aria-hidden />;
    case 'error':
      return <AlertCircle className={`${cls} text-red-500`} size={20} aria-hidden />;
    case 'warning':
      return <AlertTriangle className={`${cls} text-amber-500`} size={20} aria-hidden />;
    case 'delete':
      return <AlertCircle className={`${cls} text-red-400`} size={20} aria-hidden />;
    default:
      return <Info className={`${cls} text-indigo-500`} size={20} aria-hidden />;
  }
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'unread', label: 'غير مقروء' },
  { id: 'urgent', label: 'عاجل' },
  { id: 'contracts', label: 'عقود' },
  { id: 'installments', label: 'أقساط' },
  { id: 'maintenance', label: 'صيانة' },
  { id: 'system', label: 'نظام' },
];

/** إشعارات تحصيل/دفعات أو متأخرات — تظهر زر واتساب */
function shouldShowWhatsAppButton(item: NotificationCenterItem): boolean {
  return item.category === 'Financial' || 
         item.category === 'payment' || 
         item.category === 'overdue';
}

function collectPhonesForNotificationEntity(entityId: string): string[] {
  const eid = String(entityId || '').trim();
  if (!eid) return [];
  const contract = DbService.getContracts().find((c) => c.رقم_العقد === eid);
  if (!contract) return [];
  const person = DbService.getPersonById(contract.رقم_المستاجر);
  const phones: string[] = [];
  if (person?.رقم_الهاتف) phones.push(person.رقم_الهاتف);
  if (person?.رقم_هاتف_اضافي) phones.push(person.رقم_هاتف_اضافي);
  return phones;
}

function matchesFilter(item: NotificationCenterItem, tab: FilterTab): boolean {
  const cat = String(item.category || '').toLowerCase();
  switch (tab) {
    case 'all':
      return true;
    case 'unread':
      return !item.read;
    case 'urgent':
      return item.urgent === true;
    case 'reminders':
      return cat === 'reminders' || cat.includes('reminder');
    case 'collection':
      return cat === 'financial' || 
             cat === 'payment' || 
             cat === 'overdue' ||
             cat === 'payments' || 
             cat === 'collection' || 
             cat.includes('payment');
    case 'contracts':
      return cat === 'contracts' || cat.includes('contract');
    case 'installments':
      return cat === 'installments' || cat === 'payments' || cat === 'payment' || cat === 'overdue' || cat.includes('payment');
    case 'maintenance':
      return cat === 'maintenance';
    case 'system':
      return cat === 'system';
    default:
      return true;
  }
}

interface Props {
  onClose: () => void;
}

export const NotificationCenterPanel: React.FC<Props> = ({ onClose }) => {
  const navigate = useNavigate();
  const { openPanel } = useSmartModal();
  const { items, markRead, markAllRead, clear } = useNotificationCenter();
  const [filter, setFilter] = useState<FilterTab>('all');

  const filtered = useMemo(
    () => items.filter((i) => matchesFilter(i, filter)),
    [items, filter]
  );

  const handleNavigate = useCallback(
    (item: NotificationCenterItem) => {
      markRead(item.id);
      const cat = String(item.category || '').toLowerCase();
      const eid = String(item.entityId || '').trim();

      if (cat === 'scheduled_financial_report') {
        const snap = getLastScheduledReportSnapshot();
        if (snap?.data) {
          openPanel('FINANCIAL_REPORT_PRINT', undefined, {
            reportData: snap.data,
            settings: DbService.getSettings(),
          });
        }
        onClose();
        return;
      }

      if (eid) {
        if (cat.includes('contract') || cat === 'contracts' || cat === 'contract_renewal') {
          openPanel('CONTRACT_DETAILS', eid);
          onClose();
          return;
        }
        if (
          cat.includes('person') ||
          cat === 'people' ||
          cat === 'blacklist' ||
          cat === 'risk' ||
          cat === 'risk_alert'
        ) {
          // If the entityId is a Contract but the category is Risk, we might still want the Person page.
          // However, backgroundScans will be updated to use PersonID for person-risks.
          openPanel('PERSON_DETAILS', eid);
          onClose();
          return;
        }
        if (cat.includes('propert')) {
          openPanel('PROPERTY_DETAILS', eid);
          onClose();
          return;
        }
        if (
          cat.includes('payment') || cat === 'payments' ||
          cat === 'overdue' || cat === 'collection' ||
          cat === 'financial' || cat === 'installment' ||
          cat === 'installments'
        ) {
          openPanel('PAYMENT_NOTIFICATIONS', undefined, { highlightId: eid, daysAhead: 30 });
          onClose();
          return;
        }
        if (cat === 'maintenance') {
          openPanel('MAINTENANCE_DETAILS', eid);
          onClose();
          return;
        }
      }

      if (cat === 'risk' || cat === 'risk_alert' || cat === 'blacklist') {
        navigate(`${ROUTE_PATHS.PEOPLE}${eid ? `?id=${eid}` : ''}`);
        onClose();
        return;
      }

      if (cat === 'reminders' || cat.includes('reminder')) {
        navigate(ROUTE_PATHS.DASHBOARD);
        onClose();
        return;
      }
      if (cat === 'payments' || cat.includes('payment') || cat === 'collection') {
        navigate(ROUTE_PATHS.INSTALLMENTS);
        onClose();
        return;
      }
      if (cat === 'contracts' || cat.includes('contract')) {
        navigate(ROUTE_PATHS.CONTRACTS);
        onClose();
        return;
      }
      if (cat === 'commissions' || cat.includes('commission')) {
        navigate(ROUTE_PATHS.COMMISSIONS);
        onClose();
        return;
      }
      if (cat === 'maintenance') {
        navigate(ROUTE_PATHS.MAINTENANCE);
        onClose();
        return;
      }
      if (cat === 'system') {
        navigate(ROUTE_PATHS.SETTINGS);
        onClose();
        return;
      }

      navigate(ROUTE_PATHS.ALERTS);
      onClose();
    },
    [markRead, navigate, onClose, openPanel]
  );

  const handleWhatsApp = useCallback(async (item: NotificationCenterItem) => {
    const rawMsg = item.message;
    const settings = DbService.getSettings();
    const phones = collectPhonesForNotificationEntity(String(item.entityId || ''));
    if (phones.length > 0) {
      await openWhatsAppForPhones(rawMsg, phones, {
        defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
        delayMs: settings.whatsAppDelayMs ?? 10_000,
        target: settings.whatsAppTarget ?? 'auto',
      });
    } else {
      const text = applyOfficialBrandSignature(rawMsg);
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      openExternalUrl(url);
    }
  }, []);

  return (
    <div className="flex h-full min-h-[50vh] flex-col">
      <div className="border-b border-slate-100 px-4 pb-3 dark:border-slate-800">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400"
            onClick={() => {
              openPanel('PAYMENT_NOTIFICATIONS', undefined, { daysAhead: 7 });
            }}
          >
            <CreditCard size={16} aria-hidden />
            تنبيهات الدفعات والتحصيل
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                filter === t.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="h-8 gap-1 text-xs" onClick={markAllRead}>
            <CheckCheck size={14} aria-hidden />
            تحديد الكل كمقروء
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1 text-xs text-red-600 dark:text-red-400"
            onClick={() => clear()}
          >
            <Trash2 size={14} aria-hidden />
            مسح الكل
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-400">
            <Bell className="opacity-40" size={40} aria-hidden />
            <p className="text-sm font-bold">لا توجد إشعارات في هذا التصفية</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => (
              <li key={item.id}>
                <div
                  className={`flex w-full gap-2 rounded-xl border p-2 text-right transition sm:gap-3 sm:p-3 ${
                    item.read
                      ? 'border-slate-100 bg-white/50 opacity-70 dark:border-slate-800 dark:bg-slate-900/40 hover:opacity-100'
                      : item.urgent
                        ? 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/30 ring-1 ring-red-400/40 hover:bg-red-50 dark:hover:bg-red-950/50'
                        : item.type === 'error'
                          ? 'border-red-100 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/20 hover:bg-red-50/60 dark:hover:bg-red-950/30'
                          : item.type === 'warning'
                            ? 'border-amber-100 bg-amber-50/40 dark:border-amber-900/30 dark:bg-amber-950/20 hover:bg-amber-50/60 dark:hover:bg-amber-950/30'
                            : item.type === 'success'
                              ? 'border-green-100 bg-green-50/40 dark:border-green-900/30 dark:bg-green-950/20 hover:bg-green-50/60 dark:hover:bg-green-950/30'
                              : 'border-indigo-100 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleNavigate(item)}
                    className="flex min-w-0 flex-1 gap-3 rounded-lg p-1 text-right outline-none ring-offset-2 ring-offset-white hover:bg-slate-100/80 focus-visible:ring-2 focus-visible:ring-indigo-400 dark:ring-offset-slate-900 dark:hover:bg-slate-800/60"
                  >
                    <TypeIcon type={item.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{item.title}</span>
                        {item.urgent && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
                            عاجل
                          </span>
                        )}
                        {!item.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-label="غير مقروء" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                        {item.message}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>{formatRelativeTimeAr(item.timestamp)}</span>
                        <span className="opacity-60">•</span>
                        <span className="font-mono text-[10px]">
                          {categoryLabels[item.category] || item.category}
                        </span>
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1 shrink-0">
                    {shouldShowWhatsAppButton(item) && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-auto flex-col gap-0.5 px-2 py-1.5 text-[10px] font-bold leading-tight sm:flex-row sm:gap-1 sm:px-3 sm:text-xs"
                        title="إرسال واتساب"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleWhatsApp(item);
                        }}
                      >
                        <MessageCircle size={16} className="shrink-0 sm:size-[18px]" aria-hidden />
                        <span className="max-w-[4.5rem] sm:max-w-none">واتساب</span>
                      </Button>
                    )}
                    {(item.category === 'payment' || item.category === 'overdue' || item.category === 'installment') && item.entityId && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto flex-col gap-0.5 px-2 py-1.5 text-[10px] font-bold leading-tight text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                        title="تسجيل دفع"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(item.id);
                          openPanel('PAYMENT_NOTIFICATIONS', undefined, { highlightId: item.entityId ?? '', daysAhead: 30 });
                          onClose();
                        }}
                      >
                        <CreditCard size={16} className="shrink-0" aria-hidden />
                        <span>دفع</span>
                      </Button>
                    )}
                    {(item.category === 'contracts' || item.category === 'contract_renewal') && item.entityId && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto flex-col gap-0.5 px-2 py-1.5 text-[10px] font-bold leading-tight text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                        title="فتح العقد"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(item.id);
                          openPanel('CONTRACT_DETAILS', item.entityId ?? '');
                          onClose();
                        }}
                      >
                        <FileText size={16} className="shrink-0" aria-hidden />
                        <span>العقد</span>
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};