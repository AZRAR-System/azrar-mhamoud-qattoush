import { ipcMain, dialog, app, BrowserWindow } from 'electron';
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
import { spawn, spawnSync } from 'node:child_process';
import updaterPkg from 'electron-updater';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import {
  connectAndEnsureDatabase,
  createServerBackupOnServer,
  disconnectSql,
  ensureDailyServerBackupIfEnabled,
  exportServerBackupToFile,
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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

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
const isDomainEntity = (v: string): v is DomainEntity => v === 'people' || v === 'properties' || v === 'contracts';

const toErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message || fallback;
  const s = String(err ?? '').trim();
  return s || fallback;
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

type UpdaterEventPayload = {
  type: string;
  message?: string;
  data?: unknown;
};

let lastUpdaterEvent: UpdaterEventPayload | null = null;
let currentFeedUrl: string | null = process.env.AZRAR_UPDATE_URL || process.env.AZRAR_UPDATES_URL || null;

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
  action: 'upsert' | 'delete' | 'connect' | 'syncNow' | 'importBackup' | 'restoreBackup' | 'exportBackup' | 'provision' | 'attachments:pull';
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
  status: 'inSync' | 'localAhead' | 'remoteAhead' | 'missingRemote' | 'missingLocal' | 'different' | 'unknown';
};

const SQL_SYNC_LOG_LIMIT = 1000;
const sqlSyncLog: SqlSyncLogEntry[] = [];

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_INSTALLER_BYTES = 500 * 1024 * 1024;
const MAX_DB_IMPORT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;
const MAX_JSON_BACKUP_BYTES = 500 * 1024 * 1024; // 500MB

const isUncPath = (p: string): boolean => {
  const s = String(p || '');
  return s.startsWith('\\\\') || s.startsWith('//');
};

type AuthenticodeVerification =
  | { ok: true; status: 'Valid'; subject?: string; thumbprint?: string; statusMessage?: string }
  | { ok: false; status?: string; subject?: string; thumbprint?: string; statusMessage?: string; message: string };

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
    "[pscustomobject]@{",
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
    if (allowUnsigned) return { ok: true, status: 'Valid', statusMessage: 'ALLOW_UNSIGNED_UPDATES=1 (PowerShell failed)' };
    return { ok: false, message: 'تعذر التحقق من توقيع ملف التحديث (PowerShell غير متاح)' };
  }

  const stdout = String(res.stdout || '').trim();
  if (!stdout) {
    if (allowUnsigned) return { ok: true, status: 'Valid', statusMessage: 'ALLOW_UNSIGNED_UPDATES=1 (empty signature output)' };
    return { ok: false, message: 'تعذر التحقق من توقيع ملف التحديث' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    if (allowUnsigned) return { ok: true, status: 'Valid', statusMessage: 'ALLOW_UNSIGNED_UPDATES=1 (unparseable signature output)' };
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
    return { ok: true, status: 'Valid', statusMessage: `ALLOW_UNSIGNED_UPDATES=1 (signature status: ${status || 'Unknown'})`, subject, thumbprint };
  }

  const human = statusMessage || (status ? `حالة التوقيع: ${status}` : 'ملف التحديث غير موقّع أو غير صالح');
  return { ok: false, status, statusMessage, subject, thumbprint, message: `ملف التحديث غير آمن: ${human}` };
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

function addSqlSyncLogEntry(entry: Omit<SqlSyncLogEntry, 'id' | 'ts'> & { ts?: string }): SqlSyncLogEntry {
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
  await startBackgroundPull(async (row) => {
    const localMeta = kvGetMeta(row.k);
    const localDeletedAt = kvGetDeletedAt(row.k);
    const localBestTs = localDeletedAt || localMeta?.updatedAt || '';

    const remoteTs = row.updatedAt;
    const isRemoteNewer = !localBestTs || new Date(remoteTs).getTime() > new Date(localBestTs).getTime();
    if (!isRemoteNewer) return;

    if (row.isDeleted) {
      kvApplyRemoteDelete(row.k, remoteTs);
      broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
      addSqlSyncLogEntry({ direction: 'pull', action: 'delete', key: row.k, status: 'ok', ts: remoteTs });
    } else {
      kvSetWithUpdatedAt(row.k, row.v, remoteTs);
      broadcastDbRemoteUpdate({ key: row.k, value: row.v, isDeleted: false, updatedAt: remoteTs });
      addSqlSyncLogEntry({ direction: 'pull', action: 'upsert', key: row.k, status: 'ok', ts: remoteTs });

      // Attachments: ensure the actual files exist locally after syncing metadata.
      if (row.k === 'db_attachments') {
        try {
          const res = await pullAttachmentFilesForAttachmentsJson(row.v);
          if (res.downloaded > 0) {
            addSqlSyncLogEntry({ direction: 'system', action: 'attachments:pull', status: 'ok', message: `تم تنزيل ${res.downloaded} مرفق/مرفقات` });
          }
          if (res.missingRemote > 0) {
            addSqlSyncLogEntry({ direction: 'system', action: 'attachments:pull', status: 'error', message: `مرفقات غير موجودة على المخدم: ${res.missingRemote}` });
          }
        } catch (e: unknown) {
          addSqlSyncLogEntry({ direction: 'system', action: 'attachments:pull', status: 'error', message: toErrorMessage(e, 'فشل تنزيل المرفقات') });
        }
      }
    }
  }, { runImmediately: true });
}

async function pushAllLocalToRemote(): Promise<{ upsertsOk: number; deletesOk: number; errors: number }> {
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
          addSqlSyncLogEntry({ direction: 'push', action: 'delete', key: k, status: 'ok', ts: deletedAt });
          deletesOk += 1;
        } catch (e: unknown) {
          addSqlSyncLogEntry({ direction: 'push', action: 'delete', key: k, status: 'error', message: toErrorMessage(e, 'فشل رفع الحذف') });
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
        addSqlSyncLogEntry({ direction: 'push', action: 'upsert', key: k, status: 'ok', ts: updatedAt });
        upsertsOk += 1;
      } catch (e: unknown) {
        addSqlSyncLogEntry({ direction: 'push', action: 'upsert', key: k, status: 'error', message: toErrorMessage(e, 'فشل رفع التحديث') });
        errors += 1;
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, keys.length)) }, () => worker());
  await Promise.all(workers);

  return { upsertsOk, deletesOk, errors };
}

async function pushDeltaToRemoteSince(sinceIso: string): Promise<{ upsertsOk: number; deletesOk: number; errors: number; latestTs: string }> {
  const updated = kvListUpdatedSince(sinceIso);
  const deleted = kvListDeletedSince(sinceIso);

  let upsertsOk = 0;
  let deletesOk = 0;
  let errors = 0;
  let latestTs = sinceIso && String(sinceIso).trim() ? String(sinceIso).trim() : '1970-01-01T00:00:00.000Z';

  const tasks: Array<() => Promise<void>> = [];

  for (const row of deleted) {
    const k = getStringField(row, 'k').trim();
    const deletedAt = getStringField(row, 'deletedAt').trim();
    if (!k || !deletedAt) continue;
    if (new Date(deletedAt).getTime() > new Date(latestTs).getTime()) latestTs = deletedAt;
    tasks.push(async () => {
      try {
        await pushKvDelete({ key: k, deletedAt });
        addSqlSyncLogEntry({ direction: 'push', action: 'delete', key: k, status: 'ok', ts: deletedAt });
        deletesOk += 1;
      } catch (e: unknown) {
        addSqlSyncLogEntry({ direction: 'push', action: 'delete', key: k, status: 'error', message: toErrorMessage(e, 'فشل رفع الحذف') });
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
        addSqlSyncLogEntry({ direction: 'push', action: 'upsert', key: k, status: 'ok', ts: updatedAt });
        upsertsOk += 1;
      } catch (e: unknown) {
        addSqlSyncLogEntry({ direction: 'push', action: 'upsert', key: k, status: 'error', message: toErrorMessage(e, 'فشل رفع التحديث') });
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
        if (res.latestTs && new Date(res.latestTs).getTime() > new Date(lastAutoPushIso).getTime()) {
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

function broadcastDbRemoteUpdate(payload: { key: string; value?: string; isDeleted?: boolean; updatedAt?: string }) {
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
  const raw = String(process.env.AZRAR_UPDATE_HOST_ALLOWLIST || process.env.AZRAR_UPDATER_HOST_ALLOWLIST || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => String(s || '').trim().toLowerCase())
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
  if (u.username || u.password) throw new Error('رابط التحديث لا يجب أن يحتوي على اسم مستخدم/كلمة مرور');

  const allowlist = getUpdateHostAllowlist();
  if (!hostnameMatchesAllowlist(u.hostname, allowlist)) {
    throw new Error('نطاق رابط التحديث غير مسموح (تحقق من إعدادات allowlist)');
  }

  // Prefer HTTPS for non-LAN hosts to reduce MITM risk.
  if (u.protocol === 'http:' && !isPrivateHost(u.hostname)) {
    throw new Error('لروابط التحديث العامة، يرجى استخدام https:// (مسموح http داخل الشبكة المحلية فقط)');
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
      autoUpdater.setFeedURL({ provider: 'generic', url: normalizeFeedUrl(currentFeedUrl) } as UpdaterSetFeedUrlArg);
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
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const selected = result.filePaths[0];
  if (!selected) return null;

  const resolved = await fsp.realpath(selected).catch(() => path.resolve(selected));
  if (isUncPath(resolved)) throw new Error('غير مسموح اختيار ملف نسخة احتياطية من مسار شبكة (UNC)');

  if (path.extname(resolved).toLowerCase() !== '.json') throw new Error('الملف يجب أن يكون JSON');

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

async function copyDirIfExists(srcDir: string, destDir: string): Promise<boolean> {
  try {
    const st = await fsp.stat(srcDir);
    if (!st.isDirectory()) return false;
  } catch {
    return false;
  }
  await fsp.mkdir(path.dirname(destDir), { recursive: true });
  // Node 16+ supports fs.promises.cp
  await fspCp(srcDir, destDir, { recursive: true, force: true });
  return true;
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
  const attachmentsRoot = path.join(path.dirname(getDbPath()), 'attachments');
  const attachmentsBackupPath = path.join(backupRoot, `preupdate-${fromVersion}-${safeStamp}-attachments`);
  let attachmentsCopied = false;
  try {
    attachmentsCopied = await copyDirIfExists(attachmentsRoot, attachmentsBackupPath);
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
  if (restoreInProgress) return { success: false, message: 'عملية الاسترجاع قيد التنفيذ. يرجى الانتظار.' };

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
      const attachmentsRoot = path.join(path.dirname(getDbPath()), 'attachments');
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
    autoUpdater.on('update-available', (info: UpdateInfo) => broadcastUpdaterEvent({ type: 'available', data: info }));
    autoUpdater.on('update-not-available', (info: UpdateInfo) => broadcastUpdaterEvent({ type: 'not-available', data: info }));
    autoUpdater.on('download-progress', (progress: ProgressInfo) => broadcastUpdaterEvent({ type: 'progress', data: progress }));
    autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => broadcastUpdaterEvent({ type: 'downloaded', data: info }));
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
          broadcastUpdaterEvent({ type: 'error', message: toErrorMessage(e, 'فشل التحقق من التحديثات تلقائياً') });
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
      const normalized = normalizeFeedUrl(url);
      currentFeedUrl = normalized;

      try {
        await writeUpdaterSettings({ feedUrl: normalized });
      } catch {
        // ignore persistence errors
      }

      if (app.isPackaged) {
        if (!autoUpdater) return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
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
      return { success: false, message: 'ميزة التحديث التلقائي تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).' };
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
        return { success: false, message: 'لم يتم ضبط رابط التحديث. يرجى تحديده في إعدادات النظام أو عبر المتغير AZRAR_UPDATE_URL.' };
      }
      return { success: false, message: toErrorMessage(e, 'فشل التحقق من التحديث') };
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged) {
      return { success: false, message: 'ميزة التحديث التلقائي تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).' };
    }
    if (!autoUpdater) {
      return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e: unknown) {
      if (!currentFeedUrl && !hasEmbeddedUpdaterConfig()) {
        return { success: false, message: 'لم يتم ضبط رابط التحديث. يرجى تحديده في إعدادات النظام أو عبر المتغير AZRAR_UPDATE_URL.' };
      }
      return { success: false, message: toErrorMessage(e, 'فشل تنزيل التحديث') };
    }
  });

  ipcMain.handle('updater:install', async () => {
    if (!app.isPackaged) {
      return { success: false, message: 'ميزة التحديث التلقائي تعمل فقط بعد تثبيت البرنامج (نسخة Packaged).' };
    }
    if (!autoUpdater) {
      return { success: false, message: 'خدمة التحديث غير متاحة في هذه النسخة.' };
    }
    try {
      // Mandatory backup before installing any update.
      try {
        await createMandatoryPreUpdateBackup('install');
      } catch (e: unknown) {
        return { success: false, message: toErrorMessage(e, 'فشل أخذ نسخة احتياطية قبل التحديث. تم إيقاف التحديث حفاظاً على البيانات.') };
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
        return { success: false, message: toErrorMessage(e, 'فشل أخذ نسخة احتياطية قبل التحديث. تم إيقاف التحديث حفاظاً على البيانات.') };
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
    return kvGet(k);
  });
  ipcMain.handle('db:set', (_e, key: string, value: string) => {
    if (dbMaintenanceMode) return false;
    const k = String(key || '').trim();
    if (!k.startsWith('db_')) return false;
    kvSet(k, value);
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
    kvDelete(k);
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
    return kvKeys().filter((k) => String(k || '').startsWith('db_'));
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
      const daysAhead = Math.max(1, Math.min(60, Math.trunc(Number(getField(payload, 'daysAhead')) || 7)));
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

  ipcMain.handle('domain:picker:properties', (_e, payload: unknown) => {
    try {
      const q = trimString(getStringField(payload, 'query'), 128, 'نص البحث');
      const status = trimString(getStringField(payload, 'status'), 64, 'الحالة');
      const type = trimString(getStringField(payload, 'type'), 64, 'النوع');
      const forceVacant = Boolean(getField(payload, 'forceVacant'));
      const offset = Math.max(0, Math.trunc(Number(getField(payload, 'offset')) || 0));
      const limit = getOptionalNumberField(payload, 'limit');
      return domainPropertyPickerSearch({ query: q, status, type, forceVacant, offset, limit });
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
      const createdMonthRaw = trimString(getStringField(payload, 'createdMonth'), 16, 'شهر الإنشاء');
      const createdMonth = /^\d{4}-\d{2}$/.test(createdMonthRaw) ? createdMonthRaw : '';
      return domainContractPickerSearch({ query: q, offset, limit, tab, createdMonth });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل البحث عن العقود') };
    }
  });

  ipcMain.handle('domain:picker:people', (_e, payload: unknown) => {
    const q = getStringField(payload, 'query').trim();
    const role = getStringField(payload, 'role').trim();
    const onlyIdleOwners = Boolean(getField(payload, 'onlyIdleOwners'));
    const offset = Math.max(0, Math.trunc(Number(getField(payload, 'offset')) || 0));
    const limit = Math.max(1, Math.min(200, Math.trunc(Number(getField(payload, 'limit')) || 48)));
    return domainPeoplePickerSearch({ query: q, role, onlyIdleOwners, offset, limit });
  });

  ipcMain.handle('domain:installments:contracts', (_e, payload: unknown) => {
    try {
      const q = trimString(getStringField(payload, 'query'), 128, 'نص البحث');
      const filter = trimString(getStringField(payload, 'filter') || 'all', 16, 'الفلتر') || 'all';
      const offset = Math.max(0, Math.trunc(Number(getField(payload, 'offset')) || 0));
      const limit = Math.max(1, Math.min(100, Math.trunc(Number(getField(payload, 'limit')) || 20)));
      return domainInstallmentsContractsSearch({ query: q, filter, offset, limit });
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
      const enabled = Boolean(getField(settings, 'enabled'));
      const authMode = getStringField(settings, 'authMode') === 'windows' ? 'windows' : 'sql';

      await saveSqlSettings({
        enabled,
        server: trimString(getStringField(settings, 'server'), 256, 'السيرفر'),
        port: safePortOrDefault(getField(settings, 'port'), 1433),
        database: trimString(getStringField(settings, 'database') || 'AZRAR', 128, 'قاعدة البيانات') || 'AZRAR',
        authMode,
        user: trimString(getStringField(settings, 'user'), 128, 'المستخدم'),
        password: toLimitedPassword(getField(settings, 'password'), 512),
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
      server: trimString((getField(settings, 'server') ?? saved.server ?? '') as unknown, 256, 'السيرفر'),
      port: safePortOrDefault(getField(settings, 'port') ?? saved.port ?? 1433, 1433),
      database: trimString((getField(settings, 'database') ?? saved.database ?? 'AZRAR') as unknown, 128, 'قاعدة البيانات') || 'AZRAR',
      authMode: (getStringField(settings, 'authMode') === 'windows' ? 'windows' : 'sql') as TestSqlSettings['authMode'],
      user: trimString((getField(settings, 'user') ?? saved.user ?? '') as unknown, 128, 'المستخدم'),
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
      await startBackgroundPull(async (row) => {
        const localMeta = kvGetMeta(row.k);
        const localDeletedAt = kvGetDeletedAt(row.k);
        const localBestTs = localDeletedAt || localMeta?.updatedAt || '';

        const remoteTs = row.updatedAt;
        const isRemoteNewer = !localBestTs || new Date(remoteTs).getTime() > new Date(localBestTs).getTime();
        if (!isRemoteNewer) return;

        if (row.isDeleted) {
          kvApplyRemoteDelete(row.k, remoteTs);
          broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
          addSqlSyncLogEntry({ direction: 'pull', action: 'delete', key: row.k, status: 'ok', ts: remoteTs });
        } else {
          kvSetWithUpdatedAt(row.k, row.v, remoteTs);
          broadcastDbRemoteUpdate({ key: row.k, value: row.v, isDeleted: false, updatedAt: remoteTs });
          addSqlSyncLogEntry({ direction: 'pull', action: 'upsert', key: row.k, status: 'ok', ts: remoteTs });
        }
      }, { runImmediately: true, forceFullPull: true });

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
      const localMap = new Map<string, Omit<SqlCoverageItem, 'remoteUpdatedAt' | 'remoteIsDeleted' | 'status'>>();

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
      addSqlSyncLogEntry({ direction: 'system', action: 'exportBackup', status: 'ok', message: 'بدء تصدير نسخة احتياطية من المخدم' });
      const settings = await loadSqlSettings();
      if (!settings.server?.trim()) return { ok: false, message: 'اسم السيرفر مطلوب' };
      if (!settings.database?.trim()) return { ok: false, message: 'اسم قاعدة البيانات مطلوب' };

      const backupSettings = await readBackupSettings();
      const backupDir = backupSettings.backupDir && isExistingDirectory(backupSettings.backupDir) ? backupSettings.backupDir : app.getPath('documents');

      const dbNameSafe = String(settings.database || 'AZRAR').replace(/[^a-zA-Z0-9_-]/g, '_');
      const defaultName = `AZRAR_SERVER_BACKUP_${dbNameSafe}_${formatBackupStamp()}.json`;
      const defaultPath = path.join(backupDir, defaultName);

      const result = await dialog.showSaveDialog({
        title: 'حفظ نسخة احتياطية من المخدم',
        defaultPath,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) return { ok: false, message: 'تم الإلغاء' };

      const res = await exportServerBackupToFile(result.filePath, { ...settings, enabled: true });
      addSqlSyncLogEntry({ direction: 'system', action: 'exportBackup', status: res?.ok ? 'ok' : 'error', message: res?.message });
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل إنشاء النسخة الاحتياطية من المخدم');
      addSqlSyncLogEntry({ direction: 'system', action: 'exportBackup', status: 'error', message: msg });
      return { ok: false, message: msg };
    }
  });

  ipcMain.handle('sql:importBackup', async () => {
    try {
      addSqlSyncLogEntry({ direction: 'system', action: 'importBackup', status: 'ok', message: 'بدء استيراد (دمج) نسخة احتياطية' });
      const filePath = await chooseJsonFileViaDialog();
      if (!filePath) return { ok: false, message: 'تم الإلغاء' };

      const res = await importServerBackupFromFile(filePath, 'merge');
      addSqlSyncLogEntry({ direction: 'system', action: 'importBackup', status: res?.ok ? 'ok' : 'error', message: res?.message });
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل استيراد النسخة الاحتياطية');
      addSqlSyncLogEntry({ direction: 'system', action: 'importBackup', status: 'error', message: msg });
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
        message: 'هذه العملية ستحذف بيانات المخدم الحالية وتستبدلها بالكامل من ملف النسخة الاحتياطية.',
        detail: 'استخدمها فقط عند الضرورة. هل تريد المتابعة؟',
      });
      if (confirm.response !== 1) return { ok: false, message: 'تم الإلغاء' };

      addSqlSyncLogEntry({ direction: 'system', action: 'restoreBackup', status: 'ok', message: 'بدء استعادة كاملة من نسخة احتياطية' });

      const filePath = await chooseJsonFileViaDialog();
      if (!filePath) return { ok: false, message: 'تم الإلغاء' };

      const res = await importServerBackupFromFile(filePath, 'replace');
      addSqlSyncLogEntry({ direction: 'system', action: 'restoreBackup', status: res?.ok ? 'ok' : 'error', message: res?.message });
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل الاستعادة الكاملة');
      addSqlSyncLogEntry({ direction: 'system', action: 'restoreBackup', status: 'error', message: msg });
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
      const next = await saveSqlBackupAutomationSettings({
        enabled: typeof getField(payload, 'enabled') === 'boolean' ? (getField(payload, 'enabled') as boolean) : undefined,
        retentionDays: getField(payload, 'retentionDays'),
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
      addSqlSyncLogEntry({ direction: 'system', action: 'createServerBackup', status: 'ok', message: 'بدء رفع نسخة احتياطية إلى المخدم' });
      const noteRaw = getField(payload, 'note');
      const note = noteRaw ? String(noteRaw).slice(0, 200) : undefined;
      const auto = await loadSqlBackupAutomationSettings();
      const res = await createServerBackupOnServer({ note: note || 'manual', retentionDays: auto.retentionDays });
      addSqlSyncLogEntry({ direction: 'system', action: 'createServerBackup', status: res?.ok ? 'ok' : 'error', message: res?.message });
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل رفع النسخة الاحتياطية إلى المخدم');
      addSqlSyncLogEntry({ direction: 'system', action: 'createServerBackup', status: 'error', message: msg });
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

      addSqlSyncLogEntry({ direction: 'system', action: 'restoreServerBackup', status: 'ok', message: `بدء استعادة نسخة من المخدم (${mode})` });
      const res = await restoreServerBackupFromServer(id, mode);
      addSqlSyncLogEntry({ direction: 'system', action: 'restoreServerBackup', status: res?.ok ? 'ok' : 'error', message: res?.message });
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل استعادة النسخة من المخدم');
      addSqlSyncLogEntry({ direction: 'system', action: 'restoreServerBackup', status: 'error', message: msg });
      return { ok: false, message: msg };
    }
  });

  // Daily server backup automation (best-effort)
  const runDailyBackupTick = async (reason: string) => {
    try {
      const res = await ensureDailyServerBackupIfEnabled();
      if (!res?.ok) {
        addSqlSyncLogEntry({ direction: 'system', action: 'dailyBackup', status: 'error', message: `${reason}: ${res?.message || 'فشل'}` });
        return;
      }
      if (res?.created) addSqlSyncLogEntry({ direction: 'system', action: 'dailyBackup', status: 'ok', message: `${reason}: تم إنشاء نسخة يومية` });
    } catch (e: unknown) {
      addSqlSyncLogEntry({ direction: 'system', action: 'dailyBackup', status: 'error', message: `${reason}: ${toErrorMessage(e, 'فشل')}` });
    }
  };

  setTimeout(() => void runDailyBackupTick('startup'), 10_000);
  setInterval(() => void runDailyBackupTick('hourly'), 60 * 60 * 1000);

  ipcMain.handle('sql:syncNow', async () => {
    try {
      addSqlSyncLogEntry({ direction: 'system', action: 'syncNow', status: 'ok', message: 'بدء المزامنة الآن' });
      const settings = await loadSqlSettings();
      if (!settings.enabled) return { ok: false, message: 'المزامنة غير مفعلة' };

      const conn = await connectAndEnsureDatabase(settings);
      if (!conn.ok) return conn;

      let pullUpserts = 0;
      let pullDeletes = 0;

      await startBackgroundPull(async (row) => {
        const localMeta = kvGetMeta(row.k);
        const localDeletedAt = kvGetDeletedAt(row.k);
        const localBestTs = localDeletedAt || localMeta?.updatedAt || '';

        const remoteTs = row.updatedAt;
        const isRemoteNewer = !localBestTs || new Date(remoteTs).getTime() > new Date(localBestTs).getTime();
        if (!isRemoteNewer) return;

        if (row.isDeleted) {
          kvApplyRemoteDelete(row.k, remoteTs);
          broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
          addSqlSyncLogEntry({ direction: 'pull', action: 'delete', key: row.k, status: 'ok', ts: remoteTs });
          pullDeletes += 1;
        } else {
          kvSetWithUpdatedAt(row.k, row.v, remoteTs);
          broadcastDbRemoteUpdate({ key: row.k, value: row.v, isDeleted: false, updatedAt: remoteTs });
          addSqlSyncLogEntry({ direction: 'pull', action: 'upsert', key: row.k, status: 'ok', ts: remoteTs });
          pullUpserts += 1;
        }
      }, { runImmediately: true });

      // Push local changes
      const pushStats = await pushAllLocalToRemote();

      const summaryParts: string[] = [];
      summaryParts.push(`سحب: تعديل ${pullUpserts} / حذف ${pullDeletes}`);
      if (pushStats) summaryParts.push(`رفع: تعديل ${pushStats.upsertsOk} / حذف ${pushStats.deletesOk}`);
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
      addSqlSyncLogEntry({ direction: 'system', action: 'syncNow', status: 'ok', message: 'بدء سحب كامل من المخدم' });
      const settings = await loadSqlSettings();
      if (!settings.enabled) return { ok: false, message: 'المزامنة غير مفعلة' };

      const conn = await connectAndEnsureDatabase(settings);
      if (!conn.ok) return conn;

      let pullUpserts = 0;
      let pullDeletes = 0;

      await startBackgroundPull(async (row) => {
        const localMeta = kvGetMeta(row.k);
        const localDeletedAt = kvGetDeletedAt(row.k);
        const localBestTs = localDeletedAt || localMeta?.updatedAt || '';

        const remoteTs = row.updatedAt;
        const isRemoteNewer = !localBestTs || new Date(remoteTs).getTime() > new Date(localBestTs).getTime();
        if (!isRemoteNewer) return;

        if (row.isDeleted) {
          kvApplyRemoteDelete(row.k, remoteTs);
          broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
          addSqlSyncLogEntry({ direction: 'pull', action: 'delete', key: row.k, status: 'ok', ts: remoteTs });
          pullDeletes += 1;
        } else {
          kvSetWithUpdatedAt(row.k, row.v, remoteTs);
          broadcastDbRemoteUpdate({ key: row.k, value: row.v, isDeleted: false, updatedAt: remoteTs });
          addSqlSyncLogEntry({ direction: 'pull', action: 'upsert', key: row.k, status: 'ok', ts: remoteTs });
          pullUpserts += 1;
        }
      }, { runImmediately: true, forceFullPull: true });

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
      addSqlSyncLogEntry({ direction: 'system', action: 'mergePublish', status: 'ok', message: 'بدء دمج ونشر (SuperAdmin) للمفاتيح المحددة' });
      const settings = await loadSqlSettings();
      if (!settings.enabled) return { ok: false, message: 'المزامنة غير مفعلة' };

      const conn = await connectAndEnsureDatabase(settings);
      if (!conn.ok) return conn;

      const requestedKeysRaw = getField(payload, 'keys');
      const requestedKeys = Array.isArray(requestedKeysRaw) ? requestedKeysRaw : undefined;
      const keys = (requestedKeys && requestedKeys.length > 0
        ? requestedKeys
        : ['db_users', 'db_user_permissions', 'db_roles', 'db_lookup_categories', 'db_lookups', 'db_legal_templates']
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
          const id = getStringField(item, 'id').trim();
          if (id) return `id:${id}`;
          const category = getStringField(item, 'category').trim();
          const label = getStringField(item, 'label').trim();
          if (category && label) return `lookup:${category}:${label}`;
        }

        // lookup categories might be { id, name, label }
        if (k === 'db_lookup_categories') {
          const id = getStringField(item, 'id').trim();
          if (id) return `id:${id}`;
          const name = getStringField(item, 'name').trim();
          if (name) return `name:${name}`;
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

      const prefer: 'local' | 'remote' = getStringField(payload, 'prefer') === 'remote' ? 'remote' : 'local';
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
          const mergedJson = JSON.stringify(mergedArr);

          // Push to server with a fresh timestamp so it's always newer than any existing remote row.
          await pushKvUpsert({ key, value: mergedJson, updatedAt: nowIso });
          addSqlSyncLogEntry({ direction: 'push', action: 'mergeUpsert', key, status: 'ok', ts: nowIso });

          // Also normalize local state to match what we just published.
          kvSetWithUpdatedAt(key, mergedJson, nowIso);
          broadcastDbRemoteUpdate({ key, value: mergedJson, isDeleted: false, updatedAt: nowIso });

          applied += 1;
        } catch (e: unknown) {
          errors += 1;
          addSqlSyncLogEntry({ direction: 'system', action: 'mergePublish', key, status: 'error', message: toErrorMessage(e, 'فشل الدمج/النشر') });
        }
      }

      const message = errors > 0 ? `تم الدمج/النشر: ${applied} (مع أخطاء: ${errors})` : `تم الدمج/النشر بنجاح: ${applied}`;
      addSqlSyncLogEntry({ direction: 'system', action: 'mergePublish', status: errors > 0 ? 'error' : 'ok', message });
      return { ok: errors === 0, message, applied, errors, keys };
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'فشل الدمج/النشر');
      addSqlSyncLogEntry({ direction: 'system', action: 'mergePublish', status: 'error', message: msg });
      return { ok: false, message: msg };
    }
  });

  ipcMain.handle('sql:provision', async (_e, payload: unknown) => {
    addSqlSyncLogEntry({ direction: 'system', action: 'provision', status: 'ok', message: 'بدء تهيئة المخدم' });
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
      if (!req.adminUser || !req.adminPassword) return { ok: false, message: 'بيانات الأدمن مطلوبة' };
      if (!req.managerUser || !req.managerPassword) return { ok: false, message: 'بيانات المدير مطلوبة' };
      if (!req.employeeUser || !req.employeePassword) return { ok: false, message: 'بيانات الموظف مطلوبة' };

      const res = await provisionSqlServer(req);
      addSqlSyncLogEntry({ direction: 'system', action: 'provision', status: res?.ok ? 'ok' : 'error', message: res?.message });
      if (res.ok) {
        // after provisioning, connect using saved app credentials and start pull loop
        const settings = await loadSqlSettings();
        const conn = await connectAndEnsureDatabase(settings);
        if (conn.ok) {
          await resetSqlPullState();
          await startBackgroundPull(async (row) => {
            const localMeta = kvGetMeta(row.k);
            const localDeletedAt = kvGetDeletedAt(row.k);
            const localBestTs = localDeletedAt || localMeta?.updatedAt || '';

            const remoteTs = row.updatedAt;
            const isRemoteNewer = !localBestTs || new Date(remoteTs).getTime() > new Date(localBestTs).getTime();
            if (!isRemoteNewer) return;

            if (row.isDeleted) {
              kvApplyRemoteDelete(row.k, remoteTs);
              broadcastDbRemoteUpdate({ key: row.k, isDeleted: true, updatedAt: remoteTs });
              addSqlSyncLogEntry({ direction: 'pull', action: 'delete', key: row.k, status: 'ok', ts: remoteTs });
            } else {
              kvSetWithUpdatedAt(row.k, row.v, remoteTs);
              broadcastDbRemoteUpdate({ key: row.k, value: row.v, isDeleted: false, updatedAt: remoteTs });
              addSqlSyncLogEntry({ direction: 'pull', action: 'upsert', key: row.k, status: 'ok', ts: remoteTs });
            }
          }, { runImmediately: true, forceFullPull: true });

          await pushAllLocalToRemote();
        }
      }
      return res;
    } catch (e: unknown) {
      const msg = toErrorMessage(e, 'بيانات التهيئة غير صالحة');
      addSqlSyncLogEntry({ direction: 'system', action: 'provision', status: 'error', message: msg });
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
        addSqlSyncLogEntry({ direction: 'system', action: 'connect', status: 'ok', message: 'بدء الاتصال التلقائي بالمخدم' });
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
          addSqlSyncLogEntry({ direction: 'system', action: 'connect', status: 'error', message: res?.message || 'فشل الاتصال التلقائي بالمخدم' });
        }
      } catch (e: unknown) {
        addSqlSyncLogEntry({ direction: 'system', action: 'connect', status: 'error', message: toErrorMessage(e, 'فشل الاتصال التلقائي بالمخدم') });
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

  // Export database to user-selected folder
  // Creates both a stable "latest" backup and a dated archive backup.
  ipcMain.handle('db:export', async () => {
    if (dbMaintenanceMode) return { success: false, message: 'قاعدة البيانات قيد الاسترجاع/الصيانة. حاول لاحقاً.' };

    // Remember first selected backup folder and reuse it.
    const settings = await readBackupSettings();
    let dir = settings.backupDir && isExistingDirectory(settings.backupDir) ? settings.backupDir : null;

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

    const today = new Date().toISOString().slice(0, 10);

    const latestPath = path.join(dir, 'AZRAR-backup-latest.db');

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

    const archiveBase = path.join(dir, `AZRAR-backup-${today}.db`);
    const archivePath = makeUniqueArchivePath(archiveBase);

    try {
      dbMaintenanceMode = true;
      await exportDatabaseToMany([latestPath, archivePath]);
      dbMaintenanceMode = false;
      return {
        success: true,
        message: 'تم التصدير بنجاح',
        path: latestPath,
        latestPath,
        archivePath,
      };
    } catch (err: unknown) {
      dbMaintenanceMode = false;
      return { success: false, message: toErrorMessage(err, 'فشل تصدير قاعدة البيانات') };
    }
  });

  // Import database from user-selected file
  ipcMain.handle('db:import', async () => {
    if (dbMaintenanceMode) return { success: false, message: 'قاعدة البيانات قيد الاسترجاع/الصيانة. حاول لاحقاً.' };
    const result = await dialog.showOpenDialog({
      title: 'استيراد قاعدة البيانات',
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'تم الإلغاء' };
    }

    try {
      const selected = result.filePaths[0];
      if (!selected) return { success: false, message: 'مسار الملف غير صالح' };

      const resolved = await fsp.realpath(selected).catch(() => path.resolve(selected));
      if (isUncPath(resolved)) return { success: false, message: 'غير مسموح استيراد قاعدة البيانات من مسار شبكة (UNC)' };

      const ext = path.extname(resolved).toLowerCase();
      if (!['.db', '.sqlite', '.sqlite3'].includes(ext)) {
        return { success: false, message: 'الملف يجب أن يكون قاعدة بيانات SQLite (.db / .sqlite / .sqlite3)' };
      }

      const st = await fsp.stat(resolved);
      if (!st.isFile()) return { success: false, message: 'الملف غير صالح' };
      if (st.size <= 0) return { success: false, message: 'الملف فارغ' };
      if (st.size > MAX_DB_IMPORT_BYTES) return { success: false, message: 'حجم قاعدة البيانات كبير جداً' };

      dbMaintenanceMode = true;
      await importDatabase(resolved);
      dbMaintenanceMode = false;
      return { success: true, message: 'تم الاستيراد بنجاح - أعد تشغيل التطبيق', path: resolved };
    } catch (err: unknown) {
      dbMaintenanceMode = false;
      return { success: false, message: toErrorMessage(err, 'فشل استيراد قاعدة البيانات') };
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
    const legacy = getLegacyExeAttachmentsRoot();
    if (!legacy) return;
    if (!directoryExists(legacy)) return;

    const marker = path.join(stableRoot, '.migrated-from-exe');
    try {
      await fsp.access(marker);
      return;
    } catch {
      // continue
    }

    try {
      const stableEntries = await fsp.readdir(stableRoot).catch(() => [] as string[]);
      const legacyEntries = await fsp.readdir(legacy).catch(() => [] as string[]);
      const stableHasData = stableEntries.filter(n => n && n !== '.write-test' && n !== '.migrated-from-exe').length > 0;
      const legacyHasData = legacyEntries.length > 0;
      if (!stableHasData && legacyHasData) {
        await fsp.cp(legacy, stableRoot, { recursive: true, force: false });
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

    const normalizeRel = (p: string) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();

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

    const looksAbsolute = path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\');

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

  const ensureInsideRoot = (root: string, target: string) => {
    const rootResolved = path.resolve(root);
    const targetResolved = path.resolve(target);
    const rel = path.relative(rootResolved, targetResolved);
    if (!rel || rel === '.') return;
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('Invalid attachment path');
    }
  };

  const mimeFromExt = (extRaw: string): string => {
    const ext = (extRaw || '').toLowerCase().replace(/^\./, '');
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      case 'bmp': return 'image/bmp';
      case 'doc': return 'application/msword';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default: return 'application/octet-stream';
    }
  };

  const makeTimestampPrefix = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}__${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  const chooseTypeFolder = (referenceType: string): string => {
    switch (String(referenceType || '').toLowerCase()) {
      case 'person': return 'Persons';
      case 'property': return 'Properties';
      case 'contract': return 'Contracts';
      case 'maintenance': return 'Maintenance';
      case 'sales': return 'Sales';
      default: return sanitizeSegment(referenceType || 'Other');
    }
  };

  ipcMain.handle(
    'attachments:save',
    async (
      _e,
      payload: { referenceType: string; entityFolder: string; originalFileName: string; bytes: ArrayBuffer | ArrayBufferView }
    ) => {
    try {
      const root = await getAttachmentsRoot();
      const typeFolder = chooseTypeFolder(payload?.referenceType);
      const entityFolder = sanitizeSegment(payload?.entityFolder || 'غير_معروف');

      const bytes = payload?.bytes;
      const byteLen: number =
        bytes instanceof ArrayBuffer ? bytes.byteLength : ArrayBuffer.isView(bytes) ? bytes.byteLength : 0;
      if (!byteLen) return { success: false, message: 'المرفق غير صالح' };
      if (byteLen > MAX_ATTACHMENT_BYTES) return { success: false, message: 'حجم المرفق كبير جداً' };

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
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return Buffer.from(u8);
      })();
      await fsp.writeFile(absPath, buf);

      const relativePath = path.relative(root, absPath).split(path.sep).join('/');
      return { success: true, relativePath, filePath: absPath, storedFileName: candidate };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to save attachment') };
    }
  }
  );

  ipcMain.handle('attachments:read', async (_e, relativePath: string) => {
    try {
      const abs = await resolveExistingAttachmentAbsPath(relativePath);
      const st = await fsp.stat(abs);
      if (st.size > MAX_ATTACHMENT_BYTES) {
        return { success: false, message: 'حجم الملف كبير جداً' };
      }
      const data = await fsp.readFile(abs);
      const ext = path.extname(abs);
      const mime = mimeFromExt(ext);
      const dataUri = `data:${mime};base64,${data.toString('base64')}`;
      return { success: true, dataUri };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to read attachment') };
    }
  });

  ipcMain.handle('attachments:delete', async (_e, relativePath: string) => {
    try {
      const abs = await resolveExistingAttachmentAbsPath(relativePath);
      await fsp.unlink(abs);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to delete attachment') };
    }
  });

  // Word templates (Contracts)
  const getContractTemplatesDir = async () => {
    // Put templates next to the DB file. In server/LAN setups this can be a shared folder
    // by setting AZRAR_DESKTOP_DB_DIR or AZRAR_DESKTOP_DB_PATH.
    const dir = path.join(path.dirname(getDbPath()), 'templates', 'contracts');
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

  ipcMain.handle('templates:list', async () => {
    try {
      const dir = await getContractTemplatesDir();
      const items = await fsp.readdir(dir);
      const docx = items.filter(x => x.toLowerCase().endsWith('.docx'));
      return { success: true, items: docx };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to list templates') };
    }
  });

  ipcMain.handle('templates:import', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'اختر قالب Word للعقود',
        properties: ['openFile'],
        filters: [{ name: 'Word (.docx)', extensions: ['docx'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return { success: false, message: 'تم الإلغاء' };

      const selected = result.filePaths[0];
      if (!selected) return { success: false, message: 'مسار الملف غير صالح' };

      const resolved = await fsp.realpath(selected).catch(() => path.resolve(selected));
      if (isUncPath(resolved)) return { success: false, message: 'غير مسموح استيراد القالب من مسار شبكة (UNC)' };

      const st = await fsp.stat(resolved);
      if (!st.isFile()) return { success: false, message: 'الملف غير صالح' };
      if (st.size <= 0) return { success: false, message: 'الملف فارغ' };
      if (st.size > MAX_TEMPLATE_BYTES) return { success: false, message: 'حجم القالب كبير جداً' };

      const safeName = path.basename(resolved);
      if (!safeName.toLowerCase().endsWith('.docx')) return { success: false, message: 'الملف يجب أن يكون .docx' };

      const dir = await getContractTemplatesDir();
      const uniqueName = await ensureUniqueFileName(dir, safeName);
      const dest = path.join(dir, uniqueName);
      await fsp.copyFile(resolved, dest);
      return { success: true, fileName: uniqueName };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to import template') };
    }
  });

  ipcMain.handle('templates:read', async (_e, payload: { templateName: string }) => {
    try {
      const rawName = String(payload?.templateName || '').trim();
      const templatesDir = await getContractTemplatesDir();

      let safeName = path.basename(rawName);
      if (!safeName) {
        // If not provided, try auto-pick when there is exactly one template
        try {
          const items = (await fsp.readdir(templatesDir)).filter(x => x.toLowerCase().endsWith('.docx'));
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
        path.join(process.cwd(), 'العقود الورد', safeName),
        // Packaged resources path (best-effort)
        path.join(app.getAppPath(), 'العقود الورد', safeName),
        // Beside the installed EXE (portable/installed)
        path.join(path.dirname(app.getPath('exe')), 'العقود الورد', safeName),
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
        return {
          success: false,
          message: `لم يتم العثور على قالب Word: ${safeName}. يمكنك استيراد القالب من داخل البرنامج وسيتم حفظه تلقائياً داخل مجلد النظام: templates/contracts`,
        };
      }

      const resolvedFound = await fsp.realpath(found).catch(() => found);
      const allowedRoots = [
        templatesDir,
        path.join(process.cwd(), 'العقود الورد'),
        path.join(app.getAppPath(), 'العقود الورد'),
        path.join(path.dirname(app.getPath('exe')), 'العقود الورد'),
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
}
