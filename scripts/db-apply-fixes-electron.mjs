#!/usr/bin/env node
/**
 * Apply DB fixes using Electron runtime (so better-sqlite3 loads with Electron ABI).
 *
 * What it does:
 * - Resolves/accepts a DB path.
 * - Creates a safety backup of the DB file + WAL/SHM sidecars.
 * - Runs a WAL checkpoint (FULL).
 * - Applies recommended indexes and partial-unique indexes.
 *
 * Usage:
 *   npx electron scripts/db-apply-fixes-electron.mjs -- --db "C:\\path\\to\\khaberni.sqlite" --yes
 *
 * Notes:
 * - Close the desktop app before running to avoid locks.
 * - If --db is omitted, it tries to auto-pick the most recently modified khaberni.sqlite under %APPDATA%.
 */

import { app } from 'electron';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const nowIso = () => new Date().toISOString();

function parseArgs(argv) {
  const args = { db: '', yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = String(argv[i] ?? '');
    if (a === '--db') {
      args.db = String(argv[i + 1] ?? '');
      i++;
      continue;
    }
    if (a === '--yes') {
      args.yes = true;
      continue;
    }
  }
  return args;
}

async function statSafe(p) {
  try {
    const st = await fsp.stat(p);
    return { exists: true, sizeBytes: st.size, mtime: st.mtime?.toISOString?.() ?? null };
  } catch {
    return { exists: false };
  }
}

async function findNewestDbUnderAppData() {
  const appData = String(process.env.APPDATA ?? '').trim();
  if (!appData) return '';

  // Best-effort scan for khaberni.sqlite under %APPDATA% (skip obvious huge folders).
  const targetName = 'khaberni.sqlite';
  const skipDirNames = new Set(['node_modules', '.git', '.vs']);

  let best = { path: '', mtimeMs: 0 };

  async function walk(dir, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      const name = ent.name;
      if (ent.isDirectory()) {
        if (skipDirNames.has(name)) continue;
        // Avoid scanning some known heavy Windows folders
        if (name.toLowerCase() === 'microsoft') continue;
        await walk(path.join(dir, name), depth + 1);
        continue;
      }

      if (!ent.isFile()) continue;
      if (name !== targetName) continue;

      const p = path.join(dir, name);
      if (p.toLowerCase().includes(`${path.sep}backups${path.sep}`)) continue;

      try {
        const st = await fsp.stat(p);
        const m = Number(st.mtimeMs ?? 0) || 0;
        if (m > best.mtimeMs) best = { path: p, mtimeMs: m };
      } catch {
        // ignore
      }
    }
  }

  await walk(appData, 0);
  return best.path;
}

async function copyIfExists(src, destDir) {
  const base = path.basename(src);
  const dest = path.join(destDir, base);
  if (!fs.existsSync(src)) return { copied: false, src, dest };
  await fsp.copyFile(src, dest);
  return { copied: true, src, dest };
}

function splitSqlStatements(sqlText) {
  // Simple splitter for our fix files (no semicolons inside strings in these files).
  // Removes line comments and trims.
  const withoutLineComments = sqlText
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

  return withoutLineComments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const args = parseArgs(rawArgs);

  // Ensure app name is stable for any Electron paths.
  // (Doesn't change DB path here when --db provided, but keeps behavior consistent.)
  if (process.env.AZRAR_APP_NAME) {
    app.setName(String(process.env.AZRAR_APP_NAME));
  }

  await app.whenReady();

  const report = {
    ok: true,
    ranAt: nowIso(),
    selectedDbPath: '',
    reason: '',
    backupDir: '',
    backups: [],
    checkpoint: null,
    applied: [],
    errors: [],
    notes: [],
  };

  let dbPath = String(args.db ?? '').trim();
  if (!dbPath) {
    const auto = await findNewestDbUnderAppData();
    if (!auto) {
      report.ok = false;
      report.errors.push('Could not auto-locate khaberni.sqlite under %APPDATA%. Pass --db.');
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      try { app.exit(2); } catch (e) { void e; }
      return;
    }
    dbPath = auto;
    report.reason = 'auto:newest-under-appdata';
  } else {
    report.reason = 'explicit';
  }

  report.selectedDbPath = dbPath;

  if (!args.yes) {
    report.ok = false;
    report.errors.push('Refusing to proceed without --yes (safety).');
    report.notes.push('Re-run with: --yes');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    try { app.exit(3); } catch (e) { void e; }
    return;
  }

  const st = await statSafe(dbPath);
  if (!st.exists) {
    report.ok = false;
    report.errors.push(`DB file not found: ${dbPath}`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    try { app.exit(1); } catch (e) { void e; }
    return;
  }

  // Backup (include WAL/SHM if present)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseDir = path.dirname(dbPath);
  const backupDir = path.join(baseDir, 'backups', `manual-${stamp}`);
  await fsp.mkdir(backupDir, { recursive: true });
  report.backupDir = backupDir;

  report.backups.push(await copyIfExists(dbPath, backupDir));
  report.backups.push(await copyIfExists(`${dbPath}-wal`, backupDir));
  report.backups.push(await copyIfExists(`${dbPath}-shm`, backupDir));

  // Force DB path via env so app DB resolver matches.
  process.env.AZRAR_DESKTOP_DB_PATH = dbPath;

  const dbJsUrl = pathToFileURL(path.join(process.cwd(), 'electron', 'db.js')).href;
  const dbMod = await import(dbJsUrl);
  const getDb = dbMod.getDb;

  if (typeof getDb !== 'function') {
    report.ok = false;
    report.errors.push('electron/db.js does not export getDb()');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    try { app.exit(1); } catch (e) { void e; }
    return;
  }

  let db;
  try {
    db = getDb();
  } catch (e) {
    report.ok = false;
    report.errors.push(`Failed to open DB via app runtime: ${String(e?.message ?? e)}`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    try { app.exit(1); } catch (err) { void err; }
    return;
  }

  try {
    // Ensure FK enforcement is on for this connection.
    try { db.pragma('foreign_keys = ON'); } catch (e) { void e; }

    // Acquire a write lock early to fail fast if DB is in use.
    db.exec('BEGIN IMMEDIATE;');

    // Merge WAL into main DB so subsequent reads/writes are consistent.
    try {
      const rows = db.pragma('wal_checkpoint(FULL)');
      report.checkpoint = rows;
    } catch (e) {
      report.notes.push(`wal_checkpoint(FULL) failed: ${String(e?.message ?? e)}`);
    }

    const fixesDir = path.join(process.cwd(), 'scripts', 'db-fixes');

    const applyFile = async (fileName, mode) => {
      const full = path.join(fixesDir, fileName);
      const sql = await fsp.readFile(full, 'utf8');

      if (mode === 'exec-all') {
        db.exec(sql);
        report.applied.push({ file: fileName, mode, ok: true });
        return;
      }

      // mode: statement-by-statement (keeps going on failures)
      const stmts = splitSqlStatements(sql);
      let okCount = 0;
      let failCount = 0;
      for (const s of stmts) {
        try {
          db.exec(s);
          okCount++;
        } catch (e) {
          failCount++;
          report.errors.push(`${fileName}: ${String(e?.message ?? e)} (stmt: ${s.slice(0, 120)}...)`);
        }
      }
      report.applied.push({ file: fileName, mode, ok: failCount === 0, okCount, failCount });
    };

    // 01: safe indexes
    await applyFile('01_missing_indexes.sql', 'exec-all');

    // 02: partial unique (can fail if duplicates exist)
    await applyFile('02_unique_partial_indexes.sql', 'per-statement');

    // Optional optimizer
    try {
      db.exec('ANALYZE;');
      db.exec('PRAGMA optimize;');
    } catch (e) {
      void e;
    }

    db.exec('COMMIT;');

    // Final checkpoint after schema changes.
    try {
      db.pragma('wal_checkpoint(FULL)');
    } catch (e) {
      void e;
    }
  } catch (e) {
    try { db.exec('ROLLBACK;'); } catch (err) { void err; }
    report.ok = false;
    report.errors.push(`DB fix failed: ${String(e?.message ?? e)}`);
  } finally {
    try { db.close(); } catch (err) { void err; }
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  try {
    app.exit(report.ok ? 0 : 1);
  } catch (e) {
    void e;
  }
}

main().catch((e) => {
  process.stderr.write(`FATAL: ${String(e?.stack ?? e)}\n`);
  try { app.exit(1); } catch (err) { void err; }
});
