import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DbService } from '@/services/mockDb';
import { useSmartModal } from '@/context/ModalContext';
import { storage } from '@/services/storage';
import { useAuth } from '@/context/AuthContext';
import { SystemLookup, LookupCategory, SystemSettings, PermissionCode, العمليات_tbl } from '@/types';
import {
  Database, Building, List, Upload, Globe, Phone,
  Image as ImageIcon, Plus, Trash2, Download, Search, Check, FolderOpen, ArrowRight,
  RefreshCcw, Edit2, X, BadgeDollarSign, History, FileJson, Shield, FileSpreadsheet, Info, PlayCircle, AlertTriangle, Copy
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { isRole, isSuperAdmin } from '@/utils/roles';
import { DS } from '@/constants/designSystem';
import { ROUTE_PATHS } from '@/routes/paths';
import { Button } from '@/components/ui/Button';
import { AppModal } from '@/components/ui/AppModal';
import { Input } from '@/components/ui/Input';
import { useDbSignal } from '@/hooks/useDbSignal';
import { safeCopyToClipboard } from '@/utils/clipboard';

type SqlStatus = { configured: boolean; enabled: boolean; connected: boolean; lastError?: string; lastSyncAt?: string };
type DesktopOkMessage = { ok?: boolean; message?: string };
type DesktopSuccessMessage = { success?: boolean; message?: string; backupDir?: string; archivePath?: string };
type DesktopSqlSettings = Partial<{
  enabled: boolean;
  server: string;
  port: number;
  database: string;
  authMode: 'sql' | 'windows';
  user: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  hasPassword: boolean;
}>;

type SqlCoverageItem = {
  key: string;
  localUpdatedAt?: string;
  localDeletedAt?: string;
  localBestTs?: string;
  localIsDeleted: boolean;
  localBytes: number;
  remoteUpdatedAt?: string;
  remoteIsDeleted?: boolean;
  status: 'inSync' | 'localAhead' | 'remoteAhead' | 'missingRemote' | 'missingLocal' | 'different' | 'unknown';
};

type SqlCoverageResponse = {
  ok: boolean;
  remoteOk?: boolean;
  remoteMessage?: string;
  localCount?: number;
  remoteCount?: number;
  items?: SqlCoverageItem[];
  message?: string;
};

type SqlBackupAutomationSettings = {
  enabled: boolean;
  retentionDays: number;
};

type SqlBackupAutomationResponse = {
  ok: boolean;
  settings?: SqlBackupAutomationSettings;
  message?: string;
};

type SqlServerBackupItem = {
  id: string;
  createdAt: string;
  createdBy?: string;
  rowCount?: number;
  payloadBytes?: number;
  note?: string;
};

type AppLastError = {
  at?: string;
  message?: string;
  stack?: string;
};

type AppErrorLogEntry = {
  id?: string;
  at?: string;
  kind?: string;
  message?: string;
  sessionId?: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  hash?: string;
  userAgent?: string;
};

const hasMessage = (value: unknown): value is { message: string } => {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>).message === 'string';
};

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (hasMessage(error)) return error.message;
  return undefined;
};

export const Settings: React.FC<{ initialSection?: string; serverOnly?: boolean; embedded?: boolean }> = ({ initialSection, serverOnly, embedded }) => {
  const [activeSection, setActiveSection] = useState<string>(serverOnly ? 'server' : (initialSection || 'general'));
  const toast = useToast();
  const { openPanel } = useSmartModal();
  const { user } = useAuth();

  const dbSignal = useDbSignal();

  const isDesktop = !!window.desktopDb;
  const [backupDir, setBackupDir] = useState<string>('');

  const [sqlForm, setSqlForm] = useState({
    enabled: false,
    server: '',
    port: 1433,
    database: 'AZRAR',
    authMode: 'sql' as 'sql' | 'windows',
    user: '',
    password: '',
    encrypt: true,
    trustServerCertificate: true,
    hasPassword: false,
  });
  const [sqlStatus, setSqlStatus] = useState<SqlStatus | null>(null);
  const [sqlBusy, setSqlBusy] = useState(false);

  const [sqlBackupAuto, setSqlBackupAuto] = useState<SqlBackupAutomationSettings>({ enabled: true, retentionDays: 30 });
  const [sqlBackupAutoBusy, setSqlBackupAutoBusy] = useState(false);
  const [sqlServerBackups, setSqlServerBackups] = useState<SqlServerBackupItem[]>([]);
  const [sqlServerBackupsBusy, setSqlServerBackupsBusy] = useState(false);

  const [appLastErrorRaw, setAppLastErrorRaw] = useState<string>('');
  const [appLastError, setAppLastError] = useState<AppLastError | null>(null);
  const [appErrorLogRaw, setAppErrorLogRaw] = useState<string>('');
  const [appErrorLog, setAppErrorLog] = useState<AppErrorLogEntry[]>([]);
  const [diagnosticsSessionId, setDiagnosticsSessionId] = useState<string>('');

  const [sqlCoverage, setSqlCoverage] = useState<SqlCoverageResponse | null>(null);
  const [sqlCoverageBusy, setSqlCoverageBusy] = useState(false);
  const [sqlCoverageQuery, setSqlCoverageQuery] = useState('');

  const [sqlProvision, setSqlProvision] = useState({
    adminUser: '',
    adminPassword: '',
    managerUser: 'azrar_manager',
    managerPassword: '',
    employeeUser: 'azrar_employee',
    employeePassword: '',
  });

  const keyLabels = useMemo<Record<string, string>>(() => ({
    db_people: 'الأشخاص',
    db_properties: 'العقارات',
    db_contracts: 'العقود',
    db_installments: 'الأقساط',
    db_payments: 'الدفعات',
    db_commissions: 'العمولات',
    db_alerts: 'التنبيهات',
    db_attachments: 'المرفقات',
    db_users: 'المستخدمون',
    db_user_permissions: 'صلاحيات المستخدمين',
    db_roles: 'الأدوار',
    db_settings: 'إعدادات النظام',
    db_lookup_categories: 'تصنيفات الجداول',
    db_lookups: 'الجداول المساعدة',
    db_legal_templates: 'قوالب العقود/النماذج',
    db_legal_history: 'سجل القانوني',
    db_followups: 'المتابعات',
    db_notes: 'الملاحظات',
    db_reminders: 'التذكيرات',
    db_maintenance_tickets: 'بلاغات الصيانة',
    db_notification_send_logs: 'سجل الإشعارات',
    db_operations: 'العمليات',
    db_marquee: 'الشريط الإعلاني',
    db_smart_behavior: 'سلوك الأدوات الذكية',
  }), []);

  const refreshSqlCoverage = async () => {
    if (!window.desktopDb?.sqlGetCoverage) {
      toast.warning('تغطية المزامنة متاحة فقط في نسخة Desktop');
      return;
    }
    setSqlCoverageBusy(true);
    try {
      const res = (await window.desktopDb.sqlGetCoverage()) as unknown as SqlCoverageResponse | null;
      setSqlCoverage(res ?? null);
      if (res && res.ok && res.remoteOk === false && res.remoteMessage) {
        toast.warning(res.remoteMessage);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل فحص تغطية المزامنة');
    } finally {
      setSqlCoverageBusy(false);
    }
  };

  const pullFullFromServer = async () => {
    if (!window.desktopDb?.sqlPullFullNow) {
      toast.warning('السحب متاح فقط في نسخة Desktop');
      return;
    }
    setSqlCoverageBusy(true);
    try {
      const res = (await window.desktopDb.sqlPullFullNow()) as unknown as DesktopOkMessage | null;
      if (res?.ok) toast.success(res?.message || 'تم السحب من المخدم');
      else toast.error(res?.message || 'فشل السحب من المخدم');
      await refreshSqlStatus();
      await refreshSqlCoverage();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل السحب من المخدم');
    } finally {
      setSqlCoverageBusy(false);
    }
  };

  const mergePublishAdmin = async () => {
    if (!window.desktopDb?.sqlMergePublishAdmin) {
      toast.warning('الدمج/النشر متاح فقط في نسخة Desktop');
      return;
    }
    if (!isSuperAdmin(user?.الدور)) {
      toast.error('هذه العملية متاحة للسوبر أدمن فقط');
      return;
    }

    setSqlCoverageBusy(true);
    try {
      const res = (await window.desktopDb.sqlMergePublishAdmin({
        keys: ['db_users', 'db_user_permissions', 'db_roles', 'db_lookup_categories', 'db_lookups', 'db_legal_templates'],
        prefer: 'local',
      })) as unknown as DesktopOkMessage | null;

      if (res?.ok) toast.success(res?.message || 'تم الدمج/النشر');
      else toast.error(res?.message || 'فشل الدمج/النشر');

      await refreshSqlStatus();
      await refreshSqlCoverage();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل الدمج/النشر');
    } finally {
      setSqlCoverageBusy(false);
    }
  };

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [categories, setCategories] = useState<LookupCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<LookupCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<LookupCategory | null>(null);
  const [lookupItems, setLookupItems] = useState<SystemLookup[]>([]);
  const [catSearchTerm, setCatSearchTerm] = useState('');
  const [auditLogs, setAuditLogs] = useState<العمليات_tbl[]>([]);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [tableForm, setTableForm] = useState({ id: '', name: '', label: '' });
  const [isEditingTable, setIsEditingTable] = useState(false);

  const loadSettings = useCallback(() => {
    setSettingsLoading(true);
    try {
      const s = DbService.getSettings();
      setSettings(s);
    } catch (e: unknown) {
      setSettings(null);
      toast.error(getErrorMessage(e) || 'فشل تحميل إعدادات النظام');
    } finally {
      setSettingsLoading(false);
    }
  }, [toast]);

  const loadCategories = useCallback(() => {
    const cats = DbService.getLookupCategories();
    setCategories(cats);
    setFilteredCategories(cats);
    setActiveCategory(prev => {
      if (prev) {
        const stillExists = cats.find(c => c.id === prev.id);
        return stillExists ?? (cats.length > 0 ? cats[0] : null);
      }
      return cats.length > 0 ? cats[0] : null;
    });
  }, []);

  const loadAuditLogs = useCallback(() => {
    const allLogs = DbService.getLogs();
    const settingLogs = allLogs
      .filter(l => l.نوع_العملية.includes('SETTINGS') || l.اسم_الجدول === 'Settings' || l.اسم_الجدول.includes('Lookup'))
      .reverse()
      .slice(0, 20);
    setAuditLogs(settingLogs);
  }, []);

  const loadSqlSection = useCallback(async () => {
    if (!window.desktopDb?.sqlGetSettings) {
      setSqlStatus(null);
      return;
    }
    try {
      const s = (await window.desktopDb.sqlGetSettings()) as unknown as DesktopSqlSettings | null;
      setSqlForm(prev => ({
        ...prev,
        enabled: !!s?.enabled,
        server: String(s?.server || ''),
        port: Number(s?.port || 1433) || 1433,
        database: String(s?.database || 'AZRAR'),
        authMode: s?.authMode === 'windows' ? 'windows' : 'sql',
        user: String(s?.user || ''),
        encrypt: s?.encrypt !== false,
        trustServerCertificate: s?.trustServerCertificate !== false,
        hasPassword: !!s?.hasPassword,
        password: '',
      }));
      const st = (await window.desktopDb.sqlStatus?.()) as unknown as SqlStatus | null;
      setSqlStatus(st || null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل تحميل إعدادات المخدم');
    }
  }, [toast]);

  const loadBackupSection = useCallback(async () => {
    if (window.desktopDb?.getBackupDir) {
      try {
        const d = await window.desktopDb.getBackupDir();
        setBackupDir(d || '');
      } catch {
        setBackupDir('');
      }
    } else {
      setBackupDir('');
    }
  }, []);

  const loadDiagnostics = useCallback(() => {
    try {
      const raw = String(localStorage.getItem('app_last_error') || '').trim();
      setAppLastErrorRaw(raw);

      const rawLog = String(localStorage.getItem('app_error_log') || '').trim();
      setAppErrorLogRaw(rawLog);
      if (!rawLog) {
        setAppErrorLog([]);
      } else {
        try {
          const parsed = JSON.parse(rawLog) as unknown;
          if (Array.isArray(parsed)) {
            setAppErrorLog(parsed as AppErrorLogEntry[]);
          } else {
            setAppErrorLog([]);
          }
        } catch {
          setAppErrorLog([]);
        }
      }

      // Session ID helps correlate multiple reports from the same session.
      try {
        let sid = String(sessionStorage.getItem('app_session_id') || '').trim();
        if (!sid && rawLog) {
          try {
            const parsed = JSON.parse(rawLog) as unknown;
            if (Array.isArray(parsed)) {
              const firstWithSid = (parsed as AppErrorLogEntry[]).find(e => typeof e?.sessionId === 'string' && e.sessionId.trim());
              if (firstWithSid?.sessionId) sid = firstWithSid.sessionId.trim();
            }
          } catch {
            // ignore
          }
        }
        if (!sid) {
          sid = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        }
        try {
          sessionStorage.setItem('app_session_id', sid);
        } catch {
          // ignore
        }
        setDiagnosticsSessionId(sid);
      } catch {
        setDiagnosticsSessionId('');
      }

      if (!raw) {
        setAppLastError(null);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'object' && parsed !== null) {
          const rec = parsed as Record<string, unknown>;
          setAppLastError({
            at: typeof rec.at === 'string' ? rec.at : undefined,
            message: typeof rec.message === 'string' ? rec.message : undefined,
            stack: typeof rec.stack === 'string' ? rec.stack : undefined,
          });
          return;
        }
      } catch {
        // ignore
      }
      setAppLastError({ message: raw });
    } catch {
      setAppLastErrorRaw('');
      setAppLastError(null);
    }
  }, []);

  const handleCopyDiagnosticsSessionId = async () => {
    const sid = String(diagnosticsSessionId || '').trim();
    if (!sid) {
      toast.info('لا يوجد معرّف جلسة متاح');
      return;
    }
    try {
      const res = await safeCopyToClipboard(sid);
      if (!res.ok) throw new Error(res.error || 'copy_failed');
      toast.success('تم نسخ معرّف الجلسة');
    } catch {
      toast.error('تعذر النسخ (قد تكون صلاحيات المتصفح غير متاحة)');
    }
  };

  const handleCopyDiagnosticsReport = async () => {
    try {
      const report = buildDiagnosticsReport();
      const text = JSON.stringify(report, null, 2);
      const res = await safeCopyToClipboard(text);
      if (!res.ok) throw new Error(res.error || 'copy_failed');
      toast.success('تم نسخ تقرير التشخيص');
    } catch {
      toast.error('تعذر النسخ (قد تكون صلاحيات المتصفح غير متاحة)');
    }
  };

  const handleCopyDiagnostics = async () => {
    const text = appLastErrorRaw || '';
    if (!text.trim()) {
      toast.info('لا يوجد سجل أخطاء لنسخه');
      return;
    }
    try {
      const res = await safeCopyToClipboard(text);
      if (!res.ok) throw new Error(res.error || 'copy_failed');
      toast.success('تم نسخ سجل الأخطاء');
    } catch {
      toast.error('تعذر النسخ (قد تكون صلاحيات المتصفح غير متاحة)');
    }
  };

  const buildDiagnosticsReport = () => {
    const now = new Date();
    let sessionId: string | undefined;
    try {
      sessionId = String(sessionStorage.getItem('app_session_id') || '').trim() || undefined;
    } catch {
      sessionId = undefined;
    }

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
        isDesktop: !!window.desktopDb,
        hasDesktopUpdater: !!(window as unknown as { desktopUpdater?: unknown })?.desktopUpdater,
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        language: typeof navigator !== 'undefined' ? navigator.language : '',
        url: typeof window !== 'undefined' ? window.location.href : '',
        hash: typeof window !== 'undefined' ? window.location.hash : '',
      },
      lastError: appLastErrorRaw ? (appLastError ?? { raw: appLastErrorRaw }) : null,
      lastErrorRaw: appLastErrorRaw || '',
      errorLog: appErrorLogRaw ? (appErrorLog.length ? appErrorLog : { raw: appErrorLogRaw }) : [],
      errorLogRaw: appErrorLogRaw || '',
    };
  };

  const getDesktopDbCapabilities = () => {
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

  const downloadTextFile = (filename: string, text: string) => {
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

  const handleExportDiagnosticsFile = async () => {
    try {
      const base = buildDiagnosticsReport();
      const desktopCaps = getDesktopDbCapabilities();

      const sql = await (async () => {
        if (!window.desktopDb) return null;
        const out: Record<string, unknown> = {};
        try {
          if (window.desktopDb.sqlStatus) out.status = await window.desktopDb.sqlStatus();
        } catch (e: unknown) {
          out.statusError = getErrorMessage(e) || String(e ?? 'sqlStatus failed');
        }
        try {
          if (window.desktopDb.sqlGetSettings) out.settings = await window.desktopDb.sqlGetSettings();
        } catch (e: unknown) {
          out.settingsError = getErrorMessage(e) || String(e ?? 'sqlGetSettings failed');
        }
        return out;
      })();

      const report = { ...base, desktop: desktopCaps, sql };
      const safeStamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sid = typeof base?.runtime?.sessionId === 'string' ? base.runtime.sessionId.trim() : '';
      const safeSid = sid ? sid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
      const filename = safeSid ? `azrar-diagnostics-${safeSid}-${safeStamp}.json` : `azrar-diagnostics-${safeStamp}.json`;
      downloadTextFile(filename, JSON.stringify(report, null, 2));
      toast.success('تم تصدير ملف التشخيص');
    } catch {
      toast.error('تعذر تصدير ملف التشخيص');
    }
  };

  const handleClearDiagnostics = () => {
    try {
      localStorage.removeItem('app_last_error');
      localStorage.removeItem('app_error_log');
    } catch {
      // ignore
    }
    setAppLastErrorRaw('');
    setAppLastError(null);
    setAppErrorLogRaw('');
    setAppErrorLog([]);
    toast.success('تم مسح سجل الأخطاء');
  };

  const visibleTabs = useMemo(() => {
      const tabs = [
          { id: 'general', label: 'الإعدادات العامة', icon: Building, desc: 'الهوية والاتصال', permission: 'SETTINGS_ADMIN' as PermissionCode },
          { id: 'commissions', label: 'قواعد العمولات', icon: BadgeDollarSign, desc: 'نسب الإيجار والبيع', permission: 'SETTINGS_ADMIN' as PermissionCode },
          { id: 'lookups', label: 'الجداول المساعدة', icon: List, desc: 'القوائم المنسدلة', permission: 'SETTINGS_ADMIN' as PermissionCode },
        { id: 'server', label: 'إعدادات المخدم', icon: Globe, desc: 'SQL Server والمزامنة', role: 'SuperAdmin' },
          { id: 'backup', label: 'النسخ الاحتياطي', icon: Database, desc: 'تصدير واستيراد', role: 'SuperAdmin' },
          { id: 'audit', label: 'سجل التغييرات', icon: History, desc: 'تتبع تعديلات النظام', permission: 'SETTINGS_AUDIT' as PermissionCode },
          { id: 'diagnostics', label: 'التشخيص', icon: FileJson, desc: 'آخر أخطاء الواجهة', role: 'SuperAdmin' },
          { id: 'about', label: 'حول النظام', icon: Info, desc: 'حقوق النشر والإصدار', role: 'SuperAdmin' }
      ];

      if (serverOnly) {
        return tabs.filter(t => t.id === 'server').filter(t => {
          if (isSuperAdmin(user?.الدور)) return true;
          if (t.role && !isRole(user?.الدور, t.role)) return false;
          return true;
        });
      }
      
      return tabs.filter(t => {
          if (t.id === 'about') return true; // Always visible
          if (isSuperAdmin(user?.الدور)) return true;
          if (t.role && !isRole(user?.الدور, t.role)) return false;
          if (t.permission && !DbService.userHasPermission(user?.id || '', t.permission)) return false;
          return true;
      });
      }, [user, serverOnly]);

    useEffect(() => {
      if (serverOnly) {
      if (activeSection !== 'server') setActiveSection('server');
      return;
      }
      if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeSection)) {
        setActiveSection(visibleTabs[0].id);
      }
    }, [visibleTabs, serverOnly, activeSection]);

  useEffect(() => {
    if (visibleTabs.some(t => t.id === activeSection)) {
      loadSettings();
      if (activeSection === 'lookups') loadCategories();
      if (activeSection === 'audit') loadAuditLogs();
      if (activeSection === 'diagnostics') loadDiagnostics();
      if (activeSection === 'server') void loadSqlSection();
      if (activeSection === 'backup') void loadBackupSection();
    }
  }, [activeSection, visibleTabs, dbSignal, loadSettings, loadCategories, loadAuditLogs, loadDiagnostics, loadSqlSection, loadBackupSection]);

  const refreshSqlStatus = async () => {
    try {
      const st = (await window.desktopDb?.sqlStatus?.()) as unknown as SqlStatus | null;
      setSqlStatus(st || null);
    } catch {
      // ignore
    }
  };

  const handleSqlTest = async () => {
    if (!window.desktopDb?.sqlTestConnection) {
      toast.warning('ميزة المخدم متاحة فقط في وضع Desktop (Electron)');
      return;
    }
    setSqlBusy(true);
    try {
      const res = (await window.desktopDb.sqlTestConnection({
        server: sqlForm.server,
        port: Number(sqlForm.port || 1433) || 1433,
        database: sqlForm.database,
        authMode: sqlForm.authMode,
        user: sqlForm.user,
        password: sqlForm.password,
        encrypt: sqlForm.encrypt,
        trustServerCertificate: sqlForm.trustServerCertificate,
      })) as unknown as DesktopOkMessage | null;
      if (res?.ok) toast.success(res?.message || 'تم الاتصال');
      else toast.error(res?.message || 'فشل الاتصال');
    } finally {
      setSqlBusy(false);
      void refreshSqlStatus();
    }
  };

  const handleSqlSaveAndConnect = async () => {
    if (!window.desktopDb?.sqlSaveSettings || !window.desktopDb?.sqlConnect) {
      toast.warning('ميزة المخدم متاحة فقط في وضع Desktop (Electron)');
      return;
    }
    setSqlBusy(true);
    try {
      const saveRes = (await window.desktopDb.sqlSaveSettings({
        enabled: !!sqlForm.enabled,
        server: sqlForm.server,
        port: Number(sqlForm.port || 1433) || 1433,
        database: sqlForm.database,
        authMode: sqlForm.authMode,
        user: sqlForm.user,
        password: sqlForm.password,
        encrypt: sqlForm.encrypt,
        trustServerCertificate: sqlForm.trustServerCertificate,
      })) as unknown as DesktopSuccessMessage | null;

      if (saveRes?.success === false) {
        toast.error(saveRes?.message || 'فشل الحفظ');
        return;
      }

      if (!sqlForm.enabled) {
        toast.success('تم حفظ الإعدادات (المزامنة غير مفعلة)');
        return;
      }

      const res = (await window.desktopDb.sqlConnect()) as unknown as DesktopOkMessage | null;
      if (res?.ok) toast.success(res?.message || 'تم الاتصال');
      else toast.error(res?.message || 'فشل الاتصال');
    } finally {
      setSqlBusy(false);
      void refreshSqlStatus();
      // clear password field after attempt
      setSqlForm(prev => ({ ...prev, password: '' }));
    }
  };

  const handleSqlDisconnect = async () => {
    if (!window.desktopDb?.sqlDisconnect) return;
    setSqlBusy(true);
    try {
      await window.desktopDb.sqlDisconnect();
      toast.success('تم قطع الاتصال');
    } finally {
      setSqlBusy(false);
      void refreshSqlStatus();
    }
  };

  const refreshSqlBackupAutomation = useCallback(async () => {
    if (!window.desktopDb?.sqlGetBackupAutomationSettings) return;
    try {
      const res = (await window.desktopDb.sqlGetBackupAutomationSettings()) as unknown as SqlBackupAutomationResponse | null;
      if (res?.ok && res?.settings) setSqlBackupAuto(res.settings);
    } catch {
      // ignore
    }
  }, []);

  const saveSqlBackupAutomation = async (next: Partial<SqlBackupAutomationSettings>) => {
    if (!window.desktopDb?.sqlSaveBackupAutomationSettings) return;
    setSqlBackupAutoBusy(true);
    try {
      const res = (await window.desktopDb.sqlSaveBackupAutomationSettings(next)) as unknown as SqlBackupAutomationResponse | null;
      if (res?.ok && res?.settings) {
        setSqlBackupAuto(res.settings);
        toast.success('تم حفظ إعدادات النسخ الاحتياطي');
      } else {
        toast.error(res?.message || 'فشل حفظ إعدادات النسخ الاحتياطي');
      }
    } finally {
      setSqlBackupAutoBusy(false);
    }
  };

  const refreshSqlServerBackups = useCallback(async () => {
    if (!window.desktopDb?.sqlListServerBackups) return;
    setSqlServerBackupsBusy(true);
    try {
      const res = (await window.desktopDb.sqlListServerBackups({ limit: 60 })) as unknown as { ok: boolean; items?: SqlServerBackupItem[]; message?: string } | null;
      if (res?.ok) setSqlServerBackups(Array.isArray(res.items) ? res.items : []);
      else toast.error(res?.message || 'فشل قراءة النسخ الاحتياطية');
    } finally {
      setSqlServerBackupsBusy(false);
    }
  }, [toast]);

  const handleCreateServerBackupNow = async () => {
    if (!window.desktopDb?.sqlCreateServerBackup) {
      toast.error('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }
    setSqlServerBackupsBusy(true);
    try {
      const res = (await window.desktopDb.sqlCreateServerBackup({ note: 'manual' })) as unknown as { ok: boolean; message: string; deletedOld?: number } | null;
      if (res?.ok) {
        toast.success(res?.message || 'تم رفع نسخة احتياطية إلى المخدم');
        if (typeof res?.deletedOld === 'number' && res.deletedOld > 0) {
          toast.success(`تم حذف ${res.deletedOld} نسخة قديمة (احتفاظ ${sqlBackupAuto.retentionDays} يوم)`);
        }
        void refreshSqlServerBackups();
      } else {
        toast.error(res?.message || 'فشل رفع النسخة الاحتياطية');
      }
    } finally {
      setSqlServerBackupsBusy(false);
    }
  };

  const handleRestoreServerBackup = async (id: string, mode: 'merge' | 'replace') => {
    if (!window.desktopDb?.sqlRestoreServerBackup) {
      toast.error('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }
    setSqlServerBackupsBusy(true);
    try {
      const res = (await window.desktopDb.sqlRestoreServerBackup({ id, mode })) as unknown as { ok: boolean; message: string } | null;
      if (res?.ok) {
        toast.success(res?.message || 'تمت الاستعادة');
        toast.success('الآن نفّذ "مزامنة الآن" على الأجهزة لسحب البيانات');
        void refreshSqlServerBackups();
      } else {
        toast.error(res?.message || 'فشل الاستعادة');
      }
    } finally {
      setSqlServerBackupsBusy(false);
    }
  };

  const handleSqlExportServerBackup = async () => {
    if (!window.desktopDb?.sqlExportBackup) {
      toast.error('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }
    setSqlBusy(true);
    try {
      const res = (await window.desktopDb.sqlExportBackup()) as unknown as DesktopOkMessage | null;
      if (res?.ok) toast.success(res?.message || 'تم إنشاء نسخة احتياطية من المخدم');
      else toast.error(res?.message || 'فشل إنشاء النسخة الاحتياطية من المخدم');
    } finally {
      setSqlBusy(false);
    }
  };

  const handleSqlImportServerBackup = async () => {
    if (!window.desktopDb?.sqlImportBackup) {
      toast.error('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }
    setSqlBusy(true);
    try {
      const res = (await window.desktopDb.sqlImportBackup()) as unknown as DesktopOkMessage | null;
      if (res?.ok) toast.success(res?.message || 'تم استيراد النسخة الاحتياطية');
      else toast.error(res?.message || 'فشل استيراد النسخة الاحتياطية');
      void refreshSqlStatus();
    } finally {
      setSqlBusy(false);
    }
  };

  const handleSqlRestoreServerBackup = async () => {
    if (!window.desktopDb?.sqlRestoreBackup) {
      toast.error('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }
    setSqlBusy(true);
    try {
      const res = (await window.desktopDb.sqlRestoreBackup()) as unknown as DesktopOkMessage | null;
      if (res?.ok) toast.success(res?.message || 'تمت الاستعادة الكاملة');
      else toast.error(res?.message || 'فشل الاستعادة الكاملة');
      void refreshSqlStatus();
    } finally {
      setSqlBusy(false);
    }
  };

  const handleSqlSyncNow = async () => {
    if (!window.desktopDb?.sqlSyncNow) {
      toast.error('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }
    setSqlBusy(true);
    try {
      const res = (await window.desktopDb.sqlSyncNow()) as unknown as DesktopOkMessage | null;
      if (res?.ok) toast.success(res?.message || 'تمت المزامنة');
      else toast.error(res?.message || 'فشل المزامنة');
      void refreshSqlStatus();
    } finally {
      setSqlBusy(false);
    }
  };

  const handleSqlProvision = async () => {
    if (!window.desktopDb?.sqlProvision) {
      toast.warning('ميزة تهيئة المخدم متاحة فقط في وضع Desktop (Electron)');
      return;
    }
    setSqlBusy(true);
    try {
      const res = (await window.desktopDb.sqlProvision({
        server: sqlForm.server,
        port: Number(sqlForm.port || 1433) || 1433,
        database: sqlForm.database,
        encrypt: sqlForm.encrypt,
        trustServerCertificate: sqlForm.trustServerCertificate,
        adminUser: sqlProvision.adminUser,
        adminPassword: sqlProvision.adminPassword,
        managerUser: sqlProvision.managerUser,
        managerPassword: sqlProvision.managerPassword,
        employeeUser: sqlProvision.employeeUser,
        employeePassword: sqlProvision.employeePassword,
      })) as unknown as DesktopOkMessage | null;
      if (res?.ok) {
        toast.success(res?.message || 'تمت تهيئة المخدم');
        // After provisioning, the app credentials are saved internally.
        // Refresh form/status to reflect saved settings.
        const s = (await window.desktopDb.sqlGetSettings?.()) as unknown as DesktopSqlSettings | null;
        if (s) {
          setSqlForm(prev => ({
            ...prev,
            enabled: !!s?.enabled,
            server: String(s?.server || prev.server),
            port: Number(s?.port || prev.port || 1433) || 1433,
            database: String(s?.database || prev.database),
            authMode: s?.authMode === 'windows' ? 'windows' : 'sql',
            user: String(s?.user || ''),
            hasPassword: !!s?.hasPassword,
            password: '',
          }));
        }
        setSqlProvision(p => ({ ...p, adminPassword: '', managerPassword: '', employeePassword: '' }));
      } else {
        toast.error(res?.message || 'فشل تهيئة المخدم');
      }
    } finally {
      setSqlBusy(false);
      void refreshSqlStatus();
    }
  };

  const handleChooseBackupDir = async () => {
    if (!window.desktopDb?.chooseBackupDir) {
      toast.warning('ميزة تغيير مجلد النسخ متاحة فقط في وضع Desktop (Electron)');
      return;
    }
    try {
      const res = (await window.desktopDb.chooseBackupDir()) as unknown as DesktopSuccessMessage | null;
      if (res?.success) {
        setBackupDir(res?.backupDir || '');
        toast.success(res?.message || 'تم حفظ مجلد النسخ الاحتياطي');
      } else {
        toast.error(res?.message || 'تم الإلغاء');
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل حفظ مجلد النسخ الاحتياطي');
    }
  };

  useEffect(() => {
    if (activeCategory) setLookupItems(DbService.getLookupsByCategory(activeCategory.name));
  }, [activeCategory]);

  useEffect(() => {
    if (!isDesktop) return;
    if (activeSection !== 'server') return;
    void refreshSqlBackupAutomation();
    void refreshSqlServerBackups();
  }, [activeSection, isDesktop, refreshSqlBackupAutomation, refreshSqlServerBackups]);

  useEffect(() => {
    if (!catSearchTerm.trim()) setFilteredCategories(categories);
    else setFilteredCategories(categories.filter(c => c.label.toLowerCase().includes(catSearchTerm.toLowerCase()) || c.name.toLowerCase().includes(catSearchTerm.toLowerCase())));
  }, [catSearchTerm, categories]);

  useEffect(() => {
    if (!settings) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      DbService.saveSettings(settings);
      setSaveStatus('saved');
    }, 700);
    return () => clearTimeout(timer);
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if(settings && ev.target?.result) setSettings({...settings, logoUrl: ev.target.result as string});
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const openAddTableModal = () => { setTableForm({ id: '', name: '', label: '' }); setIsEditingTable(false); setIsTableModalOpen(true); };
  const openEditTableModal = (cat: LookupCategory) => { setTableForm({ id: cat.id, name: cat.name, label: cat.label }); setIsEditingTable(true); setIsTableModalOpen(true); };

  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableForm.label.trim()) return toast.warning('يرجى إدخال اسم الجدول');
    
    let res;
    if (isEditingTable) {
        res = DbService.updateLookupCategory(tableForm.id, { label: tableForm.label });
    } else {
        if(!tableForm.name.trim()) return toast.warning('يرجى إدخال المعرف البرمجي');
        const finalName = tableForm.name.toLowerCase().replace(/\s+/g, '_');
        res = DbService.addLookupCategory(finalName, tableForm.label);
    }

    if (res && res.success === false) {
        toast.error(res.message);
    } else {
        toast.success(isEditingTable ? 'تم تحديث الجدول' : 'تم إنشاء الجدول');
        setIsTableModalOpen(false);
        loadCategories();
    }
  };

  const handleDeleteCategory = (id: string) => {
    openPanel('CONFIRM_MODAL', id, {
        title: 'حذف جدول البيانات',
        message: 'هل أنت متأكد؟ سيؤدي هذا لحذف القائمة وجميع العناصر المرتبطة بها نهائياً.',
        confirmText: 'نعم، احذف',
        variant: 'danger',
        onConfirm: () => { 
            const res = DbService.deleteLookupCategory(id);
            if (res.success) {
                loadCategories();
                toast.success('تم حذف الجدول بنجاح');
            } else {
                toast.error('فشل الحذف');
            }
        }
    });
  };

  const handleAddLookup = () => {
    if (!activeCategory) return;
    openPanel('SMART_PROMPT', 'new_lookup', {
        title: 'إضافة عنصر جديد',
        message: `إضافة قيمة جديدة للقائمة: ${activeCategory.label}`,
        placeholder: 'القيمة (مثال: شقة أرضية)',
        required: true,
        onConfirm: (val: string) => {
            // Validator: Uniqueness
            if (lookupItems.some(item => item.label.toLowerCase() === val.trim().toLowerCase())) {
                toast.error('هذه القيمة موجودة مسبقاً في القائمة');
                return;
            }
            
            DbService.addLookup(activeCategory.name, val);
            setLookupItems(DbService.getLookupsByCategory(activeCategory.name));
            toast.success('تم إضافة العنصر');
        }
    });
  };

  const handleDeleteLookup = (id: string) => {
    DbService.deleteLookup(id);
    if (activeCategory) setLookupItems(DbService.getLookupsByCategory(activeCategory.name));
  };

  const downloadCSV = (content: string, fileName: string) => {
      const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleExportLookupsJSON = () => {
      if (!activeCategory) return;
      const items = DbService.getLookupsByCategory(activeCategory.name).map(l => l.label);
      const json = JSON.stringify(items, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${activeCategory.name}_lookups.json`; a.click();
  };

  const handleExportLookupsCSV = () => {
      if (!activeCategory) return;
      const items = DbService.getLookupsByCategory(activeCategory.name);
      if (items.length === 0) return toast.warning('لا توجد بيانات للتصدير');
      
      const csv = "ID,Label,Category\n" + items.map(i => `${i.id},"${i.label}",${i.category}`).join("\n");
      downloadCSV(csv, `${activeCategory.name}_lookups.csv`);
  };

  const handleExportAuditCSV = () => {
      if (auditLogs.length === 0) return toast.warning('لا توجد سجلات');
      const csv = "User,Action,Table,Details,Date\n" + auditLogs.map(l => `"${l.اسم_المستخدم}","${l.نوع_العملية}","${l.اسم_الجدول}","${l.details?.replace(/"/g, '""')}","${l.تاريخ_العملية}"`).join("\n");
      downloadCSV(csv, `settings_audit_log_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const handleImportLookups = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeCategory || !e.target.files?.[0]) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const data = JSON.parse(ev.target?.result as string);
              if (Array.isArray(data)) {
                  DbService.importLookups(activeCategory.name, data);
                  setLookupItems(DbService.getLookupsByCategory(activeCategory.name));
                  toast.success(`تم استيراد ${data.length} عنصر بنجاح`);
              } else { toast.error('صيغة الملف غير صحيحة'); }
          } catch { toast.error('فشل قراءة الملف'); }
      };
      reader.readAsText(e.target.files[0]);
      e.target.value = '';
  };

  const handleBackup = async () => {
    // Desktop: export sqlite DB via Electron (creates latest + dated archive)
    if (window.desktopDb?.export) {
      try {
        const res = (await window.desktopDb.export()) as unknown as DesktopSuccessMessage | null;
        if (res?.success) {
          toast.success(res?.archivePath ? 'تم حفظ النسخة (Latest + أرشيف اليوم)' : (res?.message || 'تم التصدير بنجاح'));
        } else {
          toast.error(res?.message || 'فشل تصدير قاعدة البيانات');
        }
      } catch (e: unknown) {
        const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as Record<string, unknown>).message ?? '') : '';
        toast.error(msg || 'فشل تصدير قاعدة البيانات');
      }
      return;
    }

    // Web/fallback: export JSON from mockDb
    const url = DbService.backupSystem();
    const a = document.createElement('a');
    a.href = url;
    a.download = `khaberni_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleRestore = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const preview = DbService.previewRestore(json);
      openPanel('CONFIRM_MODAL', 'restore', {
          title: 'استعادة نسخة احتياطية',
          message: `سيتم استرجاع: ${preview.people} أشخاص، ${preview.contracts} عقود. هل أنت متأكد؟ سيتم استبدال البيانات الحالية.`,
          confirmText: 'استعادة', variant: 'danger',
          onConfirm: () => { DbService.restoreSystem(json); toast.success('تم الاسترجاع بنجاح'); window.location.reload(); }
      });
    } catch { toast.error('ملف النسخة الاحتياطية غير صالح أو تالف'); }
  };

  const handleDesktopImport = async () => {
    if (!window.desktopDb?.import) {
      toast.warning('ميزة الاستيراد متاحة فقط في وضع Desktop (Electron)');
      return;
    }
    try {
      const res = (await window.desktopDb.import()) as unknown as DesktopSuccessMessage | null;
      if (res?.success) {
        toast.success(res?.message || 'تم الاستيراد بنجاح - أعد تشغيل التطبيق');
      } else {
        toast.error(res?.message || 'فشل استيراد قاعدة البيانات');
      }
    } catch (e: unknown) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as Record<string, unknown>).message ?? '') : '';
      toast.error(msg || 'فشل استيراد قاعدة البيانات');
    }
  };

  const goToDatabaseReset = () => {
    openPanel('CONFIRM_MODAL', 'go_database_reset', {
      title: 'إعادة ضبط المصنع',
      variant: 'danger',
      confirmText: 'متابعة',
      cancelText: 'إلغاء',
      message: `سيتم فتح شاشة "إدارة قاعدة البيانات" التي تسمح بتصفير النظام.

ننصح بتصدير نسخة احتياطية قبل المتابعة.`,
      onConfirm: () => {
        window.location.hash = ROUTE_PATHS.RESET_DATABASE;
      },
    });
  };

  const resetOnboarding = () => {
      localStorage.removeItem('khaberni_onboarding_completed');
      window.location.reload();
  };

  const clearSystemCache = async () => {
      const ok = await toast.confirm({
        title: 'تأكيد',
        message: 'هل أنت متأكد؟ سيتم مسح الكاش المحلي وإعادة بناء الفهارس. لن يتم حذف البيانات الأساسية.',
        confirmText: 'متابعة',
        cancelText: 'إلغاء',
        isDangerous: true,
      });
      if (!ok) return;

      // Keep critical keys, clear cache keys
      void storage.removeItem('db_dashboard_config'); // Reset dashboard layout
      localStorage.removeItem('db_dashboard_config');
      // Force reload to rebuild cache via mockDb init
      window.location.reload();
  };

  const inputClass = "w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm";
  const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2";

  const settingsNoAccessFallback = (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 text-slate-500 dark:text-slate-400">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4">
        <Shield size={24} className="opacity-70" />
      </div>
      <div className="text-slate-800 dark:text-slate-200 font-bold">لا تملك صلاحية الوصول لهذا القسم</div>
      <div className="text-sm mt-1">يرجى تسجيل الدخول بحساب مخوّل أو مراجعة صلاحيات المستخدم.</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {!embedded && (
        <div className={`${DS.components.pageHeader} mb-6`}>
          <div>
            <h2 className={DS.components.pageTitle}>إعدادات النظام</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">تخصيص البيانات، القوائم، والنسخ الاحتياطي</p>
          </div>

          <div className="flex items-center gap-2">
            {activeSection === 'general' && settings && !settingsLoading && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${saveStatus === 'saving' ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'}`}> 
                {saveStatus === 'saving' ? <RefreshCcw size={12} className="animate-spin"/> : <Check size={12}/>} 
                {saveStatus === 'saving' ? 'جاري الحفظ...' : 'تم الحفظ'}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`flex flex-1 overflow-hidden h-full ${embedded ? '' : 'gap-6'}`}>
        {!embedded && (
          <div className="w-64 flex-shrink-0 app-card p-2 h-fit">
            {visibleTabs.length > 0 ? visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-right transition-all mb-1 group
                  ${activeSection === tab.id ? "bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-white shadow-sm ring-1 ring-indigo-100 dark:ring-slate-600" : "text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50"}`}
              >
                <div className={`p-2 rounded-lg transition-colors ${activeSection === tab.id ? 'bg-indigo-200/50 dark:bg-slate-600 text-indigo-700 dark:text-white' : 'bg-gray-100 dark:bg-slate-900 text-slate-500'}` }>
                  <tab.icon size={18} />
                </div>
                <div>
                  <span className="block font-bold text-sm">{tab.label}</span>
                  <span className="block text-[10px] opacity-70 font-normal">{tab.desc}</span>
                </div>
              </button>
            )) : (
                <div className="p-4 text-center text-slate-400 text-sm">
                    <Shield size={24} className="mx-auto mb-2 opacity-50"/>
                    لا تملك صلاحيات للوصول للإعدادات.
                </div>
            )}
          </div>
        )}

        <div className="flex-1 app-card flex flex-col relative">

          {settingsLoading && (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              جاري تحميل الإعدادات...
            </div>
          )}

          {!settingsLoading && (activeSection === 'general' || activeSection === 'commissions') && !settings && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 flex items-center justify-center mb-4">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div className="text-slate-700 dark:text-slate-200 font-bold">تعذر تحميل إعدادات النظام</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">اضغط إعادة المحاولة لإعادة تحميل البيانات.</div>
              <div className="mt-5">
                <Button variant="secondary" onClick={loadSettings}>
                  إعادة المحاولة
                </Button>
              </div>
            </div>
          )}
          
          {!settingsLoading && activeSection === 'general' && settings && (
            <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
                <div className="p-8 overflow-y-auto custom-scrollbar h-full space-y-8 animate-fade-in">
                {/* Branding */}
                <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  <Building className="text-indigo-500" size={20}/> الهوية التجارية
                    </h3>
                    <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative group cursor-pointer">
                        <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden hover:border-indigo-400 transition">
                            {settings.logoUrl ? <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" /> : <ImageIcon className="text-gray-300" size={40} />}
                        </div>
                        <input
                          id="settings-logo-upload"
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={handleLogoUpload}
                          aria-label="تحميل شعار الشركة"
                          title="تحميل شعار الشركة"
                        />
                        </div>
                    </div>
                    <div className="flex-1 grid grid-cols-1 gap-4">
                        <div>
                          <label className={labelClass} htmlFor="settings-company-name">اسم الشركة الرسمي</label>
                          <input
                            id="settings-company-name"
                            className={inputClass}
                            value={settings.companyName}
                            onChange={e => setSettings({...settings, companyName: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="settings-company-slogan">الشعار اللفظي</label>
                          <input
                            id="settings-company-slogan"
                            className={inputClass}
                            value={settings.companySlogan || ''}
                            onChange={e => setSettings({...settings, companySlogan: e.target.value})}
                          />
                        </div>
                    </div>
                    </div>
                </section>
                <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <Phone className="text-green-500" size={20}/> معلومات الاتصال
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
                        <div>
                          <label className={labelClass} htmlFor="settings-company-phone">الهاتف</label>
                          <input
                            id="settings-company-phone"
                            className={inputClass}
                            value={settings.companyPhone}
                            onChange={e => setSettings({...settings, companyPhone: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="settings-company-email">البريد الإلكتروني</label>
                          <input
                            id="settings-company-email"
                            className={inputClass}
                            value={settings.companyEmail}
                            onChange={e => setSettings({...settings, companyEmail: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="settings-company-website">الموقع</label>
                          <input
                            id="settings-company-website"
                            className={inputClass}
                            value={settings.companyWebsite}
                            onChange={e => setSettings({...settings, companyWebsite: e.target.value})}
                          />
                        </div>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="settings-company-address">العنوان</label>
                      <input
                        id="settings-company-address"
                        className={inputClass}
                        value={settings.companyAddress}
                        onChange={e => setSettings({...settings, companyAddress: e.target.value})}
                      />
                    </div>
                </section>

                {/* Letterhead */}
                <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                      <Building className="text-indigo-500" size={20}/> الترويسة (الطباعة/التصدير)
                    </h3>

                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div>
                        <div className="font-bold text-slate-700 dark:text-slate-200">إظهار الترويسة</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          عند تفعيلها سيتم إضافة معلومات هوية الشركة في قوالب التصدير والطباعة.
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={settings.letterheadEnabled !== false}
                          onChange={e => setSettings({ ...settings, letterheadEnabled: e.target.checked })}
                          className="w-4 h-4"
                        />
                        تفعيل
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className={labelClass} htmlFor="settings-letterhead-tax-number">الرقم الضريبي</label>
                        <input
                          id="settings-letterhead-tax-number"
                          className={inputClass}
                          value={settings.taxNumber || ''}
                          onChange={e => setSettings({ ...settings, taxNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="settings-letterhead-commercial-register">السجل التجاري</label>
                        <input
                          id="settings-letterhead-commercial-register"
                          className={inputClass}
                          value={settings.commercialRegister || ''}
                          onChange={e => setSettings({ ...settings, commercialRegister: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>هوية الشركة (تظهر في الترويسة)</label>
                      <textarea
                        className={inputClass + ' min-h-[120px]'}
                        value={settings.companyIdentityText || ''}
                        onChange={e => setSettings({ ...settings, companyIdentityText: e.target.value })}
                        placeholder={'مثال:\nالمالك: ...\nالرقم الوطني/الهوية: ...\nالترخيص: ...'}
                      />
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                        ملاحظة: يمكن كتابة أكثر من سطر وسيظهر كما هو في الطباعة.
                      </div>
                    </div>
                </section>
                
                {/* Advanced Reset Section */}
                <section className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-800/30">
                    <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-4 flex items-center gap-2">
                        <AlertTriangle size={20}/> منطقة الخطر (إصلاح النظام)
                    </h3>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-red-600/80 dark:text-red-400/80 max-w-lg">
                            في حال واجهت مشاكل في تحميل البيانات أو عرض الصفحات، يمكنك مسح الذاكرة المؤقتة وإعادة بناء الفهارس. لن يتم حذف البيانات الأساسية.
                        </p>
                        <button 
                            onClick={clearSystemCache}
                            className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            إصلاح / مسح الكاش
                        </button>
                    </div>
                </section>
                </div>
            </RBACGuard>
          )}

          {!settingsLoading && activeSection === 'commissions' && settings && (
            <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
                <div className="p-8 overflow-y-auto custom-scrollbar h-full space-y-8 animate-fade-in">
                <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">عمولات البيع</h3>
                    <div>
                      <label className={labelClass} htmlFor="settings-sales-commission-percent">نسبة عمولة البيع (%)</label>
                      <Input
                        id="settings-sales-commission-percent"
                        type="number"
                        className={inputClass}
                        value={settings.salesCommissionPercent}
                        onChange={e => setSettings({...settings, salesCommissionPercent: Number(e.target.value)})}
                      />
                    </div>
                </section>
                <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">عمولات الإيجار</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className={labelClass} htmlFor="settings-rental-commission-owner-percent">عمولة المالك (%)</label>
                          <Input
                            id="settings-rental-commission-owner-percent"
                            type="number"
                            className={inputClass}
                            value={settings.rentalCommissionOwnerPercent || 0}
                            onChange={e => setSettings({...settings, rentalCommissionOwnerPercent: Number(e.target.value)})}
                          />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="settings-rental-commission-tenant-percent">عمولة المستأجر (%)</label>
                          <Input
                            id="settings-rental-commission-tenant-percent"
                            type="number"
                            className={inputClass}
                            value={settings.rentalCommissionTenantPercent || 0}
                            onChange={e => setSettings({...settings, rentalCommissionTenantPercent: Number(e.target.value)})}
                          />
                        </div>
                    </div>
                </section>
                </div>
            </RBACGuard>
          )}

          {activeSection === 'lookups' && (
            <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
                <div className="flex h-full animate-fade-in">
                <div className="w-80 border-l border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30 flex flex-col">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700">
                        <input placeholder="بحث في القوائم..." className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm mb-3" value={catSearchTerm} onChange={e => setCatSearchTerm(e.target.value)} />
                        <button onClick={openAddTableModal} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-bold flex items-center justify-center gap-2"><Plus size={16}/> إنشاء جدول</button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                        {filteredCategories.map(cat => (
                          <div key={cat.id} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer ${activeCategory?.id === cat.id ? 'bg-white dark:bg-slate-800 border-indigo-500 border-l-4' : 'hover:bg-white dark:hover:bg-slate-800'}`} onClick={() => setActiveCategory(cat)}>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm">{cat.label}</span>
                                    <span className="text-[10px] text-slate-400">{cat.name}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openEditTableModal(cat); }}
                                className="p-1 text-indigo-400 hover:bg-indigo-50 rounded"
                                aria-label="تعديل الجدول"
                                title="تعديل الجدول"
                              >
                                <Edit2 size={12}/>
                              </button>
                                    {!cat.isSystem && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                                        className="p-1 text-red-400 hover:bg-red-50 rounded"
                                        aria-label="حذف الجدول"
                                        title="حذف الجدول"
                                      >
                                        <Trash2 size={12}/>
                                      </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-800">
                    {activeCategory ? (
                        <>
                            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/20">
                                <div>
                                    <h3 className="text-xl font-bold">{activeCategory.label}</h3>
                                    <p className="text-xs text-slate-400">{activeCategory.name} • {lookupItems.length} عنصر</p>
                                </div>
                                <div className="flex gap-2">
                                    <label className="py-2 px-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-gray-50">
                                        <Upload size={14}/> استيراد
                                      <input type="file" accept=".json" className="hidden" onChange={handleImportLookups} aria-label="استيراد JSON" title="استيراد JSON" />
                                    </label>
                                    <button onClick={handleExportLookupsJSON} className="py-2 px-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-gray-50">
                                        <FileJson size={14}/> JSON
                                    </button>
                                    <button onClick={handleExportLookupsCSV} className="py-2 px-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-gray-50">
                                        <FileSpreadsheet size={14}/> CSV
                                    </button>
                                    <button onClick={handleAddLookup} className="py-2 px-4 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 ml-2"><Plus size={16}/> إضافة</button>
                                </div>
                            </div>
                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {lookupItems.map(item => (
                                        <div key={item.id} className="group relative bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 p-4 rounded-xl hover:shadow-md transition">
                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteLookup(item.id)}
                                              className="absolute top-2 left-2 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 p-1 rounded"
                                              aria-label="حذف العنصر"
                                              title="حذف العنصر"
                                            >
                                              <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    ))}
                                    {lookupItems.length === 0 && <div className="col-span-full text-center py-10 text-slate-400">القائمة فارغة</div>}
                                </div>
                            </div>
                        </>
                    ) : <div className="flex-1 flex items-center justify-center text-slate-400">اختر جدولاً لإدارته</div>}
                </div>
                </div>
            </RBACGuard>
          )}

          {!settingsLoading && activeSection === 'backup' && (
            <RBACGuard requiredRole="SuperAdmin" fallback={settingsNoAccessFallback}>
                <div className="flex items-center justify-center h-full p-8 animate-fade-in bg-gray-50 dark:bg-slate-900/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
                    <div className="app-card p-8 rounded-3xl flex flex-col items-center text-center cursor-pointer hover:shadow-lg" onClick={handleBackup}>
                        <Download size={40} className="text-green-600 mb-4"/>
                        <h3 className="text-xl font-bold mb-2">تصدير نسخة احتياطية</h3>
                        {isDesktop ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                            سيتم إنشاء ملفين تلقائياً داخل المجلد الذي تختاره: <span className="font-mono">AZRAR-backup-latest.db</span> + أرشيف بتاريخ اليوم.
                          </p>
                        ) : null}
                        <button className="mt-4 px-6 py-2 bg-green-600 text-white rounded-xl font-bold">تحميل النسخة</button>
                    </div>
                    <div className="app-card p-8 rounded-3xl flex flex-col items-center text-center">
                        <Upload size={40} className="text-amber-600 mb-4"/>
                        <h3 className="text-xl font-bold mb-2">استعادة البيانات</h3>
                        {isDesktop ? (
                          <button onClick={handleDesktopImport} className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-xl font-bold cursor-pointer">
                            اختيار ملف
                          </button>
                        ) : (
                          <label className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-xl font-bold cursor-pointer">
                              اختيار ملف
                              <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={(e) => e.target.files && handleRestore(e.target.files[0])}
                                aria-label="اختيار ملف لاستعادة البيانات"
                                title="اختيار ملف لاستعادة البيانات"
                              />
                          </label>
                        )}
                    </div>

                {isDesktop && (
                  <div className="app-card p-6 rounded-3xl md:col-span-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">مجلد النسخ الاحتياطي</h3>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          سيتم استخدام هذا المجلد تلقائياً في كل عملية تصدير.
                        </div>
                        <div className="mt-3 text-xs font-mono bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 break-all">
                          {backupDir || 'غير محدد بعد'}
                        </div>
                      </div>
                      <button
                        onClick={handleChooseBackupDir}
                        className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                      >
                        <FolderOpen size={16} /> تغيير المجلد
                      </button>
                    </div>
                  </div>
                )}

                <div className="app-card p-8 rounded-3xl flex flex-col items-center text-center md:col-span-2">
                  <AlertTriangle size={40} className="text-red-600 mb-4"/>
                  <h3 className="text-xl font-bold mb-2">إعادة ضبط المصنع</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
                    تصفير/حذف البيانات يتم من شاشة إدارة قاعدة البيانات. تأكد من عمل نسخة احتياطية أولاً.
                  </p>
                  <button onClick={goToDatabaseReset} className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">
                    فتح شاشة التصفير
                  </button>
                </div>
                </div>
                </div>
            </RBACGuard>
          )}

          {!settingsLoading && activeSection === 'server' && (
            <RBACGuard requiredRole="SuperAdmin" fallback={settingsNoAccessFallback}>
              <div className="p-8 h-full animate-fade-in">
                <div className="max-w-4xl mx-auto app-card p-6 rounded-3xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-white">إعدادات المخدم (SQL Server)</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        عند الضغط على اتصال سيتم إنشاء قاعدة البيانات/الجدول تلقائياً إذا كانت الصلاحيات تسمح.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openPanel('SQL_SYNC_LOG')}
                        className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                        disabled={sqlBusy}
                        title="عرض كل ما تم مزامنته أو حذفه"
                      >
                        <History size={16} /> سجل المزامنة
                      </button>
                      <button
                        onClick={refreshSqlStatus}
                        className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                        disabled={sqlBusy}
                      >
                        <RefreshCcw size={16} /> تحديث الحالة
                      </button>
                    </div>
                  </div>

                  {!isDesktop && (
                    <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                      إعدادات المخدم متاحة فقط في نسخة Desktop.
                    </div>
                  )}

                  {isDesktop && !window.desktopDb?.sqlGetSettings && (
                    <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                      هذه النسخة لا تحتوي بعد على ميزات المخدم.
                    </div>
                  )}

                  {isDesktop && window.desktopDb?.sqlGetSettings && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                        <div>
                          <div className="font-bold">تفعيل المزامنة مع المخدم</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">سيتم الحفظ محلياً + إرسال نسخة محمية إلى SQL Server</div>
                        </div>
                        <button
                          onClick={() => setSqlForm(p => ({ ...p, enabled: !p.enabled }))}
                          className={`px-4 py-2 rounded-xl text-sm font-black ${sqlForm.enabled ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600'}`}
                          disabled={sqlBusy}
                        >
                          {sqlForm.enabled ? 'مفعل' : 'غير مفعل'}
                        </button>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-server">Server</label>
                        <input
                          id="settings-sql-server"
                          className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                          placeholder="مثال: 192.168.1.10 أو SQLSERVER\\INSTANCE"
                          value={sqlForm.server}
                          onChange={e => setSqlForm(p => ({ ...p, server: e.target.value }))}
                          disabled={sqlBusy}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-port">Port</label>
                        <input
                          id="settings-sql-port"
                          className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                          placeholder="1433"
                          value={String(sqlForm.port ?? 1433)}
                          onChange={e => setSqlForm(p => ({ ...p, port: Number(e.target.value || 1433) || 1433 }))}
                          disabled={sqlBusy}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-database">Database</label>
                        <input
                          id="settings-sql-database"
                          className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                          placeholder="AZRAR"
                          value={sqlForm.database}
                          onChange={e => setSqlForm(p => ({ ...p, database: e.target.value }))}
                          disabled={sqlBusy}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-auth-mode">نوع الدخول</label>
                        <select
                          id="settings-sql-auth-mode"
                          className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                          value={sqlForm.authMode}
                          onChange={e => setSqlForm(p => ({ ...p, authMode: e.target.value === 'windows' ? 'windows' : 'sql' }))}
                          disabled={sqlBusy}
                        >
                          <option value="sql">SQL Login</option>
                          <option value="windows">Windows Auth</option>
                        </select>
                        {sqlForm.authMode === 'windows' && (
                          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2">
                            Windows Auth غير مدعوم حالياً داخل التطبيق. استخدم SQL Login.
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-username">Username</label>
                        <input
                          id="settings-sql-username"
                          className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                          placeholder="sa أو user"
                          value={sqlForm.user}
                          onChange={e => setSqlForm(p => ({ ...p, user: e.target.value }))}
                          disabled={sqlBusy || sqlForm.authMode === 'windows'}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-password">Password</label>
                        <input
                          id="settings-sql-password"
                          type="password"
                          className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                          placeholder={sqlForm.hasPassword ? '•••••• (محفوظة) - اكتب لتغييرها' : 'ادخل كلمة المرور'}
                          value={sqlForm.password}
                          onChange={e => setSqlForm(p => ({ ...p, password: e.target.value }))}
                          disabled={sqlBusy || sqlForm.authMode === 'windows'}
                        />
                      </div>

                      <div className="md:col-span-2 flex flex-wrap gap-3 items-center">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={sqlForm.encrypt} onChange={e => setSqlForm(p => ({ ...p, encrypt: e.target.checked }))} disabled={sqlBusy} />
                          <span>Encrypt</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={sqlForm.trustServerCertificate} onChange={e => setSqlForm(p => ({ ...p, trustServerCertificate: e.target.checked }))} disabled={sqlBusy} />
                          <span>Trust Server Certificate</span>
                        </label>
                      </div>

                      <div className="md:col-span-2 flex flex-wrap gap-3">
                        <button
                          onClick={handleSqlTest}
                          className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2"
                          disabled={sqlBusy}
                        >
                          <Check size={16} /> اختبار الاتصال
                        </button>
                        <button
                          onClick={handleSqlSaveAndConnect}
                          className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2"
                          disabled={sqlBusy}
                        >
                          <ArrowRight size={16} /> حفظ ثم اتصال
                        </button>
                        <button
                          onClick={handleSqlDisconnect}
                          className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2"
                          disabled={sqlBusy}
                        >
                          <X size={16} /> قطع الاتصال
                        </button>
                      </div>

                      <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                        <div className="text-sm font-black">الحالة</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                          <span
                            className={
                              (sqlStatus?.connected ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200') +
                              ' px-3 py-1 rounded-full'
                            }
                          >
                            {sqlStatus?.connected ? 'متصل بالمخدم' : 'غير متصل'}
                          </span>
                          <span
                            className={
                              (sqlStatus?.enabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200') +
                              ' px-3 py-1 rounded-full'
                            }
                          >
                            {sqlStatus?.enabled ? 'المزامنة مفعلة' : 'المزامنة غير مفعلة'}
                          </span>
                        </div>
                        {sqlStatus?.lastSyncAt && (
                          <div className="mt-2 text-xs text-slate-500">آخر مزامنة: {new Date(sqlStatus.lastSyncAt).toLocaleString()}</div>
                        )}
                        {sqlStatus?.lastError && (
                          <div className="mt-2 text-xs text-red-600">{sqlStatus.lastError}</div>
                        )}

                        {window.desktopDb?.sqlExportBackup && (
                          <div className="mt-4 flex flex-wrap gap-3 items-center">
                            <button
                              onClick={handleSqlExportServerBackup}
                              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-5 py-2.5 rounded-xl text-sm font-black"
                              disabled={sqlBusy}
                            >
                              نسخ احتياطي من المخدم
                            </button>

                            {window.desktopDb?.sqlImportBackup && (
                              <button
                                onClick={handleSqlImportServerBackup}
                                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-5 py-2.5 rounded-xl text-sm font-black"
                                disabled={sqlBusy}
                              >
                                استيراد (دمج)
                              </button>
                            )}

                            {window.desktopDb?.sqlRestoreBackup && (
                              <button
                                onClick={handleSqlRestoreServerBackup}
                                className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-5 py-2.5 rounded-xl text-sm font-black text-red-700 dark:text-red-300"
                                disabled={sqlBusy}
                              >
                                استعادة كاملة
                              </button>
                            )}

                            {window.desktopDb?.sqlSyncNow && (
                              <button
                                onClick={handleSqlSyncNow}
                                className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-sm font-black"
                                disabled={sqlBusy}
                              >
                                مزامنة الآن
                              </button>
                            )}

                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              يتم حفظ ملف JSON على هذا الجهاز (لقطة من جدول KvStore).
                            </div>
                          </div>
                        )}
                      </div>

                        {window.desktopDb?.sqlGetBackupAutomationSettings && (
                          <div className="md:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div>
                                <div className="text-sm font-black">النسخ الاحتياطي اليومي على المخدم</div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  يتم إنشاء نسخة واحدة كل يوم على SQL Server (تخزين على المخدم) + حذف الأقدم من مدة الاحتفاظ.
                                </div>
                              </div>

                              <div className="flex gap-2 flex-wrap">
                                <button
                                  onClick={() => saveSqlBackupAutomation({ enabled: !sqlBackupAuto.enabled })}
                                  className={`px-4 py-2 rounded-xl text-sm font-black ${sqlBackupAuto.enabled ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600'}`}
                                  disabled={sqlBackupAutoBusy}
                                  title="تشغيل/إيقاف النسخ اليومي"
                                >
                                  {sqlBackupAuto.enabled ? 'مفعل' : 'غير مفعل'}
                                </button>

                                <button
                                  onClick={handleCreateServerBackupNow}
                                  className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl text-sm font-black"
                                  disabled={sqlServerBackupsBusy || sqlBusy}
                                  title="رفع نسخة الآن إلى المخدم"
                                >
                                  إنشاء نسخة الآن
                                </button>

                                <button
                                  onClick={refreshSqlServerBackups}
                                  className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-4 py-2 rounded-xl text-sm font-black"
                                  disabled={sqlServerBackupsBusy}
                                >
                                  تحديث القائمة
                                </button>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                              <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-backup-retention-days">مدة الاحتفاظ (بالأيام)</label>
                                <Input
                                  id="settings-sql-backup-retention-days"
                                  className="w-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm"
                                  type="number"
                                  min={1}
                                  max={3650}
                                  value={String(sqlBackupAuto.retentionDays)}
                                  onChange={e => setSqlBackupAuto(p => ({ ...p, retentionDays: Math.max(1, Math.min(3650, Number(e.target.value || 30) || 30)) }))}
                                  disabled={sqlBackupAutoBusy}
                                />
                              </div>

                              <div className="md:col-span-2 flex gap-2 flex-wrap">
                                <button
                                  onClick={() => saveSqlBackupAutomation({ retentionDays: sqlBackupAuto.retentionDays })}
                                  className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-5 py-2.5 rounded-xl text-sm font-black"
                                  disabled={sqlBackupAutoBusy}
                                >
                                  حفظ مدة الاحتفاظ
                                </button>
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                                  سيتم حذف أي نسخة أقدم من {sqlBackupAuto.retentionDays} يوم تلقائياً.
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 app-card">
                              <div className="max-h-[35vh] overflow-auto custom-scrollbar">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300">
                                    <tr>
                                      <th className="text-right px-4 py-3 font-black">التاريخ</th>
                                      <th className="text-right px-4 py-3 font-black">المعرف</th>
                                      <th className="text-right px-4 py-3 font-black">Rows</th>
                                      <th className="text-right px-4 py-3 font-black">ملاحظة</th>
                                      <th className="text-right px-4 py-3 font-black">إجراءات</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {sqlServerBackupsBusy && (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                                          جاري التحميل...
                                        </td>
                                      </tr>
                                    )}

                                    {!sqlServerBackupsBusy && sqlServerBackups.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                          لا توجد نسخ محفوظة على المخدم بعد.
                                        </td>
                                      </tr>
                                    )}

                                    {!sqlServerBackupsBusy && sqlServerBackups.map(b => (
                                      <tr key={b.id}>
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                          {new Date(b.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200 break-all">
                                          {String(b.id).slice(0, 8)}…
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                          {typeof b.rowCount === 'number' ? b.rowCount : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                          {b.note || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex gap-2 flex-wrap">
                                            <button
                                              onClick={() => handleRestoreServerBackup(b.id, 'merge')}
                                              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-black"
                                              disabled={sqlServerBackupsBusy}
                                              title="دمج النسخة مع بيانات المخدم (لا يحذف الموجود)"
                                            >
                                              دمج
                                            </button>
                                            <button
                                              onClick={() => handleRestoreServerBackup(b.id, 'replace')}
                                              className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-xs font-black text-red-700 dark:text-red-300"
                                              disabled={sqlServerBackupsBusy}
                                              title="استعادة كاملة (تحذف بيانات المخدم ثم تستبدلها)"
                                            >
                                              استعادة كاملة
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}

                      {window.desktopDb?.sqlGetCoverage && (
                        <div className="md:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-black">تغطية المزامنة (كل البيانات)</div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                يعرض كل مفاتيح قاعدة البيانات المحلية (db_*) ويقارنها مع المخدم.
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {window.desktopDb?.sqlPullFullNow && (
                                <button
                                  onClick={pullFullFromServer}
                                  className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/10 px-4 py-2 rounded-xl text-sm font-black"
                                  disabled={sqlBusy || sqlCoverageBusy}
                                  title="يسحب أحدث بيانات من المخدم (تصحيح حالات: المخدم أحدث)"
                                >
                                  سحب من المخدم
                                </button>
                              )}

                              {window.desktopDb?.sqlMergePublishAdmin && isSuperAdmin(user?.الدور) && (
                                <button
                                  onClick={mergePublishAdmin}
                                  className="bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-900/40 text-purple-800 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/10 px-4 py-2 rounded-xl text-sm font-black"
                                  disabled={sqlBusy || sqlCoverageBusy}
                                  title="يدمج هذه المفاتيح وينشر نسخة موحدة على المخدم لتصل لجميع الأجهزة"
                                >
                                  دمج ونشر (SuperAdmin)
                                </button>
                              )}

                              <button
                                onClick={refreshSqlCoverage}
                                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2"
                                disabled={sqlBusy || sqlCoverageBusy}
                              >
                                <RefreshCcw size={16} className={sqlCoverageBusy ? 'animate-spin' : ''} /> تحديث التغطية
                              </button>
                            </div>
                          </div>

                          {sqlCoverage && !sqlCoverage.ok && (
                            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                              {sqlCoverage.message || 'فشل فحص تغطية المزامنة'}
                            </div>
                          )}

                          {sqlCoverage?.ok && (
                            <div className="mt-4">
                              <div className="flex flex-wrap gap-2 text-xs font-black">
                                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200">
                                  مفاتيح محلية: {Number(sqlCoverage.localCount || 0)}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200">
                                  مفاتيح على المخدم: {Number(sqlCoverage.remoteCount || 0)}
                                </span>
                                {sqlCoverage.remoteOk === false && (
                                  <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                    {sqlCoverage.remoteMessage || 'تعذر قراءة بيانات المخدم'}
                                  </span>
                                )}
                              </div>

                              <div className="relative mt-4">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  value={sqlCoverageQuery}
                                  onChange={e => setSqlCoverageQuery(e.target.value)}
                                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm"
                                  placeholder="ابحث بالمفتاح أو الاسم أو الحالة..."
                                />
                              </div>

                              <div className="mt-4 app-card">
                                <div className="max-h-[45vh] overflow-auto custom-scrollbar">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300">
                                      <tr>
                                        <th className="text-right px-4 py-3 font-black">الكيان</th>
                                        <th className="text-right px-4 py-3 font-black">المفتاح</th>
                                        <th className="text-right px-4 py-3 font-black">محلي</th>
                                        <th className="text-right px-4 py-3 font-black">مخدم</th>
                                        <th className="text-right px-4 py-3 font-black">الحالة</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                      {(() => {
                                        const items = Array.isArray(sqlCoverage.items) ? sqlCoverage.items : [];
                                        const q = sqlCoverageQuery.trim().toLowerCase();
                                        const filtered = !q
                                          ? items
                                          : items.filter(it => {
                                            const key = String(it.key || '').toLowerCase();
                                            const label = String(keyLabels[it.key] || '').toLowerCase();
                                            const status = String(it.status || '').toLowerCase();
                                            return key.includes(q) || label.includes(q) || status.includes(q);
                                          });

                                        if (filtered.length === 0) {
                                          return (
                                            <tr>
                                              <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                                لا توجد نتائج.
                                              </td>
                                            </tr>
                                          );
                                        }

                                        const badge = (status: SqlCoverageItem['status']) => {
                                          const base = 'inline-flex items-center px-2 py-1 rounded-lg text-xs font-black';
                                          if (status === 'inSync') return <span className={base + ' bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300'}>متزامن</span>;
                                          if (status === 'localAhead') return <span className={base + ' bg-indigo-50 text-indigo-700 dark:bg-indigo-900/10 dark:text-indigo-300'}>محلي أحدث</span>;
                                          if (status === 'remoteAhead') return <span className={base + ' bg-amber-50 text-amber-800 dark:bg-amber-900/10 dark:text-amber-300'}>المخدم أحدث</span>;
                                          if (status === 'missingRemote') return <span className={base + ' bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300'}>غير موجود على المخدم</span>;
                                          if (status === 'missingLocal') return <span className={base + ' bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}>غير موجود محلياً</span>;
                                          if (status === 'different') return <span className={base + ' bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300'}>اختلاف</span>;
                                          return <span className={base + ' bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}>غير معروف</span>;
                                        };

                                        const fmt = (iso?: string) => {
                                          const s = String(iso || '').trim();
                                          if (!s) return '-';
                                          try {
                                            const d = new Date(s);
                                            if (Number.isNaN(d.getTime())) return s;
                                            return d.toLocaleString('en-GB');
                                          } catch {
                                            return s;
                                          }
                                        };

                                        return filtered.map(it => (
                                          <tr key={it.key} className="bg-white dark:bg-slate-900">
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                              {keyLabels[it.key] || 'بيانات النظام'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-mono text-xs whitespace-nowrap" dir="ltr">
                                              {it.key}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap" dir="ltr">
                                              {fmt(it.localBestTs)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap" dir="ltr">
                                              {fmt(it.remoteUpdatedAt)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">{badge(it.status)}</td>
                                          </tr>
                                        ));
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                ملاحظة: "محلي أحدث" يعني يوجد تغييرات لم تُرفع بعد — اضغط "مزامنة الآن".
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {window.desktopDb?.sqlProvision && (
                        <div className="md:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-black">تهيئة المخدم (للمدير)</div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                ينشئ قاعدة البيانات + جدول التخزين + حساب SQL للموظفين، ثم يحفظه للاستخدام.
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-provision-admin-user">مدير SQL (Username)</label>
                              <input
                                id="settings-sql-provision-admin-user"
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                                placeholder="sa أو admin"
                                value={sqlProvision.adminUser}
                                onChange={e => setSqlProvision(p => ({ ...p, adminUser: e.target.value }))}
                                disabled={sqlBusy}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-provision-admin-password">مدير SQL (Password)</label>
                              <input
                                id="settings-sql-provision-admin-password"
                                type="password"
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                                value={sqlProvision.adminPassword}
                                onChange={e => setSqlProvision(p => ({ ...p, adminPassword: e.target.value }))}
                                disabled={sqlBusy}
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-provision-manager-user">حساب المدير (Username)</label>
                              <input
                                id="settings-sql-provision-manager-user"
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                                value={sqlProvision.managerUser}
                                onChange={e => setSqlProvision(p => ({ ...p, managerUser: e.target.value }))}
                                disabled={sqlBusy}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-provision-manager-password">حساب المدير (Password)</label>
                              <input
                                id="settings-sql-provision-manager-password"
                                type="password"
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                                value={sqlProvision.managerPassword}
                                onChange={e => setSqlProvision(p => ({ ...p, managerPassword: e.target.value }))}
                                disabled={sqlBusy}
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-provision-employee-user">حساب الموظفين (Username)</label>
                              <input
                                id="settings-sql-provision-employee-user"
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                                value={sqlProvision.employeeUser}
                                onChange={e => setSqlProvision(p => ({ ...p, employeeUser: e.target.value }))}
                                disabled={sqlBusy}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="settings-sql-provision-employee-password">حساب الموظفين (Password)</label>
                              <input
                                id="settings-sql-provision-employee-password"
                                type="password"
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                                value={sqlProvision.employeePassword}
                                onChange={e => setSqlProvision(p => ({ ...p, employeePassword: e.target.value }))}
                                disabled={sqlBusy}
                              />
                            </div>

                            <div className="md:col-span-2 flex gap-3 flex-wrap">
                              <button
                                onClick={handleSqlProvision}
                                className="bg-emerald-600 text-white hover:bg-emerald-700 px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2"
                                disabled={sqlBusy}
                              >
                                <Shield size={16} /> تهيئة المخدم الآن
                              </button>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                                بعد التهيئة، يتم حفظ حساب الموظفين داخل النظام.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </RBACGuard>
          )}

          {!settingsLoading && activeSection === 'audit' && (
              <RBACGuard requiredPermission="SETTINGS_AUDIT" fallback={settingsNoAccessFallback}>
                  <div className="p-8 h-full flex flex-col animate-fade-in">
                  <div className="app-card flex-1 flex flex-col">
                          <div className="p-4 border-b font-bold bg-gray-50 dark:bg-slate-900 flex justify-between items-center">
                              <span>سجل تغييرات الإعدادات (آخر 20 عملية)</span>
                              <button onClick={handleExportAuditCSV} className="text-xs bg-white dark:bg-slate-800 border px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                                  <FileSpreadsheet size={14}/> تصدير CSV
                              </button>
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                              <table className="w-full text-right text-sm">
                        <thead className="app-table-thead">
                                      <tr><th className="p-4">المستخدم</th><th className="p-4">نوع الإجراء</th><th className="p-4">التفاصيل</th><th className="p-4">التاريخ</th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                      {auditLogs.map(log => (
                                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                                              <td className="p-4 font-bold text-slate-700 dark:text-white">{log.اسم_المستخدم}</td>
                                                <td className="p-4"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs border border-indigo-100">{log.نوع_العملية}</span></td>
                                              <td className="p-4 text-slate-600 dark:text-slate-300">{log.details}</td>
                                              <td className="p-4 text-xs font-mono text-slate-400">{new Date(log.تاريخ_العملية).toLocaleString()}</td>
                                          </tr>
                                      ))}
                                      {auditLogs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">لا توجد سجلات</td></tr>}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </RBACGuard>
          )}

          {!settingsLoading && activeSection === 'diagnostics' && (
            <RBACGuard requiredRole="SuperAdmin" fallback={settingsNoAccessFallback}>
              <div className="p-8 h-full flex flex-col animate-fade-in">
                <div className="max-w-4xl mx-auto w-full">
                  <div className="app-card p-6 rounded-3xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xl font-black text-slate-800 dark:text-white">التشخيص</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          يعرض آخر خطأ وسجل مختصر لآخر الأخطاء التي تم التقاطها من الواجهة (Unhandled error / unhandled promise rejection).
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
                              <pre className="mt-2 bg-white dark:bg-slate-950/40 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 overflow-auto max-h-64 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap" dir="ltr">
                                {appLastError.stack}
                              </pre>
                            )}
                            {!appLastError?.stack && (
                              <pre className="mt-2 bg-white dark:bg-slate-950/40 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 overflow-auto max-h-64 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap" dir="ltr">
                                {appLastErrorRaw}
                              </pre>
                            )}
                          </div>
                        </div>
                      )}

                      {appErrorLog.length > 0 && (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-bold text-slate-800 dark:text-white">سجل الأخطاء (آخر {appErrorLog.length})</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">يُحدَّث تلقائياً ويُقصَر إلى آخر 20 خطأ</div>
                          </div>
                          <div className="mt-3 flex flex-col gap-2">
                            {appErrorLog.map((e, idx) => (
                              <details key={String(e?.id || `${e?.at || 'na'}_${idx}`)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/30">
                                <summary className="cursor-pointer select-none px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
                                  <span className="font-bold">{e?.message || 'Unknown error'}</span>
                                  <span className="mx-2 text-slate-400">—</span>
                                  <span className="text-xs font-mono text-slate-500" dir="ltr">{e?.at || ''}</span>
                                  {e?.kind && <span className="mx-2 text-xs text-slate-400">({e.kind})</span>}
                                </summary>
                                <div className="px-3 pb-3">
                                  {e?.stack && (
                                    <pre className="mt-2 bg-white dark:bg-slate-950/40 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 overflow-auto max-h-64 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap" dir="ltr">
                                      {e.stack}
                                    </pre>
                                  )}
                                  {!e?.stack && (
                                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">لا يوجد stack.</div>
                                  )}
                                  {e?.componentStack && (
                                    <pre className="mt-2 bg-white dark:bg-slate-950/40 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 overflow-auto max-h-64 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap" dir="ltr">
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
          )}

          {!settingsLoading && activeSection === 'about' && (
              <div className="flex items-center justify-center h-full p-8 animate-fade-in bg-gray-50 dark:bg-slate-900/50">
                <div className="app-card p-8 rounded-3xl text-center max-w-md border-gray-100 dark:border-slate-700">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30 mx-auto mb-6 text-white text-3xl font-bold">
                          خ
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">نظام خبرني العقاري</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">الإصدار 3.0</p>
                      
                      <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700 leading-relaxed">
                          <p className="font-bold mb-1">© 2025 — Developed by Mahmoud Qattoush</p>
                          <p>AZRAR Real Estate Management System — All Rights Reserved</p>
                      </div>

                      <button 
                        onClick={resetOnboarding}
                        className="mt-6 flex items-center justify-center gap-2 text-indigo-600 text-xs font-bold hover:underline mx-auto"
                      >
                          <PlayCircle size={14} /> إعادة تشغيل الجولة التعليمية
                      </button>
                  </div>
              </div>
          )}

        </div>
      </div>

      {isTableModalOpen && (
        <AppModal
          open={isTableModalOpen}
          title={isEditingTable ? 'تعديل اسم الجدول' : 'إنشاء جدول جديد'}
          onClose={() => setIsTableModalOpen(false)}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveTable}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold shadow-lg"
              >
                حفظ
              </button>
            </div>
          }
        >
          {!isEditingTable && (
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1" htmlFor="settings-lookup-table-key">المعرف البرمجي (إنجليزي)</label>
              <input
                id="settings-lookup-table-key"
                className="w-full border border-gray-200 dark:border-slate-600 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 outline-none text-sm font-mono text-slate-800 dark:text-white"
                placeholder="e.g. city_list"
                value={tableForm.name}
                onChange={(e) => setTableForm({ ...tableForm, name: e.target.value.replace(/\s+/g, '_') })}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1" htmlFor="settings-lookup-table-label">الاسم الظاهر (عربي)</label>
            <input
              id="settings-lookup-table-label"
              className="w-full border border-gray-200 dark:border-slate-600 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 outline-none text-sm text-slate-800 dark:text-white"
              placeholder="مثال: قائمة المدن"
              value={tableForm.label}
              onChange={(e) => setTableForm({ ...tableForm, label: e.target.value })}
            />
          </div>
        </AppModal>
      )}
    </div>
  );
};

