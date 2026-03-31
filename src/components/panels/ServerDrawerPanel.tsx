import { Suspense, lazy, type FC } from 'react';
import { Loader2, ServerCog } from 'lucide-react';

const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));

const PageLoader: FC = () => (
  <div className="flex h-full w-full items-center justify-center min-h-[240px] bg-slate-50/50 dark:bg-slate-950/40">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-lg" aria-hidden />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-slate-800 text-white shadow-lg">
          <ServerCog size={28} strokeWidth={1.75} className="opacity-95" />
        </div>
        <Loader2
          size={22}
          className="absolute -bottom-1 -left-1 text-indigo-500 dark:text-indigo-400 animate-spin"
          aria-hidden
        />
      </div>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 animate-pulse">
        جاري تحميل إعدادات المخدم...
      </p>
    </div>
  </div>
);

export const ServerDrawerPanel: FC<{ initialSection?: string }> = ({ initialSection }) => {
  return (
    <div className="p-4 md:p-6">
      <Suspense fallback={<PageLoader />}>
        <Settings initialSection={initialSection ?? 'server'} serverOnly embedded />
      </Suspense>
    </div>
  );
};
