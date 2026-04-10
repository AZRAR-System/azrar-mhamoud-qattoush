import type { IpcDeps } from './deps.js';
import * as ipc from './context.js';
import { dbMaintenanceMode, setDbMaintenanceMode } from './context.js';
import { ipcMain, dialog, app, safeStorage } from 'electron';

import {
  kvDelete,
  kvGet,
  kvGetDeletedAt,
  kvGetMeta,
  kvKeys,
  kvResetAll,
  kvSet,
  domainSyncAfterKvSet,
  getDbPath,
  exportDatabaseToMany,
  importDatabase,
} from '../db';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pushKvDelete, pushKvUpsert, logSyncError } from '../sqlSync';
import logger from '../logger';
import { toErrorMessage } from '../utils/errors';
import {
  decryptFileToFile,
  encryptFileToFile,
  isEncryptedFile,
} from '../utils/fileEncryption';
import {
  decryptSecretBestEffort,
  encryptSecretBestEffort,
  getBackupEncryptionPasswordState,
  readBackupEncryptionSettings,
  writeBackupEncryptionSettings,
  type BackupEncryptionSettings,
} from '../utils/backupEncryptionSettings';

export function registerDb(deps: IpcDeps): void {
  void deps;
  ipcMain.handle('db:get', (_e, key: string) => {
    if (dbMaintenanceMode) return null;
    const k = String(key || '').trim();
    if (!k.startsWith('db_')) return null;
    try {
      return kvGet(k);
    } catch (e: unknown) {
      const hint = ipc.getBetterSqlite3RebuildHint(e);
      const base = toErrorMessage(e, 'فشل قراءة بيانات محلية (db:get)');
      throw new Error(hint ? `${base}\n\n${hint}` : base);
    }
  });
  ipcMain.handle('db:set', (_e, key: string, value: string) => {
    if (dbMaintenanceMode) return false;
    const k = String(key || '').trim();
    if (!k.startsWith('db_')) return false;
    try {
      kvSet(k, value);
    } catch (e: unknown) {
      const hint = ipc.getBetterSqlite3RebuildHint(e);
      const base = toErrorMessage(e, 'فشل حفظ بيانات محلية (db:set)');
      throw new Error(hint ? `${base}\n\n${hint}` : base);
    }
    try {
      const sync = domainSyncAfterKvSet(k, value);
      if (!sync.ok) {
        try {
          console.warn('[db:set] domainSyncAfterKvSet:', sync.message || 'unknown');
        } catch {
          // ignore
        }
      }
    } catch (e: unknown) {
      try {
        console.warn('[db:set] domainSyncAfterKvSet threw:', e);
      } catch {
        // ignore
      }
    }
    try {
      const meta = kvGetMeta(k);
      const updatedAt = meta?.updatedAt || new Date().toISOString();
      void pushKvUpsert({ key: k, value, updatedAt }).catch((err: unknown) => {
        logSyncError('push:set', err);
      });
    } catch {
      // ignore
    }
    return true;
  });
  ipcMain.handle('db:delete', (_e, key: string) => {
    if (dbMaintenanceMode) return false;
    const k = String(key || '').trim();
    if (!k.startsWith('db_')) return false;
    try {
      kvDelete(k);
    } catch (e: unknown) {
      const hint = ipc.getBetterSqlite3RebuildHint(e);
      const base = toErrorMessage(e, 'فشل حذف بيانات محلية (db:delete)');
      throw new Error(hint ? `${base}\n\n${hint}` : base);
    }
    try {
      const deletedAt = kvGetDeletedAt(k) || new Date().toISOString();
      void pushKvDelete({ key: k, deletedAt }).catch((err: unknown) => {
        logSyncError('push:delete', err);
      });
    } catch {
      // ignore
    }
    return true;
  });
  ipcMain.handle('db:keys', () => {
    if (dbMaintenanceMode) return [];
    try {
      return kvKeys().filter((k) => String(k || '').startsWith('db_'));
    } catch (e: unknown) {
      const hint = ipc.getBetterSqlite3RebuildHint(e);
      const base = toErrorMessage(e, 'فشل قراءة مفاتيح البيانات (db:keys)');
      throw new Error(hint ? `${base}\n\n${hint}` : base);
    }
  });
  ipcMain.handle('db:resetAll', () => {
    if (dbMaintenanceMode) return { deleted: 0 };
    return kvResetAll('db_');
  });
  
  ipcMain.handle('db:getBackupDir', async () => {
    const settings = await ipc.readBackupSettings();
    const dir = settings.backupDir;
    if (dir && ipc.isExistingDirectory(dir)) return dir;
    return '';
  });
  
  ipcMain.handle('db:chooseBackupDir', async () => {
    const dir = await ipc.chooseBackupDirViaDialog();
    if (!dir) return { success: false, message: 'تم الإلغاء' };
    try {
      await ipc.writeBackupSettings({ backupDir: dir });
      return { success: true, message: 'تم حفظ مجلد النسخ الاحتياطي', backupDir: dir };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل حفظ مجلد النسخ الاحتياطي') };
    }
  });
  
  ipcMain.handle('db:chooseDirectory', async () => {
    const result = (await dialog.showOpenDialog({
      title: 'اختر مجلد',
      properties: ['openDirectory', 'createDirectory'],
    })) as any;
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'تم الإلغاء' };
    }
    return { success: true, path: result.filePaths[0] };
  });
  
  ipcMain.handle('db:getLocalBackupAutomationSettings', async () => {
    return await ipc.readLocalBackupAutomationSettings();
  });
  
  ipcMain.handle(
    'db:saveLocalBackupAutomationSettings',
    async (_e, payload: Record<string, unknown> | undefined) => {
      try {
        const current = await ipc.readLocalBackupAutomationSettings();
        const next: ipc.LocalBackupAutomationSettings = {
          ...current,
          v: 1,
          enabled: payload?.enabled === true,
          timeHHmm: ipc.normalizeTimeHHmm(payload?.timeHHmm ?? current.timeHHmm),
          retentionDays: ipc.normalizeRetentionDays(payload?.retentionDays ?? current.retentionDays),
          lastRunAt: typeof current.lastRunAt === 'string' ? current.lastRunAt : undefined,
        };
        await ipc.writeLocalBackupAutomationSettings(next);
        ipc.startLocalAutoBackupScheduler();
        return {
          success: true,
          message: 'تم حفظ إعدادات النسخ الاحتياطي التلقائي',
          settings: await ipc.readLocalBackupAutomationSettings(),
        };
      } catch (e: unknown) {
        return {
          success: false,
          message: toErrorMessage(e, 'فشل حفظ إعدادات النسخ الاحتياطي التلقائي'),
        };
      }
    }
  );
  
  ipcMain.handle('db:getLocalBackupStats', async () => {
    try {
      const backupSettings = await ipc.readBackupSettings();
      const dir =
        backupSettings.backupDir && ipc.isExistingDirectory(backupSettings.backupDir)
          ? backupSettings.backupDir
          : '';
      return await ipc.getLocalBackupStatsBestEffort(dir);
    } catch (e: unknown) {
      return {
        ok: false,
        message: toErrorMessage(e, 'فشل قراءة إحصائيات النسخ الاحتياطي'),
        dbArchivesCount: 0,
        attachmentsArchivesCount: 0,
        latestDbExists: false,
        latestAttachmentsExists: false,
        totalBytes: 0,
        newestMtimeMs: 0,
        files: [],
      };
    }
  });
  
  ipcMain.handle('db:getLocalBackupLog', async (_e, payload: { limit?: number } | undefined) => {
    const limit = payload?.limit;
    return await ipc.readLocalBackupLogEntries(typeof limit === 'number' ? limit : 200);
  });
  
  ipcMain.handle('db:clearLocalBackupLog', async () => {
    await ipc.clearLocalBackupLog();
    return { ok: true };
  });
  
  ipcMain.handle('db:runLocalBackupNow', async () => {
    try {
      const backupSettings = await ipc.readBackupSettings();
      const dir =
        backupSettings.backupDir && ipc.isExistingDirectory(backupSettings.backupDir)
          ? backupSettings.backupDir
          : '';
      if (!dir) return { success: false, message: 'مجلد النسخ الاحتياطي غير مضبوط' };
  
      const res = await ipc.runLocalBackupToDir(dir);
      if (!res.ok) {
        await ipc.appendLocalBackupLogEntry({
          ts: new Date().toISOString(),
          ok: false,
          trigger: 'manual',
          message: res.message || 'فشل إنشاء النسخة الاحتياطية',
        });
        return { success: false, message: res.message || 'فشل إنشاء النسخة الاحتياطية' };
      }
  
      const st = await ipc.readLocalBackupAutomationSettings();
      await ipc.writeLocalBackupAutomationSettings({
        ...st,
        enabled: st.enabled === true,
        lastRunAt: new Date().toISOString(),
      });
      await ipc.pruneLocalBackupsBestEffort(dir, st.retentionDays ?? 30);
  
      await ipc.appendLocalBackupLogEntry({
        ts: new Date().toISOString(),
        ok: true,
        trigger: 'manual',
        message: 'تم إنشاء نسخة احتياطية يدوياً',
        latestPath: res.latestPath,
        archivePath: res.archivePath,
        attachmentsLatestPath: res.attachmentsLatestPath,
        attachmentsArchivePath: res.attachmentsArchivePath,
      });
      return {
        success: true,
        message: 'تم إنشاء نسخة احتياطية كاملة بنجاح',
        latestPath: res.latestPath,
        archivePath: res.archivePath,
        attachmentsLatestPath: res.attachmentsLatestPath,
        attachmentsArchivePath: res.attachmentsArchivePath,
      };
    } catch (e: unknown) {
      await ipc.appendLocalBackupLogEntry({
        ts: new Date().toISOString(),
        ok: false,
        trigger: 'manual',
        message: toErrorMessage(e, 'فشل إنشاء النسخة الاحتياطية'),
      });
      return { success: false, message: toErrorMessage(e, 'فشل إنشاء النسخة الاحتياطية') };
    }
  });
  
  // Delete a specific backup file
  ipcMain.handle('db:deleteLocalBackupFile', async (_, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, message: 'الملف غير موجود' };
      }
  
      // Basic safety: ensure it's in a backup directory
      const settings = await ipc.readBackupSettings();
      const backupDir = settings.backupDir;
      if (backupDir && !filePath.startsWith(backupDir)) {
        return { success: false, message: 'لا يمكن حذف ملفات خارج مجلد النسخ الاحتياطي' };
      }
  
      await fsp.unlink(filePath);
      return { success: true, message: 'تم حذف النسخة الاحتياطية بنجاح' };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل حذف الملف') };
    }
  });
  
  // Restore a specific backup file (takes full path)
  ipcMain.handle('db:restoreLocalBackupFile', async (_, filePath: string) => {
    if (dbMaintenanceMode)
      return { success: false, message: 'قاعدة البيانات قيد الاسترجاع/الصيانة. حاول لاحقاً.' };
  
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, message: 'الملف غير موجود' };
      }
  
      const isEncrypted = filePath.endsWith('.enc');
      let password = '';
  
      if (isEncrypted) {
        const encState = await getBackupEncryptionPasswordState();
        if (!encState.configured || !encState.password) {
          return {
            success: false,
            message: 'الملف مشفر ولكن لم يتم ضبط كلمة مرور التشفير في الإعدادات.',
          };
        }
        password = encState.password;
      }
  
      // We use the same internal logic as db:import but with the provided path.
      setDbMaintenanceMode(true);
      try {
        await ipc.importDatabaseFrom(filePath, password);
        return { success: true, message: 'تم استعادة البيانات بنجاح. سيتم إعادة تشغيل البرنامج.' };
      } finally {
        setDbMaintenanceMode(false);
      }
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل استعادة النسخة الاحتياطية') };
    }
  });
  
  // Export database to user-selected folder
  // Creates both a stable "latest" backup and a dated archive backup.
  ipcMain.handle('db:export', async () => {
    if (dbMaintenanceMode)
      return { success: false, message: 'قاعدة البيانات قيد الاسترجاع/الصيانة. حاول لاحقاً.' };
  
    // Remember first selected backup folder and reuse it.
    const settings = await ipc.readBackupSettings();
    let dir =
      settings.backupDir && ipc.isExistingDirectory(settings.backupDir) ? settings.backupDir : null;
  
    if (!dir) {
      const result = (await dialog.showOpenDialog({
        title: 'اختر مجلد حفظ النسخة الاحتياطية (سيتم حفظه تلقائياً)',
        properties: ['openDirectory', 'createDirectory'],
      })) as any;
  
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: 'تم الإلغاء' };
      }
  
      dir = result.filePaths[0];
      try {
        await ipc.writeBackupSettings({ backupDir: dir });
      } catch {
        // ignore persistence failures
      }
    }
  
    const encState = await getBackupEncryptionPasswordState();
    const encryptionRequested = encState.enabled;
    const encryptionConfigured = encState.configured;
    const encryptionPassword = encState.password;
  
    const today = new Date().toISOString().slice(0, 10);
  
    const latestPath = path.join(
      dir,
      encryptionRequested ? 'AZRAR-backup-latest.db.enc' : 'AZRAR-backup-latest.db'
    );
  
    const makeUniqueArchivePath = (basePath: string) => {
      const ext = path.extname(basePath);
      const stem = basePath.slice(0, -ext.length);
      let candidate = basePath;
      let i = 2;
      while (fs.existsSync(candidate)) {
        candidate = `${stem}-${i}${ext}`;
        i += 1;
      }
      return candidate;
    };
  
    const archiveBase = path.join(
      dir,
      encryptionRequested ? `AZRAR-backup-${today}.db.enc` : `AZRAR-backup-${today}.db`
    );
    const archivePath = makeUniqueArchivePath(archiveBase);
  
    const attachmentsLatestPath = path.join(
      dir,
      encryptionRequested
        ? 'AZRAR-attachments-latest.tar.gz.enc'
        : 'AZRAR-attachments-latest.tar.gz'
    );
  
    const attachmentsArchiveBase = path.join(
      dir,
      encryptionRequested
        ? `AZRAR-attachments-${today}.tar.gz.enc`
        : `AZRAR-attachments-${today}.tar.gz`
    );
    const attachmentsArchivePath = makeUniqueArchivePath(attachmentsArchiveBase);
  
    try {
      setDbMaintenanceMode(true);
      if (!encryptionRequested) {
        await exportDatabaseToMany([latestPath, archivePath]);
      } else {
        if (!encryptionConfigured || !encryptionPassword) {
          throw new Error(
            'تشفير النسخ الاحتياطية مفعل لكن كلمة المرور غير مضبوطة. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.'
          );
        }
  
        const tmpPlain = path.join(app.getPath('temp'), `AZRAR-backup-tmp-${Date.now()}.db`);
        try {
          await exportDatabaseToMany([tmpPlain]);
          await encryptFileToFile({
            sourcePath: tmpPlain,
            destPath: latestPath,
            password: encryptionPassword,
          });
          await encryptFileToFile({
            sourcePath: tmpPlain,
            destPath: archivePath,
            password: encryptionPassword,
          });
        } finally {
          try {
            await fsp.unlink(tmpPlain);
          } catch {
            // ignore
          }
        }
      }
      // Attachments archive (best-effort)
      let attachmentsCopied = false;
      try {
        const res = await ipc.exportAttachmentsArchiveToMany({
          destPaths: [attachmentsLatestPath, attachmentsArchivePath],
          encryptionRequested,
          encryptionConfigured,
          encryptionPassword,
        });
        attachmentsCopied = res.copiedAny;
      } catch {
        attachmentsCopied = false;
      }
  
      setDbMaintenanceMode(false);
      return {
        success: true,
        message: 'تم التصدير بنجاح',
        path: latestPath,
        latestPath,
        archivePath,
        attachmentsLatestPath: attachmentsCopied ? attachmentsLatestPath : undefined,
        attachmentsArchivePath: attachmentsCopied ? attachmentsArchivePath : undefined,
      };
    } catch (err: unknown) {
      setDbMaintenanceMode(false);
      return { success: false, message: toErrorMessage(err, 'فشل تصدير قاعدة البيانات') };
    }
  });
  
  // Import database from user-selected file
  ipcMain.handle('db:import', async () => {
    if (dbMaintenanceMode)
      return { success: false, message: 'قاعدة البيانات قيد الاسترجاع/الصيانة. حاول لاحقاً.' };
    const result = (await dialog.showOpenDialog({
      title: 'استيراد قاعدة البيانات',
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'Encrypted Backup', extensions: ['enc'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })) as any;
  
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'تم الإلغاء' };
    }
  
    try {
      const selected = result.filePaths[0];
      if (!selected) return { success: false, message: 'مسار الملف غير صالح' };
  
      const resolved = await fsp.realpath(selected).catch(() => path.resolve(selected));
      if (ipc.isUncPath(resolved))
        return { success: false, message: 'غير مسموح استيراد قاعدة البيانات من مسار شبكة (UNC)' };
  
      const ext = path.extname(resolved).toLowerCase();
      const looksEncryptedByExt = ext === '.enc';
      const looksEncryptedByMagic = await isEncryptedFile(resolved);
      const isEncrypted = looksEncryptedByExt || looksEncryptedByMagic;
  
      if (!isEncrypted) {
        if (!['.db', '.sqlite', '.sqlite3'].includes(ext)) {
          return {
            success: false,
            message:
              'الملف يجب أن يكون قاعدة بيانات SQLite (.db / .sqlite / .sqlite3) أو ملف نسخة مشفرة (.enc)',
          };
        }
      }
  
      const st = await fsp.stat(resolved);
      if (!st.isFile()) return { success: false, message: 'الملف غير صالح' };
      if (st.size <= 0) return { success: false, message: 'الملف فارغ' };
      if (st.size > ipc.MAX_DB_IMPORT_BYTES)
        return { success: false, message: 'حجم قاعدة البيانات كبير جداً' };
  
      setDbMaintenanceMode(true);
      if (!isEncrypted) {
        await importDatabase(resolved);
        // Best-effort: restore attachments if a companion archive exists next to the selected DB.
        let attachmentsRestored = false;
        let attachmentsMsg: string | undefined;
        try {
          const dir = path.dirname(resolved);
          const base = path.basename(resolved);
          const candByName = base
            .replace(/^AZRAR-backup-/, 'AZRAR-attachments-')
            .replace(/\.db(\.enc)?$/i, '.tar.gz$1');
  
          const candidates = [
            path.join(dir, candByName),
            path.join(dir, 'AZRAR-attachments-latest.tar.gz.enc'),
            path.join(dir, 'AZRAR-attachments-latest.tar.gz'),
          ];
  
          const archiveCandidate = candidates.find((p) => p && fs.existsSync(p));
          if (archiveCandidate) {
            const s = await readBackupEncryptionSettings();
            const password = s.passwordEnc
              ? decryptSecretBestEffort(String(s.passwordEnc || ''))
              : '';
            const r = await ipc.restoreAttachmentsFromArchiveBestEffort({
              archivePath: archiveCandidate,
              password,
            });
            attachmentsRestored = r.restored;
            attachmentsMsg = r.message;
          }
        } catch (e: unknown) {
          attachmentsMsg = toErrorMessage(e, 'فشل استعادة المرفقات');
          attachmentsRestored = false;
        }
  
        setDbMaintenanceMode(false);
        const msg = attachmentsRestored
          ? 'تم الاستيراد بنجاح (قاعدة البيانات + المرفقات) - أعد تشغيل التطبيق'
          : attachmentsMsg
            ? `تم الاستيراد بنجاح - أعد تشغيل التطبيق. ملاحظة: ${attachmentsMsg}`
            : 'تم الاستيراد بنجاح - أعد تشغيل التطبيق';
        return { success: true, message: msg, path: resolved, attachmentsRestored };
      }
  
      const enc = await readBackupEncryptionSettings();
      const encryptionPassword = enc.passwordEnc
        ? decryptSecretBestEffort(String(enc.passwordEnc || ''))
        : '';
      if (!encryptionPassword) {
        setDbMaintenanceMode(false);
        return {
          success: false,
          message:
            'لا توجد كلمة مرور لتشفير النسخ الاحتياطية. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.',
        };
      }
  
      const tmpPlain = path.join(app.getPath('temp'), `AZRAR-restore-tmp-${Date.now()}.db`);
      try {
        await decryptFileToFile({
          sourcePath: resolved,
          destPath: tmpPlain,
          password: encryptionPassword,
        });
        await importDatabase(tmpPlain);
      } finally {
        try {
          await fsp.unlink(tmpPlain);
        } catch {
          // ignore
        }
      }
  
      // Best-effort: restore attachments if a companion archive exists next to the selected DB.
      let attachmentsRestored = false;
      let attachmentsMsg: string | undefined;
      try {
        const dir = path.dirname(resolved);
        const base = path.basename(resolved);
        const candByName = base
          .replace(/^AZRAR-backup-/, 'AZRAR-attachments-')
          .replace(/\.db(\.enc)?$/i, '.tar.gz$1');
  
        const candidates = [
          path.join(dir, candByName),
          path.join(dir, 'AZRAR-attachments-latest.tar.gz.enc'),
          path.join(dir, 'AZRAR-attachments-latest.tar.gz'),
        ];
  
        const archiveCandidate = candidates.find((p) => p && fs.existsSync(p));
        if (archiveCandidate) {
          const r = await ipc.restoreAttachmentsFromArchiveBestEffort({
            archivePath: archiveCandidate,
            password: encryptionPassword,
          });
          attachmentsRestored = r.restored;
          attachmentsMsg = r.message;
        }
      } catch (e: unknown) {
        attachmentsMsg = toErrorMessage(e, 'فشل استعادة المرفقات');
        attachmentsRestored = false;
      }
  
      setDbMaintenanceMode(false);
      const msg = attachmentsRestored
        ? 'تم الاستيراد بنجاح (قاعدة البيانات + المرفقات) - أعد تشغيل التطبيق'
        : attachmentsMsg
          ? `تم الاستيراد بنجاح - أعد تشغيل التطبيق. ملاحظة: ${attachmentsMsg}`
          : 'تم الاستيراد بنجاح - أعد تشغيل التطبيق';
      return { success: true, message: msg, path: resolved, attachmentsRestored };
    } catch (err: unknown) {
      setDbMaintenanceMode(false);
      return { success: false, message: toErrorMessage(err, 'فشل استيراد قاعدة البيانات') };
    }
  });
  
  ipcMain.handle('db:getBackupEncryptionSettings', async () => {
    try {
      const s = await readBackupEncryptionSettings();
      const available = safeStorage?.isEncryptionAvailable?.() === true;
      return {
        success: true,
        available,
        enabled: s.enabled === true,
        hasPassword: !!s.passwordEnc,
      };
    } catch (e: unknown) {
      return {
        success: false,
        message: toErrorMessage(e, 'فشل قراءة إعدادات تشفير النسخ الاحتياطية'),
      };
    }
  });
  
  ipcMain.handle('db:saveBackupEncryptionSettings', async (_evt, payload: unknown) => {
    try {
      const p = (
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
      ) as Record<string, unknown>;
  
      const nextEnabled = p.enabled === undefined ? undefined : !!p.enabled;
      const clearPassword = p.clearPassword === true;
      const password = typeof p.password === 'string' ? p.password : undefined;
  
      if (password !== undefined) {
        if (password.length < 6)
          return { success: false, message: 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)' };
        if (password.length > 256) return { success: false, message: 'كلمة المرور طويلة جداً' };
        if (password.includes('\u0000'))
          return { success: false, message: 'كلمة المرور غير صالحة' };
      }
  
      const current = await readBackupEncryptionSettings();
      const currentPasswordPlain = current.passwordEnc
        ? decryptSecretBestEffort(String(current.passwordEnc || ''))
        : '';
      const next: BackupEncryptionSettings = {
        v: 1,
        enabled: nextEnabled === undefined ? current.enabled : nextEnabled,
        passwordEnc: current.passwordEnc,
      };
  
      if (clearPassword) {
        next.passwordEnc = undefined;
      }
      if (password !== undefined) {
        next.passwordEnc = password ? encryptSecretBestEffort(password) : undefined;
      }
  
      await writeBackupEncryptionSettings(next);
  
      // Best-effort: when encryption is enabled and we have a password, encrypt existing attachments at rest.
      try {
        const nowEnabled = next.enabled === true;
        const hadPassword = !!current.passwordEnc;
        const hasPassword = !!next.passwordEnc;
        const passwordChanged = password !== undefined;
        if (
          nowEnabled &&
          hasPassword &&
          (!hadPassword || passwordChanged || current.enabled !== true)
        ) {
          const plain = decryptSecretBestEffort(String(next.passwordEnc || ''));
          if (plain) {
            setTimeout(() => {
              void ipc.encryptExistingAttachmentsAtRestBestEffort(plain).catch(() => undefined);
            }, 300);
          }
        }
  
        // If password changed, re-encrypt already-encrypted attachments (prevents losing access).
        if (
          nowEnabled &&
          password !== undefined &&
          currentPasswordPlain &&
          password &&
          currentPasswordPlain !== password
        ) {
          setTimeout(() => {
            void ipc.reencryptEncryptedAttachmentsAtRestBestEffort(
              currentPasswordPlain,
              password
            ).catch(() => undefined);
          }, 800);
        }
      } catch {
        // ignore
      }
  
      const available = safeStorage?.isEncryptionAvailable?.() === true;
      return {
        success: true,
        message: 'تم حفظ إعدادات تشفير النسخ الاحتياطية',
        available,
        enabled: next.enabled === true,
        hasPassword: !!next.passwordEnc,
      };
    } catch (e: unknown) {
      logger.warn('backup-encryption: failed to save settings', {
        err: toErrorMessage(e, 'فشل حفظ إعدادات تشفير النسخ الاحتياطية'),
      });
      return {
        success: false,
        message: toErrorMessage(e, 'فشل حفظ إعدادات تشفير النسخ الاحتياطية'),
      };
    }
  });
  
  // Get database file path (for display purposes)
  ipcMain.handle('db:getPath', () => getDbPath());
  // Start local auto-backup scheduler (best-effort).
}
