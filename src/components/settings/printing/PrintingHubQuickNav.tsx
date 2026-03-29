import { Building2, FileText, Braces, Eye, LayoutGrid } from 'lucide-react';

const LINKS: { id: string; label: string; icon: typeof Building2 }[] = [
  { id: 'printing-hub-letterhead-docx-print', label: 'الترويسة والطباعة', icon: Building2 },
  { id: 'printing-hub-word-templates', label: 'قوالب Word', icon: FileText },
  { id: 'printing-hub-contract-vars', label: 'متغيرات العقد', icon: Braces },
  { id: 'printing-hub-live-preview', label: 'معاينة حية', icon: Eye },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function PrintingHubQuickNav() {
  return (
    <nav
      className="sticky top-0 z-20 -mx-2 px-2 py-2 mb-6 bg-gradient-to-b from-slate-50 via-slate-50/95 to-transparent dark:from-slate-950 dark:via-slate-950/95"
      aria-label="تنقّل سريع في مركز الطباعة"
    >
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-2 shadow-sm">
        <div className="flex items-center gap-1.5 px-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
          <LayoutGrid size={14} />
          أقسام
        </div>
        <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
          {LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => scrollToSection(l.id)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 hover:text-indigo-800 dark:hover:text-indigo-200 border border-transparent hover:border-indigo-200/80 dark:hover:border-indigo-800/50 transition-colors"
            >
              <l.icon size={14} className="opacity-80 shrink-0" />
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
