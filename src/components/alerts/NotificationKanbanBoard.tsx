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
  onQuickAction: (alert: AlertItem, type: 'pay' | 'whatsapp' | 'open') => void;
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
    <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 px-6">
      <div className="flex gap-4 h-full min-w-max">
        {columns.map((col) => {
          const Icon = COLUMN_ICONS[col.id] || Bell;
          const colorClass = COLUMN_COLORS[col.id] || 'bg-slate-500';
          
          return (
            <div 
              key={col.id} 
              className="flex flex-col w-[300px] h-full rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-1.5 rounded-lg text-white shadow-sm", colorClass)}>
                    <Icon size={14} />
                  </div>
                  <h3 className="font-black text-sm text-slate-700 dark:text-slate-200">
                    {col.label}
                  </h3>
                </div>
                <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                  {col.count}
                </span>
              </div>

              {/* Column Content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
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
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                    <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
                      <Inbox size={32} className="text-slate-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-500">لا توجد تنبيهات</p>
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
