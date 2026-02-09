import React from 'react';
import { useToast } from '@/context/ToastContext';
import { DbService } from '@/services/mockDb';
import { safeCopyToClipboard } from '@/utils/clipboard';

type Catalog = ReturnType<typeof DbService.getMergePlaceholderCatalog>;

type Props = {
  title?: string;
  catalog?: Catalog;
  maxHeightClassName?: string;
};

export const MergeVariablesCatalog: React.FC<Props> = ({
  title = 'المتغيرات المتاحة للدمج',
  catalog,
  maxHeightClassName = 'max-h-40',
}) => {
  const toast = useToast();
  const c = catalog ?? DbService.getMergePlaceholderCatalog();

  const copy = async (key: string) => {
    const text = `{{${key}}}`;
    try {
      const res = await safeCopyToClipboard(text);
      if (!res.ok) throw new Error(res.error || 'copy_failed');
      toast.success(`تم نسخ ${text}`);
    } catch {
      toast.warning('تعذر النسخ تلقائياً');
    }
  };

  const Section = ({ sectionTitle, items }: { sectionTitle: string; items: Array<{ key: string; label: string }> }) => {
    if (!items.length) return null;
    return (
      <div>
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{sectionTitle}</div>
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <button
              type="button"
              key={it.key}
              onClick={() => void copy(it.key)}
              className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300"
              title={it.label}
            >
              <span className="font-mono">{'{{'}{it.key}{'}}'}</span>
              <span className="mx-2 text-slate-400">•</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60">
      <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">{title} (اضغط للنسخ)</div>
      <div className={`space-y-3 overflow-auto pr-1 ${maxHeightClassName}`}>
        <Section sectionTitle="متغيرات العقد" items={c.contract} />
        <Section sectionTitle="متغيرات العقار" items={c.property} />
        <Section sectionTitle="متغيرات المستأجر" items={c.tenant} />
        <Section sectionTitle="متغيرات الكمبيالة" items={c.installment} />
      </div>
    </div>
  );
};
