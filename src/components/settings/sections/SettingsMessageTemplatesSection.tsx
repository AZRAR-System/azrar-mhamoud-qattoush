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

const CATEGORY_COLOR: Record<MessageTemplateListEntry['category'], string> = {
  reminder: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  due: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  late: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  warning: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  legal: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const WHERE_USED: Record<string, string> = {
  'pre_due_reminder': 'يُرسل تلقائياً قبل موعد الاستحقاق بالأيام المحددة في الإعدادات',
  'due_day_reminder': 'يُرسل تلقائياً في يوم الاستحقاق',
  'post_late_reminder': 'يُرسل تلقائياً بعد تأخر الدفعة',
  'data_quality_missing_property_utils_fixed': 'يُرسل يدوياً للمالك عند نقص بيانات العقار',
  'installment_reminder_upcoming_summary_fixed': 'يُرسل تلقائياً كملخص للدفعات القريبة',
  'installment_reminder_due_today_summary_fixed': 'يُرسل تلقائياً كملخص دفعات اليوم',
  'installment_reminder_overdue_summary_fixed': 'يُرسل تلقائياً كملخص الدفعات المتأخرة',
};

const ALL_VARIABLES = [
  { key: 'tenantName', label: 'اسم المستأجر', example: 'أحمد الزعبي' },
  { key: 'اسم_المستأجر', label: 'اسم المستأجر (عربي)', example: 'أحمد الزعبي' },
  { key: 'propertyCode', label: 'كود العقار', example: 'P-101' },
  { key: 'جزء_العقار', label: 'وصف العقار', example: '— P-101 | شقة' },
  { key: 'amount', label: 'مبلغ الدفعة', example: '500' },
  { key: 'الإجمالي', label: 'الإجمالي', example: '1200' },
  { key: 'dueDate', label: 'تاريخ الاستحقاق', example: '2026-05-01' },
  { key: 'daysLate', label: 'أيام التأخر', example: '5' },
  { key: 'contractNumber', label: 'رقم العقد', example: 'cot_031' },
  { key: 'remainingAmount', label: 'المبلغ المتبقي', example: '300' },
  { key: 'اسم_المالك', label: 'اسم المالك', example: 'خالد العمري' },
  { key: 'قائمة_العقارات', label: 'قائمة العقارات', example: '• P-101\n• P-102' },
  { key: 'المستحقات_القريبة', label: 'الدفعات القريبة', example: '• 500 د.أ — 2026-05-01' },
  { key: 'المستحقات_المتأخرة', label: 'الدفعات المتأخرة', example: '• 500 د.أ — متأخر 5 أيام' },
  { key: 'اسم_الشركة', label: 'اسم الشركة', example: 'خبرني للخدمات العقارية' },
  { key: 'هاتف_الشركة', label: 'هاتف الشركة', example: '0799090170' },
  { key: 'طرق_الدفع', label: 'طرق الدفع', example: 'كليك / تحويل بنكي' },
];

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

  const [showVars, setShowVars] = useState(false);

  return (
      <section className="settings-section-panel">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <FileEdit className="text-indigo-500" size={20} /> قوالب الرسائل القابلة للتعديل
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          جميع قوالب رسائل الواتساب والإشعارات التلقائية. التعديلات تُطبق فوراً على الإرسال التالي.
        </p>

        <button
          type="button"
          onClick={() => setShowVars(s => !s)}
          className="mb-4 text-xs text-indigo-600 dark:text-indigo-400 underline underline-offset-2"
        >
          {showVars ? 'إخفاء' : 'عرض'} جميع المتغيرات المتاحة
        </button>

        {showVars && (
          <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">
              المتغيرات المتاحة — انسخ أي متغير وضعه داخل {'{{  }}'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ALL_VARIABLES.map(v => (
                <div key={v.key} className="flex items-start gap-2 text-[11px]">
                  <code
                    className="shrink-0 rounded bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 text-indigo-700 dark:text-indigo-300 font-mono cursor-pointer select-all"
                    title="انقر للنسخ"
                    onClick={() => navigator.clipboard.writeText(`{{${v.key}}}`)}
                  >
                    {`{{${v.key}}}`}
                  </code>
                  <div>
                    <span className="text-slate-600 dark:text-slate-300">{v.label}</span>
                    <span className="text-slate-400 dark:text-slate-500 block">{v.example}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700'
                }`}
              >
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 ${r.id === selectedId ? 'bg-white/20 text-white' : CATEGORY_COLOR[r.category]}`}>
                  {CATEGORY_LABEL[r.category]}{r.isCustom ? ' · مخصص' : ''}
                </span>
                <div className="text-sm font-bold line-clamp-1">{r.name}</div>
                {WHERE_USED[r.id] && (
                  <div className={`text-[10px] mt-0.5 line-clamp-1 ${r.id === selectedId ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                    {WHERE_USED[r.id]}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 space-y-4">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${CATEGORY_COLOR[selected.category]}`}>
                    {CATEGORY_LABEL[selected.category]}
                    {selected.isCustom ? ' · مخصص' : ''}
                  </span>
                  {WHERE_USED[selected.id] && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                      📍 {WHERE_USED[selected.id]}
                    </span>
                  )}
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
