import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Trash2, Search, Server, ArrowDownToLine, ArrowUpToLine, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-GB');
  } catch {
    return ts;
  }
}

export const SqlSyncLogPanel: React.FC = () => {
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
    } catch (e: any) {
      toast.error(e?.message || 'فشل تحميل سجل المزامنة');
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
    } catch (e: any) {
      toast.error(e?.message || 'فشل مسح سجل المزامنة');
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
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          سجل المزامنة متاح فقط في نسخة Desktop.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Server size={18} className="text-indigo-600" />
            <h3 className="text-lg font-black text-slate-800 dark:text-white">سجل المزامنة (المزامنة/الحذف)</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            يعرض آخر العمليات التي تمت على المخدم أو تم سحبها منه.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={busy}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <RefreshCcw size={16} className={busy ? 'animate-spin' : ''} /> تحديث
          </button>
          <button
            onClick={clear}
            disabled={busy}
            className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <Trash2 size={16} /> مسح
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">تمت مزامنتها</div>
          <div className="text-2xl font-black text-slate-800 dark:text-white">{counts.synced}</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">تم حذفها</div>
          <div className="text-2xl font-black text-slate-800 dark:text-white">{counts.deleted}</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">أخطاء</div>
          <div className="text-2xl font-black text-slate-800 dark:text-white">{counts.errors}</div>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm"
          placeholder="ابحث بالمفتاح أو النوع أو الرسالة..."
        />
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-slate-700">
        <div className="max-h-[60vh] overflow-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="text-right px-4 py-3 font-black">الوقت</th>
                <th className="text-right px-4 py-3 font-black">الاتجاه</th>
                <th className="text-right px-4 py-3 font-black">العملية</th>
                <th className="text-right px-4 py-3 font-black">المفتاح</th>
                <th className="text-right px-4 py-3 font-black">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    لا يوجد سجل بعد.
                  </td>
                </tr>
              )}

              {filtered.map(it => {
                const isDelete = it.action === 'delete';
                const isUpsert = it.action === 'upsert';
                const dirIcon = it.direction === 'pull' ? <ArrowDownToLine size={14} /> : it.direction === 'push' ? <ArrowUpToLine size={14} /> : <Server size={14} />;
                const statusIcon = it.status === 'ok' ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-red-600" />;

                return (
                  <tr key={it.id} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap" dir="ltr">
                      {formatTs(it.ts)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        {dirIcon}
                        {it.direction === 'pull' ? 'سحب' : it.direction === 'push' ? 'رفع' : 'نظام'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      <span className={
                        'inline-flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-black ' +
                        (isDelete
                          ? 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300'
                          : isUpsert
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/10 dark:text-indigo-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')
                      }>
                        {isDelete ? 'حذف' : isUpsert ? 'تعديل' : it.action}
                      </span>
                      {it.message && (
                        <div className="text-[11px] text-slate-400 mt-1 whitespace-normal break-words">
                          {it.message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-mono text-xs break-all">
                      {it.key || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        {statusIcon}
                        {it.status === 'ok' ? 'تم' : 'فشل'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
