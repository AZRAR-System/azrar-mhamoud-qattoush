import { useMemo, useState } from 'react';
import { Download, ArrowRight, Copy, FileText, Search, ChevronDown } from 'lucide-react';
import {
  CONTRACT_WORD_CATEGORY_META,
  CONTRACT_WORD_DYNAMIC_PREFIXES,
  CONTRACT_WORD_FLAT_CATEGORY_ORDER,
  CONTRACT_WORD_TEMPLATE_VARIABLES,
} from '@/constants/contractWordTemplateVariables';
import type { ContractWordTemplateVariable } from '@/constants/contractWordTemplateVariables';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel; embedded?: boolean };

function normalizeSearch(q: string) {
  return q.trim().toLowerCase();
}

function variableMatches(v: ContractWordTemplateVariable, q: string): boolean {
  if (!q) return true;
  const hay = `${v.key} ${v.label} ${v.example ?? ''} ${v.note ?? ''}`.toLowerCase();
  return hay.includes(q);
}

export function SettingsContractWordSection({ page, embedded }: Props) {
  const {
    copyToClipboard,
    exportContractWordVariablesExcel,
    setActiveSection,
    settingsNoAccessFallback,
  } = page;

  const [query, setQuery] = useState('');

  const qNorm = useMemo(() => normalizeSearch(query), [query]);

  const grouped = useMemo(() => {
    const map: Record<string, ContractWordTemplateVariable[]> = {};
    for (const v of CONTRACT_WORD_TEMPLATE_VARIABLES) {
      if (!map[v.category]) map[v.category] = [];
      map[v.category].push(v);
    }
    return map;
  }, []);

  const dynamicSectionVisible = useMemo(() => {
    if (!qNorm) return true;
    if (qNorm.includes('دينام') || qNorm.includes('dynamic')) return true;
    if (qNorm.includes('كمبي') || qNorm.includes('قسط') || qNorm.includes('دفعات')) return true;
    return CONTRACT_WORD_DYNAMIC_PREFIXES.some((p) => {
      const s = `${p.label} ${p.prefix} ${p.exampleKey} ${p.altPrefix ?? ''}`.toLowerCase();
      return s.includes(qNorm);
    });
  }, [qNorm]);

  return (
    <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
      <div
        id="printing-hub-contract-vars"
        className={
          embedded ? 'space-y-4 scroll-mt-24' : 'space-y-6 animate-fade-in scroll-mt-24'
        }
      >
        <section
          className="settings-section-panel"
        >
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
            <FileText className="text-indigo-500" size={20} /> متغيرات قالب العقد (Word)
          </h3>

          {!embedded ? (
            <>
              <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                استخدم داخل ملف Word صيغة{' '}
                <span className="font-mono" dir="ltr">
                  {'{{اسم_المفتاح}}'}
                </span>
                . القائمة أدناه مرتبة حسب الفئة مع بحث فوري؛ يمكنك أيضاً استخدام الصيغة الديناميكية
                لأي عمود من العقد أو العقار أو المستأجر.
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void exportContractWordVariablesExcel()}
                >
                  <Download size={16} /> تنزيل المتغيرات (Excel)
                </Button>
                <Button variant="secondary" onClick={() => setActiveSection('printingHub')}>
                  <ArrowRight size={16} /> مركز الطباعة والقوالب
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                انسخ المتغيرات إلى Word. المعاينة الحية للترويسة في العمود المجاور على الشاشات
                العريضة.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void exportContractWordVariablesExcel()}
                >
                  <Download size={16} /> تنزيل Excel
                </Button>
              </div>
            </>
          )}

          <div className="mt-4 relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالمفتاح أو الوصف أو المثال…"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/80 pr-10 pl-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              dir="rtl"
            />
          </div>

          {!embedded ? (
            <div className="mt-3 text-[12px] text-slate-500 dark:text-slate-400">
              أمثلة:{' '}
              <span className="font-mono" dir="ltr">
                {'{{ownerName}}'}
              </span>{' '}
              •{' '}
              <span className="font-mono" dir="ltr">
                {'{{contractDurationText}}'}
              </span>{' '}
              •{' '}
              <span className="font-mono" dir="ltr">
                {'{{العقد_رقم_العقد}}'}
              </span>
            </div>
          ) : null}
        </section>

        <section className="settings-section-panel space-y-4">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
            المتغيرات الموثّقة (اضغط نسخ)
          </div>

          {CONTRACT_WORD_FLAT_CATEGORY_ORDER.map((cat) => {
            const meta = CONTRACT_WORD_CATEGORY_META[cat];
            const items = (grouped[cat] ?? []).filter((v) => variableMatches(v, qNorm));
            if (items.length === 0) return null;

            return (
              <details
                key={cat}
                open
                className="rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 overflow-hidden open:[&_.contract-var-chevron]:rotate-180"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    {meta.title}
                    <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                      {meta.subtitle}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {items.length}
                    <ChevronDown
                      size={16}
                      className="contract-var-chevron shrink-0 text-slate-400 transition-transform duration-200"
                    />
                  </span>
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-3 pb-3 pt-0">
                  {items.map((v) => {
                    const placeholder = `{{${v.key}}}`;
                    return (
                      <div
                        key={`${cat}-${v.key}`}
                        className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 shadow-sm"
                      >
                        <div className="min-w-0">
                          <div
                            className="text-xs font-bold text-indigo-700 dark:text-indigo-300"
                            dir="ltr"
                          >
                            {placeholder}
                          </div>
                          <div className="text-[12px] text-slate-700 dark:text-slate-200 mt-0.5">
                            {v.label}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {v.example ? `مثال: ${v.example}` : null}
                            {v.note ? ` — ${v.note}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyToClipboard(placeholder)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline shrink-0 pt-0.5"
                        >
                          <Copy size={14} /> نسخ
                        </button>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}

          {dynamicSectionVisible ? (
            <details
              open
              className="rounded-2xl border border-amber-200/90 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden open:[&_.contract-var-chevron]:rotate-180"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  {CONTRACT_WORD_CATEGORY_META.dynamic.title}
                  <span className="block text-[11px] font-normal text-slate-600 dark:text-slate-400 mt-0.5">
                    {CONTRACT_WORD_CATEGORY_META.dynamic.subtitle}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className="contract-var-chevron shrink-0 text-slate-400 transition-transform duration-200"
                />
              </summary>
              <div className="px-4 pb-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p className="text-[12px] leading-relaxed">
                  لربط أي حقل من سجلات النظام، استخدم البادئة المناسبة ثم اسم الحقل كما في قاعدة
                  البيانات (يمكن أن يحتوي الاسم على شرطة سفلية). انسخ المثال وعدّل جزء اسم الحقل
                  حسب الحاجة.
                </p>
                <div className="space-y-2">
                  {CONTRACT_WORD_DYNAMIC_PREFIXES.map((p) => {
                    const main = `{{${p.prefix}${p.exampleKey}}}`;
                    const alt =
                      p.altPrefix != null ? `{{${p.altPrefix}${p.exampleKey}}}` : null;
                    return (
                      <div
                        key={p.prefix}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5"
                      >
                        <div className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                          {p.label}
                        </div>
                        <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <code
                            className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300 break-all"
                            dir="ltr"
                          >
                            {main}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copyToClipboard(main)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline shrink-0"
                          >
                            <Copy size={14} /> نسخ
                          </button>
                        </div>
                        {alt ? (
                          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border-t border-slate-100 dark:border-slate-800 pt-2">
                            <span className="text-[10px] text-slate-500">صيغة بديلة:</span>
                            <code
                              className="text-[11px] font-mono text-slate-600 dark:text-slate-400 break-all"
                              dir="ltr"
                            >
                              {alt}
                            </code>
                            <button
                              type="button"
                              onClick={() => void copyToClipboard(alt)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline shrink-0"
                            >
                              <Copy size={14} /> نسخ
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          ) : null}

          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
            القوالب التي تستخدم نجوماً (****) ما زالت تُعرَض تلقائياً عند الطباعة من النظام.
          </div>
        </section>
      </div>
    </RBACGuard>
  );
}
