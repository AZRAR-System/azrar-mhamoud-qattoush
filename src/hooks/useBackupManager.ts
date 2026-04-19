import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { useDbSignal } from '@/hooks/useDbSignal';
import { getErrorMessage } from '@/utils/errors';

// --- Types ---
export type BackupFile = {
  name: string;
  mtimeMs: number;
  size: number;
  path?: string;
};

export type BackupStats = {
  ok: boolean;
  message?: string;
  backupDir?: string;
  dbArchivesCount: number;
  attachmentsArchivesCount: number;
  latestDbExists: boolean;
  latestAttachmentsExists: boolean;
  totalBytes: number;
  newestMtimeMs: number;
  files: BackupFile[];
};

export type BackupLogEntry = {
  ts: string;
  ok: boolean;
  trigger: 'auto' | 'manual';
  message?: string;
};

export type BackupAutomationSettings = {
  v: 1;
  enabled?: boolean;
  timeHHmm?: string;
  retentionDays?: number;
  lastRunAt?: string;
  updatedAt?: string;
};

export type EncryptionSettings = {
  success: boolean;
  available: boolean;
  enabled: boolean;
  hasPassword?: boolean;
  message?: string;
};

export const useBackupManager = () => {
  const toast = useToast();
  const isDesktop = !!window.desktopDb;
  const dbSignal = useDbSignal();

  // --- State ---
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [, setLogs] = useState<BackupLogEntry[]>([]);
  const [automation, setAutomation] = useState<BackupAutomationSettings | null>(null);
  const [encryption, setEncryption] = useState<EncryptionSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createOptions, setCreateOptions] = useState({ includeDb: true, includeAttachments: true });
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState(0);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFile, setRestoreFile] = useState<BackupFile | null>(null);
  const [restoring, setRestoring] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteFile, setDeleteFile] = useState<BackupFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Settings
  const [autoTime, setAutoTime] = useState('02:00');
  const [autoRetention, setAutoRetention] = useState(30);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  const [encPassword, setEncPassword] = useState('');
  const [savingEnc, setSavingEnc] = useState(false);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    if (!isDesktop) return;
    setLoading(true);
    try {
      const [s, l, a, e] = await Promise.all([
        window.desktopDb?.getLocalBackupStats?.(),
        window.desktopDb?.getLocalBackupLog?.({ limit: 10 }),
        window.desktopDb?.getLocalBackupAutomationSettings?.(),
        window.desktopDb?.getBackupEncryptionSettings?.(),
      ]);

      if ((s as BackupStats)?.ok) setStats(s as BackupStats);
      if (Array.isArray(l)) setLogs(l);

      const autoData = a as BackupAutomationSettings;
      if (autoData) {
        setAutomation(autoData);
        setAutoTime((prev) => prev || autoData.timeHHmm || '02:00');
        setAutoRetention((prev) => prev || autoData.retentionDays || 30);
        setAutoEnabled((prev) => prev || autoData.enabled || false);
      }

      const encData = e as EncryptionSettings;
      if (encData) setEncryption(encData);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'تعذر تحميل بيانات النسخ الاحتياطي');
    } finally {
      setLoading(false);
    }
  }, [isDesktop, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData, dbSignal]);

  // --- Handlers ---
  const handleChooseDir = useCallback(async () => {
    if (!window.desktopDb?.chooseBackupDir) return;
    const res = (await window.desktopDb.chooseBackupDir()) as {
      success: boolean;
      backupDir?: string;
    };
    if (res.success) {
      toast.success('تم تغيير مجلد النسخ الاحتياطي');
      fetchData();
    }
  }, [fetchData, toast]);

  const handleRunBackup = useCallback(async () => {
    setCreating(true);
    setCreateProgress(10);
    try {
      const interval = setInterval(() => {
        setCreateProgress((prev) => Math.min(prev + 15, 90));
      }, 500);

      const res = (await window.desktopDb?.runLocalBackupNow?.()) as {
        success: boolean;
        message?: string;
      };
      clearInterval(interval);
      setCreateProgress(100);

      if (res.success) {
        toast.success('تم إنشاء النسخة الاحتياطية بنجاح');
        setShowCreateModal(false);
        fetchData();
      } else {
        toast.error(res.message || 'فشل إنشاء النسخة الاحتياطية');
      }
    } catch {
      toast.error('حدث خطأ أثناء الاتصال بالنظام');
    } finally {
      setCreating(false);
      setCreateProgress(0);
    }
  }, [fetchData, toast]);

  const handleDeleteBackup = useCallback(async () => {
    if (!deleteFile || !stats?.backupDir) return;
    setDeleting(true);
    try {
      const fullPath = stats.backupDir + '\\' + deleteFile.name;
      const res = (await window.desktopDb?.deleteLocalBackupFile?.(fullPath)) as {
        success: boolean;
        message?: string;
      };
      if (res.success) {
        toast.success('تم حذف النسخة الاحتياطية');
        setShowDeleteModal(false);
        fetchData();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('فشل حذف الملف');
    } finally {
      setDeleting(false);
      setDeleteFile(null);
    }
  }, [deleteFile, stats?.backupDir, fetchData, toast]);

  const handleRestoreBackup = useCallback(async () => {
    if (!restoreFile || !stats?.backupDir) return;
    setRestoring(true);
    try {
      const fullPath = stats.backupDir + '\\' + restoreFile.name;
      const res = (await window.desktopDb?.restoreLocalBackupFile?.(fullPath)) as {
        success: boolean;
        message?: string;
      };
      if (res.success) {
        toast.success('جاري استعادة البيانات... سيتم إعادة تشغيل البرنامج.');
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('فشل استعادة البيانات');
    } finally {
      setRestoring(false);
      setShowRestoreModal(false);
      setRestoreFile(null);
    }
  }, [restoreFile, stats?.backupDir, toast]);

  const handleSaveAutomation = useCallback(async () => {
    setSavingAuto(true);
    try {
      const res = (await window.desktopDb?.saveLocalBackupAutomationSettings?.({
        enabled: autoEnabled,
        timeHHmm: autoTime,
        retentionDays: autoRetention,
      })) as { success: boolean; message?: string };

      if (res.success) {
        toast.success('تم حفظ إعدادات النسخ التلقائي');
        fetchData();
      } else {
        toast.error(res.message || 'فشل الحفظ');
      }
    } catch {
      toast.error('خطأ في الاتصال');
    } finally {
      setSavingAuto(false);
    }
  }, [autoEnabled, autoTime, autoRetention, fetchData, toast]);

  const handleSaveEncryption = useCallback(
    async (action: 'toggle' | 'password' | 'clear') => {
      setSavingEnc(true);
      try {
        const payload: { enabled?: boolean; password?: string; clearPassword?: boolean } = {};
        if (action === 'toggle') payload.enabled = !encryption?.enabled;
        if (action === 'password') payload.password = encPassword;
        if (action === 'clear') payload.clearPassword = true;

        const res = (await window.desktopDb?.saveBackupEncryptionSettings?.(
          payload
        )) as (EncryptionSettings & { message?: string });
        
        if (res.success) {
          toast.success(res.message || 'تم تحديث إعدادات التشفير');
          setEncPassword('');
          fetchData();
        } else {
          toast.error(res.message || 'فشل التحديث');
        }
      } catch {
        toast.error('خطأ في الاتصال');
      } finally {
        setSavingEnc(false);
      }
    },
    [encryption?.enabled, encPassword, fetchData, toast]
  );

  // --- Helpers ---
  const formatSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const filteredFiles = useMemo(() => {
    if (!stats?.files) return [];
    return stats.files
      .filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }, [stats?.files, searchTerm]);

  return {
    isDesktop,
    loading,
    stats,
    automation,
    encryption,
    searchTerm,
    setSearchTerm,
    showCreateModal,
    setShowCreateModal,
    createOptions,
    setCreateOptions,
    creating,
    createProgress,
    showRestoreModal,
    setShowRestoreModal,
    restoreFile,
    setRestoreFile,
    restoring,
    showDeleteModal,
    setShowDeleteModal,
    deleteFile,
    setDeleteFile,
    deleting,
    autoTime,
    setAutoTime,
    autoRetention,
    setAutoRetention,
    autoEnabled,
    setAutoEnabled,
    savingAuto,
    encPassword,
    setEncPassword,
    savingEnc,
    fetchData,
    handleChooseDir,
    handleRunBackup,
    handleDeleteBackup,
    handleRestoreBackup,
    handleSaveAutomation,
    handleSaveEncryption,
    formatSize,
    filteredFiles,
  };
};
