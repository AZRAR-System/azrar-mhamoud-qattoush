import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileEdit, Plus, RotateCcw, Save, Sparkles, Trash2, ChevronDown, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fillTemplate, type TemplateContext } from '@/services/notificationTemplates';
import type { WhatsAppTemplateKey } from '@/services/alerts/alertActionTypes';
import { WA_TEMPLATE_ID_TO_KEY } from '@/services/alerts/whatsappTemplateMap';
import {
  GROUP_LABELS_AR,
  templateRowMatchesSourceGroup,
  type MessageTemplateSourceGroup,
} from '@/services/messageTemplateSourceGroups';
import { ROUTE_PATHS } from '@/routes/paths';
import { cn } from '@/utils/cn';
import {
  addCustomTemplate,
  getAllTemplates,
  getTemplate,
  resetTemplate,
  saveTemplate,
  type MessageTemplateListEntry,
} from '@/services/db/messageTemplates';
import { useToast } from '@/context/ToastContext';

const DEFAULT_FIELD_CLASSES = {
  inputClass:
    'w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm',
  labelClass:
    'block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2',
};

export interface MessageTemplatesEditorProps {
  /** في الإعدادات: فئات حقول النموذج من صفحة الإعدادات */
  settingsFieldClasses?: { inputClass: string; labelClass: string };
  /** تمييز القالب المرتبط بسياق التنبيه (معرف القالب في messageTemplates) */
  highlightedTemplateId?: string;
  /** من الرابط `msgGroup` — عرض قوالب المجموعة فقط (تذكير، تحصيل، …) */
  sourceGroupFilter?: MessageTemplateSourceGroup | null;
  /** بعد حفظ قالب يطابق مفتاح واتساب — لتحديث معاينات مفتوحة */
  onAfterSaveForWhatsAppKey?: (key: WhatsAppTemplateKey, body: string) => void;
  className?: string;
}

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

const CATEGORY_BORDER: Record<MessageTemplateListEntry['category'], string> = {
  reminder: 'border-blue-400',
  due: 'border-amber-400',
  late: 'border-red-400',
  warning: 'border-orange-400',
  legal: 'border-purple-400',
};

const WHERE_USED: Record<string, string> = {
  'pre_due_reminder': 'تلقائي — قبل الاستحقاق',
  'due_day_reminder': 'تلقائي — يوم الاستحقاق',
  'post_late_reminder': 'تلقائي — بعد التأخر',
  'data_quality_missing_property_utils_fixed': 'يدوي — للمالك',
  'installment_reminder_upcoming_summary_fixed': 'تلقائي — ملخص قريب',
  'installment_reminder_due_today_summary_fixed': 'تلقائي — ملخص اليوم',
  'installment_reminder_overdue_summary_fixed': 'تلقائي — ملخص متأخر',
  wa_payment_reminder: 'واتساب التنبيهات — تذكير دفع',
  wa_renewal_offer: 'واتساب التنبيهات — تجديد عقد',
  wa_legal_notice: 'واتساب التنبيهات — إخطار قانوني',
  wa_custom: 'واتساب التنبيهات — عام',
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
  { key: 'الوصف', label: 'وصف التنبيه', example: 'دفعة قريبة الاستحقاق' },
  { key: 'count', label: 'عدد (مجمّع)', example: '3' },
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
  propertyCode: 'P-101',
  جزء_العقار: ' — P-101',
  amount: 350,
  الإجمالي: 1200,
  dueDate: '2026-04-15',
  paymentDate: '2026-04-10',
  daysLate: 5,
  contractNumber: 'cot_031',
  remainingAmount: 200,
  notes: 'مثال ملاحظة',
  قائمة_العقارات: '• P-101\n• P-102',
  المستحقات_القريبة: '• 350 د.أ — 2026-04-20',
  المستحقات_اليوم: '• 350 د.أ',
  المستحقات_المتأخرة: '• 500 د.أ — متأخر 5 أيام',
  عدد_الكمبيالات: '2',
  مجموع_المبالغ_المتأخرة: '850',
  الوصف: 'مثال وصف التنبيه',
  count: 2,
};

function extractPlaceholders(body: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w\u0600-\u06FF]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) set.add(m[1]);
  return Array.from(set);
}

function VarChip({ varKey, onInsert }: { varKey: string; onInsert: (v: string) => void }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    const text = `{{${varKey}}}`;
    navigator.clipboard.writeText(text).catch(() => null);
    onInsert(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={handle}
      title="انقر للإدراج في المحرر"
      className="inline-flex items-center gap-1 rounded bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 px-1.5 py-0.5 text-[11px] font-mono text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
    >
      {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
      {`{{${varKey}}}`}
    </button>
  );
}

export function MessageTemplatesEditor({
  settingsFieldClasses,
  className,
  highlightedTemplateId,
  sourceGroupFilter,
  onAfterSaveForWhatsAppKey,
}: MessageTemplatesEditorProps) {
  const inputClass = settingsFieldClasses?.inputClass ?? DEFAULT_FIELD_CLASSES.inputClass;
  const labelClass = settingsFieldClasses?.labelClass ?? DEFAULT_FIELD_CLASSES.labelClass;
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MessageTemplateListEntry['category']>('reminder');
  const [newBody, setNewBody] = useState('مرحباً {{اسم_المستأجر}}\n\nنص تجريبي.');
  const [filterCat, setFilterCat] = useState<MessageTemplateListEntry['category'] | 'all'>('all');

  const rows = useMemo(() => {
    void version;
    let all = getAllTemplates();
    if (sourceGroupFilter) {
      all = all.filter((r) => templateRowMatchesSourceGroup(r, sourceGroupFilter));
    }
    return filterCat === 'all' ? all : all.filter((r) => r.category === filterCat);
  }, [version, filterCat, sourceGroupFilter]);

  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener('azrar:message-templates-changed', onChange);
    return () => window.removeEventListener('azrar:message-templates-changed', onChange);
  }, []);

  useEffect(() => {
    if (highlightedTemplateId) {
      const exists = rows.some((r) => r.id === highlightedTemplateId);
      if (exists) {
        setSelectedId(highlightedTemplateId);
        return;
      }
    }
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0].id);
    }
  }, [highlightedTemplateId, rows, selectedId]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setDraft(getTemplate(selectedId));
  }, [selectedId, version]);

  const previewFilled = useMemo(() => {
    try { return fillTemplate(draft, PREVIEW_CONTEXT); }
    catch { return draft; }
  }, [draft]);

  const placeholders = useMemo(() => extractPlaceholders(draft), [draft]);

  const handleInsertVar = useCallback((text: string) => {
    setDraft(prev => prev + text);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedId) return;
    saveTemplate(selectedId, draft);
    toast.showToast('تم حفظ القالب', 'success', 'القوالب');
    setVersion((v) => v + 1);
    const waKey = WA_TEMPLATE_ID_TO_KEY[selectedId];
    if (waKey && onAfterSaveForWhatsAppKey) {
      onAfterSaveForWhatsAppKey(waKey, draft);
    }
  }, [selectedId, draft, toast, onAfterSaveForWhatsAppKey]);

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
    <section className={cn('settings-section-panel', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileEdit className="text-indigo-500" size={18} /> قوالب الرسائل
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تعديل قوالب واتساب التلقائية. التغييرات تُطبق فوراً.
          </p>
        </div>
        <Button type="button" variant="secondary" className="gap-1.5 text-xs" onClick={() => setShowAdd(s => !s)}>
          <Plus size={14} />
          قالب مخصص
        </Button>
      </div>

      {/* Add Custom Form */}
      {showAdd && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelClass} htmlFor="custom-msg-name">اسم القالب</label>
              <input id="custom-msg-name" className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثال: رسالة ترحيب" />
            </div>
            <div>
              <label className={labelClass} htmlFor="custom-msg-cat">التصنيف</label>
              <select id="custom-msg-cat" className={inputClass} value={newCategory} onChange={(e) => setNewCategory(e.target.value as MessageTemplateListEntry['category'])}>
                {(Object.keys(CATEGORY_LABEL) as MessageTemplateListEntry['category'][]).map(k => (
                  <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>
                ))}
              </select>
            </div>
          </div>
          <label className={labelClass} htmlFor="custom-msg-body">النص</label>
          <textarea id="custom-msg-body" className={inputClass + ' min-h-[100px] font-mono text-sm'} value={newBody} onChange={(e) => setNewBody(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="primary" className="gap-1.5 text-xs" onClick={handleAddCustom}><Sparkles size={14} />حفظ</Button>
            <Button type="button" variant="ghost" className="text-xs" onClick={() => setShowAdd(false)}>إلغاء</Button>
          </div>
        </div>
      )}

      {sourceGroupFilter && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/60 dark:border-indigo-800/60 dark:bg-indigo-950/25 px-3 py-2">
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            عرض قوالب:{' '}
            <span className="font-black text-indigo-700 dark:text-indigo-300">
              {GROUP_LABELS_AR[sourceGroupFilter]}
            </span>
          </p>
          <Link
            to={`${ROUTE_PATHS.SETTINGS}?section=messages`}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 shrink-0"
          >
            عرض كل القوالب
          </Link>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {(['all', ...Object.keys(CATEGORY_LABEL)] as (MessageTemplateListEntry['category'] | 'all')[]).map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
              filterCat === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {cat === 'all' ? 'الكل' : CATEGORY_LABEL[cat as MessageTemplateListEntry['category']]}
          </button>
        ))}
      </div>

      {/* Main Layout */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12">

          {/* Sidebar */}
          <div className="lg:col-span-4 border-l border-slate-200 dark:border-slate-700 max-h-[500px] overflow-y-auto custom-scrollbar">
            {rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                لا توجد قوالب ضمن هذا العرض. جرّب «الكل» في تصفية الفئة أو{' '}
                <Link to={`${ROUTE_PATHS.SETTINGS}?section=messages`} className="font-bold text-indigo-600 dark:text-indigo-400">
                  عرض كل القوالب
                </Link>
                .
              </div>
            ) : (
              rows.map((r) => {
                const isActive = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full px-3 py-3 text-right border-b border-slate-100 dark:border-slate-800 transition-colors last:border-b-0 ${
                      isActive
                        ? `bg-slate-50 dark:bg-slate-800/60 border-r-2 ${CATEGORY_BORDER[r.category]}`
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLOR[r.category]}`}>
                        {CATEGORY_LABEL[r.category]}{r.isCustom ? ' · مخصص' : ''}
                      </span>
                    </div>
                    <div className={`text-[13px] font-medium line-clamp-1 ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      {r.name}
                    </div>
                    {WHERE_USED[r.id] && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {WHERE_USED[r.id]}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Editor */}
          <div className="lg:col-span-8 p-4 bg-white dark:bg-slate-900 space-y-4">
            {selected ? (
              <>
                {/* Editor Header */}
                <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLOR[selected.category]}`}>
                    {CATEGORY_LABEL[selected.category]}
                  </span>
                  {WHERE_USED[selected.id] && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                      📍 {WHERE_USED[selected.id]}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono mr-auto">{selected.id}</span>
                </div>

                {/* Variables */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowVars(s => !s)}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 mb-2"
                  >
                    <ChevronDown size={12} className={`transition-transform ${showVars ? 'rotate-180' : ''}`} />
                    المتغيرات المتاحة — انقر لإدراج
                  </button>
                  {showVars && (
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 mb-2">
                      {ALL_VARIABLES.map(v => (
                        <VarChip key={v.key} varKey={v.key} onInsert={handleInsertVar} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Textarea */}
                <div>
                  <label className={labelClass} htmlFor="msg-template-body">محتوى القالب</label>
                  <textarea
                    id="msg-template-body"
                    className={inputClass + ' min-h-[200px] font-mono text-sm leading-relaxed'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  {placeholders.length > 0 && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      متغيرات نشطة: {placeholders.map(p => (
                        <code key={p} className="mx-0.5 rounded bg-slate-100 dark:bg-slate-800 px-1">{`{{${p}}}`}</code>
                      ))}
                    </p>
                  )}
                </div>

                {/* WhatsApp Preview */}
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
                    <Sparkles size={12} className="text-green-500" />
                    معاينة واتساب
                  </div>
                  <div
                    className="rounded-xl p-4 min-h-[80px]"
                    style={{ background: '#e5ddd5' }}
                    dir="rtl"
                  >
                    <div
                      className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap"
                      style={{ background: '#ffffff', color: '#111827' }}
                    >
                      {previewFilled}
                      <div className="text-[10px] text-slate-400 text-left mt-1">12:00 ✓✓</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button type="button" variant="primary" className="gap-1.5 text-xs" onClick={handleSave}>
                    <Save size={14} />
                    حفظ
                  </Button>
                  <Button type="button" variant="secondary" className="gap-1.5 text-xs text-amber-700 dark:text-amber-300" onClick={handleReset}>
                    {selected.isCustom ? <><Trash2 size={14} />حذف</> : <><RotateCcw size={14} />استعادة الافتراضي</>}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                اختر قالباً من القائمة
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
