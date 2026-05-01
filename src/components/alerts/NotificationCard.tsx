import React from 'react';
import { 
  Circle, 
  Clock, 
  MessageSquare, 
  CreditCard, 
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Bell,
  Wrench,
  FileText,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { AlertItem } from '@/hooks/useAlerts';

interface NotificationCardProps {
  alert: AlertItem;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: (checked: boolean) => void;
  onQuickAction: (type: 'pay' | 'whatsapp' | 'open') => void;
}

const PRIORITY_COLORS = {
  urgent: 'border-rose-500 bg-rose-500/5',
  high: 'border-amber-500 bg-amber-500/5',
  normal: 'border-blue-500 bg-blue-500/5',
  low: 'border-emerald-500 bg-emerald-500/5',
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

export const NotificationCard: React.FC<NotificationCardProps> = ({
  alert,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
  onQuickAction,
}) => {
  const Icon = CATEGORY_ICONS[alert.priority === 'urgent' ? 'urgent' : (alert.category.toLowerCase().includes('financial') ? 'financial' : alert.category.toLowerCase().includes('contract') ? 'contracts' : alert.category.toLowerCase().includes('maintenance') ? 'maintenance' : 'dataQuality') as keyof typeof CATEGORY_ICONS] || Bell;
  const colorClass = CATEGORY_COLORS[alert.priority === 'urgent' ? 'urgent' : (alert.category.toLowerCase().includes('financial') ? 'financial' : alert.category.toLowerCase().includes('contract') ? 'contracts' : alert.category.toLowerCase().includes('maintenance') ? 'maintenance' : 'dataQuality') as keyof typeof CATEGORY_COLORS] || 'text-slate-500 bg-slate-500/10';

  const timeStr = new Date(alert.تاريخ_الانشاء).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 p-4 rounded-xl border-r-4 transition-all duration-300 cursor-pointer',
        'bg-white dark:bg-slate-900 shadow-sm hover:shadow-md ring-1 ring-slate-200 dark:ring-slate-800',
        PRIORITY_COLORS[alert.priority],
        isSelected && 'ring-2 ring-indigo-500 dark:ring-indigo-400 z-10',
        !alert.تم_القراءة && 'bg-indigo-50/30 dark:bg-indigo-900/10'
      )}
      onClick={onSelect}
    >
      {/* Unread Dot */}
      {!alert.تم_القراءة && (
        <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
      )}

      {/* Checkbox */}
      <div 
        className={cn(
          "absolute top-3 left-8 transition-opacity duration-200",
          (isChecked || isSelected) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onCheck(!isChecked);
        }}
      >
        <div className={cn(
          "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
          isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
        )}>
          {isChecked && <CheckCircle2 size={14} />}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', colorClass)}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
            {alert.نوع_التنبيه}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
            {alert.tenantName || alert.propertyCode || 'النظام'}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
        {alert.الوصف}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[10px] font-black uppercase px-1.5 py-0.5 rounded",
            alert.priority === 'urgent' ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
            alert.priority === 'high' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          )}>
            {alert.priority}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
            <Clock size={10} />
            {timeStr}
          </span>
        </div>
        
        {alert.count && alert.count > 1 && (
          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">
            {alert.count}
          </span>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mt-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickAction('pay');
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
        >
          {alert.category.toLowerCase().includes('financial') ? <CreditCard size={12} /> : <ArrowUpRight size={12} />}
          {alert.category.toLowerCase().includes('financial') ? 'دفع' : 'فتح'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickAction('whatsapp');
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
        >
          <MessageSquare size={12} />
          واتساب
        </button>
      </div>
    </div>
  );
};
