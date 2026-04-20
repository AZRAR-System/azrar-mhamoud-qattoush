import { useEffect, useMemo, useState, type FC } from 'react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { StatCard } from '@/components/shared/StatCard';
import { FileText, Eye, Image as ImageIcon } from 'lucide-react';
import type { Attachment, ReferenceType } from '@/types';
import { FileViewer } from '@/components/shared/FileViewer';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { PageLayout } from '@/components/shared/PageLayout';
import { StatsCardRow } from '@/components/shared/StatsCardRow';
import type { UseDocumentsReturn } from '@/hooks/useDocuments';

const DocumentsKindSection: React.FC<{
  kind: 'PDF' | 'صور' | 'مستندات';
  items: Attachment[];
  onView: (a: Attachment) => void;
  describeReference: (a: Attachment) => { title: string; subtitle?: string | null; roles?: string[] };
  formatSize: (n: number) => string;
}> = ({ kind, items, onView, describeReference, formatSize }) => {
  const pageSize = useResponsivePageSize({ base: 6, sm: 8, md: 10, lg: 12, xl: 14, '2xl': 18 });
  const [page, setPage] = useState(1);
  const pageCount = useMemo(() => Math.max(1, Math.ceil((items.length || 0) / pageSize)), [items.length, pageSize]);

  useEffect(() => { setPage(1); }, [kind, items.length, pageSize]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const visible = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return (
    <div className="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-2 bg-white dark:bg-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
          {kind === 'صور' ? <ImageIcon size={16} className="text-purple-500" /> : <FileText size={16} className="text-indigo-500" />}
          {kind}
          <span className="text-xs text-slate-500 dark:text-slate-400">({items.length})</span>
        </div>
        <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />
      </div>

      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {visible.map((a) => {
          const ref = describeReference(a);
          return (
            <button key={a.id} type="button" onClick={() => onView(a)} className="w-full text-right p-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-slate-800 dark:text-white truncate" title={a.fileName}>{a.fileName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{ref.title}</span>
                  {ref.subtitle ? <span className="ml-2 font-mono dir-ltr text-right">• {ref.subtitle}</span> : null}
                </div>
                {Array.isArray(ref.roles) && ref.roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
                    {ref.roles.slice(0, 4).map((r) => (
                      <span key={r} className="text-[10px] px-2 py-0.5 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">{r}</span>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-2 justify-end">
                   <span className="font-mono">{formatSize(a.fileSize)}</span>
                   <span>•</span>
                   <span dir="ltr">{new Date(a.uploadDate).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-slate-500 dark:text-slate-300"><Eye size={16} /></div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const DocumentsPageView: FC<{ page: UseDocumentsReturn }> = ({ page }) => {
  const {
    attachments, grouped, viewingFile, setViewingFile, desktopUnsupported,
    formatSize, typeLabel, typeIcon, describeReference,
  } = page;

  const typeOrder: ReferenceType[] = ['Property', 'Person', 'Contract', 'Maintenance', 'Sales'];
  const kindOrder: Array<'PDF' | 'صور' | 'مستندات'> = ['PDF', 'صور', 'مستندات'];

  return (
    <PageLayout>
      <SmartPageHero
        variant="premium"
        title="مركز المستندات والمرفقات"
        description="عرض مجمّع لكافة المرفقات في النظام، مصنفة حسب العقارات، الأشخاص، والعقود."
        icon={<FileText size={32} />}
      />

      <StatsCardRow cols={2}>
        <StatCard
          label="إجمالي المرفقات"
          value={attachments.length}
          icon={FileText}
          color="orange"
        />
        <StatCard
          label="أنواع المستندات"
          value={Object.keys(grouped).length}
          icon={ImageIcon}
          color="indigo"
        />
      </StatsCardRow>

      <div className="space-y-6">

      {desktopUnsupported && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 text-sm text-yellow-800 dark:text-yellow-200">
          عرض تفاصيل المرفقات على الديسكتوب يحتاج endpoint `domainGet` (وضع السرعة/SQL). يرجى تحديث نسخة الديسكتوب أو تفعيل وضع السرعة.
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="app-card p-8 text-center text-slate-600 dark:text-slate-400">لا توجد مستندات مرفوعة حالياً.</div>
      ) : (
        <div className="space-y-4">
          {typeOrder.filter((t) => grouped[String(t)]).map((t) => {
              const groups = grouped[String(t)] || {};
              const count = Object.values(groups).reduce((s, arr) => s + (arr?.length || 0), 0);
              const Icon = typeIcon(t);
              return (
                <div key={t} className="app-card text-right">
                  <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                      <Icon size={18} className="text-slate-600 dark:text-slate-300" />
                      {typeLabel(t)}
                      <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-0.5 rounded-full">{count}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">مجمعة حسب الصفة (نوع الملف)</div>
                  </div>
                  <div className="p-3 space-y-3">
                    {kindOrder.filter((k) => (groups[k] || []).length > 0).map((k) => (
                        <DocumentsKindSection key={k} kind={k} items={groups[k]} onView={setViewingFile} describeReference={describeReference} formatSize={formatSize} />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {viewingFile && (
        <FileViewer fileId={viewingFile.id} fileName={viewingFile.fileName} fileExtension={viewingFile.fileExtension} onClose={() => setViewingFile(null)} />
      )}
      </div>
    </PageLayout>
  );
};
