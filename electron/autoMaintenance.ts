import path from 'node:path';
import fsSync from 'node:fs';
import fsp from 'node:fs/promises';
import { app } from 'electron';
import { getDb, getDbPath, kvGet, kvSet } from './db';

function isoDateOnly(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function safeParseIsoDateOnly(s: string): Date | null {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(String(s || '').trim());
  if (!m) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dataRootDir(): string {
  return path.dirname(getDbPath());
}

function getBackupRootDir(): string {
  return path.join(dataRootDir(), 'backups');
}

function preferredAttachmentsDir(): string {
  // Keep attachments in the same stable data directory as the DB.
  return path.join(dataRootDir(), 'attachments');
}

function fallbackAttachmentsDir(): string {
  return path.join(dataRootDir(), 'attachments');
}

function lastResortAttachmentsDir(): string {
  return path.join(app.getPath('userData'), 'attachments');
}

function directoryExists(p: string): boolean {
  try {
    return fsSync.existsSync(p) && fsSync.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

async function dirHasAnyFiles(dir: string): Promise<boolean> {
  try {
    const entries = await fsp.readdir(dir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function resolveAttachmentsDirForBackup(): Promise<string | null> {
  const candidates = [preferredAttachmentsDir(), fallbackAttachmentsDir(), lastResortAttachmentsDir()];

  // Prefer the first directory that exists and is non-empty.
  for (const c of candidates) {
    if (!directoryExists(c)) continue;
    if (await dirHasAnyFiles(c)) return c;
  }

  // Otherwise fall back to the first directory that exists.
  for (const c of candidates) {
    if (directoryExists(c)) return c;
  }

  return null;
}

async function safeRm(p: string) {
  try {
    await fsp.rm(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function cleanupOldBackups(backupRoot: string, retentionDays = 30): Promise<void> {
  try {
    const entries = await fsp.readdir(backupRoot, { withFileTypes: true });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const dirName = e.name;
      const full = path.join(backupRoot, dirName);

      // Prefer parsing from folder name YYYY-MM-DD, else use mtime.
      const parsed = safeParseIsoDateOnly(dirName);
      let t = parsed?.getTime();
      if (!t) {
        try {
          t = (await fsp.stat(full)).mtime.getTime();
        } catch {
          continue;
        }
      }

      if (t < cutoff.getTime()) {
        await safeRm(full);
      }
    }
  } catch {
    // Best-effort only.
  }
}

async function backupDbTo(dbBackupPath: string): Promise<void> {
  // Prefer better-sqlite3 online backup API if available.
  const db: any = getDb();
  if (typeof db?.backup === 'function') {
    await db.backup(dbBackupPath);
    return;
  }

  // Fallback: close, copy DB file, reopen (matches exportDatabase behavior).
  // This is less ideal but still consistent for our single-process desktop usage.
  const { exportDatabase } = await import('./db');
  await exportDatabase(dbBackupPath);
}

async function copyDirRecursive(src: string, dst: string): Promise<void> {
  // Node 16+ supports fs.cp; Electron 33 uses a modern Node runtime.
  // Use force=true to overwrite within the daily folder if re-run.
  await fsp.cp(src, dst, { recursive: true, force: true });
}

async function runDailyBackupOnce(): Promise<void> {
  // Ensure DB exists (also triggers PRAGMA + index initialization in ./db).
  getDb();

  const today = isoDateOnly();
  const last = kvGet('sys:lastAutoBackupDate');

  const backupRoot = getBackupRootDir();
  const todayDir = path.join(backupRoot, today);

  // If we already backed up today and the folder exists, skip.
  if (last === today && directoryExists(todayDir)) {
    return;
  }

  await fsp.mkdir(todayDir, { recursive: true });

  // 1) Backup DB
  const dbBackupPath = path.join(todayDir, 'khaberni.sqlite');
  await backupDbTo(dbBackupPath);

  // 2) Backup attachments (if present)
  const attachmentsDir = await resolveAttachmentsDirForBackup();
  if (attachmentsDir) {
    const dst = path.join(todayDir, 'attachments');
    await copyDirRecursive(attachmentsDir, dst);
  }

  // 3) Write small metadata for troubleshooting
  const meta = {
    createdAt: new Date().toISOString(),
    dbPath: getDbPath(),
    attachmentsPath: attachmentsDir,
  };
  try {
    await fsp.writeFile(path.join(todayDir, 'backup.json'), JSON.stringify(meta, null, 2), 'utf8');
  } catch {
    // ignore
  }

  kvSet('sys:lastAutoBackupDate', today);

  // 4) Cleanup old backups
  await cleanupOldBackups(backupRoot, 30);
}

let started = false;

export function startAutoMaintenance(): void {
  if (started) return;
  started = true;

  // Run soon after startup, then periodically.
  const kick = () => {
    void runDailyBackupOnce().catch(() => {
      // Best-effort: do not crash app
    });
  };

  setTimeout(kick, 20_000);

  // Check hourly; actual work runs at most once/day.
  setInterval(kick, 60 * 60 * 1000);
}
