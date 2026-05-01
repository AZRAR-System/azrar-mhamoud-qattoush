import React from 'react';
import { cn } from '@/utils/cn';
import { 
  AlertCircle, 
  CreditCard, 
  FileText, 
  Bell, 
  Wrench,
  CheckCircle2,
  Inbox
} from 'lucide-react';
import type { KanbanColumn, AlertItem } from '@/hooks/useAlerts';
import { NotificationCard } from './NotificationCard';

interface NotificationKanbanBoardProps {
  columns: KanbanColumn[];
  selectedAlert: AlertItem | null;
  selectedIds: Set<string>;
  onSelectAlert: (a: AlertItem) => void;
  onCheckAlert: (id: string, checked: boolean) => void;
  onQuickAction: (alert: AlertItem, type: 'primary' | 'whatsapp' | 'open') => void;
}

const COLUMN_ICONS = {
  urgent: AlertCircle,
  financial: CreditCard,
  contracts: FileText,
  dataQuality: Bell,
  maintenance: Wrench,
};

const COLUMN_COLORS = {
  urgent: 'bg-rose-500',
  financial: 'bg-amber-500',
  contracts: 'bg-blue-500',
  dataQuality: 'bg-indigo-500',
  maintenance: 'bg-emerald-500',
};

export const NotificationKanbanBoard: React.FC<NotificationKanbanBoardProps> = ({
  columns,
  selectedAlert,
  selectedIds,
  onSelectAlert,
  onCheckAlert,
  onQuickAction,
}) => {
  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden py-3 px-4">
      <div className="flex gap-3 h-full min-w-[600px]">
        {columns.map((col) => {
          const Icon = COLUMN_ICONS[col.id] || Bell;
          const colorClass = COLUMN_COLORS[col.id] || 'bg-slate-500';

          return (
            <div
              key={col.id}
              className="flex flex-col flex-1 min-w-[200px] max-w-[320px] h-full rounded-xl bg-slate-100/60 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800/70"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1 rounded-md text-white shadow-sm', colorClass)}>
                    <Icon size={12} />
                  </div>
                  <h3 className="font-black text-xs text-slate-700 dark:text-slate-200 leading-none">
                    {col.label}
                  </h3>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-black px-1.5 py-0.5 rounded-full',
                    col.count > 0
                      ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  )}
                >
                  {col.count}
                </span>
              </div>

              {/* Column Content */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {col.alerts.map((alert) => (
                  <NotificationCard
                    key={alert.id}
                    alert={alert}
                    isSelected={selectedAlert?.id === alert.id}
                    isChecked={selectedIds.has(alert.id)}
                    onSelect={() => onSelectAlert(alert)}
                    onCheck={(checked) => onCheckAlert(alert.id, checked)}
                    onQuickAction={(type) => onQuickAction(alert, type)}
                  />
                ))}

                {col.alerts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center opacity-30">
                    <Inbox size={22} className="text-slate-400 mb-1.5" />
                    <p className="text-[10px] font-bold text-slate-500">لا توجد تنبيهات</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
