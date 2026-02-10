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
} from './db';
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
  provisionSqlServer,
  pullAttachmentFilesForAttachmentsJson,
  pushKvDelete,
  pushKvUpsert,
  resetSqlPullState,
  restoreServerBackupFromServer,
  saveSqlBackupAutomationSettings,
  saveSqlSettings,
  startBackgroundPull,
  testSqlConnection,
} from './sqlSync';
import { validateInstallerCandidate } from './security/updaterInstallValidation.js';
import { printEngine, type PrintEngineJob } from './printing';
import { getPrintSettingsFilePath, loadPrintSettings, savePrintSettings } from './printing/settings/store';
import { desktopUserHasPermission, getDesktopUserById } from './printing/permissions';

import logger from './logger';

import { ensureInsideRoot } from './utils/pathSafety';
import { toErrorMessage } from './utils/errors';
import { isRecord } from './utils/unknown';
import { safeJsonParseArray } from './utils/json';

import {
  activateOnline as licenseActivateOnline,
  activateWithLicenseContent as licenseActivateWithLicenseContent,
  deactivate as licenseDeactivate,
  getDeviceFingerprint as licenseGetDeviceFingerprint,
  getLicenseServerUrl,
  getLicenseStatus,
  refreshOnlineStatus as licenseRefreshOnlineStatus,
  setLicenseServerUrl,
} from './license/licenseManager';
import {
  decryptFileToBuffer,
  decryptFileToFile,
  encryptBufferToFile,
  encryptFileToFile,
  isEncryptedFile,
} from './utils/fileEncryption';
import * as tar from 'tar';
import {
  decryptSecretBestEffort,
  encryptSecretBestEffort,
  getBackupEncryptionPasswordState,
  readBackupEncryptionSettings,
  writeBackupEncryptionSettings,
  type BackupEncryptionSettings,
} from './utils/backupEncryptionSettings';

const getField = (obj: unknown, field: string): unknown => (isRecord(obj) ? obj[field] : undefined);

const getStringField = (obj: unknown, field: string): string => String(getField(obj, field) ?? '');

const getNumberField = (obj: unknown, field: string): number => {
  const n = Number(getField(obj, field));
  return Number.isFinite(n) ? n : 0;
};

const getOptionalNumberField = (obj: unknown, field: string): number | undefined => {
  const raw = getField(obj, field);
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

type DomainEntity = 'people' | 'properties' | 'contracts';
const isDomainEntity = (v: string): v is DomainEntity =>
  v === 'people' || v === 'properties' || v === 'contracts';

const sessionUserByWebContentsId = new Map<number, string>();

const getSessionUserId = (sender: Electron.WebContents | undefined | null): string | undefined => {
  const id = sender?.id;
  if (!id || !Number.isFinite(id)) return undefined;
  const userId = sessionUserByWebContentsId.get(id);
  return userId ? String(userId) : undefined;
};

const requiredPrintPermissionForJob = (job: PrintEngineJob): string => {
  switch (job.type) {
    case 'currentView':
    case 'text':
      return 'PRINT_EXECUTE';
    case 'docx':
    case 'generate':
      return 'PRINT_EXPORT';
    case 'report':
      return job.mode === 'print' ? 'PRINT_EXECUTE' : 'PRINT_EXPORT';
    default:
      return 'PRINT_EXECUTE';
  }
};

type FspCpOptions = { recursive: boolean; force: boolean };
type FspCpFn = (src: string, dest: string, options: FspCpOptions) => Promise<void>;

const fspCp = async (src: string, dest: string, options: FspCpOptions): Promise<void> => {
  const cp = (fsp as unknown as { cp?: FspCpFn }).cp;
  if (!cp) throw new Error('خاصية النسخ غير مدعومة (fs.promises.cp)');
  await cp(src, dest, options);
};

type UpdaterSetFeedUrlArg = Parameters<NonNullable<typeof autoUpdater>['setFeedURL']>[0];

// electron-updater is CommonJS; when loaded from ESM bundles, Node may not support named exports.
// Access it through the default export (module.exports).
type ElectronUpdaterModule = { autoUpdater?: typeof import('electron-updater').autoUpdater };
const autoUpdater = (updaterPkg as unknown as ElectronUpdaterModule)?.autoUpdater;

type PendingRestoreInfo = {
  pending: boolean;
  createdAt?: string;
  fromVersion?: string;
  dbBackupPath?: string;
  attachmentsBackupPath?: string;
  reason?: 'install' | 'installFromFile';
  // Diagnostics / safety
  attempts?: number;
  lastError?: string;
};

// Backup encryption settings are implemented in utils/backupEncryptionSettings.ts

type UpdaterEventPayload = {
  type: string;
  message?: string;
  data?: unknown;
};

let lastUpdaterEvent: UpdaterEventPayload | null = null;
let currentFeedUrl: string | null =
  process.env.AZRAR_UPDATE_URL || process.env.AZRAR_UPDATES_URL || null;

// No default update server URL.
// Updates are enabled only when configured via env vars, saved settings, or embedded app-update.yml.
const DEFAULT_PACKAGED_FEED_URL: string | null = null;

type UpdaterSettings = {
  feedUrl?: string;
};

type SqlSyncLogEntry = {
  id: string;
  ts: string;
  direction: 'push' | 'pull' | 'system';
  action:
    | 'upsert'
    | 'delete'
    | 'connect'
    | 'syncNow'
    | 'importBackup'
    | 'restoreBackup'
    | 'exportBackup'
    | 'provision'
    | 'attachments:pull'
    | 'createServerBackup'
    | 'restoreServerBackup'
    | 'dailyBackup'
    | 'mergeUpsert'
    | 'mergePublish';
  key?: string;
  status: 'ok' | 'error';
  message?: string;
};

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

const SQL_SYNC_LOG_LIMIT = 1000;
const sqlSyncLog: SqlSyncLogEntry[] = [];

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_INSTALLER_BYTES = 500 * 1024 * 1024;
const MAX_DB_IMPORT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;
const MAX_JSON_BACKUP_BYTES = 500 * 1024 * 1024; // 500MB

const DB_KEYS = {
  PEOPLE: 'db_people',
  ROLES: 'db_roles',
  PROPERTIES: 'db_properties',
  CONTRACTS: 'db_contracts',
  BLACKLIST: 'db_blacklist',
  OWNERSHIP_HISTORY: 'db_ownership_history',
  INSPECTIONS: 'db_property_inspections',
  SALES_LISTINGS: 'db_sales_listings',
  SALES_AGREEMENTS: 'db_sales_agreements',
  SALES_OFFERS: 'db_sales_offers',
  EXTERNAL_COMMISSIONS: 'db_external_commissions',
  FOLLOW_UPS: 'db_followups',
  REMINDERS: 'db_reminders',
  ATTACHMENTS: 'db_attachments',
  ACTIVITIES: 'db_activities',
  NOTES: 'db_notes',
} as const;

const kvGetArray = (key: string): unknown[] => safeJsonParseArray(kvGet(key));

const kvSetArray = (key: string, items: unknown[]): void => {
  kvSet(key, JSON.stringify(items ?? []));
};

const mergeRecords = (base: unknown, patch: unknown): unknown => {
  if (!isRecord(base)) return isRecord(patch) ? patch : base;
  if (!isRecord(patch)) return base;
  return { ...base, ...patch };
};

const isUncPath = (p: string): boolean => {
  const s = String(p || '');
  return s.startsWith('\\\\') || s.startsWith('//');
};

const getBetterSqlite3RebuildHint = (e: unknown): string | null => {
  const msg = String((e as { message?: unknown } | null)?.message ?? e ?? '');
  const lower = msg.toLowerCase();
  const mentionsAddon = lower.includes('better_sqlite3.node') || lower.includes('better-sqlite3');
  const isWin32BinaryError = lower.includes('not a valid win32 application');
  const isDlopen = lower.includes('err_dlopen_failed') || lower.includes('dlopen');

  if (!mentionsAddon) return null;
  if (!isWin32BinaryError && !isDlopen) return null;

  return [
    'يبدو أن مكتبة قاعدة البيانات المحلية (better-sqlite3) غير مبنية لنسخة Electron الحالية أو لمعمارية مختلفة.',
    'الحل (Windows):',
    '1) npx @electron/rebuild -f -w better-sqlite3',
    '2) npm run desktop:dev',
  ].join('\n');
};

type AuthenticodeVerification =
  | { ok: true; status: 'Valid'; subject?: string; thumbprint?: string; statusMessage?: string }
  | {
      ok: false;
      status?: string;
      subject?: string;
      thumbprint?: string;
      statusMessage?: string;
      message: string;
    };

function verifyWindowsExeAuthenticodeSync(filePath: string): AuthenticodeVerification {
  // Only meaningful on Windows.
  if (process.platform !== 'win32') return { ok: true, status: 'Valid' };

  const p = String(filePath || '').trim();
  if (!p) return { ok: false, message: 'مسار ملف التحديث غير صالح' };

  const allowUnsigned = String(process.env.AZRAR_ALLOW_UNSIGNED_UPDATES || '').trim() === '1';

  // Avoid command injection: pass the path as an argument and read it from $args[0].
  const psScript = [
    "$ErrorActionPreference = 'Stop';",
    '$sig = Get-AuthenticodeSignature -FilePath $args[0];',
    '$cert = $sig.SignerCertificate;',
    '[pscustomobject]@{',
    '  Status = $sig.Status.ToString();',
    '  StatusMessage = $sig.StatusMessage;',
    '  Subject = if ($cert) { $cert.Subject } else { "" };',
    '  Thumbprint = if ($cert) { $cert.Thumbprint } else { "" };',
    '} | ConvertTo-Json -Compress',
  ].join(' ');

  const res = spawnSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript, p],
    { encoding: 'utf8', windowsHide: true }
  );

  if (res.error) {
    if (allowUnsigned)
      return {
        ok: true,
        status: 'Valid',
        statusMessage: 'ALLOW_UNSIGNED_UPDATES=1 (PowerShell failed)',
      };
    return { ok: false, message: 'تعذر التحقق من توقيع ملف التحديث (PowerShell غير متاح)' };
  }

  const stdout = String(res.stdout || '').trim();
  if (!stdout) {
    if (allowUnsigned)
      return {
        ok: true,
        status: 'Valid',
        statusMessage: 'ALLOW_UNSIGNED_UPDATES=1 (empty signature output)',
      };
    return { ok: false, message: 'تعذر التحقق من توقيع ملف التحديث' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    if (allowUnsigned)
      return {
        ok: true,
        status: 'Valid',
        statusMessage: 'ALLOW_UNSIGNED_UPDATES=1 (unparseable signature output)',
      };
    return { ok: false, message: 'تعذر التحقق من توقيع ملف التحديث' };
  }

  const status = getStringField(parsed, 'Status').trim();
  const statusMessage = getStringField(parsed, 'StatusMessage').trim();
  const subject = getStringField(parsed, 'Subject').trim();
  const thumbprint = getStringField(parsed, 'Thumbprint').trim();

  if (status === 'Valid') {
    return { ok: true, status: 'Valid', statusMessage, subject, thumbprint };
  }

  if (allowUnsigned) {
    return {
      ok: true,
      status: 'Valid',
      statusMessage: `ALLOW_UNSIGNED_UPDATES=1 (signature status: ${status || 'Unknown'})`,
      subject,
      thumbprint,
    };
  }

  const human =
    statusMessage || (status ? `حالة التوقيع: ${status}` : 'ملف التحديث غير موقّع أو غير صالح');
  return {
    ok: false,
    status,
    statusMessage,
    subject,
    thumbprint,
    message: `ملف التحديث غير آمن: ${human}`,
  };
}

const trimString = (value: unknown, maxLen: number, fieldLabel: string): string => {
  const s = String(value ?? '').trim();
  if (s.length > maxLen) throw new Error(`${fieldLabel} طويل جداً`);
  return s;
};

const safePortOrDefault = (value: unknown, fallback = 1433): number => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const p = Math.trunc(n);
  if (p < 1 || p > 65535) return fallback;
  return p;
};

const toLimitedPassword = (value: unknown, maxLen = 512): string => {
  if (typeof value !== 'string') return '';
  if (value.length > maxLen) throw new Error('كلمة المرور طويلة جداً');
  return value;
};

function addSqlSyncLogEntry(
  entry: Omit<SqlSyncLogEntry, 'id' | 'ts'> & { ts?: string }
): SqlSyncLogEntry {
  const full: SqlSyncLogEntry = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ts: entry.ts || new Date().toISOString(),
    direction: entry.direction,
    action: entry.action,
    key: entry.key,
    status: entry.status,
    message: entry.message,
  };

  sqlSyncLog.unshift(full);
  if (sqlSyncLog.length > SQL_SYNC_LOG_LIMIT) sqlSyncLog.length = SQL_SYNC_LOG_LIMIT;

  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('sql:syncEvent', full);
    } catch {
      // ignore
    }
  }

  return full;
}

// Prevent concurrent DB access during restore/import/export.
let dbMaintenanceMode = false;
let restoreInProgress = false;

async function startSqlPullLoop(): Promise<void> {
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
        broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
        addSqlSyncLogEntry({
          direction: 'pull',
          action: 'delete',
          key: row.k,
          status: 'ok',
          ts: remoteTs,
        });
      } else {
        kvSetWithUpdatedAt(row.k, row.v, remoteTs);
        broadcastDbRemoteUpdate({
          key: row.k,
          value: row.v,
          isDeleted: false,
          updatedAt: remoteTs,
        });
        addSqlSyncLogEntry({
          direction: 'pull',
          action: 'upsert',
          key: row.k,
          status: 'ok',
          ts: remoteTs,
        });

        // Attachments: ensure the actual files exist locally after syncing metadata.
        if (row.k === 'db_attachments') {
          try {
            const res = await pullAttachmentFilesForAttachmentsJson(row.v);
            if (res.downloaded > 0) {
              addSqlSyncLogEntry({
                direction: 'system',
                action: 'attachments:pull',
                status: 'ok',
                message: `تم تنزيل ${res.downloaded} مرفق/مرفقات`,
              });
            }
            if (res.missingRemote > 0) {
              addSqlSyncLogEntry({
                direction: 'system',
                action: 'attachments:pull',
                status: 'error',
                message: `مرفقات غير موجودة على المخدم: ${res.missingRemote}`,
              });
            }
          } catch (e: unknown) {
            addSqlSyncLogEntry({
              direction: 'system',
              action: 'attachments:pull',
              status: 'error',
              message: toErrorMessage(e, 'فشل تنزيل المرفقات'),
            });
          }
        }
      }
    },
    { runImmediately: true }
  );
}

async function pushAllLocalToRemote(): Promise<{
  upsertsOk: number;
  deletesOk: number;
  errors: number;
}> {
  const keys = kvKeys();
  const concurrency = 8;
  let idx = 0;

  let upsertsOk = 0;
  let deletesOk = 0;
  let errors = 0;

  const worker = async () => {
    while (idx < keys.length) {
      const i = idx++;
      const k = keys[i];
      if (!k) continue;

      const deletedAt = kvGetDeletedAt(k);
      if (deletedAt) {
        try {
          await pushKvDelete({ key: k, deletedAt });
          addSqlSyncLogEntry({
            direction: 'push',
            action: 'delete',
            key: k,
            status: 'ok',
            ts: deletedAt,
          });
          deletesOk += 1;
        } catch (e: unknown) {
          addSqlSyncLogEntry({
            direction: 'push',
            action: 'delete',
            key: k,
            status: 'error',
            message: toErrorMessage(e, 'فشل رفع الحذف'),
          });
          errors += 1;
        }
        continue;
      }

      const meta = kvGetMeta(k);
      const v = kvGet(k);
      if (typeof v !== 'string') continue;
      const updatedAt = meta?.updatedAt || new Date().toISOString();
      try {
        await pushKvUpsert({ key: k, value: v, updatedAt });
        addSqlSyncLogEntry({
          direction: 'push',
          action: 'upsert',
          key: k,
          status: 'ok',
          ts: updatedAt,
        });
        upsertsOk += 1;
      } catch (e: unknown) {
        addSqlSyncLogEntry({
          direction: 'push',
          action: 'upsert',
          key: k,
          status: 'error',
          message: toErrorMessage(e, 'فشل رفع التحديث'),
        });
        errors += 1;
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, keys.length)) }, () =>
    worker()
  );
  await Promise.all(workers);

  return { upsertsOk, deletesOk, errors };
}

async function pushDeltaToRemoteSince(
  sinceIso: string
): Promise<{ upsertsOk: number; deletesOk: number; errors: number; latestTs: string }> {
  const updated = kvListUpdatedSince(sinceIso);
  const deleted = kvListDeletedSince(sinceIso);

  let upsertsOk = 0;
  let deletesOk = 0;
  let errors = 0;
  let latestTs =
    sinceIso && String(sinceIso).trim() ? String(sinceIso).trim() : '1970-01-01T00:00:00.000Z';

  const tasks: Array<() => Promise<void>> = [];

  for (const row of deleted) {
    const k = getStringField(row, 'k').trim();
    const deletedAt = getStringField(row, 'deletedAt').trim();
    if (!k || !deletedAt) continue;
    if (new Date(deletedAt).getTime() > new Date(latestTs).getTime()) latestTs = deletedAt;
    tasks.push(async () => {
      try {
        await pushKvDelete({ key: k, deletedAt });
        addSqlSyncLogEntry({
          direction: 'push',
          action: 'delete',
          key: k,
          status: 'ok',
          ts: deletedAt,
        });
        deletesOk += 1;
      } catch (e: unknown) {
        addSqlSyncLogEntry({
          direction: 'push',
          action: 'delete',
          key: k,
          status: 'error',
          message: toErrorMessage(e, 'فشل رفع الحذف'),
        });
        errors += 1;
      }
    });
  }

  for (const row of updated) {
    const k = getStringField(row, 'k').trim();
    const v = getField(row, 'v');
    const updatedAt = getStringField(row, 'updatedAt').trim();
    if (!k || typeof v !== 'string' || !updatedAt) continue;
    if (new Date(updatedAt).getTime() > new Date(latestTs).getTime()) latestTs = updatedAt;
    tasks.push(async () => {
      try {
        await pushKvUpsert({ key: k, value: v, updatedAt });
        addSqlSyncLogEntry({
          direction: 'push',
          action: 'upsert',
          key: k,
          status: 'ok',
          ts: updatedAt,
        });
        upsertsOk += 1;
      } catch (e: unknown) {
        addSqlSyncLogEntry({
          direction: 'push',
          action: 'upsert',
          key: k,
          status: 'error',
          message: toErrorMessage(e, 'فشل رفع التحديث'),
        });
        errors += 1;
      }
    });
  }

  if (tasks.length === 0) return { upsertsOk, deletesOk, errors, latestTs };

  const concurrency = 6;
  let idx = 0;
  const worker = async () => {
    while (idx < tasks.length) {
      const i = idx++;
      const t = tasks[i];
      if (!t) continue;
      await t();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));

  return { upsertsOk, deletesOk, errors, latestTs };
}

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
let autoSyncInFlight = false;
let lastAutoPushIso: string = '';

function startAutoSyncPushLoop() {
  if (autoSyncTimer) return;
  // Start from "now"; we also do an initial full push after auto-connect.
  lastAutoPushIso = new Date().toISOString();

  const intervalMs = 300_000;
  autoSyncTimer = setInterval(() => {
    void (async () => {
      if (autoSyncInFlight) return;
      autoSyncInFlight = true;
      try {
        const settings = await loadSqlSettings();
        if (!settings.enabled) return;
        const conn = await connectAndEnsureDatabase(settings);
        if (!conn.ok) return;

        const res = await pushDeltaToRemoteSince(lastAutoPushIso);
        if (
          res.latestTs &&
          new Date(res.latestTs).getTime() > new Date(lastAutoPushIso).getTime()
        ) {
          lastAutoPushIso = res.latestTs;
        } else {
          lastAutoPushIso = new Date().toISOString();
        }

        if (res.upsertsOk > 0 || res.deletesOk > 0 || res.errors > 0) {
          const parts: string[] = [];
          if (res.upsertsOk > 0) parts.push(`تعديل ${res.upsertsOk}`);
          if (res.deletesOk > 0) parts.push(`حذف ${res.deletesOk}`);
          if (res.errors > 0) parts.push(`أخطاء ${res.errors}`);
          addSqlSyncLogEntry({
            direction: 'system',
            action: 'syncNow',
            status: res.errors > 0 ? 'error' : 'ok',
            message: `مزامنة تلقائية (رفع): ${parts.join(' / ')}`,
          });
        }
      } catch {
        // ignore
      } finally {
        autoSyncInFlight = false;
      }
    })();
  }, intervalMs);
}

function broadcastDbRemoteUpdate(payload: {
  key: string;
  value?: string;
  isDeleted?: boolean;
  updatedAt?: string;
}) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('db:remoteUpdate', payload);
    } catch {
      // ignore
    }
  }
}

function broadcastUpdaterEvent(payload: UpdaterEventPayload) {
  lastUpdaterEvent = payload;
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('updater:event', payload);
    } catch {
      // ignore
    }
  }
}

function getUpdateHostAllowlist(): string[] {
  const raw = String(
    process.env.AZRAR_UPDATE_HOST_ALLOWLIST || process.env.AZRAR_UPDATER_HOST_ALLOWLIST || ''
  ).trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) =>
      String(s || '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
}

function hostnameMatchesAllowlist(hostnameRaw: string, allowlist: string[]): boolean {
  const hostname = String(hostnameRaw || '').toLowerCase();
  if (!hostname) return false;
  if (allowlist.length === 0) return true;
  return allowlist.some((pattern) => {
    const p = String(pattern || '').toLowerCase();
    if (!p) return false;
    if (p.startsWith('*.')) {
      const suffix = p.slice(1); // includes leading dot
      return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }
    return hostname === p;
  });
}

function isPrivateHost(hostnameRaw: string): boolean {
  const hostname = String(hostnameRaw || '').toLowerCase();
  if (!hostname) return false;
  if (hostname === 'localhost') return true;
  if (hostname === '::1') return true;
  if (hostname.endsWith('.local')) return true;

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    const c = Number(ipv4[3]);
    const d = Number(ipv4[4]);
    const partsOk = [a, b, c, d].every((n) => Number.isFinite(n) && n >= 0 && n <= 255);
    if (!partsOk) return false;

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  // IPv6 Unique Local Addresses (fc00::/7) are private.
  if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true;

  return false;
}

function normalizeFeedUrl(urlRaw: string): string {
  const raw = String(urlRaw || '').trim();
  if (!raw) throw new Error('رابط التحديث فارغ');

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('رابط التحديث غير صالح');
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('يرجى إدخال رابط يبدأ بـ http:// أو https://');
  }
  if (!u.hostname) throw new Error('رابط التحديث غير صالح');
  if (u.username || u.password)
    throw new Error('رابط التحديث لا يجب أن يحتوي على اسم مستخدم/كلمة مرور');

  const allowlist = getUpdateHostAllowlist();
  if (!hostnameMatchesAllowlist(u.hostname, allowlist)) {
    throw new Error('نطاق رابط التحديث غير مسموح (تحقق من إعدادات allowlist)');
  }

  // Prefer HTTPS for non-LAN hosts to reduce MITM risk.
  if (u.protocol === 'http:' && !isPrivateHost(u.hostname)) {
    throw new Error(
      'لروابط التحديث العامة، يرجى استخدام https:// (مسموح http داخل الشبكة المحلية فقط)'
    );
  }

  // For generic provider, a trailing slash is safer.
  u.hash = '';
  if (!u.pathname.endsWith('/')) u.pathname = `${u.pathname}/`;
  return u.toString();
}

function hasEmbeddedUpdaterConfig(): boolean {
  if (!app.isPackaged) return false;
  // electron-updater reads publish config from app-update.yml generated by electron-builder.
  // If it exists, updates can work without calling setFeedURL explicitly.
  try {
    const candidates = [
      path.join(process.resourcesPath, 'app-update.yml'),
      path.join(process.resourcesPath, 'app-update.yaml'),
    ];
    return candidates.some((p) => fs.existsSync(p));
  } catch {
    return false;
  }
}

function getUpdaterSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'updater-settings.json');
}

function readUpdaterSettingsSync(): UpdaterSettings {
  try {
    const raw = fs.readFileSync(getUpdaterSettingsFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as UpdaterSettings;
  } catch {
    return {};
  }
}

async function writeUpdaterSettings(next: UpdaterSettings): Promise<void> {
  const filePath = getUpdaterSettingsFilePath();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
}

function configureUpdaterIfPossible() {
  if (!autoUpdater) return;
  if (!app.isPackaged) return;
  // Always disable autoDownload; we control it from UI.
  autoUpdater.autoDownload = false;

  // If no env URL was provided, try loading a persisted feed URL.
  if (!currentFeedUrl) {
    const saved = readUpdaterSettingsSync();
    if (saved?.feedUrl) currentFeedUrl = String(saved.feedUrl);
  }

  // Final fallback: use the default LAN URL so updates work automatically out of the box.
  if (!currentFeedUrl && DEFAULT_PACKAGED_FEED_URL) {
    currentFeedUrl = DEFAULT_PACKAGED_FEED_URL;
  }

  if (currentFeedUrl) {
    try {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: normalizeFeedUrl(currentFeedUrl),
      } as UpdaterSetFeedUrlArg);
    } catch (e: unknown) {
      broadcastUpdaterEvent({ type: 'error', message: toErrorMessage(e, 'فشل ضبط رابط التحديث') });
    }
  }
}

function getUpdateStateFilePath(): string {
  return path.join(app.getPath('userData'), 'update-state.json');
}

function getBackupSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'backup-settings.json');
}

type BackupSettings = {
  backupDir?: string;
};

type LocalBackupAutomationSettings = {
  v: 1;
  enabled?: boolean;
  timeHHmm?: string; // local time, e.g. "02:00"
  retentionDays?: number;
  lastRunAt?: string; // ISO
  updatedAt?: string; // ISO
};

type LocalBackupLogEntry = {
  ts: string; // ISO
  ok: boolean;
  trigger: 'auto' | 'manual';
  message?: string;
  latestPath?: string;
  archivePath?: string;
  attachmentsLatestPath?: string;
  attachmentsArchivePath?: string;
};

function getLocalBackupLogPath(): string {
  return path.join(app.getPath('userData'), 'local-backup-log.json');
}

async function readLocalBackupLogEntries(limit = 200): Promise<LocalBackupLogEntry[]> {
  try {
    const raw = await fsp.readFile(getLocalBackupLogPath(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const items = parsed
        .filter((x) => x && typeof x === 'object')
        .map((x) => x as Record<string, unknown>)
        .map((x) => ({
          ts: typeof x.ts === 'string' ? x.ts : new Date().toISOString(),
          ok: x.ok === true,
          trigger: x.trigger === 'manual' ? 'manual' : 'auto',
          message: typeof x.message === 'string' ? x.message : undefined,
          latestPath: typeof x.latestPath === 'string' ? x.latestPath : undefined,
          archivePath: typeof x.archivePath === 'string' ? x.archivePath : undefined,
          attachmentsLatestPath: typeof x.attachmentsLatestPath === 'string' ? x.attachmentsLatestPath : undefined,
          attachmentsArchivePath: typeof x.attachmentsArchivePath === 'string' ? x.attachmentsArchivePath : undefined,
        })) as LocalBackupLogEntry[];
      return items.slice(-Math.max(1, Math.min(1000, Math.floor(limit))));
    }
  } catch {
    // ignore
  }
  return [];
}

async function appendLocalBackupLogEntry(entry: LocalBackupLogEntry): Promise<void> {
  try {
    const items = await readLocalBackupLogEntries(400);
    items.push({
      ts: entry.ts || new Date().toISOString(),
      ok: entry.ok === true,
      trigger: entry.trigger === 'manual' ? 'manual' : 'auto',
      message: entry.message,
      latestPath: entry.latestPath,
      archivePath: entry.archivePath,
      attachmentsLatestPath: entry.attachmentsLatestPath,
      attachmentsArchivePath: entry.attachmentsArchivePath,
    });
    const trimmed = items.slice(-200);
    await fsp.mkdir(path.dirname(getLocalBackupLogPath()), { recursive: true });
    await fsp.writeFile(getLocalBackupLogPath(), JSON.stringify(trimmed, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

async function clearLocalBackupLog(): Promise<void> {
  try {
    await fsp.unlink(getLocalBackupLogPath());
  } catch {
    // ignore
  }
}

type LocalBackupFileInfo = {
  name: string;
  mtimeMs: number;
  size: number;
};

async function getLocalBackupStatsBestEffort(dir: string): Promise<{
  ok: boolean;
  backupDir?: string;
  dbArchivesCount: number;
  attachmentsArchivesCount: number;
  latestDbExists: boolean;
  latestAttachmentsExists: boolean;
  totalBytes: number;
  newestMtimeMs: number;
  files: LocalBackupFileInfo[];
}> {
  const root = dir && isExistingDirectory(dir) ? path.resolve(dir) : '';
  if (!root) {
    return {
      ok: false,
      dbArchivesCount: 0,
      attachmentsArchivesCount: 0,
      latestDbExists: false,
      latestAttachmentsExists: false,
      totalBytes: 0,
      newestMtimeMs: 0,
      files: [],
    };
  }

  let names: string[] = [];
  try {
    names = await fsp.readdir(root);
  } catch {
    names = [];
  }

  const safeJoin = (name: string) => {
    const abs = path.resolve(path.join(root, name));
    if (!abs.startsWith(root + path.sep) && abs !== root) return null;
    return abs;
  };

  const isLatestDb = (n: string) => n === 'AZRAR-backup-latest.db' || n === 'AZRAR-backup-latest.db.enc';
  const isLatestAtt = (n: string) => n === 'AZRAR-attachments-latest.tar.gz' || n === 'AZRAR-attachments-latest.tar.gz.enc';

  const isDbArchive = (n: string) =>
    /^AZRAR-backup-\d{4}-\d{2}-\d{2}(?:-\d+)?\.db(\.enc)?$/i.test(n);
  const isAttArchive = (n: string) =>
    /^AZRAR-attachments-\d{4}-\d{2}-\d{2}(?:-\d+)?\.tar\.gz(\.enc)?$/i.test(n);

  let dbArchivesCount = 0;
  let attachmentsArchivesCount = 0;
  let latestDbExists = false;
  let latestAttachmentsExists = false;
  let totalBytes = 0;
  let newestMtimeMs = 0;
  const files: LocalBackupFileInfo[] = [];

  for (const name of names) {
    if (!name) continue;
    if (!(isLatestDb(name) || isLatestAtt(name) || isDbArchive(name) || isAttArchive(name))) continue;
    const abs = safeJoin(name);
    if (!abs) continue;
    try {
      const st = await fsp.stat(abs);
      if (!st.isFile()) continue;
      files.push({ name, mtimeMs: st.mtimeMs, size: st.size });
      totalBytes += st.size;
      newestMtimeMs = Math.max(newestMtimeMs, st.mtimeMs);
      if (isLatestDb(name)) latestDbExists = true;
      if (isLatestAtt(name)) latestAttachmentsExists = true;
      if (isDbArchive(name)) dbArchivesCount += 1;
      if (isAttArchive(name)) attachmentsArchivesCount += 1;
    } catch {
      // ignore
    }
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return {
    ok: true,
    backupDir: root,
    dbArchivesCount,
    attachmentsArchivesCount,
    latestDbExists,
    latestAttachmentsExists,
    totalBytes,
    newestMtimeMs,
    files: files.slice(0, 60),
  };
}

function getLocalBackupAutomationSettingsPath(): string {
  return path.join(app.getPath('userData'), 'local-backup-automation.json');
}

function normalizeTimeHHmm(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!/^[0-2]\d:[0-5]\d$/.test(s)) return '02:00';
  const [hh, mm] = s.split(':').map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '02:00';
  if (hh < 0 || hh > 23) return '02:00';
  if (mm < 0 || mm > 59) return '02:00';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizeRetentionDays(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 30;
  const i = Math.floor(n);
  return Math.min(3650, Math.max(1, i));
}

async function readLocalBackupAutomationSettings(): Promise<LocalBackupAutomationSettings> {
  try {
    const raw = await fsp.readFile(getLocalBackupAutomationSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as Record<string, unknown>;
      return {
        v: 1,
        enabled: rec.enabled === undefined ? undefined : !!rec.enabled,
        timeHHmm: normalizeTimeHHmm(rec.timeHHmm),
        retentionDays: normalizeRetentionDays(rec.retentionDays),
        lastRunAt: typeof rec.lastRunAt === 'string' ? String(rec.lastRunAt) : undefined,
        updatedAt: typeof rec.updatedAt === 'string' ? String(rec.updatedAt) : undefined,
      };
    }
  } catch {
    // ignore
  }
  return { v: 1, enabled: false, timeHHmm: '02:00', retentionDays: 30 };
}

async function writeLocalBackupAutomationSettings(next: LocalBackupAutomationSettings): Promise<void> {
  const out: LocalBackupAutomationSettings = {
    v: 1,
    enabled: next.enabled === true,
    timeHHmm: normalizeTimeHHmm(next.timeHHmm),
    retentionDays: normalizeRetentionDays(next.retentionDays),
    lastRunAt: next.lastRunAt,
    updatedAt: new Date().toISOString(),
  };
  await fsp.mkdir(path.dirname(getLocalBackupAutomationSettingsPath()), { recursive: true });
  await fsp.writeFile(getLocalBackupAutomationSettingsPath(), JSON.stringify(out, null, 2), 'utf8');
}

function ymdLocal(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isBackupDueToday(settings: LocalBackupAutomationSettings, now = new Date()): boolean {
  if (settings.enabled !== true) return false;
  const time = normalizeTimeHHmm(settings.timeHHmm);
  const [hh, mm] = time.split(':').map((x) => Number(x));
  const dueAt = new Date(now);
  dueAt.setHours(hh, mm, 0, 0);

  const last = settings.lastRunAt ? new Date(settings.lastRunAt) : null;
  const lastYMD = last && Number.isFinite(last.getTime()) ? ymdLocal(last) : '';
  const todayYMD = ymdLocal(now);
  if (lastYMD === todayYMD) return false;

  return now.getTime() >= dueAt.getTime();
}

async function pruneLocalBackupsBestEffort(dir: string, retentionDays: number): Promise<void> {
  const root = path.resolve(dir);
  const cutoff = Date.now() - normalizeRetentionDays(retentionDays) * 24 * 60 * 60 * 1000;
  const safeJoin = (name: string) => {
    const abs = path.resolve(path.join(root, name));
    if (!abs.startsWith(root + path.sep) && abs !== root) return null;
    return abs;
  };

  let entries: string[] = [];
  try {
    entries = await fsp.readdir(root);
  } catch {
    return;
  }

  const isLatest = (n: string) =>
    n === 'AZRAR-backup-latest.db' ||
    n === 'AZRAR-backup-latest.db.enc' ||
    n === 'AZRAR-attachments-latest.tar.gz' ||
    n === 'AZRAR-attachments-latest.tar.gz.enc';

  const isManaged = (n: string) =>
    /^AZRAR-backup-\d{4}-\d{2}-\d{2}\.db(\.enc)?$/i.test(n) ||
    /^AZRAR-backup-\d{4}-\d{2}-\d{2}-\d+\.db(\.enc)?$/i.test(n) ||
    /^AZRAR-attachments-\d{4}-\d{2}-\d{2}\.tar\.gz(\.enc)?$/i.test(n) ||
    /^AZRAR-attachments-\d{4}-\d{2}-\d{2}-\d+\.tar\.gz(\.enc)?$/i.test(n);

  for (const name of entries) {
    if (!name) continue;
    if (isLatest(name)) continue;
    if (!isManaged(name)) continue;
    const abs = safeJoin(name);
    if (!abs) continue;
    try {
      const st = await fsp.stat(abs);
      if (!st.isFile()) continue;
      if (st.mtimeMs < cutoff) {
        await fsp.unlink(abs);
      }
    } catch {
      // ignore
    }
  }
}

let localAutoBackupTimer: NodeJS.Timeout | null = null;
let localAutoBackupInProgress = false;

async function runLocalBackupToDir(dir: string): Promise<{
  ok: boolean;
  message?: string;
  latestPath?: string;
  archivePath?: string;
  attachmentsLatestPath?: string;
  attachmentsArchivePath?: string;
}> {
  if (dbMaintenanceMode)
    return { ok: false, message: 'قاعدة البيانات قيد الاسترجاع/الصيانة. حاول لاحقاً.' };

  const backupDir = dir && isExistingDirectory(dir) ? dir : '';
  if (!backupDir) return { ok: false, message: 'مجلد النسخ الاحتياطي غير مضبوط' };

  const encState = await getBackupEncryptionPasswordState();
  const encryptionRequested = encState.enabled;
  const encryptionConfigured = encState.configured;
  const encryptionPassword = encState.password;

  const today = new Date().toISOString().slice(0, 10);

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

  const latestPath = path.join(
    backupDir,
    encryptionRequested ? 'AZRAR-backup-latest.db.enc' : 'AZRAR-backup-latest.db'
  );
  const archivePath = makeUniqueArchivePath(
    path.join(
      backupDir,
      encryptionRequested ? `AZRAR-backup-${today}.db.enc` : `AZRAR-backup-${today}.db`
    )
  );

  const attachmentsLatestPath = path.join(
    backupDir,
    encryptionRequested ? 'AZRAR-attachments-latest.tar.gz.enc' : 'AZRAR-attachments-latest.tar.gz'
  );
  const attachmentsArchivePath = makeUniqueArchivePath(
    path.join(
      backupDir,
      encryptionRequested
        ? `AZRAR-attachments-${today}.tar.gz.enc`
        : `AZRAR-attachments-${today}.tar.gz`
    )
  );

  try {
    dbMaintenanceMode = true;
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
        await encryptFileToFile({ sourcePath: tmpPlain, destPath: latestPath, password: encryptionPassword });
        await encryptFileToFile({ sourcePath: tmpPlain, destPath: archivePath, password: encryptionPassword });
      } finally {
        try {
          await fsp.unlink(tmpPlain);
        } catch {
          // ignore
        }
      }
    }

    let attachmentsCopied = false;
    try {
      const res = await exportAttachmentsArchiveToMany({
        destPaths: [attachmentsLatestPath, attachmentsArchivePath],
        encryptionRequested,
        encryptionConfigured,
        encryptionPassword,
      });
      attachmentsCopied = res.copiedAny;
    } catch {
      attachmentsCopied = false;
    }

    return {
      ok: true,
      latestPath,
      archivePath,
      attachmentsLatestPath: attachmentsCopied ? attachmentsLatestPath : undefined,
      attachmentsArchivePath: attachmentsCopied ? attachmentsArchivePath : undefined,
    };
  } catch (e: unknown) {
    return { ok: false, message: toErrorMessage(e, 'فشل إنشاء النسخة الاحتياطية') };
  } finally {
    dbMaintenanceMode = false;
  }
}

function startLocalAutoBackupScheduler(): void {
  if (localAutoBackupTimer) return;

  const tick = async () => {
    if (localAutoBackupInProgress) return;
    localAutoBackupInProgress = true;
    try {
      const settings = await readLocalBackupAutomationSettings();
      if (settings.enabled !== true) return;

      const backupSettings = await readBackupSettings();
      const dir =
        backupSettings.backupDir && isExistingDirectory(backupSettings.backupDir)
          ? backupSettings.backupDir
          : '';
      if (!dir) return;

      if (!isBackupDueToday(settings)) return;

      const res = await runLocalBackupToDir(dir);
      if (res.ok) {
        await writeLocalBackupAutomationSettings({
          ...settings,
          enabled: true,
          lastRunAt: new Date().toISOString(),
        });
        await pruneLocalBackupsBestEffort(dir, settings.retentionDays ?? 30);
        await appendLocalBackupLogEntry({
          ts: new Date().toISOString(),
          ok: true,
          trigger: 'auto',
          message: 'تم إنشاء نسخة احتياطية تلقائية',
          latestPath: res.latestPath,
          archivePath: res.archivePath,
          attachmentsLatestPath: res.attachmentsLatestPath,
          attachmentsArchivePath: res.attachmentsArchivePath,
        });
      } else {
        await appendLocalBackupLogEntry({
          ts: new Date().toISOString(),
          ok: false,
          trigger: 'auto',
          message: res.message || 'فشل النسخ الاحتياطي التلقائي',
        });
      }
    } catch (e: unknown) {
      logger.warn('[auto-backup] failed', toErrorMessage(e, 'فشل النسخ الاحتياطي التلقائي'));
      await appendLocalBackupLogEntry({
        ts: new Date().toISOString(),
        ok: false,
        trigger: 'auto',
        message: toErrorMessage(e, 'فشل النسخ الاحتياطي التلقائي'),
      });
    } finally {
      localAutoBackupInProgress = false;
    }
  };

  // Run a first check shortly after app startup.
  setTimeout(() => void tick(), 30_000);
  // Poll every 5 minutes.
  localAutoBackupTimer = setInterval(() => void tick(), 5 * 60 * 1000);
}

async function readBackupSettings(): Promise<BackupSettings> {
  try {
    const raw = await fsp.readFile(getBackupSettingsFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BackupSettings;
  } catch {
    return {};
  }
}

async function writeBackupSettings(next: BackupSettings): Promise<void> {
  await fsp.writeFile(getBackupSettingsFilePath(), JSON.stringify(next, null, 2), 'utf8');
}

function isExistingDirectory(p: string): boolean {
  try {
    return !!p && fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function formatBackupStamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function chooseJsonFileViaDialog(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'اختر ملف النسخة الاحتياطية',
    properties: ['openFile'],
    filters: [
      { name: 'Backup File', extensions: ['json', 'enc'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'Encrypted Backup', extensions: ['enc'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const selected = result.filePaths[0];
  if (!selected) return null;

  const resolved = await fsp.realpath(selected).catch(() => path.resolve(selected));
  if (isUncPath(resolved)) throw new Error('غير مسموح اختيار ملف نسخة احتياطية من مسار شبكة (UNC)');

  const ext = path.extname(resolved).toLowerCase();
  const encryptedByMagic = await isEncryptedFile(resolved);
  const encryptedByExt = ext === '.enc';
  const isEncrypted = encryptedByMagic || encryptedByExt;

  if (!isEncrypted && ext !== '.json') throw new Error('الملف يجب أن يكون JSON أو ملف مشفر (.enc)');

  const st = await fsp.stat(resolved);
  if (!st.isFile()) throw new Error('الملف غير صالح');
  if (st.size <= 0) throw new Error('الملف فارغ');
  if (st.size > MAX_JSON_BACKUP_BYTES) throw new Error('حجم ملف النسخة الاحتياطية كبير جداً');

  return resolved;
}

async function chooseBackupDirViaDialog(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'اختر مجلد النسخ الاحتياطي',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const dir = result.filePaths[0];
  if (!isExistingDirectory(dir)) return null;
  return dir;
}

async function readPendingRestoreInfo(): Promise<PendingRestoreInfo> {
  try {
    const raw = await fsp.readFile(getUpdateStateFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { pending: false };
    if (parsed.pending !== true) return { pending: false };
    return {
      pending: true,
      createdAt: String(parsed.createdAt || ''),
      fromVersion: String(parsed.fromVersion || ''),
      dbBackupPath: String(parsed.dbBackupPath || ''),
      attachmentsBackupPath: String(parsed.attachmentsBackupPath || ''),
      reason: parsed.reason === 'installFromFile' ? 'installFromFile' : 'install',
      attempts: getNumberField(parsed, 'attempts'),
      lastError: getField(parsed, 'lastError') ? getStringField(parsed, 'lastError') : undefined,
    };
  } catch {
    return { pending: false };
  }
}

async function writePendingRestoreInfo(info: PendingRestoreInfo): Promise<void> {
  const filePath = getUpdateStateFilePath();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(info, null, 2), 'utf8');
}

async function clearPendingRestoreInfo(): Promise<void> {
  const filePath = getUpdateStateFilePath();
  try {
    await fsp.unlink(filePath);
    return;
  } catch {
    // Fallback: on some systems (AV/OneDrive/permissions) unlink may fail.
    // If we cannot delete the file, overwrite it with pending:false to prevent
    // boot loops / repeated restore prompts.
    try {
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, JSON.stringify({ pending: false }, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }
}

async function dirHasMeaningfulEntries(dir: string): Promise<boolean> {
  try {
    const entries = await fsp.readdir(dir);
    return entries.some((n) => n && n !== '.write-test');
  } catch {
    return false;
  }
}

async function ensureWritableDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
  const probe = path.join(dir, '.write-test');
  await fsp.writeFile(probe, 'ok');
  await fsp.unlink(probe);
}

async function getWritableAttachmentsRootForRestore(): Promise<string> {
  const stable = path.join(path.dirname(getDbPath()), 'attachments');
  try {
    await ensureWritableDir(stable);
    return stable;
  } catch {
    const userData = path.join(app.getPath('userData'), 'attachments');
    await ensureWritableDir(userData);
    return userData;
  }
}

async function backupAttachmentsBestEffort(destDir: string): Promise<boolean> {
  const stable = path.join(path.dirname(getDbPath()), 'attachments');
  const userData = path.join(app.getPath('userData'), 'attachments');
  const legacyExe = (() => {
    if (!app.isPackaged) return null;
    try {
      return path.join(path.dirname(app.getPath('exe')), 'attachments');
    } catch {
      return null;
    }
  })();

  const sources = [stable, userData, legacyExe].filter(
    (p): p is string => typeof p === 'string' && !!p
  );

  let copiedAny = false;
  for (const src of sources) {
    if (!(await dirHasMeaningfulEntries(src))) continue;
    try {
      await fsp.mkdir(destDir, { recursive: true });
      // Merge-copy without overwriting existing files.
      await fspCp(src, destDir, { recursive: true, force: false });
      copiedAny = true;
    } catch {
      // ignore and continue
    }
  }

  // If we created the folder but copied nothing, treat as not copied.
  if (!copiedAny) {
    try {
      const entries = await fsp.readdir(destDir);
      if (entries.length === 0) return false;
    } catch {
      // ignore
    }
  }

  return copiedAny;
}

async function rmDirBestEffort(dir: string): Promise<void> {
  try {
    const rm = (fsp as unknown as { rm?: (p: string, o: { recursive: boolean; force: boolean }) => Promise<void> }).rm;
    if (rm) {
      await rm(dir, { recursive: true, force: true });
      return;
    }
  } catch {
    // ignore
  }
  // Fallback (older Node): try to remove files shallowly.
  try {
    const entries = await fsp.readdir(dir).catch(() => [] as string[]);
    for (const n of entries) {
      try {
        await fsp.unlink(path.join(dir, n));
      } catch {
        // ignore
      }
    }
    await fsp.rmdir(dir).catch(() => undefined);
  } catch {
    // ignore
  }
}

async function exportAttachmentsArchiveToMany(opts: {
  destPaths: string[];
  encryptionRequested: boolean;
  encryptionConfigured: boolean;
  encryptionPassword: string;
}): Promise<{ copiedAny: boolean; latestPath?: string; archivePath?: string }> {
  const destPaths = Array.isArray(opts.destPaths) ? opts.destPaths.filter(Boolean) : [];
  if (destPaths.length === 0) return { copiedAny: false };

  const tempDir = path.join(app.getPath('temp'), `AZRAR-attachments-export-${Date.now()}`);
  const tmpTar = path.join(app.getPath('temp'), `AZRAR-attachments-export-${Date.now()}.tar.gz`);
  const tmpTarEnc = path.join(app.getPath('temp'), `AZRAR-attachments-export-${Date.now()}.tar.gz.enc`);

  let copiedAny = false;
  try {
    copiedAny = await backupAttachmentsBestEffort(tempDir);
    if (!copiedAny) return { copiedAny: false };

    // Build a tar.gz archive from the merged tempDir.
    await tar.c({ gzip: true, file: tmpTar, cwd: tempDir }, ['.']);

    if (!opts.encryptionRequested) {
      for (const p of destPaths) {
        await fsp.mkdir(path.dirname(p), { recursive: true });
        await fsp.copyFile(tmpTar, p);
      }
    } else {
      if (!opts.encryptionConfigured || !opts.encryptionPassword) {
        throw new Error('تشفير النسخ الاحتياطية مفعل لكن كلمة المرور غير مضبوطة.');
      }
      // Encrypt once to a temp enc file, then copy to destinations.
      await encryptFileToFile({ sourcePath: tmpTar, destPath: tmpTarEnc, password: opts.encryptionPassword });
      for (const p of destPaths) {
        await fsp.mkdir(path.dirname(p), { recursive: true });
        await fsp.copyFile(tmpTarEnc, p);
      }
    }

    return { copiedAny: true };
  } finally {
    try {
      await fsp.unlink(tmpTar);
    } catch {
      // ignore
    }
    try {
      await fsp.unlink(tmpTarEnc);
    } catch {
      // ignore
    }
    await rmDirBestEffort(tempDir);
  }
}

async function restoreAttachmentsFromArchiveBestEffort(opts: {
  archivePath: string;
  password?: string;
}): Promise<{ restored: boolean; skippedBecauseNotEmpty?: boolean; message?: string }> {
  const archivePath = String(opts.archivePath || '');
  if (!archivePath) return { restored: false, message: 'مسار أرشيف المرفقات غير صالح' };

  const attachmentsRoot = await getWritableAttachmentsRootForRestore();
  if (await dirHasMeaningfulEntries(attachmentsRoot)) {
    return { restored: false, skippedBecauseNotEmpty: true, message: 'مجلد المرفقات غير فارغ - تم تخطي الاستعادة لتجنب الكتابة فوق الملفات' };
  }

  await fsp.mkdir(attachmentsRoot, { recursive: true });

  const tmpTar = path.join(app.getPath('temp'), `AZRAR-attachments-restore-${Date.now()}.tar.gz`);
  const looksEncryptedByExt = path.extname(archivePath).toLowerCase() === '.enc';
  const looksEncryptedByMagic = await isEncryptedFile(archivePath);
  const isEnc = looksEncryptedByExt || looksEncryptedByMagic;

  try {
    if (isEnc) {
      const password = String(opts.password || '');
      if (!password) return { restored: false, message: 'لا توجد كلمة مرور لفك تشفير أرشيف المرفقات' };
      await decryptFileToFile({ sourcePath: archivePath, destPath: tmpTar, password });
      await tar.x({ file: tmpTar, cwd: attachmentsRoot, gzip: true });
    } else {
      await tar.x({ file: archivePath, cwd: attachmentsRoot, gzip: true });
    }
    return { restored: true };
  } finally {
    try {
      await fsp.unlink(tmpTar);
    } catch {
      // ignore
    }
  }
}

async function encryptExistingAttachmentsAtRestBestEffort(password: string): Promise<void> {
  const stable = path.join(path.dirname(getDbPath()), 'attachments');
  const userData = path.join(app.getPath('userData'), 'attachments');
  const legacyExe = (() => {
    if (!app.isPackaged) return null;
    try {
      return path.join(path.dirname(app.getPath('exe')), 'attachments');
    } catch {
      return null;
    }
  })();

  const roots = [stable, userData, legacyExe].filter((p): p is string => typeof p === 'string' && !!p);

  const walk = async (dir: string): Promise<void> => {
    let entries: Array<import('node:fs').Dirent> = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      const name = ent.name;
      if (!name || name === '.write-test') continue;
      const abs = path.join(dir, name);
      if (ent.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!ent.isFile()) continue;

      try {
        const st = await fsp.stat(abs);
        if (!st.isFile() || st.size <= 0) continue;

        const alreadyEnc = await isEncryptedFile(abs);
        if (alreadyEnc) continue;

        // Read plaintext then atomically replace with encrypted file.
        const bytes = await fsp.readFile(abs);
        const tmp = `${abs}.azrar-tmpenc-${Date.now()}`;
        await encryptBufferToFile({ bytes, destPath: tmp, password });
        try {
          await fsp.unlink(abs);
        } catch {
          // ignore
        }
        await fsp.rename(tmp, abs);
      } catch {
        // ignore per-file errors
        continue;
      }
    }
  };

  for (const root of roots) {
    try {
      if (!fs.existsSync(root)) continue;
      await walk(root);
    } catch {
      // ignore
    }
  }
}

async function reencryptEncryptedAttachmentsAtRestBestEffort(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  if (!oldPassword || !newPassword || oldPassword === newPassword) return;

  const stable = path.join(path.dirname(getDbPath()), 'attachments');
  const userData = path.join(app.getPath('userData'), 'attachments');
  const legacyExe = (() => {
    if (!app.isPackaged) return null;
    try {
      return path.join(path.dirname(app.getPath('exe')), 'attachments');
    } catch {
      return null;
    }
  })();

  const roots = [stable, userData, legacyExe].filter((p): p is string => typeof p === 'string' && !!p);

  const walk = async (dir: string): Promise<void> => {
    let entries: Array<import('node:fs').Dirent> = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      const name = ent.name;
      if (!name || name === '.write-test') continue;
      const abs = path.join(dir, name);
      if (ent.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!ent.isFile()) continue;

      try {
        const st = await fsp.stat(abs);
        if (!st.isFile() || st.size <= 0) continue;

        const alreadyEnc = await isEncryptedFile(abs);
        if (!alreadyEnc) continue;

        // Decrypt with old password to memory, then re-encrypt with new password.
        const bytes = await decryptFileToBuffer({ sourcePath: abs, password: oldPassword, maxBytes: MAX_ATTACHMENT_BYTES });
        const tmp = `${abs}.azrar-tmpreenc-${Date.now()}`;
        await encryptBufferToFile({ bytes, destPath: tmp, password: newPassword });
        try {
          await fsp.unlink(abs);
        } catch {
          // ignore
        }
        await fsp.rename(tmp, abs);
      } catch {
        // ignore per-file errors
        continue;
      }
    }
  };

  for (const root of roots) {
    try {
      if (!fs.existsSync(root)) continue;
      await walk(root);
    } catch {
      // ignore
    }
  }
}

async function createMandatoryPreUpdateBackup(reason: 'install' | 'installFromFile') {
  const createdAt = new Date().toISOString();
  const fromVersion = app.getVersion();

  const backupRoot = path.join(app.getPath('userData'), 'mandatory-backups');
  await fsp.mkdir(backupRoot, { recursive: true });

  const safeStamp = createdAt.replace(/[:.]/g, '-');
  const dbBackupPath = path.join(backupRoot, `preupdate-${fromVersion}-${safeStamp}.sqlite`);

  // DB copy (authoritative)
  await exportDatabaseToMany([dbBackupPath]);

  // Attachments best-effort copy (if any)
  const attachmentsBackupPath = path.join(
    backupRoot,
    `preupdate-${fromVersion}-${safeStamp}-attachments`
  );
  let attachmentsCopied = false;
  try {
    attachmentsCopied = await backupAttachmentsBestEffort(attachmentsBackupPath);
  } catch {
    attachmentsCopied = false;
  }

  const pendingInfo: PendingRestoreInfo = {
    pending: true,
    createdAt,
    fromVersion,
    dbBackupPath,
    attachmentsBackupPath: attachmentsCopied ? attachmentsBackupPath : undefined,
    reason,
  };

  await writePendingRestoreInfo(pendingInfo);
  return pendingInfo;
}

async function restoreFromPendingBackup(): Promise<{ success: boolean; message?: string }> {
  if (restoreInProgress)
    return { success: false, message: 'عملية الاسترجاع قيد التنفيذ. يرجى الانتظار.' };

  const info = await readPendingRestoreInfo();
  if (!info.pending) return { success: false, message: 'لا توجد عملية استرجاع معلّقة.' };

  if (!info.dbBackupPath || !fs.existsSync(info.dbBackupPath)) {
    return { success: false, message: 'ملف النسخة الاحتياطية غير موجود.' };
  }

  restoreInProgress = true;
  dbMaintenanceMode = true;

  // Clear the pending marker BEFORE doing any work to avoid boot loops if the app
  // reloads/crashes mid-restore. We'll re-arm it on failure.
  await clearPendingRestoreInfo();

  try {
    // Restore DB
    await importDatabase(info.dbBackupPath);

    // Restore attachments best-effort
    if (info.attachmentsBackupPath && fs.existsSync(info.attachmentsBackupPath)) {
      const attachmentsRoot = await getWritableAttachmentsRootForRestore();
      const currentBackup = `${attachmentsRoot}.backup-${Date.now()}`;
      try {
        if (fs.existsSync(attachmentsRoot)) {
          await fspCp(attachmentsRoot, currentBackup, { recursive: true, force: true });
        }
      } catch {
        // ignore
      }
      await fsp.mkdir(path.dirname(attachmentsRoot), { recursive: true });
      await fspCp(info.attachmentsBackupPath, attachmentsRoot, { recursive: true, force: true });
    }

    return { success: true };
  } catch (e: unknown) {
    const msg = toErrorMessage(e, 'فشل استرجاع النسخة الاحتياطية');
    // Re-arm pending restore so the user can retry later, but without a reload loop.
    try {
      await writePendingRestoreInfo({
        ...info,
        pending: true,
        attempts: (info.attempts || 0) + 1,
        lastError: msg,
      });
    } catch {
      // ignore
    }
    return { success: false, message: msg };
  } finally {
    dbMaintenanceMode = false;
    restoreInProgress = false;
  }
}

export function registerIpcHandlers() {
  // =====================
  // Auto Update
  // =====================

  configureUpdaterIfPossible();

  if (autoUpdater) {
    autoUpdater.on('checking-for-update', () => broadcastUpdaterEvent({ type: 'checking' }));
    autoUpdater.on('update-available', (info: UpdateInfo) =>
      broadcastUpdaterEvent({ type: 'available', data: info })
    );
    autoUpdater.on('update-not-available', (info: UpdateInfo) =>
      broadcastUpdaterEvent({ type: 'not-available', data: info })
    );
    autoUpdater.on('download-progress', (progress: ProgressInfo) =>
      broadcastUpdaterEvent({ type: 'progress', data: progress })
    );
    autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) =>
      broadcastUpdaterEvent({ type: 'downloaded', data: info })
    );
    autoUpdater.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      broadcastUpdaterEvent({ type: 'error', message });
    });
  }

  // Automatic update check on startup (packaged app only).
  if (app.isPackaged && autoUpdater && (currentFeedUrl || hasEmbeddedUpdaterConfig())) {
    setTimeout(() => {
      void (async () => {
        try {
          await autoUpdater.checkForUpdates();
        } catch (e: unknown) {
          broadcastUpdaterEvent({
            type: 'error',
            message: toErrorMessage(e, 'فشل التحقق من التحديثات تلقائياً'),
          });
        }
      })();
    }, 3000);
  }

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

  // =====================
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
        return { ok: true, enabled: false, reason: (st as { reason?: string }).reason || 'not_activated' };
      }

      const enabled = isFeatureEnabled((st as { license?: { features?: unknown } }).license?.features, name);
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
    const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
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

  // =====================
  // License Admin (Desktop)
  // =====================

  const ADMIN_TOKEN_KEY = 'lic_admin_server_token_v1';
  type StoredAdminTokensV2 = {
    v: 2;
    defaultToken?: string;
    byOrigin: Record<string, string>;
    updatedAt: string;
  };

  const readStoredAdminTokensUnsafe = (): StoredAdminTokensV2 | null => {
    try {
      const raw = String(kvGet(ADMIN_TOKEN_KEY) ?? '').trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredAdminTokensV2;
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.v !== 2) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const envDefaultToken = String(
    process.env.AZRAR_LICENSE_SERVER_ADMIN_TOKEN || process.env.AZRAR_LICENSE_ADMIN_TOKEN || ''
  ).trim();

  let storedAdminTokens: StoredAdminTokensV2 = {
    v: 2,
    defaultToken: envDefaultToken || undefined,
    byOrigin: {},
    updatedAt: new Date().toISOString(),
  };

  try {
    const v2 = readStoredAdminTokensUnsafe();
    if (v2) {
      storedAdminTokens = {
        v: 2,
        defaultToken: typeof v2.defaultToken === 'string' ? v2.defaultToken : envDefaultToken || undefined,
        byOrigin: v2.byOrigin && typeof v2.byOrigin === 'object' ? v2.byOrigin : {},
        updatedAt: typeof v2.updatedAt === 'string' ? v2.updatedAt : storedAdminTokens.updatedAt,
      };
    } else if (!envDefaultToken) {
      const legacy = String(kvGet(ADMIN_TOKEN_KEY) ?? '').trim();
      if (legacy) storedAdminTokens.defaultToken = legacy;
    }
  } catch {
    // ignore
  }

  const persistStoredAdminTokensBestEffort = (): void => {
    try {
      kvSet(ADMIN_TOKEN_KEY, JSON.stringify(storedAdminTokens));
    } catch {
      // ignore
    }
  };

  const getAdminTokenForOrigin = (origin: string): string => {
    const byOrigin = storedAdminTokens.byOrigin || {};
    if (origin && typeof byOrigin[origin] === 'string' && String(byOrigin[origin] || '').trim()) {
      return String(byOrigin[origin]).trim();
    }
    return String(storedAdminTokens.defaultToken || '').trim();
  };

  const setAdminTokenForOrigin = (origin: string, token: string): void => {
    const t = String(token || '').trim();
    if (!t) return;
    if (origin) {
      storedAdminTokens.byOrigin = storedAdminTokens.byOrigin || {};
      storedAdminTokens.byOrigin[origin] = t;
    } else {
      storedAdminTokens.defaultToken = t;
    }
    storedAdminTokens.updatedAt = new Date().toISOString();
    persistStoredAdminTokensBestEffort();
  };

  let adminSessionOk = false;

  const ADMIN_AUTH_KEY = 'lic_admin_auth_v1';
  const DEFAULT_ADMIN_USERNAME = 'admin';
  // SECURITY: Generate a cryptographically random password for first-time setup.
  // This replaces the hardcoded password to prevent credential exposure.
  // Admin must set credentials via environment variables or change after first login.
  const generateSecureDefaultPassword = (): string => {
    return crypto.randomBytes(24).toString('base64').replace(/[/+=]/g, '');
  };
  let generatedDefaultPassword: string | null = null;
  const getDefaultAdminPassword = (): string => {
    if (!generatedDefaultPassword) {
      generatedDefaultPassword = generateSecureDefaultPassword();
    }
    return generatedDefaultPassword;
  };
  const normalizeUser = (u: unknown) => String(u ?? '').trim().slice(0, 64);
  const normalizePass = (p: unknown) => String(p ?? '').trim().slice(0, 128);

  const hashPassword = (password: string, salt: Buffer, iterations: number): Buffer => {
    return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  };

  const createAuth = (username: string, password: string) => {
    const iterations = 180_000;
    const salt = crypto.randomBytes(16);
    const hash = hashPassword(password, salt, iterations);
    return {
      v: 1,
      username,
      saltB64: salt.toString('base64'),
      iterations,
      hashB64: hash.toString('base64'),
      updatedAt: new Date().toISOString(),
    };
  };

  const readAuthUnsafe = (): null | {
    v: 1;
    username: string;
    saltB64: string;
    iterations: number;
    hashB64: string;
    updatedAt?: string;
  } => {
    try {
      const raw = String(kvGet(ADMIN_AUTH_KEY) ?? '').trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.v !== 1) return null;
      if (!parsed.username || !parsed.saltB64 || !parsed.hashB64) return null;
      if (!Number.isFinite(Number(parsed.iterations))) return null;
      return parsed as never;
    } catch {
      return null;
    }
  };

  const ensureAuth = () => {
    const existing = readAuthUnsafe();
    if (existing) return existing;

    const envUser = normalizeUser(process.env.AZRAR_LICENSE_ADMIN_UI_USERNAME || process.env.AZRAR_ADMIN_USERNAME);
    const envPass = normalizePass(process.env.AZRAR_LICENSE_ADMIN_UI_PASSWORD || process.env.AZRAR_ADMIN_PASSWORD);
    const username = envUser || DEFAULT_ADMIN_USERNAME;
    const password = envPass || getDefaultAdminPassword();
    const created = createAuth(username, password);
    try {
      kvSet(ADMIN_AUTH_KEY, JSON.stringify(created));
    } catch {
      // ignore
    }
    return created;
  };

  const verifyLogin = (username: string, password: string): boolean => {
    try {
      const auth = ensureAuth();
      if (normalizeUser(username).toLowerCase() !== String(auth.username).trim().toLowerCase()) return false;
      const salt = Buffer.from(String(auth.saltB64), 'base64');
      const iterations = Number(auth.iterations);
      const expected = Buffer.from(String(auth.hashB64), 'base64');
      const actual = hashPassword(password, salt, iterations);
      if (expected.length !== actual.length) return false;
      return crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  };

  const requireAdminSession = (): { ok: true } | { ok: false; error: string } => {
    if (!adminSessionOk) return { ok: false, error: 'Unauthorized' };
    return { ok: true };
  };

  const normalizeServerUrl = (raw: unknown): string => {
    const s = String(raw || '').trim();
    if (!s) return '';
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.origin;
    } catch {
      return '';
    }
  };

  const postJson = async (serverUrl: string, pathname: string, body: unknown): Promise<unknown> => {
    const adminToken = getAdminTokenForOrigin(serverUrl);
    if (!adminToken) throw new Error('Admin token not configured.');

    const resp = await fetch(`${serverUrl}${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
      },
      body: JSON.stringify(body ?? null),
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok) {
      const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
      const msg = String(rec?.error || `HTTP ${resp.status}`).trim();
      throw new Error(msg || 'Request failed');
    }
    return json;
  };

  ipcMain.handle('licenseAdmin:login', async (_e, payload: unknown) => {
    try {
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const user = normalizeUser(p.username);
      const pass = normalizePass(p.password);
      if (!user) return { ok: false, error: 'Username is required.' };
      if (!pass) return { ok: false, error: 'Password is required.' };
      if (!verifyLogin(user, pass)) return { ok: false, error: 'Invalid credentials.' };
      adminSessionOk = true;
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to login') };
    }
  });

  ipcMain.handle('licenseAdmin:logout', async () => {
    adminSessionOk = false;
    return { ok: true };
  });

  ipcMain.handle('licenseAdmin:getAdminTokenStatus', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const origin = normalizeServerUrl(p.serverUrl);
      const configured = !!getAdminTokenForOrigin(origin);
      return { ok: true, configured };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to get token status') };
    }
  });

  ipcMain.handle('licenseAdmin:setAdminToken', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const token = String(p.token ?? '').trim();
      if (!token) return { ok: false, error: 'token is required.' };
      const origin = normalizeServerUrl(p.serverUrl);
      setAdminTokenForOrigin(origin, token);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to set token') };
    }
  });

  ipcMain.handle('licenseAdmin:getUser', async () => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const a = ensureAuth();
      return { ok: true, user: { username: a.username, updatedAt: a.updatedAt } };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to load user') };
    }
  });

  ipcMain.handle('licenseAdmin:updateUser', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const nextUser = normalizeUser(p.username);
      const nextPass = normalizePass(p.newPassword);
      if (!nextUser) return { ok: false, error: 'username is required.' };
      const current = ensureAuth();
      const updated = createAuth(nextUser, nextPass || getDefaultAdminPassword());
      if (!nextPass) {
        (updated as Record<string, unknown>).saltB64 = (current as Record<string, unknown>).saltB64;
        (updated as Record<string, unknown>).iterations = (current as Record<string, unknown>).iterations;
        (updated as Record<string, unknown>).hashB64 = (current as Record<string, unknown>).hashB64;
      }
      kvSet(ADMIN_AUTH_KEY, JSON.stringify(updated));
      return { ok: true, user: { username: updated.username, updatedAt: updated.updatedAt } };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to update user') };
    }
  });

  ipcMain.handle('licenseAdmin:list', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const q = typeof p.q === 'string' ? p.q : '';
      const limit = Number.isFinite(Number(p.limit)) ? Number(p.limit) : undefined;
      const json = await postJson(serverUrl, '/api/license/admin/list', { q, limit });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to list licenses') };
    }
  });

  ipcMain.handle('licenseAdmin:get', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      const json = await postJson(serverUrl, '/api/license/admin/get', { licenseKey });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to fetch license') };
    }
  });

  ipcMain.handle('licenseAdmin:issue', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const body: Record<string, unknown> = {
        ...(p.licenseKey ? { licenseKey: String(p.licenseKey) } : {}),
        ...(p.expiresAt ? { expiresAt: String(p.expiresAt) } : {}),
        ...(Number.isFinite(Number(p.maxActivations)) ? { maxActivations: Number(p.maxActivations) } : {}),
        ...(p.features && typeof p.features === 'object' ? { features: p.features } : {}),
      };
      const json = await postJson(serverUrl, '/api/license/admin/issue', body);
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to issue license') };
    }
  });

  ipcMain.handle('licenseAdmin:setStatus', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      const status = String(p.status || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      if (!status) return { ok: false, error: 'status is required.' };
      const json = await postJson(serverUrl, '/api/license/admin/setStatus', {
        licenseKey,
        status,
        ...(p.note ? { note: String(p.note) } : {}),
      });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to set status') };
    }
  });

  ipcMain.handle('licenseAdmin:activate', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      const deviceId = String(p.deviceId || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      if (!deviceId) return { ok: false, error: 'deviceId is required.' };

      const resp = await fetch(`${serverUrl}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, deviceId }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
        const msg = String(rec?.error || `HTTP ${resp.status}`).trim();
        return { ok: false, error: msg || 'Activate failed' };
      }
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to activate') };
    }
  });

  ipcMain.handle('licenseAdmin:checkStatus', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      const deviceId = String(p.deviceId || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      if (!deviceId) return { ok: false, error: 'deviceId is required.' };

      const resp = await fetch(`${serverUrl}/api/license/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, deviceId }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
        const msg = String(rec?.error || `HTTP ${resp.status}`).trim();
        return { ok: false, error: msg || 'Status check failed' };
      }
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to check status') };
    }
  });

  ipcMain.handle('licenseAdmin:saveLicenseFile', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const confirmPassword = String(p.confirmPassword || '').trim();
      if (!confirmPassword) return { ok: false, error: 'confirmPassword is required.' };
      const a = ensureAuth();
      if (!verifyLogin(a.username, confirmPassword)) return { ok: false, error: 'Invalid password.' };
      const content = String(p.content || '');
      if (!content.trim()) return { ok: false, error: 'content is required.' };
      const safeName = String(p.defaultFileName || 'azrar-license.json')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 120);
      const defaultPath = path.join(app.getPath('documents'), safeName || 'azrar-license.json');
      const result = await dialog.showSaveDialog({
        title: 'حفظ ملف الترخيص',
        defaultPath,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, error: 'Canceled' };
      await fsp.writeFile(result.filePath, content, 'utf8');
      return { ok: true, filePath: result.filePath };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to save file') };
    }
  });

  ipcMain.handle('licenseAdmin:updateAfterSales', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      const patch = p.patch && typeof p.patch === 'object' ? p.patch : {};
      const json = await postJson(serverUrl, '/api/license/admin/updateAfterSales', { licenseKey, patch });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to update after-sales') };
    }
  });

  ipcMain.handle('licenseAdmin:unbindDevice', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      const deviceId = String(p.deviceId || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      if (!deviceId) return { ok: false, error: 'deviceId is required.' };
      const json = await postJson(serverUrl, '/api/license/admin/unbindDevice', { licenseKey, deviceId });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to unbind device') };
    }
  });

  ipcMain.handle('licenseAdmin:delete', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      const json = await postJson(serverUrl, '/api/license/admin/delete', { licenseKey });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to delete license') };
    }
  });

  ipcMain.handle('updater:getVersion', () => app.getVersion());
  ipcMain.handle('updater:getStatus', () => ({
    isPackaged: app.isPackaged,
    feedUrl: currentFeedUrl,
    lastEvent: lastUpdaterEvent,
  }));

  ipcMain.handle('auth:session:set', async (e, payload: unknown) => {
    const senderId = e.sender?.id;
    if (!senderId || !Number.isFinite(senderId)) return { ok: false, message: 'Invalid sender' };

    const rawUserId = isRecord(payload) ? payload.userId : undefined;
    const userId = String(rawUserId ?? '').trim();

    if (!userId) {
      sessionUserByWebContentsId.delete(senderId);
      return { ok: true };
    }

    const user = getDesktopUserById(userId);
    if (!user) {
      sessionUserByWebContentsId.delete(senderId);
      return { ok: false, message: 'User not recognized' };
    }

    sessionUserByWebContentsId.set(senderId, userId);
    return { ok: true };
  });

  ipcMain.handle('updater:setFeedUrl', async (_e, url: string) => {
    try {
      const normalized = normalizeFeedUrl(url);
      currentFeedUrl = normalized;

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

  ipcMain.handle('updater:check', async () => {
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
      const available = !!res?.updateInfo;
      return { success: true, updateAvailable: available, info: res?.updateInfo };
    } catch (e: unknown) {
      if (!currentFeedUrl && !hasEmbeddedUpdaterConfig()) {
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
    if (!autoUpdater) {
      return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e: unknown) {
      if (!currentFeedUrl && !hasEmbeddedUpdaterConfig()) {
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

  ipcMain.handle('updater:installFromFile', async () => {
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

    const v = validateInstallerCandidate(resolved, st, MAX_INSTALLER_BYTES);
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
  ipcMain.handle('updater:getPendingRestore', async () => {
    return readPendingRestoreInfo();
  });
  ipcMain.handle('updater:clearPendingRestore', async () => {
    await clearPendingRestoreInfo();
    return { success: true };
  });
  ipcMain.handle('updater:restorePending', async () => {
    return restoreFromPendingBackup();
  });

  ipcMain.handle('db:get', (_e, key: string) => {
    if (dbMaintenanceMode) return null;
    const k = String(key || '').trim();
    if (!k.startsWith('db_')) return null;
    try {
      return kvGet(k);
    } catch (e: unknown) {
      const hint = getBetterSqlite3RebuildHint(e);
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
      const hint = getBetterSqlite3RebuildHint(e);
      const base = toErrorMessage(e, 'فشل حفظ بيانات محلية (db:set)');
      throw new Error(hint ? `${base}\n\n${hint}` : base);
    }
    try {
      const meta = kvGetMeta(k);
      const updatedAt = meta?.updatedAt || new Date().toISOString();
      void pushKvUpsert({ key: k, value, updatedAt }).catch(() => void 0);
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
      const hint = getBetterSqlite3RebuildHint(e);
      const base = toErrorMessage(e, 'فشل حذف بيانات محلية (db:delete)');
      throw new Error(hint ? `${base}\n\n${hint}` : base);
    }
    try {
      const deletedAt = kvGetDeletedAt(k) || new Date().toISOString();
      void pushKvDelete({ key: k, deletedAt }).catch(() => void 0);
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
      const hint = getBetterSqlite3RebuildHint(e);
      const base = toErrorMessage(e, 'فشل قراءة مفاتيح البيانات (db:keys)');
      throw new Error(hint ? `${base}\n\n${hint}` : base);
    }
  });
  ipcMain.handle('db:resetAll', () => {
    if (dbMaintenanceMode) return { deleted: 0 };
    return kvResetAll('db_');
  });

  // Domain tables (SQLite) + SQL-backed reports (Desktop)
  ipcMain.handle('domain:status', () => {
    try {
      return { ok: true, ...domainStatus() };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'تعذر قراءة حالة الجداول') };
    }
  });

  ipcMain.handle('domain:migrate', () => {
    try {
      return domainMigrateFromKvIfNeeded();
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل الترحيل') };
    }
  });

  ipcMain.handle('reports:run', (_e, payload: unknown) => {
    try {
      const id = getStringField(payload, 'id').trim();
      if (!id) return { ok: false, message: 'معرّف التقرير غير صالح' };
      return runSqlReport(id);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل توليد التقرير') };
    }
  });

  ipcMain.handle('domain:searchGlobal', (_e, payload: unknown) => {
    try {
      const q = trimString(getStringField(payload, 'query'), 128, 'نص البحث');
      return domainSearchGlobal(q);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل البحث') };
    }
  });

  ipcMain.handle('domain:search', (_e, payload: unknown) => {
    try {
      const entityRaw = getStringField(payload, 'entity').trim();
      const entity: DomainEntity | null = isDomainEntity(entityRaw) ? entityRaw : null;
      if (!entity) return { ok: false, message: 'نوع البحث غير مدعوم' };

      const q = trimString(getStringField(payload, 'query'), 128, 'نص البحث');
      const limit = getOptionalNumberField(payload, 'limit');
      return domainSearch(entity, q, limit);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل البحث') };
    }
  });

  ipcMain.handle('domain:get', (_e, payload: unknown) => {
    try {
      const entityRaw = getStringField(payload, 'entity').trim();
      const entity: DomainEntity | null = isDomainEntity(entityRaw) ? entityRaw : null;
      if (!entity) return { ok: false, message: 'نوع غير مدعوم' };
      const id = trimString(getStringField(payload, 'id'), 128, 'المعرف');
      return domainGetEntityById(entity, id);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل قراءة البيانات') };
    }
  });

  ipcMain.handle('domain:counts', () => {
    try {
      return domainCounts();
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل قراءة الأعداد') };
    }
  });

  ipcMain.handle('domain:dashboard:summary', (_e, payload: unknown) => {
    try {
      const todayYMD = trimString(getStringField(payload, 'todayYMD'), 10, 'تاريخ اليوم');
      const weekYMD = trimString(getStringField(payload, 'weekYMD'), 10, 'تاريخ الأسبوع');
      return domainDashboardSummary({ todayYMD, weekYMD });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل ملخص لوحة التحكم') };
    }
  });

  ipcMain.handle('domain:dashboard:performance', (_e, payload: unknown) => {
    try {
      const monthKey = trimString(getStringField(payload, 'monthKey'), 7, 'شهر');
      const prevMonthKey = trimString(getStringField(payload, 'prevMonthKey'), 7, 'شهر سابق');
      return domainDashboardPerformance({ monthKey, prevMonthKey });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل الأداء المالي') };
    }
  });

  ipcMain.handle('domain:dashboard:highlights', (_e, payload: unknown) => {
    try {
      const todayYMD = trimString(getStringField(payload, 'todayYMD'), 10, 'تاريخ اليوم');
      return domainDashboardHighlights({ todayYMD });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل مؤشرات لوحة التحكم') };
    }
  });

  ipcMain.handle('domain:notifications:paymentTargets', (_e, payload: unknown) => {
    try {
      const daysAhead = Math.max(
        1,
        Math.min(60, Math.trunc(Number(getField(payload, 'daysAhead')) || 7))
      );
      const todayYmdRaw = getStringField(payload, 'todayYMD');
      const todayYMD = todayYmdRaw ? trimString(todayYmdRaw, 10, 'تاريخ اليوم') : undefined;
      return domainPaymentNotificationTargets({ daysAhead, todayYMD });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل إشعارات الدفعات') };
    }
  });

  ipcMain.handle('domain:person:details', (_e, payload: unknown) => {
    try {
      const personId = String(getField(payload, 'personId') ?? payload ?? '').trim();
      if (!personId) return { ok: false, message: 'معرف غير صالح' };
      return domainPersonDetails(personId);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل قراءة بيانات الشخص') };
    }
  });

  ipcMain.handle('domain:person:tenancyContracts', (_e, payload: unknown) => {
    try {
      const personId = String(getField(payload, 'personId') ?? payload ?? '').trim();
      if (!personId) return { ok: false, message: 'معرف غير صالح' };
      return domainPersonTenancyContracts(personId);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل جلب عقود الشخص') };
    }
  });

  ipcMain.handle('domain:property:contracts', (_e, payload: unknown) => {
    try {
      const propertyId = String(getField(payload, 'propertyId') ?? payload ?? '').trim();
      if (!propertyId) return { ok: false, message: 'معرف غير صالح' };
      const limit = getOptionalNumberField(payload, 'limit');
      return domainPropertyContracts(propertyId, limit);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل قراءة عقود العقار') };
    }
  });

  ipcMain.handle('domain:contract:details', (_e, payload: unknown) => {
    try {
      const contractId = String(getField(payload, 'contractId') ?? payload ?? '').trim();
      if (!contractId) return { ok: false, message: 'معرف غير صالح' };
      return domainContractDetails(contractId);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل تفاصيل العقد') };
    }
  });

  // Fast-mode helpers for legacy arrays (read-only / targeted scans)
  ipcMain.handle('domain:ownership:history', (_e, payload: unknown) => {
    try {
      const propertyId = String(getField(payload, 'propertyId') ?? '').trim();
      const personId = String(getField(payload, 'personId') ?? '').trim();

      const all = kvGetArray(DB_KEYS.OWNERSHIP_HISTORY);
      const items = all.filter((row) => {
        const rec = isRecord(row) ? row : null;
        if (!rec) return false;
        if (propertyId) return String(rec['رقم_العقار'] ?? '').trim() === propertyId;
        if (personId) {
          const oldId = String(rec['رقم_المالك_القديم'] ?? '').trim();
          const newId = String(rec['رقم_المالك_الجديد'] ?? '').trim();
          return oldId === personId || newId === personId;
        }
        return true;
      });

      return { ok: true, items };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل سجل الملكية') };
    }
  });

  ipcMain.handle('domain:property:inspections', (_e, payload: unknown) => {
    try {
      const propertyId = String(getField(payload, 'propertyId') ?? payload ?? '').trim();
      if (!propertyId) return { ok: false, message: 'معرف غير صالح' };
      const all = kvGetArray(DB_KEYS.INSPECTIONS);
      const items = all
        .filter((row) => {
          const rec = isRecord(row) ? row : null;
          if (!rec) return false;
          return String(rec['propertyId'] ?? '').trim() === propertyId;
        })
        .slice()
        .sort((a, b) => {
          const aa = isRecord(a) ? String(a['inspectionDate'] ?? '').trim() : '';
          const bb = isRecord(b) ? String(b['inspectionDate'] ?? '').trim() : '';
          return bb.localeCompare(aa);
        });
      return { ok: true, items };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل الكشوفات') };
    }
  });

  ipcMain.handle('domain:sales:person', (_e, payload: unknown) => {
    try {
      const personId = String(getField(payload, 'personId') ?? payload ?? '').trim();
      if (!personId) return { ok: false, message: 'معرف غير صالح' };

      const listings = kvGetArray(DB_KEYS.SALES_LISTINGS);
      const agreements = kvGetArray(DB_KEYS.SALES_AGREEMENTS);

      const listingsById = new Map<string, unknown>();
      for (const l of listings) {
        if (!isRecord(l)) continue;
        const id = String(l['id'] ?? '').trim();
        if (!id) continue;
        listingsById.set(id, l);
      }

      const listingsForOwner = listings.filter(
        (l) => isRecord(l) && String(l['رقم_المالك'] ?? '').trim() === personId
      );

      const agreementsForPerson = agreements.filter((a) => {
        const rec = isRecord(a) ? a : null;
        if (!rec) return false;
        const buyer = String(rec['رقم_المشتري'] ?? '').trim();
        if (buyer === personId) return true;
        const seller = String(rec['رقم_البائع'] ?? '').trim();
        if (seller === personId) return true;
        const listingId = String(rec['listingId'] ?? '').trim();
        const l = listingId ? listingsById.get(listingId) : undefined;
        if (isRecord(l)) {
          const owner = String(l['رقم_المالك'] ?? '').trim();
          if (owner === personId) return true;
        }
        return false;
      });

      return { ok: true, listings: listingsForOwner, agreements: agreementsForPerson };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل بيانات البيع') };
    }
  });

  ipcMain.handle('domain:sales:property', (_e, payload: unknown) => {
    try {
      const propertyId = String(getField(payload, 'propertyId') ?? payload ?? '').trim();
      if (!propertyId) return { ok: false, message: 'معرف غير صالح' };

      const listings = kvGetArray(DB_KEYS.SALES_LISTINGS);
      const agreements = kvGetArray(DB_KEYS.SALES_AGREEMENTS);

      const listingsById = new Map<string, unknown>();
      for (const l of listings) {
        if (!isRecord(l)) continue;
        const id = String(l['id'] ?? '').trim();
        if (!id) continue;
        listingsById.set(id, l);
      }

      const listingsForProperty = listings
        .filter((l) => isRecord(l) && String(l['رقم_العقار'] ?? '').trim() === propertyId)
        .slice()
        .sort((a, b) => {
          const aa = isRecord(a) ? String(a['تاريخ_العرض'] ?? '').trim() : '';
          const bb = isRecord(b) ? String(b['تاريخ_العرض'] ?? '').trim() : '';
          return bb.localeCompare(aa);
        });

      const agreementsForProperty = agreements
        .map((a) => {
          const rec = isRecord(a) ? a : null;
          if (!rec) return null;
          const listingId = String(rec['listingId'] ?? '').trim();
          const listing = listingId ? listingsById.get(listingId) : undefined;
          const propId = String(
            rec['رقم_العقار'] ?? (isRecord(listing) ? listing['رقم_العقار'] : '') ?? ''
          ).trim();
          if (propId !== propertyId) return null;
          const sellerId = String(
            rec['رقم_البائع'] ?? (isRecord(listing) ? listing['رقم_المالك'] : '') ?? ''
          ).trim();
          return { a, propId, sellerId, listing };
        })
        .filter((x) => x !== null);

      return { ok: true, listings: listingsForProperty, agreements: agreementsForProperty };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل اتفاقيات البيع') };
    }
  });

  // Mutations for details panels
  ipcMain.handle('domain:blacklist:remove', (_e, payload: unknown) => {
    try {
      const id = String(getField(payload, 'id') ?? payload ?? '').trim();
      if (!id) return { ok: false, message: 'معرف غير صالح' };
      const all = kvGetArray(DB_KEYS.BLACKLIST);
      let changed = false;

      const next = all.map((row) => {
        if (!isRecord(row)) return row;
        if (id.startsWith('BL-')) {
          if (String(row['id'] ?? '').trim() !== id) return row;
        } else {
          const pid = String(row['personId'] ?? '').trim();
          const active = Boolean(row['isActive']);
          if (pid !== id || !active) return row;
        }
        changed = true;
        return { ...row, isActive: false };
      });

      if (changed) kvSetArray(DB_KEYS.BLACKLIST, next);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل رفع الحظر') };
    }
  });

  ipcMain.handle('domain:people:delete', (_e, payload: unknown) => {
    try {
      const personId = String(getField(payload, 'personId') ?? payload ?? '').trim();
      if (!personId) return { ok: false, message: 'معرف غير صالح' };

      const props = kvGetArray(DB_KEYS.PROPERTIES);
      const hasOwnedProps = props.some(
        (p) => isRecord(p) && String(p['رقم_المالك'] ?? '').trim() === personId
      );
      if (hasOwnedProps) return { ok: false, message: 'لا يمكن حذف المالك لوجود عقارات مرتبطة به' };

      const contracts = kvGetArray(DB_KEYS.CONTRACTS);
      const hasContracts = contracts.some(
        (c) => isRecord(c) && String(c['رقم_المستاجر'] ?? '').trim() === personId
      );
      if (hasContracts) return { ok: false, message: 'لا يمكن حذف الشخص لوجود عقود مرتبطة به' };

      const people = kvGetArray(DB_KEYS.PEOPLE);
      const nextPeople = people.filter(
        (p) => !(isRecord(p) && String(p['رقم_الشخص'] ?? '').trim() === personId)
      );
      kvSetArray(DB_KEYS.PEOPLE, nextPeople);

      const roles = kvGetArray(DB_KEYS.ROLES);
      const nextRoles = roles.filter(
        (r) => !(isRecord(r) && String(r['رقم_الشخص'] ?? '').trim() === personId)
      );
      kvSetArray(DB_KEYS.ROLES, nextRoles);

      // Best-effort: deactivate any active blacklist records for the person.
      const bl = kvGetArray(DB_KEYS.BLACKLIST);
      const nextBl = bl.map((row) => {
        if (!isRecord(row)) return row;
        if (String(row['personId'] ?? '').trim() !== personId) return row;
        if (!row['isActive']) return row;
        return { ...row, isActive: false };
      });
      kvSetArray(DB_KEYS.BLACKLIST, nextBl);

      return { ok: true, message: 'تم حذف الشخص' };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل حذف الشخص') };
    }
  });

  ipcMain.handle('domain:property:update', (_e, payload: unknown) => {
    try {
      const propertyId = String(getField(payload, 'propertyId') ?? payload ?? '').trim();
      if (!propertyId) return { ok: false, message: 'معرف غير صالح' };
      const patchRaw = getField(payload, 'patch');
      const patch = isRecord(patchRaw) ? patchRaw : {};

      const all = kvGetArray(DB_KEYS.PROPERTIES);
      let updated: unknown = null;
      const next = all.map((row) => {
        if (!isRecord(row)) return row;
        if (String(row['رقم_العقار'] ?? '').trim() !== propertyId) return row;

        const patch2: Record<string, unknown> = { ...patch };
        if (typeof patch2['حالة_العقار'] === 'string' && patch2['IsRented'] === undefined) {
          patch2['IsRented'] = String(patch2['حالة_العقار']) === 'مؤجر';
        }

        const merged = mergeRecords(row, patch2);
        updated = merged;
        return merged;
      });

      if (!updated) return { ok: false, message: 'العقار غير موجود' };
      kvSetArray(DB_KEYS.PROPERTIES, next);
      return { ok: true, data: updated };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحديث العقار') };
    }
  });

  ipcMain.handle('domain:followups:add', (_e, payload: unknown) => {
    try {
      const taskRaw = getField(payload, 'task');
      if (!isRecord(taskRaw)) return { ok: false, message: 'بيانات غير صالحة' };
      const task = taskRaw;

      const id = `FUP-${Date.now()}`;
      const nowIso = new Date().toISOString();

      // Link general tasks to reminders for unified notifications/alerts (best-effort).
      let reminderId = String(task['reminderId'] ?? '').trim();
      const type = String(task['type'] ?? '').trim();
      const dueDate = String(task['dueDate'] ?? '').trim();
      const title = String(task['task'] ?? '').trim();

      if (!reminderId && type === 'Task' && dueDate && title) {
        const reminders = kvGetArray(DB_KEYS.REMINDERS);
        reminderId = `REM-${Date.now()}`;
        const nextReminders = [
          ...reminders,
          { ...task, id: reminderId, title, date: dueDate, isDone: false },
        ];
        kvSetArray(DB_KEYS.REMINDERS, nextReminders);
      }

      const followups = kvGetArray(DB_KEYS.FOLLOW_UPS);
      const nextFollowups = [
        ...followups,
        {
          ...task,
          id,
          status: 'Pending',
          reminderId: reminderId || undefined,
          createdAt: String(task['createdAt'] ?? nowIso),
          updatedAt: nowIso,
        },
      ];
      kvSetArray(DB_KEYS.FOLLOW_UPS, nextFollowups);

      return { ok: true, id, reminderId: reminderId || undefined };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل إضافة المتابعة') };
    }
  });

  ipcMain.handle('domain:inspection:delete', (_e, payload: unknown) => {
    try {
      const id = String(getField(payload, 'id') ?? payload ?? '').trim();
      if (!id) return { ok: false, message: 'معرف غير صالح' };
      const all = kvGetArray(DB_KEYS.INSPECTIONS);
      const next = all.filter((row) => !(isRecord(row) && String(row['id'] ?? '').trim() === id));
      kvSetArray(DB_KEYS.INSPECTIONS, next);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل حذف الكشف') };
    }
  });

  ipcMain.handle('domain:sales:agreement:delete', (_e, payload: unknown) => {
    try {
      const id = String(getField(payload, 'id') ?? payload ?? '').trim();
      if (!id) return { ok: false, message: 'معرف غير صالح' };

      const agreements = kvGetArray(DB_KEYS.SALES_AGREEMENTS);
      const nextAgreements = agreements.filter(
        (row) => !(isRecord(row) && String(row['id'] ?? '').trim() === id)
      );
      kvSetArray(DB_KEYS.SALES_AGREEMENTS, nextAgreements);

      // Best-effort cleanup: remove associated external commission records if present.
      const commissions = kvGetArray(DB_KEYS.EXTERNAL_COMMISSIONS);
      const nextCommissions = commissions.filter((row) => {
        if (!isRecord(row)) return true;
        const agreementId = String(row['agreementId'] ?? row['salesAgreementId'] ?? '').trim();
        return agreementId !== id;
      });
      if (nextCommissions.length !== commissions.length)
        kvSetArray(DB_KEYS.EXTERNAL_COMMISSIONS, nextCommissions);

      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل حذف اتفاقية البيع') };
    }
  });

  ipcMain.handle('domain:picker:properties', (_e, payload: unknown) => {
    try {
      const q = trimString(getStringField(payload, 'query'), 128, 'نص البحث');
      const status = trimString(getStringField(payload, 'status'), 64, 'الحالة');
      const type = trimString(getStringField(payload, 'type'), 64, 'النوع');
      const furnishing = trimString(getStringField(payload, 'furnishing'), 64, 'صفة العقار');
      const forceVacant = Boolean(getField(payload, 'forceVacant'));
      const occupancy = trimString(getStringField(payload, 'occupancy'), 16, 'الإشغال');
      const sale = trimString(getStringField(payload, 'sale'), 16, 'البيع');
      const rent = trimString(getStringField(payload, 'rent'), 16, 'الإيجار');
      const minArea = trimString(getStringField(payload, 'minArea'), 32, 'أقل مساحة');
      const maxArea = trimString(getStringField(payload, 'maxArea'), 32, 'أكبر مساحة');
      const floor = trimString(getStringField(payload, 'floor'), 64, 'الطابق');
      const minPrice = trimString(getStringField(payload, 'minPrice'), 32, 'أقل سعر');
      const maxPrice = trimString(getStringField(payload, 'maxPrice'), 32, 'أكبر سعر');
      const contractLink = trimString(getStringField(payload, 'contractLink'), 16, 'ارتباط عقد');
      const sort = trimString(getStringField(payload, 'sort'), 32, 'الترتيب');
      const offset = Math.max(0, Math.trunc(Number(getField(payload, 'offset')) || 0));
      const limit = getOptionalNumberField(payload, 'limit');
      return domainPropertyPickerSearch({
        query: q,
        status,
        type,
        furnishing,
        forceVacant,
        occupancy: occupancy as unknown as 'all' | 'rented' | 'vacant',
        sale: sale as unknown as 'for-sale' | 'not-for-sale' | '',
        rent: rent as unknown as 'for-rent' | 'not-for-rent' | '',
        minArea,
        maxArea,
        floor,
        minPrice,
        maxPrice,
        contractLink: contractLink as unknown as '' | 'linked' | 'unlinked' | 'all',
        sort,
        offset,
        limit,
      });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل البحث عن العقارات') };
    }
  });

  ipcMain.handle('domain:picker:contracts', (_e, payload: unknown) => {
    try {
      const q = trimString(getStringField(payload, 'query'), 128, 'نص البحث');
      const offset = Math.max(0, Math.trunc(Number(getField(payload, 'offset')) || 0));
      const limit = getOptionalNumberField(payload, 'limit');
      const tab = trimString(getStringField(payload, 'tab'), 32, 'التبويب');
      const sort = trimString(getStringField(payload, 'sort'), 32, 'الترتيب');
      const createdMonthRaw = trimString(
        getStringField(payload, 'createdMonth'),
        16,
        'شهر الإنشاء'
      );
      const createdMonth = /^\d{4}-\d{2}$/.test(createdMonthRaw) ? createdMonthRaw : '';
      const startDateFromRaw = trimString(
        getStringField(payload, 'startDateFrom'),
        16,
        'تاريخ البداية (من)'
      );
      const startDateToRaw = trimString(
        getStringField(payload, 'startDateTo'),
        16,
        'تاريخ البداية (إلى)'
      );
      const endDateFromRaw = trimString(
        getStringField(payload, 'endDateFrom'),
        16,
        'تاريخ النهاية (من)'
      );
      const endDateToRaw = trimString(
        getStringField(payload, 'endDateTo'),
        16,
        'تاريخ النهاية (إلى)'
      );
      const startDateFrom = /^\d{4}-\d{2}-\d{2}$/.test(startDateFromRaw) ? startDateFromRaw : '';
      const startDateTo = /^\d{4}-\d{2}-\d{2}$/.test(startDateToRaw) ? startDateToRaw : '';
      const endDateFrom = /^\d{4}-\d{2}-\d{2}$/.test(endDateFromRaw) ? endDateFromRaw : '';
      const endDateTo = /^\d{4}-\d{2}-\d{2}$/.test(endDateToRaw) ? endDateToRaw : '';

      const minValueRaw = String(getField(payload, 'minValue') ?? '').trim();
      const maxValueRaw = String(getField(payload, 'maxValue') ?? '').trim();
      const minValue = minValueRaw ? Number(minValueRaw) : undefined;
      const maxValue = maxValueRaw ? Number(maxValueRaw) : undefined;

      return domainContractPickerSearch({
        query: q,
        offset,
        limit,
        tab,
        sort,
        createdMonth,
        startDateFrom,
        startDateTo,
        endDateFrom,
        endDateTo,
        minValue: Number.isFinite(minValue as number) ? (minValue as number) : undefined,
        maxValue: Number.isFinite(maxValue as number) ? (maxValue as number) : undefined,
      });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل البحث عن العقود') };
    }
  });

  ipcMain.handle('domain:picker:people', (_e, payload: unknown) => {
    const q = trimString(getStringField(payload, 'query'), 128, 'نص البحث');
    const role = trimString(getStringField(payload, 'role'), 32, 'الدور');
    const onlyIdleOwners = Boolean(getField(payload, 'onlyIdleOwners'));
    const address = trimString(getStringField(payload, 'address'), 128, 'العنوان');
    const nationalId = trimString(getStringField(payload, 'nationalId'), 32, 'الرقم الوطني');
    const classification = trimString(getStringField(payload, 'classification'), 64, 'التصنيف');
    const minRating = Math.max(0, Math.min(5, Number(getField(payload, 'minRating') ?? 0) || 0));
    const sort = trimString(getStringField(payload, 'sort'), 32, 'الترتيب');
    const offset = Math.max(0, Math.trunc(Number(getField(payload, 'offset')) || 0));
    const limit = Math.max(1, Math.min(200, Math.trunc(Number(getField(payload, 'limit')) || 48)));
    return domainPeoplePickerSearch({
      query: q,
      role,
      onlyIdleOwners,
      address,
      nationalId,
      classification,
      minRating,
      sort,
      offset,
      limit,
    });
  });

  ipcMain.handle('domain:installments:contracts', (_e, payload: unknown) => {
    try {
      const q = trimString(getStringField(payload, 'query'), 128, 'نص البحث');
      const filter = trimString(getStringField(payload, 'filter') || 'all', 16, 'الفلتر') || 'all';
      const sort = trimString(getStringField(payload, 'sort'), 32, 'الترتيب');
      const offset = Math.max(0, Math.trunc(Number(getField(payload, 'offset')) || 0));
      const limit = Math.max(
        1,
        Math.min(100, Math.trunc(Number(getField(payload, 'limit')) || 20))
      );
      return domainInstallmentsContractsSearch({ query: q, filter, sort, offset, limit });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل الأقساط') };
    }
  });

  // SQL Server Sync
  ipcMain.handle('sql:getSettings', async () => {
    return loadSqlSettingsRedacted();
  });

  ipcMain.handle('sql:saveSettings', async (_e, settings: unknown) => {
    try {
      const saved = await loadSqlSettings();
      const enabled = Boolean(getField(settings, 'enabled'));
      const authMode = getStringField(settings, 'authMode') === 'windows' ? 'windows' : 'sql';

      // If the user leaves the password field empty while a password is already stored,
      // keep the existing password instead of clearing it.
      const incomingPassword = toLimitedPassword(getField(settings, 'password'), 512);
      const passwordToSave =
        incomingPassword || String((saved as { password?: unknown })?.password || '');

      await saveSqlSettings({
        enabled,
        server: trimString(getStringField(settings, 'server'), 256, 'السيرفر'),
        port: safePortOrDefault(getField(settings, 'port'), 1433),
        database:
          trimString(getStringField(settings, 'database') || 'AZRAR', 128, 'قاعدة البيانات') ||
          'AZRAR',
        authMode,
        user: trimString(getStringField(settings, 'user'), 128, 'المستخدم'),
        password: passwordToSave,
        encrypt: getField(settings, 'encrypt') !== false,
        trustServerCertificate: getField(settings, 'trustServerCertificate') !== false,
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
      server: trimString(
        (getField(settings, 'server') ?? saved.server ?? '') as unknown,
        256,
        'السيرفر'
      ),
      port: safePortOrDefault(getField(settings, 'port') ?? saved.port ?? 1433, 1433),
      database:
        trimString(
          (getField(settings, 'database') ?? saved.database ?? 'AZRAR') as unknown,
          128,
          'قاعدة البيانات'
        ) || 'AZRAR',
      authMode: (getStringField(settings, 'authMode') === 'windows'
        ? 'windows'
        : 'sql') as TestSqlSettings['authMode'],
      user: trimString(
        (getField(settings, 'user') ?? saved.user ?? '') as unknown,
        128,
        'المستخدم'
      ),
      password:
        typeof getField(settings, 'password') === 'string'
          ? toLimitedPassword(getField(settings, 'password'), 512)
          : toLimitedPassword(getField(saved, 'password'), 512),
      encrypt: getField(settings, 'encrypt') !== false,
      trustServerCertificate: getField(settings, 'trustServerCertificate') !== false,
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
            broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
            addSqlSyncLogEntry({
              direction: 'pull',
              action: 'delete',
              key: row.k,
              status: 'ok',
              ts: remoteTs,
            });
          } else {
            kvSetWithUpdatedAt(row.k, row.v, remoteTs);
            broadcastDbRemoteUpdate({
              key: row.k,
              value: row.v,
              isDeleted: false,
              updatedAt: remoteTs,
            });
            addSqlSyncLogEntry({
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

      await pushAllLocalToRemote();
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
    return { ok: true, items: sqlSyncLog };
  });

  ipcMain.handle('sql:clearSyncLog', async () => {
    sqlSyncLog.splice(0, sqlSyncLog.length);
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
        Omit<SqlCoverageItem, 'remoteUpdatedAt' | 'remoteIsDeleted' | 'status'>
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
      const remoteItemsRaw = getField(remoteRes, 'items');
      const remoteItems = Array.isArray(remoteItemsRaw) ? remoteItemsRaw : [];
      const remoteMap = new Map<string, { remoteUpdatedAt?: string; remoteIsDeleted?: boolean }>();
      for (const r of remoteItems) {
        const key = getStringField(r, 'key').trim();
        if (!key) continue;
        if (!key.startsWith('db_')) continue;
        remoteMap.set(key, {
          remoteUpdatedAt: getField(r, 'updatedAt') ? getStringField(r, 'updatedAt') : undefined,
          remoteIsDeleted: Boolean(getField(r, 'isDeleted')),
        });
      }

      const allKeys = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
      const items: SqlCoverageItem[] = [];

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

        let status: SqlCoverageItem['status'] = 'unknown';
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

      const remoteMessageRaw = getField(remoteRes, 'message');
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
      addSqlSyncLogEntry({
        direction: 'system',
        action: 'exportBackup',
        status: 'ok',
        message: 'بدء تصدير نسخة احتياطية من المخدم',
      });
      const settings = await loadSqlSettings();
      if (!settings.server?.trim()) return { ok: false, message: 'اسم السيرفر مطلوب' };
      if (!settings.database?.trim()) return { ok: false, message: 'اسم قاعدة البيانات مطلوب' };

      const backupSettings = await readBackupSettings();
      const backupDir =
        backupSettings.backupDir && isExistingDirectory(backupSettings.backupDir)
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
      const defaultName = `AZRAR_SERVER_BACKUP_${dbNameSafe}_${formatBackupStamp()}.json${
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
        addSqlSyncLogEntry({
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
          addSqlSyncLogEntry({
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

        addSqlSyncLogEntry({
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
      addSqlSyncLogEntry({
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
      addSqlSyncLogEntry({
        direction: 'system',
        action: 'importBackup',
        status: 'ok',
        message: 'بدء استيراد (دمج) نسخة احتياطية',
      });
      const filePath = await chooseJsonFileViaDialog();
      if (!filePath) return { ok: false, message: 'تم الإلغاء' };

      const isEnc = (await isEncryptedFile(filePath)) || path.extname(filePath).toLowerCase() === '.enc';
      if (!isEnc) {
        const res = await importServerBackupFromFile(filePath, 'merge');
        addSqlSyncLogEntry({
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

      const tmpJson = path.join(app.getPath('temp'), `AZRAR_SERVER_BACKUP_IMPORT_TMP_${Date.now()}.json`);
      try {
        await decryptFileToFile({ sourcePath: filePath, destPath: tmpJson, password: encryptionPassword });
        const res = await importServerBackupFromFile(tmpJson, 'merge');
        addSqlSyncLogEntry({
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
      addSqlSyncLogEntry({
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

      addSqlSyncLogEntry({
        direction: 'system',
        action: 'restoreBackup',
        status: 'ok',
        message: 'بدء استعادة كاملة من نسخة احتياطية',
      });

      const filePath = await chooseJsonFileViaDialog();
      if (!filePath) return { ok: false, message: 'تم الإلغاء' };

      const isEnc = (await isEncryptedFile(filePath)) || path.extname(filePath).toLowerCase() === '.enc';
      if (!isEnc) {
        const res = await importServerBackupFromFile(filePath, 'replace');
        addSqlSyncLogEntry({
          direction: 'system',
          action: 'restoreBackup',
          status: res?.ok ? 'ok' : 'error',
          message: res?.message,
        });
        return res;
      }

      const enc = await readBackupEncryptionSettings();
      const encryptionPassword = enc.passwordEnc ? decryptSecretBestEffort(String(enc.passwordEnc || '')) : '';
      if (!encryptionPassword) {
        return {
          ok: false,
          message:
            'الملف مشفر (.enc) لكن لا توجد كلمة مرور محفوظة. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.',
        };
      }

      const tmpJson = path.join(app.getPath('temp'), `AZRAR_SERVER_BACKUP_RESTORE_TMP_${Date.now()}.json`);
      try {
        await decryptFileToFile({ sourcePath: filePath, destPath: tmpJson, password: encryptionPassword });
        const res = await importServerBackupFromFile(tmpJson, 'replace');
        addSqlSyncLogEntry({
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
      addSqlSyncLogEntry({
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
      const enabledRaw = getField(payload, 'enabled');
      const next = await saveSqlBackupAutomationSettings({
        enabled: typeof enabledRaw === 'boolean' ? enabledRaw : undefined,
        retentionDays: getOptionalNumberField(payload, 'retentionDays'),
      });
      return { ok: true, settings: next };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل حفظ إعدادات النسخ الاحتياطي') };
    }
  });

  ipcMain.handle('sql:listServerBackups', async (_e, payload: unknown) => {
    const limit = getField(payload, 'limit');
    const n = typeof limit === 'number' ? limit : Number(limit || 60) || 60;
    return await listServerBackups(n);
  });

  ipcMain.handle('sql:createServerBackup', async (_e, payload: unknown) => {
    try {
      addSqlSyncLogEntry({
        direction: 'system',
        action: 'createServerBackup',
        status: 'ok',
        message: 'بدء رفع نسخة احتياطية إلى المخدم',
      });
      const noteRaw = getField(payload, 'note');
      const note = noteRaw ? String(noteRaw).slice(0, 200) : undefined;
      const auto = await loadSqlBackupAutomationSettings();
      const res = await createServerBackupOnServer({
        note: note || 'manual',
        retentionDays: auto.retentionDays,
      });
      addSqlSyncLogEntry({
        direction: 'system',
        action: 'createServerBackup',
        status: res?.ok ? 'ok' : 'error',
        message: res?.message,
      });
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل رفع النسخة الاحتياطية إلى المخدم');
      addSqlSyncLogEntry({
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
      const id = getStringField(payload, 'id').trim();
      const mode = getStringField(payload, 'mode') === 'replace' ? 'replace' : 'merge';
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

      addSqlSyncLogEntry({
        direction: 'system',
        action: 'restoreServerBackup',
        status: 'ok',
        message: `بدء استعادة نسخة من المخدم (${mode})`,
      });
      const res = await restoreServerBackupFromServer(id, mode);
      addSqlSyncLogEntry({
        direction: 'system',
        action: 'restoreServerBackup',
        status: res?.ok ? 'ok' : 'error',
        message: res?.message,
      });
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل استعادة النسخة من المخدم');
      addSqlSyncLogEntry({
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
        addSqlSyncLogEntry({
          direction: 'system',
          action: 'dailyBackup',
          status: 'error',
          message: `${reason}: ${res?.message || 'فشل'}`,
        });
        return;
      }
      if (res?.created)
        addSqlSyncLogEntry({
          direction: 'system',
          action: 'dailyBackup',
          status: 'ok',
          message: `${reason}: تم إنشاء نسخة يومية`,
        });
    } catch (e: unknown) {
      addSqlSyncLogEntry({
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
      addSqlSyncLogEntry({
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
            broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
            addSqlSyncLogEntry({
              direction: 'pull',
              action: 'delete',
              key: row.k,
              status: 'ok',
              ts: remoteTs,
            });
            pullDeletes += 1;
          } else {
            kvSetWithUpdatedAt(row.k, row.v, remoteTs);
            broadcastDbRemoteUpdate({
              key: row.k,
              value: row.v,
              isDeleted: false,
              updatedAt: remoteTs,
            });
            addSqlSyncLogEntry({
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
                  addSqlSyncLogEntry({
                    direction: 'system',
                    action: 'attachments:pull',
                    status: 'ok',
                    message: `تم تنزيل ${res.downloaded} مرفق/مرفقات`,
                  });
                }
                if (res.missingRemote > 0) {
                  addSqlSyncLogEntry({
                    direction: 'system',
                    action: 'attachments:pull',
                    status: 'error',
                    message: `مرفقات غير موجودة على المخدم: ${res.missingRemote}`,
                  });
                }
              } catch (e: unknown) {
                addSqlSyncLogEntry({
                  direction: 'system',
                  action: 'attachments:pull',
                  status: 'error',
                  message: toErrorMessage(e, 'فشل تنزيل المرفقات'),
                });
              }
            }
          }
        },
        { runImmediately: true }
      );

      // Push local changes
      const pushStats = await pushAllLocalToRemote();

      const summaryParts: string[] = [];
      summaryParts.push(`سحب: تعديل ${pullUpserts} / حذف ${pullDeletes}`);
      if (pushStats)
        summaryParts.push(`رفع: تعديل ${pushStats.upsertsOk} / حذف ${pushStats.deletesOk}`);
      if (pushStats?.errors) summaryParts.push(`أخطاء رفع: ${pushStats.errors}`);

      addSqlSyncLogEntry({
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
      addSqlSyncLogEntry({ direction: 'system', action: 'syncNow', status: 'error', message: msg });
      return { ok: false, message: msg };
    }
  });

  ipcMain.handle('sql:pullFullNow', async () => {
    try {
      addSqlSyncLogEntry({
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
            broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
            addSqlSyncLogEntry({
              direction: 'pull',
              action: 'delete',
              key: row.k,
              status: 'ok',
              ts: remoteTs,
            });
            pullDeletes += 1;
          } else {
            kvSetWithUpdatedAt(row.k, row.v, remoteTs);
            broadcastDbRemoteUpdate({
              key: row.k,
              value: row.v,
              isDeleted: false,
              updatedAt: remoteTs,
            });
            addSqlSyncLogEntry({
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
                  addSqlSyncLogEntry({
                    direction: 'system',
                    action: 'attachments:pull',
                    status: 'ok',
                    message: `تم تنزيل ${res.downloaded} مرفق/مرفقات`,
                  });
                }
                if (res.missingRemote > 0) {
                  addSqlSyncLogEntry({
                    direction: 'system',
                    action: 'attachments:pull',
                    status: 'error',
                    message: `مرفقات غير موجودة على المخدم: ${res.missingRemote}`,
                  });
                }
              } catch (e: unknown) {
                addSqlSyncLogEntry({
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
      addSqlSyncLogEntry({ direction: 'system', action: 'syncNow', status: 'ok', message: msg });
      return { ok: true, message: msg };
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل السحب من المخدم');
      addSqlSyncLogEntry({ direction: 'system', action: 'syncNow', status: 'error', message: msg });
      return { ok: false, message: msg };
    }
  });

  ipcMain.handle('sql:mergePublishAdmin', async (_e, payload: unknown) => {
    try {
      addSqlSyncLogEntry({
        direction: 'system',
        action: 'mergePublish',
        status: 'ok',
        message: 'بدء دمج ونشر (SuperAdmin) للمفاتيح المحددة',
      });
      const settings = await loadSqlSettings();
      if (!settings.enabled) return { ok: false, message: 'المزامنة غير مفعلة' };

      const conn = await connectAndEnsureDatabase(settings);
      if (!conn.ok) return conn;

      const requestedKeysRaw = getField(payload, 'keys');
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

      const normKeySimple = (v: unknown) => String(v ?? '').trim().toLowerCase();

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
          getField(obj, 'updatedAt'),
          getField(obj, 'updated_at'),
          getField(obj, 'modifiedAt'),
          getField(obj, 'lastModifiedAt'),
          getField(obj, 'createdAt'),
          getField(obj, 'ts'),
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
          const userId = getStringField(item, 'userId').trim();
          const code = getStringField(item, 'permissionCode').trim();
          if (userId && code) return `perm:${userId}:${code}`;
        }

        // lookups might be { id, category, label }
        if (k === 'db_lookups') {
          const stableKey = getStringField(item, 'key').trim();
          if (stableKey) return `key:${stableKey}`;
          const id = getStringField(item, 'id').trim();
          if (id) return `id:${id}`;
          const category = getStringField(item, 'category').trim();
          const label = getStringField(item, 'label').trim();
          if (category && label) {
            const computed = lookupKeyFor(category, label);
            if (computed) return `key:${computed}`;
            return `lookup:${category}:${label}`;
          }
        }

        // lookup categories might be { id, name, label }
        if (k === 'db_lookup_categories') {
          const stableKey = getStringField(item, 'key').trim();
          if (stableKey) return `key:${stableKey}`;
          const id = getStringField(item, 'id').trim();
          if (id) return `id:${id}`;
          const name = getStringField(item, 'name').trim();
          if (name) return `key:${name}`;
        }

        // users might be { id, اسم_المستخدم }
        if (k === 'db_users') {
          const id = getStringField(item, 'id').trim();
          if (id) return `id:${id}`;
          const u = getStringField(item, 'اسم_المستخدم').trim();
          if (u) return `u:${u}`;
        }

        // roles/templates are generally keyed by id
        const genericId = getStringField(item, 'id').trim();
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
        getStringField(payload, 'prefer') === 'remote' ? 'remote' : 'local';
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
          addSqlSyncLogEntry({
            direction: 'push',
            action: 'mergeUpsert',
            key,
            status: 'ok',
            ts: nowIso,
          });

          // Also normalize local state to match what we just published.
          kvSetWithUpdatedAt(key, mergedJson, nowIso);
          broadcastDbRemoteUpdate({ key, value: mergedJson, isDeleted: false, updatedAt: nowIso });

          applied += 1;
        } catch (e: unknown) {
          errors += 1;
          addSqlSyncLogEntry({
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
      addSqlSyncLogEntry({
        direction: 'system',
        action: 'mergePublish',
        status: errors > 0 ? 'error' : 'ok',
        message,
      });
      return { ok: errors === 0, message, applied, errors, keys };
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل الدمج/النشر');
      addSqlSyncLogEntry({
        direction: 'system',
        action: 'mergePublish',
        status: 'error',
        message: msg,
      });
      return { ok: false, message: msg };
    }
  });

  ipcMain.handle('sql:provision', async (_e, payload: unknown) => {
    addSqlSyncLogEntry({
      direction: 'system',
      action: 'provision',
      status: 'ok',
      message: 'بدء تهيئة المخدم',
    });
    try {
      type ProvisionRequest = Parameters<typeof provisionSqlServer>[0];
      const databaseRaw = getStringField(payload, 'database').trim();
      const req: ProvisionRequest = {
        server: trimString(getStringField(payload, 'server'), 256, 'السيرفر'),
        port: safePortOrDefault(getField(payload, 'port') || 1433, 1433),
        database: databaseRaw ? trimString(databaseRaw, 128, 'قاعدة البيانات') : undefined,
        encrypt: getField(payload, 'encrypt') !== false,
        trustServerCertificate: getField(payload, 'trustServerCertificate') !== false,
        adminUser: trimString(getStringField(payload, 'adminUser'), 128, 'حساب الأدمن'),
        adminPassword: toLimitedPassword(getField(payload, 'adminPassword'), 512),
        managerUser: trimString(getStringField(payload, 'managerUser'), 128, 'حساب المدير'),
        managerPassword: toLimitedPassword(getField(payload, 'managerPassword'), 512),
        employeeUser: trimString(getStringField(payload, 'employeeUser'), 128, 'حساب الموظف'),
        employeePassword: toLimitedPassword(getField(payload, 'employeePassword'), 512),
      };

      if (!req.server) return { ok: false, message: 'اسم السيرفر مطلوب' };
      if (!req.adminUser || !req.adminPassword)
        return { ok: false, message: 'بيانات الأدمن مطلوبة' };
      if (!req.managerUser || !req.managerPassword)
        return { ok: false, message: 'بيانات المدير مطلوبة' };
      if (!req.employeeUser || !req.employeePassword)
        return { ok: false, message: 'بيانات الموظف مطلوبة' };

      const res = await provisionSqlServer(req);
      addSqlSyncLogEntry({
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
                broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
                addSqlSyncLogEntry({
                  direction: 'pull',
                  action: 'delete',
                  key: row.k,
                  status: 'ok',
                  ts: remoteTs,
                });
              } else {
                kvSetWithUpdatedAt(row.k, row.v, remoteTs);
                broadcastDbRemoteUpdate({
                  key: row.k,
                  value: row.v,
                  isDeleted: false,
                  updatedAt: remoteTs,
                });
                addSqlSyncLogEntry({
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

          await pushAllLocalToRemote();
        }
      }
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'بيانات التهيئة غير صالحة');
      addSqlSyncLogEntry({
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
        addSqlSyncLogEntry({
          direction: 'system',
          action: 'connect',
          status: 'ok',
          message: 'بدء الاتصال التلقائي بالمخدم',
        });
        const res = await connectAndEnsureDatabase(settings);
        if (res.ok) {
          await startSqlPullLoop();

          // Automatic push: initial full push once, then periodic delta pushes.
          void (async () => {
            try {
              const st = await pushAllLocalToRemote();
              addSqlSyncLogEntry({
                direction: 'system',
                action: 'syncNow',
                status: st.errors > 0 ? 'error' : 'ok',
                message: `مزامنة تلقائية (رفع كامل): تعديل ${st.upsertsOk} / حذف ${st.deletesOk}${st.errors ? ` / أخطاء ${st.errors}` : ''}`,
              });
            } catch {
              // ignore
            }
          })();

          startAutoSyncPushLoop();
        } else {
          addSqlSyncLogEntry({
            direction: 'system',
            action: 'connect',
            status: 'error',
            message: res?.message || 'فشل الاتصال التلقائي بالمخدم',
          });
        }
      } catch (e: unknown) {
        addSqlSyncLogEntry({
          direction: 'system',
          action: 'connect',
          status: 'error',
          message: toErrorMessage(e, 'فشل الاتصال التلقائي بالمخدم'),
        });
      }
    })();
  }, 800);

  ipcMain.handle('db:getBackupDir', async () => {
    const settings = await readBackupSettings();
    const dir = settings.backupDir;
    if (dir && isExistingDirectory(dir)) return dir;
    return '';
  });

  ipcMain.handle('db:chooseBackupDir', async () => {
    const dir = await chooseBackupDirViaDialog();
    if (!dir) return { success: false, message: 'تم الإلغاء' };
    try {
      await writeBackupSettings({ backupDir: dir });
      return { success: true, message: 'تم حفظ مجلد النسخ الاحتياطي', backupDir: dir };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل حفظ مجلد النسخ الاحتياطي') };
    }
  });

  ipcMain.handle('db:getLocalBackupAutomationSettings', async () => {
    return await readLocalBackupAutomationSettings();
  });

  ipcMain.handle('db:saveLocalBackupAutomationSettings', async (_e, payload: Record<string, unknown> | undefined) => {
    try {
      const current = await readLocalBackupAutomationSettings();
      const next: LocalBackupAutomationSettings = {
        ...current,
        v: 1,
        enabled: payload?.enabled === true,
        timeHHmm: normalizeTimeHHmm(payload?.timeHHmm ?? current.timeHHmm),
        retentionDays: normalizeRetentionDays(payload?.retentionDays ?? current.retentionDays),
        lastRunAt: typeof current.lastRunAt === 'string' ? current.lastRunAt : undefined,
      };
      await writeLocalBackupAutomationSettings(next);
      startLocalAutoBackupScheduler();
      return { success: true, message: 'تم حفظ إعدادات النسخ الاحتياطي التلقائي', settings: await readLocalBackupAutomationSettings() };
    } catch (e: unknown) {
      return { success: false, message: toErrorMessage(e, 'فشل حفظ إعدادات النسخ الاحتياطي التلقائي') };
    }
  });

  ipcMain.handle('db:getLocalBackupStats', async () => {
    try {
      const backupSettings = await readBackupSettings();
      const dir =
        backupSettings.backupDir && isExistingDirectory(backupSettings.backupDir)
          ? backupSettings.backupDir
          : '';
      return await getLocalBackupStatsBestEffort(dir);
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
    return await readLocalBackupLogEntries(typeof limit === 'number' ? limit : 200);
  });

  ipcMain.handle('db:clearLocalBackupLog', async () => {
    await clearLocalBackupLog();
    return { ok: true };
  });

  ipcMain.handle('db:runLocalBackupNow', async () => {
    try {
      const backupSettings = await readBackupSettings();
      const dir =
        backupSettings.backupDir && isExistingDirectory(backupSettings.backupDir)
          ? backupSettings.backupDir
          : '';
      if (!dir) return { success: false, message: 'مجلد النسخ الاحتياطي غير مضبوط' };

      const res = await runLocalBackupToDir(dir);
      if (!res.ok) {
        await appendLocalBackupLogEntry({
          ts: new Date().toISOString(),
          ok: false,
          trigger: 'manual',
          message: res.message || 'فشل إنشاء النسخة الاحتياطية',
        });
        return { success: false, message: res.message || 'فشل إنشاء النسخة الاحتياطية' };
      }

      const st = await readLocalBackupAutomationSettings();
      await writeLocalBackupAutomationSettings({ ...st, enabled: st.enabled === true, lastRunAt: new Date().toISOString() });
      await pruneLocalBackupsBestEffort(dir, st.retentionDays ?? 30);

      await appendLocalBackupLogEntry({
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
      await appendLocalBackupLogEntry({
        ts: new Date().toISOString(),
        ok: false,
        trigger: 'manual',
        message: toErrorMessage(e, 'فشل إنشاء النسخة الاحتياطية'),
      });
      return { success: false, message: toErrorMessage(e, 'فشل إنشاء النسخة الاحتياطية') };
    }
  });

  // Export database to user-selected folder
  // Creates both a stable "latest" backup and a dated archive backup.
  ipcMain.handle('db:export', async () => {
    if (dbMaintenanceMode)
      return { success: false, message: 'قاعدة البيانات قيد الاسترجاع/الصيانة. حاول لاحقاً.' };

    // Remember first selected backup folder and reuse it.
    const settings = await readBackupSettings();
    let dir =
      settings.backupDir && isExistingDirectory(settings.backupDir) ? settings.backupDir : null;

    if (!dir) {
      const result = await dialog.showOpenDialog({
        title: 'اختر مجلد حفظ النسخة الاحتياطية (سيتم حفظه تلقائياً)',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: 'تم الإلغاء' };
      }

      dir = result.filePaths[0];
      try {
        await writeBackupSettings({ backupDir: dir });
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
      dbMaintenanceMode = true;
      if (!encryptionRequested) {
        await exportDatabaseToMany([latestPath, archivePath]);
      } else {
        if (!encryptionConfigured || !encryptionPassword) {
          throw new Error('تشفير النسخ الاحتياطية مفعل لكن كلمة المرور غير مضبوطة. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.');
        }

        const tmpPlain = path.join(app.getPath('temp'), `AZRAR-backup-tmp-${Date.now()}.db`);
        try {
          await exportDatabaseToMany([tmpPlain]);
          await encryptFileToFile({ sourcePath: tmpPlain, destPath: latestPath, password: encryptionPassword });
          await encryptFileToFile({ sourcePath: tmpPlain, destPath: archivePath, password: encryptionPassword });
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
        const res = await exportAttachmentsArchiveToMany({
          destPaths: [attachmentsLatestPath, attachmentsArchivePath],
          encryptionRequested,
          encryptionConfigured,
          encryptionPassword,
        });
        attachmentsCopied = res.copiedAny;
      } catch {
        attachmentsCopied = false;
      }

      dbMaintenanceMode = false;
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
      dbMaintenanceMode = false;
      return { success: false, message: toErrorMessage(err, 'فشل تصدير قاعدة البيانات') };
    }
  });

  // Import database from user-selected file
  ipcMain.handle('db:import', async () => {
    if (dbMaintenanceMode)
      return { success: false, message: 'قاعدة البيانات قيد الاسترجاع/الصيانة. حاول لاحقاً.' };
    const result = await dialog.showOpenDialog({
      title: 'استيراد قاعدة البيانات',
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'Encrypted Backup', extensions: ['enc'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'تم الإلغاء' };
    }

    try {
      const selected = result.filePaths[0];
      if (!selected) return { success: false, message: 'مسار الملف غير صالح' };

      const resolved = await fsp.realpath(selected).catch(() => path.resolve(selected));
      if (isUncPath(resolved))
        return { success: false, message: 'غير مسموح استيراد قاعدة البيانات من مسار شبكة (UNC)' };

      const ext = path.extname(resolved).toLowerCase();
      const looksEncryptedByExt = ext === '.enc';
      const looksEncryptedByMagic = await isEncryptedFile(resolved);
      const isEncrypted = looksEncryptedByExt || looksEncryptedByMagic;

      if (!isEncrypted) {
        if (!['.db', '.sqlite', '.sqlite3'].includes(ext)) {
          return {
            success: false,
            message: 'الملف يجب أن يكون قاعدة بيانات SQLite (.db / .sqlite / .sqlite3) أو ملف نسخة مشفرة (.enc)',
          };
        }
      }

      const st = await fsp.stat(resolved);
      if (!st.isFile()) return { success: false, message: 'الملف غير صالح' };
      if (st.size <= 0) return { success: false, message: 'الملف فارغ' };
      if (st.size > MAX_DB_IMPORT_BYTES)
        return { success: false, message: 'حجم قاعدة البيانات كبير جداً' };

      dbMaintenanceMode = true;
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
            const password = s.passwordEnc ? decryptSecretBestEffort(String(s.passwordEnc || '')) : '';
            const r = await restoreAttachmentsFromArchiveBestEffort({ archivePath: archiveCandidate, password });
            attachmentsRestored = r.restored;
            attachmentsMsg = r.message;
          }
        } catch (e: unknown) {
          attachmentsMsg = toErrorMessage(e, 'فشل استعادة المرفقات');
          attachmentsRestored = false;
        }

        dbMaintenanceMode = false;
        const msg = attachmentsRestored
          ? 'تم الاستيراد بنجاح (قاعدة البيانات + المرفقات) - أعد تشغيل التطبيق'
          : attachmentsMsg
            ? `تم الاستيراد بنجاح - أعد تشغيل التطبيق. ملاحظة: ${attachmentsMsg}`
            : 'تم الاستيراد بنجاح - أعد تشغيل التطبيق';
        return { success: true, message: msg, path: resolved, attachmentsRestored };
      }

      const enc = await readBackupEncryptionSettings();
      const encryptionPassword = enc.passwordEnc ? decryptSecretBestEffort(String(enc.passwordEnc || '')) : '';
      if (!encryptionPassword) {
        dbMaintenanceMode = false;
        return { success: false, message: 'لا توجد كلمة مرور لتشفير النسخ الاحتياطية. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.' };
      }

      const tmpPlain = path.join(app.getPath('temp'), `AZRAR-restore-tmp-${Date.now()}.db`);
      try {
        await decryptFileToFile({ sourcePath: resolved, destPath: tmpPlain, password: encryptionPassword });
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
          const r = await restoreAttachmentsFromArchiveBestEffort({
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

      dbMaintenanceMode = false;
      const msg = attachmentsRestored
        ? 'تم الاستيراد بنجاح (قاعدة البيانات + المرفقات) - أعد تشغيل التطبيق'
        : attachmentsMsg
          ? `تم الاستيراد بنجاح - أعد تشغيل التطبيق. ملاحظة: ${attachmentsMsg}`
          : 'تم الاستيراد بنجاح - أعد تشغيل التطبيق';
      return { success: true, message: msg, path: resolved, attachmentsRestored };
    } catch (err: unknown) {
      dbMaintenanceMode = false;
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
      return { success: false, message: toErrorMessage(e, 'فشل قراءة إعدادات تشفير النسخ الاحتياطية') };
    }
  });

  ipcMain.handle('db:saveBackupEncryptionSettings', async (_evt, payload: unknown) => {
    try {
      const p = (payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}) as Record<
        string,
        unknown
      >;

      const nextEnabled = p.enabled === undefined ? undefined : !!p.enabled;
      const clearPassword = p.clearPassword === true;
      const password = typeof p.password === 'string' ? p.password : undefined;

      if (password !== undefined) {
        if (password.length < 6) return { success: false, message: 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)' };
        if (password.length > 256) return { success: false, message: 'كلمة المرور طويلة جداً' };
        if (password.includes('\u0000')) return { success: false, message: 'كلمة المرور غير صالحة' };
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
        if (nowEnabled && hasPassword && (!hadPassword || passwordChanged || current.enabled !== true)) {
          const plain = decryptSecretBestEffort(String(next.passwordEnc || ''));
          if (plain) {
            setTimeout(() => {
              void encryptExistingAttachmentsAtRestBestEffort(plain).catch(() => undefined);
            }, 300);
          }
        }

        // If password changed, re-encrypt already-encrypted attachments (prevents losing access).
        if (nowEnabled && password !== undefined && currentPasswordPlain && password && currentPasswordPlain !== password) {
          setTimeout(() => {
            void reencryptEncryptedAttachmentsAtRestBestEffort(currentPasswordPlain, password).catch(() => undefined);
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
      logger.warn('backup-encryption: failed to save settings', { err: toErrorMessage(e, 'فشل حفظ إعدادات تشفير النسخ الاحتياطية') });
      return { success: false, message: toErrorMessage(e, 'فشل حفظ إعدادات تشفير النسخ الاحتياطية') };
    }
  });

  // Get database file path (for display purposes)
  ipcMain.handle('db:getPath', () => getDbPath());

  // =====================
  // Attachments (Files)
  // =====================

  // IMPORTANT: Keep attachments in a stable location across updates.
  // Storing next to the executable can change between versions/install folders and makes attachments appear "lost".
  const getStableAttachmentsRoot = () => path.join(path.dirname(getDbPath()), 'attachments');

  const getLegacyExeAttachmentsRoot = () => {
    if (!app.isPackaged) return null;
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      return path.join(exeDir, 'attachments');
    } catch {
      return null;
    }
  };

  const getLastResortAttachmentsRoot = () => path.join(app.getPath('userData'), 'attachments');

  const ensureWritableDir = async (dir: string) => {
    await fsp.mkdir(dir, { recursive: true });
    const probe = path.join(dir, '.write-test');
    await fsp.writeFile(probe, 'ok');
    await fsp.unlink(probe);
  };

  const directoryExists = (p: string): boolean => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  };

  const migrateLegacyAttachmentsOnce = async (stableRoot: string) => {
    const stableEntries = await fsp.readdir(stableRoot).catch(() => [] as string[]);
    const stableHasData =
      stableEntries.filter(
        (n) =>
          n &&
          n !== '.write-test' &&
          n !== '.migrated-from-exe' &&
          n !== '.migrated-from-userData'
      ).length > 0;
    if (stableHasData) return;

    const tryMigrate = async (srcDir: string | null, markerName: string) => {
      if (!srcDir) return;
      if (!directoryExists(srcDir)) return;
      if (path.resolve(srcDir) === path.resolve(stableRoot)) return;

      const marker = path.join(stableRoot, markerName);
      try {
        await fsp.access(marker);
        return;
      } catch {
        // continue
      }

      try {
        const entries = await fsp.readdir(srcDir).catch(() => [] as string[]);
        const hasData = entries.length > 0;
        if (hasData) {
          await fsp.cp(srcDir, stableRoot, { recursive: true, force: false });
        }
      } catch {
        // ignore
      }

      try {
        await fsp.writeFile(marker, new Date().toISOString(), 'utf8');
      } catch {
        // ignore
      }
    };

    // 1) Legacy packaged behavior: attachments next to the executable.
    await tryMigrate(getLegacyExeAttachmentsRoot(), '.migrated-from-exe');

    // 2) Older/alternate behavior: attachments under userData.
    await tryMigrate(getLastResortAttachmentsRoot(), '.migrated-from-userData');
  };

  const getAttachmentsRoot = async () => {
    const stable = getStableAttachmentsRoot();
    try {
      await ensureWritableDir(stable);
      await migrateLegacyAttachmentsOnce(stable);
      return stable;
    } catch {
      const last = getLastResortAttachmentsRoot();
      await ensureWritableDir(last);
      return last;
    }
  };

  const resolveExistingAttachmentAbsPath = async (storedPath: string) => {
    let raw = String(storedPath || '').trim();
    if (!raw) throw new Error('Invalid attachment path');

    // Accept file:// URLs (some older code paths may store those)
    if (/^file:\/\//i.test(raw)) {
      try {
        raw = fileURLToPath(raw);
      } catch {
        // ignore and continue with raw
      }
    }

    const stableRoot = await getAttachmentsRoot();
    const legacyRoot = getLegacyExeAttachmentsRoot();
    const userDataRoot = getLastResortAttachmentsRoot();

    const normalizeRel = (p: string) =>
      String(p || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .trim();

    const tryRelative = async (relCandidate: string) => {
      const rel = normalizeRel(relCandidate);
      if (!rel) return null;

      const stableAbs = path.join(stableRoot, rel);
      ensureInsideRoot(stableRoot, stableAbs);
      try {
        await fsp.access(stableAbs);
        return stableAbs;
      } catch {
        // continue
      }

      if (legacyRoot) {
        const legacyAbs = path.join(legacyRoot, rel);
        ensureInsideRoot(legacyRoot, legacyAbs);
        await fsp.access(legacyAbs);
        return legacyAbs;
      }

      if (userDataRoot && path.resolve(userDataRoot) !== path.resolve(stableRoot)) {
        const udAbs = path.join(userDataRoot, rel);
        ensureInsideRoot(userDataRoot, udAbs);
        await fsp.access(udAbs);
        return udAbs;
      }

      return null;
    };

    const tryAbsoluteWithinRoots = async (absCandidate: string) => {
      const abs = path.normalize(absCandidate);
      try {
        ensureInsideRoot(stableRoot, abs);
        await fsp.access(abs);
        return abs;
      } catch {
        // continue
      }

      if (legacyRoot) {
        ensureInsideRoot(legacyRoot, abs);
        await fsp.access(abs);
        return abs;
      }

      if (userDataRoot && path.resolve(userDataRoot) !== path.resolve(stableRoot)) {
        ensureInsideRoot(userDataRoot, abs);
        await fsp.access(abs);
        return abs;
      }

      return null;
    };

    const extractKnownRelative = (p: string) => {
      const s = String(p || '').replace(/\\/g, '/');
      const markers = ['/Persons/', '/Properties/', '/Contracts/', '/Maintenance/', '/Sales/'];
      for (const m of markers) {
        const idx = s.toLowerCase().indexOf(m.toLowerCase());
        if (idx >= 0) return s.slice(idx + 1);
      }
      return null;
    };

    const looksAbsolute =
      path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\');

    if (looksAbsolute) {
      const okAbs = await tryAbsoluteWithinRoots(raw);
      if (okAbs) return okAbs;

      const relFromAbs = extractKnownRelative(raw);
      if (relFromAbs) {
        const okRel = await tryRelative(relFromAbs);
        if (okRel) return okRel;
      }

      throw new Error('Attachment file not found');
    }

    const okRel = await tryRelative(raw);
    if (okRel) return okRel;

    // Some sync/legacy values may have extra leading folders; attempt to recover.
    const relRecovered = extractKnownRelative(raw);
    if (relRecovered) {
      const okRel2 = await tryRelative(relRecovered);
      if (okRel2) return okRel2;
    }

    throw new Error('Attachment file not found');
  };

  const assertSafeIpcString = (value: unknown, label: string, maxLen = 2048): string => {
    const s = String(value ?? '');
    if (!s.trim()) throw new Error(`${label}: invalid`);
    if (s.length > maxLen) throw new Error(`${label}: too long`);
    // Defensive: reject null bytes
    if (s.includes('\u0000')) throw new Error(`${label}: invalid`);
    return s;
  };

  const getAttachmentRoots = async (): Promise<string[]> => {
    const stableRoot = await getAttachmentsRoot();
    const legacyRoot = getLegacyExeAttachmentsRoot();
    const userDataRoot = getLastResortAttachmentsRoot();

    const roots = [stableRoot];
    if (legacyRoot) roots.push(legacyRoot);
    if (userDataRoot && path.resolve(userDataRoot) !== path.resolve(stableRoot)) roots.push(userDataRoot);
    return roots;
  };

  const ensureRealpathWithinAttachmentRoots = async (absPath: string): Promise<void> => {
    const roots = await getAttachmentRoots();
    let real: string;
    try {
      real = await fsp.realpath(absPath);
    } catch {
      // If realpath fails (rare on Windows), fall back to absPath checks.
      real = absPath;
    }

    for (const r of roots) {
      try {
        ensureInsideRoot(r, real);
        return;
      } catch {
        // try next root
      }
    }
    throw new Error('Invalid attachment path');
  };

  const assertSafeAttachmentFile = async (absPath: string): Promise<void> => {
    const st = await fsp.lstat(absPath);
    if (st.isSymbolicLink()) throw new Error('Invalid attachment path');
    if (!st.isFile()) throw new Error('Invalid attachment path');
    await ensureRealpathWithinAttachmentRoots(absPath);
  };

  const isDangerousToOpenByDefault = (absPath: string): boolean => {
    const ext = path.extname(absPath).toLowerCase();
    // SECURITY: Block common executable, script, shortcut, and dangerous formats.
    // This list is maintained to prevent execution of potentially harmful files.
    return [
      // Windows executables
      '.exe',
      '.msi',
      '.com',
      '.scr',
      '.pif',
      '.gadget',
      // Script files
      '.bat',
      '.cmd',
      '.ps1',
      '.psm1',
      '.psd1',
      '.vbs',
      '.vbe',
      '.js',
      '.jse',
      '.ws',
      '.wsf',
      '.wsc',
      '.wsh',
      // Java/Compiled
      '.jar',
      '.class',
      // HTML Application
      '.hta',
      '.htm',  // Can contain malicious scripts if opened locally
      '.html', // Can contain malicious scripts if opened locally
      '.mht',
      '.mhtml',
      // Control Panel / System
      '.cpl',
      '.inf',
      '.ins',
      '.isp',
      // Shortcuts and links
      '.lnk',
      '.url',
      '.scf',
      '.desktop',
      // Registry
      '.reg',
      // Microsoft Office macros (can contain malicious code)
      '.docm',
      '.xlsm',
      '.pptm',
      '.dotm',
      '.xltm',
      '.potm',
      '.ppam',
      '.xlam',
      // Other dangerous formats
      '.appref-ms',
      '.application',
      '.chm',
      '.hlp',
      '.lib',
      '.dll',
      '.sys',
      '.drv',
      '.ocx',
    ].includes(ext);
  };

  const sanitizeSegment = (input: string, maxLen = 80): string => {
    const raw = String(input ?? '').trim();
    if (!raw) return 'غير_معروف';
    // Remove path separators and Windows-illegal characters
    const cleaned = raw
      .replace(/[\\/]+/g, '-')
      .replace(/[<>:"|?*]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove ASCII control chars (0..31) without using a control-regex range.
    let cleanedNoControl = '';
    for (let i = 0; i < cleaned.length; i++) {
      const code = cleaned.charCodeAt(i);
      if (code >= 32) cleanedNoControl += cleaned[i];
    }

    const safeRaw = cleanedNoControl || 'غير_معروف';
    const safe = safeRaw === '.' || safeRaw === '..' ? 'غير_معروف' : safeRaw;
    return safe.length > maxLen ? safe.slice(0, maxLen).trim() : safe;
  };

  const mimeFromExt = (extRaw: string): string => {
    const ext = (extRaw || '').toLowerCase().replace(/^\./, '');
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'bmp':
        return 'image/bmp';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/octet-stream';
    }
  };

  const makeTimestampPrefix = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}__${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  const chooseTypeFolder = (referenceType: string): string => {
    switch (String(referenceType || '').toLowerCase()) {
      case 'person':
        return 'Persons';
      case 'property':
        return 'Properties';
      case 'contract':
        return 'Contracts';
      case 'maintenance':
        return 'Maintenance';
      case 'sales':
        return 'Sales';
      default:
        return sanitizeSegment(referenceType || 'Other');
    }
  };

  ipcMain.handle(
    'attachments:save',
    async (
      _e,
      payload: {
        referenceType: string;
        entityFolder: string;
        originalFileName: string;
        bytes: ArrayBuffer | ArrayBufferView;
      }
    ) => {
      try {
        const root = await getAttachmentsRoot();
        const typeFolder = chooseTypeFolder(payload?.referenceType);
        const entityFolder = sanitizeSegment(payload?.entityFolder || 'غير_معروف');

        const bytes = payload?.bytes;
        const byteLen: number =
          bytes instanceof ArrayBuffer
            ? bytes.byteLength
            : ArrayBuffer.isView(bytes)
              ? bytes.byteLength
              : 0;
        if (!byteLen) return { success: false, message: 'المرفق غير صالح' };
        if (byteLen > MAX_ATTACHMENT_BYTES)
          return { success: false, message: 'حجم المرفق كبير جداً' };

        const dir = path.join(root, typeFolder, entityFolder);
        ensureInsideRoot(root, dir);
        await fsp.mkdir(dir, { recursive: true });

        const original = String(payload?.originalFileName || 'file');
        const originalSafe = sanitizeSegment(original, 140);
        const stamped = `${makeTimestampPrefix()}__${originalSafe}`;

        const baseName = stamped;
        const ext = path.extname(originalSafe);
        const stem = ext ? baseName.slice(0, -ext.length) : baseName;

        let candidate = baseName;
        let i = 1;
        while (true) {
          const abs = path.join(dir, candidate);
          ensureInsideRoot(root, abs);
          try {
            await fsp.access(abs);
            // exists
            candidate = `${stem} (${i++})${ext}`;
          } catch {
            break;
          }
        }

        const absPath = path.join(dir, candidate);
        ensureInsideRoot(root, absPath);

        const buf = (() => {
          if (bytes instanceof ArrayBuffer) return Buffer.from(new Uint8Array(bytes));
          if (!ArrayBuffer.isView(bytes)) return Buffer.from([]);
          const u8 =
            bytes instanceof Uint8Array
              ? bytes
              : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          return Buffer.from(u8);
        })();
        // Encrypt attachments at rest when backup encryption is enabled.
        // NOTE: We only encrypt on-disk; callers still reference the same relativePath.
        const encState = await getBackupEncryptionPasswordState();
        if (!encState.enabled) {
          await fsp.writeFile(absPath, buf);
        } else {
          if (!encState.configured || !encState.password) {
            return {
              success: false,
              message: 'تشفير البيانات مفعل لكن كلمة المرور غير مضبوطة. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.',
            };
          }
          await encryptBufferToFile({ bytes: buf, destPath: absPath, password: encState.password });
        }

        const relativePath = path.relative(root, absPath).split(path.sep).join('/');
        return { success: true, relativePath, filePath: absPath, storedFileName: candidate };
      } catch (err: unknown) {
        return { success: false, message: toErrorMessage(err, 'Failed to save attachment') };
      }
    }
  );

  ipcMain.handle('attachments:read', async (_e, relativePath: string) => {
    try {
      const safeRel = assertSafeIpcString(relativePath, 'relativePath');
      const abs = await resolveExistingAttachmentAbsPath(safeRel);
      await assertSafeAttachmentFile(abs);
      const st = await fsp.stat(abs);
      // Allow a tiny overhead for encrypted-at-rest files.
      if (st.size > MAX_ATTACHMENT_BYTES + 256) {
        return { success: false, message: 'حجم الملف كبير جداً' };
      }
      const looksEncrypted = await isEncryptedFile(abs);
      const data = looksEncrypted
        ? await (async () => {
            const s = await readBackupEncryptionSettings();
            const password = s.passwordEnc ? decryptSecretBestEffort(String(s.passwordEnc || '')) : '';
            if (!password) throw new Error('لا توجد كلمة مرور لفك تشفير المرفقات. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.');
            return await decryptFileToBuffer({ sourcePath: abs, password, maxBytes: MAX_ATTACHMENT_BYTES });
          })()
        : await fsp.readFile(abs);
      const ext = path.extname(abs);
      const mime = mimeFromExt(ext);
      const dataUri = `data:${mime};base64,${data.toString('base64')}`;
      return { success: true, dataUri };
    } catch (err: unknown) {
      logger.warn('[IPC][attachments:read] blocked/failed', toErrorMessage(err, 'فشل قراءة المرفق'));
      return { success: false, message: toErrorMessage(err, 'Failed to read attachment') };
    }
  });

  ipcMain.handle('attachments:delete', async (_e, relativePath: string) => {
    try {
      const safeRel = assertSafeIpcString(relativePath, 'relativePath');
      const abs = await resolveExistingAttachmentAbsPath(safeRel);
      await assertSafeAttachmentFile(abs);
      await fsp.unlink(abs);
      return { success: true };
    } catch (err: unknown) {
      logger.warn('[IPC][attachments:delete] blocked/failed', toErrorMessage(err, 'Failed to delete attachment'));
      return { success: false, message: toErrorMessage(err, 'Failed to delete attachment') };
    }
  });

  ipcMain.handle('attachments:open', async (_e, relativePath: string) => {
    try {
      const safeRel = assertSafeIpcString(relativePath, 'relativePath');
      const abs = await resolveExistingAttachmentAbsPath(safeRel);
      await assertSafeAttachmentFile(abs);

      if (isDangerousToOpenByDefault(abs)) {
        logger.warn('[IPC][attachments:open] blocked dangerous file type', abs);
        return { success: false, message: 'تم حظر فتح هذا النوع من الملفات لأسباب أمنية' };
      }

      const looksEncrypted = await isEncryptedFile(abs);
      const toOpen = !looksEncrypted
        ? abs
        : await (async () => {
            const s = await readBackupEncryptionSettings();
            const password = s.passwordEnc ? decryptSecretBestEffort(String(s.passwordEnc || '')) : '';
            if (!password) {
              throw new Error('لا توجد كلمة مرور لفك تشفير المرفقات. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.');
            }
            const ext = path.extname(abs);
            const tmp = path.join(app.getPath('temp'), `AZRAR-attachment-open-${Date.now()}${ext || ''}`);
            await decryptFileToFile({ sourcePath: abs, destPath: tmp, password });
            // Best-effort cleanup after some time (do not fail open if cleanup fails).
            setTimeout(() => {
              void fsp.unlink(tmp).catch(() => undefined);
            }, 10 * 60 * 1000);
            return tmp;
          })();

      const errMsg = await shell.openPath(toOpen);
      if (errMsg) return { success: false, message: String(errMsg) };
      return { success: true };
    } catch (err: unknown) {
      logger.warn('[IPC][attachments:open] blocked/failed', toErrorMessage(err, 'Failed to open attachment'));
      return { success: false, message: toErrorMessage(err, 'Failed to open attachment') };
    }
  });

  ipcMain.handle('attachments:pullNow', async () => {
    try {
      const raw = kvGet('db_attachments');
      const json = typeof raw === 'string' && raw.trim() ? raw : '[]';
      const res = await pullAttachmentFilesForAttachmentsJson(json);
      return { success: true, ...res };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'فشل تنزيل المرفقات') };
    }
  });

  // Word templates
  type WordTemplateType = 'contracts' | 'installments' | 'handover';

  type StoredWordTemplate = {
    /** Stable ID for the template (part of the KV key). */
    key: string;
    templateType: WordTemplateType;
    fileName: string;
    bytesBase64: string;
    size: number;
    sha256?: string;
    updatedAt: string;
  };

  const WORD_TEMPLATE_KV_PREFIX = 'db_word_template_';

  const templateKvKeyPrefixFor = (t: WordTemplateType) => `${WORD_TEMPLATE_KV_PREFIX}${t}_`;
  const makeTemplateKvKey = (t: WordTemplateType, key: string) => `${WORD_TEMPLATE_KV_PREFIX}${t}_${key}`;

  const safeJsonParseStoredWordTemplate = (raw: string): StoredWordTemplate | null => {
    const s = String(raw || '').trim();
    if (!s) return null;
    try {
      const parsed = JSON.parse(s) as unknown;
      if (!isRecord(parsed)) return null;

      const rec = parsed as Record<string, unknown>;
      const key = String(rec.key ?? '').trim();
      const templateType = normalizeTemplateType(rec.templateType);
      const fileName = path.basename(String(rec.fileName ?? '').trim());
      const bytesBase64 = String(rec.bytesBase64 ?? '').trim();
      const size = Number(rec.size ?? 0);
      const sha256 = String(rec.sha256 ?? '').trim() || undefined;
      const updatedAt = String(rec.updatedAt ?? '').trim() || new Date().toISOString();

      if (!key || !fileName || !fileName.toLowerCase().endsWith('.docx')) return null;
      if (!bytesBase64) return null;
      if (!Number.isFinite(size) || size <= 0 || size > MAX_TEMPLATE_BYTES) return null;

      return { key, templateType, fileName, bytesBase64, size, sha256, updatedAt };
    } catch {
      return null;
    }
  };

  const listStoredTemplatesFor = (t: WordTemplateType): Array<{ kvKey: string; item: StoredWordTemplate }> => {
    try {
      const prefix = templateKvKeyPrefixFor(t);
      const keys = (kvKeys?.() || []).filter((k) => String(k || '').startsWith(prefix));
      const out: Array<{ kvKey: string; item: StoredWordTemplate }> = [];
      for (const k of keys) {
        try {
          const raw = kvGet(k);
          const item = safeJsonParseStoredWordTemplate(typeof raw === 'string' ? raw : '');
          if (item && item.templateType === t) out.push({ kvKey: k, item });
        } catch {
          // ignore
        }
      }
      return out;
    } catch {
      return [];
    }
  };

  const setKvAndPushUpsert = (k: string, v: string, updatedAt: string) => {
    kvSetWithUpdatedAt(k, v, updatedAt);
    void pushKvUpsert({ key: k, value: v, updatedAt }).catch(() => void 0);
  };

  const deleteKvAndPushDelete = (k: string) => {
    kvDelete(k);
    const deletedAt = kvGetDeletedAt(k) || new Date().toISOString();
    void pushKvDelete({ key: k, deletedAt }).catch(() => void 0);
  };

  const sha256Hex = (buf: Buffer): string => crypto.createHash('sha256').update(buf).digest('hex');

  const materializeTemplateFileFromStored = async (templatesDir: string, stored: StoredWordTemplate) => {
    const safeName = path.basename(stored.fileName);
    if (!safeName.toLowerCase().endsWith('.docx')) throw new Error('القالب يجب أن يكون ملف Word (.docx)');
    if (!stored.bytesBase64) throw new Error('القالب غير صالح');

    const abs = path.join(templatesDir, safeName);
    try {
      const st = await fsp.stat(abs);
      if (st.isFile() && st.size > 0) return abs;
    } catch {
      // ignore
    }

    const buf = Buffer.from(stored.bytesBase64, 'base64');
    if (!buf || buf.byteLength <= 0) throw new Error('القالب غير صالح');
    if (buf.byteLength > MAX_TEMPLATE_BYTES) throw new Error('حجم القالب كبير جداً');

    await fsp.writeFile(abs, buf);
    return abs;
  };

  const normalizeTemplateType = (raw: unknown): WordTemplateType => {
    const v = String(raw || '').trim().toLowerCase();
    if (v === 'contracts') return 'contracts';
    if (v === 'installments') return 'installments';
    if (v === 'handover') return 'handover';
    return 'contracts';
  };

  const templateTypeLabelAr = (t: WordTemplateType) => {
    if (t === 'contracts') return 'العقود';
    if (t === 'installments') return 'الكمبيالات';
    return 'محضر التسليم';
  };

  const templateFallbackFolder = (t: WordTemplateType) => {
    if (t === 'contracts') return 'العقود الورد';
    if (t === 'installments') return 'الكمبيالات الورد';
    return 'محضر التسليم الورد';
  };

  const getTemplatesDir = async (templateType: WordTemplateType) => {
    // Put templates next to the DB file. In server/LAN setups this can be a shared folder
    // by setting AZRAR_DESKTOP_DB_DIR or AZRAR_DESKTOP_DB_PATH.
    const dir = path.join(path.dirname(getDbPath()), 'templates', templateType);
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  };

  const ensureUniqueFileName = async (dir: string, fileName: string) => {
    const ext = path.extname(fileName);
    const stem = ext ? fileName.slice(0, -ext.length) : fileName;
    let candidate = fileName;
    let i = 1;
    while (true) {
      const abs = path.join(dir, candidate);
      try {
        await fsp.access(abs);
        candidate = `${stem} (${i++})${ext}`;
      } catch {
        return candidate;
      }
    }
  };

  ipcMain.handle('templates:list', async (_e, payload?: { templateType?: string }) => {
    try {
      const templateType = normalizeTemplateType(payload?.templateType);
      const dir = await getTemplatesDir(templateType);
      const nowIso = new Date().toISOString();

      // 1) Load stored templates for this type (synced via KV/SQL)
      const stored = listStoredTemplatesFor(templateType);

      // 2) Ensure local files exist for stored templates (materialize missing ones)
      for (const s of stored) {
        try {
          await materializeTemplateFileFromStored(dir, s.item);
        } catch {
          // ignore
        }
      }

      // 3) Read local templates
      const items = await fsp.readdir(dir);
      const localDocx = items.filter((x) => x.toLowerCase().endsWith('.docx'));

      // 4) Migrate any local templates missing from KV into KV (one-time self-heal)
      const storedByName = new Map<string, { kvKey: string; item: StoredWordTemplate }>();
      for (const s of stored) storedByName.set(String(s.item.fileName).toLowerCase(), s);

      for (const fileName of localDocx) {
        const lower = String(fileName).toLowerCase();
        if (storedByName.has(lower)) continue;

        try {
          const abs = path.join(dir, fileName);
          const st = await fsp.stat(abs);
          if (!st.isFile() || st.size <= 0 || st.size > MAX_TEMPLATE_BYTES) continue;
          const buf = await fsp.readFile(abs);
          if (!buf || buf.byteLength <= 0 || buf.byteLength > MAX_TEMPLATE_BYTES) continue;

          const key = crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const kvKey = makeTemplateKvKey(templateType, key);
          const item: StoredWordTemplate = {
            key,
            templateType,
            fileName,
            bytesBase64: Buffer.from(buf).toString('base64'),
            size: buf.byteLength,
            sha256: sha256Hex(buf),
            updatedAt: nowIso,
          };
          setKvAndPushUpsert(kvKey, JSON.stringify(item), nowIso);
          storedByName.set(lower, { kvKey, item });
        } catch {
          // ignore
        }
      }

      // 5) Return union of filenames (local + stored)
      const allNames = new Set<string>();
      for (const n of localDocx) allNames.add(n);
      for (const s of storedByName.values()) allNames.add(s.item.fileName);
      const docx = Array.from(allNames).filter((x) => String(x).toLowerCase().endsWith('.docx'));

      const details = docx
        .map((fileName) => {
          const hit = storedByName.get(String(fileName).toLowerCase());
          return {
            fileName,
            kvKey: hit?.kvKey,
            key: hit?.item?.key,
            updatedAt: hit?.item?.updatedAt,
          };
        })
        .sort((a, b) => String(a.fileName).localeCompare(String(b.fileName)));

      return { success: true, items: docx, details, dir, templateType };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to list templates') };
    }
  });

  ipcMain.handle('templates:import', async (e, payload?: { templateType?: string }) => {
    try {
      const templateType = normalizeTemplateType(payload?.templateType);

      const userId = getSessionUserId(e.sender);
      const allowed =
        desktopUserHasPermission(userId, 'PRINT_TEMPLATES_EDIT') ||
        desktopUserHasPermission(userId, 'SETTINGS_ADMIN');
      if (!allowed) return { success: false, message: 'ليس لديك صلاحية إدارة قوالب الطباعة' };

      const result = await dialog.showOpenDialog({
        title: `اختر قالب Word لـ ${templateTypeLabelAr(templateType)}`,
        properties: ['openFile'],
        filters: [{ name: 'Word (.docx)', extensions: ['docx'] }],
      });
      if (result.canceled || result.filePaths.length === 0)
        return { success: false, message: 'تم الإلغاء' };

      const selected = result.filePaths[0];
      if (!selected) return { success: false, message: 'مسار الملف غير صالح' };

      const resolved = await fsp.realpath(selected).catch(() => path.resolve(selected));
      if (isUncPath(resolved))
        return { success: false, message: 'غير مسموح استيراد القالب من مسار شبكة (UNC)' };

      const st = await fsp.stat(resolved);
      if (!st.isFile()) return { success: false, message: 'الملف غير صالح' };
      if (st.size <= 0) return { success: false, message: 'الملف فارغ' };
      if (st.size > MAX_TEMPLATE_BYTES) return { success: false, message: 'حجم القالب كبير جداً' };

      const safeName = path.basename(resolved);
      if (!safeName.toLowerCase().endsWith('.docx'))
        return { success: false, message: 'الملف يجب أن يكون .docx' };

      const dir = await getTemplatesDir(templateType);
      const uniqueName = await ensureUniqueFileName(dir, safeName);
      const dest = path.join(dir, uniqueName);
      await fsp.copyFile(resolved, dest);

      // Persist the template bytes in KV so it gets a stable key and syncs to SQL.
      try {
        const nowIso = new Date().toISOString();
        const buf = await fsp.readFile(dest);
        if (buf && buf.byteLength > 0 && buf.byteLength <= MAX_TEMPLATE_BYTES) {
          const key = crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const kvKey = makeTemplateKvKey(templateType, key);
          const item: StoredWordTemplate = {
            key,
            templateType,
            fileName: uniqueName,
            bytesBase64: Buffer.from(buf).toString('base64'),
            size: buf.byteLength,
            sha256: sha256Hex(buf),
            updatedAt: nowIso,
          };
          setKvAndPushUpsert(kvKey, JSON.stringify(item), nowIso);
        }
      } catch {
        // ignore (file is still imported locally)
      }

      return { success: true, fileName: uniqueName, dir, templateType };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to import template') };
    }
  });

  ipcMain.handle('templates:read', async (_e, payload: { templateName: string; templateType?: string }) => {
    try {
      const rawName = String(payload?.templateName || '').trim();
      const templateType = normalizeTemplateType(payload?.templateType);
      const templatesDir = await getTemplatesDir(templateType);

      let safeName = path.basename(rawName);
      if (!safeName) {
        // If not provided, try auto-pick when there is exactly one template
        try {
          const items = (await fsp.readdir(templatesDir)).filter((x) =>
            x.toLowerCase().endsWith('.docx')
          );
          if (items.length === 1) safeName = items[0];
        } catch {
          // ignore
        }
      }
      if (!safeName) return { success: false, message: 'اسم القالب غير صالح' };

      if (!safeName.toLowerCase().endsWith('.docx')) {
        return { success: false, message: 'القالب يجب أن يكون ملف Word (.docx)' };
      }

      const candidates = [
        // Preferred: user-imported templates
        path.join(templatesDir, safeName),
        // Dev/workspace
        path.join(process.cwd(), templateFallbackFolder(templateType), safeName),
        // Packaged resources path (best-effort)
        path.join(app.getAppPath(), templateFallbackFolder(templateType), safeName),
        // Beside the installed EXE (portable/installed)
        path.join(path.dirname(app.getPath('exe')), templateFallbackFolder(templateType), safeName),
      ];

      let found: string | null = null;
      for (const p of candidates) {
        try {
          if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            found = p;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (!found) {
        // If the file isn't available locally, try to reconstruct it from KV (synced from SQL).
        try {
          const stored = listStoredTemplatesFor(templateType);
          const hit = stored.find((s) => String(s.item.fileName).toLowerCase() === safeName.toLowerCase());
          if (hit) {
            const abs = await materializeTemplateFileFromStored(templatesDir, hit.item);
            found = abs;
          }
        } catch {
          // ignore
        }

        if (!found) {
          return {
            success: false,
            message: `لم يتم العثور على قالب Word: ${safeName}. يمكنك استيراد القالب من داخل البرنامج وسيتم حفظه تلقائياً داخل مجلد النظام: templates/${templateType}`,
          };
        }
      }

      const resolvedFound = await fsp.realpath(found).catch(() => found);
      const allowedRoots = [
        templatesDir,
        path.join(process.cwd(), templateFallbackFolder(templateType)),
        path.join(app.getAppPath(), templateFallbackFolder(templateType)),
        path.join(path.dirname(app.getPath('exe')), templateFallbackFolder(templateType)),
      ];

      const isInsideAnyRoot = allowedRoots.some((root) => {
        try {
          const rootResolved = path.resolve(root);
          const targetResolved = path.resolve(resolvedFound);
          const rel = path.relative(rootResolved, targetResolved);
          if (!rel || rel === '.') return true;
          return !rel.startsWith('..') && !path.isAbsolute(rel);
        } catch {
          return false;
        }
      });

      if (!isInsideAnyRoot) {
        return { success: false, message: 'مسار القالب غير صالح' };
      }

      const st = await fsp.stat(resolvedFound);
      if (!st.isFile()) return { success: false, message: 'القالب غير صالح' };
      if (st.size <= 0) return { success: false, message: 'القالب فارغ' };
      if (st.size > MAX_TEMPLATE_BYTES) return { success: false, message: 'حجم القالب كبير جداً' };

      const buf = await fsp.readFile(resolvedFound);
      if (buf.byteLength > MAX_TEMPLATE_BYTES) {
        return { success: false, message: 'حجم القالب كبير جداً' };
      }

      const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const dataUri = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
      return { success: true, dataUri, fileName: safeName };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to read template') };
    }
  });

  ipcMain.handle('templates:delete', async (_e, payload: { templateName: string; templateType?: string }) => {
    try {
      const rawName = String(payload?.templateName || '').trim();
      const templateType = normalizeTemplateType(payload?.templateType);
      const templatesDir = await getTemplatesDir(templateType);

      const safeName = path.basename(rawName);
      if (!safeName) return { success: false, message: 'اسم القالب غير صالح' };
      if (!safeName.toLowerCase().endsWith('.docx')) {
        return { success: false, message: 'القالب يجب أن يكون ملف Word (.docx)' };
      }

      const abs = path.join(templatesDir, safeName);
      const resolvedAbs = await fsp.realpath(abs).catch(() => abs);

      // Ensure deletion only inside the template type directory.
      const templatesDirResolved = await fsp.realpath(templatesDir).catch(() => templatesDir);
      const rel = path.relative(templatesDirResolved, resolvedAbs);
      if (!rel || rel === '.') {
        return { success: false, message: 'مسار القالب غير صالح' };
      }
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return { success: false, message: 'مسار القالب غير صالح' };
      }

      await fsp.unlink(resolvedAbs);

      // Remove from KV store (synced) if present.
      try {
        const stored = listStoredTemplatesFor(templateType);
        const hit = stored.find((s) => String(s.item.fileName).toLowerCase() === safeName.toLowerCase());
        if (hit) {
          deleteKvAndPushDelete(hit.kvKey);
        }
      } catch {
        // ignore
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = toErrorMessage(err, 'Failed to delete template');

      if (/ENOENT/i.test(msg)) {
        return { success: false, message: 'القالب غير موجود (ربما تم حذفه مسبقاً)' };
      }
      if (/EPERM|EBUSY/i.test(msg)) {
        return {
          success: false,
          message: 'تعذر حذف القالب (قد يكون مفتوحاً في Word). أغلقه ثم أعد المحاولة.',
        };
      }
      return { success: false, message: msg };
    }
  });

  // Start local auto-backup scheduler (best-effort).
  startLocalAutoBackupScheduler();

  ipcMain.handle('print:engine:run', async (e, job: PrintEngineJob) => {
    const userId = getSessionUserId(e.sender);
    const required = requiredPrintPermissionForJob(job);
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

      const userId = getSessionUserId(e.sender);

      // Phase 10: unified dispatch (no print logic in renderer; only metadata + routing).
      if (action === 'printCurrentView') {
        const allowed = desktopUserHasPermission(userId, 'PRINT_EXECUTE');
        if (!allowed) return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنفيذ الطباعة' };

        // We intentionally ignore documentType/entityId/data here (for now) but we require them
        // so every UI entry-point sends consistent metadata.
        void documentType;
        void entityId;
        void r.data;

        return await printEngine.run({ type: 'currentView', mode: 'print' }, { webContents: e.sender });
      }

      if (action === 'printText') {
        const allowed = desktopUserHasPermission(userId, 'PRINT_EXECUTE');
        if (!allowed) return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنفيذ الطباعة' };

        const text = typeof r.text === 'string' ? String(r.text) : '';
        const title = typeof r.title === 'string' ? String(r.title) : undefined;
        if (!text.trim()) return { ok: false, code: 'INVALID', message: 'النص فارغ' };

        void documentType;
        void entityId;
        void r.data;

        return await printEngine.run({ type: 'text', mode: 'print', payload: { title, text } }, { webContents: e.sender });
      }

      if (action === 'generate') {
        const templateName = typeof r.templateName === 'string' ? String(r.templateName) : undefined;
        const outputType = r.outputType === 'pdf' || r.outputType === 'docx' ? (r.outputType as 'pdf' | 'docx') : undefined;
        const defaultFileName = typeof r.defaultFileName === 'string' ? String(r.defaultFileName) : undefined;
        const data = (r.data && typeof r.data === 'object') ? (r.data as Record<string, unknown>) : undefined;
        const headerFooter = (r.headerFooter && typeof r.headerFooter === 'object') ? (r.headerFooter as Record<string, unknown>) : undefined;

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

        const required = requiredPrintPermissionForJob(job);
        if (!desktopUserHasPermission(userId, required)) {
          return { ok: false, code: 'FORBIDDEN', message: 'غير مصرح لك باستخدام الطباعة/التصدير' };
        }

        void documentType;
        void entityId;
        return await printEngine.run(job, { webContents: e.sender });
      }

      if (action === 'exportDocx') {
        const templateName = typeof r.templateName === 'string' ? String(r.templateName) : undefined;
        const defaultFileName = typeof r.defaultFileName === 'string' ? String(r.defaultFileName) : undefined;
        const data = (r.data && typeof r.data === 'object') ? (r.data as Record<string, unknown>) : undefined;
        const headerFooter = (r.headerFooter && typeof r.headerFooter === 'object') ? (r.headerFooter as Record<string, unknown>) : undefined;
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

        const required = requiredPrintPermissionForJob(job);
        if (!desktopUserHasPermission(userId, required)) {
          return { ok: false, code: 'FORBIDDEN', message: 'غير مصرح لك باستخدام الطباعة/التصدير' };
        }

        void documentType;
        void entityId;
        return await printEngine.run(job, { webContents: e.sender });
      }

      return { ok: false, code: 'INVALID', message: 'إجراء الطباعة غير معروف' };
    } catch (err: unknown) {
      return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل تنفيذ طلب الطباعة') };
    }
  });

  ipcMain.handle('print:preview:open', async (e, payload: unknown) => {
    const { openPrintPreview } = await import('./printing/preview/previewManager');
    const userId = getSessionUserId(e.sender);
    return openPrintPreview(payload as never, { userId });
  });

  ipcMain.handle('print:preview:getState', async (_e, sessionId: unknown) => {
    const { getPrintPreviewState } = await import('./printing/preview/previewManager');
    return getPrintPreviewState(String(sessionId ?? ''));
  });

  ipcMain.handle('print:preview:listPrinters', async (e) => {
    const { listPreviewPrinters } = await import('./printing/preview/previewManager');
    return listPreviewPrinters(e.sender);
  });

  ipcMain.handle('print:preview:print', async (_e, sessionId: unknown, options?: unknown) => {
    const { printFromPreview } = await import('./printing/preview/previewManager');
    return printFromPreview(String(sessionId ?? ''), (options as never) || undefined);
  });

  ipcMain.handle('print:preview:exportPdf', async (_e, sessionId: unknown) => {
    const { exportPdfFromPreview } = await import('./printing/preview/previewManager');
    return exportPdfFromPreview(String(sessionId ?? ''));
  });

  ipcMain.handle('print:preview:exportDocx', async (_e, sessionId: unknown) => {
    const { exportDocxFromPreview } = await import('./printing/preview/previewManager');
    return exportDocxFromPreview(String(sessionId ?? ''));
  });

  ipcMain.handle('print:preview:reload', async (_e, sessionId: unknown) => {
    const { reloadPreview } = await import('./printing/preview/previewManager');
    return reloadPreview(String(sessionId ?? ''));
  });

  ipcMain.handle('print:settings:get', async () => {
    return loadPrintSettings();
  });

  ipcMain.handle('print:settings:save', async (e, settings: unknown) => {
    const userId = getSessionUserId(e.sender);
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
      return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل تحديد مسار إعدادات الطباعة') };
    }
  });
}
