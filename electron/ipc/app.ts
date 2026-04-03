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

export function registerApp(deps: IpcDeps): void {
  void deps;
  // =====================
  // App helpers (Desktop)
  // =====================
  
  ipcMain.handle('app:getDeviceId', async () => {
    return await getOrCreateDeviceId();
  });
  
  ipcMain.handle('app:quit', async () => {
    try {
      // Allow renderer to request a clean shutdown (used by desktop autorun tests).
      // Defer quit so the IPC response can be sent before the app terminates.
      setTimeout(() => {
        try {
          app.quit();
        } catch {
          // ignore
        }
      }, 0);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'تعذر إغلاق التطبيق') };
    }
  });
  
  ipcMain.handle('app:pickLicenseFile', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: 'اختر ملف التفعيل',
      properties: ['openFile'],
      filters: [
        { name: 'Activation / License', extensions: ['json', 'lic', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    };
  
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
  
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
  
    const filePath = result.filePaths[0];
    try {
      const st = await fsp.stat(filePath);
      // License files should be tiny; guard against accidental huge files.
      if (st.size > 2 * 1024 * 1024) {
        return { ok: false, canceled: false, error: 'ملف التفعيل كبير جداً.' };
      }
      const content = await fsp.readFile(filePath, 'utf8');
      return { ok: true, canceled: false, fileName: path.basename(filePath), content };
    } catch (e: unknown) {
      return { ok: false, canceled: false, error: toErrorMessage(e, 'تعذر قراءة ملف التفعيل') };
    }
  });
  
  ipcMain.handle('app:getLicensePublicKey', async () => {
    try {
      const envKey = String(
        process.env.AZRAR_LICENSE_PUBLIC_KEY_B64 || process.env.VITE_AZRAR_LICENSE_PUBLIC_KEY || ''
      ).trim();
      if (envKey) return { ok: true, publicKeyB64: envKey, source: 'env' };
  
      // Packaged fallback: ship a PUBLIC key file inside the app.
      const rel = path.join('electron', 'assets', 'azrar-license-public.key.json');
      const candidates = [
        path.join(app.getAppPath(), rel),
        path.join(process.resourcesPath, 'app.asar', rel),
        path.join(process.resourcesPath, rel),
      ];
  
      for (const p of candidates) {
        try {
          const raw = await fsp.readFile(p, 'utf8');
          const parsed = JSON.parse(String(raw || '').trim());
          const b64 =
            typeof parsed?.publicKeyB64 === 'string' ? String(parsed.publicKeyB64).trim() : '';
          if (b64) return { ok: true, publicKeyB64: b64, source: p };
        } catch {
          // try next
        }
      }
  
      return { ok: false, error: 'Missing license public key.' };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to load license public key') };
    }
  });
  
}
