import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  History,
  RefreshCcw,
  X,
  Database,
  Globe,
  Server,
  User,
  Lock,
  ShieldCheck,
  Save,
  FileArchive,
  Plus,
  Download,
  Upload,
  Layers,
  Clock,
  Info,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useSmartModal } from '@/context/ModalContext';
import { isSuperAdmin } from '@/utils/roles';
import { resolveDesktopError, resolveDesktopMessage } from '@/utils/desktopMessages';

type SqlStatus = {
  configured: boolean;
  enabled: boolean;
  connected: boolean;
  lastError?: string;
  lastSyncAt?: string;
};

type DesktopOkMessage = { ok?: boolean; message?: string; code?: string };

type DesktopSuccessMessage = {
  success?: boolean;
  message?: string;
  code?: string;
  backupDir?: string;
  archivePath?: string;
};

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
  remoteBytes?: number;
  status:
    | 'inSync'
    | 'localAhead'
    | 'remoteAhead'
    | 'missingRemote'
    | 'missingLocal'
    | 'different'
    | 'unknown';
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
  timeHHmm?: string;
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

const getErrorMessage = (error: unknown): string | undefined => {
  const msg = resolveDesktopError(error, '');
  return msg || undefined;
};

const getDesktopMessage = (res: unknown, fallback: string): string =>
  resolveDesktopMessage(res, fallback);

export const ServerSqlSection: React.FC = () => {
  const t = useCallback((s: string) => s, []);
  const {
    error: toastError,
    success: toastSuccess,
    warning: toastWarning,
    confirm: toastConfirm,
  } = useToast();
  const { user } = useAuth();
  const { openPanel } = useSmartModal();

  const isDesktop = !!window.desktopDb;

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
  const inFlightRef = useRef<Record<string, boolean>>({});

  const runGuarded = useCallback(
    async <T,>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
      if (inFlightRef.current[key]) return undefined;
      inFlightRef.current[key] = true;
      try {
        return await fn();
      } finally {
        inFlightRef.current[key] = false;
      }
    },
    []
  );

  const [sqlBackupAuto, setSqlBackupAuto] = useState<SqlBackupAutomationSettings>({
    enabled: true,
    retentionDays: 30,
  });
  const [sqlServerBackups, setSqlServerBackups] = useState<SqlServerBackupItem[]>([]);
  const [sqlServerBackupsBusy, setSqlServerBackupsBusy] = useState(false);

  const [sqlCoverage, setSqlCoverage] = useState<SqlCoverageResponse | null>(null);
  const [sqlCoverageBusy, setSqlCoverageBusy] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const keyLabels = useMemo<Record<string, string>>(
    () => ({
      db_people: 'الأشخاص',
      db_companies: 'الشركات',
      db_contacts: 'جهات الاتصال',
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
      db_sales_listings: 'عروض البيع',
      db_sales_offers: 'طلبات الشراء',
      db_sales_agreements: 'اتفاقيات البيع',
      db_ownership_history: 'سجل الملكية',
      db_blacklist: 'القائمة السوداء',
      db_dynamic_tables: 'الجداول الديناميكية',
      db_dynamic_records: 'السجلات الديناميكية',
      db_dynamic_form_fields: 'حقول النماذج',
      db_activities: 'الأنشطة',
      db_external_commissions: 'العمولات الخارجية',
      db_dashboard_config: 'إعدادات لوحة التحكم',
      db_clearance_records: 'سجلات براءة الذمة',
      db_dashboard_notes: 'ملاحظات لوحة التحكم',
      db_client_interactions: 'تفاعلات العملاء',
      db_property_inspections: 'معاينات العقارات',
    }),
    []
  );

  const refreshSqlStatus = useCallback(async () => {
    await runGuarded('sql:status', async () => {
      try {
        const st = (await window.desktopDb?.sqlStatus?.()) as unknown as SqlStatus | null;
        setSqlStatus(st || null);
      } catch {
        // ignore
      }
    });
  }, [runGuarded]);

  const loadSqlSection = useCallback(async () => {
    if (!window.desktopDb?.sqlGetSettings) {
      setSqlStatus(null);
      return;
    }
    await runGuarded('sql:loadSection', async () => {
      try {
        const s = (await window.desktopDb.sqlGetSettings()) as unknown as DesktopSqlSettings | null;
        setSqlForm((prev) => ({
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
        toastError(getErrorMessage(e) || 'فشل تحميل إعدادات المخدم');
      }
    });
  }, [toastError, runGuarded]);

  const handleSqlTest = async () => {
    if (!window.desktopDb?.sqlTestConnection) {
      toastWarning('ميزة المخدم متاحة فقط في وضع Desktop (Electron)');
      return;
    }

    await runGuarded('sql:test', async () => {
      if (sqlForm.authMode === 'sql' && !String(sqlForm.user || '').trim()) {
        toastError('اسم المستخدم مطلوب');
        return;
      }
      if (
        sqlForm.authMode === 'sql' &&
        !String(sqlForm.password || '').trim() &&
        !sqlForm.hasPassword
      ) {
        toastError('كلمة المرور مطلوبة');
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
          ...(String(sqlForm.password || '').trim() ? { password: sqlForm.password } : {}),
          encrypt: sqlForm.encrypt,
          trustServerCertificate: sqlForm.trustServerCertificate,
        })) as unknown as DesktopOkMessage | null;
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تم الاتصال بنجاح'));
        else toastError(getDesktopMessage(res, 'فشل الاتصال بالمخدم'));
      } finally {
        setSqlBusy(false);
        void refreshSqlStatus();
      }
    });
  };

  const handleSqlSaveAndConnect = async () => {
    if (!window.desktopDb?.sqlSaveSettings || !window.desktopDb?.sqlConnect) {
      toastWarning('ميزة المخدم متاحة فقط في وضع Desktop (Electron)');
      return;
    }

    await runGuarded('sql:saveAndConnect', async () => {
      if (sqlForm.enabled && sqlForm.authMode === 'sql') {
        if (!String(sqlForm.user || '').trim()) {
          toastError('اسم المستخدم مطلوب');
          return;
        }
        if (!String(sqlForm.password || '').trim() && !sqlForm.hasPassword) {
          toastError('كلمة المرور مطلوبة');
          return;
        }
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
          ...(String(sqlForm.password || '').trim() ? { password: sqlForm.password } : {}),
          encrypt: sqlForm.encrypt,
          trustServerCertificate: sqlForm.trustServerCertificate,
        })) as unknown as DesktopSuccessMessage | null;

        if (saveRes?.success === false) {
          toastError(getDesktopMessage(saveRes, 'فشل الحفظ'));
          return;
        }

        if (!sqlForm.enabled) {
          toastSuccess('تم حفظ الإعدادات (المزامنة معطلة)');
          return;
        }

        const res = (await window.desktopDb.sqlConnect()) as unknown as DesktopOkMessage | null;
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تم حفظ الإعدادات والاتصال'));
        else toastError(getDesktopMessage(res, 'فشل الاتصال بعد الحفظ'));
      } finally {
        setSqlBusy(false);
        void refreshSqlStatus();
        setSqlForm((prev) => ({ ...prev, password: '' }));
      }
    });
  };

  const handleSqlDisconnect = async () => {
    if (!window.desktopDb?.sqlDisconnect) return;
    await runGuarded('sql:disconnect', async () => {
      setSqlBusy(true);
      try {
        await window.desktopDb.sqlDisconnect();
        toastSuccess('تم قطع الاتصال بنجاح');
      } finally {
        setSqlBusy(false);
        void refreshSqlStatus();
      }
    });
  };

  const refreshSqlBackupAutomation = useCallback(async () => {
    if (!window.desktopDb?.sqlGetBackupAutomationSettings) return;
    await runGuarded('sql:backupAutoRefresh', async () => {
      try {
        const res =
          (await window.desktopDb.sqlGetBackupAutomationSettings()) as unknown as SqlBackupAutomationResponse | null;
        if (res?.ok && res?.settings) setSqlBackupAuto(res.settings);
      } catch {
        // ignore
      }
    });
  }, [runGuarded]);

  const refreshSqlServerBackups = useCallback(async () => {
    if (!window.desktopDb?.sqlListServerBackups) return;

    if (!sqlStatus || !sqlStatus.enabled) {
      setSqlServerBackups([]);
      return;
    }

    await runGuarded('sql:serverBackupsRefresh', async () => {
      setSqlServerBackupsBusy(true);
      try {
        const res = (await window.desktopDb.sqlListServerBackups({ limit: 60 })) as unknown as {
          ok: boolean;
          items?: SqlServerBackupItem[];
          message?: string;
          code?: string;
        } | null;

        if (res?.ok) {
          setSqlServerBackups(Array.isArray(res.items) ? res.items : []);
        } else {
          if (res?.code !== 'ERR_SQL_DISABLED') {
            toastError(getDesktopMessage(res, 'فشل قراءة النسخ الاحتياطية'));
          }
          setSqlServerBackups([]);
        }
      } finally {
        setSqlServerBackupsBusy(false);
      }
    });
  }, [toastError, runGuarded, sqlStatus]);

  const handleRestoreServerBackup = async (id: string, mode: 'merge' | 'replace') => {
    if (!window.desktopDb?.sqlRestoreServerBackup) {
      toastError('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }

    await runGuarded(`sql:serverBackupsRestore:${mode}`, async () => {
      if (mode === 'replace') {
        const ok = await toastConfirm({
          title: 'تأكيد الاستعادة الكاملة على المخدم',
          message:
            'سيتم حذف بيانات المخدم الحالية واستبدالها بهذه النسخة. هذه العملية خطيرة ولا يمكن التراجع عنها بسهولة. هل تريد المتابعة؟',
          confirmText: 'استعادة كاملة',
          cancelText: 'إلغاء',
          isDangerous: true,
        });
        if (!ok) return;
      }

      setSqlServerBackupsBusy(true);
      try {
        const res = (await window.desktopDb.sqlRestoreServerBackup({ id, mode })) as unknown as {
          ok: boolean;
          message: string;
        } | null;
        if (res?.ok) {
          toastSuccess(getDesktopMessage(res, 'تمت الاستعادة'));
          toastSuccess('الآن نفّذ "مزامنة الآن" على الأجهزة لسحب البيانات');
          void refreshSqlServerBackups();
        } else {
          toastError(getDesktopMessage(res, 'فشل الاستعادة'));
        }
      } finally {
        setSqlServerBackupsBusy(false);
      }
    });
  };

  const handleSqlExportServerBackup = async () => {
    if (!window.desktopDb?.sqlExportBackup) {
      toastError('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }

    await runGuarded('sql:exportBackup', async () => {
      setSqlBusy(true);
      try {
        const res =
          (await window.desktopDb.sqlExportBackup()) as unknown as DesktopOkMessage | null;
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تم إنشاء نسخة احتياطية من المخدم'));
        else toastError(getDesktopMessage(res, 'فشل إنشاء النسخة الاحتياطية من المخدم'));
      } finally {
        setSqlBusy(false);
      }
    });
  };

  const handleSqlSyncNow = async () => {
    if (!window.desktopDb?.sqlSyncNow) {
      toastError('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }

    await runGuarded('sql:syncNow', async () => {
      setSqlBusy(true);
      try {
        const res = (await window.desktopDb.sqlSyncNow()) as unknown as DesktopOkMessage | null;
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تمت المزامنة بنجاح'));
        else toastError(getDesktopMessage(res, 'فشل المزامنة'));
        void refreshSqlStatus();
      } finally {
        setSqlBusy(false);
      }
    });
  };

  const refreshSqlCoverage = useCallback(async () => {
    if (!window.desktopDb?.sqlGetCoverage) {
      toastWarning('تغطية المزامنة متاحة فقط في نسخة Desktop');
      return;
    }

    if (!sqlStatus || !sqlStatus.enabled) {
      setSqlCoverage(null);
      return;
    }

    await runGuarded('sql:coverageRefresh', async () => {
      setSqlCoverageBusy(true);
      try {
        const res =
          (await window.desktopDb.sqlGetCoverage()) as unknown as SqlCoverageResponse | null;
        setSqlCoverage(res);
        if (res && res.ok && res.remoteOk === false && res.remoteMessage) {
          toastWarning(getDesktopMessage({ message: res.remoteMessage }, res.remoteMessage));
        } else if (res && !res.ok) {
          toastError(getDesktopMessage(res, 'فشل فحص تغطية المزامنة'));
        }
      } catch (e: unknown) {
        toastError(getErrorMessage(e) || 'فشل فحص تغطية المزامنة');
      } finally {
        setSqlCoverageBusy(false);
      }
    });
  }, [toastError, toastWarning, runGuarded, sqlStatus]);

  const pullFullFromServer = async () => {
    if (!window.desktopDb?.sqlPullFullNow) {
      toastWarning('السحب متاح فقط في نسخة Desktop');
      return;
    }

    await runGuarded('sql:coveragePullFull', async () => {
      const ok = await toastConfirm({
        title: 'تأكيد السحب من المخدم',
        message:
          'سيتم سحب أحدث بيانات من المخدم وقد يؤدي ذلك لاستبدال/تعديل بيانات محلية. هل تريد الاستمرار؟',
        confirmText: 'سحب الآن',
        cancelText: 'إلغاء',
        isDangerous: true,
      });
      if (!ok) return;

      setSqlCoverageBusy(true);
      try {
        const res = (await window.desktopDb.sqlPullFullNow()) as unknown as DesktopOkMessage | null;
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تم السحب من المخدم'));
        else toastError(getDesktopMessage(res, 'فشل السحب من المخدم'));
        await refreshSqlStatus();
        await refreshSqlCoverage();
      } catch (e: unknown) {
        toastError(getErrorMessage(e) || 'فشل السحب من المخدم');
      } finally {
        setSqlCoverageBusy(false);
      }
    });
  };

  const mergePublishAdmin = async () => {
    if (!window.desktopDb?.sqlMergePublishAdmin) {
      toastWarning('الدمج/النشر متاح فقط في نسخة Desktop');
      return;
    }
    if (!isSuperAdmin(user?.الدور)) {
      toastError('هذه العملية متاحة للسوبر أدمن فقط');
      return;
    }

    await runGuarded('sql:coverageMergePublishAdmin', async () => {
      const ok = await toastConfirm({
        title: 'تأكيد الدمج والنشر (SuperAdmin)',
        message:
          'هذه العملية ستقوم بنشر نسخة موحدة من بعض بيانات الإدارة إلى المخدم لجميع الأجهزة. هل أنت متأكد؟',
        confirmText: 'تنفيذ',
        cancelText: 'إلغاء',
        isDangerous: true,
      });
      if (!ok) return;

      setSqlCoverageBusy(true);
      try {
        const allKeys = Object.keys(keyLabels);
        const res = (await window.desktopDb.sqlMergePublishAdmin({
          keys: allKeys,
          prefer: 'local',
        })) as unknown as DesktopOkMessage | null;

        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تم الدمج/النشر بنجاح'));
        else toastError(getDesktopMessage(res, 'فشل الدمج/النشر'));

        await refreshSqlStatus();
        await refreshSqlCoverage();
      } catch (e: unknown) {
        toastError(getErrorMessage(e) || 'فشل الدمج/النشر');
      } finally {
        setSqlCoverageBusy(false);
      }
    });
  };

  useEffect(() => {
    if (!isDesktop) return;
    void loadSqlSection();
  }, [isDesktop, loadSqlSection]);

  useEffect(() => {
    if (!isDesktop) return;
    void refreshSqlBackupAutomation();
    void refreshSqlServerBackups();
    void refreshSqlCoverage();
  }, [isDesktop, refreshSqlBackupAutomation, refreshSqlServerBackups, refreshSqlCoverage]);

  return (
    <div
      className="p-4 md:p-8 h-full page-transition bg-slate-50/50 dark:bg-slate-950/20"
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Main Settings Card */}
        <div className="app-card overflow-hidden">
          <div className="app-card-header flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-indigo-600 dark:bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-600/20 animate-float">
                <Database size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                  {t('إعدادات المخدم (SQL Server)')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold uppercase tracking-wider">
                  {t('إدارة الاتصال المباشر بقاعدة بيانات SQL Server للمزامنة والنسخ الاحتياطي.')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => openPanel('SQL_SYNC_LOG')}
                className="btn-secondary-modern"
                disabled={sqlBusy}
              >
                <History size={18} className="text-indigo-500" />
                <span>{t('سجل المزامنة')}</span>
              </button>
              <button
                onClick={refreshSqlStatus}
                className="btn-secondary-modern"
                disabled={sqlBusy}
              >
                <RefreshCcw
                  size={18}
                  className={sqlBusy ? 'animate-spin text-indigo-500' : 'text-indigo-500'}
                />
                <span>{t('تحديث')}</span>
              </button>
            </div>
          </div>

          <div className="app-card-body">
            {!isDesktop ? (
              <div className="p-8 rounded-[2rem] bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 flex items-center gap-5">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                  <ShieldAlert size={28} />
                </div>
                <p className="text-sm font-black">
                  {t('إعدادات المخدم والاتصال بـ SQL Server متاحة فقط في نسخة سطح المكتب.')}
                </p>
              </div>
            ) : !window.desktopDb?.sqlGetSettings ? (
              <div className="p-8 rounded-[2rem] bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-900/30 text-indigo-800 dark:text-indigo-400 flex items-center gap-5">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                  <Info size={28} />
                </div>
                <p className="text-sm font-black">
                  {t('هذه النسخة لا تحتوي بعد على ميزات الاتصال بالمخدم.')}
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {/* Connection Status Toggle */}
                <div
                  className={`p-8 rounded-[2.5rem] border-2 transition-all duration-700 ${sqlForm.enabled ? 'bg-emerald-50/40 border-emerald-500/20 dark:bg-emerald-900/10 dark:border-emerald-500/10 shadow-xl shadow-emerald-500/5' : 'bg-slate-50/50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-800'}`}
                >
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div
                        className={`p-4 rounded-2xl shadow-inner transition-colors duration-500 ${sqlForm.enabled ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                      >
                        <Globe size={28} />
                      </div>
                      <div>
                        <div className="text-xl font-black text-slate-800 dark:text-white">
                          {t('حالة المزامنة')}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">
                          {sqlForm.enabled
                            ? t('النظام يقوم بمزامنة البيانات محلياً ومع المخدم بشكل آمن.')
                            : t('المزامنة مع المخدم معطلة حالياً.')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSqlForm((p) => ({ ...p, enabled: !p.enabled }))}
                      className={`relative inline-flex h-10 w-18 items-center rounded-full transition-all duration-500 focus:outline-none ${sqlForm.enabled ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-slate-300 dark:bg-slate-700'}`}
                      disabled={sqlBusy}
                    >
                      <span
                        className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition-transform duration-500 ${sqlForm.enabled ? '-translate-x-1.5' : '-translate-x-8.5'}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Connection Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <label
                      className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em] px-2"
                      htmlFor="settings-sql-server"
                    >
                      {t('عنوان الخادم')}
                    </label>
                    <div className="relative group">
                      <Server
                        size={18}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                      />
                      <input
                        id="settings-sql-server"
                        dir="ltr"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 pr-14 pl-5 text-sm font-bold text-left outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        placeholder={t('127.0.0.1 أو اسم الخادم')}
                        value={sqlForm.server}
                        onChange={(e) => setSqlForm((p) => ({ ...p, server: e.target.value }))}
                        disabled={sqlBusy}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em] px-2"
                      htmlFor="settings-sql-port"
                    >
                      {t('المنفذ')}
                    </label>
                    <input
                      id="settings-sql-port"
                      dir="ltr"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 px-5 text-sm font-mono font-bold text-left outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      placeholder="1433"
                      value={String(sqlForm.port ?? 1433)}
                      onChange={(e) =>
                        setSqlForm((p) => ({ ...p, port: Number(e.target.value || 1433) || 1433 }))
                      }
                      disabled={sqlBusy}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label
                      className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em] px-2"
                      htmlFor="settings-sql-database"
                    >
                      {t('اسم قاعدة البيانات')}
                    </label>
                    <div className="relative group">
                      <Database
                        size={18}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                      />
                      <input
                        id="settings-sql-database"
                        dir="ltr"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 pr-14 pl-5 text-sm font-bold text-left outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        placeholder="AZRAR_DB"
                        value={sqlForm.database}
                        onChange={(e) => setSqlForm((p) => ({ ...p, database: e.target.value }))}
                        disabled={sqlBusy}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em] px-2"
                      htmlFor="settings-sql-auth-mode"
                    >
                      {t('نوع المصادقة')}
                    </label>
                    <div className="relative">
                      <select
                        id="settings-sql-auth-mode"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                        value={sqlForm.authMode}
                        onChange={(e) =>
                          setSqlForm((p) => ({
                            ...p,
                            authMode: e.target.value === 'windows' ? 'windows' : 'sql',
                          }))
                        }
                        disabled={sqlBusy}
                      >
                        <option value="sql">{t('SQL Authentication')}</option>
                        <option value="windows">{t('Windows Authentication')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <label
                      className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em] px-2"
                      htmlFor="settings-sql-username"
                    >
                      {t('اسم المستخدم')}
                    </label>
                    <div className="relative group">
                      <User
                        size={18}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                      />
                      <input
                        id="settings-sql-username"
                        dir="ltr"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 pr-14 pl-5 text-sm font-bold text-left outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        placeholder="sa"
                        value={sqlForm.user}
                        onChange={(e) => setSqlForm((p) => ({ ...p, user: e.target.value }))}
                        disabled={sqlBusy || sqlForm.authMode === 'windows'}
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <label
                      className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em] px-2"
                      htmlFor="settings-sql-password"
                    >
                      {t('كلمة المرور')}
                    </label>
                    <div className="relative group">
                      <Lock
                        size={18}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                      />
                      <input
                        id="settings-sql-password"
                        type="password"
                        dir="ltr"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 pr-14 pl-5 text-sm font-bold text-left outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        placeholder={
                          sqlForm.hasPassword ? t('•••••••• (محفوظة)') : t('أدخل كلمة المرور')
                        }
                        value={sqlForm.password}
                        onChange={(e) => setSqlForm((p) => ({ ...p, password: e.target.value }))}
                        disabled={sqlBusy || sqlForm.authMode === 'windows'}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-8 items-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${sqlForm.encrypt ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20' : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'}`}
                      >
                        {sqlForm.encrypt && <Check size={16} className="text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={sqlForm.encrypt}
                        onChange={(e) => setSqlForm((p) => ({ ...p, encrypt: e.target.checked }))}
                        disabled={sqlBusy}
                      />
                      <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                        {t('تشفير الاتصال (SSL)')}
                      </span>
                    </label>

                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${sqlForm.trustServerCertificate ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20' : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'}`}
                      >
                        {sqlForm.trustServerCertificate && (
                          <Check size={16} className="text-white" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={sqlForm.trustServerCertificate}
                        onChange={(e) =>
                          setSqlForm((p) => ({ ...p, trustServerCertificate: e.target.checked }))
                        }
                        disabled={sqlBusy}
                      />
                      <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                        {t('الثقة في شهادة الخادم')}
                      </span>
                    </label>
                  </div>

                  <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-4 pt-6">
                    <button
                      onClick={handleSqlTest}
                      className="btn-secondary-modern !px-8"
                      disabled={sqlBusy}
                    >
                      {sqlBusy ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={18} className="text-emerald-500" />
                      )}
                      <span>{t('اختبار الاتصال')}</span>
                    </button>
                    <button
                      onClick={handleSqlSaveAndConnect}
                      className="btn-primary-modern !px-10"
                      disabled={sqlBusy}
                    >
                      {sqlBusy ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Save size={18} />
                      )}
                      <span>{t('حفظ البيانات والاتصال')}</span>
                    </button>
                    <button
                      onClick={handleSqlDisconnect}
                      className="btn-secondary-modern border-rose-200 dark:border-rose-900/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 !px-8"
                      disabled={sqlBusy}
                    >
                      <X size={18} />
                      <span>{t('قطع الاتصال')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Server Backups Table Section */}
          <div className="app-card overflow-hidden flex flex-col">
            <div className="app-card-header flex items-center justify-between !p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 dark:bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                  <FileArchive size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white">
                    {t('أرشيف المخدم')}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                    {t('إدارة النسخ الاحتياطية المرفوعة')}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSqlExportServerBackup}
                className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                title={t('إنشاء نسخة احتياطية جديدة على المخدم')}
                disabled={sqlBusy}
              >
                <Plus size={24} />
              </button>
            </div>

            <div className="p-6 flex-1">
              <div className="app-table-wrapper !rounded-3xl border-none shadow-none bg-slate-50/40 dark:bg-slate-800/20">
                <div className="max-h-[450px] overflow-auto no-scrollbar">
                  <table className="app-table">
                    <thead className="app-table-thead !bg-transparent">
                      <tr>
                        <th className="app-table-th">{t('التاريخ')}</th>
                        <th className="app-table-th">{t('السجلات')}</th>
                        <th className="app-table-th text-center">{t('إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {sqlServerBackupsBusy ? (
                        <tr>
                          <td colSpan={3} className="app-table-empty">
                            <Loader2
                              className="animate-spin text-indigo-500 mx-auto mb-4"
                              size={40}
                            />
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              {t('جاري جلب القائمة...')}
                            </div>
                          </td>
                        </tr>
                      ) : sqlServerBackups.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="app-table-empty">
                            <Database
                              className="text-slate-200 dark:text-slate-800/30 mx-auto mb-4"
                              size={56}
                            />
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                              {t('لا توجد نسخ على المخدم')}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        sqlServerBackups.map((b) => (
                          <tr key={b.id} className="app-table-row group">
                            <td className="app-table-td">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                                  {new Date(b.createdAt).toLocaleDateString('ar-JO', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                  })}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold tracking-tight">
                                  {new Date(b.createdAt).toLocaleTimeString('ar-JO', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </td>
                            <td className="app-table-td">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-100/50 dark:border-indigo-800/50 shadow-sm">
                                  {b.rowCount?.toLocaleString() || '0'}
                                </span>
                              </div>
                            </td>
                            <td className="app-table-td">
                              <div className="flex justify-center gap-2.5 opacity-0 group-hover:opacity-100 transition-all duration-500">
                                <button
                                  onClick={() => handleRestoreServerBackup(b.id, 'merge')}
                                  className="app-table-action-btn-primary !text-[10px] font-black !px-5 !py-2"
                                >
                                  {t('دمج')}
                                </button>
                                <button
                                  onClick={() => handleRestoreServerBackup(b.id, 'replace')}
                                  className="app-table-action-btn-danger !text-[10px] font-black !px-5 !py-2"
                                >
                                  {t('استبدال')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Coverage & Tools Section */}
          <div className="space-y-10">
            <div className="app-card !p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-emerald-600 dark:bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white">
                    {t('أدوات التغطية والمزامنة')}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                    {t('تحكم كامل في تدفق البيانات')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <button
                  onClick={handleSqlSyncNow}
                  className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-500 group"
                  disabled={sqlBusy}
                >
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl text-indigo-600 dark:text-indigo-400 shadow-xl group-hover:scale-110 transition-transform duration-500">
                      <RefreshCcw size={24} />
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-slate-800 dark:text-white">
                        {t('مزامنة فورية')}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1">
                        {t('إرسال واستقبال التعديلات المعلقة الآن.')}
                      </div>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-400 group-hover:translate-x-[-8px] transition-all">
                    <ArrowRight size={20} />
                  </div>
                </button>

                <button
                  onClick={pullFullFromServer}
                  className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-500 group"
                  disabled={sqlBusy || sqlCoverageBusy}
                >
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl text-blue-600 dark:text-blue-400 shadow-xl group-hover:scale-110 transition-transform duration-500">
                      <Download size={24} />
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-slate-800 dark:text-white">
                        {t('سحب كامل من المخدم')}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1">
                        {t('تحميل كافة البيانات من المخدم للجهاز الحالي.')}
                      </div>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-400 group-hover:translate-x-[-8px] transition-all">
                    <ArrowRight size={20} />
                  </div>
                </button>

                {isSuperAdmin(user?.الدور) && (
                  <button
                    onClick={mergePublishAdmin}
                    className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all duration-500 group"
                    disabled={sqlBusy || sqlCoverageBusy}
                  >
                    <div className="flex items-center gap-5">
                      <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl text-white group-hover:scale-110 transition-transform duration-500">
                        <Upload size={24} />
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-white">
                          {t('نشر موحد (سوبر أدمن)')}
                        </div>
                        <div className="text-[11px] text-indigo-100/70 font-bold mt-1">
                          {t('نشر إعدادات الإدارة لجميع الأجهزة.')}
                        </div>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:translate-x-[-8px] transition-all">
                      <ArrowRight size={20} />
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Automation Status Tip */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-500/30 relative overflow-hidden group">
              <div className="absolute -right-16 -bottom-16 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000">
                <ShieldCheck size={240} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-5">
                  <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                    <Clock size={28} />
                  </div>
                  <h5 className="text-2xl font-black">{t('النسخ التلقائي')}</h5>
                </div>
                <p className="text-base text-indigo-50/90 font-medium leading-relaxed max-w-[85%]">
                  {sqlBackupAuto?.enabled
                    ? t(
                        'النظام مبرمج ليقوم بعمل نسخة احتياطية يومية من المخدم لضمان أقصى درجات الأمان لبياناتك.'
                      )
                    : t(
                        'النسخ التلقائي للمخدم غير مفعل حالياً. نوصي بشدة بتفعيله لتجنب أي فقدان محتمل للبيانات.'
                      )}
                </p>
                <div className="mt-8">
                  <span
                    className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${sqlBackupAuto?.enabled ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'}`}
                  >
                    {sqlBackupAuto?.enabled ? t('الحالة: مفعل') : t('الحالة: معطل')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Coverage Table Section (Full Width) */}
        {sqlCoverage && (
          <div className="app-card overflow-hidden">
            <div className="app-card-header flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-emerald-600 dark:bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                  <Layers size={28} />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-800 dark:text-white">
                    {t('تغطية المزامنة التفصيلية')}
                  </h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-2">
                    {t('مقارنة حالة البيانات المحلية مع المخدم لكل جدول.')}
                  </p>
                </div>
              </div>
              <button
                onClick={refreshSqlCoverage}
                className="btn-secondary-modern"
                disabled={sqlCoverageBusy}
              >
                <RefreshCcw
                  size={20}
                  className={sqlCoverageBusy ? 'animate-spin text-indigo-500' : 'text-indigo-500'}
                />
              </button>
            </div>

            <div className="app-card-body">
              <div className="app-table-wrapper !rounded-3xl border-none shadow-none bg-slate-50/30 dark:bg-slate-800/20">
                <table className="app-table">
                  <thead className="app-table-thead !bg-transparent">
                    <tr>
                      <th className="app-table-th">{t('الجدول')}</th>
                      <th className="app-table-th">{t('الحالة')}</th>
                      <th className="app-table-th">{t('محلي')}</th>
                      <th className="app-table-th">{t('المخدم')}</th>
                      <th className="app-table-th text-center">{t('آخر تحديث')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {sqlCoverage.items?.map((item: SqlCoverageItem) => (
                      <tr key={item.key} className="app-table-row group">
                        <td className="app-table-td">
                          <div className="flex flex-col gap-1">
                            <span className="text-base font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {keyLabels[item.key] || item.key}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono font-bold tracking-tighter uppercase">
                              {item.key}
                            </span>
                          </div>
                        </td>
                        <td className="app-table-td">
                          <span
                            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight shadow-sm border ${
                              item.status === 'inSync'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : item.status === 'localAhead'
                                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                  : item.status === 'remoteAhead'
                                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.status === 'inSync'
                                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                                  : item.status === 'localAhead'
                                    ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                                    : item.status === 'remoteAhead'
                                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                      : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                              }`}
                            />
                            {item.status === 'inSync'
                              ? t('متزامن')
                              : item.status === 'localAhead'
                                ? t('محلي أحدث')
                                : item.status === 'remoteAhead'
                                  ? t('مخدم أحدث')
                                  : t('غير متطابق')}
                          </span>
                        </td>
                        <td className="app-table-td">
                          <span className="font-mono text-xs font-black text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                            {formatSize(item.localBytes)}
                          </span>
                        </td>
                        <td className="app-table-td">
                          <span className="font-mono text-xs font-black text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                            {formatSize(item.remoteBytes || 0)}
                          </span>
                        </td>
                        <td className="app-table-td text-center">
                          <div className="font-mono text-[10px] text-slate-500 font-bold bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            {item.localUpdatedAt
                              ? new Date(item.localUpdatedAt).toLocaleString('ar-JO', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : '-'}
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
      </div>
    </div>
  );
};
