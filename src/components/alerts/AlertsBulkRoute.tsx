import { Suspense, lazy } from 'react';
import { useBulkWhatsApp } from '@/hooks/useBulkWhatsApp';

const BulkWhatsAppPageView = lazy(() =>
  import('@/components/whatsapp/BulkWhatsAppPageView').then((m) => ({ default: m.BulkWhatsAppPageView }))
);

export function AlertsBulkRoute() {
  const page = useBulkWhatsApp();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          جاري تحميل واتساب جماعي…
        </div>
      }
    >
      <BulkWhatsAppPageView page={page} />
    </Suspense>
  );
}
