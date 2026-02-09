import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, History, RefreshCcw, Search, Shield, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useSmartModal } from '@/context/ModalContext';
import { isSuperAdmin } from '@/utils/roles';
import { useDbSignal } from '@/hooks/useDbSignal';
import { tableLabel } from '@/utils/auditLabels';
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
  const { t } = useTranslation();
  const {
    error: toastError,
    success: toastSuccess,
    warning: toastWarning,
    confirm: toastConfirm,
  } = useToast();
  const { user } = useAuth();
  const { openPanel } = useSmartModal();
  const dbSignal = useDbSignal();

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
  const [sqlBackupAutoBusy, setSqlBackupAutoBusy] = useState(false);
  const [sqlServerBackups, setSqlServerBackups] = useState<SqlServerBackupItem[]>([]);
  const [sqlServerBackupsBusy, setSqlServerBackupsBusy] = useState(false);

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

  const entityLabel = useCallback((keyRaw: unknown) => {
    const key = String(keyRaw ?? '').trim();
    if (!key) return 'بيانات النظام';
    return key.startsWith('db_') ? tableLabel(key) : 'بيانات النظام';
  }, []);

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
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تم الاتصال'));
        else toastError(getDesktopMessage(res, 'فشل الاتصال'));
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
          toastSuccess('تم حفظ الإعدادات (المزامنة غير مفعلة)');
          return;
        }

        const res = (await window.desktopDb.sqlConnect()) as unknown as DesktopOkMessage | null;
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تم الاتصال'));
        else toastError(getDesktopMessage(res, 'فشل الاتصال'));
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
        toastSuccess('تم قطع الاتصال');
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

  const saveSqlBackupAutomation = async (next: Partial<SqlBackupAutomationSettings>) => {
    if (!window.desktopDb?.sqlSaveBackupAutomationSettings) return;
    await runGuarded('sql:backupAutoSave', async () => {
      setSqlBackupAutoBusy(true);
      try {
        const res = (await window.desktopDb.sqlSaveBackupAutomationSettings(
          next
        )) as unknown as SqlBackupAutomationResponse | null;
        if (res?.ok && res?.settings) {
          setSqlBackupAuto(res.settings);
          toastSuccess('تم حفظ إعدادات النسخ الاحتياطي');
        } else {
          toastError(getDesktopMessage(res, 'فشل حفظ إعدادات النسخ الاحتياطي'));
        }
      } finally {
        setSqlBackupAutoBusy(false);
      }
    });
  };

  const refreshSqlServerBackups = useCallback(async () => {
    if (!window.desktopDb?.sqlListServerBackups) return;
    await runGuarded('sql:serverBackupsRefresh', async () => {
      setSqlServerBackupsBusy(true);
      try {
        const res = (await window.desktopDb.sqlListServerBackups({ limit: 60 })) as unknown as {
          ok: boolean;
          items?: SqlServerBackupItem[];
          message?: string;
        } | null;
        if (res?.ok) setSqlServerBackups(Array.isArray(res.items) ? res.items : []);
        else toastError(getDesktopMessage(res, 'فشل قراءة النسخ الاحتياطية'));
      } finally {
        setSqlServerBackupsBusy(false);
      }
    });
  }, [toastError, runGuarded]);

  const handleCreateServerBackupNow = async () => {
    if (!window.desktopDb?.sqlCreateServerBackup) {
      toastError('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }

    await runGuarded('sql:serverBackupsCreateNow', async () => {
      setSqlServerBackupsBusy(true);
      try {
        const res = (await window.desktopDb.sqlCreateServerBackup({
          note: 'manual',
        })) as unknown as {
          ok: boolean;
          message: string;
          deletedOld?: number;
        } | null;
        if (res?.ok) {
          toastSuccess(getDesktopMessage(res, 'تم رفع نسخة احتياطية إلى المخدم'));
          if (typeof res?.deletedOld === 'number' && res.deletedOld > 0) {
            toastSuccess(
              `تم حذف ${res.deletedOld} نسخة قديمة (احتفاظ ${sqlBackupAuto.retentionDays} يوم)`
            );
          }
          void refreshSqlServerBackups();
        } else {
          toastError(getDesktopMessage(res, 'فشل رفع النسخة الاحتياطية'));
        }
      } finally {
        setSqlServerBackupsBusy(false);
      }
    });
  };

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

  const handleSqlImportServerBackup = async () => {
    if (!window.desktopDb?.sqlImportBackup) {
      toastError('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }

    await runGuarded('sql:importBackup', async () => {
      setSqlBusy(true);
      try {
        const res =
          (await window.desktopDb.sqlImportBackup()) as unknown as DesktopOkMessage | null;
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تم استيراد النسخة الاحتياطية'));
        else toastError(getDesktopMessage(res, 'فشل استيراد النسخة الاحتياطية'));
        void refreshSqlStatus();
      } finally {
        setSqlBusy(false);
      }
    });
  };

  const handleSqlRestoreServerBackup = async () => {
    if (!window.desktopDb?.sqlRestoreBackup) {
      toastError('هذه الميزة غير متاحة في هذه النسخة');
      return;
    }

    await runGuarded('sql:restoreBackupFull', async () => {
      const ok = await toastConfirm({
        title: 'تأكيد الاستعادة الكاملة',
        message:
          'سيتم استبدال البيانات المحلية بالكامل من ملف النسخة الاحتياطية. تأكد أنك تملك نسخة احتياطية قبل المتابعة. هل تريد الاستمرار؟',
        confirmText: 'استعادة كاملة',
        cancelText: 'إلغاء',
        isDangerous: true,
      });
      if (!ok) return;

      setSqlBusy(true);
      try {
        const res =
          (await window.desktopDb.sqlRestoreBackup()) as unknown as DesktopOkMessage | null;
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تمت الاستعادة الكاملة'));
        else toastError(getDesktopMessage(res, 'فشل الاستعادة الكاملة'));
        void refreshSqlStatus();
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
        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تمت المزامنة'));
        else toastError(getDesktopMessage(res, 'فشل المزامنة'));
        void refreshSqlStatus();
      } finally {
        setSqlBusy(false);
      }
    });
  };

  const handleSqlProvision = async () => {
    if (!window.desktopDb?.sqlProvision) {
      toastWarning('ميزة تهيئة المخدم متاحة فقط في وضع Desktop (Electron)');
      return;
    }

    await runGuarded('sql:provision', async () => {
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
          toastSuccess(getDesktopMessage(res, 'تمت تهيئة المخدم'));
          const s =
            (await window.desktopDb.sqlGetSettings?.()) as unknown as DesktopSqlSettings | null;
          if (s) {
            setSqlForm((prev) => ({
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
          setSqlProvision((p) => ({
            ...p,
            adminPassword: '',
            managerPassword: '',
            employeePassword: '',
          }));
        } else {
          toastError(getDesktopMessage(res, 'فشل تهيئة المخدم'));
        }
      } finally {
        setSqlBusy(false);
        void refreshSqlStatus();
      }
    });
  };

  const refreshSqlCoverage = async () => {
    if (!window.desktopDb?.sqlGetCoverage) {
      toastWarning('تغطية المزامنة متاحة فقط في نسخة Desktop');
      return;
    }

    await runGuarded('sql:coverageRefresh', async () => {
      setSqlCoverageBusy(true);
      try {
        const res =
          (await window.desktopDb.sqlGetCoverage()) as unknown as SqlCoverageResponse | null;
        setSqlCoverage(res ?? null);
        if (res && res.ok && res.remoteOk === false && res.remoteMessage) {
          toastWarning(getDesktopMessage({ message: res.remoteMessage }, res.remoteMessage));
        }
      } catch (e: unknown) {
        toastError(getErrorMessage(e) || 'فشل فحص تغطية المزامنة');
      } finally {
        setSqlCoverageBusy(false);
      }
    });
  };

  const pullFullFromServer = async () => {
    if (!window.desktopDb?.sqlPullFullNow) {
      toastWarning('السحب متاح فقط في نسخة Desktop');
      return;
    }

    await runGuarded('sql:coveragePullFull', async () => {
      const ok = await toastConfirm({
        title: 'تأكيد السحب من المخدم',
        message:
          'سيتم سحب أحدث بيانات من المخدم وقد يؤدي ذلك لاستبدال/تعديل بيانات محلية. يُفضّل تنفيذ نسخة احتياطية قبل المتابعة. هل تريد الاستمرار؟',
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
          'هذه العملية ستقوم بنشر نسخة موحدة من بعض بيانات الإدارة إلى المخدم وقد تؤثر على أجهزة أخرى. هل أنت متأكد؟',
        confirmText: 'تنفيذ',
        cancelText: 'إلغاء',
        isDangerous: true,
      });
      if (!ok) return;

      setSqlCoverageBusy(true);
      try {
        const res = (await window.desktopDb.sqlMergePublishAdmin({
          keys: [
            'db_users',
            'db_user_permissions',
            'db_roles',
            'db_lookup_categories',
            'db_lookups',
            'db_legal_templates',
          ],
          prefer: 'local',
        })) as unknown as DesktopOkMessage | null;

        if (res?.ok) toastSuccess(getDesktopMessage(res, 'تم الدمج/النشر'));
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
  }, [isDesktop, loadSqlSection, dbSignal]);

  useEffect(() => {
    if (!isDesktop) return;
    void refreshSqlBackupAutomation();
    void refreshSqlServerBackups();
  }, [isDesktop, refreshSqlBackupAutomation, refreshSqlServerBackups]);

  return (
    <div className="p-8 h-full animate-fade-in">
      <div className="max-w-4xl mx-auto app-card p-6 rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">
              {t('إعدادات المخدم (SQL Server)')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t(
                'عند الضغط على اتصال سيتم إنشاء قاعدة البيانات/الجدول تلقائياً إذا كانت الصلاحيات تسمح.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openPanel('SQL_SYNC_LOG')}
              className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
              disabled={sqlBusy}
              title={t('عرض كل ما تم مزامنته أو حذفه')}
            >
              <History size={16} /> {t('سجل المزامنة')}
            </button>
            <button
              onClick={refreshSqlStatus}
              className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
              disabled={sqlBusy}
            >
              <RefreshCcw size={16} /> {t('تحديث الحالة')}
            </button>
          </div>
        </div>

        {!isDesktop && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            {t('إعدادات المخدم متاحة فقط في نسخة Desktop.')}
          </div>
        )}

        {isDesktop && !window.desktopDb?.sqlGetSettings && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            {t('هذه النسخة لا تحتوي بعد على ميزات المخدم.')}
          </div>
        )}

        {isDesktop && window.desktopDb?.sqlGetSettings && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              <div>
                <div className="font-bold">{t('تفعيل المزامنة مع المخدم')}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('سيتم الحفظ محلياً + إرسال نسخة محمية إلى SQL Server')}
                </div>
              </div>
              <button
                onClick={() => setSqlForm((p) => ({ ...p, enabled: !p.enabled }))}
                className={`px-4 py-2 rounded-xl text-sm font-black ${sqlForm.enabled ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600'}`}
                disabled={sqlBusy}
              >
                {sqlForm.enabled ? t('مفعل') : t('غير مفعل')}
              </button>
            </div>

            <div>
              <label
                className="text-xs font-bold text-slate-600 dark:text-slate-300"
                htmlFor="settings-sql-server"
              >
                {t('الخادم')}
              </label>
              <input
                id="settings-sql-server"
                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                placeholder={t('مثال: 192.168.1.10 أو SQLSERVER\\INSTANCE')}
                value={sqlForm.server}
                onChange={(e) => setSqlForm((p) => ({ ...p, server: e.target.value }))}
                disabled={sqlBusy}
              />
            </div>

            <div>
              <label
                className="text-xs font-bold text-slate-600 dark:text-slate-300"
                htmlFor="settings-sql-port"
              >
                {t('المنفذ')}
              </label>
              <input
                id="settings-sql-port"
                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                placeholder="1433"
                value={String(sqlForm.port ?? 1433)}
                onChange={(e) =>
                  setSqlForm((p) => ({ ...p, port: Number(e.target.value || 1433) || 1433 }))
                }
                disabled={sqlBusy}
              />
            </div>

            <div>
              <label
                className="text-xs font-bold text-slate-600 dark:text-slate-300"
                htmlFor="settings-sql-database"
              >
                {t('قاعدة البيانات')}
              </label>
              <input
                id="settings-sql-database"
                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                placeholder="AZRAR"
                value={sqlForm.database}
                onChange={(e) => setSqlForm((p) => ({ ...p, database: e.target.value }))}
                disabled={sqlBusy}
              />
            </div>

            <div>
              <label
                className="text-xs font-bold text-slate-600 dark:text-slate-300"
                htmlFor="settings-sql-auth-mode"
              >
                {t('نوع الدخول')}
              </label>
              <select
                id="settings-sql-auth-mode"
                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                value={sqlForm.authMode}
                onChange={(e) =>
                  setSqlForm((p) => ({
                    ...p,
                    authMode: e.target.value === 'windows' ? 'windows' : 'sql',
                  }))
                }
                disabled={sqlBusy}
              >
                <option value="sql">{t('تسجيل دخول SQL')}</option>
                <option value="windows">{t('مصادقة ويندوز')}</option>
              </select>
              {sqlForm.authMode === 'windows' && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2">
                  {t('مصادقة ويندوز غير مدعومة حالياً داخل التطبيق. استخدم تسجيل دخول SQL.')}
                </div>
              )}
            </div>

            <div>
              <label
                className="text-xs font-bold text-slate-600 dark:text-slate-300"
                htmlFor="settings-sql-username"
              >
                {t('اسم المستخدم')}
              </label>
              <input
                id="settings-sql-username"
                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                placeholder={t('sa أو user')}
                value={sqlForm.user}
                onChange={(e) => setSqlForm((p) => ({ ...p, user: e.target.value }))}
                disabled={sqlBusy || sqlForm.authMode === 'windows'}
              />
            </div>

            <div className="md:col-span-2">
              <label
                className="text-xs font-bold text-slate-600 dark:text-slate-300"
                htmlFor="settings-sql-password"
              >
                {t('كلمة المرور')}
              </label>
              <input
                id="settings-sql-password"
                type="password"
                className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                placeholder={
                  sqlForm.hasPassword
                    ? t('•••••• (محفوظة) - اكتب لتغييرها')
                    : t('ادخل كلمة المرور')
                }
                value={sqlForm.password}
                onChange={(e) => setSqlForm((p) => ({ ...p, password: e.target.value }))}
                disabled={sqlBusy || sqlForm.authMode === 'windows'}
              />
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sqlForm.encrypt}
                  onChange={(e) => setSqlForm((p) => ({ ...p, encrypt: e.target.checked }))}
                  disabled={sqlBusy}
                />
                <span>{t('تشفير الاتصال')}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sqlForm.trustServerCertificate}
                  onChange={(e) =>
                    setSqlForm((p) => ({ ...p, trustServerCertificate: e.target.checked }))
                  }
                  disabled={sqlBusy}
                />
                <span>{t('الثقة في شهادة الخادم')}</span>
              </label>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSqlTest}
                className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2"
                disabled={sqlBusy}
              >
                <Check size={16} /> {t('اختبار الاتصال')}
              </button>
              <button
                type="button"
                onClick={handleSqlSaveAndConnect}
                className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2"
                disabled={sqlBusy}
              >
                <ArrowRight size={16} /> {t('حفظ ثم اتصال')}
              </button>
              <button
                type="button"
                onClick={handleSqlDisconnect}
                className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2"
                disabled={sqlBusy}
              >
                <X size={16} /> {t('قطع الاتصال')}
              </button>
            </div>

            <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              <div className="text-sm font-black">{t('الحالة')}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                <span
                  className={
                    (sqlStatus?.connected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200') +
                    ' px-3 py-1 rounded-full'
                  }
                >
                  {sqlStatus?.connected ? t('متصل بالمخدم') : t('غير متصل')}
                </span>
                <span
                  className={
                    (sqlStatus?.enabled
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200') +
                    ' px-3 py-1 rounded-full'
                  }
                >
                  {sqlStatus?.enabled ? t('المزامنة مفعلة') : t('المزامنة غير مفعلة')}
                </span>
              </div>
              {sqlStatus?.lastSyncAt && (
                <div className="mt-2 text-xs text-slate-500">
                  {t('آخر مزامنة:')} {new Date(sqlStatus.lastSyncAt).toLocaleString('ar-JO')}
                </div>
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
                    {t('نسخ احتياطي من المخدم')}
                  </button>

                  {window.desktopDb?.sqlImportBackup && (
                    <button
                      onClick={handleSqlImportServerBackup}
                      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-5 py-2.5 rounded-xl text-sm font-black"
                      disabled={sqlBusy}
                    >
                      {t('استيراد (دمج)')}
                    </button>
                  )}

                  {window.desktopDb?.sqlRestoreBackup && (
                    <button
                      onClick={handleSqlRestoreServerBackup}
                      className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-5 py-2.5 rounded-xl text-sm font-black text-red-700 dark:text-red-300"
                      disabled={sqlBusy}
                    >
                      {t('استعادة كاملة')}
                    </button>
                  )}

                  {window.desktopDb?.sqlSyncNow && (
                    <button
                      onClick={handleSqlSyncNow}
                      className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-sm font-black"
                      disabled={sqlBusy}
                    >
                      {t('مزامنة الآن')}
                    </button>
                  )}

                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t('يتم حفظ ملف JSON على هذا الجهاز (لقطة من جدول KvStore).')}
                  </div>
                </div>
              )}
            </div>

            {window.desktopDb?.sqlGetBackupAutomationSettings && (
              <div className="md:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-black">{t('النسخ الاحتياطي اليومي على المخدم')}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'يتم إنشاء نسخة واحدة كل يوم على SQL Server (تخزين على المخدم) + حذف الأقدم من مدة الاحتفاظ.'
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => saveSqlBackupAutomation({ enabled: !sqlBackupAuto.enabled })}
                      className={`px-4 py-2 rounded-xl text-sm font-black ${sqlBackupAuto.enabled ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600'}`}
                      disabled={sqlBackupAutoBusy}
                      title={t('تشغيل/إيقاف النسخ اليومي')}
                    >
                      {sqlBackupAuto.enabled ? t('مفعل') : t('غير مفعل')}
                    </button>

                    <button
                      onClick={handleCreateServerBackupNow}
                      className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl text-sm font-black"
                      disabled={sqlServerBackupsBusy || sqlBusy}
                      title={t('رفع نسخة الآن إلى المخدم')}
                    >
                      {t('إنشاء نسخة الآن')}
                    </button>

                    <button
                      onClick={refreshSqlServerBackups}
                      className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-4 py-2 rounded-xl text-sm font-black"
                      disabled={sqlServerBackupsBusy}
                    >
                      {t('تحديث القائمة')}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label
                      className="text-xs font-bold text-slate-600 dark:text-slate-300"
                      htmlFor="settings-sql-backup-retention-days"
                    >
                      {t('مدة الاحتفاظ (بالأيام)')}
                    </label>
                    <input
                      id="settings-sql-backup-retention-days"
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm"
                      type="number"
                      min={1}
                      max={3650}
                      value={String(sqlBackupAuto.retentionDays)}
                      onChange={(e) =>
                        setSqlBackupAuto((p) => ({
                          ...p,
                          retentionDays: Math.max(
                            1,
                            Math.min(3650, Number(e.target.value || 30) || 30)
                          ),
                        }))
                      }
                      disabled={sqlBackupAutoBusy}
                    />
                  </div>

                  <div className="md:col-span-2 flex gap-2 flex-wrap">
                    <button
                      onClick={() =>
                        saveSqlBackupAutomation({ retentionDays: sqlBackupAuto.retentionDays })
                      }
                      className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 px-5 py-2.5 rounded-xl text-sm font-black"
                      disabled={sqlBackupAutoBusy}
                    >
                      {t('حفظ مدة الاحتفاظ')}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                      {t('سيتم حذف أي نسخة أقدم من')} {sqlBackupAuto.retentionDays}{' '}
                      {t('يوم تلقائياً.')}
                    </div>
                  </div>
                </div>

                <div className="mt-4 app-card">
                  <div className="max-h-[35vh] overflow-auto custom-scrollbar">
                    <table className="w-full text-sm table-fixed min-w-[900px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="text-right px-4 py-3 font-black">{t('التاريخ')}</th>
                          <th className="text-right px-4 py-3 font-black">{t('المعرف')}</th>
                          <th className="text-right px-4 py-3 font-black">{t('عدد الصفوف')}</th>
                          <th className="text-right px-4 py-3 font-black">{t('ملاحظة')}</th>
                          <th className="text-right px-4 py-3 font-black">{t('إجراءات')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {sqlServerBackupsBusy && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                            >
                              {t('جاري التحميل...')}
                            </td>
                          </tr>
                        )}

                        {!sqlServerBackupsBusy && sqlServerBackups.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                            >
                              {t('لا توجد نسخ محفوظة على المخدم بعد.')}
                            </td>
                          </tr>
                        )}

                        {!sqlServerBackupsBusy &&
                          sqlServerBackups.map((b) => (
                            <tr key={b.id}>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                {new Date(b.createdAt).toLocaleString('ar-JO')}
                              </td>
                              <td
                                className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200 whitespace-normal break-all"
                                dir="ltr"
                              >
                                {String(b.id)}
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                {typeof b.rowCount === 'number' ? b.rowCount : '-'}
                              </td>
                              <td
                                className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-normal break-words"
                                dir="auto"
                              >
                                {b.note || '-'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2 flex-wrap">
                                  <button
                                    onClick={() => handleRestoreServerBackup(b.id, 'merge')}
                                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-black"
                                    disabled={sqlServerBackupsBusy}
                                    title={t('دمج النسخة مع بيانات المخدم (لا يحذف الموجود)')}
                                  >
                                    {t('دمج')}
                                  </button>
                                  <button
                                    onClick={() => handleRestoreServerBackup(b.id, 'replace')}
                                    className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-xs font-black text-red-700 dark:text-red-300"
                                    disabled={sqlServerBackupsBusy}
                                    title={t('استعادة كاملة (تحذف بيانات المخدم ثم تستبدلها)')}
                                  >
                                    {t('استعادة كاملة')}
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
                    <div className="text-sm font-black">{t('تغطية المزامنة (كل البيانات)')}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t('يعرض كل مفاتيح قاعدة البيانات المحلية (db_*) ويقارنها مع المخدم.')}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {window.desktopDb?.sqlPullFullNow && (
                      <button
                        onClick={pullFullFromServer}
                        className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/10 px-4 py-2 rounded-xl text-sm font-black"
                        disabled={sqlBusy || sqlCoverageBusy}
                        title={t('يسحب أحدث بيانات من المخدم (تصحيح حالات: المخدم أحدث)')}
                      >
                        {t('سحب من المخدم')}
                      </button>
                    )}

                    {window.desktopDb?.sqlMergePublishAdmin && isSuperAdmin(user?.الدور) && (
                      <button
                        onClick={mergePublishAdmin}
                        className="bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-900/40 text-purple-800 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/10 px-4 py-2 rounded-xl text-sm font-black"
                        disabled={sqlBusy || sqlCoverageBusy}
                        title={t('يدمج هذه المفاتيح وينشر نسخة موحدة على المخدم لتصل لجميع الأجهزة')}
                      >
                        {t('دمج ونشر (SuperAdmin)')}
                      </button>
                    )}

                    <button
                      onClick={refreshSqlCoverage}
                      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2"
                      disabled={sqlBusy || sqlCoverageBusy}
                    >
                      <RefreshCcw size={16} className={sqlCoverageBusy ? 'animate-spin' : ''} />{' '}
                      {t('تحديث التغطية')}
                    </button>
                  </div>
                </div>

                {sqlCoverage && !sqlCoverage.ok && (
                  <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {sqlCoverage.message || t('فشل فحص تغطية المزامنة')}
                  </div>
                )}

                {sqlCoverage?.ok && (
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2 text-xs font-black">
                      <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200">
                        {t('مفاتيح محلية:')} {Number(sqlCoverage.localCount || 0)}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200">
                        {t('مفاتيح على المخدم:')} {Number(sqlCoverage.remoteCount || 0)}
                      </span>
                      {sqlCoverage.remoteOk === false && (
                        <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          {sqlCoverage.remoteMessage || t('تعذر قراءة بيانات المخدم')}
                        </span>
                      )}
                    </div>

                    <div className="relative mt-4">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={sqlCoverageQuery}
                        onChange={(e) => setSqlCoverageQuery(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm"
                        placeholder={t('ابحث بالمفتاح أو الاسم أو الحالة...')}
                      />
                    </div>

                    <div className="mt-4 app-card">
                      <div className="max-h-[45vh] overflow-auto custom-scrollbar">
                        <table className="w-full text-sm table-fixed min-w-[980px]">
                          <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300">
                            <tr>
                              <th className="text-right px-4 py-3 font-black">{t('الكيان')}</th>
                              <th className="text-right px-4 py-3 font-black">{t('المفتاح')}</th>
                              <th className="text-right px-4 py-3 font-black">{t('محلي')}</th>
                              <th className="text-right px-4 py-3 font-black">{t('مخدم')}</th>
                              <th className="text-right px-4 py-3 font-black">{t('الحالة')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {(() => {
                              const items = Array.isArray(sqlCoverage.items)
                                ? sqlCoverage.items
                                : [];
                              const q = sqlCoverageQuery.trim().toLowerCase();
                              const filtered = !q
                                ? items
                                : items.filter((it) => {
                                    const key = String(it.key || '').toLowerCase();
                                    const label = String(entityLabel(it.key) || '').toLowerCase();
                                    const status = String(it.status || '').toLowerCase();
                                    return (
                                      key.includes(q) || label.includes(q) || status.includes(q)
                                    );
                                  });

                              if (filtered.length === 0) {
                                return (
                                  <tr>
                                    <td
                                      colSpan={5}
                                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                                    >
                                      {t('لا توجد نتائج.')}
                                    </td>
                                  </tr>
                                );
                              }

                              const badge = (status: SqlCoverageItem['status']) => {
                                const base =
                                  'inline-flex items-center px-2 py-1 rounded-lg text-xs font-black';
                                if (status === 'inSync')
                                  return (
                                    <span
                                      className={
                                        base +
                                        ' bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300'
                                      }
                                    >
                                      {t('متزامن')}
                                    </span>
                                  );
                                if (status === 'localAhead')
                                  return (
                                    <span
                                      className={
                                        base +
                                        ' bg-indigo-50 text-indigo-700 dark:bg-indigo-900/10 dark:text-indigo-300'
                                      }
                                    >
                                      {t('محلي أحدث')}
                                    </span>
                                  );
                                if (status === 'remoteAhead')
                                  return (
                                    <span
                                      className={
                                        base +
                                        ' bg-amber-50 text-amber-800 dark:bg-amber-900/10 dark:text-amber-300'
                                      }
                                    >
                                      {t('المخدم أحدث')}
                                    </span>
                                  );
                                if (status === 'missingRemote')
                                  return (
                                    <span
                                      className={
                                        base +
                                        ' bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300'
                                      }
                                    >
                                      {t('غير موجود على المخدم')}
                                    </span>
                                  );
                                if (status === 'missingLocal')
                                  return (
                                    <span
                                      className={
                                        base +
                                        ' bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                      }
                                    >
                                      {t('غير موجود محلياً')}
                                    </span>
                                  );
                                if (status === 'different')
                                  return (
                                    <span
                                      className={
                                        base +
                                        ' bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300'
                                      }
                                    >
                                      {t('اختلاف')}
                                    </span>
                                  );
                                return (
                                  <span
                                    className={
                                      base +
                                      ' bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                    }
                                  >
                                      {t('غير معروف')}
                                  </span>
                                );
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

                              return filtered.map((it) => (
                                <tr key={it.key} className="bg-white dark:bg-slate-900">
                                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-normal break-words leading-snug">
                                    {entityLabel(it.key)}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-slate-700 dark:text-slate-200 font-mono text-xs whitespace-normal break-all"
                                    dir="ltr"
                                  >
                                    {it.key}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap"
                                    dir="ltr"
                                  >
                                    {fmt(it.localBestTs)}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap"
                                    dir="ltr"
                                  >
                                    {fmt(it.remoteUpdatedAt)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {badge(it.status)}
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'ملاحظة: "محلي أحدث" يعني يوجد تغييرات لم تُرفع بعد — اضغط "مزامنة الآن".'
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {window.desktopDb?.sqlProvision && (
              <div className="md:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black">{t('تهيئة المخدم (للمدير)')}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'ينشئ قاعدة البيانات + جدول التخزين + حساب SQL للموظفين، ثم يحفظه للاستخدام.'
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label
                      className="text-xs font-bold text-slate-600 dark:text-slate-300"
                      htmlFor="settings-sql-provision-admin-user"
                    >
                      {t('مدير SQL (اسم المستخدم)')}
                    </label>
                    <input
                      id="settings-sql-provision-admin-user"
                      className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                      placeholder={t('sa أو admin')}
                      value={sqlProvision.adminUser}
                      onChange={(e) =>
                        setSqlProvision((p) => ({ ...p, adminUser: e.target.value }))
                      }
                      disabled={sqlBusy}
                    />
                  </div>
                  <div>
                    <label
                      className="text-xs font-bold text-slate-600 dark:text-slate-300"
                      htmlFor="settings-sql-provision-admin-password"
                    >
                      {t('مدير SQL (كلمة المرور)')}
                    </label>
                    <input
                      id="settings-sql-provision-admin-password"
                      type="password"
                      className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                      value={sqlProvision.adminPassword}
                      onChange={(e) =>
                        setSqlProvision((p) => ({ ...p, adminPassword: e.target.value }))
                      }
                      disabled={sqlBusy}
                    />
                  </div>

                  <div>
                    <label
                      className="text-xs font-bold text-slate-600 dark:text-slate-300"
                      htmlFor="settings-sql-provision-manager-user"
                    >
                      {t('حساب المدير (اسم المستخدم)')}
                    </label>
                    <input
                      id="settings-sql-provision-manager-user"
                      className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                      value={sqlProvision.managerUser}
                      onChange={(e) =>
                        setSqlProvision((p) => ({ ...p, managerUser: e.target.value }))
                      }
                      disabled={sqlBusy}
                    />
                  </div>
                  <div>
                    <label
                      className="text-xs font-bold text-slate-600 dark:text-slate-300"
                      htmlFor="settings-sql-provision-manager-password"
                    >
                      {t('حساب المدير (كلمة المرور)')}
                    </label>
                    <input
                      id="settings-sql-provision-manager-password"
                      type="password"
                      className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                      value={sqlProvision.managerPassword}
                      onChange={(e) =>
                        setSqlProvision((p) => ({ ...p, managerPassword: e.target.value }))
                      }
                      disabled={sqlBusy}
                    />
                  </div>

                  <div>
                    <label
                      className="text-xs font-bold text-slate-600 dark:text-slate-300"
                      htmlFor="settings-sql-provision-employee-user"
                    >
                      {t('حساب الموظفين (اسم المستخدم)')}
                    </label>
                    <input
                      id="settings-sql-provision-employee-user"
                      className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                      value={sqlProvision.employeeUser}
                      onChange={(e) =>
                        setSqlProvision((p) => ({ ...p, employeeUser: e.target.value }))
                      }
                      disabled={sqlBusy}
                    />
                  </div>
                  <div>
                    <label
                      className="text-xs font-bold text-slate-600 dark:text-slate-300"
                      htmlFor="settings-sql-provision-employee-password"
                    >
                      {t('حساب الموظفين (كلمة المرور)')}
                    </label>
                    <input
                      id="settings-sql-provision-employee-password"
                      type="password"
                      className="w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm"
                      value={sqlProvision.employeePassword}
                      onChange={(e) =>
                        setSqlProvision((p) => ({ ...p, employeePassword: e.target.value }))
                      }
                      disabled={sqlBusy}
                    />
                  </div>

                  <div className="md:col-span-2 flex gap-3 flex-wrap">
                    <button
                      onClick={handleSqlProvision}
                      className="bg-emerald-600 text-white hover:bg-emerald-700 px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2"
                      disabled={sqlBusy}
                    >
                      <Shield size={16} /> {t('تهيئة المخدم الآن')}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                      {t('بعد التهيئة، يتم حفظ حساب الموظفين داخل النظام.')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


