import type { IpcDeps } from './deps.js';
import * as ipc from './context.js';
import {
  dbMaintenanceMode,
  restoreInProgress,
  currentFeedUrl,
  lastUpdaterEvent,
} from './context.js';
import { ipcMain, dialog, app, BrowserWindow, shell, safeStorage } from 'electron';

import {
  kvApplyRemoteDelete,
  kvDelete,
  kvGet,
  kvGetDeletedAt,
  kvGetMeta,
  kvKeys,
  kvListDeletedSince,
  kvListUpdatedSince,
  kvResetAll,
  kvSet,
  kvSetWithUpdatedAt,
  getDbPath,
  exportDatabaseToMany,
  importDatabase,
  domainMigrateFromKvIfNeeded,
  domainRebuildFromKv,
  domainSyncAfterKvSet,
  domainStatus,
  domainCounts,
  runSqlReport,
  domainSearchGlobal,
  domainSearch,
  domainGetEntityById,
  domainPropertyPickerSearch,
  domainContractPickerSearch,
  domainPeoplePickerSearch,
  domainInstallmentsContractsSearch,
  domainDashboardSummary,
  domainDashboardPerformance,
  domainDashboardHighlights,
  domainPaymentNotificationTargets,
  domainContractDetails,
  domainPersonDetails,
  domainPersonTenancyContracts,
  domainPropertyContracts,
} from '../db';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import updaterPkg from 'electron-updater';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import {
  connectAndEnsureDatabase,
  createServerBackupOnServer,
  disconnectSql,
  ensureDailyServerBackupIfEnabled,
  exportServerBackupToFile,
  getOrCreateDeviceId,
  getRemoteKvStoreMeta,
  getRemoteKvStoreRow,
  getSqlStatus,
  importServerBackupFromFile,
  listServerBackups,
  loadSqlBackupAutomationSettings,
  loadSqlSettings,
  loadSqlSettingsRedacted,
  logSyncError,
  provisionSqlServer,
  pullAttachmentFilesForAttachmentsJson,
  pullKvStoreOnce,
  pushKvDelete,
  pushKvUpsert,
  resetSqlPullState,
  restoreServerBackupFromServer,
  saveSqlBackupAutomationSettings,
  saveSqlSettings,
  startBackgroundPull,
  testSqlConnection,
} from '../sqlSync';
import { validateInstallerCandidate } from '../security/updaterInstallValidation.js';
import { printEngine, type PrintEngineJob } from '../printing';
import {
  getPrintSettingsFilePath,
  loadPrintSettings,
  savePrintSettings,
} from '../printing/settings/store';
import { desktopUserHasPermission, getDesktopUserById } from '../printing/permissions';
import {
  htmlToPdfFromHtml,
  parsePrintingHtmlPayload,
  printHtmlInHiddenWindow,
  saveHtmlPdfToFilePath,
} from '../printing/htmlDocumentWindow';

import logger from '../logger';

import { ensureInsideRoot } from '../utils/pathSafety';
import { toErrorMessage } from '../utils/errors';
import { isRecord } from '../utils/unknown';
import { safeJsonParseArray } from '../utils/json';

import {
  activateOnline as licenseActivateOnline,
  activateWithLicenseContent as licenseActivateWithLicenseContent,
  deactivate as licenseDeactivate,
  getDeviceFingerprint as licenseGetDeviceFingerprint,
  getLicenseServerUrl,
  getLicenseStatus,
  refreshOnlineStatus as licenseRefreshOnlineStatus,
  setLicenseServerUrl,
} from '../license/licenseManager';
import {
  decryptFileToBuffer,
  decryptFileToFile,
  encryptBufferToFile,
  encryptFileToFile,
  isEncryptedFile,
} from '../utils/fileEncryption';
import * as tar from 'tar';
import {
  decryptSecretBestEffort,
  encryptSecretBestEffort,
  getBackupEncryptionPasswordState,
  readBackupEncryptionSettings,
  writeBackupEncryptionSettings,
  type BackupEncryptionSettings,
} from '../utils/backupEncryptionSettings';

export function registerSql(deps: IpcDeps): void {
  void deps;
  // SQL Server Sync
  ipcMain.handle('sql:getSettings', async () => {
    return loadSqlSettingsRedacted();
  });
  
  /** Installer / sql-express-install.ps1 writes ProgramData\\AZRAR\\sql-local-credentials.json */
  ipcMain.handle('sql:readLocalBootstrapCredentials', async () => {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const base = process.env.ProgramData || path.join(process.env.SystemDrive || 'C:', 'ProgramData');
      const filePath = path.join(base, 'AZRAR', 'sql-local-credentials.json');
      if (!fs.existsSync(filePath)) {
        return { ok: false as const, reason: 'missing' as const };
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const j = JSON.parse(raw) as Record<string, unknown>;
      const server = typeof j.server === 'string' ? j.server.trim() : '';
      const port = Number(j.port || 1433) || 1433;
      const database = typeof j.database === 'string' ? j.database.trim() : 'AZRAR';
      const user = typeof j.user === 'string' ? j.user.trim() : '';
      const password = typeof j.password === 'string' ? j.password : '';
      const authMode = j.authMode === 'windows' ? 'windows' : 'sql';
      if (!server || !database) {
        return { ok: false as const, reason: 'invalid' as const };
      }
      return {
        ok: true as const,
        filePath,
        credentials: {
          server,
          port,
          database: database || 'AZRAR',
          authMode: authMode as 'sql' | 'windows',
          user,
          password,
        },
      };
    } catch {
      return { ok: false as const, reason: 'error' as const };
    }
  });
  
  ipcMain.handle('sql:saveSettings', async (_e, settings: unknown) => {
    try {
      const saved = await loadSqlSettings();
      const enabled = Boolean(ipc.getField(settings, 'enabled'));
      const authMode = ipc.getStringField(settings, 'authMode') === 'windows' ? 'windows' : 'sql';
  
      // If the user leaves the password field empty while a password is already stored,
      // keep the existing password instead of clearing it.
      const incomingPassword = ipc.toLimitedPassword(ipc.getField(settings, 'password'), 512);
      const passwordToSave =
        incomingPassword || String((saved as { password?: unknown })?.password || '');
  
      await saveSqlSettings({
        enabled,
        server: ipc.trimString(ipc.getStringField(settings, 'server'), 256, 'السيرفر'),
        port: ipc.safePortOrDefault(ipc.getField(settings, 'port'), 1433),
        database:
          ipc.trimString(ipc.getStringField(settings, 'database') || 'AZRAR', 128, 'قاعدة البيانات') ||
          'AZRAR',
        authMode,
        user: ipc.trimString(ipc.getStringField(settings, 'user'), 128, 'المستخدم'),
        password: passwordToSave,
        encrypt: ipc.getField(settings, 'encrypt') !== false,
        trustServerCertificate: ipc.getField(settings, 'trustServerCertificate') !== false,
      });
  
      // If sync was disabled, ensure we disconnect.
      if (!enabled) {
        await disconnectSql();
      }
  
      return { success: true };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل حفظ إعدادات المخدم') };
    }
  });
  
  ipcMain.handle('sql:test', async (_e, settings: unknown) => {
    const saved = await loadSqlSettings();
  
    type TestSqlSettings = Parameters<typeof testSqlConnection>[0];
  
    const merged: TestSqlSettings = {
      ...saved,
      server: ipc.trimString(
        (ipc.getField(settings, 'server') ?? saved.server ?? '') as unknown,
        256,
        'السيرفر'
      ),
      port: ipc.safePortOrDefault(ipc.getField(settings, 'port') ?? saved.port ?? 1433, 1433),
      database:
        ipc.trimString(
          (ipc.getField(settings, 'database') ?? saved.database ?? 'AZRAR') as unknown,
          128,
          'قاعدة البيانات'
        ) || 'AZRAR',
      authMode: (ipc.getStringField(settings, 'authMode') === 'windows'
        ? 'windows'
        : 'sql') as TestSqlSettings['authMode'],
      user: ipc.trimString(
        (ipc.getField(settings, 'user') ?? saved.user ?? '') as unknown,
        128,
        'المستخدم'
      ),
      password:
        typeof ipc.getField(settings, 'password') === 'string'
          ? ipc.toLimitedPassword(ipc.getField(settings, 'password'), 512)
          : ipc.toLimitedPassword(ipc.getField(saved, 'password'), 512),
      encrypt: ipc.getField(settings, 'encrypt') !== false,
      trustServerCertificate: ipc.getField(settings, 'trustServerCertificate') !== false,
      enabled: true,
    };
  
    return testSqlConnection(merged);
  });
  
  ipcMain.handle('sql:connect', async () => {
    const settings = await loadSqlSettings();
    if (!settings.enabled) return { ok: false, message: 'المزامنة غير مفعلة' };
  
    const res = await connectAndEnsureDatabase(settings);
    if (res.ok) {
      // Manual connect: do a full pull once (download everything) then push local data up.
      await resetSqlPullState();
      await startBackgroundPull(
        async (row) => {
          const localMeta = kvGetMeta(row.k);
          const localDeletedAt = kvGetDeletedAt(row.k);
          const localBestTs = localDeletedAt || localMeta?.updatedAt || '';
  
          const remoteTs = row.updatedAt;
          const isRemoteNewer =
            !localBestTs || new Date(remoteTs).getTime() > new Date(localBestTs).getTime();
          if (!isRemoteNewer) return;
  
          if (row.isDeleted) {
            kvApplyRemoteDelete(row.k, remoteTs);
            ipc.broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
            ipc.addSqlSyncLogEntry({
              direction: 'pull',
              action: 'delete',
              key: row.k,
              status: 'ok',
              ts: remoteTs,
            });
          } else {
            kvSetWithUpdatedAt(row.k, row.v, remoteTs);
            ipc.broadcastDbRemoteUpdate({
              key: row.k,
              value: row.v,
              isDeleted: false,
              updatedAt: remoteTs,
            });
            ipc.addSqlSyncLogEntry({
              direction: 'pull',
              action: 'upsert',
              key: row.k,
              status: 'ok',
              ts: remoteTs,
            });
          }
        },
        { runImmediately: true, forceFullPull: true }
      );
  
      await ipc.pushAllLocalToRemote();
    }
    return res;
  });
  
  ipcMain.handle('sql:disconnect', async () => {
    await disconnectSql();
    return { success: true };
  });
  
  ipcMain.handle('sql:status', async () => {
    return getSqlStatus();
  });
  
  ipcMain.handle('sql:getSyncLog', async () => {
    return { ok: true, items: ipc.sqlSyncLog };
  });
  
  ipcMain.handle('sql:clearSyncLog', async () => {
    ipc.sqlSyncLog.splice(0, ipc.sqlSyncLog.length);
    return { ok: true };
  });
  
  ipcMain.handle('sql:getCoverage', async () => {
    try {
      const tolMs = 1500;
      const toMs = (iso?: string): number | null => {
        const s = String(iso || '').trim();
        if (!s) return null;
        const d = new Date(s);
        const ms = d.getTime();
        return Number.isFinite(ms) ? ms : null;
      };
  
      const localKeys = kvKeys().filter((k) => String(k || '').startsWith('db_'));
      const localMap = new Map<
        string,
        Omit<ipc.SqlCoverageItem, 'remoteUpdatedAt' | 'remoteIsDeleted' | 'status'>
      >();
  
      for (const k of localKeys) {
        const key = String(k || '').trim();
        if (!key) continue;
        const meta = kvGetMeta(key);
        const deletedAt = kvGetDeletedAt(key) || undefined;
        const updatedAt = meta?.updatedAt ? String(meta.updatedAt) : undefined;
        const v = kvGet(key);
        const bytes = typeof v === 'string' ? Buffer.byteLength(v, 'utf8') : 0;
        const localBestTs = deletedAt || updatedAt;
        localMap.set(key, {
          key,
          localUpdatedAt: updatedAt,
          localDeletedAt: deletedAt,
          localBestTs,
          localIsDeleted: !!deletedAt,
          localBytes: bytes,
        });
      }
  
      const remoteRes = await getRemoteKvStoreMeta();
      const remoteItemsRaw = ipc.getField(remoteRes, 'items');
      const remoteItems = Array.isArray(remoteItemsRaw) ? remoteItemsRaw : [];
      const remoteMap = new Map<string, { remoteUpdatedAt?: string; remoteIsDeleted?: boolean }>();
      for (const r of remoteItems) {
        const key = ipc.getStringField(r, 'key').trim();
        if (!key) continue;
        if (!key.startsWith('db_')) continue;
        remoteMap.set(key, {
          remoteUpdatedAt: ipc.getField(r, 'updatedAt') ? ipc.getStringField(r, 'updatedAt') : undefined,
          remoteIsDeleted: Boolean(ipc.getField(r, 'isDeleted')),
        });
      }
  
      const allKeys = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
      const items: ipc.SqlCoverageItem[] = [];
  
      for (const key of Array.from(allKeys).sort()) {
        const l = localMap.get(key);
        const r = remoteMap.get(key);
  
        if (!l && r) {
          items.push({
            key,
            localIsDeleted: false,
            localBytes: 0,
            remoteUpdatedAt: r.remoteUpdatedAt,
            remoteIsDeleted: r.remoteIsDeleted,
            status: 'missingLocal',
          });
          continue;
        }
  
        if (l && !r) {
          items.push({
            ...l,
            status: 'missingRemote',
          });
          continue;
        }
  
        if (!l && !r) continue;
  
        // At this point, both local and remote exist.
        if (!l) continue;
  
        const localMs = toMs(l?.localBestTs);
        const remoteMs = toMs(r?.remoteUpdatedAt);
        const localIsDel = !!l?.localIsDeleted;
        const remoteIsDel = !!r?.remoteIsDeleted;
  
        let status: ipc.SqlCoverageItem['status'] = 'unknown';
        if (localMs !== null && remoteMs !== null) {
          const diff = localMs - remoteMs;
          if (Math.abs(diff) <= tolMs && localIsDel === remoteIsDel) status = 'inSync';
          else if (diff > tolMs) status = 'localAhead';
          else if (diff < -tolMs) status = 'remoteAhead';
          else status = 'different';
        } else {
          status = 'unknown';
        }
  
        items.push({
          ...l,
          remoteUpdatedAt: r?.remoteUpdatedAt,
          remoteIsDeleted: r?.remoteIsDeleted,
          status,
        });
      }
  
      const remoteMessageRaw = ipc.getField(remoteRes, 'message');
      const remoteMessage = remoteMessageRaw ? String(remoteMessageRaw) : undefined;
  
      return {
        ok: true,
        remoteOk: !!remoteRes.ok,
        remoteMessage,
        localCount: localMap.size,
        remoteCount: remoteMap.size,
        items,
      };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل فحص تغطية المزامنة') };
    }
  });
  
  ipcMain.handle('sql:exportBackup', async () => {
    try {
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'exportBackup',
        status: 'ok',
        message: 'بدء تصدير نسخة احتياطية من المخدم',
      });
      const settings = await loadSqlSettings();
      if (!settings.server?.trim()) return { ok: false, message: 'اسم السيرفر مطلوب' };
      if (!settings.database?.trim()) return { ok: false, message: 'اسم قاعدة البيانات مطلوب' };
  
      const backupSettings = await ipc.readBackupSettings();
      const backupDir =
        backupSettings.backupDir && ipc.isExistingDirectory(backupSettings.backupDir)
          ? backupSettings.backupDir
          : app.getPath('documents');
  
      const enc = await readBackupEncryptionSettings();
      const encryptionRequested = enc.enabled === true;
      const encryptionConfigured = encryptionRequested && !!enc.passwordEnc;
      const encryptionPassword = encryptionConfigured
        ? decryptSecretBestEffort(String(enc.passwordEnc || ''))
        : '';
  
      if (encryptionRequested && (!encryptionConfigured || !encryptionPassword)) {
        return {
          ok: false,
          message:
            'تشفير النسخ الاحتياطية مفعل لكن كلمة المرور غير مضبوطة. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.',
        };
      }
  
      const dbNameSafe = String(settings.database || 'AZRAR').replace(/[^a-zA-Z0-9_-]/g, '_');
      const defaultName = `AZRAR_SERVER_BACKUP_${dbNameSafe}_${ipc.formatBackupStamp()}.json${
        encryptionRequested ? '.enc' : ''
      }`;
      const defaultPath = path.join(backupDir, defaultName);
  
      const result = await dialog.showSaveDialog({
        title: 'حفظ نسخة احتياطية من المخدم',
        defaultPath,
        filters: [
          { name: 'Backup File', extensions: ['json', 'enc'] },
          { name: 'Encrypted Backup', extensions: ['enc'] },
          { name: 'JSON', extensions: ['json'] },
        ],
      });
  
      if (result.canceled || !result.filePath) return { ok: false, message: 'تم الإلغاء' };
  
      const chosenPath = result.filePath;
      const destPath = encryptionRequested
        ? chosenPath.toLowerCase().endsWith('.enc')
          ? chosenPath
          : `${chosenPath}.enc`
        : chosenPath;
  
      if (!encryptionRequested) {
        const res = await exportServerBackupToFile(destPath, { ...settings, enabled: true });
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'exportBackup',
          status: res?.ok ? 'ok' : 'error',
          message: res?.message,
        });
        return res;
      }
  
      const tmpJson = path.join(app.getPath('temp'), `AZRAR_SERVER_BACKUP_TMP_${Date.now()}.json`);
      try {
        const resPlain = await exportServerBackupToFile(tmpJson, { ...settings, enabled: true });
        if (!resPlain?.ok) {
          ipc.addSqlSyncLogEntry({
            direction: 'system',
            action: 'exportBackup',
            status: 'error',
            message: resPlain?.message,
          });
          return resPlain;
        }
  
        await encryptFileToFile({ sourcePath: tmpJson, destPath, password: encryptionPassword });
  
        const res = {
          ...resPlain,
          filePath: destPath,
          message: 'تم إنشاء نسخة احتياطية من المخدم (مشفر)',
        };
  
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'exportBackup',
          status: 'ok',
          message: res?.message,
        });
        return res;
      } finally {
        try {
          await fsp.unlink(tmpJson);
        } catch {
          // ignore
        }
      }
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل إنشاء النسخة الاحتياطية من المخدم');
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'exportBackup',
        status: 'error',
        message: msg,
      });
      return { ok: false, message: msg };
    }
  });
  
  ipcMain.handle('sql:importBackup', async () => {
    try {
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'importBackup',
        status: 'ok',
        message: 'بدء استيراد (دمج) نسخة احتياطية',
      });
      const filePath = await ipc.chooseJsonFileViaDialog();
      if (!filePath) return { ok: false, message: 'تم الإلغاء' };
  
      const isEnc =
        (await isEncryptedFile(filePath)) || path.extname(filePath).toLowerCase() === '.enc';
      if (!isEnc) {
        const res = await importServerBackupFromFile(filePath, 'merge');
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'importBackup',
          status: res?.ok ? 'ok' : 'error',
          message: res?.message,
        });
        return res;
      }
  
      const enc = await readBackupEncryptionSettings();
      const encryptionPassword = enc.passwordEnc
        ? decryptSecretBestEffort(String(enc.passwordEnc || ''))
        : '';
      if (!encryptionPassword) {
        return {
          ok: false,
          message:
            'الملف مشفر (.enc) لكن لا توجد كلمة مرور محفوظة. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.',
        };
      }
  
      const tmpJson = path.join(
        app.getPath('temp'),
        `AZRAR_SERVER_BACKUP_IMPORT_TMP_${Date.now()}.json`
      );
      try {
        await decryptFileToFile({
          sourcePath: filePath,
          destPath: tmpJson,
          password: encryptionPassword,
        });
        const res = await importServerBackupFromFile(tmpJson, 'merge');
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'importBackup',
          status: res?.ok ? 'ok' : 'error',
          message: res?.message,
        });
        return res;
      } finally {
        try {
          await fsp.unlink(tmpJson);
        } catch {
          // ignore
        }
      }
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل استيراد النسخة الاحتياطية');
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'importBackup',
        status: 'error',
        message: msg,
      });
      return { ok: false, message: msg };
    }
  });
  
  ipcMain.handle('sql:restoreBackup', async () => {
    try {
      const confirm = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['إلغاء', 'نعم، استعادة كاملة'],
        defaultId: 0,
        cancelId: 0,
        title: 'تأكيد الاستعادة الكاملة',
        message:
          'هذه العملية ستحذف بيانات المخدم الحالية وتستبدلها بالكامل من ملف النسخة الاحتياطية.',
        detail: 'استخدمها فقط عند الضرورة. هل تريد المتابعة؟',
      });
      if (confirm.response !== 1) return { ok: false, message: 'تم الإلغاء' };
  
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'restoreBackup',
        status: 'ok',
        message: 'بدء استعادة كاملة من نسخة احتياطية',
      });
  
      const filePath = await ipc.chooseJsonFileViaDialog();
      if (!filePath) return { ok: false, message: 'تم الإلغاء' };
  
      const isEnc =
        (await isEncryptedFile(filePath)) || path.extname(filePath).toLowerCase() === '.enc';
      if (!isEnc) {
        const res = await importServerBackupFromFile(filePath, 'replace');
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'restoreBackup',
          status: res?.ok ? 'ok' : 'error',
          message: res?.message,
        });
        return res;
      }
  
      const enc = await readBackupEncryptionSettings();
      const encryptionPassword = enc.passwordEnc
        ? decryptSecretBestEffort(String(enc.passwordEnc || ''))
        : '';
      if (!encryptionPassword) {
        return {
          ok: false,
          message:
            'الملف مشفر (.enc) لكن لا توجد كلمة مرور محفوظة. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.',
        };
      }
  
      const tmpJson = path.join(
        app.getPath('temp'),
        `AZRAR_SERVER_BACKUP_RESTORE_TMP_${Date.now()}.json`
      );
      try {
        await decryptFileToFile({
          sourcePath: filePath,
          destPath: tmpJson,
          password: encryptionPassword,
        });
        const res = await importServerBackupFromFile(tmpJson, 'replace');
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'restoreBackup',
          status: res?.ok ? 'ok' : 'error',
          message: res?.message,
        });
        return res;
      } finally {
        try {
          await fsp.unlink(tmpJson);
        } catch {
          // ignore
        }
      }
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل الاستعادة الكاملة');
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'restoreBackup',
        status: 'error',
        message: msg,
      });
      return { ok: false, message: msg };
    }
  });
  
  ipcMain.handle('sql:getBackupAutomationSettings', async () => {
    try {
      const settings = await loadSqlBackupAutomationSettings();
      return { ok: true, settings };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل إعدادات النسخ الاحتياطي') };
    }
  });
  
  ipcMain.handle('sql:saveBackupAutomationSettings', async (_e, payload: unknown) => {
    try {
      const enabledRaw = ipc.getField(payload, 'enabled');
      const next = await saveSqlBackupAutomationSettings({
        enabled: typeof enabledRaw === 'boolean' ? enabledRaw : undefined,
        retentionDays: ipc.getOptionalNumberField(payload, 'retentionDays'),
      });
      return { ok: true, settings: next };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل حفظ إعدادات النسخ الاحتياطي') };
    }
  });
  
  ipcMain.handle('sql:listServerBackups', async (_e, payload: unknown) => {
    const limit = ipc.getField(payload, 'limit');
    const n = typeof limit === 'number' ? limit : Number(limit || 60) || 60;
    return await listServerBackups(n);
  });
  
  ipcMain.handle('sql:createServerBackup', async (_e, payload: unknown) => {
    try {
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'createServerBackup',
        status: 'ok',
        message: 'بدء رفع نسخة احتياطية إلى المخدم',
      });
      const noteRaw = ipc.getField(payload, 'note');
      const note = noteRaw ? String(noteRaw).slice(0, 200) : undefined;
      const auto = await loadSqlBackupAutomationSettings();
      const res = await createServerBackupOnServer({
        note: note || 'manual',
        retentionDays: auto.retentionDays,
      });
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'createServerBackup',
        status: res?.ok ? 'ok' : 'error',
        message: res?.message,
      });
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل رفع النسخة الاحتياطية إلى المخدم');
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'createServerBackup',
        status: 'error',
        message: msg,
      });
      return { ok: false, message: msg };
    }
  });
  
  ipcMain.handle('sql:restoreServerBackup', async (_e, payload: unknown) => {
    try {
      const id = ipc.getStringField(payload, 'id').trim();
      const mode = ipc.getStringField(payload, 'mode') === 'replace' ? 'replace' : 'merge';
      if (!id) return { ok: false, message: 'معرف النسخة غير صالح' };
  
      if (mode === 'replace') {
        const confirm = await dialog.showMessageBox({
          type: 'warning',
          buttons: ['إلغاء', 'نعم، استعادة كاملة'],
          defaultId: 0,
          cancelId: 0,
          title: 'تأكيد الاستعادة الكاملة',
          message: 'هذه العملية ستحذف بيانات المخدم الحالية وتستبدلها بالكامل من النسخة المختارة.',
          detail: 'استخدمها فقط عند الضرورة. هل تريد المتابعة؟',
        });
        if (confirm.response !== 1) return { ok: false, message: 'تم الإلغاء' };
      }
  
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'restoreServerBackup',
        status: 'ok',
        message: `بدء استعادة نسخة من المخدم (${mode})`,
      });
      const res = await restoreServerBackupFromServer(id, mode);
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'restoreServerBackup',
        status: res?.ok ? 'ok' : 'error',
        message: res?.message,
      });
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل استعادة النسخة من المخدم');
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'restoreServerBackup',
        status: 'error',
        message: msg,
      });
      return { ok: false, message: msg };
    }
  });
  
  // Daily server backup automation (best-effort)
  const runDailyBackupTick = async (reason: string) => {
    try {
      const res = await ensureDailyServerBackupIfEnabled();
      if (!res?.ok) {
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'dailyBackup',
          status: 'error',
          message: `${reason}: ${res?.message || 'فشل'}`,
        });
        return;
      }
      if (res?.created)
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'dailyBackup',
          status: 'ok',
          message: `${reason}: تم إنشاء نسخة يومية`,
        });
    } catch (e: unknown) {
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'dailyBackup',
        status: 'error',
        message: `${reason}: ${toErrorMessage(e, 'فشل')}`,
      });
    }
  };
  
  setTimeout(() => void runDailyBackupTick('startup'), 10_000);
  setInterval(() => void runDailyBackupTick('hourly'), 60 * 60 * 1000);
  
  ipcMain.handle('sql:syncNow', async () => {
    try {
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'syncNow',
        status: 'ok',
        message: 'بدء المزامنة الآن',
      });
      const settings = await loadSqlSettings();
      if (!settings.enabled) return { ok: false, message: 'المزامنة غير مفعلة' };
  
      const conn = await connectAndEnsureDatabase(settings);
      if (!conn.ok) return conn;
  
      let pullUpserts = 0;
      let pullDeletes = 0;
  
      try {
        await pullKvStoreOnce(async (row) => {
          const r = await ipc.applySqlRemoteKvRow(row);
          if (r === 'upsert') pullUpserts += 1;
          else if (r === 'delete') pullDeletes += 1;
        });
      } catch (e: unknown) {
        logSyncError('syncNow:pull', e);
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'syncNow',
          status: 'error',
          message: toErrorMessage(e, 'فشل السحب أثناء المزامنة الآن'),
        });
        return { ok: false, message: toErrorMessage(e, 'فشل السحب أثناء المزامنة الآن') };
      }
  
      // Push local changes
      const pushStats = await ipc.pushAllLocalToRemote();
  
      const summaryParts: string[] = [];
      summaryParts.push(`سحب: تعديل ${pullUpserts} / حذف ${pullDeletes}`);
      if (pushStats)
        summaryParts.push(`رفع: تعديل ${pushStats.upsertsOk} / حذف ${pushStats.deletesOk}`);
      if (pushStats?.errors) summaryParts.push(`أخطاء رفع: ${pushStats.errors}`);
  
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'syncNow',
        status: pushStats.errors > 0 ? 'error' : 'ok',
        message: `ملخص المزامنة: ${summaryParts.join(' • ')}`,
      });
  
      if (pushStats.errors > 0) {
        return { ok: false, message: `فشل رفع ${pushStats.errors} عملية (تعديل/حذف)` };
      }
      return { ok: true, message: 'تمت المزامنة الآن' };
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل المزامنة الآن');
      ipc.addSqlSyncLogEntry({ direction: 'system', action: 'syncNow', status: 'error', message: msg });
      return { ok: false, message: msg };
    }
  });
  
  ipcMain.handle('sql:pullFullNow', async () => {
    try {
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'syncNow',
        status: 'ok',
        message: 'بدء سحب كامل من المخدم',
      });
      const settings = await loadSqlSettings();
      if (!settings.enabled) return { ok: false, message: 'المزامنة غير مفعلة' };
  
      const conn = await connectAndEnsureDatabase(settings);
      if (!conn.ok) return conn;
  
      let pullUpserts = 0;
      let pullDeletes = 0;
  
      await startBackgroundPull(
        async (row) => {
          const localMeta = kvGetMeta(row.k);
          const localDeletedAt = kvGetDeletedAt(row.k);
          const localBestTs = localDeletedAt || localMeta?.updatedAt || '';
  
          const remoteTs = row.updatedAt;
          const isRemoteNewer =
            !localBestTs || new Date(remoteTs).getTime() > new Date(localBestTs).getTime();
          if (!isRemoteNewer) return;
  
          if (row.isDeleted) {
            kvApplyRemoteDelete(row.k, remoteTs);
            ipc.broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
            ipc.addSqlSyncLogEntry({
              direction: 'pull',
              action: 'delete',
              key: row.k,
              status: 'ok',
              ts: remoteTs,
            });
            pullDeletes += 1;
          } else {
            kvSetWithUpdatedAt(row.k, row.v, remoteTs);
            ipc.broadcastDbRemoteUpdate({
              key: row.k,
              value: row.v,
              isDeleted: false,
              updatedAt: remoteTs,
            });
            ipc.addSqlSyncLogEntry({
              direction: 'pull',
              action: 'upsert',
              key: row.k,
              status: 'ok',
              ts: remoteTs,
            });
            pullUpserts += 1;
  
            // Attachments: ensure the actual files exist locally after syncing metadata.
            if (row.k === 'db_attachments') {
              try {
                const res = await pullAttachmentFilesForAttachmentsJson(row.v);
                if (res.downloaded > 0) {
                  ipc.addSqlSyncLogEntry({
                    direction: 'system',
                    action: 'attachments:pull',
                    status: 'ok',
                    message: `تم تنزيل ${res.downloaded} مرفق/مرفقات`,
                  });
                }
                if (res.missingRemote > 0) {
                  ipc.addSqlSyncLogEntry({
                    direction: 'system',
                    action: 'attachments:pull',
                    status: 'error',
                    message: `مرفقات غير موجودة على المخدم: ${res.missingRemote}`,
                  });
                }
              } catch (e: unknown) {
                ipc.addSqlSyncLogEntry({
                  direction: 'system',
                  action: 'attachments:pull',
                  status: 'error',
                  message: toErrorMessage(e, 'فشل تنزيل المرفقات'),
                });
              }
            }
          }
        },
        { runImmediately: true, forceFullPull: true }
      );
  
      const msg = `تم السحب من المخدم: تعديل ${pullUpserts} / حذف ${pullDeletes}`;
      ipc.addSqlSyncLogEntry({ direction: 'system', action: 'syncNow', status: 'ok', message: msg });
      return { ok: true, message: msg };
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل السحب من المخدم');
      ipc.addSqlSyncLogEntry({ direction: 'system', action: 'syncNow', status: 'error', message: msg });
      return { ok: false, message: msg };
    }
  });
  
  ipcMain.handle('sql:mergePublishAdmin', async (_e, payload: unknown) => {
    try {
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'mergePublish',
        status: 'ok',
        message: 'بدء دمج ونشر (SuperAdmin) للمفاتيح المحددة',
      });
      const settings = await loadSqlSettings();
      if (!settings.enabled) return { ok: false, message: 'المزامنة غير مفعلة' };
  
      const conn = await connectAndEnsureDatabase(settings);
      if (!conn.ok) return conn;
  
      const requestedKeysRaw = ipc.getField(payload, 'keys');
      const requestedKeys = Array.isArray(requestedKeysRaw) ? requestedKeysRaw : undefined;
      const keys = (
        requestedKeys && requestedKeys.length > 0
          ? requestedKeys
          : [
              'db_users',
              'db_user_permissions',
              'db_roles',
              'db_lookup_categories',
              'db_lookups',
              'db_legal_templates',
            ]
      )
        .map((k: unknown) => String(k || '').trim())
        .filter((k: string) => k.startsWith('db_'));
  
      if (keys.length === 0) return { ok: false, message: 'لا توجد مفاتيح للدمج' };
  
      const safeJsonParseArray = (raw: unknown): unknown[] => {
        if (typeof raw !== 'string') return [];
        const s = raw.trim();
        if (!s) return [];
        try {
          const parsed = JSON.parse(s);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };
  
      const normKeySimple = (v: unknown) =>
        String(v ?? '')
          .trim()
          .toLowerCase();
  
      const stableHash32 = (input: string): string => {
        let h = 5381;
        for (let i = 0; i < input.length; i++) {
          h = (h * 33) ^ input.charCodeAt(i);
        }
        return (h >>> 0).toString(36);
      };
  
      const lookupKeyFor = (category: unknown, label: unknown): string => {
        const c = normKeySimple(category);
        const l = normKeySimple(label);
        if (!c || !l) return '';
        return `${c}_${stableHash32(l)}`;
      };
  
      const normalizeForPublish = (key: string, arr: unknown[]): unknown[] => {
        if (!Array.isArray(arr)) return [];
  
        if (key === 'db_lookup_categories') {
          return arr.map((it) => {
            if (!it || typeof it !== 'object' || Array.isArray(it)) return it;
            const rec = it as Record<string, unknown>;
            const name = String(rec.name ?? rec.id ?? '').trim();
            if (!name) return it;
            const id = String(rec.id ?? name).trim();
            const label = String(rec.label ?? name).trim();
            const key2 = String(rec.key ?? name).trim();
            return { ...rec, id, name, label, key: key2 };
          });
        }
  
        if (key === 'db_lookups') {
          return arr.map((it) => {
            if (!it || typeof it !== 'object' || Array.isArray(it)) return it;
            const rec = it as Record<string, unknown>;
            const category = String(rec.category ?? '').trim();
            const label = String(rec.label ?? '').trim();
            if (!category || !label) return it;
            const key2 = String(rec.key ?? lookupKeyFor(category, label)).trim();
            return { ...rec, category, label, key: key2 };
          });
        }
  
        return arr;
      };
  
      const toMaybeMs = (obj: unknown): number | null => {
        const candidates = [
          ipc.getField(obj, 'updatedAt'),
          ipc.getField(obj, 'updated_at'),
          ipc.getField(obj, 'modifiedAt'),
          ipc.getField(obj, 'lastModifiedAt'),
          ipc.getField(obj, 'createdAt'),
          ipc.getField(obj, 'ts'),
        ];
        for (const c of candidates) {
          const v = String(c || '').trim();
          if (!v) continue;
          const ms = new Date(v).getTime();
          if (Number.isFinite(ms)) return ms;
        }
        return null;
      };
  
      const identityFor = (key: string, item: unknown): string => {
        const k = String(key || '').trim();
  
        // user permissions are usually rows like: { userId, permissionCode }
        if (k === 'db_user_permissions') {
          const userId = ipc.getStringField(item, 'userId').trim();
          const code = ipc.getStringField(item, 'permissionCode').trim();
          if (userId && code) return `perm:${userId}:${code}`;
        }
  
        // lookups might be { id, category, label }
        if (k === 'db_lookups') {
          const stableKey = ipc.getStringField(item, 'key').trim();
          if (stableKey) return `key:${stableKey}`;
          const id = ipc.getStringField(item, 'id').trim();
          if (id) return `id:${id}`;
          const category = ipc.getStringField(item, 'category').trim();
          const label = ipc.getStringField(item, 'label').trim();
          if (category && label) {
            const computed = lookupKeyFor(category, label);
            if (computed) return `key:${computed}`;
            return `lookup:${category}:${label}`;
          }
        }
  
        // lookup categories might be { id, name, label }
        if (k === 'db_lookup_categories') {
          const stableKey = ipc.getStringField(item, 'key').trim();
          if (stableKey) return `key:${stableKey}`;
          const id = ipc.getStringField(item, 'id').trim();
          if (id) return `id:${id}`;
          const name = ipc.getStringField(item, 'name').trim();
          if (name) return `key:${name}`;
        }
  
        // users might be { id, اسم_المستخدم }
        if (k === 'db_users') {
          const id = ipc.getStringField(item, 'id').trim();
          if (id) return `id:${id}`;
          const u = ipc.getStringField(item, 'اسم_المستخدم').trim();
          if (u) return `u:${u}`;
        }
  
        // roles/templates are generally keyed by id
        const genericId = ipc.getStringField(item, 'id').trim();
        if (genericId) return `id:${genericId}`;
  
        // Last resort: keep the row by its JSON representation (prevents silent drops)
        try {
          const s = JSON.stringify(item);
          if (s && s !== '{}' && s !== 'null') return `json:${s}`;
        } catch {
          // ignore
        }
        return '';
      };
  
      const mergeArrayByIdentity = (
        key: string,
        remoteArr: unknown[],
        localArr: unknown[],
        prefer: 'local' | 'remote'
      ): unknown[] => {
        const map = new Map<string, unknown>();
        const order: string[] = [];
  
        const put = (item: unknown, source: 'remote' | 'local') => {
          const id = identityFor(key, item);
          if (!id) return;
          if (!map.has(id)) order.push(id);
          const existing = map.get(id);
          if (!existing) {
            map.set(id, item);
            return;
          }
  
          try {
            if (JSON.stringify(existing) === JSON.stringify(item)) return;
          } catch {
            // ignore
          }
  
          const aMs = toMaybeMs(existing);
          const bMs = toMaybeMs(item);
          if (aMs !== null && bMs !== null && aMs !== bMs) {
            map.set(id, bMs > aMs ? item : existing);
            return;
          }
  
          // No per-record timestamps: choose by policy.
          if (prefer === 'local') {
            map.set(id, source === 'local' ? item : existing);
          } else {
            map.set(id, source === 'remote' ? item : existing);
          }
        };
  
        for (const it of Array.isArray(remoteArr) ? remoteArr : []) put(it, 'remote');
        for (const it of Array.isArray(localArr) ? localArr : []) put(it, 'local');
  
        return order.map((id) => map.get(id)).filter(Boolean);
      };
  
      const prefer: 'local' | 'remote' =
        ipc.getStringField(payload, 'prefer') === 'remote' ? 'remote' : 'local';
      const nowIso = new Date().toISOString();
  
      let applied = 0;
      let errors = 0;
  
      for (const key of keys) {
        try {
          const remote = await getRemoteKvStoreRow(key);
          if (!remote.ok) throw new Error(remote.message || 'فشل قراءة المخدم');
  
          const localDeletedAt = kvGetDeletedAt(key);
          const localRaw = kvGet(key);
  
          const remoteIsDeleted = !!remote.row?.isDeleted;
          const remoteRaw = remote.row?.value ?? '';
  
          const localArr = localDeletedAt ? [] : safeJsonParseArray(localRaw);
          const remoteArr = remoteIsDeleted ? [] : safeJsonParseArray(remoteRaw);
  
          const mergedArr = mergeArrayByIdentity(key, remoteArr, localArr, prefer);
          const normalizedMerged = normalizeForPublish(key, mergedArr);
          const mergedJson = JSON.stringify(normalizedMerged);
  
          // Push to server with a fresh timestamp so it's always newer than any existing remote row.
          await pushKvUpsert({ key, value: mergedJson, updatedAt: nowIso });
          ipc.addSqlSyncLogEntry({
            direction: 'push',
            action: 'mergeUpsert',
            key,
            status: 'ok',
            ts: nowIso,
          });
  
          // Also normalize local state to match what we just published.
          kvSetWithUpdatedAt(key, mergedJson, nowIso);
          ipc.broadcastDbRemoteUpdate({ key, value: mergedJson, isDeleted: false, updatedAt: nowIso });
  
          applied += 1;
        } catch (e: unknown) {
          errors += 1;
          ipc.addSqlSyncLogEntry({
            direction: 'system',
            action: 'mergePublish',
            key,
            status: 'error',
            message: toErrorMessage(e, 'فشل الدمج/النشر'),
          });
        }
      }
  
      const message =
        errors > 0
          ? `تم الدمج/النشر: ${applied} (مع أخطاء: ${errors})`
          : `تم الدمج/النشر بنجاح: ${applied}`;
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'mergePublish',
        status: errors > 0 ? 'error' : 'ok',
        message,
      });
      return { ok: errors === 0, message, applied, errors, keys };
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل الدمج/النشر');
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'mergePublish',
        status: 'error',
        message: msg,
      });
      return { ok: false, message: msg };
    }
  });
  
  ipcMain.handle('sql:provision', async (_e, payload: unknown) => {
    ipc.addSqlSyncLogEntry({
      direction: 'system',
      action: 'provision',
      status: 'ok',
      message: 'بدء تهيئة المخدم',
    });
    try {
      type ProvisionRequest = Parameters<typeof provisionSqlServer>[0];
      const databaseRaw = ipc.getStringField(payload, 'database').trim();
      const req: ProvisionRequest = {
        server: ipc.trimString(ipc.getStringField(payload, 'server'), 256, 'السيرفر'),
        port: ipc.safePortOrDefault(ipc.getField(payload, 'port') || 1433, 1433),
        database: databaseRaw ? ipc.trimString(databaseRaw, 128, 'قاعدة البيانات') : undefined,
        encrypt: ipc.getField(payload, 'encrypt') !== false,
        trustServerCertificate: ipc.getField(payload, 'trustServerCertificate') !== false,
        adminUser: ipc.trimString(ipc.getStringField(payload, 'adminUser'), 128, 'حساب الأدمن'),
        adminPassword: ipc.toLimitedPassword(ipc.getField(payload, 'adminPassword'), 512),
        managerUser: ipc.trimString(ipc.getStringField(payload, 'managerUser'), 128, 'حساب المدير'),
        managerPassword: ipc.toLimitedPassword(ipc.getField(payload, 'managerPassword'), 512),
        employeeUser: ipc.trimString(ipc.getStringField(payload, 'employeeUser'), 128, 'حساب الموظف'),
        employeePassword: ipc.toLimitedPassword(ipc.getField(payload, 'employeePassword'), 512),
      };
  
      if (!req.server) return { ok: false, message: 'اسم السيرفر مطلوب' };
      if (!req.adminUser || !req.adminPassword)
        return { ok: false, message: 'بيانات الأدمن مطلوبة' };
      if (!req.managerUser || !req.managerPassword)
        return { ok: false, message: 'بيانات المدير مطلوبة' };
      if (!req.employeeUser || !req.employeePassword)
        return { ok: false, message: 'بيانات الموظف مطلوبة' };
  
      const res = await provisionSqlServer(req);
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'provision',
        status: res?.ok ? 'ok' : 'error',
        message: res?.message,
      });
      if (res.ok) {
        // after provisioning, connect using saved app credentials and start pull loop
        const settings = await loadSqlSettings();
        const conn = await connectAndEnsureDatabase(settings);
        if (conn.ok) {
          await resetSqlPullState();
          await startBackgroundPull(
            async (row) => {
              const localMeta = kvGetMeta(row.k);
              const localDeletedAt = kvGetDeletedAt(row.k);
              const localBestTs = localDeletedAt || localMeta?.updatedAt || '';
  
              const remoteTs = row.updatedAt;
              const isRemoteNewer =
                !localBestTs || new Date(remoteTs).getTime() > new Date(localBestTs).getTime();
              if (!isRemoteNewer) return;
  
              if (row.isDeleted) {
                kvApplyRemoteDelete(row.k, remoteTs);
                ipc.broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
                ipc.addSqlSyncLogEntry({
                  direction: 'pull',
                  action: 'delete',
                  key: row.k,
                  status: 'ok',
                  ts: remoteTs,
                });
              } else {
                kvSetWithUpdatedAt(row.k, row.v, remoteTs);
                ipc.broadcastDbRemoteUpdate({
                  key: row.k,
                  value: row.v,
                  isDeleted: false,
                  updatedAt: remoteTs,
                });
                ipc.addSqlSyncLogEntry({
                  direction: 'pull',
                  action: 'upsert',
                  key: row.k,
                  status: 'ok',
                  ts: remoteTs,
                });
              }
            },
            { runImmediately: true, forceFullPull: true }
          );
  
          await ipc.pushAllLocalToRemote();
        }
      }
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'بيانات التهيئة غير صالحة');
      ipc.addSqlSyncLogEntry({
        direction: 'system',
        action: 'provision',
        status: 'error',
        message: msg,
      });
      return { ok: false, message: msg };
    }
  });
  
  // Auto-start: if SQL sync is enabled, connect and ensure DB/schema on app launch.
  // Runs in background and never blocks app startup.
  setTimeout(() => {
    void (async () => {
      try {
        const settings = await loadSqlSettings();
        if (!settings.enabled) return;
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'connect',
          status: 'ok',
          message: 'بدء الاتصال التلقائي بالمخدم',
        });
        const res = await connectAndEnsureDatabase(settings);
        if (res.ok) {
          await ipc.startSqlPullLoop();
  
          // Automatic push: initial full push once, then periodic delta pushes.
          void (async () => {
            try {
              const st = await ipc.pushAllLocalToRemote();
              ipc.addSqlSyncLogEntry({
                direction: 'system',
                action: 'syncNow',
                status: st.errors > 0 ? 'error' : 'ok',
                message: `مزامنة تلقائية (رفع كامل): تعديل ${st.upsertsOk} / حذف ${st.deletesOk}${st.errors ? ` / أخطاء ${st.errors}` : ''}`,
              });
            } catch {
              // ignore
            }
          })();
  
          ipc.startAutoSyncPushLoop();
        } else {
          ipc.addSqlSyncLogEntry({
            direction: 'system',
            action: 'connect',
            status: 'error',
            message: res?.message || 'فشل الاتصال التلقائي بالمخدم',
          });
        }
      } catch (e: unknown) {
        ipc.addSqlSyncLogEntry({
          direction: 'system',
          action: 'connect',
          status: 'error',
          message: toErrorMessage(e, 'فشل الاتصال التلقائي بالمخدم'),
        });
      }
    })();
  }, 800);
}
