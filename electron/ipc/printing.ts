import type { IpcDeps } from './deps.js';
import * as ipc from './context.js';
import { currentFeedUrl, lastUpdaterEvent, setCurrentFeedUrl } from './context.js';
import { ipcMain, dialog, app } from 'electron';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { validateInstallerCandidate } from '../security/updaterInstallValidation.js';
import { printEngine, type PrintEngineJob } from '../printing';
import {
  getPrintSettingsFilePath,
  loadPrintSettings,
  savePrintSettings,
} from '../printing/settings/store';
import { desktopUserHasPermission } from '../printing/permissions';
import {
  htmlToPdfFromHtml,
  parsePrintingHtmlPayload,
  printHtmlInHiddenWindow,
  saveHtmlPdfToFilePath,
} from '../printing/htmlDocumentWindow';
import { toErrorMessage } from '../utils/errors';

export function registerPrinting(deps: IpcDeps): void {
  void deps;
  // =====================
  // Auto Update
  // =====================
  
  ipc.configureUpdaterIfPossible();
  
  if (ipc.autoUpdater) {
    ipc.autoUpdater.on('checking-for-update', () => ipc.broadcastUpdaterEvent({ type: 'checking' }));
    ipc.autoUpdater.on('update-available', (info: UpdateInfo) =>
      ipc.broadcastUpdaterEvent({ type: 'available', data: info })
    );
    ipc.autoUpdater.on('update-not-available', (info: UpdateInfo) =>
      ipc.broadcastUpdaterEvent({ type: 'not-available', data: info })
    );
    ipc.autoUpdater.on('download-progress', (progress: ProgressInfo) =>
      ipc.broadcastUpdaterEvent({ type: 'progress', data: progress })
    );
    ipc.autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) =>
      ipc.broadcastUpdaterEvent({ type: 'downloaded', data: info })
    );
    ipc.autoUpdater.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      ipc.broadcastUpdaterEvent({ type: 'error', message });
    });
  }
  
  // Automatic update check on startup (packaged app only).
  if (app.isPackaged && ipc.autoUpdater && (currentFeedUrl || ipc.hasEmbeddedUpdaterConfig())) {
    const updater = ipc.autoUpdater;
    setTimeout(() => {
      void (async () => {
        try {
          await updater.checkForUpdates();
        } catch (e: unknown) {
          ipc.broadcastUpdaterEvent({
            type: 'error',
            message: toErrorMessage(e, 'فشل التحقق من التحديثات تلقائياً'),
          });
        }
      })();
    }, 3000);
  }
  ipcMain.handle('updater:getVersion', () => app.getVersion());
  ipcMain.handle('updater:getStatus', () => ({
    isPackaged: app.isPackaged,
    feedUrl: currentFeedUrl,
    lastEvent: lastUpdaterEvent,
  }));
  ipcMain.handle('updater:setFeedUrl', async (_e, url: string) => {
    try {
      const normalized = ipc.normalizeFeedUrl(url);
      setCurrentFeedUrl(normalized);
  
      try {
        await ipc.writeUpdaterSettings({ feedUrl: normalized });
      } catch {
        // ignore persistence errors
      }
  
      if (app.isPackaged) {
        if (!ipc.autoUpdater)
          return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
        ipc.autoUpdater.setFeedURL({ provider: 'generic', url: normalized } as ipc.UpdaterSetFeedUrlArg);
      }
  
      ipc.broadcastUpdaterEvent({ type: 'feed-url', data: { feedUrl: normalized } });
      return { success: true, feedUrl: normalized };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل ضبط رابط التحديث') };
    }
  });
  
  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      return {
        success: false,
        message: 'ميزة التحديث التلقائي تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).',
      };
    }
    if (!ipc.autoUpdater) {
      return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
    }
    try {
      const res = await ipc.autoUpdater.checkForUpdates();
      const available = !!res?.updateInfo;
      return { success: true, updateAvailable: available, info: res?.updateInfo };
    } catch (e: unknown) {
      if (!currentFeedUrl && !ipc.hasEmbeddedUpdaterConfig()) {
        return {
          success: false,
          message:
            'لم يتم ضبط رابط التحديث. يرجى تحديده في إعدادات النظام أو عبر المتغير AZRAR_UPDATE_URL.',
        };
      }
      return { success: false, message: toErrorMessage(e, 'فشل التحقق من التحديث') };
    }
  });
  
  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged) {
      return {
        success: false,
        message: 'ميزة التحديث التلقائي تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).',
      };
    }
    if (!ipc.autoUpdater) {
      return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
    }
    try {
      await ipc.autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e: unknown) {
      if (!currentFeedUrl && !ipc.hasEmbeddedUpdaterConfig()) {
        return {
          success: false,
          message:
            'لم يتم ضبط رابط التحديث. يرجى تحديده في إعدادات النظام أو عبر المتغير AZRAR_UPDATE_URL.',
        };
      }
      return { success: false, message: toErrorMessage(e, 'فشل تنزيل التحديث') };
    }
  });
  
  ipcMain.handle('updater:install', async () => {
    if (!app.isPackaged) {
      return {
        success: false,
        message: 'ميزة التحديث التلقائي تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).',
      };
    }
    if (!ipc.autoUpdater) {
      return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
    }
    try {
      // Mandatory backup before installing any update.
      try {
        await ipc.createMandatoryPreUpdateBackup('install');
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
      ipc.autoUpdater.quitAndInstall(true, true);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل تثبيت التحديث') };
    }
  });
  
  ipcMain.handle('updater:installFromFile', async () => {
    const result = (await dialog.showOpenDialog({
      title: 'اختر ملف تحديث (مثبت البرنامج)',
      filters: [{ name: 'Installer', extensions: ['exe'] }],
      properties: ['openFile'],
    })) as unknown as Electron.OpenDialogReturnValue;
  
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
  
    const v = validateInstallerCandidate(resolved, st, ipc.MAX_INSTALLER_BYTES);
    if (!v.ok) return { success: false, message: v.reason || 'ملف التحديث غير صالح' };
  
    // Verify the Windows Authenticode signature before running any external installer.
    // This reduces the risk of running a tampered file.
    const sig = ipc.verifyWindowsExeAuthenticodeSync(resolved);
    if (!sig.ok) return { success: false, message: sig.message };
  
    try {
      // Mandatory backup before running external installer.
      try {
        await ipc.createMandatoryPreUpdateBackup('installFromFile');
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
  ipcMain.handle('updater:getPendingRestore', async () => {
    return ipc.readPendingRestoreInfo();
  });
  ipcMain.handle('updater:clearPendingRestore', async () => {
    await ipc.clearPendingRestoreInfo();
    return { success: true };
  });
  ipcMain.handle('updater:restorePending', async () => {
    return ipc.restoreFromPendingBackup();
  });
  ipcMain.handle('print:engine:run', async (e, job: PrintEngineJob) => {
    const userId = ipc.getSessionUserId(e.sender);
    const required = ipc.requiredPrintPermissionForJob(job);
    if (!desktopUserHasPermission(userId, required)) {
      return { ok: false, code: 'FORBIDDEN', message: 'غير مصرح لك باستخدام الطباعة/التصدير' };
    }
  
    return printEngine.run(job, { webContents: e.sender });
  });
  
  ipcMain.handle('print:dispatch', async (e, request: unknown) => {
    try {
      if (!request || typeof request !== 'object') {
        return { ok: false, code: 'INVALID', message: 'طلب الطباعة غير صالح' };
      }
  
      const r = request as Record<string, unknown>;
      const action = String(r.action ?? '').trim();
      const documentType = String(r.documentType ?? '').trim();
      const entityId = typeof r.entityId === 'string' ? String(r.entityId).trim() : '';
  
      if (!action || !documentType) {
        return { ok: false, code: 'INVALID', message: 'بيانات الطلب غير مكتملة' };
      }
  
      const userId = ipc.getSessionUserId(e.sender);
  
      // Phase 10: unified dispatch (no print logic in renderer; only metadata + routing).
      if (action === 'printCurrentView') {
        const allowed = desktopUserHasPermission(userId, 'PRINT_EXECUTE');
        if (!allowed)
          return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنفيذ الطباعة' };
  
        // We intentionally ignore documentType/entityId/data here (for now) but we require them
        // so every UI entry-point sends consistent metadata.
        void documentType;
        void entityId;
        void r.data;
  
        return await printEngine.run(
          { type: 'currentView', mode: 'print' },
          { webContents: e.sender }
        );
      }
  
      if (action === 'printText') {
        const allowed = desktopUserHasPermission(userId, 'PRINT_EXECUTE');
        if (!allowed)
          return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنفيذ الطباعة' };
  
        const text = typeof r.text === 'string' ? String(r.text) : '';
        const title = typeof r.title === 'string' ? String(r.title) : undefined;
        if (!text.trim()) return { ok: false, code: 'INVALID', message: 'النص فارغ' };
  
        void documentType;
        void entityId;
        void r.data;
  
        return await printEngine.run(
          { type: 'text', mode: 'print', payload: { title, text } },
          { webContents: e.sender }
        );
      }
  
      if (action === 'generate') {
        const templateName =
          typeof r.templateName === 'string' ? String(r.templateName) : undefined;
        const outputType =
          r.outputType === 'pdf' || r.outputType === 'docx'
            ? (r.outputType as 'pdf' | 'docx')
            : undefined;
        const defaultFileName =
          typeof r.defaultFileName === 'string' ? String(r.defaultFileName) : undefined;
        const data =
          r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : undefined;
        const headerFooter =
          r.headerFooter && typeof r.headerFooter === 'object'
            ? (r.headerFooter as Record<string, unknown>)
            : undefined;
  
        if (!outputType) return { ok: false, code: 'INVALID', message: 'نوع الإخراج غير صالح' };
        if (!data) return { ok: false, code: 'INVALID', message: 'بيانات القالب غير صالحة' };
  
        const job: PrintEngineJob = {
          type: 'generate',
          mode: 'generate',
          payload: {
            templateName,
            data,
            outputType,
            defaultFileName,
            headerFooter: headerFooter as never,
          },
        };
  
        const required = ipc.requiredPrintPermissionForJob(job);
        if (!desktopUserHasPermission(userId, required)) {
          return { ok: false, code: 'FORBIDDEN', message: 'غير مصرح لك باستخدام الطباعة/التصدير' };
        }
  
        void documentType;
        void entityId;
        return await printEngine.run(job, { webContents: e.sender });
      }
  
      if (action === 'exportDocx') {
        const templateName =
          typeof r.templateName === 'string' ? String(r.templateName) : undefined;
        const defaultFileName =
          typeof r.defaultFileName === 'string' ? String(r.defaultFileName) : undefined;
        const data =
          r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : undefined;
        const headerFooter =
          r.headerFooter && typeof r.headerFooter === 'object'
            ? (r.headerFooter as Record<string, unknown>)
            : undefined;
        if (!data) return { ok: false, code: 'INVALID', message: 'بيانات القالب غير صالحة' };
  
        const job: PrintEngineJob = {
          type: 'docx',
          mode: 'docx',
          payload: {
            templateName,
            data,
            defaultFileName,
            headerFooter: headerFooter as never,
          },
        };
  
        const required = ipc.requiredPrintPermissionForJob(job);
        if (!desktopUserHasPermission(userId, required)) {
          return { ok: false, code: 'FORBIDDEN', message: 'غير مصرح لك باستخدام الطباعة/التصدير' };
        }
  
        void documentType;
        void entityId;
        return await printEngine.run(job, { webContents: e.sender });
      }
  
      if (action === 'printHtml') {
        const allowed = desktopUserHasPermission(userId, 'PRINT_EXECUTE');
        if (!allowed)
          return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنفيذ الطباعة' };
  
        const parsed = parsePrintingHtmlPayload(request);
        if (!parsed.ok) return { ok: false, code: 'INVALID', message: parsed.message };
  
        void documentType;
        void entityId;
        void r.data;
  
        const job: PrintEngineJob = {
          type: 'printHtml',
          mode: 'print',
          payload: {
            html: parsed.value.html,
            orientation: parsed.value.orientation,
            marginsMm: parsed.value.marginsMm,
            pageRanges: parsed.value.pageRanges,
            copies: parsed.value.copies,
            defaultFileName: parsed.value.defaultFileName,
          },
        };
  
        return await printEngine.run(job, { webContents: e.sender });
      }
  
      return { ok: false, code: 'INVALID', message: 'إجراء الطباعة غير معروف' };
    } catch (err: unknown) {
      return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل تنفيذ طلب الطباعة') };
    }
  });
  
  ipcMain.handle('printing:printHtml', async (e, payload: unknown) => {
    const parsed = parsePrintingHtmlPayload(payload);
    if (!parsed.ok) return { ok: false, code: 'INVALID', message: parsed.message };
    const userId = ipc.getSessionUserId(e.sender);
    if (!desktopUserHasPermission(userId, 'PRINT_EXECUTE')) {
      return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنفيذ الطباعة' };
    }
    return printHtmlInHiddenWindow(parsed.value.html, {
      orientation: parsed.value.orientation,
      marginsMm: parsed.value.marginsMm,
      pageRanges: parsed.value.pageRanges,
      copies: parsed.value.copies,
      defaultFileName: parsed.value.defaultFileName,
    });
  });
  
  ipcMain.handle('printing:htmlToPdf', async (e, payload: unknown) => {
    const parsed = parsePrintingHtmlPayload(payload);
    if (!parsed.ok) return { ok: false, code: 'INVALID', message: parsed.message };
    const userId = ipc.getSessionUserId(e.sender);
    if (!desktopUserHasPermission(userId, 'PRINT_EXECUTE')) {
      return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنفيذ الطباعة' };
    }
    return htmlToPdfFromHtml(parsed.value.html, {
      orientation: parsed.value.orientation,
      marginsMm: parsed.value.marginsMm,
      pageRanges: parsed.value.pageRanges,
      copies: parsed.value.copies,
      defaultFileName: parsed.value.defaultFileName,
    });
  });
  
  ipcMain.handle('report:savePdfToPath', async (e, payload: unknown) => {
    const parsed = parsePrintingHtmlPayload(payload);
    if (!parsed.ok) return { ok: false, code: 'INVALID', message: parsed.message };
    const userId = ipc.getSessionUserId(e.sender);
    if (!desktopUserHasPermission(userId, 'PRINT_EXECUTE')) {
      return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنفيذ الطباعة' };
    }
    const r = payload as Record<string, unknown>;
    const filePath = typeof r.filePath === 'string' ? r.filePath.trim() : '';
    if (!filePath) {
      return { ok: false, code: 'INVALID', message: 'مسار الملف مطلوب' };
    }
    return saveHtmlPdfToFilePath(parsed.value.html, filePath, {
      orientation: parsed.value.orientation,
      marginsMm: parsed.value.marginsMm,
      pageRanges: parsed.value.pageRanges,
      copies: parsed.value.copies,
      defaultFileName: parsed.value.defaultFileName,
    });
  });
  
  ipcMain.handle('print:preview:open', async (e, payload: unknown) => {
    const { openPrintPreview } = await import('../printing/preview/previewManager');
    const userId = ipc.getSessionUserId(e.sender);
    return openPrintPreview(payload as never, { userId });
  });
  
  ipcMain.handle('print:preview:getState', async (_e, sessionId: unknown) => {
    const { getPrintPreviewState } = await import('../printing/preview/previewManager');
    return getPrintPreviewState(String(sessionId ?? ''));
  });
  
  ipcMain.handle('print:preview:listPrinters', async (e) => {
    const { listPreviewPrinters } = await import('../printing/preview/previewManager');
    return listPreviewPrinters(e.sender);
  });
  
  ipcMain.handle('print:preview:print', async (_e, sessionId: unknown, options?: unknown) => {
    const { printFromPreview } = await import('../printing/preview/previewManager');
    return printFromPreview(String(sessionId ?? ''), (options as never) || undefined);
  });
  
  ipcMain.handle('print:preview:exportPdf', async (_e, sessionId: unknown) => {
    const { exportPdfFromPreview } = await import('../printing/preview/previewManager');
    return exportPdfFromPreview(String(sessionId ?? ''));
  });
  
  ipcMain.handle('print:preview:exportDocx', async (_e, sessionId: unknown) => {
    const { exportDocxFromPreview } = await import('../printing/preview/previewManager');
    return exportDocxFromPreview(String(sessionId ?? ''));
  });
  
  ipcMain.handle('print:preview:reload', async (_e, sessionId: unknown) => {
    const { reloadPreview } = await import('../printing/preview/previewManager');
    return reloadPreview(String(sessionId ?? ''));
  });
  
  ipcMain.handle('print:settings:get', async () => {
    return loadPrintSettings();
  });
  
  ipcMain.handle('print:settings:save', async (e, settings: unknown) => {
    const userId = ipc.getSessionUserId(e.sender);
    const allowed =
      desktopUserHasPermission(userId, 'PRINT_SETTINGS_EDIT') ||
      desktopUserHasPermission(userId, 'SETTINGS_ADMIN');
    if (!allowed) {
      return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تعديل إعدادات الطباعة' };
    }
    return savePrintSettings(settings);
  });
  
  ipcMain.handle('print:settings:getPath', async () => {
    try {
      const filePath = await getPrintSettingsFilePath();
      return { ok: true, filePath };
    } catch (err: unknown) {
      return {
        ok: false,
        code: 'FAILED',
        message: toErrorMessage(err, 'فشل تحديد مسار إعدادات الطباعة'),
      };
    }
  });
}
