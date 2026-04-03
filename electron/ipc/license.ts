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

export function registerLicense(deps: IpcDeps): void {
  void deps;
  // Licensing (Desktop)
  // =====================
  
  ipcMain.handle('license:getDeviceFingerprint', async () => {
    try {
      return licenseGetDeviceFingerprint();
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'تعذر قراءة بصمة الجهاز') };
    }
  });
  
  ipcMain.handle('license:getStatus', async () => {
    try {
      const st = await getLicenseStatus();
      return { ok: true, status: st };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'تعذر قراءة حالة الترخيص') };
    }
  });
  
  const isFeatureEnabled = (features: unknown, name: string): boolean => {
    const n = String(name || '').trim();
    if (!n) return false;
  
    if (Array.isArray(features)) {
      return features.map((x) => String(x || '').trim()).includes(n);
    }
  
    if (features && typeof features === 'object') {
      const rec = features as Record<string, unknown>;
      const v = rec[n];
      if (v === true) return true;
      if (typeof v === 'string') return String(v).trim().toLowerCase() === 'true';
      if (typeof v === 'number') return v > 0;
    }
  
    return false;
  };
  
  ipcMain.handle('license:hasFeature', async (_e, featureName: unknown) => {
    try {
      const name = String(featureName || '').trim();
      if (!name) return { ok: false, error: 'اسم الميزة غير صالح.' };
  
      const st = await getLicenseStatus();
      if (!st.activated) {
        return {
          ok: true,
          enabled: false,
          reason: (st as { reason?: string }).reason || 'not_activated',
        };
      }
  
      const enabled = isFeatureEnabled(
        (st as { license?: { features?: unknown } }).license?.features,
        name
      );
      return { ok: true, enabled };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'تعذر قراءة صلاحيات الترخيص') };
    }
  });
  
  ipcMain.handle('license:activateFromContent', async (_e, raw: unknown) => {
    const res = await licenseActivateWithLicenseContent(String(raw || ''));
    if ((res as { ok?: boolean }).ok) return { ok: true };
    return { ok: false, error: (res as { error?: string }).error || 'فشل التفعيل' };
  });
  
  ipcMain.handle('license:activateOnline', async (_e, payload: unknown) => {
    const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const res = await licenseActivateOnline({
      licenseKey: String(p.licenseKey || ''),
      ...(p.serverUrl ? { serverUrl: String(p.serverUrl) } : {}),
    });
    if ((res as { ok?: boolean }).ok) return { ok: true };
    return { ok: false, error: (res as { error?: string }).error || 'فشل التفعيل عبر الإنترنت' };
  });
  
  ipcMain.handle('license:getServerUrl', async () => {
    try {
      return { ok: true, url: getLicenseServerUrl() };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'تعذر قراءة رابط السيرفر') };
    }
  });
  
  ipcMain.handle('license:setServerUrl', async (_e, url: unknown) => {
    return setLicenseServerUrl(String(url || ''));
  });
  
  ipcMain.handle('license:refreshOnlineStatus', async () => {
    return await licenseRefreshOnlineStatus();
  });
  
  ipcMain.handle('license:deactivate', async () => {
    try {
      return licenseDeactivate();
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'فشل إلغاء التفعيل') };
    }
  });
  ipcMain.handle('auth:session:set', async (e, payload: unknown) => {
    const senderId = e.sender?.id;
    if (!senderId || !Number.isFinite(senderId)) return { ok: false, message: 'Invalid sender' };
  
    const rawUserId = isRecord(payload) ? payload.userId : undefined;
    const userId = String(rawUserId ?? '').trim();
  
    if (!userId) {
      ipc.sessionUserByWebContentsId.delete(senderId);
      return { ok: true };
    }
  
    const user = getDesktopUserById(userId);
    if (!user) {
      ipc.sessionUserByWebContentsId.delete(senderId);
      return { ok: false, message: 'User not recognized' };
    }
  
    ipc.sessionUserByWebContentsId.set(senderId, userId);
    return { ok: true };
  });
}
