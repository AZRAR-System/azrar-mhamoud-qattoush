import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseMessageTemplateSourceGroup } from '@/services/messageTemplateSourceGroups';

const MessageTemplatesEditor = lazy(() =>
  import('@/components/messaging/MessageTemplatesEditor').then((m) => ({ default: m.MessageTemplatesEditor }))
);

export function AlertsTemplatesRoute() {
  const [searchParams] = useSearchParams();
  const sourceGroupFilter = parseMessageTemplateSourceGroup(searchParams.get('msgGroup'));
  const highlightedTemplateId = String(searchParams.get('template') || '').trim() || undefined;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          جاري تحميل محرر القوالب…
        </div>
      }
    >
      <div className="p-4 pt-2">
        <MessageTemplatesEditor
          sourceGroupFilter={sourceGroupFilter}
          highlightedTemplateId={highlightedTemplateId}
        />
      </div>
    </Suspense>
  );
}
