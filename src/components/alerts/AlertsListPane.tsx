import React from 'react';
import {
  Bell,
  AlertTriangle,
  User,
  Home,
  Layers,
  Database,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { useAlerts } from '@/hooks/useAlerts';

export type AlertsListPaneProps = {
  page: ReturnType<typeof useAlerts>;
};

const getAlertIcon = (cat: string) => {
  switch (cat) {
    case 'Financial':
      return <AlertTriangle size={20} />;
    case 'DataQuality':
      return <Database size={20} />;
    case 'Risk':
      return <ShieldAlert size={20} />;
    case 'Expiry':
      return <Clock size={20} />;
    default:
      return <Bell size={20} />;
  }
};

export const AlertsListPane: React.FC<AlertsListPaneProps> = ({ page }) => {
  const {
    pagedAlerts,
    selectedAlert,
    setSelectedAlert,
    bulkSelectedIds,
    toggleBulkSelect,
    selectAllPaged,
    handleDismiss,
    handleAlertCardPrimary,
    getAlertPrimarySpec,
  } = page;

  const allIds = pagedAlerts.map((a) => a.id).filter(Boolean);

  return (
    <div className="flex flex-col gap-3 min-h-[280px]">
      {pagedAlerts.length > 0 ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline"
            onClick={() => selectAllPaged(allIds)}
          >
            تحديد الصفحة
          </button>
          <button
            type="button"
            className="text-[11px] font-black text-slate-500 hover:underline"
            onClick={() => page.clearBulkSelection()}
          >
            إلغاء التحديد
          </button>
        </div>
      ) : null}

      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
        {pagedAlerts.map((a) => {
          const primarySpec = getAlertPrimarySpec(a);
          const active = selectedAlert?.id === a.id;
          const checked = bulkSelectedIds.has(a.id);
          return (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedAlert(a)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedAlert(a);
                }
              }}
              className={`rounded-2xl border transition-all cursor-pointer ${
                active
                  ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/30'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300'
              }`}
            >
              <div className="p-3 flex gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBulkSelect(a.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                  aria-label="تحديد للإجراء الجماعي"
                />
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow ${
                    a.category === 'Financial'
                      ? 'bg-gradient-to-br from-rose-500 to-rose-600'
                      : a.category === 'DataQuality'
                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-600'
                        : a.category === 'Risk'
                          ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                          : 'bg-gradient-to-br from-slate-500 to-slate-600'
                  }`}
                >
                  {getAlertIcon(a.category || '')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white line-clamp-2 leading-snug">
                      {a.نوع_التنبيه}
                    </h3>
                    <span className="shrink-0 text-[9px] font-black text-slate-400">
                      {new Date(a.تاريخ_الانشاء).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 line-clamp-2">
                    {a.الوصف}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.tenantName ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-[10px] font-black text-indigo-700 dark:text-indigo-300">
                        <User size={10} /> {a.tenantName}
                      </span>
                    ) : null}
                    {a.propertyCode ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                        <Home size={10} /> {a.propertyCode}
                      </span>
                    ) : null}
                    {a.category ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-300">
                        <Layers size={10} /> {a.category}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="primary"
                      type="button"
                      title={primarySpec.hint || undefined}
                      onClick={() => handleAlertCardPrimary(a)}
                      className="text-[11px] font-black px-3 py-1.5 rounded-lg"
                    >
                      {primarySpec.label}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => handleDismiss(a)}
                      className="text-[11px] font-black text-rose-600"
                    >
                      تجاهل
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
