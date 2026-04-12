import { dialog, app, BrowserWindow } from 'electron';
import {
  kvApplyRemoteDelete,
  kvGet,
  kvGetDeletedAt,
  kvGetMeta,
  kvKeys,
  kvListDeletedSince,
  kvListUpdatedSince,
  kvSet,
  kvSetWithUpdatedAt,
  getDbPath,
  exportDatabaseToMany,
  importDatabase,
} from '../db';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import updaterPkg from 'electron-updater';
import {
  connectAndEnsureDatabase,
  loadSqlSettings,
  logSyncError,
  pullAttachmentFilesForAttachmentsJson,
  pushKvDelete,
  pushKvUpsert,
  startBackgroundPull,
} from '../sqlSync';
import type { PrintEngineJob } from '../printing';
import logger from '../logger';
import { toErrorMessage } from '../utils/errors';
import { isRecord } from '../utils/unknown';
import { safeJsonParseArray } from '../utils/json';
import {
  decryptFileToBuffer,
  decryptFileToFile,
  encryptBufferToFile,
  encryptFileToFile,
  isEncryptedFile,
} from '../utils/fileEncryption';
import * as tar from 'tar';
import { getBackupEncryptionPasswordState } from '../utils/backupEncryptionSettings';

export const getField = (obj: unknown, field: string): unknown => (isRecord(obj) ? obj[field] : undefined);

export const getStringField = (obj: unknown, field: string): string => String(getField(obj, field) ?? '');

export const getNumberField = (obj: unknown, field: string): number => {
  const n = Number(getField(obj, field));
  return Number.isFinite(n) ? n : 0;
};

export const getOptionalNumberField = (obj: unknown, field: string): number | undefined => {
  const raw = getField(obj, field);
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

export type DomainEntity = 'people' | 'properties' | 'contracts';
export const isDomainEntity = (v: string): v is DomainEntity =>
  v === 'people' || v === 'properties' || v === 'contracts';

export const sessionUserByWebContentsId = new Map<number, string>();

export const getSessionUserId = (sender: Electron.WebContents | undefined | null): string | undefined => {
  const id = sender?.id;
  if (!id || !Number.isFinite(id)) return undefined;
  const userId = sessionUserByWebContentsId.get(id);
  return userId ? String(userId) : undefined;
};

export const requiredPrintPermissionForJob = (job: PrintEngineJob): string => {
  switch (job.type) {
    case 'currentView':
    case 'text':
    case 'printHtml':
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

/**
 * Combined logic for importing a database file, potentially decrypting it first.
 */
export async function importDatabaseFrom(sourcePath: string, password?: string): Promise<void> {
  let finalPath = sourcePath;
  let tmpPath: string | null = null;

  try {
    const isEnc = await isEncryptedFile(sourcePath);
    if (isEnc) {
      if (!password) {
        throw new Error('الملف مشفر ولكن لم يتم توفير كلمة مرور.');
      }
      tmpPath = sourcePath + '.tmp-decrypted';
      await decryptFileToFile({ sourcePath, destPath: tmpPath, password });
      finalPath = tmpPath;
    }

    await importDatabase(finalPath);
  } finally {
    if (tmpPath) {
      try {
        await fsp.unlink(tmpPath);
      } catch {
        // ignore
      }
    }
  }
}

export type FspCpOptions = { recursive: boolean; force: boolean };
export type FspCpFn = (src: string, dest: string, options: FspCpOptions) => Promise<void>;

export const fspCp = async (src: string, dest: string, options: FspCpOptions): Promise<void> => {
  const cp = (fsp as unknown as { cp?: FspCpFn }).cp;
  if (!cp) throw new Error('خاصية النسخ غير مدعومة (fs.promises.cp)');
  await cp(src, dest, options);
};

export type UpdaterSetFeedUrlArg = Parameters<NonNullable<typeof autoUpdater>['setFeedURL']>[0];

// electron-updater is CommonJS; when loaded from ESM bundles, Node may not support named exports.
// Access it through the default export (module.exports).
export type ElectronUpdaterModule = { autoUpdater?: typeof import('electron-updater').autoUpdater };
export const autoUpdater = (updaterPkg as unknown as ElectronUpdaterModule)?.autoUpdater;

export type PendingRestoreInfo = {
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

export type UpdaterEventPayload = {
  type: string;
  message?: string;
  data?: unknown;
};

export let lastUpdaterEvent: UpdaterEventPayload | null = null;
export let currentFeedUrl: string | null =
  process.env.AZRAR_UPDATE_URL || process.env.AZRAR_UPDATES_URL || null;

// No default update server URL.
// Updates are enabled only when configured via env vars, saved settings, or embedded app-update.yml.
export const DEFAULT_PACKAGED_FEED_URL: string | null = null;

export type UpdaterSettings = {
  feedUrl?: string;
};

export type SqlSyncLogEntry = {
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

export type SqlCoverageItem = {
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

export const SQL_SYNC_LOG_LIMIT = 1000;
export const sqlSyncLog: SqlSyncLogEntry[] = [];

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_INSTALLER_BYTES = 500 * 1024 * 1024;
export const MAX_DB_IMPORT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
export const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;
export const MAX_JSON_BACKUP_BYTES = 500 * 1024 * 1024; // 500MB

export const DB_KEYS = {
  PEOPLE: 'db_people',
  COMPANIES: 'db_companies',
  CONTACTS: 'db_contacts',
  ROLES: 'db_roles',
  PROPERTIES: 'db_properties',
  CONTRACTS: 'db_contracts',
  /** كمبيالات / جدول الدفعات — يجب أن يطابق KEYS.INSTALLMENTS ومسار المزامنة */
  INSTALLMENTS: 'db_installments',
  COMMISSIONS: 'db_commissions',
  USERS: 'db_users',
  USER_PERMISSIONS: 'db_user_permissions',
  ALERTS: 'db_alerts',
  MAINTENANCE: 'db_maintenance_tickets',
  LOOKUPS: 'db_lookups',
  LOOKUP_CATEGORIES: 'db_lookup_categories',
  SETTINGS: 'db_settings',
  LOGS: 'db_operations',
  BLACKLIST: 'db_blacklist',
  DYNAMIC_TABLES: 'db_dynamic_tables',
  DYNAMIC_RECORDS: 'db_dynamic_records',
  DYNAMIC_FORM_FIELDS: 'db_dynamic_form_fields',
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
  LEGAL_TEMPLATES: 'db_legal_templates',
  LEGAL_HISTORY: 'db_legal_history',
  MARQUEE: 'db_marquee',
  DASHBOARD_CONFIG: 'db_dashboard_config',
  CLEARANCE_RECORDS: 'db_clearance_records',
  DASHBOARD_NOTES: 'db_dashboard_notes',
  CLIENT_INTERACTIONS: 'db_client_interactions',
  NOTIFICATION_SEND_LOGS: 'db_notification_send_logs',
  SMART_BEHAVIOR: 'db_smart_behavior',
  SCHEDULED_REPORTS_CONFIG: 'db_scheduled_reports_config',
  AUDIT_LOG: 'db_audit_log',
  MESSAGE_TEMPLATES: 'db_message_templates',
} as const;

export const kvGetArray = (key: string): unknown[] => safeJsonParseArray(kvGet(key));

export const kvSetArray = (key: string, items: unknown[]): void => {
  kvSet(key, JSON.stringify(items ?? []));
};

export const mergeRecords = (base: unknown, patch: unknown): unknown => {
  if (!isRecord(base)) return isRecord(patch) ? patch : base;
  if (!isRecord(patch)) return base;
  return { ...base, ...patch };
};

export const isUncPath = (p: string): boolean => {
  const s = String(p || '');
  return s.startsWith('\\\\') || s.startsWith('//');
};

export const getBetterSqlite3RebuildHint = (e: unknown): string | null => {
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

export type AuthenticodeVerification =
  | { ok: true; status: 'Valid'; subject?: string; thumbprint?: string; statusMessage?: string }
  | {
      ok: false;
      status?: string;
      subject?: string;
      thumbprint?: string;
      statusMessage?: string;
      message: string;
    };

export function verifyWindowsExeAuthenticodeSync(filePath: string): AuthenticodeVerification {
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

export const trimString = (value: unknown, maxLen: number, fieldLabel: string): string => {
  const s = String(value ?? '').trim();
  if (s.length > maxLen) throw new Error(`${fieldLabel} طويل جداً`);
  return s;
};

export const safePortOrDefault = (value: unknown, fallback = 1433): number => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const p = Math.trunc(n);
  if (p < 1 || p > 65535) return fallback;
  return p;
};

export const toLimitedPassword = (value: unknown, maxLen = 512): string => {
  if (typeof value !== 'string') return '';
  if (value.length > maxLen) throw new Error('كلمة المرور طويلة جداً');
  return value;
};

export function addSqlSyncLogEntry(
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
export let dbMaintenanceMode = false;
export let restoreInProgress = false;

export type SqlPullApplyResult = 'upsert' | 'delete' | 'skipped';

export async function applySqlRemoteKvRow(row: {
  k: string;
  v: string;
  updatedAt: string;
  isDeleted: boolean;
}): Promise<SqlPullApplyResult> {
  const localMeta = kvGetMeta(row.k);
  const localDeletedAt = kvGetDeletedAt(row.k);
  const localBestTs = localDeletedAt || localMeta?.updatedAt || '';

  const remoteTs = row.updatedAt;
  const isRemoteNewer =
    !localBestTs || new Date(remoteTs).getTime() > new Date(localBestTs).getTime();
  if (!isRemoteNewer) return 'skipped';

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
    return 'delete';
  }

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

  return 'upsert';
}

export async function startSqlPullLoop(): Promise<void> {
  await startBackgroundPull(
    async (row) => {
      await applySqlRemoteKvRow(row);
    },
    { runImmediately: true }
  );
}

export async function pushAllLocalToRemote(): Promise<{
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

export async function pushDeltaToRemoteSince(
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

export let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
export let autoSyncInFlight = false;
export let lastAutoPushIso: string = '';

export function startAutoSyncPushLoop() {
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
      } catch (err: unknown) {
        logSyncError('autoSync:push', err);
      } finally {
        autoSyncInFlight = false;
      }
    })();
  }, intervalMs);
}

export function broadcastDbRemoteUpdate(payload: {
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

export function broadcastUpdaterEvent(payload: UpdaterEventPayload) {
  lastUpdaterEvent = payload;
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('updater:event', payload);
    } catch {
      // ignore
    }
  }
}

export function getUpdateHostAllowlist(): string[] {
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

export function hostnameMatchesAllowlist(hostnameRaw: string, allowlist: string[]): boolean {
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

export function isPrivateHost(hostnameRaw: string): boolean {
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

export function normalizeFeedUrl(urlRaw: string): string {
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

export function hasEmbeddedUpdaterConfig(): boolean {
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

export function getUpdaterSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'updater-settings.json');
}

export function readUpdaterSettingsSync(): UpdaterSettings {
  try {
    const raw = fs.readFileSync(getUpdaterSettingsFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as UpdaterSettings;
  } catch {
    return {};
  }
}

export async function writeUpdaterSettings(next: UpdaterSettings): Promise<void> {
  const filePath = getUpdaterSettingsFilePath();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
}

export function configureUpdaterIfPossible() {
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

export function getUpdateStateFilePath(): string {
  return path.join(app.getPath('userData'), 'update-state.json');
}

export function getBackupSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'backup-settings.json');
}

export type BackupSettings = {
  backupDir?: string;
};

export type LocalBackupAutomationSettings = {
  v: 1;
  enabled?: boolean;
  timeHHmm?: string; // local time, e.g. "02:00"
  retentionDays?: number;
  lastRunAt?: string; // ISO
  updatedAt?: string; // ISO
};

export type LocalBackupLogEntry = {
  ts: string; // ISO
  ok: boolean;
  trigger: 'auto' | 'manual';
  message?: string;
  latestPath?: string;
  archivePath?: string;
  attachmentsLatestPath?: string;
  attachmentsArchivePath?: string;
};

export function getLocalBackupLogPath(): string {
  return path.join(app.getPath('userData'), 'local-backup-log.json');
}

export async function readLocalBackupLogEntries(limit = 200): Promise<LocalBackupLogEntry[]> {
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
          attachmentsLatestPath:
            typeof x.attachmentsLatestPath === 'string' ? x.attachmentsLatestPath : undefined,
          attachmentsArchivePath:
            typeof x.attachmentsArchivePath === 'string' ? x.attachmentsArchivePath : undefined,
        })) as LocalBackupLogEntry[];
      return items.slice(-Math.max(1, Math.min(1000, Math.floor(limit))));
    }
  } catch {
    // ignore
  }
  return [];
}

export async function appendLocalBackupLogEntry(entry: LocalBackupLogEntry): Promise<void> {
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

export async function clearLocalBackupLog(): Promise<void> {
  try {
    await fsp.unlink(getLocalBackupLogPath());
  } catch {
    // ignore
  }
}

export type LocalBackupFileInfo = {
  name: string;
  mtimeMs: number;
  size: number;
};

export async function getLocalBackupStatsBestEffort(dir: string): Promise<{
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

  const isLatestDb = (n: string) =>
    n === 'AZRAR-backup-latest.db' || n === 'AZRAR-backup-latest.db.enc';
  const isLatestAtt = (n: string) =>
    n === 'AZRAR-attachments-latest.tar.gz' || n === 'AZRAR-attachments-latest.tar.gz.enc';

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
    if (!(isLatestDb(name) || isLatestAtt(name) || isDbArchive(name) || isAttArchive(name)))
      continue;
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

export function getLocalBackupAutomationSettingsPath(): string {
  return path.join(app.getPath('userData'), 'local-backup-automation.json');
}

export function normalizeTimeHHmm(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!/^[0-2]\d:[0-5]\d$/.test(s)) return '02:00';
  const [hh, mm] = s.split(':').map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '02:00';
  if (hh < 0 || hh > 23) return '02:00';
  if (mm < 0 || mm > 59) return '02:00';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function normalizeRetentionDays(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 30;
  const i = Math.floor(n);
  return Math.min(3650, Math.max(1, i));
}

export async function readLocalBackupAutomationSettings(): Promise<LocalBackupAutomationSettings> {
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

export async function writeLocalBackupAutomationSettings(
  next: LocalBackupAutomationSettings
): Promise<void> {
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

export function ymdLocal(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isBackupDueToday(settings: LocalBackupAutomationSettings, now = new Date()): boolean {
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

export async function pruneLocalBackupsBestEffort(dir: string, retentionDays: number): Promise<void> {
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

export let localAutoBackupTimer: NodeJS.Timeout | null = null;
export let localAutoBackupInProgress = false;

export async function runLocalBackupToDir(dir: string): Promise<{
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

export function startLocalAutoBackupScheduler(): void {
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

export async function readBackupSettings(): Promise<BackupSettings> {
  try {
    const raw = await fsp.readFile(getBackupSettingsFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BackupSettings;
  } catch {
    return {};
  }
}

export async function writeBackupSettings(next: BackupSettings): Promise<void> {
  await fsp.writeFile(getBackupSettingsFilePath(), JSON.stringify(next, null, 2), 'utf8');
}

export function isExistingDirectory(p: string): boolean {
  try {
    return !!p && fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function formatBackupStamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export async function chooseJsonFileViaDialog(): Promise<string | null> {
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

export async function chooseBackupDirViaDialog(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'اختر مجلد النسخ الاحتياطي',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const dir = result.filePaths[0];
  if (!isExistingDirectory(dir)) return null;
  return dir;
}

export async function readPendingRestoreInfo(): Promise<PendingRestoreInfo> {
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

export async function writePendingRestoreInfo(info: PendingRestoreInfo): Promise<void> {
  const filePath = getUpdateStateFilePath();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(info, null, 2), 'utf8');
}

export async function clearPendingRestoreInfo(): Promise<void> {
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

export async function dirHasMeaningfulEntries(dir: string): Promise<boolean> {
  try {
    const entries = await fsp.readdir(dir);
    return entries.some((n) => n && n !== '.write-test');
  } catch {
    return false;
  }
}

export async function ensureWritableDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
  const probe = path.join(dir, '.write-test');
  await fsp.writeFile(probe, 'ok');
  await fsp.unlink(probe);
}

export async function getWritableAttachmentsRootForRestore(): Promise<string> {
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

export async function backupAttachmentsBestEffort(destDir: string): Promise<boolean> {
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

export async function rmDirBestEffort(dir: string): Promise<void> {
  try {
    const rm = (
      fsp as unknown as {
        rm?: (p: string, o: { recursive: boolean; force: boolean }) => Promise<void>;
      }
    ).rm;
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

export async function exportAttachmentsArchiveToMany(opts: {
  destPaths: string[];
  encryptionRequested: boolean;
  encryptionConfigured: boolean;
  encryptionPassword: string;
}): Promise<{ copiedAny: boolean; latestPath?: string; archivePath?: string }> {
  const destPaths = Array.isArray(opts.destPaths) ? opts.destPaths.filter(Boolean) : [];
  if (destPaths.length === 0) return { copiedAny: false };

  const tempDir = path.join(app.getPath('temp'), `AZRAR-attachments-export-${Date.now()}`);
  const tmpTar = path.join(app.getPath('temp'), `AZRAR-attachments-export-${Date.now()}.tar.gz`);
  const tmpTarEnc = path.join(
    app.getPath('temp'),
    `AZRAR-attachments-export-${Date.now()}.tar.gz.enc`
  );

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
      await encryptFileToFile({
        sourcePath: tmpTar,
        destPath: tmpTarEnc,
        password: opts.encryptionPassword,
      });
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

export async function restoreAttachmentsFromArchiveBestEffort(opts: {
  archivePath: string;
  password?: string;
}): Promise<{ restored: boolean; skippedBecauseNotEmpty?: boolean; message?: string }> {
  const archivePath = String(opts.archivePath || '');
  if (!archivePath) return { restored: false, message: 'مسار أرشيف المرفقات غير صالح' };

  const attachmentsRoot = await getWritableAttachmentsRootForRestore();
  if (await dirHasMeaningfulEntries(attachmentsRoot)) {
    return {
      restored: false,
      skippedBecauseNotEmpty: true,
      message: 'مجلد المرفقات غير فارغ - تم تخطي الاستعادة لتجنب الكتابة فوق الملفات',
    };
  }

  await fsp.mkdir(attachmentsRoot, { recursive: true });

  const tmpTar = path.join(app.getPath('temp'), `AZRAR-attachments-restore-${Date.now()}.tar.gz`);
  const looksEncryptedByExt = path.extname(archivePath).toLowerCase() === '.enc';
  const looksEncryptedByMagic = await isEncryptedFile(archivePath);
  const isEnc = looksEncryptedByExt || looksEncryptedByMagic;

  try {
    if (isEnc) {
      const password = String(opts.password || '');
      if (!password)
        return { restored: false, message: 'لا توجد كلمة مرور لفك تشفير أرشيف المرفقات' };
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

export async function encryptExistingAttachmentsAtRestBestEffort(password: string): Promise<void> {
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

  const roots = [stable, userData, legacyExe].filter(
    (p): p is string => typeof p === 'string' && !!p
  );

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

export async function reencryptEncryptedAttachmentsAtRestBestEffort(
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

  const roots = [stable, userData, legacyExe].filter(
    (p): p is string => typeof p === 'string' && !!p
  );

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
        const bytes = await decryptFileToBuffer({
          sourcePath: abs,
          password: oldPassword,
          maxBytes: MAX_ATTACHMENT_BYTES,
        });
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

export async function createMandatoryPreUpdateBackup(reason: 'install' | 'installFromFile') {
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

export async function restoreFromPendingBackup(): Promise<{ success: boolean; message?: string }> {
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

/** Cross-module writes (ESM imports are read-only for `let` bindings). */
export function setDbMaintenanceMode(next: boolean): void {
  dbMaintenanceMode = next;
}

export function setCurrentFeedUrl(next: string | null): void {
  currentFeedUrl = next;
}
