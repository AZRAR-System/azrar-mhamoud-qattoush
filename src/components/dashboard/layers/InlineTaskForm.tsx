/**
 * Minimal inline task form: عنوان + تاريخ + نوع — حفظ عبر DbService.addFollowUp
 */

import { useState } from 'react';
import { Plus, PanelRightOpen } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { formatDateYMD } from '@/utils/format';
import { useToast } from '@/context/ToastContext';
import type { TaskKindFilter } from './taskBuckets';

export type InlineTaskKind = Exclude<TaskKindFilter, 'all'>;

const KIND_TO_CATEGORY: Record<InlineTaskKind, string> = {
  general: 'عام',
  contract: 'عقد',
  person: 'شخص',
  property: 'عقار',
};

export interface InlineTaskFormProps {
  defaultDueDate?: string;
  onSaved?: () => void;
  /** يفتح لوحة الأحداث اليومية (نموذج كامل مع ربط كيانات) */
  onOpenFullPanel: (dueDateYMD: string) => void;
  className?: string;
}

export const InlineTaskForm: React.FC<InlineTaskFormProps> = ({
  defaultDueDate,
  onSaved,
  onOpenFullPanel,
  className = '',
}) => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(() => defaultDueDate || formatDateYMD(new Date()));
  const [kind, setKind] = useState<InlineTaskKind>('general');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      toast.warning('يرجى إدخال عنوان المهمة');
      return;
    }
    const d = dueDate.trim() || formatDateYMD(new Date());
    DbService.addFollowUp({
      task: t,
      type: 'Task',
      dueDate: d,
      priority: 'Medium',
      category: KIND_TO_CATEGORY[kind],
      note: '',
    });
    setTitle('');
    setDueDate(formatDateYMD(new Date()));
    setKind('general');
    onSaved?.();
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-4 ${className}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              عنوان المهمة
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: متابعة مستأجر…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              التاريخ
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              النوع
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as InlineTaskKind)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
            >
              <option value="general">عام</option>
              <option value="contract">عقد</option>
              <option value="person">شخص</option>
              <option value="property">عقار</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 lg:pb-0.5">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow transition"
            >
              <Plus size={16} />
              إضافة
            </button>
            <button
              type="button"
              onClick={() => onOpenFullPanel(dueDate.trim() || formatDateYMD(new Date()))}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-200 bg-white dark:bg-slate-800 text-sm font-bold hover:bg-indigo-50 dark:hover:bg-slate-700 transition"
            >
              <PanelRightOpen size={16} />
              نموذج كامل
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
