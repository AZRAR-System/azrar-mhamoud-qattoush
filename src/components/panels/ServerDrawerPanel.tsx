import { Suspense, lazy, type FC } from 'react';
import { Loader2 } from 'lucide-react';

const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));

const PageLoader: FC = () => (
  <div className="flex h-full w-full items-center justify-center min-h-[240px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={32} className="text-indigo-600 animate-spin" />
      <p className="text-sm text-slate-500 font-medium animate-pulse">
        جاري تحميل إعدادات المخدم...
      </p>
    </div>
  </div>
);

export const ServerDrawerPanel: FC<{ initialSection?: string }> = ({ initialSection }) => {
  return (
    <div className="p-4">
      <Suspense fallback={<PageLoader />}>
        <Settings initialSection={initialSection ?? 'server'} serverOnly embedded />
      </Suspense>
    </div>
  );
};
