import { app, dialog, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { spawn } from 'node:child_process';

import type { autoUpdater as ElectronAutoUpdater } from 'electron-updater';

type HandleTrusted = (
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
) => void;

type AutoUpdaterType = typeof ElectronAutoUpdater;
type UpdaterSetFeedUrlArg = Parameters<NonNullable<AutoUpdaterType>['setFeedURL']>[0];

export function registerUpdaterHandlers(opts: {
  handleTrusted: HandleTrusted;

  // State accessors
  getCurrentFeedUrl: () => string | null;
  setCurrentFeedUrl: (url: string) => void;
  getLastUpdaterEvent: () => unknown;

  // Dependencies / helpers
  autoUpdater: AutoUpdaterType | undefined;
  broadcastUpdaterEvent: (payload: { type: string; message?: string; data?: unknown }) => void;
  toErrorMessage: (e: unknown, fallback: string) => string;
  normalizeFeedUrl: (raw: string) => string;
  hasEmbeddedUpdaterConfig: () => boolean;
  writeUpdaterSettings: (settings: { feedUrl?: string }) => Promise<void>;

  validateInstallerCandidate: (
    filePath: string,
    st: fs.Stats,
    maxBytes: number
  ) => { ok: boolean; message?: string };
  maxInstallerBytes: number;
  verifyWindowsExeAuthenticodeSync: (filePath: string) => { ok: boolean; message?: string };
  createMandatoryPreUpdateBackup: (reason: 'install' | 'installFromFile') => Promise<unknown>;

  readPendingRestoreInfo: () => Promise<unknown>;
  clearPendingRestoreInfo: () => Promise<void>;
  restoreFromPendingBackup: () => Promise<{ success: boolean; message?: string }>;
}) {
  const {
    handleTrusted,
    getCurrentFeedUrl,
    setCurrentFeedUrl,
    getLastUpdaterEvent,
    autoUpdater,
    broadcastUpdaterEvent,
    toErrorMessage,
    normalizeFeedUrl,
    hasEmbeddedUpdaterConfig,
    writeUpdaterSettings,
    validateInstallerCandidate,
    maxInstallerBytes,
    verifyWindowsExeAuthenticodeSync,
    createMandatoryPreUpdateBackup,
    readPendingRestoreInfo,
    clearPendingRestoreInfo,
    restoreFromPendingBackup,
  } = opts;

  // =====================
  // Auto Update IPC
  // =====================

  handleTrusted('updater:getVersion', () => app.getVersion());
  handleTrusted('updater:getStatus', () => ({
    isPackaged: app.isPackaged,
    feedUrl: getCurrentFeedUrl(),
    lastEvent: getLastUpdaterEvent(),
  }));

  handleTrusted('updater:setFeedUrl', async (_e, url: string) => {
    try {
      const normalized = normalizeFeedUrl(url);
      setCurrentFeedUrl(normalized);

      try {
        await writeUpdaterSettings({ feedUrl: normalized });
      } catch {
        // ignore persistence errors
      }

      if (app.isPackaged) {
        if (!autoUpdater)
          return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
        autoUpdater.setFeedURL({ provider: 'generic', url: normalized } as UpdaterSetFeedUrlArg);
      }

      broadcastUpdaterEvent({ type: 'feed-url', data: { feedUrl: normalized } });
      return { success: true, feedUrl: normalized };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل ضبط رابط التحديث') };
    }
  });

  handleTrusted('updater:check', async () => {
    if (!app.isPackaged) {
      return {
        success: false,
        message: 'ميزة التحديث التلقائي تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).',
      };
    }
    if (!autoUpdater) {
      return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
    }
    try {
      const res = await autoUpdater.checkForUpdates();
      const updateInfo = (
        res as
          | {
              updateInfo?: unknown;
            }
          | null
          | undefined
      )?.updateInfo;
      const available = Boolean(updateInfo);
      return { success: true, updateAvailable: available, info: updateInfo };
    } catch (e: unknown) {
      if (!getCurrentFeedUrl() && !hasEmbeddedUpdaterConfig()) {
        return {
          success: false,
          message:
            'لم يتم ضبط رابط التحديث. يرجى تحديده في إعدادات النظام أو عبر المتغير AZRAR_UPDATE_URL.',
        };
      }
      return { success: false, message: toErrorMessage(e, 'فشل التحقق من التحديث') };
    }
  });

  handleTrusted('updater:download', async () => {
    if (!app.isPackaged) {
      return {
        success: false,
        message: 'ميزة التحديث التلقائي تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).',
      };
    }
    if (!autoUpdater) {
      return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e: unknown) {
      if (!getCurrentFeedUrl() && !hasEmbeddedUpdaterConfig()) {
        return {
          success: false,
          message:
            'لم يتم ضبط رابط التحديث. يرجى تحديده في إعدادات النظام أو عبر المتغير AZRAR_UPDATE_URL.',
        };
      }
      return { success: false, message: toErrorMessage(e, 'فشل تنزيل التحديث') };
    }
  });

  handleTrusted('updater:install', async () => {
    if (!app.isPackaged) {
      return {
        success: false,
        message: 'ميزة التحديث التلقائي تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).',
      };
    }
    if (!autoUpdater) {
      return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
    }
    try {
      // Mandatory backup before installing any update.
      try {
        await createMandatoryPreUpdateBackup('install');
      } catch (e: unknown) {
        return {
          success: false,
          message: toErrorMessage(
            e,
            'فشل أخذ نسخة احتياطية قبل التحديث. تم إيقاف التحديث حفاظاً على البيانات.'
          ),
        };
      }
      // This quits the app and runs the installer for the downloaded update.
      autoUpdater.quitAndInstall(true, true);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل تثبيت التحديث') };
    }
  });

  handleTrusted('updater:installFromFile', async () => {
    if (!app.isPackaged) {
      return {
        success: false,
        message: 'ميزة تثبيت التحديث من ملف تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).',
      };
    }

    const result = await dialog.showOpenDialog({
      title: 'اختر ملف تحديث (مثبت البرنامج)',
      filters: [{ name: 'Installer', extensions: ['exe'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'تم الإلغاء' };
    }

    const installerPath = String(result.filePaths[0] || '').trim();
    if (!installerPath) {
      return { success: false, message: 'مسار الملف غير صالح' };
    }

    let resolved = installerPath;
    try {
      resolved = await fsp.realpath(installerPath);
    } catch {
      // keep raw
    }

    let st: fs.Stats;
    try {
      st = await fsp.stat(resolved);
    } catch {
      return { success: false, message: 'ملف التحديث غير موجود' };
    }

    const v = validateInstallerCandidate(resolved, st, maxInstallerBytes);
    if (!v.ok) return { success: false, message: v.message || 'ملف التحديث غير صالح' };

    // Verify the Windows Authenticode signature before running any external installer.
    // This reduces the risk of running a tampered file.
    const sig = verifyWindowsExeAuthenticodeSync(resolved);
    if (!sig.ok) return { success: false, message: sig.message };

    try {
      // Mandatory backup before running external installer.
      try {
        await createMandatoryPreUpdateBackup('installFromFile');
      } catch (e: unknown) {
        return {
          success: false,
          message: toErrorMessage(
            e,
            'فشل أخذ نسخة احتياطية قبل التحديث. تم إيقاف التحديث حفاظاً على البيانات.'
          ),
        };
      }
      // Run installer detached, then quit the app.
      spawn(resolved, [], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => {
        try {
          app.quit();
        } catch {
          // ignore
        }
      }, 200);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل تشغيل ملف التحديث') };
    }
  });

  // Post-update restore flow
  handleTrusted('updater:getPendingRestore', async () => {
    return readPendingRestoreInfo();
  });
  handleTrusted('updater:clearPendingRestore', async () => {
    await clearPendingRestoreInfo();
    return { success: true };
  });
  handleTrusted('updater:restorePending', async () => {
    return restoreFromPendingBackup();
  });
}
