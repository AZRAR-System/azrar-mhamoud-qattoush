import React from 'react';
import {
  Database,
  Building,
  List,
  Upload,
  Globe,
  Phone,
  Bell,
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
  Loader2,
} from 'lucide-react';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsBackupSection({ page }: Props) {
  const {
    backupDir,
    backupEncAvailable,
    backupEncBusy,
    backupEncEnabled,
    backupEncHasPassword,
    backupEncPassword,
    clearLocalBackupHistory,
    computeNextRunAt,
    copyToClipboard,
    formatBytes,
    goToDatabaseReset,
    handleBackup,
    handleChooseBackupDir,
    handleDesktopImport,
    handleRestore,
    inputClass,
    isDesktop,
    labelClass,
    localBackupBusy,
    localBackupEnabled,
    localBackupLastRunAt,
    localBackupLog,
    localBackupLogBusy,
    localBackupRetentionDays,
    localBackupStats,
    localBackupTime,
    refreshLocalBackupInsights,
    runLocalBackupNow,
    saveBackupEncryption,
    saveLocalBackupAutomation,
    setBackupEncPassword,
    setLocalBackupRetentionDays,
    setLocalBackupTime,
    settings,
    settingsNoAccessFallback,
    t,
  } = page;

  return (
    <RBACGuard requiredRole="SuperAdmin" fallback={settingsNoAccessFallback}>
      <div className="flex items-center justify-center h-full p-8 animate-fade-in bg-gray-50 dark:bg-slate-900/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          <div
            className="app-card p-8 rounded-3xl flex flex-col items-center text-center cursor-pointer hover:shadow-lg"
            onClick={handleBackup}
          >
            <Download size={40} className="text-green-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">تصدير نسخة احتياطية</h3>
            {isDesktop ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                سيتم إنشاء ملفات النسخ تلقائياً داخل المجلد الذي تختاره:{' '}
                <span className="font-mono">
                  AZRAR-backup-latest.db
                  {backupEncEnabled && backupEncHasPassword ? '.enc' : ''}
                </span>{' '}
                +{' '}
                <span className="font-mono">
                  AZRAR-attachments-latest.tar.gz
                  {backupEncEnabled && backupEncHasPassword ? '.enc' : ''}
                </span>{' '}
                + أرشيف بتاريخ اليوم لكلٍ منهما.
              </p>
            ) : null}
            <button className="mt-4 px-6 py-2 bg-green-600 text-white rounded-xl font-bold">
              تحميل النسخة
            </button>
          </div>
          <div className="app-card p-8 rounded-3xl flex flex-col items-center text-center">
            <Upload size={40} className="text-amber-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">استعادة البيانات</h3>
            {isDesktop ? (
              <button
                onClick={handleDesktopImport}
                className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-xl font-bold cursor-pointer"
              >
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
    
          <div className="md:col-span-2 flex items-center justify-between gap-3 px-2">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                إعدادات النسخ الاحتياطي
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                المسار + التشفير + النسخ التلقائي
              </div>
            </div>
            <div className="hidden md:block h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
    
          {isDesktop && (
            <div className="app-card p-6 rounded-3xl md:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">
                    مجلد النسخ الاحتياطي
                  </h3>
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
    
          {isDesktop && window.desktopDb?.getBackupEncryptionSettings && (
            <div className="app-card p-6 rounded-3xl md:col-span-2">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">
                    تشفير النسخ الاحتياطية
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    عند التفعيل سيتم تشفير النسخ الاحتياطية (
                    <span className="font-mono">.db.enc</span> و{' '}
                    <span className="font-mono">.tar.gz.enc</span>) وكذلك تشفير المرفقات
                    المخزنة على الجهاز (تشفير أثناء التخزين) ولن يمكن فتحها بدون كلمة
                    المرور.
                  </div>
                  {!backupEncAvailable && (
                    <div className="mt-3 text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-3">
                      ملاحظة: تشفير/حفظ كلمة المرور يعتمد على حماية النظام (Windows). إذا لم
                      تكن متاحة قد يعمل بشكل محدود.
                    </div>
                  )}
                </div>
    
                <button
                  type="button"
                  onClick={() => saveBackupEncryption({ enabled: !backupEncEnabled })}
                  disabled={backupEncBusy}
                  className={`px-4 py-2 rounded-xl text-sm font-black ${backupEncEnabled ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600'} ${backupEncBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {backupEncEnabled ? 'مفعل' : 'غير مفعل'}
                </button>
              </div>
    
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="settings-backup-enc-password">
                    كلمة مرور التشفير
                  </label>
                  <input
                    id="settings-backup-enc-password"
                    type="password"
                    className={inputClass}
                    value={backupEncPassword}
                    onChange={(e) => setBackupEncPassword(e.target.value)}
                    placeholder={
                      backupEncHasPassword
                        ? '•••••••• (محفوظة)'
                        : 'أدخل كلمة مرور (6 أحرف على الأقل)'
                    }
                    autoComplete="new-password"
                  />
                  <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {backupEncHasPassword
                      ? 'يوجد كلمة مرور محفوظة.'
                      : 'لا توجد كلمة مرور محفوظة بعد.'}
                  </div>
                </div>
    
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => saveBackupEncryption({ password: backupEncPassword })}
                    disabled={backupEncBusy || !backupEncPassword}
                    className={`flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-black hover:bg-indigo-700 ${backupEncBusy || !backupEncPassword ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {backupEncBusy ? (
                      <Loader2 className="animate-spin shrink-0" size={18} aria-hidden />
                    ) : null}
                    حفظ كلمة المرور
                  </button>
                  <button
                    type="button"
                    onClick={() => saveBackupEncryption({ clearPassword: true })}
                    disabled={backupEncBusy || !backupEncHasPassword}
                    className={`bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-4 py-3 rounded-xl text-sm font-black hover:bg-gray-50 dark:hover:bg-slate-600 ${backupEncBusy || !backupEncHasPassword ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    مسح
                  </button>
                </div>
              </div>
            </div>
          )}
    
          {isDesktop && window.desktopDb?.getLocalBackupAutomationSettings && (
            <div className="app-card p-6 rounded-3xl md:col-span-2">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">
                    النسخ الاحتياطي التلقائي
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    سيتم إنشاء نسخة كاملة (قاعدة البيانات + المرفقات) يومياً حسب الوقت الذي
                    تختاره داخل <span className="font-mono">مجلد النسخ الاحتياطي</span>.
                  </div>
                  {!backupDir && (
                    <div className="mt-3 text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-3">
                      اختر مجلد النسخ الاحتياطي أولاً ليعمل النسخ التلقائي.
                    </div>
                  )}
                </div>
    
                <button
                  type="button"
                  onClick={() =>
                    saveLocalBackupAutomation({
                      enabled: !localBackupEnabled,
                      timeHHmm: localBackupTime,
                      retentionDays: localBackupRetentionDays,
                    })
                  }
                  disabled={localBackupBusy}
                  className={`px-4 py-2 rounded-xl text-sm font-black ${localBackupEnabled ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600'} ${localBackupBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {localBackupEnabled ? 'مفعل' : 'غير مفعل'}
                </button>
              </div>
    
              <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    الوقت المحدد
                  </div>
                  <div className="mt-1 text-sm font-black text-slate-800 dark:text-white font-mono">
                    {localBackupTime || '—'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    التنفيذ القادم
                  </div>
                  <div className="mt-1 text-xs font-black text-slate-800 dark:text-white font-mono break-all">
                    {(() => {
                      const iso = computeNextRunAt(
                        localBackupEnabled,
                        localBackupTime,
                        localBackupLastRunAt
                      );
                      if (!iso) return '—';
                      try {
                        return new Date(iso).toLocaleString('ar');
                      } catch {
                        return iso;
                      }
                    })()}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    عدد أيام الحذف
                  </div>
                  <div className="mt-1 text-sm font-black text-slate-800 dark:text-white">
                    {Number.isFinite(localBackupRetentionDays)
                      ? localBackupRetentionDays
                      : 30}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    عدد النسخ الموجودة
                  </div>
                  <div className="mt-1 text-sm font-black text-slate-800 dark:text-white">
                    {localBackupStats?.ok
                      ? (localBackupStats.dbArchivesCount || 0) +
                        (localBackupStats.attachmentsArchivesCount || 0)
                      : 0}
                  </div>
                  {localBackupStats?.ok ? (
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      DB: {localBackupStats.dbArchivesCount || 0} • Attach:{' '}
                      {localBackupStats.attachmentsArchivesCount || 0}
                    </div>
                  ) : null}
                </div>
              </div>
    
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass} htmlFor="settings-local-backup-time">
                    وقت النسخ اليومي
                  </label>
                  <input
                    id="settings-local-backup-time"
                    type="time"
                    className={inputClass}
                    value={localBackupTime}
                    onChange={(e) => setLocalBackupTime(e.target.value)}
                  />
                </div>
    
                <div>
                  <label className={labelClass} htmlFor="settings-local-backup-retention">
                    الاحتفاظ (بالأيام)
                  </label>
                  <input
                    id="settings-local-backup-retention"
                    type="number"
                    min={1}
                    max={3650}
                    className={inputClass}
                    value={
                      Number.isFinite(localBackupRetentionDays)
                        ? localBackupRetentionDays
                        : 30
                    }
                    onChange={(e) =>
                      setLocalBackupRetentionDays(Number(e.target.value || 0) || 30)
                    }
                  />
                </div>
    
                <div>
                  <label className={labelClass}>آخر تنفيذ</label>
                  <div className="mt-1 text-xs font-mono bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 break-all">
                    {localBackupLastRunAt || 'لم يتم بعد'}
                  </div>
                </div>
              </div>
    
              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    saveLocalBackupAutomation({
                      enabled: localBackupEnabled,
                      timeHHmm: localBackupTime,
                      retentionDays: localBackupRetentionDays,
                    })
                  }
                  disabled={localBackupBusy}
                  className={`inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-black hover:bg-indigo-700 ${localBackupBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {localBackupBusy ? (
                    <Loader2 className="animate-spin shrink-0" size={18} aria-hidden />
                  ) : null}
                  حفظ الإعدادات
                </button>
                <button
                  type="button"
                  onClick={runLocalBackupNow}
                  disabled={localBackupBusy}
                  className={`bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-4 py-3 rounded-xl text-sm font-black hover:bg-gray-50 dark:hover:bg-slate-600 ${localBackupBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  تنفيذ الآن
                </button>
                <button
                  type="button"
                  onClick={refreshLocalBackupInsights}
                  disabled={localBackupLogBusy}
                  className={`bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-4 py-3 rounded-xl text-sm font-black hover:bg-gray-50 dark:hover:bg-slate-600 ${localBackupLogBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  تحديث العدادات والسجل
                </button>
              </div>
    
              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-800 dark:text-white">
                      سجل النسخ
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      آخر 200 عملية (تلقائي/يدوي)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearLocalBackupHistory}
                    disabled={localBackupLogBusy || !localBackupLog.length}
                    className={`bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-gray-50 dark:hover:bg-slate-600 ${localBackupLogBusy || !localBackupLog.length ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    مسح السجل
                  </button>
                </div>
    
                <div className="mt-3 app-table-wrapper overflow-hidden">
                  <div className="max-h-[280px] overflow-auto no-scrollbar">
                    <table className="app-table">
                      <thead className="app-table-thead">
                        <tr>
                          <th className="app-table-th">{t('الوقت')}</th>
                          <th className="app-table-th">{t('النوع')}</th>
                          <th className="app-table-th">{t('الحالة')}</th>
                          <th className="app-table-th">{t('ملاحظات')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                        {localBackupLogBusy ? (
                          <tr>
                            <td
                              className="app-table-td text-center py-12 text-slate-500"
                              colSpan={4}
                            >
                              جاري التحميل...
                            </td>
                          </tr>
                        ) : localBackupLog.length ? (
                          localBackupLog.map((x, idx) => (
                            <tr key={`${x.ts}-${idx}`} className="app-table-row">
                              <td className="app-table-td font-mono font-bold" dir="ltr">
                                {(() => {
                                  try {
                                    return new Date(x.ts).toLocaleString('en-GB');
                                  } catch {
                                    return x.ts;
                                  }
                                })()}
                              </td>
                              <td className="app-table-td">
                                <span className="font-black">
                                  {x.trigger === 'manual' ? 'يدوي' : 'تلقائي'}
                                </span>
                              </td>
                              <td className="app-table-td">
                                <span
                                  className={`px-2 py-1 rounded-xl text-[10px] font-black ${x.ok ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}
                                >
                                  {x.ok ? 'نجح' : 'فشل'}
                                </span>
                              </td>
                              <td className="app-table-td text-slate-600 dark:text-slate-300 break-all">
                                <div className="space-y-2">
                                  <div>{x.message || ''}</div>
                                  {(x.latestPath ||
                                    x.archivePath ||
                                    x.attachmentsLatestPath ||
                                    x.attachmentsArchivePath) && (
                                    <div className="space-y-2">
                                      {x.latestPath && (
                                        <div className="flex items-start gap-2">
                                          <div className="flex-1 font-mono text-[10px] bg-white/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-2 break-all">
                                            DB (latest): {x.latestPath}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              copyToClipboard(x.latestPath || '', {
                                                successMessage: 'تم نسخ المسار',
                                                failureMessage: 'تعذر النسخ',
                                              })
                                            }
                                            className="px-3 py-2 rounded-lg text-[10px] font-black bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 active:scale-95 transition-all"
                                          >
                                            نسخ
                                          </button>
                                        </div>
                                      )}
                                      {x.archivePath && (
                                        <div className="flex items-start gap-2">
                                          <div className="flex-1 font-mono text-[10px] bg-white/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-2 break-all">
                                            DB (archive): {x.archivePath}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              copyToClipboard(x.archivePath || '', {
                                                successMessage: 'تم نسخ المسار',
                                                failureMessage: 'تعذر النسخ',
                                              })
                                            }
                                            className="px-3 py-2 rounded-lg text-[10px] font-black bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 active:scale-95 transition-all"
                                          >
                                            نسخ
                                          </button>
                                        </div>
                                      )}
                                      {x.attachmentsLatestPath && (
                                        <div className="flex items-start gap-2">
                                          <div className="flex-1 font-mono text-[10px] bg-white/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-2 break-all">
                                            Attachments (latest): {x.attachmentsLatestPath}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              copyToClipboard(
                                                x.attachmentsLatestPath || '',
                                                {
                                                  successMessage: 'تم نسخ المسار',
                                                  failureMessage: 'تعذر النسخ',
                                                }
                                              )
                                            }
                                            className="px-3 py-2 rounded-lg text-[10px] font-black bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 active:scale-95 transition-all"
                                          >
                                            نسخ
                                          </button>
                                        </div>
                                      )}
                                      {x.attachmentsArchivePath && (
                                        <div className="flex items-start gap-2">
                                          <div className="flex-1 font-mono text-[10px] bg-white/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-2 break-all">
                                            Attachments (archive):{' '}
                                            {x.attachmentsArchivePath}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              copyToClipboard(
                                                x.attachmentsArchivePath || '',
                                                {
                                                  successMessage: 'تم نسخ المسار',
                                                  failureMessage: 'تعذر النسخ',
                                                }
                                              )
                                            }
                                            className="px-3 py-2 rounded-lg text-[10px] font-black bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 active:scale-95 transition-all"
                                          >
                                            نسخ
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              className="app-table-td text-center py-12 text-slate-500"
                              colSpan={4}
                            >
                              لا يوجد سجل بعد
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
    
                {localBackupStats?.ok ? (
                  <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                    إجمالي حجم ملفات النسخ داخل المجلد:{' '}
                    <span className="font-mono">
                      {formatBytes(localBackupStats.totalBytes || 0)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
    
          <div className="app-card p-8 rounded-3xl flex flex-col items-center text-center md:col-span-2">
            <AlertTriangle size={40} className="text-red-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">إعادة ضبط المصنع</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
              تصفير/حذف البيانات يتم من شاشة إدارة قاعدة البيانات. تأكد من عمل نسخة احتياطية
              أولاً.
            </p>
            <button
              onClick={goToDatabaseReset}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700"
            >
              فتح شاشة التصفير
            </button>
          </div>
        </div>
      </div>
    </RBACGuard>
  );
}
