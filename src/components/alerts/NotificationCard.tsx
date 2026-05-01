import React from 'react';
import {
  Clock,
  MessageSquare,
  ArrowUpRight,
  CheckCircle2,
  Bell,
  Wrench,
  FileText,
  ShieldAlert,
  CreditCard,
  RefreshCw,
  User,
  Hammer,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { AlertItem } from '@/hooks/useAlerts';
import { getAlertPrimarySpec, classifyAlert } from '@/services/alerts/alertActionPolicy';

interface NotificationCardProps {
  alert: AlertItem;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: (checked: boolean) => void;
  onQuickAction: (type: 'primary' | 'whatsapp' | 'open') => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-rose-500 bg-rose-500/5',
  high: 'border-amber-500 bg-amber-500/5',
  normal: 'border-blue-400 bg-blue-400/5',
  low: 'border-slate-300 bg-slate-50/50 dark:border-slate-600',
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'عاجل',
  high: 'مهم',
  normal: 'عادي',
  low: 'منخفض',
};

const SOURCE_LABELS: Record<string, string> = {
  'العقود_tbl': 'عقد',
  'الكمبيالات_tbl': 'دفعة',
  'العقارات_tbl': 'عقار',
  'الأشخاص_tbl': 'شخص',
  'تذاكر_الصيانة_tbl': 'صيانة',
  System: 'النظام',
};

const CATEGORY_ICONS = {
  urgent: ShieldAlert,
  financial: CreditCard,
  contracts: FileText,
  dataQuality: Bell,
  maintenance: Wrench,
};

const CATEGORY_COLORS = {
  urgent: 'text-rose-500 bg-rose-500/10',
  financial: 'text-amber-500 bg-amber-500/10',
  contracts: 'text-blue-500 bg-blue-500/10',
  dataQuality: 'text-indigo-500 bg-indigo-500/10',
  maintenance: 'text-emerald-500 bg-emerald-500/10',
};

// Map classifyAlert result to primary button icon
const CLASS_ICON_MAP: Record<string, React.ElementType> = {
  financial: CreditCard,
  collection_board: CreditCard,
  expiry: RefreshCw,
  contracts: FileText,
  maintenance: Hammer,
  risk: ShieldAlert,
  data_quality: Bell,
  person: User,
  property: ArrowUpRight,
  installment: CreditCard,
  tasks_followup: ArrowUpRight,
  smart_behavior: ArrowUpRight,
  system: ArrowUpRight,
  generic: ArrowUpRight,
};

function getCardCategory(alert: AlertItem) {
  if (alert.priority === 'urgent') return 'urgent';
  const cat = String(alert.category || '').toLowerCase();
  if (cat.includes('financial') || cat.includes('payment')) return 'financial';
  if (cat.includes('contract') || cat.includes('expiry')) return 'contracts';
  if (cat.includes('maintenance')) return 'maintenance';
  return 'dataQuality';
}

export const NotificationCard: React.FC<NotificationCardProps> = ({
  alert,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
  onQuickAction,
}) => {
  const cardCat = getCardCategory(alert);
  const Icon = CATEGORY_ICONS[cardCat];
  const colorClass = CATEGORY_COLORS[cardCat];
  const primarySpec = getAlertPrimarySpec(alert);
  const alertClass = classifyAlert(alert);

  const PrimaryIcon = CLASS_ICON_MAP[alertClass] || ArrowUpRight;
  const sourceLabel = SOURCE_LABELS[String(alert.مرجع_الجدول || '')] || null;
  // واتساب مناسب لكل التنبيهات عدا النظام فقط
  const showWhatsApp = alertClass !== 'system' && alertClass !== 'tasks_followup';

  const dateStr = new Date(alert.تاريخ_الانشاء).toLocaleDateString('ar-SA', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2.5 p-3.5 rounded-xl border-r-4 transition-all duration-200 cursor-pointer',
        'bg-white dark:bg-slate-900 shadow-sm hover:shadow-md',
        'ring-1 ring-slate-200/80 dark:ring-slate-800/80',
        PRIORITY_COLORS[alert.priority] ?? PRIORITY_COLORS.normal,
        isSelected && 'ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-lg shadow-indigo-500/10',
        !alert.تم_القراءة && 'bg-indigo-50/20 dark:bg-indigo-950/10'
      )}
      onClick={onSelect}
    >
      {/* Unread Dot */}
      {!alert.تم_القراءة && (
        <div className="absolute top-3.5 left-3.5 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
      )}

      {/* Checkbox */}
      <div
        className={cn(
          'absolute top-3 left-7 transition-opacity duration-150',
          isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onCheck(!isChecked);
        }}
      >
        <div
          className={cn(
            'w-5 h-5 rounded border flex items-center justify-center',
            isChecked
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
          )}
        >
          {isChecked && <CheckCircle2 size={12} />}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className={cn('p-1.5 rounded-lg shrink-0 mt-0.5', colorClass)}>
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
            {alert.نوع_التنبيه}
          </h4>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {alert.tenantName && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[110px]">
                {alert.tenantName}
              </span>
            )}
            {alert.propertyCode && (
              <>
                {alert.tenantName && (
                  <span className="text-slate-300 dark:text-slate-600 text-[10px]">·</span>
                )}
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[80px]">
                  {alert.propertyCode}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
        {alert.الوصف}
      </p>

      {/* Footer — Priority + Source + Date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              'text-[9px] font-black px-1.5 py-0.5 rounded',
              PRIORITY_BADGE[alert.priority] ?? PRIORITY_BADGE.normal
            )}
          >
            {PRIORITY_LABELS[alert.priority] ?? alert.priority}
          </span>
          {sourceLabel && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {sourceLabel}
            </span>
          )}
          {alert.count && alert.count > 1 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {alert.count} سجل
            </span>
          )}
        </div>
        <span className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
          <Clock size={9} />
          {dateStr}
        </span>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
        {/* Primary action — contextual */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickAction('primary');
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 border border-slate-100 dark:border-slate-700/60"
        >
          <PrimaryIcon size={11} />
          {primarySpec.label}
        </button>

        {/* Secondary action — WhatsApp or navigate */}
        {showWhatsApp ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction('whatsapp');
            }}
            title="إرسال واتساب"
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 border border-slate-100 dark:border-slate-700/60"
          >
            <MessageSquare size={12} />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction('open');
            }}
            title="فتح السجل"
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 border border-slate-100 dark:border-slate-700/60"
          >
            <ArrowUpRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
};
