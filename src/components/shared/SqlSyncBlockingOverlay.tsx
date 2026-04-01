import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  SQL_SYNC_BLOCKING_EVENT,
  type SqlSyncBlockingDetail,
} from '@/utils/sqlSyncBlockingUi';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';

const defaultMessage = 'جاري المزامنة الآن…';

/**
 * Listens for `azrar:sql-sync-blocking` and blocks the whole app with a loading card.
 * Mounted once under App (inside providers).
 */
export function SqlSyncBlockingOverlay() {
  const [state, setState] = useState<{ active: boolean; message: string }>({
    active: false,
    message: defaultMessage,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<SqlSyncBlockingDetail>;
      const d = ce.detail;
      if (!d) return;
      setState({
        active: !!d.active,
        message: (d.message && String(d.message).trim()) || defaultMessage,
      });
    };
    window.addEventListener(SQL_SYNC_BLOCKING_EVENT, handler);
    return () => window.removeEventListener(SQL_SYNC_BLOCKING_EVENT, handler);
  }, []);

  useEffect(() => {
    if (state.active) lockBodyScroll();
    else unlockBodyScroll();
    return () => {
      if (state.active) unlockBodyScroll();
    };
  }, [state.active]);

  if (!state.active) return null;

  return (
    <div
      className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-[1.75rem] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 shadow-2xl px-6 py-7 flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 p-4">
          <Loader2 className="h-10 w-10 text-indigo-600 dark:text-indigo-400 animate-spin" aria-hidden />
        </div>
        <p className="text-base font-black text-slate-900 dark:text-white leading-snug">{state.message}</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          يرجى عدم إغلاق النافذة — ستُغلق هذه الرسالة تلقائياً عند الانتهاء
        </p>
      </div>
    </div>
  );
}
