import { app, safeStorage } from 'electron';
import path from 'node:path';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { spawn } from 'node:child_process';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getDbPath } from './db';
import logger from './logger';

export type SqlAuthMode = 'sql' | 'windows';

export type SqlSettings = {
  enabled: boolean;
  server: string;
  port?: number;
  database: string;
  authMode: SqlAuthMode;
  user?: string;
  password?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
};

export type SqlProvisionRequest = {
  server: string;
  port?: number;
  database?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  adminUser: string;
  adminPassword: string;
  managerUser: string;
  managerPassword: string;
  employeeUser: string;
  employeePassword: string;
};

type StoredSqlSettings = Omit<SqlSettings, 'password'> & { passwordEnc?: string };

export type SqlStatus = {
  configured: boolean;
  enabled: boolean;
  connected: boolean;
  lastError?: string;
  lastSyncAt?: string;
  /** |عميل − وقت SQL| بالمللي ثانية عند الاتصال (للمزامنة LWW) */
  clockSkewMs?: number;
  /** true إذا تجاوز الانحراف عتبة آمنة للمزامنة */
  clockSkewWarning?: boolean;
  serverTimeIso?: string;
};

/** انحراف مقبول بين ساعة الجهاز ووقت SQL؛ أعلى من ذلك يُنذر المستخدم (LWW يعتمد على الطوابع) */
const SQL_CLOCK_SKEW_WARN_MS = 120_000;

const SETTINGS_FILE = 'sql-settings.json';
const STATE_FILE = 'sql-state.json';
const DEVICE_ID_FILE = 'device-id.txt';
const BACKUP_AUTOMATION_FILE = 'sql-backup-automation.json';

let pool: sql.ConnectionPool | null = null;
let poolKey: string | null = null;
let currentStatus: SqlStatus = {
  configured: false,
  enabled: false,
  connected: false,
};

let syncTimer: NodeJS.Timeout | null = null;
let syncInProgress = false;

let ignoreNextLocalWrites = 0;

const ATTACHMENTS_KV_KEY = 'db_attachments';
const ATTACHMENT_UPLOAD_MAX_BYTES = 50 * 1024 * 1024; // 50MB

export type SqlBackupAutomationSettings = {
  enabled: boolean;
  retentionDays: number;
};

export type ServerBackupListItem = {
  id: string;
  createdAt: string;
  createdBy?: string;
  rowCount?: number;
  payloadBytes?: number;
  note?: string;
};

function normalizeRelPath(relRaw: string): string {
  let raw = String(relRaw || '').trim();
  if (!raw) throw new Error('Invalid attachment path');

  if (/^file:\/\//i.test(raw)) {
    try {
      raw = fileURLToPath(raw);
    } catch {
      // ignore
    }
  }

  const root = getStableAttachmentsRoot();
  const normalize = (p: string) =>
    String(p || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .trim();
  const looksAbsolute =
    path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\');

  if (looksAbsolute) {
    const abs = path.normalize(raw);
    ensureInsideRoot(root, abs);
    const relFromAbs = normalize(path.relative(root, abs));
    if (!relFromAbs) throw new Error('Invalid attachment path');
    if (relFromAbs.includes('..')) throw new Error('Invalid attachment path');
    return relFromAbs;
  }

  const rel = normalize(raw);
  if (!rel) throw new Error('Invalid attachment path');
  if (rel.includes('..')) throw new Error('Invalid attachment path');
  return rel;
}

function getStableAttachmentsRoot(): string {
  return path.join(path.dirname(getDbPath()), 'attachments');
}

function ensureInsideRoot(root: string, target: string) {
  const rootResolved = path.resolve(root);
  const targetResolved = path.resolve(target);
  if (targetResolved === rootResolved) return;
  if (!targetResolved.startsWith(rootResolved + path.sep)) {
    throw new Error('Invalid attachment path');
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureAttachmentFilesTable(p: sql.ConnectionPool): Promise<void> {
  await p.request().query(
    `IF OBJECT_ID('dbo.AttachmentFiles', 'U') IS NULL
       BEGIN
         CREATE TABLE dbo.AttachmentFiles (
           [path] NVARCHAR(700) NOT NULL PRIMARY KEY,
           [bytes] VARBINARY(MAX) NOT NULL,
           [mime] NVARCHAR(100) NULL,
           [size] INT NOT NULL,
           [sha256] CHAR(64) NULL,
           [updatedAt] DATETIME2(3) NOT NULL,
           [updatedBy] NVARCHAR(80) NULL
         );
       END

       IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AttachmentFiles_updatedAt' AND object_id = OBJECT_ID('dbo.AttachmentFiles'))
       BEGIN
         CREATE INDEX IX_AttachmentFiles_updatedAt ON dbo.AttachmentFiles(updatedAt);
       END`
  );
}

async function ensureServerBackupsTable(p: sql.ConnectionPool): Promise<void> {
  await p.request().query(
    `IF OBJECT_ID('dbo.ServerBackups', 'U') IS NULL
       BEGIN
         CREATE TABLE dbo.ServerBackups (
           [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ServerBackups PRIMARY KEY,
           [createdAt] DATETIME2(3) NOT NULL,
           [createdBy] NVARCHAR(80) NULL,
           [kind] NVARCHAR(40) NOT NULL,
           [version] INT NOT NULL,
           [encoding] NVARCHAR(20) NOT NULL,
           [payload] VARBINARY(MAX) NOT NULL,
           [payloadBytes] INT NOT NULL,
           [payloadSha256] CHAR(64) NULL,
           [rowCount] INT NULL,
           [note] NVARCHAR(200) NULL
         );
       END

       IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ServerBackups_createdAt' AND object_id = OBJECT_ID('dbo.ServerBackups'))
       BEGIN
         CREATE INDEX IX_ServerBackups_createdAt ON dbo.ServerBackups(createdAt);
       END`
  );
}

async function ensureKvImportStagingTable(p: sql.ConnectionPool): Promise<void> {
  await p.request().query(
    `IF OBJECT_ID('dbo.KvImportStaging', 'U') IS NULL
       BEGIN
         CREATE TABLE dbo.KvImportStaging (
           [batchId] UNIQUEIDENTIFIER NOT NULL,
           [k] NVARCHAR(300) NOT NULL,
           [v] NVARCHAR(MAX) NOT NULL,
           [updatedAt] DATETIME2(3) NOT NULL,
           [updatedBy] NVARCHAR(80) NULL,
           [isDeleted] BIT NOT NULL,
           CONSTRAINT PK_KvImportStaging PRIMARY KEY CLUSTERED ([batchId], [k])
         );
       END

       IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_KvImportStaging_batchId' AND object_id = OBJECT_ID('dbo.KvImportStaging'))
       BEGIN
         CREATE INDEX IX_KvImportStaging_batchId ON dbo.KvImportStaging(batchId);
       END`
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

type SqlResultCode =
  | 'ERR_SQL_DISABLED'
  | 'ERR_SQL_CONNECT_FAILED'
  | 'ERR_SQL_CONNECT_FAILED_SIMPLE'
  | 'ERR_SQL_BACKUP_LIST_FAILED'
  | 'ERR_SQL_BACKUP_NOT_FOUND'
  | 'ERR_SQL_BACKUP_INVALID'
  | 'ERR_SQL_BACKUP_UPLOAD_FAILED'
  | 'ERR_SQL_BACKUP_RESTORE_FAILED'
  | 'ERR_SQL_BACKUP_EXPORT_FAILED'
  | 'ERR_SQL_BACKUP_IMPORT_FAILED'
  | 'ERR_SQL_BACKUP_READ_FAILED'
  | 'ERR_SQL_REMOTE_ROW_FAILED'
  | 'ERR_SQL_SERVER_REQUIRED'
  | 'ERR_SQL_DATABASE_REQUIRED'
  | 'ERR_SQL_INVALID_KEY'
  | 'ERR_SQL_BACKUP_DAILY_FAILED'
  | 'ERR_SQL_BACKUP_DAILY_CREATE_FAILED'
  | 'ERR_SQL_PROVISION_FAILED'
  | 'ERR_SQL_BACKUP_FILE_INVALID'
  | 'OK_SQL_BACKUP_DAILY_DISABLED'
  | 'OK_SQL_BACKUP_DAILY_EXISTS'
  | 'OK_SQL_BACKUP_DAILY_CREATED'
  | 'OK_SQL_SYNC_DISABLED'
  | 'OK_SQL_PROVISIONED'
  | 'OK_SQL_CONNECTED'
  | 'OK_SQL_CONNECTED_READY'
  | 'OK_SQL_BACKUP_UPLOADED'
  | 'OK_SQL_BACKUP_EXPORTED'
  | 'OK_SQL_BACKUP_RESTORED'
  | 'OK_SQL_BACKUP_MERGED'
  | 'OK_SQL_BACKUP_RESTORED_LOCAL'
  | 'OK_SQL_BACKUP_MERGED_LOCAL';

const okResult = <T extends Record<string, unknown>>(
  code: SqlResultCode,
  message: string,
  extra?: T
) => ({ ok: true, code, message, ...(extra || {}) });

const errorResult = <T extends Record<string, unknown>>(
  code: SqlResultCode,
  message: string,
  extra?: T
) => ({
  ok: false,
  code,
  message,
  ...(extra || {}),
  items: (Array.isArray(extra?.items) ? extra.items : []) as unknown as never[],
});

const ensureError = <T extends Record<string, unknown>>(
  ensured: unknown,
  fallback: string,
  extra?: T
) => {
  const code =
    isRecord(ensured) && typeof ensured.code === 'string' && ensured.code
      ? (ensured.code as SqlResultCode)
      : 'ERR_SQL_CONNECT_FAILED';
  const message =
    isRecord(ensured) && typeof ensured.message === 'string' && ensured.message
      ? ensured.message
      : fallback;
  return {
    ok: false,
    code,
    message,
    ...(extra || {}),
    items: (Array.isArray(extra?.items) ? extra.items : []) as unknown as never[],
  };
};

const getRecordProp = (obj: unknown, key: string): unknown =>
  isRecord(obj) ? obj[key] : undefined;

const toDate = (value: unknown): Date =>
  new Date(
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
        ? value
        : String(value)
  );

/** Log SQL sync failures and surface lastError for sql:status. */
export function logSyncError(context: string, err: unknown): void {
  const msg = formatSqlErrorMessage(err, context);
  try {
    logger.error(`[SQL sync] ${context}: ${msg}`, err);
  } catch {
    // ignore logger failures
  }
  currentStatus = { ...currentStatus, lastError: msg };
}

function formatSqlErrorMessage(e: unknown, fallback: string): string {
  const msg1 = getRecordProp(e, 'message');
  if (msg1) return asString(msg1) || fallback;

  const originalError = getRecordProp(e, 'originalError');
  const msg2 = getRecordProp(originalError, 'message');
  if (msg2) return asString(msg2) || fallback;

  const info = getRecordProp(originalError, 'info');
  const msg3 = getRecordProp(info, 'message');
  if (msg3) return asString(msg3) || fallback;

  try {
    const s = String(e);
    if (s && s !== '[object Object]') return s;
  } catch {
    // ignore
  }
  return fallback;
}

type AttachmentLike = {
  filePath?: string;
  fileType?: string;
  fileExtension?: string;
  fileName?: string;
};

function extractAttachmentPathsFromJson(
  jsonRaw: string
): Array<{ relPath: string; mime?: string }> {
  try {
    const parsed = JSON.parse(String(jsonRaw || ''));
    const arr: AttachmentLike[] = Array.isArray(parsed) ? parsed : [];
    const seen = new Set<string>();
    const out: Array<{ relPath: string; mime?: string }> = [];
    for (const a of arr) {
      const fp = a?.filePath;
      if (!fp) continue;
      try {
        const relPath = normalizeRelPath(fp);
        if (!relPath) continue;
        if (seen.has(relPath)) continue;
        seen.add(relPath);
        out.push({ relPath, mime: a?.fileType ? String(a.fileType) : undefined });
      } catch {
        // Skip invalid path, do not fail entire extraction
        continue;
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function uploadAttachmentFileIfNeeded(
  p: sql.ConnectionPool,
  relPathRaw: string,
  mime: string | undefined
): Promise<'uploaded' | 'skipped' | 'missingLocal'> {
  const relPath = normalizeRelPath(relPathRaw);
  const root = getStableAttachmentsRoot();
  const abs = path.join(root, relPath);
  ensureInsideRoot(root, abs);

  if (!(await fileExists(abs))) return 'missingLocal';

  const buf = await fsp.readFile(abs);
  if (buf.byteLength > ATTACHMENT_UPLOAD_MAX_BYTES) {
    throw new Error(`حجم المرفق كبير جداً لرفعه (${Math.round(buf.byteLength / (1024 * 1024))}MB)`);
  }

  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

  const check = await p
    .request()
    .input('path', sql.NVarChar(700), relPath)
    .query(`SELECT TOP 1 sha256, size FROM dbo.AttachmentFiles WHERE [path] = @path;`);
  const existing = (check.recordset || [])[0] as { sha256?: string; size?: number } | undefined;
  if (
    existing?.sha256 &&
    String(existing.sha256).toLowerCase() === sha256.toLowerCase() &&
    Number(existing.size || 0) === buf.byteLength
  ) {
    return 'skipped';
  }

  const deviceId = await getOrCreateDeviceId();
  const req = p.request();
  (req as unknown as { timeout?: number }).timeout = 60000;
  await req
    .input('path', sql.NVarChar(700), relPath)
    .input('bytes', sql.VarBinary(sql.MAX), buf)
    .input('mime', sql.NVarChar(100), mime ? String(mime).slice(0, 100) : null)
    .input('size', sql.Int, buf.byteLength)
    .input('sha256', sql.Char(64), sha256)
    .input('updatedAt', sql.DateTime2(3), new Date())
    .input('updatedBy', sql.NVarChar(80), deviceId)
    .query(
      `MERGE dbo.AttachmentFiles AS T
       USING (SELECT @path AS [path]) AS S
       ON (T.[path] = S.[path])
       WHEN MATCHED THEN
         UPDATE SET [bytes]=@bytes, [mime]=@mime, [size]=@size, [sha256]=@sha256, [updatedAt]=@updatedAt, [updatedBy]=@updatedBy
       WHEN NOT MATCHED THEN
         INSERT ([path], [bytes], [mime], [size], [sha256], [updatedAt], [updatedBy])
         VALUES (@path, @bytes, @mime, @size, @sha256, @updatedAt, @updatedBy);
      `
    );

  return 'uploaded';
}

async function downloadAttachmentFileIfNeeded(
  p: sql.ConnectionPool,
  relPathRaw: string
): Promise<'downloaded' | 'skipped' | 'missingRemote'> {
  const relPath = normalizeRelPath(relPathRaw);
  const root = getStableAttachmentsRoot();
  const abs = path.join(root, relPath);
  ensureInsideRoot(root, abs);

  if (await fileExists(abs)) return 'skipped';

  const res = await p
    .request()
    .input('path', sql.NVarChar(700), relPath)
    .query(`SELECT TOP 1 [bytes] FROM dbo.AttachmentFiles WHERE [path] = @path;`);
  const row = (res.recordset || [])[0] as { bytes?: Buffer } | undefined;
  const bytes = row?.bytes;
  if (!bytes || !(bytes instanceof Buffer) || bytes.byteLength === 0) return 'missingRemote';

  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, bytes);
  return 'downloaded';
}

export async function pushAttachmentFilesForAttachmentsJson(
  attachmentsJson: string
): Promise<{ uploaded: number; skipped: number; missingLocal: number }> {
  const settings = await loadSqlSettings();
  if (!settings.enabled) return { uploaded: 0, skipped: 0, missingLocal: 0 };

  const p = await ensureConnected(settings);
  await ensureAttachmentFilesTable(p);

  const paths = extractAttachmentPathsFromJson(attachmentsJson);
  let uploaded = 0;
  let skipped = 0;
  let missingLocal = 0;

  for (const it of paths) {
    const r = await uploadAttachmentFileIfNeeded(p, it.relPath, it.mime);
    if (r === 'uploaded') uploaded += 1;
    else if (r === 'skipped') skipped += 1;
    else missingLocal += 1;
  }

  return { uploaded, skipped, missingLocal };
}

export async function pullAttachmentFilesForAttachmentsJson(
  attachmentsJson: string
): Promise<{ downloaded: number; skipped: number; missingRemote: number }> {
  const settings = await loadSqlSettings();
  if (!settings.enabled) return { downloaded: 0, skipped: 0, missingRemote: 0 };

  const p = await ensureConnected(settings);
  await ensureAttachmentFilesTable(p);

  const paths = extractAttachmentPathsFromJson(attachmentsJson);
  let downloaded = 0;
  let skipped = 0;
  let missingRemote = 0;

  const CONCURRENCY = 5;
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const chunk = paths.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((it) => downloadAttachmentFileIfNeeded(p, it.relPath))
    );
    for (const r of results) {
      if (r === 'downloaded') downloaded += 1;
      else if (r === 'skipped') skipped += 1;
      else missingRemote += 1;
    }
  }

  return { downloaded, skipped, missingRemote };
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

function getStatePath(): string {
  return path.join(app.getPath('userData'), STATE_FILE);
}

function getDeviceIdPath(): string {
  return path.join(app.getPath('userData'), DEVICE_ID_FILE);
}

function getBackupAutomationPath(): string {
  return path.join(app.getPath('userData'), BACKUP_AUTOMATION_FILE);
}

function normalizeRetentionDays(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 30;
  const i = Math.floor(n);
  return Math.min(3650, Math.max(1, i));
}

export async function loadSqlBackupAutomationSettings(): Promise<SqlBackupAutomationSettings> {
  const stored = await readJsonFile<Partial<SqlBackupAutomationSettings>>(
    getBackupAutomationPath(),
    {
      enabled: true,
      retentionDays: 30,
    }
  );
  return {
    enabled: stored.enabled !== false,
    retentionDays: normalizeRetentionDays(getRecordProp(stored, 'retentionDays') ?? 30),
  };
}

export async function saveSqlBackupAutomationSettings(
  next: Partial<SqlBackupAutomationSettings>
): Promise<SqlBackupAutomationSettings> {
  const prev = await loadSqlBackupAutomationSettings();
  const merged: SqlBackupAutomationSettings = {
    enabled: typeof next.enabled === 'boolean' ? next.enabled : prev.enabled,
    retentionDays: normalizeRetentionDays(
      getRecordProp(next, 'retentionDays') ?? prev.retentionDays
    ),
  };
  await writeJsonFile(getBackupAutomationPath(), merged);
  return merged;
}

async function pruneServerBackups(p: sql.ConnectionPool, retentionDays: number): Promise<number> {
  const days = normalizeRetentionDays(retentionDays);
  const res = await p
    .request()
    .input('days', sql.Int, days)
    .query(
      `DELETE FROM dbo.ServerBackups
       WHERE createdAt < DATEADD(day, -@days, SYSUTCDATETIME());
       SELECT @@ROWCOUNT AS deleted;`
    );
  return Number((res.recordset || [])[0]?.deleted ?? 0) || 0;
}

export async function listServerBackups(
  limit = 60
): Promise<{ ok: boolean; items: ServerBackupListItem[]; message?: string; code?: SqlResultCode }> {
  try {
    const settings = await loadSqlSettings();
    if (!settings.enabled)
      return errorResult('ERR_SQL_DISABLED', 'المزامنة غير مفعلة', { items: [] });

    const ensured = await connectAndEnsureDatabase(settings);
    if (!ensured.ok) return ensureError(ensured, 'فشل الاتصال/التجهيز', { items: [] });

    const p = await ensureConnected(settings);
    await ensureServerBackupsTable(p);

    const top = Math.min(500, Math.max(1, Math.floor(Number(limit) || 60)));
    const res = await p
      .request()
      .input('top', sql.Int, top)
      .query(
        `SELECT TOP (@top)
           CONVERT(VARCHAR(36), [id]) AS [id],
           [createdAt],
           [createdBy],
           [rowCount],
           [payloadBytes],
           [note]
         FROM dbo.ServerBackups
         ORDER BY createdAt DESC;`
      );

    const recordset = (res.recordset || []) as unknown[];
    const items = recordset
      .map((r: unknown) => {
        const id = String(getRecordProp(r, 'id') ?? '');
        const createdAt = toDate(getRecordProp(r, 'createdAt')).toISOString();
        const createdByRaw = getRecordProp(r, 'createdBy');
        const rowCountRaw = getRecordProp(r, 'rowCount');
        const payloadBytesRaw = getRecordProp(r, 'payloadBytes');
        const noteRaw = getRecordProp(r, 'note');
        return {
          id,
          createdAt,
          createdBy: createdByRaw ? String(createdByRaw) : undefined,
          rowCount:
            typeof rowCountRaw === 'number'
              ? rowCountRaw
              : Number((rowCountRaw ?? 0) as unknown) || undefined,
          payloadBytes:
            typeof payloadBytesRaw === 'number'
              ? payloadBytesRaw
              : Number((payloadBytesRaw ?? 0) as unknown) || undefined,
          note: noteRaw ? String(noteRaw) : undefined,
        } satisfies ServerBackupListItem;
      })
      .filter((it) => !!it.id);

    return { ok: true, items };
  } catch (e: unknown) {
    return errorResult(
      'ERR_SQL_BACKUP_LIST_FAILED',
      formatSqlErrorMessage(e, 'فشل قراءة النسخ الاحتياطية من المخدم'),
      { items: [] }
    );
  }
}

export async function createServerBackupOnServer(opts?: {
  note?: string;
  retentionDays?: number;
}): Promise<{
  ok: boolean;
  message: string;
  item?: ServerBackupListItem;
  deletedOld?: number;
  code?: SqlResultCode;
}> {
  try {
    const settings = await loadSqlSettings();
    if (!settings.enabled) return errorResult('ERR_SQL_DISABLED', 'المزامنة غير مفعلة');

    const ensured = await connectAndEnsureDatabase(settings);
    if (!ensured.ok) return ensureError(ensured, 'فشل الاتصال/التجهيز');

    const p = await ensureConnected(settings);
    await ensureServerBackupsTable(p);

    const result = await p.request().query(
      `SELECT k, v, updatedAt, updatedBy, isDeleted
         FROM dbo.KvStore
         ORDER BY updatedAt ASC;`
    );
    const rows = (result.recordset || []) as Array<{
      k: string;
      v: string;
      updatedAt: Date;
      updatedBy?: string;
      isDeleted: boolean;
    }>;

    const payload = {
      kind: 'AZRAR_SQL_BACKUP',
      version: 1,
      exportedAt: new Date().toISOString(),
      database: String(settings.database || ''),
      server: String(settings.server || ''),
      port: Number(settings.port || 1433) || 1433,
      rowCount: rows.length,
      rows: rows.map((r) => ({
        k: String(r.k),
        v: typeof r.v === 'string' ? r.v : String(r.v ?? ''),
        updatedAt: new Date(r.updatedAt).toISOString(),
        updatedBy: r.updatedBy ? String(r.updatedBy) : undefined,
        isDeleted: !!r.isDeleted,
      })),
    };

    const json = Buffer.from(JSON.stringify(payload), 'utf8');
    const gz = zlib.gzipSync(json, { level: 9 });
    const sha = crypto.createHash('sha256').update(gz).digest('hex');
    const deviceId = await getOrCreateDeviceId();

    const note = opts?.note ? String(opts.note).slice(0, 200) : null;
    const rowCount = rows.length;
    const createdAt = new Date();

    const insert = await p
      .request()
      .input('id', sql.UniqueIdentifier, crypto.randomUUID())
      .input('createdAt', sql.DateTime2(3), createdAt)
      .input('createdBy', sql.NVarChar(80), deviceId)
      .input('kind', sql.NVarChar(40), 'AZRAR_SQL_BACKUP')
      .input('version', sql.Int, 1)
      .input('encoding', sql.NVarChar(20), 'gzip')
      .input('payload', sql.VarBinary(sql.MAX), gz)
      .input('payloadBytes', sql.Int, gz.byteLength)
      .input('payloadSha256', sql.Char(64), sha)
      .input('rowCount', sql.Int, rowCount)
      .input('note', sql.NVarChar(200), note)
      .query(
        `INSERT INTO dbo.ServerBackups (
           id, createdAt, createdBy, kind, version, encoding, payload, payloadBytes, payloadSha256, [rowCount], note
         )
         VALUES (
           @id, @createdAt, @createdBy, @kind, @version, @encoding, @payload, @payloadBytes, @payloadSha256, @rowCount, @note
         );
         SELECT CONVERT(VARCHAR(36), @id) AS id;`
      );

    const id = String((insert.recordset || [])[0]?.id || '');
    const retentionDays = normalizeRetentionDays(
      opts?.retentionDays ?? (await loadSqlBackupAutomationSettings()).retentionDays
    );
    const deletedOld = await pruneServerBackups(p, retentionDays);

    return okResult('OK_SQL_BACKUP_UPLOADED', 'تم رفع نسخة احتياطية إلى المخدم', {
      deletedOld,
      item: {
        id,
        createdAt: createdAt.toISOString(),
        createdBy: deviceId,
        rowCount,
        payloadBytes: gz.byteLength,
        note: note ? String(note) : undefined,
      },
    });
  } catch (e: unknown) {
    return errorResult(
      'ERR_SQL_BACKUP_UPLOAD_FAILED',
      formatSqlErrorMessage(e, 'فشل رفع النسخة الاحتياطية إلى المخدم')
    );
  }
}

async function getServerBackupPayloadById(
  p: sql.ConnectionPool,
  id: string
): Promise<{ encoding: string; payload: Buffer } | null> {
  const guid = String(id || '').trim();
  if (!guid) return null;

  const res = await p
    .request()
    .input('id', sql.UniqueIdentifier, guid)
    .query('SELECT TOP 1 [encoding], [payload] FROM dbo.ServerBackups WHERE id = @id;');
  const row = ((res.recordset || [])[0] ?? null) as unknown;
  const payloadRaw = getRecordProp(row, 'payload');
  if (!(payloadRaw instanceof Buffer)) return null;
  const encoding = asString(getRecordProp(row, 'encoding'));
  const payload = payloadRaw;
  return { encoding, payload };
}

export async function restoreServerBackupFromServer(
  backupId: string,
  mode: 'merge' | 'replace'
): Promise<{
  ok: boolean;
  message: string;
  id?: string;
  applied?: number;
  rowCount?: number;
  code?: SqlResultCode;
}> {
  try {
    const settings = await loadSqlSettings();
    if (!settings.enabled) return errorResult('ERR_SQL_DISABLED', 'المزامنة غير مفعلة');

    const ensured = await connectAndEnsureDatabase(settings);
    if (!ensured.ok) return ensureError(ensured, 'فشل الاتصال/التجهيز');

    const p = await ensureConnected(settings);
    await ensureServerBackupsTable(p);
    await ensureKvImportStagingTable(p);

    const stored = await getServerBackupPayloadById(p, backupId);
    if (!stored)
      return errorResult('ERR_SQL_BACKUP_NOT_FOUND', 'لم يتم العثور على النسخة الاحتياطية');

    let jsonBuf: Buffer;
    if (String(stored.encoding || '').toLowerCase() === 'gzip')
      jsonBuf = zlib.gunzipSync(stored.payload);
    else jsonBuf = stored.payload;

    const parsed = JSON.parse(jsonBuf.toString('utf8'));
    if (!isBackupFileV1(parsed))
      return errorResult('ERR_SQL_BACKUP_INVALID', 'النسخة الاحتياطية المخزنة غير صالحة');

    // Apply using the same import logic (without file dialog)
    const rows = (parsed.rows || []).map(normalizeBackupRow);
    const tx = new sql.Transaction(p);
    await tx.begin();
    try {
      const req = new sql.Request(tx);
      if (mode === 'replace') {
        await req.query('DELETE FROM dbo.KvStore;');

        const table = new sql.Table('dbo.KvStore');
        table.create = false;
        table.columns.add('k', sql.NVarChar(300), { nullable: false });
        table.columns.add('v', sql.NVarChar(sql.MAX), { nullable: false });
        table.columns.add('updatedAt', sql.DateTime2(3), { nullable: false });
        table.columns.add('updatedBy', sql.NVarChar(80), { nullable: true });
        table.columns.add('isDeleted', sql.Bit, { nullable: false });

        for (const r of rows) {
          table.rows.add(
            r.k,
            r.isDeleted ? '' : r.v,
            new Date(r.updatedAt),
            r.updatedBy ?? null,
            r.isDeleted ? 1 : 0
          );
        }

        const bulkReq = new sql.Request(tx);
        (bulkReq as unknown as { timeout?: number }).timeout = 60000;
        await (bulkReq as unknown as { bulk: (t: sql.Table) => Promise<unknown> }).bulk(table);
        await tx.commit();
        return okResult('OK_SQL_BACKUP_RESTORED', 'تمت الاستعادة الكاملة من النسخة المختارة', {
          id: String(backupId),
          rowCount: rows.length,
          applied: rows.length,
        });
      }

      const batchId = crypto.randomUUID();
      await bulkToStagingTable(tx, batchId, rows);
      req.input('batchId', sql.UniqueIdentifier, batchId);
      const mergeRes = await req.query(
        `MERGE dbo.KvStore AS T
         USING (
           SELECT k, v, updatedAt, updatedBy, isDeleted
           FROM dbo.KvImportStaging
           WHERE batchId = @batchId
         ) AS S
         ON (T.k = S.k)
         WHEN MATCHED AND T.updatedAt < S.updatedAt THEN
           UPDATE SET
             v = CASE WHEN S.isDeleted = 1 THEN N'' ELSE S.v END,
             updatedAt = S.updatedAt,
             updatedBy = S.updatedBy,
             isDeleted = S.isDeleted
         WHEN NOT MATCHED THEN
           INSERT (k, v, updatedAt, updatedBy, isDeleted)
           VALUES (S.k, CASE WHEN S.isDeleted = 1 THEN N'' ELSE S.v END, S.updatedAt, S.updatedBy, S.isDeleted);
         SELECT @@ROWCOUNT AS affected;`
      );

      await req.query('DELETE FROM dbo.KvImportStaging WHERE batchId = @batchId;');

      const mergeRecordset = getRecordProp(mergeRes, 'recordset');
      const first = Array.isArray(mergeRecordset) ? mergeRecordset[0] : undefined;
      const affected = Number(getRecordProp(first, 'affected') ?? 0) || 0;
      await tx.commit();
      return okResult('OK_SQL_BACKUP_MERGED', 'تم دمج النسخة المختارة مع بيانات المخدم', {
        id: String(backupId),
        rowCount: rows.length,
        applied: affected,
      });
    } catch (e) {
      try {
        await tx.rollback();
      } catch {
        // ignore
      }
      throw e;
    }
  } catch (e: unknown) {
    return errorResult(
      'ERR_SQL_BACKUP_RESTORE_FAILED',
      formatSqlErrorMessage(e, 'فشل استعادة النسخة الاحتياطية من المخدم')
    );
  }
}

export async function ensureDailyServerBackupIfEnabled(): Promise<{
  ok: boolean;
  message: string;
  created?: boolean;
  skipped?: boolean;
  code?: SqlResultCode;
}> {
  try {
    const auto = await loadSqlBackupAutomationSettings();
    if (!auto.enabled)
      return okResult('OK_SQL_BACKUP_DAILY_DISABLED', 'النسخ الاحتياطي اليومي غير مفعل', {
        skipped: true,
      });

    const settings = await loadSqlSettings();
    if (!settings.enabled)
      return okResult('OK_SQL_SYNC_DISABLED', 'المزامنة غير مفعلة', { skipped: true });

    const ensured = await connectAndEnsureDatabase(settings);
    if (!ensured.ok) return ensureError(ensured, 'فشل الاتصال/التجهيز');

    const p = await ensureConnected(settings);
    await ensureServerBackupsTable(p);

    // One backup per UTC day (safe across multiple devices)
    const exists = await p.request().query(
      `DECLARE @start DATETIME2(3) = DATEADD(day, DATEDIFF(day, 0, SYSUTCDATETIME()), 0);
         DECLARE @end DATETIME2(3) = DATEADD(day, 1, @start);
         SELECT TOP 1 id FROM dbo.ServerBackups WHERE createdAt >= @start AND createdAt < @end ORDER BY createdAt DESC;`
    );

    if ((exists.recordset || []).length > 0) {
      await pruneServerBackups(p, auto.retentionDays);
      return okResult('OK_SQL_BACKUP_DAILY_EXISTS', 'توجد نسخة احتياطية لليوم بالفعل', {
        skipped: true,
      });
    }

    const res = await createServerBackupOnServer({
      note: 'auto-daily',
      retentionDays: auto.retentionDays,
    });
    if (!res.ok) {
      const code =
        isRecord(res) && typeof res.code === 'string'
          ? (res.code as SqlResultCode)
          : 'ERR_SQL_BACKUP_DAILY_CREATE_FAILED';
      return { ok: false, code, message: res.message || 'فشل إنشاء النسخة اليومية' };
    }
    return okResult('OK_SQL_BACKUP_DAILY_CREATED', res.message || 'تم إنشاء النسخة اليومية', {
      created: true,
    });
  } catch (e: unknown) {
    return errorResult(
      'ERR_SQL_BACKUP_DAILY_FAILED',
      formatSqlErrorMessage(e, 'فشل تشغيل النسخ الاحتياطي اليومي')
    );
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, obj: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

function encryptPassword(plain: string): string {
  if (!plain) return '';
  if (safeStorage?.isEncryptionAvailable?.() !== true) {
    // Fallback: obfuscate (NOT secure) but better than failing.
    return Buffer.from(plain, 'utf8').toString('base64');
  }
  const enc = safeStorage.encryptString(plain);
  return enc.toString('base64');
}

function decryptPassword(encB64: string): string {
  if (!encB64) return '';
  try {
    if (safeStorage?.isEncryptionAvailable?.() !== true) {
      return Buffer.from(encB64, 'base64').toString('utf8');
    }
    const buf = Buffer.from(encB64, 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return '';
  }
}

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    if (fs.existsSync(getDeviceIdPath())) {
      const raw = await fsp.readFile(getDeviceIdPath(), 'utf8');
      const trimmed = raw.trim();
      if (trimmed) {
        // New format (JSON) allows encrypting the ID using OS-bound safeStorage.
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (parsed && typeof parsed === 'object') {
              const rec = parsed as Record<string, unknown>;
              const encB64 = typeof rec.encB64 === 'string' ? rec.encB64.trim() : '';
              const v = typeof rec.v === 'number' ? rec.v : Number(rec.v ?? 0);
              if (v === 2 && encB64) {
                const id = decryptPassword(encB64);
                if (id) return id;
              }
            }
          } catch {
            // fall through
          }
        }

        // Legacy format: plaintext UUID.
        const legacyId = trimmed;
        if (legacyId) {
          // Best-effort migration: if encryption is available, rewrite in encrypted format.
          try {
            if (safeStorage?.isEncryptionAvailable?.() === true) {
              const encB64 = encryptPassword(legacyId);
              const payload = { v: 2, encB64 };
              await fsp.writeFile(getDeviceIdPath(), JSON.stringify(payload), 'utf8');
            }
          } catch {
            // ignore migration failure
          }
          return legacyId;
        }
      }
    }
  } catch {
    // ignore
  }

  const id = crypto.randomUUID();
  await fsp.mkdir(path.dirname(getDeviceIdPath()), { recursive: true });
  try {
    if (safeStorage?.isEncryptionAvailable?.() === true) {
      const encB64 = encryptPassword(id);
      await fsp.writeFile(getDeviceIdPath(), JSON.stringify({ v: 2, encB64 }), 'utf8');
      return id;
    }
  } catch {
    // fall back to plaintext
  }

  await fsp.writeFile(getDeviceIdPath(), id, 'utf8');
  return id;
}

export async function loadSqlSettings(): Promise<SqlSettings> {
  const stored = await readJsonFile<StoredSqlSettings>(getSettingsPath(), {
    enabled: false,
    server: '',
    port: 1433,
    database: 'AZRAR',
    authMode: 'sql',
    encrypt: true,
    trustServerCertificate: true,
  });

  const storedPort = getRecordProp(stored, 'port');
  return {
    enabled: !!stored.enabled,
    server: String(stored.server || ''),
    port:
      typeof storedPort === 'number' ? storedPort : Number((storedPort ?? 1433) as unknown) || 1433,
    database: String(stored.database || 'AZRAR'),
    authMode: stored.authMode === 'windows' ? 'windows' : 'sql',
    user: stored.user ? String(stored.user) : '',
    password: stored.passwordEnc ? decryptPassword(String(stored.passwordEnc)) : '',
    encrypt: stored.encrypt !== false,
    trustServerCertificate: stored.trustServerCertificate !== false,
  };
}

export async function loadSqlSettingsRedacted(): Promise<
  Omit<SqlSettings, 'password'> & { hasPassword: boolean }
> {
  const stored = await readJsonFile<StoredSqlSettings>(getSettingsPath(), {
    enabled: false,
    server: '',
    port: 1433,
    database: 'AZRAR',
    authMode: 'sql',
    encrypt: true,
    trustServerCertificate: true,
  });

  const storedPort = getRecordProp(stored, 'port');
  return {
    enabled: !!stored.enabled,
    server: String(stored.server || ''),
    port:
      typeof storedPort === 'number' ? storedPort : Number((storedPort ?? 1433) as unknown) || 1433,
    database: String(stored.database || 'AZRAR'),
    authMode: stored.authMode === 'windows' ? 'windows' : 'sql',
    user: stored.user ? String(stored.user) : '',
    encrypt: stored.encrypt !== false,
    trustServerCertificate: stored.trustServerCertificate !== false,
    hasPassword: !!stored.passwordEnc,
  };
}

export async function saveSqlSettings(next: SqlSettings): Promise<void> {
  const stored: StoredSqlSettings = {
    enabled: !!next.enabled,
    server: String(next.server || '').trim(),
    port: Number(next.port || 1433) || 1433,
    database: String(next.database || 'AZRAR').trim() || 'AZRAR',
    authMode: next.authMode === 'windows' ? 'windows' : 'sql',
    user: next.user ? String(next.user).trim() : '',
    encrypt: next.encrypt !== false,
    trustServerCertificate: next.trustServerCertificate !== false,
    passwordEnc: next.password ? encryptPassword(String(next.password)) : undefined,
  };

  await writeJsonFile(getSettingsPath(), stored);

  currentStatus = {
    ...currentStatus,
    configured: !!stored.server && !!stored.database,
    enabled: !!stored.enabled,
  };
}

function toSqlConfig(settings: SqlSettings, dbOverride?: string): sql.config {
  const encrypt = settings.encrypt !== false;
  const trustServerCertificate = settings.trustServerCertificate !== false;

  if (!settings.server?.trim()) throw new Error('اسم السيرفر مطلوب');

  const database = (dbOverride ?? settings.database ?? 'AZRAR').trim() || 'AZRAR';

  if (settings.authMode === 'windows') {
    // NOTE: True Windows/Integrated auth in Node typically requires msnodesqlv8.
    // We keep a placeholder error to avoid a confusing half-working mode.
    throw new Error('وضع Windows Auth غير مدعوم حالياً. استخدم SQL Login.');
  }

  const user = String(settings.user || '').trim();
  const password = String(settings.password || '');

  if (!user) throw new Error('اسم المستخدم مطلوب');
  if (!password) throw new Error('كلمة المرور مطلوبة');

  const normalized = normalizeSqlServerInput({ server: settings.server, port: settings.port });
  // Avoid Node.js DEP0123: TLS SNI servername MUST NOT be an IP.
  // Tedious may also route connections using an IP (routingData.server), so we provide a stable hostname.
  const sniServerName = looksLikeIpv4(normalized.server) ? 'localhost' : normalized.server;

  return {
    server: normalized.server,
    port: normalized.port,
    database,
    user,
    password,
    options: {
      encrypt,
      trustServerCertificate,
      ...(encrypt ? { serverName: sniServerName } : {}),
      ...(normalized.instanceName ? { instanceName: normalized.instanceName } : {}),
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 60000,
    connectionTimeout: 30000,
  };
}

function looksLikeIpv4(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function normalizeSqlServerInput(input: { server: string; port?: number }): {
  server: string;
  port: number;
  instanceName?: string;
} {
  let serverRaw = String(input.server || '').trim();
  if (!serverRaw) throw new Error('اسم السيرفر مطلوب');

  // Support common prefixes.
  serverRaw = serverRaw.replace(/^tcp:\/\//i, '').replace(/^tcp:/i, '');

  // Support "HOST,PORT" pattern (common in SQL Server connection strings).
  let portFromServer: number | undefined;
  if (serverRaw.includes(',') && !serverRaw.startsWith('\\\\')) {
    const [left, right] = serverRaw.split(',', 2);
    const maybePort = Number(String(right || '').trim());
    if (Number.isFinite(maybePort) && maybePort > 0) {
      serverRaw = String(left || '').trim();
      portFromServer = maybePort;
    }
  }

  // Support "HOST\\INSTANCE" by mapping to tedious option instanceName.
  let instanceName: string | undefined;
  if (serverRaw.includes('\\') && !serverRaw.startsWith('\\\\')) {
    const [host, instance] = serverRaw.split('\\', 2);
    if (host?.trim() && instance?.trim()) {
      serverRaw = host.trim();
      instanceName = instance.trim();
    }
  }

  const port = Number(input.port || 0) || portFromServer || 1433;
  return { server: serverRaw, port, instanceName };
}

async function resolveServerPreferIpv4(server: string): Promise<string> {
  const s = String(server || '').trim();
  if (!s) return s;
  if (looksLikeIpv4(s)) return s;

  try {
    const res = await dns.lookup(s, { family: 4 });
    return res?.address || s;
  } catch {
    return s;
  }
}

async function toSqlConfigResolved(
  settings: SqlSettings,
  dbOverride?: string
): Promise<sql.config> {
  const normalized = normalizeSqlServerInput({ server: settings.server, port: settings.port });
  const resolvedServer = await resolveServerPreferIpv4(normalized.server);
  const serverForConfig = normalized.instanceName
    ? `${resolvedServer}\\${normalized.instanceName}`
    : resolvedServer;
  return toSqlConfig({ ...settings, server: serverForConfig, port: normalized.port }, dbOverride);
}

function toSqlConfigRaw(opts: {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}): sql.config {
  const server = String(opts.server || '').trim();
  const database = String(opts.database || '').trim();
  const user = String(opts.user || '').trim();
  const password = String(opts.password || '');
  if (!server) throw new Error('اسم السيرفر مطلوب');
  if (!database) throw new Error('اسم قاعدة البيانات مطلوب');
  if (!user) throw new Error('اسم المستخدم مطلوب');
  if (!password) throw new Error('كلمة المرور مطلوبة');

  const normalized = normalizeSqlServerInput({ server, port: opts.port });
  const sniServerName = looksLikeIpv4(normalized.server) ? 'localhost' : normalized.server;

  return {
    server: normalized.server,
    port: normalized.port,
    database,
    user,
    password,
    options: {
      encrypt: opts.encrypt !== false,
      trustServerCertificate: opts.trustServerCertificate !== false,
      ...(opts.encrypt !== false ? { serverName: sniServerName } : {}),
      ...(normalized.instanceName ? { instanceName: normalized.instanceName } : {}),
    },
    pool: {
      max: 3,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 60000,
    connectionTimeout: 30000,
  };
}

async function toSqlConfigRawResolved(opts: {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}): Promise<sql.config> {
  const normalized = normalizeSqlServerInput({ server: opts.server, port: opts.port });
  const resolvedServer = await resolveServerPreferIpv4(normalized.server);
  const serverForConfig = normalized.instanceName
    ? `${resolvedServer}\\${normalized.instanceName}`
    : resolvedServer;
  return toSqlConfigRaw({ ...opts, server: serverForConfig, port: normalized.port });
}

function safeDateFromIso(value: string | undefined, fallback = new Date()): Date {
  const d = value ? new Date(String(value)) : new Date('');
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

function passwordKeyFragment(password: string | undefined): string {
  // Avoid storing plaintext password in memory keys while still detecting changes.
  const raw = String(password || '');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

async function ensureConnected(settings: SqlSettings): Promise<sql.ConnectionPool> {
  const desiredDb = String(settings.database || 'AZRAR').trim() || 'AZRAR';
  const normalized = normalizeSqlServerInput({
    server: String(settings.server || '').trim(),
    port: settings.port,
  });
  const resolvedServer = await resolveServerPreferIpv4(normalized.server);
  const desiredKey = [
    resolvedServer,
    String(Number(normalized.port || 1433) || 1433),
    String(normalized.instanceName || ''),
    desiredDb,
    String(settings.user || '').trim(),
    passwordKeyFragment(settings.password),
  ].join('|');

  if (pool && pool.connected && poolKey === desiredKey) return pool;

  await disconnectSql();

  const serverForConfig = normalized.instanceName
    ? `${resolvedServer}\\${normalized.instanceName}`
    : resolvedServer;
  const cfg = await toSqlConfigResolved({
    ...settings,
    server: serverForConfig,
    port: normalized.port,
  });
  const newPool = new sql.ConnectionPool(cfg);
  pool = await newPool.connect();
  poolKey = desiredKey;
  currentStatus = { ...currentStatus, connected: true, lastError: undefined };
  return pool;
}

export async function disconnectSql(): Promise<void> {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  try {
    await pool?.close();
  } catch {
    // ignore
  }
  pool = null;
  poolKey = null;
  currentStatus = { ...currentStatus, connected: false };
}

export async function testSqlConnection(
  settings: SqlSettings
): Promise<{ ok: boolean; message: string; code?: SqlResultCode }> {
  try {
    // connect to the requested DB (may not exist yet; that's okay for test if DB exists)
    const cfg = await toSqlConfigResolved(settings);
    const p = await new sql.ConnectionPool(cfg).connect();
    await p.close();
    return okResult('OK_SQL_CONNECTED', 'تم الاتصال بنجاح');
  } catch (e: unknown) {
    return errorResult('ERR_SQL_CONNECT_FAILED_SIMPLE', formatSqlErrorMessage(e, 'فشل الاتصال'));
  }
}

export async function connectAndEnsureDatabase(
  settings: SqlSettings
): Promise<{ ok: boolean; message: string; code?: SqlResultCode }> {
  try {
    // First connect to master and create DB if missing
    const dbName = String(settings.database || 'AZRAR').trim() || 'AZRAR';

    // NOTE: In many deployments, the app user does NOT have permission to connect to master
    // or create databases. We try this step, but we don't fail the whole sync if it errors.
    try {
      const cfgMaster = await toSqlConfigResolved({ ...settings, database: 'master' }, 'master');
      const masterPool = await new sql.ConnectionPool(cfgMaster).connect();

      await masterPool
        .request()
        .input('dbName', sql.NVarChar(128), dbName)
        .query(
          `IF DB_ID(@dbName) IS NULL
           BEGIN
             DECLARE @sql NVARCHAR(MAX) = N'CREATE DATABASE ' + QUOTENAME(@dbName);
             EXEC(@sql);
           END`
        );

      await masterPool.close();
    } catch {
      // Ignore: we'll attempt to connect to the target DB directly.
    }

    // Now connect to target DB and ensure schema
    const p = await ensureConnected({ ...settings, database: dbName });

    await p.request().query(
      `IF OBJECT_ID('dbo.KvStore', 'U') IS NULL
         BEGIN
           CREATE TABLE dbo.KvStore (
             [k] NVARCHAR(300) NOT NULL PRIMARY KEY,
             [v] NVARCHAR(MAX) NOT NULL,
             [updatedAt] DATETIME2(3) NOT NULL,
             [updatedBy] NVARCHAR(80) NULL,
             [isDeleted] BIT NOT NULL CONSTRAINT DF_KvStore_isDeleted DEFAULT(0)
           );
         END

         IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_KvStore_updatedAt' AND object_id = OBJECT_ID('dbo.KvStore'))
         BEGIN
           CREATE INDEX IX_KvStore_updatedAt ON dbo.KvStore(updatedAt);
         END

         IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_KvStore_isDeleted_updatedAt' AND object_id = OBJECT_ID('dbo.KvStore'))
         BEGIN
           CREATE INDEX IX_KvStore_isDeleted_updatedAt ON dbo.KvStore(isDeleted, updatedAt);
         END`
    );

    await ensureAttachmentFilesTable(p);

    currentStatus = {
      ...currentStatus,
      configured: true,
      enabled: !!settings.enabled,
      connected: true,
      lastError: undefined,
    };
    return okResult('OK_SQL_CONNECTED_READY', 'تم الاتصال وتجهيز قاعدة البيانات');
  } catch (e: unknown) {
    const msg = formatSqlErrorMessage(e, 'فشل الاتصال/التجهيز');
    currentStatus = { ...currentStatus, connected: false, lastError: msg };
    return errorResult('ERR_SQL_CONNECT_FAILED', msg);
  }
}

export async function provisionSqlServer(
  req: SqlProvisionRequest
): Promise<{ ok: boolean; message: string }> {
  try {
    const server = String(req.server || '').trim();
    const port = Number((getRecordProp(req, 'port') ?? 1433) as unknown) || 1433;
    const database = String(req.database || '').trim() || 'AZRAR_DB';
    const adminUser = String(req.adminUser || '').trim();
    const adminPassword = String(req.adminPassword || '');
    const managerUser = String(req.managerUser || '').trim() || 'azrar_manager';
    const managerPassword = String(req.managerPassword || '');
    const employeeUser = String(req.employeeUser || '').trim() || 'azrar_employee';
    const employeePassword = String(req.employeePassword || '');

    if (!server) throw new Error('اسم السيرفر مطلوب');
    if (!adminUser || !adminPassword) throw new Error('بيانات المدير (SQL) مطلوبة');
    if (!managerUser || !managerPassword)
      throw new Error('بيانات حساب المدير (داخل قاعدة البيانات) مطلوبة');
    if (!employeeUser || !employeePassword) throw new Error('بيانات حساب الموظفين مطلوبة');

    // 1) Connect to master with admin credentials
    const adminMasterCfg = await toSqlConfigRawResolved({
      server,
      port,
      database: 'master',
      user: adminUser,
      password: adminPassword,
      encrypt: req.encrypt,
      trustServerCertificate: req.trustServerCertificate,
    });

    const adminMasterPool = await new sql.ConnectionPool(adminMasterCfg).connect();

    // 2) Create DB if missing
    await adminMasterPool
      .request()
      .input('dbName', sql.NVarChar(128), database)
      .query(
        `IF DB_ID(@dbName) IS NULL
         BEGIN
           DECLARE @sql NVARCHAR(MAX) = N'CREATE DATABASE ' + QUOTENAME(@dbName);
           EXEC(@sql);
         END`
      );

    // 3) Create SQL logins for manager+employee (if missing)
    for (const login of [
      { name: managerUser, pwd: managerPassword },
      { name: employeeUser, pwd: employeePassword },
    ]) {
      await adminMasterPool
        .request()
        .input('loginName', sql.NVarChar(128), login.name)
        .input('pwd', sql.NVarChar(256), login.pwd)
        .query(
          `IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = @loginName)
           BEGIN
             DECLARE @sql NVARCHAR(MAX) = N'CREATE LOGIN ' + QUOTENAME(@loginName) + N' WITH PASSWORD = @pwd, CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF';
             EXEC sp_executesql @sql, N'@pwd NVARCHAR(256)', @pwd=@pwd;
           END`
        );
    }

    await adminMasterPool.close();

    // 4) Connect to target DB with admin and ensure table + user permissions
    const adminDbCfg = await toSqlConfigRawResolved({
      server,
      port,
      database,
      user: adminUser,
      password: adminPassword,
      encrypt: req.encrypt,
      trustServerCertificate: req.trustServerCertificate,
    });
    const adminDbPool = await new sql.ConnectionPool(adminDbCfg).connect();

    // Ensure schema/table
    await adminDbPool.request().query(
      `IF OBJECT_ID('dbo.KvStore', 'U') IS NULL
         BEGIN
           CREATE TABLE dbo.KvStore (
             [k] NVARCHAR(300) NOT NULL PRIMARY KEY,
             [v] NVARCHAR(MAX) NOT NULL,
             [updatedAt] DATETIME2(3) NOT NULL,
             [updatedBy] NVARCHAR(80) NULL,
             [isDeleted] BIT NOT NULL CONSTRAINT DF_KvStore_isDeleted DEFAULT(0)
           );
         END

         IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_KvStore_updatedAt' AND object_id = OBJECT_ID('dbo.KvStore'))
         BEGIN
           CREATE INDEX IX_KvStore_updatedAt ON dbo.KvStore(updatedAt);
         END

         IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_KvStore_isDeleted_updatedAt' AND object_id = OBJECT_ID('dbo.KvStore'))
         BEGIN
           CREATE INDEX IX_KvStore_isDeleted_updatedAt ON dbo.KvStore(isDeleted, updatedAt);
         END`
    );

    await ensureAttachmentFilesTable(adminDbPool);
    await ensureServerBackupsTable(adminDbPool);
    await ensureKvImportStagingTable(adminDbPool);

    // Create DB users if missing
    for (const loginName of [managerUser, employeeUser]) {
      await adminDbPool
        .request()
        .input('loginName', sql.NVarChar(128), loginName)
        .query(
          `IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = @loginName)
           BEGIN
             DECLARE @sql NVARCHAR(MAX) = N'CREATE USER ' + QUOTENAME(@loginName) + N' FOR LOGIN ' + QUOTENAME(@loginName);
             EXEC(@sql);
           END`
        );
    }

    // Permissions by role
    // - Employee: only CRUD on dbo.KvStore
    // - Manager: CRUD on dbo.KvStore (same as employee for now; keep server-level admin separate)
    for (const loginName of [employeeUser, managerUser]) {
      await adminDbPool
        .request()
        .input('loginName', sql.NVarChar(128), loginName)
        .query(
          `DECLARE @sql NVARCHAR(MAX) =
             N'GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.KvStore TO ' + QUOTENAME(@loginName) + N';'
             + N' GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.AttachmentFiles TO ' + QUOTENAME(@loginName) + N';'
             + N' GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.ServerBackups TO ' + QUOTENAME(@loginName) + N';'
             + N' GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.KvImportStaging TO ' + QUOTENAME(@loginName) + N';';
           EXEC(@sql);`
        );
    }

    await adminDbPool.close();

    // 5) Save app settings for normal usage (employees)
    await saveSqlSettings({
      enabled: true,
      server,
      port,
      database,
      authMode: 'sql',
      user: employeeUser,
      password: employeePassword,
      encrypt: req.encrypt !== false,
      trustServerCertificate: req.trustServerCertificate !== false,
    });

    // 6) Validate app login works
    const appCfg = await toSqlConfigRawResolved({
      server,
      port,
      database,
      user: employeeUser,
      password: employeePassword,
      encrypt: req.encrypt,
      trustServerCertificate: req.trustServerCertificate,
    });
    const appPool = await new sql.ConnectionPool(appCfg).connect();
    await appPool.request().query('SELECT TOP 1 k FROM dbo.KvStore;');
    await appPool.close();

    return okResult('OK_SQL_PROVISIONED', 'تمت تهيئة المخدم');
  } catch (e: unknown) {
    return errorResult('ERR_SQL_PROVISION_FAILED', formatSqlErrorMessage(e, 'فشل تهيئة المخدم'));
  }
}

export async function getSqlStatus(): Promise<SqlStatus> {
  const redacted = await loadSqlSettingsRedacted();
  currentStatus = {
    ...currentStatus,
    configured: !!redacted.server && !!redacted.database,
    enabled: !!redacted.enabled,
  };

  const base: SqlStatus = { ...currentStatus };

  if (!redacted.enabled || !currentStatus.connected) {
    return {
      ...base,
      clockSkewMs: undefined,
      clockSkewWarning: false,
      serverTimeIso: undefined,
    };
  }

  try {
    const settings = await loadSqlSettings();
    const p = await ensureConnected(settings);
    const r = await p.request().query(`SELECT SYSUTCDATETIME() AS serverUtc;`);
    const row = (r.recordset || [])[0] as { serverUtc?: Date } | undefined;
    const t = row?.serverUtc ? new Date(row.serverUtc).getTime() : NaN;
    const clientMs = Date.now();
    if (!Number.isFinite(t)) {
      return { ...base, clockSkewWarning: false };
    }
    const skew = Math.abs(clientMs - t);
    return {
      ...base,
      clockSkewMs: skew,
      clockSkewWarning: skew > SQL_CLOCK_SKEW_WARN_MS,
      serverTimeIso: new Date(t).toISOString(),
    };
  } catch {
    return { ...base, clockSkewWarning: false };
  }
}

export async function getRemoteKvStoreMeta(): Promise<{
  ok: boolean;
  items: Array<{ key: string; updatedAt: string; isDeleted: boolean }>;
  message?: string;
  code?: SqlResultCode;
}> {
  try {
    const settings = await loadSqlSettings();
    if (!settings.enabled)
      return errorResult('ERR_SQL_DISABLED', 'المزامنة غير مفعلة', { items: [] });

    const ensured = await connectAndEnsureDatabase(settings);
    if (!ensured.ok) return ensureError(ensured, 'فشل الاتصال/التجهيز', { items: [] });

    const p = await ensureConnected(settings);
    const result = await p
      .request()
      .query(
        "SELECT k, updatedAt, isDeleted FROM dbo.KvStore WHERE k LIKE N'db\\_%' ESCAPE '\\' ORDER BY k ASC;"
      );

    const rows = (result.recordset || []) as Array<{
      k: string;
      updatedAt: Date;
      isDeleted: boolean;
    }>;
    const items = rows
      .filter((r) => !!r?.k)
      .map((r) => ({
        key: String(r.k),
        updatedAt: new Date(r.updatedAt).toISOString(),
        isDeleted: !!r.isDeleted,
      }));

    return { ok: true, items };
  } catch (e: unknown) {
    return errorResult(
      'ERR_SQL_BACKUP_READ_FAILED',
      formatSqlErrorMessage(e, 'فشل قراءة بيانات المخدم'),
      { items: [] }
    );
  }
}

export async function getRemoteKvStoreRow(key: string): Promise<{
  ok: boolean;
  row?: { key: string; value: string; updatedAt: string; isDeleted: boolean };
  message?: string;
  code?: SqlResultCode;
}> {
  try {
    const k = String(key || '').trim();
    if (!k) return errorResult('ERR_SQL_INVALID_KEY', 'المفتاح غير صالح');

    const settings = await loadSqlSettings();
    if (!settings.enabled) return errorResult('ERR_SQL_DISABLED', 'المزامنة غير مفعلة');

    const ensured = await connectAndEnsureDatabase(settings);
    if (!ensured.ok) return ensureError(ensured, 'فشل الاتصال/التجهيز');

    const p = await ensureConnected(settings);
    const res = await p
      .request()
      .input('k', sql.NVarChar(300), k)
      .query('SELECT TOP 1 k, v, updatedAt, isDeleted FROM dbo.KvStore WHERE k = @k;');

    const row = ((res.recordset || [])[0] ?? null) as unknown;
    const rowKey = getRecordProp(row, 'k');
    if (!rowKey) return { ok: true, row: undefined };
    return {
      ok: true,
      row: {
        key: String(rowKey),
        value: (() => {
          const v = getRecordProp(row, 'v');
          return typeof v === 'string' ? v : String(v ?? '');
        })(),
        updatedAt: toDate(getRecordProp(row, 'updatedAt')).toISOString(),
        isDeleted: !!getRecordProp(row, 'isDeleted'),
      },
    };
  } catch (e: unknown) {
    return errorResult(
      'ERR_SQL_REMOTE_ROW_FAILED',
      formatSqlErrorMessage(e, 'فشل قراءة سجل من المخدم')
    );
  }
}

export async function exportServerBackupToFile(
  filePath: string,
  overrideSettings?: SqlSettings
): Promise<{
  ok: boolean;
  message: string;
  filePath?: string;
  rowCount?: number;
  code?: SqlResultCode;
}> {
  try {
    const settings = overrideSettings ?? (await loadSqlSettings());
    if (!settings.server?.trim())
      return errorResult('ERR_SQL_SERVER_REQUIRED', 'اسم السيرفر مطلوب');
    if (!settings.database?.trim())
      return errorResult('ERR_SQL_DATABASE_REQUIRED', 'اسم قاعدة البيانات مطلوب');

    // Ensure DB & schema exist and connect
    const ensured = await connectAndEnsureDatabase({ ...settings, enabled: true });
    if (!ensured.ok) return ensureError(ensured, 'فشل الاتصال/التجهيز');

    const p = await ensureConnected({ ...settings, enabled: true });
    const result = await p.request().query(
      `SELECT k, v, updatedAt, updatedBy, isDeleted
         FROM dbo.KvStore
         ORDER BY updatedAt ASC;`
    );

    const rows = (result.recordset || []) as Array<{
      k: string;
      v: string;
      updatedAt: Date;
      updatedBy?: string;
      isDeleted: boolean;
    }>;

    const payload = {
      kind: 'AZRAR_SQL_BACKUP',
      version: 1,
      exportedAt: new Date().toISOString(),
      database: String(settings.database || ''),
      server: String(settings.server || ''),
      port: Number(settings.port || 1433) || 1433,
      rowCount: rows.length,
      rows: rows.map((r) => ({
        k: String(r.k),
        v: typeof r.v === 'string' ? r.v : String(r.v ?? ''),
        updatedAt: new Date(r.updatedAt).toISOString(),
        updatedBy: r.updatedBy ? String(r.updatedBy) : undefined,
        isDeleted: !!r.isDeleted,
      })),
    };

    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

    return okResult('OK_SQL_BACKUP_EXPORTED', 'تم إنشاء نسخة احتياطية من المخدم', {
      filePath,
      rowCount: rows.length,
    });
  } catch (e: unknown) {
    return errorResult(
      'ERR_SQL_BACKUP_EXPORT_FAILED',
      formatSqlErrorMessage(e, 'فشل إنشاء النسخة الاحتياطية من المخدم')
    );
  }
}

type ServerBackupRow = {
  k: string;
  v: string;
  updatedAt: string;
  updatedBy?: string;
  isDeleted: boolean;
};

type ServerBackupFileV1 = {
  kind: 'AZRAR_SQL_BACKUP';
  version: 1;
  exportedAt: string;
  database?: string;
  server?: string;
  port?: number;
  rowCount?: number;
  rows: ServerBackupRow[];
};

function isBackupFileV1(obj: unknown): obj is ServerBackupFileV1 {
  return (
    isRecord(obj) &&
    getRecordProp(obj, 'kind') === 'AZRAR_SQL_BACKUP' &&
    getRecordProp(obj, 'version') === 1 &&
    Array.isArray(getRecordProp(obj, 'rows'))
  );
}

function normalizeBackupRow(r: unknown): ServerBackupRow {
  const k = String(getRecordProp(r, 'k') || '');
  if (!k) throw new Error('ملف النسخة الاحتياطية يحتوي على صف بدون مفتاح');
  const updatedAtRaw = getRecordProp(r, 'updatedAt');
  const updatedAt = toDate(updatedAtRaw).toISOString();
  const isDeleted = !!getRecordProp(r, 'isDeleted');
  const v = isDeleted ? '' : String(getRecordProp(r, 'v') ?? '');
  const updatedByRaw = getRecordProp(r, 'updatedBy');
  const updatedBy = updatedByRaw ? String(updatedByRaw) : undefined;
  return { k, v, updatedAt, updatedBy, isDeleted };
}

async function bulkToStagingTable(
  tx: sql.Transaction,
  batchId: string,
  rows: ServerBackupRow[]
): Promise<void> {
  const table = new sql.Table('dbo.KvImportStaging');
  table.create = false;
  table.columns.add('batchId', sql.UniqueIdentifier, { nullable: false });
  table.columns.add('k', sql.NVarChar(300), { nullable: false });
  table.columns.add('v', sql.NVarChar(sql.MAX), { nullable: false });
  table.columns.add('updatedAt', sql.DateTime2(3), { nullable: false });
  table.columns.add('updatedBy', sql.NVarChar(80), { nullable: true });
  table.columns.add('isDeleted', sql.Bit, { nullable: false });

  for (const r of rows) {
    table.rows.add(
      batchId,
      r.k,
      r.isDeleted ? '' : r.v,
      new Date(r.updatedAt),
      r.updatedBy ?? null,
      r.isDeleted ? 1 : 0
    );
  }

  const req = new sql.Request(tx);
  (req as unknown as { timeout?: number }).timeout = 60000;
  await (req as unknown as { bulk: (t: sql.Table) => Promise<unknown> }).bulk(table);
}

export async function importServerBackupFromFile(
  filePath: string,
  mode: 'merge' | 'replace'
): Promise<{
  ok: boolean;
  message: string;
  filePath?: string;
  rowCount?: number;
  applied?: number;
  code?: SqlResultCode;
}> {
  try {
    const settings = await loadSqlSettings();
    if (!settings.server?.trim())
      return errorResult('ERR_SQL_SERVER_REQUIRED', 'اسم السيرفر مطلوب');
    if (!settings.database?.trim())
      return errorResult('ERR_SQL_DATABASE_REQUIRED', 'اسم قاعدة البيانات مطلوب');

    const raw = await fsp.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!isBackupFileV1(parsed))
      return errorResult('ERR_SQL_BACKUP_FILE_INVALID', 'ملف النسخة الاحتياطية غير صالح');

    const rows = (parsed.rows || []).map(normalizeBackupRow);

    // Ensure DB & schema exist and connect
    const ensured = await connectAndEnsureDatabase({ ...settings, enabled: true });
    if (!ensured.ok) return ensureError(ensured, 'فشل الاتصال/التجهيز');

    const p = await ensureConnected({ ...settings, enabled: true });
    await ensureKvImportStagingTable(p);

    // Transaction for atomic apply
    const tx = new sql.Transaction(p);
    await tx.begin();
    try {
      const req = new sql.Request(tx);

      if (mode === 'replace') {
        await req.query('DELETE FROM dbo.KvStore;');

        // For replace, bulk directly into dbo.KvStore
        const table = new sql.Table('dbo.KvStore');
        table.create = false;
        table.columns.add('k', sql.NVarChar(300), { nullable: false });
        table.columns.add('v', sql.NVarChar(sql.MAX), { nullable: false });
        table.columns.add('updatedAt', sql.DateTime2(3), { nullable: false });
        table.columns.add('updatedBy', sql.NVarChar(80), { nullable: true });
        table.columns.add('isDeleted', sql.Bit, { nullable: false });

        for (const r of rows) {
          table.rows.add(
            r.k,
            r.isDeleted ? '' : r.v,
            new Date(r.updatedAt),
            r.updatedBy ?? null,
            r.isDeleted ? 1 : 0
          );
        }

        const bulkReq = new sql.Request(tx);
        (bulkReq as unknown as { timeout?: number }).timeout = 60000;
        await (bulkReq as unknown as { bulk: (t: sql.Table) => Promise<unknown> }).bulk(table);
        await tx.commit();
        return okResult(
          'OK_SQL_BACKUP_RESTORED_LOCAL',
          'تمت الاستعادة الكاملة من النسخة الاحتياطية',
          {
            filePath,
            rowCount: rows.length,
            applied: rows.length,
          }
        );
      }

      // Merge mode
      const batchId = crypto.randomUUID();
      await bulkToStagingTable(tx, batchId, rows);
      req.input('batchId', sql.UniqueIdentifier, batchId);
      const mergeRes = await req.query(
        `MERGE dbo.KvStore AS T
         USING (
           SELECT k, v, updatedAt, updatedBy, isDeleted
           FROM dbo.KvImportStaging
           WHERE batchId = @batchId
         ) AS S
         ON (T.k = S.k)
         WHEN MATCHED AND T.updatedAt < S.updatedAt THEN
           UPDATE SET
             v = CASE WHEN S.isDeleted = 1 THEN N'' ELSE S.v END,
             updatedAt = S.updatedAt,
             updatedBy = S.updatedBy,
             isDeleted = S.isDeleted
         WHEN NOT MATCHED THEN
           INSERT (k, v, updatedAt, updatedBy, isDeleted)
           VALUES (S.k, CASE WHEN S.isDeleted = 1 THEN N'' ELSE S.v END, S.updatedAt, S.updatedBy, S.isDeleted);
         SELECT @@ROWCOUNT AS affected;`
      );

      await req.query('DELETE FROM dbo.KvImportStaging WHERE batchId = @batchId;');

      const mergeRecordset = getRecordProp(mergeRes, 'recordset');
      const first = Array.isArray(mergeRecordset) ? mergeRecordset[0] : undefined;
      const affected = Number(getRecordProp(first, 'affected') ?? 0) || 0;
      await tx.commit();
      return okResult('OK_SQL_BACKUP_MERGED_LOCAL', 'تم دمج النسخة الاحتياطية مع بيانات المخدم', {
        filePath,
        rowCount: rows.length,
        applied: affected,
      });
    } catch (e) {
      try {
        await tx.rollback();
      } catch {
        // ignore
      }
      throw e;
    }
  } catch (e: unknown) {
    return errorResult(
      'ERR_SQL_BACKUP_IMPORT_FAILED',
      formatSqlErrorMessage(e, 'فشل استيراد النسخة الاحتياطية إلى المخدم')
    );
  }
}

type State = {
  lastPullAt?: string;
  lastPullKey?: string;
};

async function loadState(): Promise<State> {
  return await readJsonFile<State>(getStatePath(), {});
}

async function saveState(next: State): Promise<void> {
  await writeJsonFile(getStatePath(), next);
}

export async function resetSqlPullState(): Promise<void> {
  await saveState({});
}

export function beginIgnoreLocalWrites(count = 1) {
  ignoreNextLocalWrites = Math.max(ignoreNextLocalWrites, count);
}

function shouldIgnoreLocalWrite(): boolean {
  if (ignoreNextLocalWrites > 0) {
    ignoreNextLocalWrites -= 1;
    return true;
  }
  return false;
}

export async function pushKvUpsert(payload: {
  key: string;
  value: string;
  updatedAt: string;
}): Promise<void> {
  if (shouldIgnoreLocalWrite()) return;

  const settings = await loadSqlSettings();
  if (!settings.enabled) return;

  const p = await ensureConnected(settings);
  const deviceId = await getOrCreateDeviceId();
  const updatedAt = safeDateFromIso(payload.updatedAt, new Date());

  await p
    .request()
    .input('k', sql.NVarChar(300), payload.key)
    .input('v', sql.NVarChar(sql.MAX), payload.value)
    .input('updatedAt', sql.DateTime2(3), updatedAt)
    .input('updatedBy', sql.NVarChar(80), deviceId)
    .query(
      `MERGE dbo.KvStore AS T
       USING (SELECT @k AS k) AS S
       ON (T.k = S.k)
       WHEN MATCHED AND T.updatedAt < @updatedAt THEN
         UPDATE SET v=@v, updatedAt=@updatedAt, updatedBy=@updatedBy, isDeleted=0
       WHEN NOT MATCHED THEN
         INSERT (k, v, updatedAt, updatedBy, isDeleted)
         VALUES (@k, @v, @updatedAt, @updatedBy, 0);
      `
    );

  // If attachments metadata changed, also push the actual files to SQL.
  if (payload.key === ATTACHMENTS_KV_KEY) {
    await pushAttachmentFilesForAttachmentsJson(payload.value);
  }
}

export async function pushKvDelete(payload: { key: string; deletedAt: string }): Promise<void> {
  if (shouldIgnoreLocalWrite()) return;

  const settings = await loadSqlSettings();
  if (!settings.enabled) return;

  const p = await ensureConnected(settings);
  const deviceId = await getOrCreateDeviceId();
  const deletedAt = safeDateFromIso(payload.deletedAt, new Date());

  await p
    .request()
    .input('k', sql.NVarChar(300), payload.key)
    .input('updatedAt', sql.DateTime2(3), deletedAt)
    .input('updatedBy', sql.NVarChar(80), deviceId)
    .query(
      `MERGE dbo.KvStore AS T
       USING (SELECT @k AS k) AS S
       ON (T.k = S.k)
       WHEN MATCHED AND T.updatedAt < @updatedAt THEN
         UPDATE SET v=N'', updatedAt=@updatedAt, updatedBy=@updatedBy, isDeleted=1
       WHEN NOT MATCHED THEN
         INSERT (k, v, updatedAt, updatedBy, isDeleted)
         VALUES (@k, N'', @updatedAt, @updatedBy, 1);
      `
    );
}

export async function startBackgroundPull(
  applyRemoteChange: (row: {
    k: string;
    v: string;
    updatedAt: string;
    isDeleted: boolean;
  }) => Promise<void>,
  opts?: { runImmediately?: boolean; forceFullPull?: boolean }
): Promise<void> {
  const settings = await loadSqlSettings();
  if (!settings.enabled) return;

  // Ensure connected and schema exists
  const ensured = await connectAndEnsureDatabase(settings);
  if (!ensured.ok) {
    currentStatus = { ...currentStatus, lastError: ensured.message || 'فشل الاتصال/التجهيز' };
    return;
  }

  if (syncTimer) return;

  if (opts?.runImmediately !== false) {
    try {
      await pullKvStoreOnce(applyRemoteChange, opts?.forceFullPull ? new Date(0) : undefined);
    } catch (e: unknown) {
      currentStatus = { ...currentStatus, lastError: formatSqlErrorMessage(e, 'فشل المزامنة') };
    }
  }

  syncTimer = setInterval(() => {
    if (syncInProgress) return;
    syncInProgress = true;
    void pullKvStoreOnce(applyRemoteChange)
      .catch((e: unknown) => {
        currentStatus = { ...currentStatus, lastError: formatSqlErrorMessage(e, 'فشل المزامنة') };
      })
      .finally(() => {
        syncInProgress = false;
      });
  }, 5000);
}

export type SqlKvPullRow = {
  k: string;
  v: string;
  updatedAt: string;
  isDeleted: boolean;
};

/** One incremental pull from dbo.KvStore (used by background loop and sql:syncNow). */
export async function pullKvStoreOnce(
  applyRemoteChange: (row: SqlKvPullRow) => Promise<void>,
  sinceOverride?: Date,
  sinceKeyOverride?: string
): Promise<number> {
  const settings = await loadSqlSettings();
  if (!settings.enabled) return 0;

  const st = await loadState();
  const parsedSince = st.lastPullAt ? new Date(st.lastPullAt) : new Date(0);
  const since = sinceOverride ?? (Number.isNaN(parsedSince.getTime()) ? new Date(0) : parsedSince);
  const sinceKey = sinceKeyOverride ?? (sinceOverride ? '' : (st.lastPullKey ?? ''));

  const p = await ensureConnected(settings);
  const result = await p
    .request()
    .input('since', sql.DateTime2(3), since)
    .input('sinceKey', sql.NVarChar(300), sinceKey)
    .query(
      `SELECT k, v, updatedAt, isDeleted
       FROM dbo.KvStore
       WHERE (updatedAt > @since OR (updatedAt = @since AND k > @sinceKey))
         AND k LIKE N'db\\_%' ESCAPE '\\'
       ORDER BY updatedAt ASC, k ASC
       OFFSET 0 ROWS FETCH NEXT 500 ROWS ONLY;`
    );

  const rows = (result.recordset || []) as Array<{
    k: string;
    v: string;
    updatedAt: Date;
    isDeleted: boolean;
  }>;
  let maxUpdatedAt = since;
  let lastKey = sinceKey;

  for (const r of rows) {
    const updatedAtIso = new Date(r.updatedAt).toISOString();
    await applyRemoteChange({
      k: r.k,
      v: r.v ?? '',
      updatedAt: updatedAtIso,
      isDeleted: !!r.isDeleted,
    });
    if (r.updatedAt > maxUpdatedAt) {
      maxUpdatedAt = r.updatedAt;
      lastKey = r.k;
    } else if (r.updatedAt.getTime() === maxUpdatedAt.getTime() && r.k > lastKey) {
      lastKey = r.k;
    }
  }

  if (maxUpdatedAt > since || (maxUpdatedAt >= since && lastKey > sinceKey)) {
    await saveState({ ...st, lastPullAt: maxUpdatedAt.toISOString(), lastPullKey: lastKey });
    currentStatus = {
      ...currentStatus,
      lastSyncAt: new Date().toISOString(),
      lastError: undefined,
    };
  }

  return rows.length;
}

/**
 * Repeats {@link pullKvStoreOnce} until a page returns 0 rows (KvStore can exceed 500 keys).
 * Use after {@link resetSqlPullState} when the local DB is empty but the server has a snapshot.
 */
export async function pullKvStoreDrain(
  applyRemoteChange: (row: SqlKvPullRow) => Promise<void>,
  opts?: { maxRounds?: number }
): Promise<{ rounds: number; rows: number }> {
  const maxRounds = Math.max(1, opts?.maxRounds ?? 10_000);
  let rounds = 0;
  let rows = 0;
  for (;;) {
    rounds += 1;
    if (rounds > maxRounds) break;
    const n = await pullKvStoreOnce(applyRemoteChange);
    rows += n;
    if (n === 0) break;
  }
  return { rounds, rows };
}

/**
 * Runs the SQL Express installation PowerShell script and streams logs.
 */
export async function runSetupScript(
  onLog: (line: string) => void
): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    try {
      // Find the script. In production, it's in the app root (extraFiles).
      // In dev, it's in build/
      const isDev = !app.isPackaged;
      const scriptPath = isDev
        ? path.join(app.getAppPath(), 'build', 'sql-express-install.ps1')
        : path.join(path.dirname(app.getPath('exe')), 'sql-express-install.ps1');

      if (!fs.existsSync(scriptPath)) {
        resolve({ ok: false, message: `السكربت غير موجود في المسار: ${scriptPath}` });
        return;
      }

      onLog(`[SYSTEM] بدء تشغيل السكربت: ${scriptPath}`);

      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
      ]);

      ps.stdout.on('data', (data) => {
        const str = data.toString('utf8');
        str.split(/\r?\n/).forEach((line: string) => {
          if (line.trim()) onLog(line);
        });
      });

      ps.stderr.on('data', (data) => {
        const str = data.toString('utf8');
        str.split(/\r?\n/).forEach((line: string) => {
          if (line.trim()) onLog(`[ERROR] ${line}`);
        });
      });

      ps.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true, message: 'تم التثبيت بنجاح' });
        } else {
          resolve({ ok: false, message: `فشل التثبيت. كود الخطأ: ${code}` });
        }
      });

      ps.on('error', (err) => {
        resolve({ ok: false, message: `خطأ في تشغيل العملية: ${err.message}` });
      });
    } catch (e: unknown) {
      resolve({
        ok: false,
        message: e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء تشغيل الإعداد',
      });
    }
  });
}

const execAsync = promisify(exec);

/**
 * Checks if the current process has administrative privileges.
 */
export async function checkIsAdmin(): Promise<boolean> {
  if (process.platform !== 'win32') return true;
  try {
    const { stdout } = await execAsync('net session');
    return !!stdout;
  } catch {
    return false;
  }
}

