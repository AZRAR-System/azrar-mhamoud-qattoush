import { FileText, FileJson, Braces, Printer } from 'lucide-react';

type Props = {
  wordTemplatesCount: number;
  docxTemplatesCount: number;
  contractVariablesCount: number;
  printStatusLabel: string;
};

export function PrintingHubKpiCards({
  wordTemplatesCount,
  docxTemplatesCount,
  contractVariablesCount,
  printStatusLabel,
}: Props) {
  const cards = [
    {
      icon: FileText,
      label: 'قوالب Word (النوع الحالي)',
      value: String(wordTemplatesCount),
      hint: 'من القائمة أدناه',
      tone: 'from-indigo-500/15 to-purple-500/10',
    },
    {
      icon: FileJson,
      label: 'قوالب DOCX',
      value: String(docxTemplatesCount),
      hint: 'مجلد templates/contracts',
      tone: 'from-emerald-500/15 to-teal-500/10',
    },
    {
      icon: Braces,
      label: 'متغيرات قالب العقد',
      value: String(contractVariablesCount),
      hint: 'مفاتيح موثّقة + صيغ ديناميكية',
      tone: 'from-amber-500/15 to-orange-500/10',
    },
    {
      icon: Printer,
      label: 'إعدادات الطباعة',
      value: printStatusLabel,
      hint: 'print.settings.json',
      tone: 'from-slate-500/15 to-slate-600/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-gradient-to-br ${c.tone} dark:from-slate-900/80 dark:to-slate-900/40 p-4 shadow-sm`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {c.label}
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums truncate">
                {c.value}
              </div>
              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">{c.hint}</div>
            </div>
            <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 shrink-0">
              <c.icon size={20} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
