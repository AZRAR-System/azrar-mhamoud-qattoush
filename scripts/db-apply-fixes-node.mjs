#!/usr/bin/env node
/**
 * Apply DB fixes using Node runtime (better-sqlite3).
 *
 * Use this when you need to safely work with WAL databases (reads WAL + can checkpoint).
 *
 * Usage:
 *   node scripts/db-apply-fixes-node.mjs "C:\\path\\to\\khaberni.sqlite" > tmp\\db-fix-report.json
 *
 * Safety:
 * - Close the desktop app first (avoid SQLITE_BUSY).
 * - The script makes a backup of DB + WAL/SHM before writing.
 */

import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';

const nowIso = () => new Date().toISOString();

function toAsciiDigits(input) {
  return String(input ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function normalizePhone(raw) {
  let s = toAsciiDigits(raw).trim();
  // Strip common formatting characters.
  s = s.replace(/[\s\-().+/\\]/g, '');
  if (s.startsWith('00')) s = s.slice(2);
  if (s === '' || s === '0' || s === '962') return '';
  return s;
}

function tryJsonParseArray(raw) {
  if (!raw || !String(raw).trim()) return [];
  try {
    const v = JSON.parse(String(raw));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function pickArgs() {
  const arg = String(process.argv[2] ?? '').trim();
  return { dbPath: arg };
}

function usageAndExit(code) {
  process.stderr.write('Usage: node scripts/db-apply-fixes-node.mjs "<absolute-path-to-sqlite-file>"\n');
  process.stderr.write('Tip: You can discover paths via: node scripts/db-guess-path-node.mjs\n');
  process.exit(code);
}

async function statSafe(p) {
  try {
    const st = await fsp.stat(p);
    return { exists: true, sizeBytes: st.size, mtime: st.mtime?.toISOString?.() ?? null };
  } catch {
    return { exists: false };
  }
}

async function copyIfExists(src, destDir) {
  const base = path.basename(src);
  const dest = path.join(destDir, base);
  if (!fs.existsSync(src)) return { copied: false, src, dest };
  await fsp.copyFile(src, dest);
  return { copied: true, src, dest };
}

function splitSqlStatements(sqlText) {
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
  const { dbPath } = pickArgs();
  if (!dbPath) usageAndExit(2);

  const report = {
    ok: true,
    ranAt: nowIso(),
    dbPath,
    file: null,
    backupDir: '',
    backups: [],
    checkpointBefore: null,
    checkpointAfter: null,
    applied: [],
    errors: [],
    notes: [],
  };

  const st = await statSafe(dbPath);
  if (!st.exists) {
    report.ok = false;
    report.errors.push(`DB file not found: ${dbPath}`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(1);
  }
  report.file = st;

  // Load better-sqlite3
  let BetterSqlite3Mod;
  try {
    BetterSqlite3Mod = await import('better-sqlite3');
  } catch (e) {
    report.ok = false;
    report.errors.push(`Failed to import better-sqlite3: ${String(e?.message ?? e)}`);
    report.notes.push('Try: npm rebuild better-sqlite3 --build-from-source');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(1);
  }

  const BetterSqlite3 = BetterSqlite3Mod.default ?? BetterSqlite3Mod;

  // Backup (include WAL/SHM)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseDir = path.dirname(dbPath);
  const backupDir = path.join(baseDir, 'backups', `manual-fix-${stamp}`);
  await fsp.mkdir(backupDir, { recursive: true });
  report.backupDir = backupDir;

  report.backups.push(await copyIfExists(dbPath, backupDir));
  report.backups.push(await copyIfExists(`${dbPath}-wal`, backupDir));
  report.backups.push(await copyIfExists(`${dbPath}-shm`, backupDir));

  const db = new BetterSqlite3(dbPath, { readonly: false, fileMustExist: true });

  try {
    // Fail fast if another process holds a lock.
    db.pragma('busy_timeout = 2000');

    // Enable FK enforcement for this connection (does not add FKs, but safer).
    try {
      db.pragma('foreign_keys = ON');
    } catch (e) {
      void e;
    }

    // Checkpoint WAL outside of any explicit transaction.
    try {
      report.checkpointBefore = db.pragma('wal_checkpoint(FULL)');
    } catch (e) {
      report.notes.push(`wal_checkpoint(FULL) before failed: ${String(e?.message ?? e)}`);
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

      // Per-statement fallback: execute only DDL statements; avoid BEGIN/COMMIT nesting.
      const stmts = splitSqlStatements(sql).filter((s) => {
        const up = s.toUpperCase();
        if (up === 'BEGIN' || up.startsWith('BEGIN ')) return false;
        if (up === 'COMMIT') return false;
        if (up === 'ROLLBACK') return false;
        return true;
      });

      let okCount = 0;
      let failCount = 0;
      for (const s of stmts) {
        try {
          // Each statement stands alone; if one fails (e.g., duplicates), keep going.
          db.exec(s);
          okCount++;
        } catch (e) {
          failCount++;
          report.errors.push(`${fileName}: ${String(e?.message ?? e)} (stmt: ${s.slice(0, 120)}...)`);
        }
      }
      report.applied.push({ file: fileName, mode, ok: failCount === 0, okCount, failCount });
    };

    await applyFile('01_missing_indexes.sql', 'exec-all');

    // Data cleanup: normalize phone values in KV source-of-truth (db_people) and sync to Domain.
    // We do this in Node because kv.v is a JSON array; SQL JSON1 updates are easy to get subtly wrong.
    try {
      const kvRow = db.prepare("SELECT v FROM kv WHERE k='db_people' LIMIT 1").get();
      const raw = String(kvRow?.v ?? '');
      const arr = tryJsonParseArray(raw);

      if (arr === null) {
        report.notes.push('Phone normalize: kv(db_people) is not a JSON array; skipped.');
      } else {
        let changed = 0;
        for (const obj of arr) {
          if (!obj || typeof obj !== 'object') continue;

          const p0 = obj['رقم_الهاتف'];
          const e0 = obj['رقم_هاتف_اضافي'];
          const p1 = normalizePhone(p0);
          const e1 = normalizePhone(e0);

          if (p1 !== String(p0 ?? '')) {
            obj['رقم_الهاتف'] = p1;
            changed++;
          }
          if (e1 !== String(e0 ?? '')) {
            // Keep key if it existed, but normalize value.
            if (Object.prototype.hasOwnProperty.call(obj, 'رقم_هاتف_اضافي')) obj['رقم_هاتف_اضافي'] = e1;
          }
        }

        const newRaw = JSON.stringify(arr);
        if (newRaw !== raw) {
          db.prepare('UPDATE kv SET v = ?, updatedAt = ? WHERE k = ?').run(newRaw, nowIso(), 'db_people');
        }

        // Sync into Domain people table so audits immediately reflect the cleaned values.
        const up = db.prepare('UPDATE people SET phone = ?, data = ?, updatedAt = ? WHERE id = ?');
        const updatedAt = nowIso();
        let synced = 0;
        for (const obj of arr) {
          const id = String(obj?.['رقم_الشخص'] ?? '').trim();
          if (!id) continue;
          const phone = normalizePhone(obj?.['رقم_الهاتف']);
          const data = JSON.stringify(obj);
          const res = up.run(phone, data, updatedAt, id);
          if ((res?.changes ?? 0) > 0) synced++;
        }

        report.applied.push({
          file: '05_normalize_people_phone (node)',
          mode: 'node-rewrite',
          ok: true,
          changed,
          synced,
        });
      }
    } catch (e) {
      report.errors.push(`Phone normalize failed: ${String(e?.message ?? e)}`);
      report.applied.push({ file: '05_normalize_people_phone (node)', mode: 'node-rewrite', ok: false });
    }

    // Try atomic apply first; if it fails, retry per-statement.
    try {
      await applyFile('02_unique_partial_indexes.sql', 'exec-all');
    } catch (e) {
      report.notes.push(`02_unique_partial_indexes.sql failed as a batch: ${String(e?.message ?? e)}`);
      await applyFile('02_unique_partial_indexes.sql', 'per-statement');
    }

    try {
      db.exec('ANALYZE;');
      db.exec('PRAGMA optimize;');
    } catch {
      // ignore
    }

    // Final checkpoint after schema changes.
    try {
      report.checkpointAfter = db.pragma('wal_checkpoint(FULL)');
    } catch (e) {
      report.notes.push(`wal_checkpoint(FULL) after failed: ${String(e?.message ?? e)}`);
    }
  } catch (e) {
    report.ok = false;
    report.errors.push(`DB fix failed: ${String(e?.message ?? e)}`);
  } finally {
    try {
      db.close();
    } catch (e) {
      void e;
    }
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`FATAL: ${String(e?.stack ?? e)}\n`);
  process.exit(1);
});
