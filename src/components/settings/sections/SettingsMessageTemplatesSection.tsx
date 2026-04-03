import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileEdit, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';
import { Button } from '@/components/ui/Button';
import { fillTemplate, type TemplateContext } from '@/services/notificationTemplates';
import {
  addCustomTemplate,
  getAllTemplates,
  getTemplate,
  resetTemplate,
  saveTemplate,
  type MessageTemplateListEntry,
} from '@/services/db/messageTemplates';
import { useToast } from '@/context/ToastContext';

type Props = { page: SettingsPageModel };

const CATEGORY_LABEL: Record<MessageTemplateListEntry['category'], string> = {
  reminder: 'تذكير',
  due: 'استحقاق',
  late: 'تأخير',
  warning: 'تحذير',
  legal: 'قانوني',
};

const PREVIEW_CONTEXT: TemplateContext = {
  tenantName: 'أحمد محمد',
  اسم_المستأجر: 'أحمد محمد',
  propertyCode: 'عقار 12 — عمّان',
  جزء_العقار: ' — عقار 12',
  amount: 350,
  الإجمالي: 1200,
  dueDate: '2026-04-15',
  paymentDate: '2026-04-10',
  daysLate: 5,
  contractNumber: '10234',
  remainingAmount: 200,
  notes: 'مثال ملاحظة',
  قائمة_العقارات: '• عقار 1\n• عقار 2',
  المستحقات_القريبة: '• 350 د.أ — 2026-04-20',
  المستحقات_اليوم: '• 350 د.أ',
  المستحقات_المتأخرة: '• 500 د.أ — متأخر 5 أيام',
  عدد_الكمبيالات: '2',
  مجموع_المبالغ_المتأخرة: '850',
};

function extractPlaceholders(body: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w\u0600-\u06FF]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    set.add(m[1]);
  }
  return Array.from(set);
}

export function SettingsMessageTemplatesSection({ page }: Props) {
  const { inputClass, labelClass } = page;
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MessageTemplateListEntry['category']>('reminder');
  const [newBody, setNewBody] = useState('مرحباً {{اسم_المستأجر}}\n\nنص تجريبي.');

  const rows = useMemo(() => {
    void version;
    return getAllTemplates();
  }, [version]);

  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener('azrar:message-templates-changed', onChange);
    return () => window.removeEventListener('azrar:message-templates-changed', onChange);
  }, []);

  useEffect(() => {
    if (!selectedId && rows.length > 0) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setDraft(getTemplate(selectedId));
  }, [selectedId, version]);

  const previewFilled = useMemo(() => {
    try {
      return fillTemplate(draft, PREVIEW_CONTEXT);
    } catch {
      return draft;
    }
  }, [draft]);

  const placeholders = useMemo(() => extractPlaceholders(draft), [draft]);

  const handleSave = useCallback(() => {
    if (!selectedId) return;
    saveTemplate(selectedId, draft);
    toast.showToast('تم حفظ القالب', 'success', 'القوالب');
    setVersion((v) => v + 1);
  }, [selectedId, draft, toast]);

  const handleReset = useCallback(() => {
    if (!selectedId || !selected) return;
    if (selected.isCustom) {
      if (!window.confirm('حذف هذا القالب المخصص نهائياً؟')) return;
      resetTemplate(selectedId);
      toast.showToast('تم حذف القالب', 'info', 'القوالب');
      setSelectedId(null);
    } else {
      resetTemplate(selectedId);
      setDraft(getTemplate(selectedId));
      toast.showToast('تمت استعادة النص الافتراضي', 'success', 'القوالب');
    }
    setVersion((v) => v + 1);
  }, [selectedId, selected, toast]);

  const handleAddCustom = useCallback(() => {
    const row = addCustomTemplate({ name: newName, category: newCategory, body: newBody });
    setSelectedId(row.id);
    toast.showToast('تمت إضافة القالب', 'success', 'القوالب');
    setShowAdd(false);
    setNewName('');
    setNewBody('مرحباً {{اسم_المستأجر}}\n\nنص تجريبي.');
    setVersion((v) => v + 1);
  }, [newName, newCategory, newBody, toast]);

  return (
      <section className="settings-section-panel">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <FileEdit className="text-indigo-500" size={20} /> قوالب الرسائل القابلة للتعديل
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          تُحفظ في <span dir="ltr">{String('db_message_templates')}</span>. إذا لم يُوجد نص مخصص، يُستخدم
          الافتراضي من النظام. المتغيرات بصيغة {'{{اسم_المستأجر}}'} وما شابه.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5"
            onClick={() => setShowAdd((s) => !s)}
          >
            <Plus size={16} aria-hidden />
            إضافة قالب مخصص
          </Button>
        </div>

        {showAdd && (
          <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass} htmlFor="custom-msg-name">
                  اسم القالب
                </label>
                <input
                  id="custom-msg-name"
                  className={inputClass}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: رسالة ترحيب خاصة"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="custom-msg-cat">
                  التصنيف
                </label>
                <select
                  id="custom-msg-cat"
                  className={inputClass}
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(e.target.value as MessageTemplateListEntry['category'])
                  }
                >
                  {(Object.keys(CATEGORY_LABEL) as MessageTemplateListEntry['category'][]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {CATEGORY_LABEL[k]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
            <label className={labelClass} htmlFor="custom-msg-body">
              النص
            </label>
            <textarea
              id="custom-msg-body"
              className={inputClass + ' min-h-[120px] font-mono text-sm'}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="primary" className="gap-1.5" onClick={handleAddCustom}>
                <Sparkles size={16} aria-hidden />
                حفظ القالب الجديد
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-1 max-h-[420px] overflow-y-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-slate-700 p-2">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-right transition ${
                  r.id === selectedId
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-black opacity-80">{CATEGORY_LABEL[r.category]}</div>
                <div className="text-sm font-bold line-clamp-2">{r.name}</div>
                <div dir="ltr" className="text-[10px] font-mono opacity-70 truncate mt-0.5">
                  {r.id}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 space-y-4">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold dark:bg-slate-800">
                    {CATEGORY_LABEL[selected.category]}
                    {selected.isCustom ? ' • مخصص' : ''}
                  </span>
                </div>
                <div>
                  <label className={labelClass} htmlFor="msg-template-body">
                    محتوى القالب
                  </label>
                  <textarea
                    id="msg-template-body"
                    className={inputClass + ' min-h-[220px] font-mono text-sm'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </div>
                {placeholders.length > 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    متغيرات مستخدمة في النص:{' '}
                    {placeholders.map((p) => (
                      <code key={p} className="mx-0.5 rounded bg-slate-100 px-1 dark:bg-slate-800">
                        {'{{'}
                        {p}
                        {'}}'}
                      </code>
                    ))}
                  </p>
                )}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                    <Sparkles size={16} className="text-amber-500" aria-hidden />
                    معاينة (بيانات تجريبية)
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                    {previewFilled}
                  </pre>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="primary" className="gap-1.5" onClick={handleSave}>
                    <Save size={16} aria-hidden />
                    حفظ
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-1.5 text-amber-700 dark:text-amber-300"
                    onClick={handleReset}
                  >
                    {selected.isCustom ? (
                      <>
                        <Trash2 size={16} aria-hidden />
                        حذف القالب
                      </>
                    ) : (
                      <>
                        <RotateCcw size={16} aria-hidden />
                        استعادة الافتراضي
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm">اختر قالباً من القائمة.</p>
            )}
          </div>
        </div>
      </section>
  );
}
