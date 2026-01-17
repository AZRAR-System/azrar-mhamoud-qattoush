import React from 'react';
import { Home, RefreshCw } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class AppShellErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    try {
      console.error('[AppShellErrorBoundary]', error);
    } catch {
      // ignore
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const errorMessage = (() => {
      const err = this.state.error;
      if (err instanceof Error) return String(err.message || '').trim();
      if (typeof err === 'object' && err !== null && 'message' in err) {
        const msg = (err as { message?: unknown }).message;
        if (typeof msg === 'string') return msg.trim();
      }
      return '';
    })();

    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-lg ring-1 ring-black/5 dark:ring-white/5 p-6">
          <h2 className="text-lg font-black text-slate-800 dark:text-white">حدث خطأ داخل واجهة النظام</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">تم التقاط الخطأ لمنع الشاشة الفارغة. يمكنك إعادة تحميل التطبيق أو العودة للرئيسية.</p>

          <div className="mt-5 flex flex-wrap gap-3 justify-end">
            <button
              onClick={() => {
                window.location.hash = ROUTE_PATHS.DASHBOARD;
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            >
              <Home size={18} /> الرئيسية
            </button>

            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition"
            >
              <RefreshCw size={18} /> إعادة تحميل
            </button>
          </div>

          {errorMessage && (
            <div className="mt-5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 whitespace-pre-wrap">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    );
  }
}
