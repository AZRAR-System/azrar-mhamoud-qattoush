import { Suspense, lazy } from 'react';

const MessageTemplatesEditor = lazy(() =>
  import('@/components/messaging/MessageTemplatesEditor').then((m) => ({ default: m.MessageTemplatesEditor }))
);

export function AlertsTemplatesRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          جاري تحميل محرر القوالب…
        </div>
      }
    >
      <div className="p-4 pt-2">
        <MessageTemplatesEditor />
      </div>
    </Suspense>
  );
}
