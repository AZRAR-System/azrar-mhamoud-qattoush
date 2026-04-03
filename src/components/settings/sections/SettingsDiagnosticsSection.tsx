import {
  Database,
  Building,
  List,
  Upload,
  Globe,
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  Search,
  Check,
  FolderOpen,
  ArrowRight,
  RefreshCcw,
  Edit2,
  BadgeDollarSign,
  History,
  FileJson,
  Shield,
  FileSpreadsheet,
  Info,
  PlayCircle,
  AlertTriangle,
  Copy,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsDiagnosticsSection({ page }: Props) {
  const {
    appErrorLog,
    appLastError,
    appLastErrorRaw,
    diagnosticsSessionId,
    handleClearDiagnostics,
    handleCopyDiagnostics,
    handleCopyDiagnosticsReport,
    handleCopyDiagnosticsSessionId,
    handleExportDiagnosticsFile,
    loadDiagnostics,
    settingsNoAccessFallback,
  } = page;

  return (
    <RBACGuard requiredRole="SuperAdmin" fallback={settingsNoAccessFallback}>
      <div className="flex flex-col animate-fade-in">
        <div className="max-w-4xl mx-auto w-full">
          <div className="settings-section-panel">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xl font-black text-slate-800 dark:text-white">التشخيص</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  يعرض آخر خطأ وسجل مختصر لآخر الأخطاء التي تم التقاطها من الواجهة (Unhandled error
                  / unhandled promise rejection).
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="secondary" onClick={loadDiagnostics}>
                  <RefreshCcw size={14} /> تحديث
                </Button>
                <Button variant="secondary" onClick={handleCopyDiagnostics}>
                  <FileJson size={14} /> نسخ
                </Button>
                <Button variant="secondary" onClick={handleCopyDiagnosticsReport}>
                  <FileJson size={14} /> نسخ التقرير
                </Button>
                <Button variant="secondary" onClick={handleExportDiagnosticsFile}>
                  <Download size={14} /> تصدير ملف
                </Button>
                <Button variant="danger" onClick={handleClearDiagnostics}>
                  <Trash2 size={14} /> مسح
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                معرّف الجلسة (Session ID):
                <span className="mx-2 font-mono text-slate-700 dark:text-slate-200" dir="ltr">
                  {diagnosticsSessionId || '—'}
                </span>
                {!!diagnosticsSessionId && (
                  <span className="block mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    سيتم تضمين معرّف الجلسة في اسم ملف التصدير (وكذلك تقرير الانهيار).
                  </span>
                )}
              </div>
              <Button variant="secondary" onClick={handleCopyDiagnosticsSessionId}>
                <Copy size={14} /> نسخ المعرّف
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              {!appLastErrorRaw.trim() && appErrorLog.length === 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">
                  لا يوجد سجل أخطاء محفوظ حالياً.
                </div>
              )}

              {appLastErrorRaw.trim() && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col gap-2">
                    {appLastError?.at && (
                      <div className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                        at={appLastError.at}
                      </div>
                    )}
                    {appLastError?.message && (
                      <div className="text-sm font-bold text-slate-800 dark:text-white whitespace-pre-wrap">
                        {appLastError.message}
                      </div>
                    )}
                    {appLastError?.stack && (
                      <pre
                        className="mt-2 bg-white dark:bg-slate-950/40 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 overflow-auto max-h-64 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap"
                        dir="ltr"
                      >
                        {appLastError.stack}
                      </pre>
                    )}
                    {!appLastError?.stack && (
                      <pre
                        className="mt-2 bg-white dark:bg-slate-950/40 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 overflow-auto max-h-64 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap"
                        dir="ltr"
                      >
                        {appLastErrorRaw}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {appErrorLog.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-slate-800 dark:text-white">
                      سجل الأخطاء (آخر {appErrorLog.length})
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      يُحدَّث تلقائياً ويُقصَر إلى آخر 20 خطأ
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {appErrorLog.map((e, idx) => (
                      <details
                        key={String(e?.id || `${e?.at || 'na'}_${idx}`)}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/30"
                      >
                        <summary className="cursor-pointer select-none px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
                          <span className="font-bold">{e?.message || 'Unknown error'}</span>
                          <span className="mx-2 text-slate-400">—</span>
                          <span className="text-xs font-mono text-slate-500" dir="ltr">
                            {e?.at || ''}
                          </span>
                          {e?.kind && (
                            <span className="mx-2 text-xs text-slate-400">({e.kind})</span>
                          )}
                        </summary>
                        <div className="px-3 pb-3">
                          {e?.stack && (
                            <pre
                              className="mt-2 bg-white dark:bg-slate-950/40 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 overflow-auto max-h-64 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap"
                              dir="ltr"
                            >
                              {e.stack}
                            </pre>
                          )}
                          {!e?.stack && (
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              لا يوجد stack.
                            </div>
                          )}
                          {e?.componentStack && (
                            <pre
                              className="mt-2 bg-white dark:bg-slate-950/40 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 overflow-auto max-h-64 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap"
                              dir="ltr"
                            >
                              {e.componentStack}
                            </pre>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RBACGuard>
  );
}
