import { useDeferredValue, useMemo, useState } from 'react';
import { Eye, Maximize2 } from 'lucide-react';
import { buildFullPrintHtmlDocument } from '@/components/printing/printPreviewTypes';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

const SAMPLE_BODY = `<article style="padding:8px 0;">
<h2 style="margin:0 0 12px;font-size:16px;font-weight:800;">معاينة فورية</h2>
<p style="margin:0 0 10px;line-height:1.7;">عدّل النص هنا أو غيّر الترويسة والهوامش من اللوحة اليسرى — تتحدّث المعاينة مباشرة مثل برامج التصميم الحديثة.</p>
<table style="width:100%;font-size:11px;border-collapse:collapse;">
<tr><th style="border:1px solid #e5e7eb;padding:6px;background:#f8fafc;">البند</th><th style="border:1px solid #e5e7eb;padding:6px;background:#f8fafc;">القيمة</th></tr>
<tr><td style="border:1px solid #e5e7eb;padding:6px;">الإيجار الشهري</td><td style="border:1px solid #e5e7eb;padding:6px;">500 د.أ</td></tr>
</table>
</article>`;

type Props = { page: SettingsPageModel };

export function PrintingLivePreviewPanel({ page }: Props) {
  const { settings, printSettingsForm } = page;
  const [bodyDraft, setBodyDraft] = useState(SAMPLE_BODY);
  const deferredBody = useDeferredValue(bodyDraft);

  const fullHtml = useMemo(() => {
    if (!settings) return '';
    return buildFullPrintHtmlDocument(settings, deferredBody, {
      orientation: printSettingsForm.orientation === 'landscape' ? 'landscape' : 'portrait',
      marginsMm: printSettingsForm.marginsMm,
    });
  }, [settings, deferredBody, printSettingsForm.orientation, printSettingsForm.marginsMm]);

  if (!settings) {
    return (
      <div
        id="printing-hub-live-preview"
        className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-sm text-slate-500 scroll-mt-28"
      >
        جاري تحميل الإعدادات…
      </div>
    );
  }

  return (
    <div
      id="printing-hub-live-preview"
      className="flex flex-col gap-3 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-white dark:bg-slate-950 shadow-lg shadow-indigo-500/5 overflow-hidden scroll-mt-28"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-l from-indigo-600 to-violet-600 text-white">
        <div className="flex items-center gap-2 font-black text-sm">
          <Eye size={18} />
          معاينة حية
        </div>
        <span className="text-[10px] font-bold opacity-90">A4 · {printSettingsForm.orientation}</span>
      </div>

      <div className="px-3">
        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
          محرّر محتوى المستند (HTML بسيط)
        </label>
        <textarea
          value={bodyDraft}
          onChange={(e) => setBodyDraft(e.target.value)}
          spellCheck={false}
          className="w-full min-h-[140px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 text-[12px] font-mono leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          dir="rtl"
        />
        <p className="text-[10px] text-slate-500 mt-1">
          الترويسة والشعار يأتيان من «الهوية» و«الترويسة» في العمود المجاور؛ الهوامش من إعدادات الطباعة.
        </p>
      </div>

      <div className="relative border-t border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/50">
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-lg bg-white/90 dark:bg-slate-800/90 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow">
          <Maximize2 size={12} />
          معاينة الصفحة
        </div>
        <div
          className="overflow-auto max-h-[min(52vh,480px)] p-3"
          style={{ contain: 'strict' }}
        >
          <iframe
            title="معاينة الطباعة"
            className="w-full bg-white shadow-md rounded border border-slate-200"
            style={{
              minHeight: 420,
              transform: 'scale(0.92)',
              transformOrigin: 'top center',
            }}
            sandbox="allow-same-origin"
            srcDoc={fullHtml}
          />
        </div>
      </div>
    </div>
  );
}
