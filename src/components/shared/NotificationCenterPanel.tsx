import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, Trash2, X, ExternalLink,
  CreditCard, MessageCircle, FileText, Wrench,
  AlertCircle, AlertTriangle, CheckCircle, Info,
  RefreshCw, ShieldAlert, User,
} from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { DbService } from '@/services/mockDb';
import { getLastScheduledReportSnapshot } from '@/services/scheduledReports';
import type { NotificationCenterItem, NotificationCenterType } from '@/services/notificationCenter';
import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { applyOfficialBrandSignature } from '@/utils/brandSignature';
import { openExternalUrl } from '@/utils/externalLink';
import type { العقود_tbl, الكمبيالات_tbl } from '@/types';
import { cn } from '@/utils/cn';

/* ─── helpers ─── */

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 45) return 'الآن';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return m <= 1 ? 'دقيقة' : `${m} د`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return h <= 1 ? 'ساعة' : `${h} س`;
  }
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const d = new Date(ts);
  if (d >= new Date(startOfToday.getTime() - 86400000) && d < startOfToday) return 'أمس';
  return `${Math.floor(diff / 86400)} أيام`;
}

const trimId = (v: unknown) => String(v ?? '').trim();

/* ─── category config ─── */

type TabId = 'all' | 'unread' | 'urgent' | 'financial' | 'contracts' | 'maintenance' | 'system';

const TABS: { id: TabId; label: string; color: string; activeColor: string }[] = [
  { id: 'all',         label: 'الكل',       color: 'text-slate-400',   activeColor: 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' },
  { id: 'unread',      label: 'غير مقروء',  color: 'text-indigo-400',  activeColor: 'bg-indigo-600 text-white' },
  { id: 'urgent',      label: 'عاجل',       color: 'text-rose-400',    activeColor: 'bg-rose-500 text-white' },
  { id: 'financial',   label: 'مالي',       color: 'text-amber-400',   activeColor: 'bg-amber-500 text-white' },
  { id: 'contracts',   label: 'عقود',       color: 'text-blue-400',    activeColor: 'bg-blue-500 text-white' },
  { id: 'maintenance', label: 'صيانة',      color: 'text-emerald-400', activeColor: 'bg-emerald-500 text-white' },
  { id: 'system',      label: 'النظام',     color: 'text-slate-400',   activeColor: 'bg-slate-600 text-white' },
];

function matchesTab(item: NotificationCenterItem, tab: TabId): boolean {
  const cat = String(item.category || '').toLowerCase();
  switch (tab) {
    case 'all':         return true;
    case 'unread':      return !item.read;
    case 'urgent':      return item.urgent === true;
    case 'financial':   return ['financial', 'payment', 'overdue', 'payments', 'collection', 'installments'].some(k => cat.includes(k));
    case 'contracts':   return cat.includes('contract') || cat === 'contracts';
    case 'maintenance': return cat === 'maintenance';
    case 'system':      return cat === 'system' || cat === 'info' || cat.includes('report') || cat.includes('whatsapp');
    default:            return true;
  }
}

/* ─── icon per type ─── */

function ItemIcon({ type, urgent, category }: { type: NotificationCenterType; urgent?: boolean; category: string }) {
  const cat = String(category || '').toLowerCase();
  if (urgent) return <ShieldAlert size={18} className="text-rose-500" />;
  if (cat.includes('contract') || cat === 'contracts') return <FileText size={18} className="text-blue-500" />;
  if (['financial', 'payment', 'overdue', 'payments', 'collection', 'installment'].some(k => cat.includes(k)))
    return <CreditCard size={18} className="text-amber-500" />;
  if (cat === 'maintenance') return <Wrench size={18} className="text-emerald-600" />;
  if (cat.includes('whatsapp')) return <MessageCircle size={18} className="text-emerald-500" />;
  if (cat.includes('person') || cat === 'blacklist' || cat === 'risk') return <User size={18} className="text-purple-500" />;
  if (cat.includes('renew')) return <RefreshCw size={18} className="text-blue-400" />;
  switch (type) {
    case 'success': return <CheckCircle size={18} className="text-emerald-500" />;
    case 'error':   return <AlertCircle size={18} className="text-rose-500" />;
    case 'warning': return <AlertTriangle size={18} className="text-amber-500" />;
    default:        return <Info size={18} className="text-indigo-500" />;
  }
}

function iconBg(type: NotificationCenterType, urgent?: boolean, category?: string): string {
  const cat = String(category || '').toLowerCase();
  if (urgent) return 'bg-rose-50 dark:bg-rose-900/20';
  if (cat.includes('contract')) return 'bg-blue-50 dark:bg-blue-900/20';
  if (['financial', 'payment', 'overdue', 'collection'].some(k => cat.includes(k))) return 'bg-amber-50 dark:bg-amber-900/20';
  if (cat === 'maintenance') return 'bg-emerald-50 dark:bg-emerald-900/20';
  if (cat.includes('whatsapp')) return 'bg-emerald-50 dark:bg-emerald-900/20';
  switch (type) {
    case 'success': return 'bg-emerald-50 dark:bg-emerald-900/20';
    case 'error':   return 'bg-rose-50 dark:bg-rose-900/20';
    case 'warning': return 'bg-amber-50 dark:bg-amber-900/20';
    default:        return 'bg-indigo-50 dark:bg-indigo-900/20';
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  Financial: 'مالي', financial: 'مالي', payment: 'تحصيل', overdue: 'متأخرات',
  contracts: 'عقود', installments: 'أقساط', maintenance: 'صيانة',
  system: 'نظام', info: 'معلومات', contract_renewal: 'تجديد عقد',
  blacklist: 'قائمة سوداء', risk: 'مخاطر', collection: 'تحصيل',
  payments: 'دفعات', scheduled_financial_report: 'تقرير مالي',
  whatsapp_auto: 'واتساب تلقائي', whatsapp_auto_before: 'تذكير واتساب',
  whatsapp_auto_due: 'استحقاق واتساب', whatsapp_auto_late: 'تأخر واتساب',
};

/* ─── main component ─── */

interface Props {
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
}

export const NotificationCenterPanel: React.FC<Props> = ({ onClose }) => {
  const navigate = useNavigate();
  const { openPanel } = useSmartModal();
  const { items, markRead, markAllRead, clear, unreadCount } = useNotificationCenter();
  const [tab, setTab] = useState<TabId>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  /* ── DB index ── */
  const dbIndex = useMemo(() => {
    const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
    const installments = (DbService.getInstallments?.() || []) as الكمبيالات_tbl[];
    const contractIds = new Set<string>();
    const installToContract = new Map<string, string>();
    for (const c of contracts) { const id = trimId(c?.رقم_العقد); if (id) contractIds.add(id); }
    for (const i of installments) {
      const iid = trimId(i?.رقم_الكمبيالة); const cid = trimId(i?.رقم_العقد);
      if (iid && cid) installToContract.set(iid, cid);
    }
    return { contractIds, installToContract };
  }, []);

  const resolveContractId = useCallback((eid: string) => {
    const e = trimId(eid);
    if (!e) return null;
    if (dbIndex.contractIds.has(e)) return e;
    return dbIndex.installToContract.get(e) || null;
  }, [dbIndex]);

  const collectPhones = useCallback((eid: string) => {
    const cid = resolveContractId(eid);
    if (!cid) return [];
    const contract = (DbService.getContracts?.() || []).find(c => trimId((c as العقود_tbl).رقم_العقد) === cid) as العقود_tbl | undefined;
    if (!contract) return [];
    const person = DbService.getPersonById(contract.رقم_المستاجر);
    return [person?.رقم_الهاتف, person?.رقم_هاتف_اضافي].filter(Boolean) as string[];
  }, [resolveContractId]);

  const filtered = useMemo(() => items.filter(i => matchesTab(i, tab)), [items, tab]);

  /* ── handlers ── */
  const handleNavigate = useCallback((item: NotificationCenterItem) => {
    markRead(item.id);
    const cat = String(item.category || '').toLowerCase();
    const eid = trimId(item.entityId);

    if (cat === 'scheduled_financial_report') {
      const snap = getLastScheduledReportSnapshot();
      if (snap?.data) openPanel('FINANCIAL_REPORT_PRINT', undefined, { reportData: snap.data, settings: DbService.getSettings() });
      onClose(); return;
    }
    if (eid) {
      if (cat.includes('contract') || cat === 'contract_renewal') { openPanel('CONTRACT_DETAILS', eid); onClose(); return; }
      if (cat.includes('person') || cat === 'blacklist' || cat === 'risk') { openPanel('PERSON_DETAILS', eid); onClose(); return; }
      if (cat.includes('propert')) { openPanel('PROPERTY_DETAILS', eid); onClose(); return; }
      if (['payment', 'payments', 'overdue', 'collection', 'financial', 'installment'].some(k => cat.includes(k))) {
        const cid = resolveContractId(eid);
        if (cid) { openPanel('CONTRACT_DETAILS', cid); } else { navigate(ROUTE_PATHS.INSTALLMENTS); }
        onClose(); return;
      }
      if (cat === 'maintenance') { openPanel('MAINTENANCE_DETAILS', eid); onClose(); return; }
    }
    navigate(ROUTE_PATHS.ALERTS);
    onClose();
  }, [markRead, onClose, openPanel, navigate, resolveContractId]);

  const handleWhatsApp = useCallback(async (item: NotificationCenterItem) => {
    const phones = collectPhones(trimId(item.entityId));
    const settings = DbService.getSettings();
    if (phones.length > 0) {
      await openWhatsAppForPhones(item.message, phones, {
        defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
        delayMs: settings.whatsAppDelayMs ?? 10_000,
        target: settings.whatsAppTarget ?? 'auto',
      });
    } else {
      openExternalUrl(`https://wa.me/?text=${encodeURIComponent(applyOfficialBrandSignature(item.message))}`);
    }
  }, [collectPhones]);

  const handleViewAll = () => { navigate(ROUTE_PATHS.ALERTS); onClose(); };

  /* ── action buttons per item ── */
  const renderActions = (item: NotificationCenterItem) => {
    const cat = String(item.category || '').toLowerCase();
    const eid = trimId(item.entityId);
    const btns: React.ReactNode[] = [];

    if (['financial', 'payment', 'overdue', 'collection'].some(k => cat.includes(k)) || item.urgent) {
      btns.push(
        <button key="wa" onClick={e => { e.stopPropagation(); void handleWhatsApp(item); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition-colors">
          <MessageCircle size={11} /> واتساب
        </button>
      );
    }
    if (['payment', 'overdue', 'installment', 'installments'].some(k => cat === k || cat.includes(k)) && eid) {
      btns.push(
        <button key="pay" onClick={e => { e.stopPropagation(); markRead(item.id); navigate(`${ROUTE_PATHS.INSTALLMENTS}?id=${eid}`); onClose(); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 transition-colors">
          <CreditCard size={11} /> دفع
        </button>
      );
    }
    if ((cat.includes('contract') || cat === 'contract_renewal') && eid) {
      btns.push(
        <button key="contract" onClick={e => { e.stopPropagation(); markRead(item.id); openPanel('CONTRACT_DETAILS', eid); onClose(); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors">
          <FileText size={11} /> العقد
        </button>
      );
    }
    if (cat === 'maintenance' && eid) {
      btns.push(
        <button key="maint" onClick={e => { e.stopPropagation(); markRead(item.id); openPanel('MAINTENANCE_DETAILS', eid); onClose(); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition-colors">
          <Wrench size={11} /> صيانة
        </button>
      );
    }
    if (btns.length === 0 && eid) {
      btns.push(
        <button key="open" onClick={e => { e.stopPropagation(); handleNavigate(item); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors">
          <ExternalLink size={11} /> فتح
        </button>
      );
    }
    return btns;
  };

  /* ── render ── */
  return (
    <div
      ref={panelRef}
      className="fixed top-[72px] left-3 z-[9999] w-[420px] max-w-[calc(100vw-1.5rem)] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/20 dark:shadow-black/40 border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      style={{ maxHeight: 'calc(100vh - 90px)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Bell size={16} />
          </div>
          <div>
            <h2 className="text-[15px] font-black text-slate-800 dark:text-white leading-none">الإشعارات</h2>
            {unreadCount > 0 && (
              <p className="text-[10px] text-indigo-500 font-bold mt-0.5">{unreadCount} غير مقروء</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button onClick={() => markAllRead()}
              title="قراءة الكل"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-colors">
              <CheckCheck size={14} /> قراءة الكل
            </button>
          )}
          <button onClick={() => clear()}
            title="مسح الكل"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
            <Trash2 size={14} />
          </button>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-hide shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0',
              tab === t.id
                ? t.activeColor + ' shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            {t.label}
            {t.id !== 'all' && items.filter(i => matchesTab(i, t.id) && !i.read).length > 0 && (
              <span className={cn('text-[9px] font-black px-1 py-0.5 rounded-full leading-none',
                tab === t.id ? 'bg-white/20' : 'bg-white dark:bg-slate-700 text-slate-500')}>
                {items.filter(i => matchesTab(i, t.id) && !i.read).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
            <div className="p-5 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
              <Bell size={32} className="text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-500">لا توجد إشعارات</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((item) => {
              const actions = renderActions(item);
              return (
                <div
                  key={item.id}
                  onClick={() => handleNavigate(item)}
                  className={cn(
                    'group flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors',
                    item.urgent && !item.read
                      ? 'bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                      : !item.read
                      ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      : 'bg-slate-50/30 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 opacity-70 hover:opacity-100'
                  )}
                >
                  {/* Icon */}
                  <div className={cn('p-2.5 rounded-xl shrink-0 mt-0.5', iconBg(item.type, item.urgent, item.category))}>
                    <ItemIcon type={item.type} urgent={item.urgent} category={item.category} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-[13px] leading-snug', !item.read ? 'font-bold text-slate-800 dark:text-white' : 'font-medium text-slate-500 dark:text-slate-400')}>
                        {item.title}
                        {item.urgent && (
                          <span className="mr-1.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 align-middle">عاجل</span>
                        )}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap mt-0.5">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </span>
                    </div>

                    {/* Action buttons */}
                    {actions.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2.5" onClick={e => e.stopPropagation()}>
                        {actions}
                      </div>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!item.read && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 p-2">
        <button
          onClick={handleViewAll}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
        >
          <ExternalLink size={14} />
          عرض جميع التنبيهات {items.length > 0 && `(${items.length})`}
        </button>
      </div>
    </div>
  );
};
