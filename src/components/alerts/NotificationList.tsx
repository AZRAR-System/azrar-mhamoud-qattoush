import React from 'react';
import {
  Bell, Wrench, FileText, CreditCard, ShieldAlert,
  MessageSquare, ArrowUpRight, CheckCircle2, RefreshCw,
  Hammer, User, Scale, Inbox, Receipt,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { AlertItem } from '@/hooks/useAlerts';
import { getAlertPrimarySpec, classifyAlert } from '@/services/alerts/alertActionPolicy';

/* ───────────── helpers ───────────── */

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} د`;
  if (diffHours < 24) return `منذ ${diffHours} س`;
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
}

const PRIORITY_BAR: Record<string, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-amber-400',
  normal: 'bg-blue-400',
  low: 'bg-slate-300 dark:bg-slate-600',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'عاجل',
  high: 'مهم',
  normal: 'عادي',
  low: 'منخفض',
};

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  urgent: ShieldAlert,
  financial: CreditCard,
  collection_board: CreditCard,
  contracts: FileText,
  expiry: RefreshCw,
  maintenance: Wrench,
  data_quality: Bell,
  risk: ShieldAlert,
  person: User,
  property: ArrowUpRight,
  installment: CreditCard,
  tasks_followup: ArrowUpRight,
  smart_behavior: ArrowUpRight,
  system: Bell,
  generic: Bell,
};

const CATEGORY_COLOR_MAP: Record<string, string> = {
  urgent: 'bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400',
  financial: 'bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-400',
  collection_board: 'bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-400',
  contracts: 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400',
  expiry: 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400',
  maintenance: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
  data_quality: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400',
  risk: 'bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400',
  person: 'bg-purple-50 text-purple-500 dark:bg-purple-900/20 dark:text-purple-400',
  property: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  installment: 'bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-400',
  system: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  generic: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  tasks_followup: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
  smart_behavior: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
};

const CLASS_PRIMARY_ICON: Record<string, React.ElementType> = {
  financial: CreditCard,
  collection_board: CreditCard,
  expiry: RefreshCw,
  contracts: FileText,
  maintenance: Hammer,
  risk: ShieldAlert,
  data_quality: Bell,
  person: User,
  installment: CreditCard,
  receipt: Receipt,
  legal: Scale,
  system: ArrowUpRight,
  generic: ArrowUpRight,
  tasks_followup: ArrowUpRight,
  smart_behavior: ArrowUpRight,
  property: ArrowUpRight,
};

const SOURCE_LABELS: Record<string, string> = {
  'العقود_tbl': 'عقد',
  'الكمبيالات_tbl': 'دفعة',
  'العقارات_tbl': 'عقار',
  'الأشخاص_tbl': 'شخص',
  'تذاكر_الصيانة_tbl': 'صيانة',
  System: 'النظام',
};

/* ───────────── Row ───────────── */

interface RowProps {
  alert: AlertItem;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: (checked: boolean) => void;
  onQuickAction: (type: 'primary' | 'whatsapp' | 'open') => void;
}

const NotificationRow: React.FC<RowProps> = ({
  alert, isSelected, isChecked, onSelect, onCheck, onQuickAction,
}) => {
  const alertClass = classifyAlert(alert);
  const primarySpec = getAlertPrimarySpec(alert);
  const Icon = CATEGORY_ICON_MAP[alertClass] ?? Bell;
  const iconColor = CATEGORY_COLOR_MAP[alertClass] ?? CATEGORY_COLOR_MAP.generic;
  const PrimaryIcon = CLASS_PRIMARY_ICON[alertClass] ?? ArrowUpRight;
  const sourceLabel = SOURCE_LABELS[String(alert.مرجع_الجدول || '')] ?? null;
  const showWhatsApp = alertClass !== 'system' && alertClass !== 'tasks_followup';
  const time = timeAgo(alert.تاريخ_الانشاء);
  const isUnread = !alert.تم_القراءة;

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors duration-150',
        isSelected
          ? 'bg-indigo-50 dark:bg-indigo-950/30'
          : isUnread
          ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40'
          : 'bg-slate-50/40 dark:bg-slate-900/20 hover:bg-slate-50 dark:hover:bg-slate-800/30'
      )}
      onClick={onSelect}
    >
      {/* Priority strip — right edge (RTL start) */}
      <div
        className={cn(
          'absolute right-0 top-2 bottom-2 w-[3px] rounded-r-full',
          PRIORITY_BAR[alert.priority] ?? PRIORITY_BAR.normal
        )}
      />

      {/* Checkbox (hover) */}
      <div
        className={cn(
          'flex items-center pt-0.5 shrink-0 transition-opacity duration-150',
          isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'
        )}
        onClick={(e) => { e.stopPropagation(); onCheck(!isChecked); }}
      >
        <div
          className={cn(
            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
            isChecked
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
          )}
        >
          {isChecked && <CheckCircle2 size={12} />}
        </div>
      </div>

      {/* Unread dot */}
      <div className="flex items-center pt-1.5 shrink-0">
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-all',
            isUnread ? 'bg-indigo-500 shadow-sm shadow-indigo-500/50' : 'bg-transparent'
          )}
        />
      </div>

      {/* Category icon */}
      <div className={cn('p-2.5 rounded-xl shrink-0 mt-0.5', iconColor)}>
        <Icon size={17} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title + time */}
        <div className="flex items-start justify-between gap-3">
          <h4
            className={cn(
              'text-sm leading-snug',
              isUnread
                ? 'font-bold text-slate-800 dark:text-white'
                : 'font-medium text-slate-500 dark:text-slate-400'
            )}
          >
            {alert.نوع_التنبيه}
          </h4>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
              {time}
            </span>
            {alert.priority === 'urgent' && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 leading-none">
                {PRIORITY_LABELS.urgent}
              </span>
            )}
          </div>
        </div>

        {/* Meta: tenant · property · source badge */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {alert.tenantName && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[140px]">
              {alert.tenantName}
            </span>
          )}
          {alert.propertyCode && (
            <>
              {alert.tenantName && <span className="text-slate-300 dark:text-slate-700 text-[10px]">·</span>}
              <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[100px]">
                {alert.propertyCode}
              </span>
            </>
          )}
          {sourceLabel && (
            <>
              <span className="text-slate-300 dark:text-slate-700 text-[10px]">·</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                {sourceLabel}
              </span>
            </>
          )}
          {alert.count && alert.count > 1 && (
            <>
              <span className="text-slate-300 dark:text-slate-700 text-[10px]">·</span>
              <span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500">
                {alert.count} سجلات
              </span>
            </>
          )}
        </div>

        {/* Description */}
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-1 leading-relaxed">
          {alert.الوصف}
        </p>

        {/* Quick actions — show on hover or when selected */}
        <div
          className={cn(
            'flex items-center gap-2 mt-2.5 transition-all duration-150',
            isSelected ? 'opacity-100 translate-y-0' : 'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0'
          )}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onQuickAction('primary'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-100 dark:border-indigo-900/40"
          >
            <PrimaryIcon size={11} />
            {primarySpec.label}
          </button>
          {showWhatsApp && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickAction('whatsapp'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-100 dark:border-emerald-900/40"
            >
              <MessageSquare size={11} />
              واتساب
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onQuickAction('open'); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowUpRight size={11} />
            فتح
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────── List ───────────── */

interface NotificationListProps {
  alerts: AlertItem[];
  selectedAlert: AlertItem | null;
  selectedIds: Set<string>;
  onSelectAlert: (a: AlertItem) => void;
  onCheckAlert: (id: string, checked: boolean) => void;
  onQuickAction: (alert: AlertItem, type: 'primary' | 'whatsapp' | 'open') => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  alerts, selectedAlert, selectedIds, onSelectAlert, onCheckAlert, onQuickAction,
}) => {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-40">
        <div className="p-6 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
          <Inbox size={40} className="text-slate-400" />
        </div>
        <p className="text-sm font-bold text-slate-500">لا توجد تنبيهات</p>
        <p className="text-xs text-slate-400 mt-1">كل شيء على ما يرام</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {alerts.map((alert) => (
        <NotificationRow
          key={alert.id}
          alert={alert}
          isSelected={selectedAlert?.id === alert.id}
          isChecked={selectedIds.has(alert.id)}
          onSelect={() => onSelectAlert(alert)}
          onCheck={(checked) => onCheckAlert(alert.id, checked)}
          onQuickAction={(type) => onQuickAction(alert, type)}
        />
      ))}
    </div>
  );
};
