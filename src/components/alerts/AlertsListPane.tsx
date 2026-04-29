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
  const s = 17;
  switch (cat) {
    case 'Financial':
      return <AlertTriangle size={s} strokeWidth={2} />;
    case 'DataQuality':
      return <Database size={s} strokeWidth={2} />;
    case 'Risk':
      return <ShieldAlert size={s} strokeWidth={2} />;
    case 'Expiry':
      return <Clock size={s} strokeWidth={2} />;
    default:
      return <Bell size={s} strokeWidth={2} />;
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
    <div className="flex flex-col gap-4 min-h-[280px]">
      {pagedAlerts.length > 0 ? (
        <div className="flex items-stretch justify-between gap-0 overflow-hidden rounded-lg border border-slate-200/60 bg-white/90 dark:border-slate-700/60 dark:bg-slate-900/50">
          <button
            type="button"
            className="flex-1 px-2.5 py-2 text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-50/80 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
            onClick={() => selectAllPaged(allIds)}
          >
            تحديد الصفحة
          </button>
          <div className="w-px shrink-0 self-stretch bg-slate-200 dark:bg-slate-700" aria-hidden />
          <button
            type="button"
            className="flex-1 px-2.5 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
            onClick={() => page.clearBulkSelection()}
          >
            إلغاء التحديد
          </button>
        </div>
      ) : null}

      <div className="space-y-2.5 overflow-y-auto max-h-[calc(100vh-320px)] pe-0.5 scroll-pb-4">
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
              className={`rounded-xl border transition-all cursor-pointer shadow-sm ${
                active
                  ? 'border-indigo-400 ring-1 ring-indigo-500/30 bg-white dark:bg-slate-900 shadow-md dark:shadow-indigo-950/20'
                  : 'border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex gap-3 p-3.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBulkSelect(a.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                  aria-label="تحديد للإجراء الجماعي"
                />
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${
                    a.category === 'Financial'
                      ? 'bg-rose-600'
                      : a.category === 'DataQuality'
                        ? 'bg-indigo-600'
                        : a.category === 'Risk'
                          ? 'bg-amber-600'
                          : 'bg-slate-600'
                  }`}
                >
                  {getAlertIcon(a.category || '')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
                      {a.نوع_التنبيه}
                    </h3>
                    <span className="shrink-0 tabular-nums text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      {new Date(a.تاريخ_الانشاء).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                    {a.الوصف}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.tenantName ? (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50/90 px-2 py-0.5 text-[10px] font-medium text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/50 dark:text-indigo-200">
                        <User size={10} className="shrink-0 opacity-80" />{' '}
                        <span className="truncate">{a.tenantName}</span>
                      </span>
                    ) : null}
                    {a.propertyCode ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                        <Home size={10} className="shrink-0 opacity-80" /> {a.propertyCode}
                      </span>
                    ) : null}
                    {a.category ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Layers size={10} className="shrink-0 opacity-70" /> {a.category}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="primary"
                      type="button"
                      title={primarySpec.hint || undefined}
                      onClick={() => handleAlertCardPrimary(a)}
                      className="min-h-9 rounded-lg px-3.5 text-[11px] font-semibold shadow-sm"
                    >
                      {primarySpec.label}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => handleDismiss(a)}
                      className="min-h-9 rounded-lg border-rose-200 text-[11px] font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
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
