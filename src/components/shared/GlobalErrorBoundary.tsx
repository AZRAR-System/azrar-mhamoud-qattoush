import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home, Download, Copy, Trash2 } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';
import { safeCopyToClipboard } from '@/utils/clipboard';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  errorStack: string;
  actionMessage?: string;
}

type ErrorLogKind = 'react' | 'window' | 'unhandledrejection';

type ErrorLogEntry = {
  id: string;
  at: string;
  kind: ErrorLogKind;
  message: string;
  sessionId?: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  hash?: string;
  userAgent?: string;
};

type DesktopCapabilities = {
  hasDesktopDb: boolean;
  methods: Record<string, boolean>;
  values: Record<string, boolean>;
};

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: '',
      errorStack: '',
      actionMessage: undefined,
    };
  }

  private readonly ERROR_LOG_KEY = 'app_error_log';
  private readonly LAST_ERROR_KEY = 'app_last_error';
  private readonly SESSION_ID_KEY = 'app_session_id';
  private readonly MAX_LOG_ENTRIES = 20;
  private readonly MAX_FIELD_CHARS = 8_000;

  componentDidMount() {
    try {
      window.addEventListener('error', this.handleWindowError);
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    } catch {
      // ignore
    }
  }

  componentWillUnmount() {
    try {
      window.removeEventListener('error', this.handleWindowError);
      window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    } catch {
      // ignore
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      componentStack: '',
      errorStack: String(error.stack ?? ''),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Global Error Caught:', error, errorInfo);
    this.setState({
      componentStack: String(errorInfo?.componentStack || ''),
      errorStack: String(error.stack ?? ''),
    });

    // Ensure React rendering errors also get persisted for diagnostics export.
    this.recordError(error, 'react', { componentStack: String(errorInfo?.componentStack || '') });
  }

  private clamp = (s: string) =>
    s.length > this.MAX_FIELD_CHARS ? s.slice(0, this.MAX_FIELD_CHARS) : s;

  private safeNowId = () => {
    // Good-enough uniqueness without adding deps.
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  private getSessionId = () => {
    try {
      const existing = String(sessionStorage.getItem(this.SESSION_ID_KEY) || '').trim();
      if (existing) return existing;
      const created = this.safeNowId();
      sessionStorage.setItem(this.SESSION_ID_KEY, created);
      return created;
    } catch {
      return undefined;
    }
  };

  private readExistingLog = (): ErrorLogEntry[] => {
    try {
      const raw = String(localStorage.getItem(this.ERROR_LOG_KEY) || '').trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((v) => typeof v === 'object' && v !== null) as ErrorLogEntry[];
    } catch {
      return [];
    }
  };

  private writeLog = (entries: ErrorLogEntry[]) => {
    try {
      localStorage.setItem(
        this.ERROR_LOG_KEY,
        JSON.stringify(entries.slice(0, this.MAX_LOG_ENTRIES))
      );
    } catch {
      // ignore
    }
  };

  private persistLastError = (record: { at: string; message: string; stack?: string }) => {
    try {
      const json = JSON.stringify(record);
      // Keep it small to avoid bloating storage
      localStorage.setItem(
        this.LAST_ERROR_KEY,
        json.length > 10_000 ? json.slice(0, 10_000) : json
      );
    } catch {
      // ignore
    }
  };

  private recordError = (err: unknown, kind: ErrorLogKind, extra?: { componentStack?: string }) => {
    try {
      const asError = err instanceof Error ? err : new Error(String(err ?? 'Unknown Error'));
      const at = new Date().toISOString();
      const sessionId = this.getSessionId();
      const message = this.clamp(String(asError.message || 'Unknown Error'));
      const stack = this.clamp(String(asError.stack || ''));

      this.persistLastError({ at, message, stack });

      const entry: ErrorLogEntry = {
        id: this.safeNowId(),
        at,
        kind,
        message,
        sessionId,
        stack: stack || undefined,
        componentStack: extra?.componentStack
          ? this.clamp(String(extra.componentStack))
          : undefined,
        url: typeof window !== 'undefined' ? String(window.location.href || '') : undefined,
        hash: typeof window !== 'undefined' ? String(window.location.hash || '') : undefined,
        userAgent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : undefined,
      };

      const existing = this.readExistingLog();
      this.writeLog([entry, ...existing].slice(0, this.MAX_LOG_ENTRIES));
    } catch {
      // ignore
    }
  };

  private setFatalError = (err: unknown, kind: ErrorLogKind) => {
    if (this.state.hasError) return;

    const asError = err instanceof Error ? err : new Error(String(err ?? 'Unknown Error'));
    try {
      console.error('[GlobalErrorBoundary] Unhandled error:', asError);
    } catch {
      // ignore
    }

    this.recordError(asError, kind);
    this.setState({
      hasError: true,
      error: asError,
      componentStack: '',
      errorStack: String(asError.stack ?? ''),
    });
  };

  private handleWindowError = (event: Event) => {
    try {
      const e = event as unknown as { error?: unknown; message?: unknown };
      this.setFatalError(e?.error ?? e?.message ?? 'Unknown window error', 'window');
    } catch {
      this.setFatalError('Unknown window error', 'window');
    }
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    this.setFatalError(event?.reason ?? 'Unhandled promise rejection', 'unhandledrejection');
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: '',
      errorStack: '',
      actionMessage: undefined,
    });
    window.location.hash = ROUTE_PATHS.DASHBOARD;
    window.location.reload();
  };

  private getStorage = (key: string) => {
    try {
      return String(localStorage.getItem(key) || '').trim();
    } catch {
      return '';
    }
  };

  private tryParseJson = (raw: string): unknown => {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  };

  private getDesktopDbCapabilities = (): DesktopCapabilities | null => {
    const db = (window as unknown as { desktopDb?: Record<string, unknown> }).desktopDb;
    if (!db) return null;

    const hasFn = (k: string) => typeof (db as Record<string, unknown>)[k] === 'function';
    const hasVal = (k: string) => typeof (db as Record<string, unknown>)[k] !== 'undefined';

    return {
      hasDesktopDb: true,
      methods: {
        get: hasFn('get'),
        set: hasFn('set'),
        del: hasFn('del'),
        sqlStatus: hasFn('sqlStatus'),
        sqlGetSettings: hasFn('sqlGetSettings'),
        sqlSaveSettings: hasFn('sqlSaveSettings'),
        sqlTestConnection: hasFn('sqlTestConnection'),
        sqlConnect: hasFn('sqlConnect'),
        sqlCoverage: hasFn('sqlCoverage'),
        sqlSyncNow: hasFn('sqlSyncNow'),
        getBackupDir: hasFn('getBackupDir'),
        chooseBackupDir: hasFn('chooseBackupDir'),
        saveAttachmentFile: hasFn('saveAttachmentFile'),
        readAttachmentFile: hasFn('readAttachmentFile'),
      },
      values: {
        isDesktop: hasVal('isDesktop'),
      },
    };
  };

  private withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timer: number | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      });
      return (await Promise.race([promise, timeout])) as T;
    } finally {
      if (typeof timer === 'number') window.clearTimeout(timer);
    }
  };

  private buildCrashDiagnosticsReportBase = () => {
    const now = new Date();
    const sessionId = this.getSessionId();
    const lastErrorRaw = this.getStorage(this.LAST_ERROR_KEY);
    const errorLogRaw = this.getStorage(this.ERROR_LOG_KEY);

    const lastErrorParsed = lastErrorRaw ? this.tryParseJson(lastErrorRaw) : null;
    const errorLogParsed = errorLogRaw ? this.tryParseJson(errorLogRaw) : [];

    return {
      generatedAt: now.toISOString(),
      app: {
        version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown',
        mode: import.meta.env.MODE,
        isDev: import.meta.env.DEV,
        isProd: import.meta.env.PROD,
      },
      runtime: {
        sessionId,
        url: typeof window !== 'undefined' ? window.location.href : '',
        hash: typeof window !== 'undefined' ? window.location.hash : '',
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        language: typeof navigator !== 'undefined' ? navigator.language : '',
        isDesktop: !!(window as unknown as { desktopDb?: unknown })?.desktopDb,
      },
      boundary: {
        message: String(this.state.error?.message || ''),
        errorStack: String(this.state.errorStack || ''),
        componentStack: String(this.state.componentStack || ''),
      },
      storage: {
        lastErrorRaw,
        lastError: lastErrorParsed ?? (lastErrorRaw ? { raw: lastErrorRaw } : null),
        errorLogRaw,
        errorLog: Array.isArray(errorLogParsed)
          ? errorLogParsed
          : errorLogRaw
            ? { raw: errorLogRaw }
            : [],
      },
    };
  };

  private buildCrashDiagnosticsReport = async () => {
    const base = this.buildCrashDiagnosticsReportBase();
    const caps = this.getDesktopDbCapabilities();

    const sql = await (async () => {
      const db = (window as unknown as { desktopDb?: Record<string, unknown> }).desktopDb;
      if (!db) return null;

      const out: Record<string, unknown> = {};
      try {
        const sqlStatus = (db as unknown as { sqlStatus?: () => Promise<unknown> }).sqlStatus;
        if (typeof sqlStatus === 'function') {
          out.status = await this.withTimeout(sqlStatus(), 1500, 'sqlStatus');
        }
      } catch (e: unknown) {
        out.statusError = e instanceof Error ? e.message : String(e ?? 'sqlStatus failed');
      }

      try {
        const sqlGetSettings = (db as unknown as { sqlGetSettings?: () => Promise<unknown> })
          .sqlGetSettings;
        if (typeof sqlGetSettings === 'function') {
          out.settings = await this.withTimeout(sqlGetSettings(), 1500, 'sqlGetSettings');
        }
      } catch (e: unknown) {
        out.settingsError = e instanceof Error ? e.message : String(e ?? 'sqlGetSettings failed');
      }

      return out;
    })();

    return { ...base, desktop: caps, sql };
  };

  private downloadTextFile = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  private handleCopyCrashDiagnosticsReport = async () => {
    try {
      this.setState({ actionMessage: 'جاري تجهيز التقرير...' });
      const report = await this.buildCrashDiagnosticsReport();
      const res = await safeCopyToClipboard(JSON.stringify(report, null, 2));
      if (!res.ok) throw new Error(res.error || 'copy_failed');
      this.setState({ actionMessage: 'تم نسخ تقرير التشخيص' });
    } catch {
      this.setState({ actionMessage: 'تعذر نسخ التقرير (قد تكون الصلاحيات غير متاحة)' });
    }
  };

  private handleDownloadCrashDiagnosticsReport = async () => {
    try {
      this.setState({ actionMessage: 'جاري تجهيز التقرير...' });
      const report = await this.buildCrashDiagnosticsReport();
      const safeStamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sessionId = this.getSessionId();
      const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      const filename = safeSessionId
        ? `azrar-crash-diagnostics-${safeSessionId}-${safeStamp}.json`
        : `azrar-crash-diagnostics-${safeStamp}.json`;
      this.downloadTextFile(filename, JSON.stringify(report, null, 2));
      this.setState({ actionMessage: 'تم تنزيل تقرير التشخيص' });
    } catch {
      this.setState({ actionMessage: 'تعذر تنزيل التقرير' });
    }
  };

  private handleClearCrashDiagnostics = () => {
    try {
      localStorage.removeItem(this.LAST_ERROR_KEY);
      localStorage.removeItem(this.ERROR_LOG_KEY);
      this.setState({ actionMessage: 'تم مسح سجل الأخطاء' });
    } catch {
      this.setState({ actionMessage: 'تعذر مسح سجل الأخطاء' });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fullscreen-loader fixed inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-900 p-4" dir="rtl">
          <div className="modal-content app-modal-content border-red-200 dark:border-red-900 p-8 max-w-lg w-full text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} className="text-red-600 dark:text-red-400" />
            </div>

            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
              عذراً، حدث خطأ غير متوقع
            </h1>

            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              واجه النظام مشكلة أثناء معالجة طلبك. تم تسجيل الخطأ وسنقوم بمراجعته.
            </p>

            <div className="mb-6 w-full rounded-xl border border-red-200/70 bg-red-50/80 p-4 text-start dark:border-red-900/60 dark:bg-red-950/25">
              <code
                className="block w-full break-words font-mono text-sm font-medium leading-relaxed text-red-800 dark:text-red-200"
                dir="ltr"
              >
                {this.state.error?.message || 'Unknown Error'}
              </code>
            </div>

            {(this.state.componentStack || this.state.errorStack) && (
              <details className="mb-6 w-full text-start">
                <summary className="cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-slate-300">
                  تفاصيل الخطأ (للمطور)
                </summary>
                {this.state.componentStack && (
                  <pre
                    className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    dir="ltr"
                  >
                    {this.state.componentStack}
                  </pre>
                )}
                {!this.state.componentStack && this.state.errorStack && (
                  <pre
                    className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    dir="ltr"
                  >
                    {this.state.errorStack}
                  </pre>
                )}
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
              >
                <RefreshCcw size={18} /> تحديث الصفحة
              </button>
              <button
                onClick={() => void this.handleCopyCrashDiagnosticsReport()}
                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                <Copy size={18} /> نسخ التقرير
              </button>
              <button
                onClick={() => void this.handleDownloadCrashDiagnosticsReport()}
                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                <Download size={18} /> تنزيل التقرير
              </button>
              <button
                onClick={this.handleClearCrashDiagnostics}
                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-6 py-2.5 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <Trash2 size={18} /> مسح السجل
              </button>
              <button
                onClick={() => {
                  window.location.hash = ROUTE_PATHS.DASHBOARD;
                  window.location.reload();
                }}
                className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition"
              >
                <Home size={18} /> الرئيسية
              </button>
            </div>

            {this.state.actionMessage && (
              <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                {this.state.actionMessage}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
