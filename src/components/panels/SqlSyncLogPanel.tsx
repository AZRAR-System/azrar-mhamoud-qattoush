import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  RefreshCcw, 
  Trash2, 
  Search, 
  Server, 
  ArrowDownToLine, 
  ArrowUpToLine, 
  AlertTriangle, 
  CheckCircle2, 
  History
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';

type SyncLogItem = {
  id: string;
  ts: string;
  direction: 'push' | 'pull' | 'system';
  action: string;
  key?: string;
  status: 'ok' | 'error';
  message?: string;
};

type SqlSyncLogResponse = {
  items?: SyncLogItem[];
};

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString('ar-JO', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return ts;
  }
}

export const SqlSyncLogPanel: React.FC = () => {
  const t = useCallback((s: string) => s, []);
  const toast = useToast();
  const [items, setItems] = useState<SyncLogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const canUse = !!window.desktopDb?.sqlGetSyncLog;

  const refresh = async () => {
    if (!window.desktopDb?.sqlGetSyncLog) return;
    setBusy(true);
    try {
      const res = (await window.desktopDb.sqlGetSyncLog()) as unknown as SqlSyncLogResponse | null;
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل تحميل سجل المزامنة');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.desktopDb?.sqlClearSyncLog) return;
    setBusy(true);
    try {
      await window.desktopDb.sqlClearSyncLog();
      setItems([]);
      toast.success('تم مسح سجل المزامنة');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل مسح سجل المزامنة');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!canUse) return;
    void refresh();

    const off = window.desktopDb?.onSqlSyncEvent?.((evt: SyncLogItem) => {
      if (!evt || !evt.id) return;
      setItems(prev => {
        if (prev.length > 0 && prev[0]?.id === evt.id) return prev;
        return [evt, ...prev].slice(0, 1000);
      });
    });

    return () => {
      try {
        if (typeof off === 'function') off();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter(it => {
      const key = String(it.key || '').toLowerCase();
      const msg = String(it.message || '').toLowerCase();
      const act = String(it.action || '').toLowerCase();
      const dir = String(it.direction || '').toLowerCase();
      return key.includes(query) || msg.includes(query) || act.includes(query) || dir.includes(query);
    });
  }, [items, q]);

  const counts = useMemo(() => {
    let synced = 0;
    let deleted = 0;
    let errors = 0;
    for (const it of filtered) {
      if (it.status === 'error') errors++;
      if (it.action === 'delete') deleted++;
      if (it.action === 'upsert') synced++;
    }
    return { synced, deleted, errors };
  }, [filtered]);

  if (!canUse) {
    return (
      <div className="p-6">
        <div className="p-8 rounded-[2rem] bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 flex items-center gap-5">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
            <AlertTriangle size={28} />
          </div>
          <p className="text-sm font-black">سجل المزامنة متاح فقط في نسخة Desktop.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 h-full page-transition bg-slate-50/50 dark:bg-slate-950/20" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header Section */}
        <div className="app-card overflow-hidden">
          <div className="app-card-header flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-indigo-600 dark:bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-600/20 animate-float">
                <History size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                  {t('سجل المزامنة التفصيلي')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold uppercase tracking-wider">
                  {t('تتبع كافة عمليات إرسال واستقبال البيانات مع المخدم (SQL Server).')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={refresh}
                disabled={busy}
                className="btn-secondary-modern"
              >
                <RefreshCcw size={18} className={busy ? 'animate-spin text-indigo-500' : 'text-indigo-500'} /> 
                <span>{t('تحديث')}</span>
              </button>
              <button
                onClick={clear}
                disabled={busy}
                className="btn-secondary-modern border-rose-200 dark:border-rose-900/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10"
              >
                <Trash2 size={18} /> 
                <span>{t('مسح السجل')}</span>
              </button>
            </div>
          </div>

          <div className="app-card-body">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <div className="glass-card p-6 flex items-center gap-5 group hover:scale-[1.02]">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:rotate-12 transition-transform duration-500">
                  <RefreshCcw size={28} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{t('مزامنة')}</div>
                  <div className="text-3xl font-black text-slate-800 dark:text-white">{counts.synced.toLocaleString()}</div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-5 group hover:scale-[1.02]">
                <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:rotate-12 transition-transform duration-500">
                  <Trash2 size={28} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{t('حذف')}</div>
                  <div className="text-3xl font-black text-slate-800 dark:text-white">{counts.deleted.toLocaleString()}</div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-5 group hover:scale-[1.02]">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:rotate-12 transition-transform duration-500">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{t('أخطاء')}</div>
                  <div className="text-3xl font-black text-slate-800 dark:text-white">{counts.errors.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative group max-w-xl mb-10">
              <Search size={20} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 pr-14 pl-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                placeholder={t('ابحث بالمفتاح، النوع أو الرسالة...')}
              />
            </div>

            {/* Table Container */}
            <div className="app-table-wrapper !rounded-[2.5rem] min-h-[600px] flex flex-col border-none shadow-none bg-slate-50/30 dark:bg-slate-800/20">
              <div className="flex-1 overflow-auto no-scrollbar">
                <table className="app-table">
                  <thead className="app-table-thead !bg-transparent">
                    <tr>
                      <th className="app-table-th">{t('الوقت')}</th>
                      <th className="app-table-th">{t('الاتجاه')}</th>
                      <th className="app-table-th">{t('العملية')}</th>
                      <th className="app-table-th">{t('المفتاح')}</th>
                      <th className="app-table-th text-center">{t('الحالة')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="app-table-empty">
                          <History className="text-slate-200 dark:text-slate-800/20 mx-auto mb-6" size={80} />
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t('لا يوجد سجل متاح حالياً')}</div>
                        </td>
                      </tr>
                    ) : (
                      filtered.map(it => {
                        const isDelete = it.action === 'delete';
                        const isUpsert = it.action === 'upsert';
                        const dirIcon = it.direction === 'pull' ? <ArrowDownToLine size={16} /> : it.direction === 'push' ? <ArrowUpToLine size={16} /> : <Server size={16} />;
                        const statusIcon = it.status === 'ok' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-rose-500" />;

                        return (
                          <tr key={it.id} className="app-table-row group">
                            <td className="app-table-td">
                              <div className="font-mono text-[10px] font-black text-slate-500 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700 inline-block" dir="ltr">
                                {formatTs(it.ts)}
                              </div>
                            </td>
                            <td className="app-table-td">
                              <span className="inline-flex items-center gap-3 font-black text-slate-700 dark:text-slate-200 text-xs">
                                <div className={`p-2 rounded-xl shadow-sm transition-colors duration-300 ${it.direction === 'pull' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : it.direction === 'push' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                  {dirIcon}
                                </div>
                                {it.direction === 'pull' ? t('سحب') : it.direction === 'push' ? t('رفع') : t('نظام')}
                              </span>
                            </td>
                            <td className="app-table-td">
                              <div className="flex flex-col gap-2">
                                <span className={
                                  'inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight shadow-sm border self-start ' +
                                  (isDelete
                                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                    : isUpsert
                                      ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                                      : 'bg-slate-500/10 text-slate-600 border-slate-500/20')
                                }>
                                  {isDelete ? t('حذف') : isUpsert ? t('تعديل') : it.action}
                                </span>
                                {it.message && (
                                  <div className="text-[10px] text-slate-400 font-bold whitespace-normal break-words max-w-[300px] leading-relaxed group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                    {it.message}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="app-table-td">
                              <div className="font-mono text-[10px] text-slate-400 font-bold break-all max-w-[200px] bg-slate-100/50 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                {it.key || '-'}
                              </div>
                            </td>
                            <td className="app-table-td">
                              <div className="flex items-center justify-center">
                                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm border ${it.status === 'ok' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}`}>
                                  {statusIcon}
                                  {it.status === 'ok' ? t('ناجح') : t('فشل')}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};