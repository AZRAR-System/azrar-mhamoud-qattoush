import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  History,
  Trash2,
  RefreshCcw,
  AlertCircle,
  HardDrive,
  Shield,
  ShieldAlert,
  FolderOpen,
  Plus,
  Database,
  FileArchive,
  Clock,
  Search,
  ShieldCheck,
  Loader2,
  FileText,
  Save,
  Lock,
  Globe,
  Check,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useSmartModal } from '@/context/ModalContext';
import { AppModal } from '@/components/ui/AppModal';
import { useDbSignal } from '@/hooks/useDbSignal';
import { getErrorMessage } from '@/utils/errors';

// --- Types ---
type BackupFile = {
  name: string;
  mtimeMs: number;
  size: number;
  path?: string;
};

type BackupStats = {
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

type BackupLogEntry = {
  ts: string;
  ok: boolean;
  trigger: 'auto' | 'manual';
  message?: string;
};

type BackupAutomationSettings = {
  v: 1;
  enabled?: boolean;
  timeHHmm?: string;
  retentionDays?: number;
  lastRunAt?: string;
  updatedAt?: string;
};

type EncryptionSettings = {
  success: boolean;
  available: boolean;
  enabled: boolean;
  hasPassword?: boolean;
  message?: string;
};

// --- Components ---

export const BackupManager: React.FC = () => {
  useTranslation();
  const toast = useToast();
  useSmartModal();
  const isDesktop = !!window.desktopDb;
  const dbSignal = useDbSignal();

  // --- State ---
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [, setLogs] = useState<BackupLogEntry[]>([]);
  const [automation, setAutomation] = useState<BackupAutomationSettings | null>(null);
  const [encryption, setEncryption] = useState<EncryptionSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Create Backup Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createOptions, setCreateOptions] = useState({ includeDb: true, includeAttachments: true });
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState(0);

  // Restore Modal State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFile, setRestoreFile] = useState<BackupFile | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteFile, setDeleteFile] = useState<BackupFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Settings State (for automation)
  const [autoTime, setAutoTime] = useState('02:00');
  const [autoRetention, setAutoRetention] = useState(30);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  // Encryption State
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

      if ((s as BackupStats).ok) setStats(s as BackupStats);
      if (Array.isArray(l)) setLogs(l);

      const autoData = a as BackupAutomationSettings;
      if (autoData) {
        setAutomation(autoData);
        setAutoTime(autoTime || autoData.timeHHmm || '02:00');
        setAutoRetention(autoRetention || autoData.retentionDays || 30);
        setAutoEnabled(autoEnabled || autoData.enabled || false);
      }

      const encData = e as EncryptionSettings;
      if (encData) setEncryption(encData);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'تعذر تحميل بيانات النسخ الاحتياطي');
    } finally {
      setLoading(false);
    }
  }, [isDesktop, autoTime, autoRetention, autoEnabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData, dbSignal]);

  // --- Handlers ---

  const handleChooseDir = async () => {
    if (!window.desktopDb?.chooseBackupDir) return;
    const res = (await window.desktopDb.chooseBackupDir()) as {
      success: boolean;
      backupDir?: string;
    };
    if (res.success) {
      toast.success('تم تغيير مجلد النسخ الاحتياطي');
      fetchData();
    }
  };

  const handleRunBackup = async () => {
    setCreating(true);
    setCreateProgress(10);
    try {
      // Simulate progress since IPC is black-box
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
  };

  const handleDeleteBackup = async () => {
    if (!deleteFile || !stats?.backupDir) return;
    setDeleting(true);
    try {
      const fullPath = stats.backupDir + '\\' + deleteFile.name;
      const res = await window.desktopDb?.deleteLocalBackupFile?.(fullPath);
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
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile || !stats?.backupDir) return;
    setRestoring(true);
    try {
      const fullPath = stats.backupDir + '\\' + restoreFile.name;
      const res = await window.desktopDb?.restoreLocalBackupFile?.(fullPath);
      if (res.success) {
        toast.success('جاري استعادة البيانات... سيتم إعادة تشغيل البرنامج.');
        // The app will likely restart itself via IPC handler
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
  };

  const handleSaveAutomation = async () => {
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
  };

  const handleSaveEncryption = async (action: 'toggle' | 'password' | 'clear') => {
    setSavingEnc(true);
    try {
      const payload: { enabled?: boolean; password?: string; clearPassword?: boolean } = {};
      if (action === 'toggle') payload.enabled = !encryption?.enabled;
      if (action === 'password') payload.password = encPassword;
      if (action === 'clear') payload.clearPassword = true;

      const res = (await window.desktopDb?.saveBackupEncryptionSettings?.(
        payload
      )) as EncryptionSettings;
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
  };

  // --- Helpers ---
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = useMemo(() => {
    if (!stats?.files) return [];
    return stats.files
      .filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }, [stats?.files, searchTerm]);

  if (!isDesktop) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50 dark:bg-slate-950">
        <div className="app-card p-12 max-w-xl animate-float">
          <ShieldAlert size={80} className="text-amber-500 mx-auto mb-8" />
          <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-6">
            نسخة الويب لا تدعم النسخ المحلي
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed text-lg font-medium">
            ميزات إدارة النسخ الاحتياطي المتقدمة، التشفير، والنسخ التلقائي متاحة فقط في نسخة سطح
            المكتب (Desktop App) لضمان أقصى درجات الأمان لبياناتك.
          </p>
          <button
            className="btn-primary-modern w-full py-4 text-lg"
            onClick={() => window.history.back()}
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/20 overflow-hidden font-sans page-transition"
      dir="rtl"
    >
      {/* Header Section */}
      <header className="flex-shrink-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-indigo-600 dark:bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-600/20 animate-float">
              <History size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-white leading-tight">
                إدارة النسخ الاحتياطي
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold uppercase tracking-wider">
                تأمين بياناتك، استعادة اللحظات السابقة، والتحكم الكامل في الأرشيف.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="btn-secondary-modern" onClick={fetchData} disabled={loading}>
              <RefreshCcw
                size={18}
                className={loading ? 'animate-spin text-indigo-500' : 'text-indigo-500'}
              />
              <span>تحديث البيانات</span>
            </button>
            <button className="btn-primary-modern" onClick={() => setShowCreateModal(true)}>
              <Plus size={20} />
              <span>نسخة احتياطية جديدة</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1600px] mx-auto space-y-10">
          {/* Stats Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="glass-card p-6 flex items-center gap-5 group hover:scale-[1.02]">
              <div className="w-14 h-14 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:rotate-12 transition-transform duration-500">
                <Database size={28} />
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                  إجمالي النسخ
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-white">
                  {stats ? stats.dbArchivesCount + stats.attachmentsArchivesCount : '—'}
                </div>
              </div>
            </div>

            <div className="glass-card p-6 flex items-center gap-5 group hover:scale-[1.02]">
              <div className="w-14 h-14 rounded-2xl bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:rotate-12 transition-transform duration-500">
                <HardDrive size={28} />
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                  المساحة المستخدمة
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-white">
                  {stats ? formatSize(stats.totalBytes) : '—'}
                </div>
              </div>
            </div>

            <div className="glass-card p-6 flex items-center gap-5 group hover:scale-[1.02]">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:rotate-12 transition-transform duration-500">
                <ShieldCheck size={28} />
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                  حالة التشفير
                </div>
                <div
                  className={`text-xl font-black ${encryption?.enabled ? 'text-emerald-500' : 'text-amber-500'}`}
                >
                  {encryption?.enabled ? 'مفعل ومحمي' : 'غير مفعل'}
                </div>
              </div>
            </div>

            <div className="glass-card p-6 flex items-center gap-5 group hover:scale-[1.02]">
              <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:rotate-12 transition-transform duration-500">
                <Clock size={28} />
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                  آخر نسخ تلقائي
                </div>
                <div className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[150px]">
                  {automation?.lastRunAt
                    ? new Date(automation.lastRunAt).toLocaleString('ar-JO')
                    : 'لم يتم بعد'}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Backups List Section */}
            <div className="lg:col-span-2 space-y-8">
              <div className="app-card overflow-hidden flex flex-col min-h-[700px]">
                <div className="app-card-header flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 dark:bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                      <FileArchive size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-800 dark:text-white">
                        قائمة النسخ الاحتياطية
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                        إدارة الأرشيف المحلي والملفات المشفرة
                      </p>
                    </div>
                  </div>

                  <div className="relative group max-w-xs w-full">
                    <Search
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                    />
                    <input
                      type="text"
                      placeholder="بحث في النسخ..."
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-11 pl-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-6 flex-1">
                  <div className="app-table-wrapper !rounded-3xl border-none shadow-none bg-slate-50/40 dark:bg-slate-800/20">
                    <table className="app-table">
                      <thead className="app-table-thead !bg-transparent">
                        <tr>
                          <th className="app-table-th">الاسم</th>
                          <th className="app-table-th">التاريخ</th>
                          <th className="app-table-th">الحجم</th>
                          <th className="app-table-th">الحالة</th>
                          <th className="app-table-th text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {loading ? (
                          <tr>
                            <td colSpan={5} className="app-table-empty">
                              <Loader2
                                className="animate-spin text-indigo-500 mx-auto mb-4"
                                size={48}
                              />
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                جاري تحميل البيانات...
                              </div>
                            </td>
                          </tr>
                        ) : filteredFiles.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="app-table-empty">
                              <History
                                className="text-slate-200 dark:text-slate-800/20 mx-auto mb-4"
                                size={80}
                              />
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                لا توجد نسخ احتياطية
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredFiles.map((file, idx) => {
                            const isLatest = file.name.includes('latest');
                            const isDb = file.name.includes('.db');
                            const isEnc = file.name.endsWith('.enc');

                            return (
                              <tr key={idx} className="app-table-row group">
                                <td className="app-table-td">
                                  <div className="flex items-center gap-4">
                                    <div
                                      className={`p-3 rounded-2xl shadow-sm ${isDb ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}
                                    >
                                      {isDb ? <Database size={20} /> : <FileArchive size={20} />}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-base font-black text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {file.name}
                                      </span>
                                      {isEnc && (
                                        <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-tight bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg w-fit">
                                          <Shield size={10} /> مشفر
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="app-table-td">
                                  <div className="font-mono text-[10px] font-black text-slate-500 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700 inline-block">
                                    {new Date(file.mtimeMs).toLocaleString('ar-JO')}
                                  </div>
                                </td>
                                <td className="app-table-td">
                                  <span className="font-mono text-xs font-black text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                                    {formatSize(file.size)}
                                  </span>
                                </td>
                                <td className="app-table-td">
                                  <span
                                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${isLatest ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 shadow-sm shadow-indigo-500/5' : 'bg-slate-500/10 text-slate-600 border-slate-500/20'}`}
                                  >
                                    {isLatest ? 'الأحدث' : 'أرشيف'}
                                  </span>
                                </td>
                                <td className="app-table-td">
                                  <div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                    {isDb && (
                                      <button
                                        className="app-table-action-btn-primary"
                                        title="استعادة"
                                        onClick={() => {
                                          setRestoreFile(file);
                                          setShowRestoreModal(true);
                                        }}
                                      >
                                        <RefreshCcw size={18} />
                                      </button>
                                    )}
                                    <button
                                      className="app-table-action-btn-danger"
                                      title="حذف"
                                      onClick={() => {
                                        setDeleteFile(file);
                                        setShowDeleteModal(true);
                                      }}
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Controls Section */}
            <div className="space-y-10">
              {/* Automation Settings Card */}
              <div className="app-card !p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-emerald-600 dark:bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white">
                      النسخ التلقائي
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                      برمجة العمليات اليومية
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div
                    className={`p-6 rounded-[2rem] border-2 transition-all duration-700 ${autoEnabled ? 'bg-emerald-50/40 border-emerald-500/20 dark:bg-emerald-900/10 dark:border-emerald-500/10 shadow-xl shadow-emerald-500/5' : 'bg-slate-50/50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-800'}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-3 rounded-2xl shadow-inner transition-colors duration-500 ${autoEnabled ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                        >
                          <Globe size={20} />
                        </div>
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                          تفعيل النسخ اليومي
                        </span>
                      </div>
                      <button
                        onClick={() => setAutoEnabled(!autoEnabled)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-500 focus:outline-none ${autoEnabled ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-500 ${autoEnabled ? '-translate-x-1' : '-translate-x-7'}`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em] px-2">
                        وقت التنفيذ
                      </label>
                      <input
                        type="time"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        value={autoTime}
                        onChange={(e) => setAutoTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em] px-2">
                        مدة الاحتفاظ
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          value={autoRetention}
                          onChange={(e) => setAutoRetention(Number(e.target.value))}
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          يوم
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn-primary-modern w-full py-4"
                    onClick={handleSaveAutomation}
                    disabled={savingAuto}
                  >
                    {savingAuto ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Save size={20} />
                    )}
                    <span>حفظ إعدادات الأتمتة</span>
                  </button>
                </div>
              </div>

              {/* Encryption & Security Card */}
              <div className="app-card !p-8 bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 text-white relative overflow-hidden group">
                <div className="absolute -right-12 -bottom-12 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000">
                  <ShieldCheck size={200} />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                      <Lock size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black">تشفير الأرشيف</h4>
                      <p className="text-[10px] text-indigo-100/70 font-bold uppercase tracking-wider mt-1">
                        حماية فائقة لبياناتك
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <p className="text-sm text-indigo-50/80 leading-relaxed font-medium">
                      عند تفعيل التشفير، سيتم حماية جميع النسخ الاحتياطية الجديدة بكلمة مرور قوية
                      تمنع الوصول غير المصرح به حتى في حال تسرب الملفات.
                    </p>

                    <div className="space-y-4">
                      <input
                        type="password"
                        placeholder="كلمة مرور التشفير الجديدة..."
                        className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl py-4 px-6 text-sm font-bold placeholder:text-white/40 outline-none focus:ring-4 focus:ring-white/10 focus:border-white/40 transition-all"
                        value={encPassword}
                        onChange={(e) => setEncPassword(e.target.value)}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <button
                          className="flex items-center justify-center gap-2 py-3.5 bg-white text-indigo-600 rounded-2xl font-black text-xs shadow-xl shadow-black/10 hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50"
                          onClick={() => handleSaveEncryption('password')}
                          disabled={savingEnc || !encPassword}
                        >
                          <Save size={16} />
                          <span>حفظ الباسورد</span>
                        </button>
                        <button
                          className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-xs shadow-xl shadow-black/10 transition-all active:scale-95 disabled:opacity-50 ${encryption?.enabled ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                          onClick={() => handleSaveEncryption('toggle')}
                          disabled={savingEnc}
                        >
                          {encryption?.enabled ? (
                            <ShieldAlert size={16} />
                          ) : (
                            <ShieldCheck size={16} />
                          )}
                          <span>{encryption?.enabled ? 'تعطيل التشفير' : 'تفعيل التشفير'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Directory Settings Card */}
              <div className="app-card !p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400">
                    <FolderOpen size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white">
                      مجلد التخزين
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                      مسار ملفات الأرشيف
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/40 border-2 border-slate-100 dark:border-slate-800 mb-6">
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 break-all leading-relaxed">
                    {stats?.backupDir || 'جاري التحميل...'}
                  </p>
                </div>

                <button className="btn-secondary-modern w-full" onClick={handleChooseDir}>
                  <FolderOpen size={18} className="text-indigo-500" />
                  <span>تغيير مجلد التخزين</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- Modals --- */}

      {/* Create Backup Modal */}
      <AppModal
        open={showCreateModal}
        onClose={() => !creating && setShowCreateModal(false)}
        title="إنشاء نسخة احتياطية جديدة"
      >
        <div className="space-y-10 p-4">
          <div className="grid grid-cols-1 gap-6">
            <button
              onClick={() => setCreateOptions((p) => ({ ...p, includeDb: !p.includeDb }))}
              className={`flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all duration-500 ${createOptions.includeDb ? 'bg-indigo-50/40 border-indigo-500/20 dark:bg-indigo-900/10 dark:border-indigo-500/10' : 'bg-slate-50/50 border-slate-100 dark:bg-slate-800/20 dark:border-slate-800'}`}
              disabled={creating}
            >
              <div className="flex items-center gap-5">
                <div
                  className={`p-4 rounded-2xl shadow-inner ${createOptions.includeDb ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400'}`}
                >
                  <Database size={24} />
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-slate-800 dark:text-white">
                    قاعدة البيانات
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                    نسخ كافة السجلات والمعاملات
                  </div>
                </div>
              </div>
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${createOptions.includeDb ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200'}`}
              >
                {createOptions.includeDb && <Check size={18} />}
              </div>
            </button>

            <button
              onClick={() =>
                setCreateOptions((p) => ({ ...p, includeAttachments: !p.includeAttachments }))
              }
              className={`flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all duration-500 ${createOptions.includeAttachments ? 'bg-blue-50/40 border-blue-500/20 dark:bg-blue-900/10 dark:border-blue-500/10' : 'bg-slate-50/50 border-slate-100 dark:bg-slate-800/20 dark:border-slate-800'}`}
              disabled={creating}
            >
              <div className="flex items-center gap-5">
                <div
                  className={`p-4 rounded-2xl shadow-inner ${createOptions.includeAttachments ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}`}
                >
                  <FileText size={24} />
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-slate-800 dark:text-white">
                    المرفقات والملفات
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                    نسخ الصور والوثائق المرفقة
                  </div>
                </div>
              </div>
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${createOptions.includeAttachments ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200'}`}
              >
                {createOptions.includeAttachments && <Check size={18} />}
              </div>
            </button>
          </div>

          {creating && (
            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-sm font-black text-slate-700 dark:text-slate-200">
                <span>جاري التنفيذ...</span>
                <span className="font-mono text-indigo-600">{createProgress}%</span>
              </div>
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500 shadow-lg shadow-indigo-500/20"
                  style={{ width: `${createProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-4">
            <button
              className="btn-primary-modern flex-1 py-4 text-base"
              onClick={handleRunBackup}
              disabled={creating || (!createOptions.includeDb && !createOptions.includeAttachments)}
            >
              {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              <span>بدء النسخ الاحتياطي الآن</span>
            </button>
            <button
              className="btn-secondary-modern py-4 px-8 text-base"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              إلغاء
            </button>
          </div>
        </div>
      </AppModal>

      {/* Restore Confirmation Modal */}
      <AppModal
        open={showRestoreModal}
        onClose={() => !restoring && setShowRestoreModal(false)}
        title="تأكيد استعادة البيانات"
      >
        <div className="space-y-10 p-4">
          <div className="p-8 rounded-[2.5rem] bg-amber-50/50 dark:bg-amber-900/10 border-2 border-amber-200/50 dark:border-amber-900/30 flex items-start gap-6">
            <div className="p-4 bg-amber-100 dark:bg-amber-900/40 rounded-2xl text-amber-600 flex-shrink-0">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-4">
              <p className="text-base font-black text-amber-900 dark:text-amber-400">
                تحذير: هذه العملية ستقوم باستبدال كافة البيانات الحالية بالبيانات الموجودة في النسخة
                الاحتياطية.
              </p>
              <p className="text-sm text-amber-800/70 dark:text-amber-500/70 font-bold">
                سيتم إغلاق البرنامج وإعادة تشغيله تلقائياً بعد اكتمال العملية.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                <FileArchive size={24} className="text-indigo-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                  {restoreFile?.name}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  نسخة مختارة للاستعادة
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              className="btn-primary-modern flex-1 py-4 text-base !bg-amber-600 !hover:bg-amber-700 !shadow-amber-500/20"
              onClick={handleRestoreBackup}
              disabled={restoring}
            >
              {restoring ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <RefreshCcw size={20} />
              )}
              <span>استعادة البيانات الآن</span>
            </button>
            <button
              className="btn-secondary-modern py-4 px-8 text-base"
              onClick={() => setShowRestoreModal(false)}
              disabled={restoring}
            >
              إلغاء
            </button>
          </div>
        </div>
      </AppModal>

      {/* Delete Confirmation Modal */}
      <AppModal
        open={showDeleteModal}
        onClose={() => !deleting && setShowDeleteModal(false)}
        title="حذف نسخة احتياطية"
      >
        <div className="space-y-10 p-4">
          <div className="p-8 rounded-[2.5rem] bg-rose-50/50 dark:bg-rose-900/10 border-2 border-rose-200/50 dark:border-rose-900/30 flex items-start gap-6">
            <div className="p-4 bg-rose-100 dark:bg-rose-900/40 rounded-2xl text-rose-600 flex-shrink-0">
              <Trash2 size={32} />
            </div>
            <div className="space-y-4">
              <p className="text-base font-black text-rose-900 dark:text-rose-400">
                هل أنت متأكد من رغبتك في حذف هذا الملف؟
              </p>
              <p className="text-sm text-rose-800/70 dark:text-rose-500/70 font-bold">
                لا يمكن التراجع عن هذه العملية بعد التنفيذ.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                <FileArchive size={24} className="text-rose-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                  {deleteFile?.name}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  ملف سيتم حذفه نهائياً
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              className="btn-primary-modern flex-1 py-4 text-base !bg-rose-600 !hover:bg-rose-700 !shadow-rose-500/20"
              onClick={handleDeleteBackup}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
              <span>حذف الملف نهائياً</span>
            </button>
            <button
              className="btn-secondary-modern py-4 px-8 text-base"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              إلغاء
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
};

export default BackupManager;
