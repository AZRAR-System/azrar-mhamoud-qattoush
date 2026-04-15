import path from 'node:path';
import { app, dialog, safeStorage } from 'electron';
import { createRequire } from 'node:module';
import type BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import crypto from 'node:crypto';

import { normalizeKvValueOnWrite } from './utils/kvInvariants';

type SqliteDb = InstanceType<typeof BetterSqlite3>;

const require = createRequire(import.meta.url);

type SqliteCtor = new (...args: unknown[]) => SqliteDb;

const toRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
const isNonNull = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined;
const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const LOCALE_AR_LATN_GREGORY = 'ar-JO-u-ca-gregory-nu-latn';

type ErrorCode =
  | 'ERR_INVALID_ID'
  | 'ERR_NOT_FOUND'
  | 'ERR_INVALID_DATA'
  | 'ERR_CONTRACT_NOT_FOUND'
  | 'ERR_INVALID_CONTRACT_DATA'
  | 'ERR_INVALID_DATES'
  | 'ERR_INVALID_MONTH'
  | 'ERR_INVALID_DATE';

const errorResult = (code: ErrorCode, message?: string) => ({ ok: false, code, message });

let BetterSqlite3Ctor: SqliteCtor | null = null;

let db: SqliteDb | null = null;

let resolvedDbPath: string | null = null;

type DbEncryptionMode = 'none' | 'sqlcipher';

const getDbEncryptionMode = (): DbEncryptionMode => {
  const raw = String(process.env.AZRAR_DB_ENCRYPTION || '')
    .trim()
    .toLowerCase();
  if (raw === 'sqlcipher') return 'sqlcipher';
  return 'none';
};

const isSqlcipherEnabled = (): boolean => getDbEncryptionMode() === 'sqlcipher';

const getDbCipherKeyFilePath = (): string => {
  return path.join(app.getPath('userData'), 'db-sqlcipher-key.v1.json');
};

const escapeSqlString = (s: string): string => String(s || '').replace(/'/g, "''");

const getOrCreateDbCipherKeySync = (): string => {
  const explicit = String(process.env.AZRAR_DB_CIPHER_KEY || '').trim();
  if (explicit) return explicit;

  if (safeStorage?.isEncryptionAvailable?.() !== true) {
    throw new Error(
      'تشفير قاعدة البيانات مُفعّل (SQLCipher) لكن safeStorage غير متاح.\n' +
        'على Linux قد تحتاج تثبيت keyring/libsecret، أو عيّن AZRAR_DB_CIPHER_KEY.'
    );
  }

  const keyPath = getDbCipherKeyFilePath();
  try {
    if (fsSync.existsSync(keyPath)) {
      const raw = fsSync.readFileSync(keyPath, 'utf8');
      const parsed = JSON.parse(String(raw || '').trim()) as { v?: unknown; keyEncB64?: unknown };
      const b64 = typeof parsed?.keyEncB64 === 'string' ? String(parsed.keyEncB64) : '';
      if (b64) {
        const enc = Buffer.from(b64, 'base64');
        const plain = safeStorage.decryptString(enc);
        if (plain && plain.trim()) return plain.trim();
      }
    }
  } catch {
    // ignore and regenerate
  }

  const generated = crypto.randomBytes(32).toString('base64');
  try {
    fsSync.mkdirSync(path.dirname(keyPath), { recursive: true });
    const enc = safeStorage.encryptString(generated);
    const payload = { v: 1, keyEncB64: Buffer.from(enc).toString('base64') };
    fsSync.writeFileSync(keyPath, JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // If we can't persist, still return generated for this run.
  }
  return generated;
};

type DbCandidate = { path: string; mtimeMs: number; size: number };

const safeReaddirDirsSync = (dir: string): string[] => {
  try {
    const items = fsSync.readdirSync(dir, { withFileTypes: true });
    return items.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
};

const safeStatSync = (filePath: string): fsSync.Stats | null => {
  try {
    return fsSync.statSync(filePath);
  } catch {
    return null;
  }
};

const _safeExistsFileSync = (filePath: string): boolean => {
  try {
    const st = fsSync.statSync(filePath);
    return st.isFile();
  } catch {
    return false;
  }
};

function _findLegacyDbCandidateSync(options: {
  currentTargetPath: string;
  exeAdjacentPath?: string;
}): DbCandidate | null {
  const currentTargetPath = path.resolve(options.currentTargetPath);
  const exeAdjacentPath = options.exeAdjacentPath ? path.resolve(options.exeAdjacentPath) : null;

  const candidates: DbCandidate[] = [];

  const consider = (p: string) => {
    try {
      const resolved = path.resolve(p);
      if (resolved === currentTargetPath) return;
      if (exeAdjacentPath && resolved === exeAdjacentPath) return;
      const st = safeStatSync(resolved);
      if (!st || !st.isFile()) return;
      if (st.size <= 0) return;
      candidates.push({ path: resolved, mtimeMs: st.mtimeMs, size: st.size });
    } catch {
      // ignore
    }
  };

  // Roots to scan (best-effort). In practice, app updates sometimes change app.getPath('userData')
  // due to app name / appId changes, leaving the previous DB in a sibling folder.
  const userDataDir = path.dirname(currentTargetPath);
  const roamingRoot = path.dirname(userDataDir);
  const appDataRoot = (() => {
    try {
      return app.getPath('appData');
    } catch {
      return null;
    }
  })();

  const roots = [userDataDir, roamingRoot, appDataRoot].filter(Boolean) as string[];

  for (const root of roots) {
    // Check direct file in the root (rare but harmless)
    consider(path.join(root, 'khaberni.sqlite'));

    // Check sibling app folders
    for (const dirName of safeReaddirDirsSync(root)) {
      consider(path.join(root, dirName, 'khaberni.sqlite'));
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || b.size - a.size);
  return candidates[0] || null;
}

function ensureWritableDirSync(dir: string) {
  fsSync.mkdirSync(dir, { recursive: true });
  const probe = path.join(dir, '.write-test');
  fsSync.writeFileSync(probe, 'ok');
  fsSync.unlinkSync(probe);
}

function _maybeMigrateLegacyDbSync(fromPath: string, toPath: string) {
  try {
    if (fsSync.existsSync(toPath)) return;
    if (!fsSync.existsSync(fromPath)) return;
    const toDir = path.dirname(toPath);
    ensureWritableDirSync(toDir);
    fsSync.copyFileSync(fromPath, toPath);
  } catch {
    // Best-effort migration only.
  }
}

function resolveDbPathSync(): string {
  if (resolvedDbPath) return resolvedDbPath;

  // Optional overrides to support "standalone" installs that sync via OneDrive, etc.
  // - AZRAR_DESKTOP_DB_PATH: full path to the sqlite file
  // - AZRAR_DESKTOP_DB_DIR: directory where khaberni.sqlite will be created
  const explicitPath = process.env.AZRAR_DESKTOP_DB_PATH;
  if (explicitPath && explicitPath.trim()) {
    resolvedDbPath = explicitPath.trim();
    return resolvedDbPath;
  }

  const explicitDir = process.env.AZRAR_DESKTOP_DB_DIR;
  if (explicitDir && explicitDir.trim()) {
    resolvedDbPath = path.join(explicitDir.trim(), 'khaberni.sqlite');
    return resolvedDbPath;
  }

  const userDataPath = path.join(app.getPath('userData'), 'khaberni.sqlite');

  // When DB encryption is enabled, always keep the DB under userData.
  // This avoids Program Files write restrictions and reduces accidental exposure.
  if (isSqlcipherEnabled() || app.isPackaged) {
    if (app.isPackaged) {
      try {
        const exeDir = path.dirname(app.getPath('exe'));
        const exeAdjacentPath = path.join(exeDir, 'khaberni.sqlite');
        // If a legacy DB exists in the EXE folder, migrate it to the safe userData folder.
        if (fsSync.existsSync(exeAdjacentPath) && !fsSync.existsSync(userDataPath)) {
          _maybeMigrateLegacyDbSync(exeAdjacentPath, userDataPath);
        }
      } catch {
        // Migration is best-effort.
      }
    }
    resolvedDbPath = userDataPath;
    return resolvedDbPath;
  }

  // Developer / Debug mode adjustments.
  try {
    const exeDir = path.dirname(app.getPath('exe'));
    const exeAdjacentPath = path.join(exeDir, 'khaberni.sqlite');

    if (fsSync.existsSync(exeAdjacentPath)) {
      resolvedDbPath = exeAdjacentPath;
      return resolvedDbPath;
    }

    // Attempt to use exe-adjacent if writable (legacy behavior for standalone devs).
    try {
      ensureWritableDirSync(exeDir);
      resolvedDbPath = exeAdjacentPath;
      return resolvedDbPath;
    } catch {
      // Not writable, fall back to userData.
    }
  } catch {
    // Ignore and fall back to userData.
  }

  resolvedDbPath = userDataPath;
  return resolvedDbPath;
}


export function getDbPath() {
  return resolveDbPathSync();
}

function getJournalMode(): 'WAL' | 'DELETE' {
  const raw = (process.env.AZRAR_DESKTOP_JOURNAL_MODE || '').trim().toUpperCase();
  if (raw === 'DELETE') return 'DELETE';
  return 'WAL';
}

function repairCorruptedDatabaseSync(corruptedPath: string): boolean {
  try {
    const dataDir = path.dirname(corruptedPath);
    const backupRoot = path.join(dataDir, 'backups');

    let backupPath: string | null = null;

    if (fsSync.existsSync(backupRoot)) {
      // Find latest backup folder YYYY-MM-DD, sorted descending
      const folders = fsSync
        .readdirSync(backupRoot)
        .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
        .sort((a, b) => b.localeCompare(a));

      for (const dateDir of folders) {
        // Try named file first, then any .sqlite file in the folder
        const namedPath = path.join(backupRoot, dateDir, 'khaberni.sqlite');
        if (fsSync.existsSync(namedPath)) {
          backupPath = namedPath;
          break;
        }
        // Fallback: find any .sqlite file in this date folder
        try {
          const entries = fsSync.readdirSync(path.join(backupRoot, dateDir));
          const sqliteFile = entries.find((e) => e.toLowerCase().endsWith('.sqlite'));
          if (sqliteFile) {
            backupPath = path.join(backupRoot, dateDir, sqliteFile);
            break;
          }
        } catch {
          // continue searching
        }
      }
    }

    if (!backupPath) {
      dialog.showMessageBoxSync({
        type: 'error',
        title: 'فشل استعادة البيانات',
        message: 'تم اكتشاف تلف في قاعدة البيانات ولكن تعذر العثور على أي نسخ احتياطية لاستعادتها.',
        detail: 'يرجى التواصل مع الدعم الفني لإصلاح المشكلة يدوياً.',
        buttons: ['إغلاق'],
      });
      return false;
    }

    // Close existing DB connection
    if (db) {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      db = null;
    }

    // Save corrupted file before overwriting
    const malformedPath = `${corruptedPath}.malformed.${Date.now()}`;
    try {
      fsSync.renameSync(corruptedPath, malformedPath);
    } catch {
      // If rename fails (e.g. lock), try removing
      try { fsSync.unlinkSync(corruptedPath); } catch { /* ignore */ }
    }

    // Restore backup
    fsSync.copyFileSync(backupPath, corruptedPath);

    dialog.showMessageBoxSync({
      type: 'info',
      title: 'تمت استعادة البيانات بنجاح',
      message: 'تم اكتشاف تلف في قاعدة البيانات وتمت استعادتها تلقائياً من أحدث نسخة احتياطية.',
      detail: 'قد تفقد بعض البيانات التي تم إدخالها مؤخراً. التطبيق سيعمل الآن بشكل طبيعي.',
      buttons: ['موافق'],
    });
    return true;
  } catch (_err) {
    return false;
  }
}

export function getDb(): SqliteDb {
  if (db) return db;

  if (!BetterSqlite3Ctor) {
    try {
      const mod: unknown = isSqlcipherEnabled()
        ? require('better-sqlite3-multiple-ciphers')
        : require('better-sqlite3');
      const modRec = toRecord(mod);
      const candidate: unknown = modRec.default ?? mod;
      if (typeof candidate !== 'function')
        throw new Error('better-sqlite3 module did not export a constructor');
      BetterSqlite3Ctor = candidate as unknown as SqliteCtor;
      if (!BetterSqlite3Ctor) throw new Error('better-sqlite3 module did not export a constructor');
    } catch (e: unknown) {
      const rawMsg = e instanceof Error ? String(e.message) : String(e);
      const looksAbiMismatch =
        /NODE_MODULE_VERSION\s+\d+|compiled against a different Node\.js version/i.test(rawMsg);
      const detail = looksAbiMismatch
        ? 'تم بناء التطبيق أو التبعيات بإصدار Node/Electron مختلف. يلزم إعادة بناء/تثبيت نسخة Desktop بشكل صحيح.'
        : isSqlcipherEnabled()
          ? 'تعذر تحميل مكتبة قاعدة البيانات المشفرة (better-sqlite3-multiple-ciphers).'
          : 'تعذر تحميل مكتبة قاعدة البيانات المحلية (better-sqlite3).';

      try {
        dialog.showMessageBoxSync({
          type: 'error',
          title: 'خطأ في تشغيل قاعدة البيانات',
          message: 'تعذر تشغيل قاعدة البيانات المحلية',
          detail: `${detail}\n\n${rawMsg}`,
          buttons: ['إغلاق'],
        });
      } catch {
        // ignore
      }

      try {
        app.quit();
      } catch {
        // ignore
      }

      throw e;
    }
  }

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }

  if (!BetterSqlite3Ctor) throw new Error('BetterSqlite3Ctor is not initialized');

  let database: SqliteDb;
  try {
    database = db = new BetterSqlite3Ctor(dbPath) as SqliteDb;

    // Optional: SQLCipher (at-rest encryption).
    // IMPORTANT: this is enabled only when AZRAR_DB_ENCRYPTION=sqlcipher.
    if (isSqlcipherEnabled()) {
      const key = getOrCreateDbCipherKeySync();
      try {
        // Apply key before any queries. Escaping is defensive.
        database.pragma(`key = '${escapeSqlString(key)}'`);

        // Validate key by touching sqlite_master.
        database.prepare('SELECT count(*) AS c FROM sqlite_master').get();
      } catch (e: unknown) {
        // If this DB is plaintext and migration is explicitly allowed, attempt rekey.
        const allowMigrate = String(process.env.AZRAR_DB_ENCRYPTION_MIGRATE || '').trim();
        const migrateOk = allowMigrate === '1' || allowMigrate.toLowerCase() === 'true';

        if (migrateOk) {
          try {
            // Re-open without key to see if DB is plaintext.
            database.close();
            db = null;
            const dbPlain = new BetterSqlite3Ctor(dbPath) as SqliteDb;
            // If plaintext is readable, rekey it to encrypted.
            dbPlain.prepare('SELECT count(*) AS c FROM sqlite_master').get();
            dbPlain.pragma(`rekey = '${escapeSqlString(key)}'`);
            dbPlain.close();
            db = null;

            // Re-open encrypted.
            const dbEnc = new BetterSqlite3Ctor(dbPath) as SqliteDb;
            dbEnc.pragma(`key = '${escapeSqlString(key)}'`);
            dbEnc.prepare('SELECT count(*) AS c FROM sqlite_master').get();
            db = dbEnc;
            database = dbEnc;
          } catch (e2: unknown) {
            const rawMsg = e2 instanceof Error ? String(e2.message) : String(e2);
            try {
              dialog.showMessageBoxSync({
                type: 'error',
                title: 'خطأ في تشفير قاعدة البيانات',
                message: 'تعذر تفعيل تشفير قاعدة البيانات (SQLCipher)',
                detail: `فشل ترحيل/فتح قاعدة البيانات المشفرة.\n\n${rawMsg}`,
                buttons: ['إغلاق'],
              });
            } catch {
              // ignore
            }
            try {
              app.quit();
            } catch {
              // ignore
            }
            throw e2;
          }
        } else {
          const rawMsg = e instanceof Error ? String(e.message) : String(e);
          try {
            dialog.showMessageBoxSync({
              type: 'error',
              title: 'خطأ في تشغيل قاعدة البيانات',
              message: 'تعذر فتح قاعدة البيانات المشفرة',
              detail:
                'تم تفعيل SQLCipher لكن قاعدة البيانات الحالية غير مشفرة أو المفتاح غير صحيح.\n' +
                'لتشفير قاعدة موجودة: شغّل التطبيق مع AZRAR_DB_ENCRYPTION_MIGRATE=1 مرة واحدة.\n\n' +
                rawMsg,
              buttons: ['إغلاق'],
            });
          } catch {
            // ignore
          }
          try {
            app.quit();
          } catch {
            // ignore
          }
          throw e;
        }
      }
    }

    database.pragma(`journal_mode = ${getJournalMode()}`);
    // Foreign keys are OFF by default in SQLite; enable enforcement per connection.
    // This is forward-compatible with planned FK constraints and helps catch bad writes early.
    database.pragma('foreign_keys = ON');
    // Performance + stability settings for long-term usage.
    // WAL is the default (see getJournalMode) and works well for desktop apps.
    database.pragma('busy_timeout = 5000');
    database.pragma('synchronous = NORMAL');
    database.pragma('temp_store = MEMORY');
    database.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

    // Track deletions for sync (tombstones).
    // We keep deletions separate so kvGet() remains null after delete.
    database.exec(`
    CREATE TABLE IF NOT EXISTS kv_deleted (
      k TEXT PRIMARY KEY,
      deletedAt TEXT NOT NULL
    );
  `);

    // Auto-indexing (no user intervention)
    // - k is already indexed by PRIMARY KEY
    // - updatedAt index helps maintenance/ordering/reporting that uses timestamps
    database.exec(`
    CREATE INDEX IF NOT EXISTS idx_kv_updatedAt ON kv(updatedAt);
  `);

    database.exec(`
    CREATE INDEX IF NOT EXISTS idx_kv_deleted_deletedAt ON kv_deleted(deletedAt);
  `);

    // Domain schema (reports + scalable queries)
    ensureDomainSchema(database);

    return database;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('database disk image is malformed')) {
      if (repairCorruptedDatabaseSync(dbPath)) {
        // Recursively try again once after repair
        return getDb();
      }
    }
    throw err;
  }
}

type DomainMigrationResult = {
  ok: boolean;
  message: string;
  migrated: boolean;
  counts?: Record<string, number>;
};

type ReportRunResult = {
  ok: boolean;
  result?: unknown;
  message?: string;
};

const DOMAIN_SCHEMA_VERSION = 9;

function metaGet(dbh: SqliteDb, key: string): string | null {
  const row = dbh.prepare('SELECT v FROM domain_meta WHERE k = ?').get(key) as
    | { v: string }
    | undefined;
  return row?.v ?? null;
}

function metaSet(dbh: SqliteDb, key: string, value: string): void {
  dbh
    .prepare(
      'INSERT INTO domain_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v'
    )
    .run(key, value);
}

/** Rebuild domain tables to attach SQLite FK constraints (SQLite cannot ADD FK via ALTER). */
function migrateDomainSchemaV7(dbh: SqliteDb): void {
  dbh.pragma('foreign_keys = OFF');
  try {
    // Children before parents: installments → contracts; then person_roles; maintenance_tickets.
    dbh.exec(`
      CREATE TABLE installments_v7_new (
        id TEXT PRIMARY KEY,
        contractId TEXT,
        dueDate TEXT,
        amount REAL,
        paid REAL,
        remaining REAL,
        status TEXT,
        type TEXT,
        isArchived INTEGER,
        paidAt TEXT,
        data TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (contractId) REFERENCES contracts(id) ON DELETE CASCADE
      );
      INSERT INTO installments_v7_new
        SELECT id, contractId, dueDate, amount, paid, remaining, status, type, isArchived, paidAt, data, updatedAt
      FROM installments;
      DROP TABLE installments;
      ALTER TABLE installments_v7_new RENAME TO installments;
    `);
    dbh.exec(`
      CREATE INDEX IF NOT EXISTS idx_installments_contractId ON installments(contractId);
      CREATE INDEX IF NOT EXISTS idx_installments_dueDate ON installments(dueDate);
      CREATE INDEX IF NOT EXISTS idx_installments_remaining ON installments(remaining);
      CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
      CREATE INDEX IF NOT EXISTS idx_installments_type ON installments(type);
      CREATE INDEX IF NOT EXISTS idx_installments_isArchived ON installments(isArchived);
      CREATE INDEX IF NOT EXISTS idx_installments_contractId_dueDate ON installments(contractId, dueDate);
      CREATE INDEX IF NOT EXISTS idx_installments_contractId_status ON installments(contractId, status);
    `);

    dbh.exec(`
      CREATE TABLE contracts_v7_new (
        id TEXT PRIMARY KEY,
        propertyId TEXT,
        tenantId TEXT,
        guarantorId TEXT,
        status TEXT,
        startDate TEXT,
        endDate TEXT,
        annualValue REAL,
        paymentFrequency INTEGER,
        paymentMethod TEXT,
        isArchived INTEGER,
        data TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (propertyId) REFERENCES properties(id),
        FOREIGN KEY (tenantId) REFERENCES people(id),
        FOREIGN KEY (guarantorId) REFERENCES people(id)
      );
      INSERT INTO contracts_v7_new
        SELECT id, propertyId, tenantId, guarantorId, status, startDate, endDate, annualValue,
               paymentFrequency, paymentMethod, isArchived, data, updatedAt
      FROM contracts;
      DROP TABLE contracts;
      ALTER TABLE contracts_v7_new RENAME TO contracts;
    `);
    dbh.exec(`
      CREATE INDEX IF NOT EXISTS idx_contracts_propertyId ON contracts(propertyId);
      CREATE INDEX IF NOT EXISTS idx_contracts_tenantId ON contracts(tenantId);
      CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
      CREATE INDEX IF NOT EXISTS idx_contracts_endDate ON contracts(endDate);
      CREATE INDEX IF NOT EXISTS idx_contracts_isArchived ON contracts(isArchived);
      CREATE INDEX IF NOT EXISTS idx_contracts_propertyId_isArchived ON contracts(propertyId, isArchived);
      CREATE INDEX IF NOT EXISTS idx_contracts_tenantId_status ON contracts(tenantId, status);
    `);

    dbh.exec(`
      CREATE TABLE person_roles_v7_new (
        personId TEXT NOT NULL,
        role TEXT NOT NULL,
        FOREIGN KEY (personId) REFERENCES people(id) ON DELETE CASCADE
      );
      INSERT INTO person_roles_v7_new SELECT personId, role FROM person_roles;
      DROP TABLE person_roles;
      ALTER TABLE person_roles_v7_new RENAME TO person_roles;
    `);
    dbh.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_person_roles_person_role ON person_roles(personId, role);
      CREATE INDEX IF NOT EXISTS idx_person_roles_personId ON person_roles(personId);
      CREATE INDEX IF NOT EXISTS idx_person_roles_role ON person_roles(role);
    `);

    dbh.exec(`
      CREATE TABLE maintenance_tickets_v7_new (
        id TEXT PRIMARY KEY,
        propertyId TEXT,
        tenantId TEXT,
        createdDate TEXT,
        status TEXT,
        priority TEXT,
        issue TEXT,
        closedDate TEXT,
        data TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (propertyId) REFERENCES properties(id)
      );
      INSERT INTO maintenance_tickets_v7_new
        SELECT id, propertyId, tenantId, createdDate, status, priority, issue, closedDate, data, updatedAt
      FROM maintenance_tickets;
      DROP TABLE maintenance_tickets;
      ALTER TABLE maintenance_tickets_v7_new RENAME TO maintenance_tickets;
    `);
    dbh.exec(`
      CREATE INDEX IF NOT EXISTS idx_maint_propertyId ON maintenance_tickets(propertyId);
      CREATE INDEX IF NOT EXISTS idx_maint_status ON maintenance_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_maint_priority ON maintenance_tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_maint_createdDate ON maintenance_tickets(createdDate);
      CREATE INDEX IF NOT EXISTS idx_maintenance_propertyId_status ON maintenance_tickets(propertyId, status);
    `);
  } finally {
    dbh.pragma('foreign_keys = ON');
  }
}

/** Drop overly strict UNIQUE on plot/plate/apt — duplicates can exist after sync/legacy KV. */
function migrateDomainSchemaV8(dbh: SqliteDb): void {
  try {
    dbh.exec('DROP INDEX IF EXISTS uq_properties_plot_plate_apt');
  } catch {
    // ignore
  }
  try {
    dbh.exec(`
      CREATE INDEX IF NOT EXISTS idx_properties_plot_plate_apt
      ON properties(
        TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_قطعة"'), '')),
        TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_لوحة"'), '')),
        TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_شقة"'), ''))
      )
      WHERE TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_قطعة"'), '')) <> ''
        AND TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_لوحة"'), '')) <> ''
        AND TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_شقة"'), '')) <> ''
    `);
  } catch {
    // ignore
  }
}

/**
 * Drop UNIQUE partial indexes on derived domain columns — they conflict with real KV/sync data
 * (duplicate names, shared phones, reused internal codes, etc.). Search still uses idx_people_* /
 * idx_properties_internalCode on the scalar columns.
 */
function migrateDomainSchemaV9(dbh: SqliteDb): void {
  const drops = [
    'uq_people_nationalId',
    'uq_people_phone',
    'uq_people_name',
    'uq_properties_internalCode',
  ];
  for (const name of drops) {
    try {
      dbh.exec(`DROP INDEX IF EXISTS ${name}`);
    } catch {
      // ignore
    }
  }
}

function ensureDomainSchema(dbh: SqliteDb): void {
  dbh.exec(`
    CREATE TABLE IF NOT EXISTS domain_meta (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );
  `);

  const current = Number(metaGet(dbh, 'domain_schema_version') || '0') || 0;
  if (current >= DOMAIN_SCHEMA_VERSION) return;

  // Core domain tables (minimal extracted columns + full JSON snapshot)
  dbh.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT,
      nationalId TEXT,
      phone TEXT,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);
    CREATE INDEX IF NOT EXISTS idx_people_phone ON people(phone);
    CREATE INDEX IF NOT EXISTS idx_people_nationalId ON people(nationalId);

    CREATE TABLE IF NOT EXISTS person_roles (
      personId TEXT NOT NULL,
      role TEXT NOT NULL,
      FOREIGN KEY (personId) REFERENCES people(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_person_roles_person_role ON person_roles(personId, role);
    CREATE INDEX IF NOT EXISTS idx_person_roles_personId ON person_roles(personId);
    CREATE INDEX IF NOT EXISTS idx_person_roles_role ON person_roles(role);

    CREATE TABLE IF NOT EXISTS blacklist (
      personId TEXT PRIMARY KEY,
      isActive INTEGER,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_blacklist_isActive ON blacklist(isActive);

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      internalCode TEXT,
      ownerId TEXT,
      type TEXT,
      status TEXT,
      address TEXT,
      city TEXT,
      area TEXT,
      isRented INTEGER,
      isForSale INTEGER,
      isForRent INTEGER,
      salePrice REAL,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_properties_internalCode ON properties(internalCode);
    CREATE INDEX IF NOT EXISTS idx_properties_ownerId ON properties(ownerId);
    CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
    CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
    CREATE INDEX IF NOT EXISTS idx_properties_address ON properties(address);

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      propertyId TEXT,
      tenantId TEXT,
      guarantorId TEXT,
      status TEXT,
      startDate TEXT,
      endDate TEXT,
      annualValue REAL,
      paymentFrequency INTEGER,
      paymentMethod TEXT,
      isArchived INTEGER,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (propertyId) REFERENCES properties(id),
      FOREIGN KEY (tenantId) REFERENCES people(id),
      FOREIGN KEY (guarantorId) REFERENCES people(id)
    );
    CREATE INDEX IF NOT EXISTS idx_contracts_propertyId ON contracts(propertyId);
    CREATE INDEX IF NOT EXISTS idx_contracts_tenantId ON contracts(tenantId);
    CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
    CREATE INDEX IF NOT EXISTS idx_contracts_endDate ON contracts(endDate);
    CREATE INDEX IF NOT EXISTS idx_contracts_isArchived ON contracts(isArchived);

    CREATE TABLE IF NOT EXISTS installments (
      id TEXT PRIMARY KEY,
      contractId TEXT,
      dueDate TEXT,
      amount REAL,
      paid REAL,
      remaining REAL,
      status TEXT,
      type TEXT,
      isArchived INTEGER,
      paidAt TEXT,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (contractId) REFERENCES contracts(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_installments_contractId ON installments(contractId);
    CREATE INDEX IF NOT EXISTS idx_installments_dueDate ON installments(dueDate);
    CREATE INDEX IF NOT EXISTS idx_installments_remaining ON installments(remaining);
    CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
    CREATE INDEX IF NOT EXISTS idx_installments_type ON installments(type);
    CREATE INDEX IF NOT EXISTS idx_installments_isArchived ON installments(isArchived);

    CREATE TABLE IF NOT EXISTS maintenance_tickets (
      id TEXT PRIMARY KEY,
      propertyId TEXT,
      tenantId TEXT,
      createdDate TEXT,
      status TEXT,
      priority TEXT,
      issue TEXT,
      closedDate TEXT,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (propertyId) REFERENCES properties(id)
    );
    CREATE INDEX IF NOT EXISTS idx_maint_propertyId ON maintenance_tickets(propertyId);
    CREATE INDEX IF NOT EXISTS idx_maint_status ON maintenance_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_maint_priority ON maintenance_tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_maint_createdDate ON maintenance_tickets(createdDate);
  `);

  // Do NOT add UNIQUE indexes on derived people/properties columns: KV pull and legacy imports may
  // contain duplicate phones, names, internal codes, or plot/plate/apt triples. Uniqueness belongs
  // in app validation, not SQLite, or migration will throw UNIQUE constraint failed.
  // person_roles keeps UNIQUE(personId, role) + INSERT OR IGNORE — duplicates in source are skipped.

  // Composite index for land identifiers (plot/plate/apartment) — NOT UNIQUE: KV/sync may contain
  // multiple property rows with the same triple (different رقم_عقار) or legacy duplicates.
  try {
    dbh.exec(`
      CREATE INDEX IF NOT EXISTS idx_properties_plot_plate_apt
      ON properties(
        TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_قطعة"'), '')),
        TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_لوحة"'), '')),
        TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_شقة"'), ''))
      )
      WHERE TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_قطعة"'), '')) <> ''
        AND TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_لوحة"'), '')) <> ''
        AND TRIM(COALESCE(JSON_EXTRACT(data, '$."رقم_شقة"'), '')) <> ''
    `);
  } catch {
    // ignore
  }

  // Forward-only migrations for existing installs
  if (current < 2) {
    try {
      // Add address column to speed up searches.
      dbh.exec('ALTER TABLE properties ADD COLUMN address TEXT');
    } catch {
      // Column probably already exists.
    }
    dbh.exec('CREATE INDEX IF NOT EXISTS idx_properties_address ON properties(address)');

    // Force a one-time refresh so the new column is populated.
    // (Domain tables are derived from KV; safe to rebuild.)
    metaSet(dbh, 'domain_migrated_at', '');
  }

  if (current < 3) {
    // New derived tables (roles + blacklist) require a one-time refresh.
    metaSet(dbh, 'domain_migrated_at', '');
  }

  if (current < 4) {
    try {
      dbh.exec('ALTER TABLE properties ADD COLUMN isForRent INTEGER');
    } catch {
      // Column probably already exists.
    }
    // We rely on a refresh to populate extracted columns.
    metaSet(dbh, 'domain_migrated_at', '');
  }

  if (current < 5) {
    // New unique indexes only; no data rewrite.
    // If legacy duplicates exist, index creation is best-effort and won't crash.
    metaSet(dbh, 'domain_migrated_at', '');
  }

  if (current < 6) {
    // Composite indexes for common domain SQL (installments by contract + due date, contracts by property/tenant + filters).
    dbh.exec(`
      CREATE INDEX IF NOT EXISTS idx_installments_contractId_dueDate ON installments(contractId, dueDate);
      CREATE INDEX IF NOT EXISTS idx_installments_contractId_status ON installments(contractId, status);
      CREATE INDEX IF NOT EXISTS idx_contracts_propertyId_isArchived ON contracts(propertyId, isArchived);
      CREATE INDEX IF NOT EXISTS idx_contracts_tenantId_status ON contracts(tenantId, status);
      CREATE INDEX IF NOT EXISTS idx_properties_ownerId_status ON properties(ownerId, status);
      CREATE INDEX IF NOT EXISTS idx_maintenance_propertyId_status ON maintenance_tickets(propertyId, status);
    `);
  }

  if (current < 7) {
    migrateDomainSchemaV7(dbh);
  }

  if (current < 8) {
    migrateDomainSchemaV8(dbh);
  }

  if (current < 9) {
    migrateDomainSchemaV9(dbh);
  }

  metaSet(dbh, 'domain_schema_version', String(DOMAIN_SCHEMA_VERSION));
}

function domainEnsureReady(): { ok: boolean; message?: string } {
  const initial = domainMigrateFromKvIfNeeded();
  if (!initial.ok) return { ok: false, message: initial.message };
  const refreshed = domainRefreshFromKvIfStale();
  if (!refreshed.ok) return { ok: false, message: refreshed.message };

  // Repair: it's possible for the migrated flag to be set while domain tables are empty
  // (e.g., migration ran before importing KV arrays, or metadata got out of sync).
  // If KV arrays look non-empty but domain tables are empty, force a rebuild once.
  try {
    const dbh = getDb();
    ensureDomainSchema(dbh);

    const kvLooksNonEmpty = (key: string) => {
      const raw = String(kvGet(key) ?? '').trim();
      if (!raw) return false;
      if (raw === '[]') return false;
      // Best-effort check: an array with at least one element will be longer than 2 chars.
      return raw.startsWith('[') && raw.endsWith(']') && raw.length > 2;
    };

    const peopleCnt = toNumber(
      toRecord(dbh.prepare('SELECT COUNT(1) AS cnt FROM people').get()).cnt
    );
    const propsCnt = toNumber(
      toRecord(dbh.prepare('SELECT COUNT(1) AS cnt FROM properties').get()).cnt
    );
    const contractsCnt = toNumber(
      toRecord(dbh.prepare('SELECT COUNT(1) AS cnt FROM contracts').get()).cnt
    );
    const instCnt = toNumber(
      toRecord(dbh.prepare('SELECT COUNT(1) AS cnt FROM installments').get()).cnt
    );

    const instMissingContractId = toNumber(
      toRecord(
        dbh
          .prepare(
            "SELECT COUNT(1) AS cnt FROM installments WHERE contractId IS NULL OR TRIM(COALESCE(contractId,'')) = ''"
          )
          .get()
      ).cnt
    );

    const needsRepair =
      (peopleCnt === 0 && kvLooksNonEmpty('db_people')) ||
      (propsCnt === 0 && kvLooksNonEmpty('db_properties')) ||
      (contractsCnt === 0 && kvLooksNonEmpty('db_contracts')) ||
      (instCnt === 0 && kvLooksNonEmpty('db_installments')) ||
      // Repair: some legacy datasets store installment link fields under different keys (e.g., contractId instead of رقم_العقد).
      // If we migrated but installments can't be linked to contracts, rebuild once with improved mapping.
      (instCnt > 0 && instMissingContractId > 0 && kvLooksNonEmpty('db_installments'));

    if (needsRepair) {
      metaSet(dbh, 'domain_migrated_at', '');
      const rebuilt = domainMigrateFromKvIfNeeded();
      if (!rebuilt.ok) return { ok: false, message: rebuilt.message };
    }
  } catch {
    // Ignore repair failures; callers will surface errors via their own handlers.
  }
  return { ok: true };
}

export function domainGetEntityById(
  entity: 'people' | 'properties' | 'contracts',
  id: string
): { ok: boolean; data?: unknown; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const safeId = String(id || '').trim();
  if (!safeId) return errorResult('ERR_INVALID_ID', 'معرف غير صالح');
  try {
    // Use fixed SQL per entity to avoid any possibility of identifier injection.
    const stmt =
      entity === 'people'
        ? dbh.prepare('SELECT data FROM people WHERE id = ?')
        : entity === 'properties'
          ? dbh.prepare('SELECT data FROM properties WHERE id = ?')
          : dbh.prepare('SELECT data FROM contracts WHERE id = ?');

    const row = stmt.get(safeId) as { data: string } | undefined;
    if (!row?.data) return errorResult('ERR_NOT_FOUND', 'غير موجود');
    try {
      return { ok: true, data: JSON.parse(row.data) };
    } catch {
      return errorResult('ERR_INVALID_DATA', 'بيانات غير صالحة');
    }
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل قراءة البيانات';
    return { ok: false, message };
  }
}

export function domainPersonDetails(personId: string): {
  ok: boolean;
  data?: {
    person: unknown;
    roles: string[];
    ownedProperties: unknown[];
    contracts: unknown[];
    blacklistRecord?: unknown;
    stats: {
      totalInstallments: number;
      lateInstallments: number;
      commitmentRatio: number;
    };
  };
  message?: string;
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const id = String(personId || '').trim();
  if (!id) return errorResult('ERR_INVALID_ID', 'معرف غير صالح');

  try {
    const personRow = dbh.prepare('SELECT data FROM people WHERE id = ?').get(id) as
      | { data: string }
      | undefined;
    if (!personRow?.data) return errorResult('ERR_NOT_FOUND', 'غير موجود');

    let person: unknown;
    try {
      person = JSON.parse(personRow.data);
    } catch {
      return errorResult('ERR_INVALID_DATA', 'بيانات غير صالحة');
    }

    const roles = (
      dbh
        .prepare('SELECT role FROM person_roles WHERE personId = ? ORDER BY role ASC')
        .all(id) as Array<{ role: string }>
    )
      .map((r) => String(r.role || '').trim())
      .filter(Boolean);

    const ownedProperties = (
      dbh
        .prepare(
          "SELECT data FROM properties WHERE ownerId = ? ORDER BY COALESCE(internalCode,'') ASC"
        )
        .all(id) as Array<{ data: string }>
    )
      .map((r) => {
        try {
          return JSON.parse(r.data);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const contracts = (
      dbh
        .prepare(
          "SELECT data FROM contracts WHERE tenantId = ? AND COALESCE(isArchived,0) = 0 ORDER BY COALESCE(startDate,'') DESC, id DESC"
        )
        .all(id) as Array<{ data: string }>
    )
      .map((r) => {
        try {
          return JSON.parse(r.data);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const blacklistRow = dbh
      .prepare('SELECT data FROM blacklist WHERE personId = ? AND COALESCE(isActive,0) = 1')
      .get(id) as { data: string } | undefined;
    let blacklistRecord: unknown | undefined = undefined;
    if (blacklistRow?.data) {
      try {
        blacklistRecord = JSON.parse(blacklistRow.data);
      } catch {
        // ignore
      }
    }

    const today = toIsoDateOnly(new Date());

    const statRow = dbh
      .prepare(
        `
        SELECT
          COUNT(1) AS total,
          SUM(
            CASE
              WHEN COALESCE(i.status,'') = 'ملغي' THEN 0
              WHEN COALESCE(i.remaining,0) > 0 AND COALESCE(i.dueDate,'') < ? THEN 1
              ELSE 0
            END
          ) AS late
        FROM installments i
        JOIN contracts c ON c.id = i.contractId
        WHERE c.tenantId = ?
          AND COALESCE(c.isArchived,0) = 0
          AND COALESCE(i.isArchived,0) = 0
      `
      )
      .get(today, id) as { total?: number; late?: number } | undefined;

    const totalInstallments = Number(statRow?.total || 0) || 0;
    const lateInstallments = Number(statRow?.late || 0) || 0;
    const commitmentRatio = totalInstallments
      ? Math.round(((totalInstallments - lateInstallments) / totalInstallments) * 100)
      : 100;

    return {
      ok: true,
      data: {
        person,
        roles,
        ownedProperties,
        contracts,
        ...(blacklistRecord ? { blacklistRecord } : {}),
        stats: {
          totalInstallments,
          lateInstallments,
          commitmentRatio,
        },
      },
    };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل قراءة بيانات الشخص';
    return { ok: false, message };
  }
}

export function domainPersonTenancyContracts(personId: string): {
  ok: boolean;
  items?: Array<{
    contract: unknown;
    propertyCode?: string;
    propertyAddress?: string;
    tenantName?: string;
  }>;
  message?: string;
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const id = String(personId || '').trim();
  if (!id) return errorResult('ERR_INVALID_ID', 'معرف غير صالح');

  try {
    const rows = dbh
      .prepare(
        `
        SELECT
          c.data AS contractData,
          pr.internalCode AS propertyCode,
          pr.address AS propertyAddress,
          t.name AS tenantName
        FROM contracts c
        LEFT JOIN properties pr ON pr.id = c.propertyId
        LEFT JOIN people t ON t.id = c.tenantId
        WHERE (c.tenantId = ? OR c.guarantorId = ? OR pr.ownerId = ?)
          AND COALESCE(c.isArchived,0) = 0
        ORDER BY COALESCE(c.startDate,'') DESC, c.id DESC
        LIMIT 2000
      `
      )
      .all(id, id, id) as Array<{
      contractData: string;
      propertyCode?: string;
      propertyAddress?: string;
      tenantName?: string;
    }>;

    const items = rows
      .map((r) => {
        let contract: unknown | null = null;
        try {
          contract = JSON.parse(r.contractData);
        } catch {
          contract = null;
        }
        if (!contract) return null;
        return {
          contract,
          propertyCode: r.propertyCode ? String(r.propertyCode) : undefined,
          propertyAddress: r.propertyAddress ? String(r.propertyAddress) : undefined,
          tenantName: r.tenantName ? String(r.tenantName) : undefined,
        };
      })
      .filter(isNonNull);

    return { ok: true, items };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل جلب عقود الشخص';
    return { ok: false, message };
  }
}

export function domainPropertyContracts(
  propertyId: string,
  limit = 5000
): {
  ok: boolean;
  items?: Array<{ contract: unknown; tenantName?: string; guarantorName?: string }>;
  message?: string;
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const pid = String(propertyId || '').trim();
  if (!pid) return errorResult('ERR_INVALID_ID', 'معرف غير صالح');

  const cap = Math.max(1, Math.min(5000, Math.trunc(Number(limit) || 5000)));

  try {
    const rows = dbh
      .prepare(
        `
        SELECT
          c.data AS contractData,
          COALESCE(t.name, '') AS tenantName,
          COALESCE(g.name, '') AS guarantorName
        FROM contracts c
        LEFT JOIN people t ON t.id = c.tenantId
        LEFT JOIN people g ON g.id = c.guarantorId
        WHERE c.propertyId = ?
          AND COALESCE(c.isArchived, 0) = 0
        ORDER BY
          COALESCE(c.startDate, '') DESC,
          COALESCE(c.endDate, '') DESC,
          c.id DESC
        LIMIT ?
      `
      )
      .all(pid, cap) as Array<{ contractData: string; tenantName: string; guarantorName: string }>;

    const items = rows
      .map((r) => {
        try {
          const contract = JSON.parse(String(r.contractData || ''));
          return {
            contract,
            tenantName: String(r.tenantName || '').trim() || undefined,
            guarantorName: String(r.guarantorName || '').trim() || undefined,
          };
        } catch {
          return null;
        }
      })
      .filter(isNonNull);

    return { ok: true, items };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل قراءة عقود العقار';
    return { ok: false, message };
  }
}

export function domainContractDetails(contractId: string): {
  ok: boolean;
  data?: { contract: unknown; property?: unknown; tenant?: unknown; installments: unknown[] };
  message?: string;
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const cid = String(contractId || '').trim();
  if (!cid) return errorResult('ERR_INVALID_ID', 'معرف غير صالح');

  try {
    const row = dbh
      .prepare('SELECT data, propertyId, tenantId FROM contracts WHERE id = ? LIMIT 1')
      .get(cid) as { data?: string; propertyId?: string; tenantId?: string } | undefined;

    if (!row?.data) return errorResult('ERR_CONTRACT_NOT_FOUND', 'العقد غير موجود');

    let contract: unknown;
    try {
      contract = JSON.parse(String(row.data || ''));
    } catch {
      return errorResult('ERR_INVALID_CONTRACT_DATA', 'بيانات العقد غير صالحة');
    }

    const pid = String(row.propertyId || '').trim();
    const tid = String(row.tenantId || '').trim();

    let property: unknown | undefined;
    if (pid) {
      const pr = dbh.prepare('SELECT data FROM properties WHERE id = ? LIMIT 1').get(pid) as
        | { data?: string }
        | undefined;
      if (pr?.data) {
        try {
          property = JSON.parse(String(pr.data || ''));
        } catch {
          property = undefined;
        }
      }
    }

    let tenant: unknown | undefined;
    if (tid) {
      const tr = dbh.prepare('SELECT data FROM people WHERE id = ? LIMIT 1').get(tid) as
        | { data?: string }
        | undefined;
      if (tr?.data) {
        try {
          tenant = JSON.parse(String(tr.data || ''));
        } catch {
          tenant = undefined;
        }
      }
    }

    const instRows = dbh
      .prepare(
        `
        SELECT data
        FROM installments
        WHERE contractId = ?
          AND COALESCE(isArchived, 0) = 0
        ORDER BY COALESCE(dueDate, '') ASC, id ASC
      `
      )
      .all(cid) as Array<{ data: string }>;

    const installments = instRows
      .map((r) => {
        try {
          return JSON.parse(String(r.data || ''));
        } catch {
          return null;
        }
      })
      .filter((x): x is unknown => Boolean(x));

    // Keep legacy ordering semantics when rank is available.
    installments.sort((a, b) => {
      const aRec = toRecord(a);
      const bRec = toRecord(b);

      const ar = toNumber(aRec['ترتيب_الكمبيالة'] ?? aRec.rank);
      const br = toNumber(bRec['ترتيب_الكمبيالة'] ?? bRec.rank);
      if (ar !== br) return ar - br;

      return String(aRec['تاريخ_استحقاق'] ?? aRec.dueDate ?? '').localeCompare(
        String(bRec['تاريخ_استحقاق'] ?? bRec.dueDate ?? '')
      );
    });

    return { ok: true, data: { contract, property, tenant, installments } };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل تحميل تفاصيل العقد';
    return { ok: false, message };
  }
}

export function domainSearch(
  entity: 'people' | 'properties' | 'contracts',
  query: string,
  limit = 50
): { ok: boolean; items?: unknown[]; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(query || '').trim();
  const qLower = q.toLowerCase();
  const qDigits = normalizeDigitsLoose(q);
  const cap = Math.max(1, Math.min(200, Math.trunc(Number(limit) || 50)));

  // For empty query, return a stable sample ordered by name/code.
  const like = `%${qLower}%`;
  const likeDigits = qDigits ? `%${qDigits}%` : '';

  try {
    if (entity === 'people') {
      const rows = q
        ? (dbh
            .prepare(
              `
              SELECT data
              FROM people
              WHERE lower(COALESCE(name,'')) LIKE ?
                 OR COALESCE(phone,'') LIKE ?
                 OR COALESCE(nationalId,'') LIKE ?
              ORDER BY COALESCE(name,'') ASC
              LIMIT ?
            `
            )
            .all(like, like, like, cap) as Array<{ data: string }>)
        : (dbh
            .prepare(
              `
              SELECT data
              FROM people
              ORDER BY COALESCE(name,'') ASC
              LIMIT ?
            `
            )
            .all(cap) as Array<{ data: string }>);

      const items = rows
        .map((r) => {
          try {
            return JSON.parse(r.data);
          } catch {
            return null;
          }
        })
        .filter((x): x is unknown => Boolean(x));

      return { ok: true, items };
    }

    if (entity === 'properties') {
      const rows = q
        ? (() => {
            const sql = qDigits
              ? `
              SELECT data
              FROM properties
              WHERE lower(COALESCE(internalCode,'')) LIKE ?
                 OR lower(COALESCE(address,'')) LIKE ?
                 OR ${sqlNormalizeDigits("COALESCE(internalCode,'')")} LIKE ?
              ORDER BY COALESCE(internalCode,'') ASC
              LIMIT ?
            `
              : `
              SELECT data
              FROM properties
              WHERE lower(COALESCE(internalCode,'')) LIKE ?
                 OR lower(COALESCE(address,'')) LIKE ?
              ORDER BY COALESCE(internalCode,'') ASC
              LIMIT ?
            `;

            const args = qDigits ? [like, like, likeDigits, cap] : [like, like, cap];
            return dbh.prepare(sql).all(...args) as Array<{ data: string }>;
          })()
        : (dbh
            .prepare(
              `
              SELECT data
              FROM properties
              ORDER BY COALESCE(internalCode,'') ASC
              LIMIT ?
            `
            )
            .all(cap) as Array<{ data: string }>);

      const items = rows
        .map((r) => {
          try {
            return JSON.parse(r.data);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return { ok: true, items };
    }

    // contracts
    const rows = q
      ? (dbh
          .prepare(
            `
            SELECT data
            FROM contracts
            WHERE lower(id) LIKE ?
               OR lower(COALESCE(status,'')) LIKE ?
            ORDER BY id DESC
            LIMIT ?
          `
          )
          .all(like, like, cap) as Array<{ data: string }>)
      : (dbh
          .prepare(
            `
            SELECT data
            FROM contracts
            ORDER BY id DESC
            LIMIT ?
          `
          )
          .all(cap) as Array<{ data: string }>);

    const items = rows
      .map((r) => {
        try {
          return JSON.parse(r.data);
        } catch {
          return null;
        }
      })
      .filter((x): x is unknown => Boolean(x));

    return { ok: true, items };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل البحث';
    return { ok: false, message };
  }
}

export function domainSearchGlobal(query: string): {
  ok: boolean;
  people?: unknown[];
  properties?: unknown[];
  contracts?: unknown[];
  message?: string;
} {
  const q = String(query || '').trim();
  if (!q) return { ok: true, people: [], properties: [], contracts: [] };

  const peopleRes = domainSearch('people', q, 5);
  if (!peopleRes.ok) return { ok: false, message: peopleRes.message };

  const propRes = domainSearch('properties', q, 5);
  if (!propRes.ok) return { ok: false, message: propRes.message };

  const contRes = domainSearch('contracts', q, 5);
  if (!contRes.ok) return { ok: false, message: contRes.message };

  return {
    ok: true,
    people: peopleRes.items || [],
    properties: propRes.items || [],
    contracts: contRes.items || [],
  };
}

export function domainPropertyPickerSearch(payload: {
  query?: string;
  status?: string;
  type?: string;
  furnishing?: string;
  forceVacant?: boolean;
  occupancy?: 'all' | 'rented' | 'vacant';
  sale?: 'for-sale' | 'not-for-sale' | '';
  rent?: 'for-rent' | 'not-for-rent' | '';
  minArea?: string;
  maxArea?: string;
  floor?: string;
  minPrice?: string;
  maxPrice?: string;
  contractLink?: '' | 'linked' | 'unlinked' | 'all';
  sort?: string;
  offset?: number;
  limit?: number;
}): { ok: boolean; items?: unknown[]; total?: number; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(payload?.query || '').trim();
  const qText = normalizeSearchText(q);
  const qDigits = normalizeDigitsLoose(q);
  const status = String(payload?.status || '').trim();
  const type = String(payload?.type || '').trim();
  const furnishing = String(payload?.furnishing || '').trim();
  const forceVacant = !!payload?.forceVacant;
  const sort = String(payload?.sort || '').trim();
  const occupancyRaw = String(payload?.occupancy || '').trim();
  const occupancy: 'rented' | 'vacant' | 'all' =
    occupancyRaw === 'rented' || occupancyRaw === 'vacant' || occupancyRaw === 'all'
      ? occupancyRaw
      : 'all';
  const saleRaw = String(payload?.sale || '').trim();
  const sale: 'for-sale' | 'not-for-sale' | '' =
    saleRaw === 'for-sale' || saleRaw === 'not-for-sale' ? saleRaw : '';
  const rentRaw = String(payload?.rent || '').trim();
  const rent: 'for-rent' | 'not-for-rent' | '' =
    rentRaw === 'for-rent' || rentRaw === 'not-for-rent' ? rentRaw : '';

  const contractLinkRaw = String(payload?.contractLink || '').trim();
  const contractLink: '' | 'linked' | 'unlinked' | 'all' =
    contractLinkRaw === 'linked' || contractLinkRaw === 'unlinked' || contractLinkRaw === 'all'
      ? contractLinkRaw
      : 'all';

  const normalizeNumericInput = (value: unknown): number | null => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (!text) return null;
    const normalized = text.replace(/[\s,]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const minAreaNum = normalizeNumericInput(payload?.minArea);
  const maxAreaNum = normalizeNumericInput(payload?.maxArea);
  const minPriceNum = normalizeNumericInput(payload?.minPrice);
  const maxPriceNum = normalizeNumericInput(payload?.maxPrice);
  const floorText = String(payload?.floor || '').trim();
  const floorLike = floorText ? `%${floorText.toLowerCase()}%` : '';

  const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
  const cap = Math.max(1, Math.min(500, Math.trunc(Number(payload?.limit) || 200)));
  const likeText = `%${qText}%`;
  const likeDigits = qDigits ? `%${qDigits}%` : '';
  const today = toIsoDateOnly(new Date());

  try {
    const contractStatusExpr = (alias: string) =>
      sqlNormalizeArabicTextLower(`TRIM(COALESCE(${alias}.status, ''))`);
    const contractIsTerminatedSql = (alias: string) => {
      const s = contractStatusExpr(alias);
      return `(${s} LIKE 'مفسوخ%' OR ${s} LIKE 'ملغ%' OR ${s} LIKE '%الغاء%')`;
    };
    const contractIsExpiredSql = (alias: string) => {
      const s = contractStatusExpr(alias);
      return `(${s} LIKE 'منتهي%')`;
    };

    const whereParts: string[] = [];
    const args: unknown[] = [];

    if (q) {
      const orParts: string[] = [];
      orParts.push(`${sqlNormalizeArabicTextLower("COALESCE(pr.internalCode,'')")} LIKE ?`);
      orParts.push(`${sqlNormalizeArabicTextLower("COALESCE(pr.address,'')")} LIKE ?`);
      orParts.push(`${sqlNormalizeArabicTextLower("COALESCE(owner.name,'')")} LIKE ?`);
      args.push(likeText, likeText, likeText);

      if (qDigits) {
        orParts.push(`${sqlNormalizeDigits("COALESCE(pr.internalCode,'')")} LIKE ?`);
        orParts.push(`${sqlNormalizeDigits("COALESCE(owner.phone,'')")} LIKE ?`);
        orParts.push(`${sqlNormalizeDigits("COALESCE(owner.nationalId,'')")} LIKE ?`);
        args.push(likeDigits, likeDigits, likeDigits);
      }

      whereParts.push(`(${orParts.join(' OR ')})`);
    }
    if (status) {
      // Treat some legacy/UX statuses as occupancy filters rather than exact-string matches.
      // This keeps "شاغر" and "مؤجر" working even when datasets store other vacancy/rent labels.
      const statusNorm = normalizeSearchText(status);
      if (statusNorm === 'شاغر') {
        whereParts.push('COALESCE(pr.isRented, 0) = 0');
      } else if (statusNorm === 'مؤجر') {
        whereParts.push('COALESCE(pr.isRented, 0) = 1');
      } else {
        whereParts.push("COALESCE(pr.status,'') = ?");
        args.push(status);
      }
    }
    if (type) {
      whereParts.push("COALESCE(pr.type,'') = ?");
      args.push(type);
    }

    if (furnishing) {
      whereParts.push("COALESCE(JSON_EXTRACT(pr.data, '$.\\\"نوع_التاثيث\\\"'), '') = ?");
      args.push(furnishing);
    }

    if (occupancy === 'rented') {
      whereParts.push('COALESCE(pr.isRented, 0) = 1');
    } else if (occupancy === 'vacant') {
      whereParts.push('COALESCE(pr.isRented, 0) = 0');
    }

    if (sale === 'for-sale') {
      whereParts.push('COALESCE(pr.isForSale, 0) = 1');
    } else if (sale === 'not-for-sale') {
      whereParts.push('COALESCE(pr.isForSale, 0) = 0');
    }

    if (rent === 'for-rent') {
      whereParts.push('COALESCE(pr.isForRent, 1) = 1');
    } else if (rent === 'not-for-rent') {
      whereParts.push('COALESCE(pr.isForRent, 1) = 0');
    }

    // Advanced filters (best-effort parity with legacy UI)
    if (minAreaNum !== null) {
      whereParts.push('CAST(COALESCE(json_extract(pr.data, \'$."المساحة"\'), 0) AS REAL) >= ?');
      args.push(minAreaNum);
    }
    if (maxAreaNum !== null) {
      whereParts.push('CAST(COALESCE(json_extract(pr.data, \'$."المساحة"\'), 0) AS REAL) <= ?');
      args.push(maxAreaNum);
    }
    if (floorLike) {
      whereParts.push(
        "lower(COALESCE(CAST(json_extract(pr.data, '$.\"الطابق\"') AS TEXT), '')) LIKE ?"
      );
      args.push(floorLike);
    }

    // Price filtering: align with legacy logic (salePrice when for-sale, otherwise estimated rent if present)
    const estimatedRentExpr =
      "CAST(COALESCE(NULLIF(REPLACE(REPLACE(COALESCE(CAST(json_extract(pr.data, '$.\\\"الإيجار_التقديري\\\"') AS TEXT), ''), ',', ''), ' ', ''), ''), '0') AS REAL)";
    const effectivePriceExpr = `CASE WHEN COALESCE(pr.isForSale, 0) = 1 THEN COALESCE(pr.salePrice, 0) ELSE ${estimatedRentExpr} END`;

    if (minPriceNum !== null) {
      whereParts.push(`(${effectivePriceExpr}) >= ?`);
      args.push(minPriceNum);
    }
    if (maxPriceNum !== null) {
      whereParts.push(`(${effectivePriceExpr}) <= ?`);
      args.push(maxPriceNum);
    }

    if (forceVacant) {
      // Keep consistent with the active-contract subquery used in the SELECT.
      whereParts.push(
        `NOT EXISTS (
          SELECT 1
          FROM contracts c2
          WHERE c2.propertyId = pr.id
            AND (c2.isArchived IS NULL OR c2.isArchived = 0)
            AND (
              c2.status IN ('نشط', 'قريب الانتهاء', 'قريبة الانتهاء', 'مجدد')
              OR (
                c2.endDate IS NOT NULL
                AND c2.endDate >= ?
                AND NOT ${contractIsExpiredSql('c2')}
                AND NOT ${contractIsTerminatedSql('c2')}
              )
            )
        )`
      );
      args.push(today);
    }

    if (contractLink === 'linked' || contractLink === 'unlinked') {
      const existsKeyword = contractLink === 'linked' ? 'EXISTS' : 'NOT EXISTS';
      whereParts.push(
        `${existsKeyword} (
          SELECT 1
          FROM contracts c3
          WHERE c3.propertyId = pr.id
            AND (c3.isArchived IS NULL OR c3.isArchived = 0)
            AND (
              c3.status IN ('نشط', 'قريب الانتهاء', 'قريبة الانتهاء', 'مجدد')
              OR (
                c3.endDate IS NOT NULL
                AND c3.endDate >= ?
                AND NOT ${contractIsExpiredSql('c3')}
                AND NOT ${contractIsTerminatedSql('c3')}
              )
            )
        )`
      );
      args.push(today);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(1) AS cnt
      FROM properties pr
      LEFT JOIN people owner ON owner.id = pr.ownerId
      ${whereSql}
    `;

    // Join owner name, and optionally join ONE active contract (best-effort) for tenant display.
    // We avoid window functions for compatibility: pick the best contract via a correlated subquery.
    const sql = `
      SELECT
        pr.data AS propertyData,
        COALESCE(owner.name, 'غير معروف') AS ownerName,
        COALESCE(owner.phone, '') AS ownerPhone,
        COALESCE(owner.nationalId, '') AS ownerNationalId,
        ac.id AS activeContractId,
        COALESCE(ac.status, '') AS contractStatus,
        COALESCE(ac.startDate, '') AS contractStartDate,
        COALESCE(ac.endDate, '') AS contractEndDate,
        COALESCE(t.name, '') AS tenantName,
        COALESCE(t.phone, '') AS tenantPhone,
        COALESCE(g.name, '') AS guarantorName,
        COALESCE(g.phone, '') AS guarantorPhone
      FROM properties pr
      LEFT JOIN people owner ON owner.id = pr.ownerId
      LEFT JOIN contracts ac ON ac.id = (
        SELECT c.id
        FROM contracts c
        WHERE c.propertyId = pr.id
          AND (c.isArchived IS NULL OR c.isArchived = 0)
          AND (
            c.status IN ('نشط', 'قريب الانتهاء', 'قريبة الانتهاء', 'مجدد')
            OR (
              c.endDate IS NOT NULL
              AND c.endDate >= ?
              AND NOT ${contractIsExpiredSql('c')}
              AND NOT ${contractIsTerminatedSql('c')}
            )
          )
        ORDER BY
          CASE COALESCE(c.status, '')
            WHEN 'نشط' THEN 3
            WHEN 'قريب الانتهاء' THEN 2
            WHEN 'مجدد' THEN 1
            ELSE 0
          END DESC,
          COALESCE(c.startDate, '') DESC,
          c.id DESC
        LIMIT 1
      )
      LEFT JOIN people t ON t.id = ac.tenantId
      LEFT JOIN people g ON g.id = ac.guarantorId
      ${whereSql}
      ORDER BY ${(() => {
        // NOTE: Keep SQL injection-safe by mapping to fixed ORDER BY clauses.
        switch (sort) {
          case 'updated-asc':
            return "COALESCE(pr.updatedAt, '') ASC, pr.id ASC";
          case 'updated-desc':
            return "COALESCE(pr.updatedAt, '') DESC, pr.id DESC";
          case 'code-desc':
            return "COALESCE(pr.internalCode, '') DESC";
          case 'code-asc':
          default:
            return "COALESCE(pr.internalCode, '') ASC";
        }
      })()}
      LIMIT ? OFFSET ?
    `;

    // Note: today must be first arg (for subquery), then dynamic where args (may include today again for forceVacant), then paging.
    const total = toNumber(toRecord(dbh.prepare(countSql).get(...args)).cnt);
    const rows = dbh.prepare(sql).all(today, ...args, cap, offset) as unknown[];
    const items = rows
      .map((row) => {
        const r = toRecord(row);

        let property: unknown = null;
        try {
          property = JSON.parse(String(r.propertyData ?? 'null'));
        } catch {
          property = null;
        }
        if (!property) return null;

        return {
          property,
          ownerName: String(r.ownerName ?? ''),
          ownerPhone: String(r.ownerPhone ?? ''),
          ownerNationalId: String(r.ownerNationalId ?? ''),
          active: r.activeContractId
            ? {
                contractId: String(r.activeContractId ?? ''),
                status: String(r.contractStatus ?? ''),
                startDate: String(r.contractStartDate ?? ''),
                endDate: String(r.contractEndDate ?? ''),
                tenantName: String(r.tenantName ?? ''),
                tenantPhone: String(r.tenantPhone ?? ''),
                guarantorName: String(r.guarantorName ?? ''),
                guarantorPhone: String(r.guarantorPhone ?? ''),
              }
            : null,
        };
      })
      .filter(isNonNull);

    return { ok: true, items, total };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل البحث عن العقارات';
    return { ok: false, message };
  }
}

export function domainContractPickerSearch(payload: {
  query?: string;
  tab?: string;
  createdMonth?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  minValue?: number | string;
  maxValue?: number | string;
  sort?: string;
  offset?: number;
  limit?: number;
}): { ok: boolean; items?: unknown[]; total?: number; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(payload?.query || '').trim();
  const qText = normalizeSearchText(q);
  const qDigits = normalizeDigitsLoose(q);
  const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
  const cap = Math.max(1, Math.min(500, Math.trunc(Number(payload?.limit) || 200)));
  const likeText = `%${qText}%`;
  const likeDigits = qDigits ? `%${qDigits}%` : '';

  const today = toIsoDateOnly(new Date());
  const soon = toIsoDateOnly(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const tab = String(payload?.tab || '').trim();
  const createdMonth = String(payload?.createdMonth || '').trim();
  const sort = String(payload?.sort || '').trim();

  const startDateFrom = String(payload?.startDateFrom || '').trim();
  const startDateTo = String(payload?.startDateTo || '').trim();
  const endDateFrom = String(payload?.endDateFrom || '').trim();
  const endDateTo = String(payload?.endDateTo || '').trim();
  const minValueNum = Number(payload?.minValue ?? NaN);
  const maxValueNum = Number(payload?.maxValue ?? NaN);

  const tabWhere = () => {
    const statusExpr = sqlNormalizeArabicTextLower("TRIM(COALESCE(c.status, ''))");
    const isTerminated = `(${statusExpr} LIKE 'مفسوخ%' OR ${statusExpr} LIKE 'ملغ%' OR ${statusExpr} LIKE '%الغاء%')`;
    const isExpired = `(${statusExpr} LIKE 'منتهي%')`;

    // NOTE: Tabs are in UI hash: active|expiring|expired|terminated|archived.
    // Keep best-effort alignment with existing logic.
    if (tab === 'archived')
      return { sql: 'COALESCE(CAST(c.isArchived AS INTEGER), 0) = 1', args: [] as unknown[] };

    // Default: exclude archived
    const base = {
      sql: '(c.isArchived IS NULL OR COALESCE(CAST(c.isArchived AS INTEGER), 0) = 0)',
      args: [] as unknown[],
    };
    if (tab === 'active') {
      return {
        // Be tolerant of legacy values (e.g., 'ساري/سارية/Active') and avoid relying on string date comparisons.
        sql: `${base.sql} AND NOT ${isTerminated} AND NOT ${isExpired}`,
        args: [],
      };
    }
    if (tab === 'expiring') {
      return {
        sql: `${base.sql} AND (
          ${statusExpr} IN ('قريب الانتهاء', 'قريبة الانتهاء')
          OR (
            c.endDate IS NOT NULL AND c.endDate <> ''
            AND c.endDate >= ? AND c.endDate <= ?
            AND NOT ${isTerminated}
            AND NOT ${isExpired}
          )
        )`,
        args: [today, soon],
      };
    }
    if (tab === 'expired') {
      return {
        sql: `${base.sql} AND (
          ${isExpired}
          OR (
            c.endDate IS NOT NULL AND c.endDate <> ''
            AND c.endDate < ?
            AND NOT ${isTerminated}
          )
        )`,
        args: [today],
      };
    }
    if (tab === 'terminated') {
      return { sql: `${base.sql} AND ${isTerminated}`, args: [] as unknown[] };
    }

    // all / unknown
    return base;
  };

  try {
    const tabClause = tabWhere();
    const searchSql = (() => {
      if (!q) return '';

      const orParts: string[] = [];
      orParts.push(`${sqlNormalizeArabicTextLower("COALESCE(c.id, '')")} LIKE ?`);
      orParts.push(`${sqlNormalizeArabicTextLower("COALESCE(pr.internalCode, '')")} LIKE ?`);
      orParts.push(`${sqlNormalizeArabicTextLower("COALESCE(owner.name, '')")} LIKE ?`);
      orParts.push(`${sqlNormalizeArabicTextLower("COALESCE(tenant.name, '')")} LIKE ?`);

      if (qDigits) {
        orParts.push(`${sqlNormalizeDigits("COALESCE(pr.internalCode, '')")} LIKE ?`);
        orParts.push(`${sqlNormalizeDigits("COALESCE(owner.nationalId, '')")} LIKE ?`);
        orParts.push(`${sqlNormalizeDigits("COALESCE(tenant.nationalId, '')")} LIKE ?`);
        orParts.push(`${sqlNormalizeDigits("COALESCE(owner.phone, '')")} LIKE ?`);
        orParts.push(`${sqlNormalizeDigits("COALESCE(tenant.phone, '')")} LIKE ?`);
      }

      return `(${orParts.join(' OR ')})`;
    })();

    const whereParts: string[] = [];
    const whereArgs: unknown[] = [];
    if (tabClause.sql) {
      whereParts.push(tabClause.sql);
      whereArgs.push(...tabClause.args);
    }
    if (searchSql) {
      whereParts.push(searchSql);
      whereArgs.push(likeText, likeText, likeText, likeText);
      if (qDigits) whereArgs.push(likeDigits, likeDigits, likeDigits, likeDigits, likeDigits);
    }

    if (/^\d{4}-\d{2}$/.test(createdMonth)) {
      // Prefer explicit creation date stored in JSON, fall back to startDate if missing.
      whereParts.push(
        "SUBSTR(COALESCE(NULLIF(JSON_EXTRACT(c.data, '$.تاريخ_الانشاء'), ''), COALESCE(c.startDate, ''), ''), 1, 7) = ?"
      );
      whereArgs.push(createdMonth);
    }

    // Advanced date range filters (YYYY-MM-DD). String compare is safe for ISO date-only.
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDateFrom)) {
      whereParts.push("COALESCE(NULLIF(c.startDate, ''), '0000-00-00') >= ?");
      whereArgs.push(startDateFrom);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDateTo)) {
      whereParts.push("COALESCE(NULLIF(c.startDate, ''), '0000-00-00') <= ?");
      whereArgs.push(startDateTo);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDateFrom)) {
      whereParts.push("COALESCE(NULLIF(c.endDate, ''), '0000-00-00') >= ?");
      whereArgs.push(endDateFrom);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDateTo)) {
      whereParts.push("COALESCE(NULLIF(c.endDate, ''), '9999-12-31') <= ?");
      whereArgs.push(endDateTo);
    }

    // Advanced value range filters (annual value in contract JSON)
    const annualValueExpr =
      "CAST(COALESCE(NULLIF(JSON_EXTRACT(c.data, '$.القيمة_السنوية'), ''), 0) AS REAL)";
    if (Number.isFinite(minValueNum) && minValueNum > 0) {
      whereParts.push(`${annualValueExpr} >= ?`);
      whereArgs.push(minValueNum);
    }
    if (Number.isFinite(maxValueNum) && maxValueNum > 0) {
      whereParts.push(`${annualValueExpr} <= ?`);
      whereArgs.push(maxValueNum);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const count = dbh
      .prepare(
        `
        SELECT COUNT(1) AS cnt
        FROM contracts c
        LEFT JOIN properties pr ON pr.id = c.propertyId
        LEFT JOIN people tenant ON tenant.id = c.tenantId
        LEFT JOIN people owner ON owner.id = pr.ownerId
        ${whereSql}
      `
      )
      .get(...whereArgs);

    const total = toNumber(toRecord(count).cnt);

    const rows = dbh
      .prepare(
        `
        SELECT
          c.data AS contractData,
          COALESCE(pr.internalCode, '') AS propertyCode,
          COALESCE(owner.name, '') AS ownerName,
          COALESCE(tenant.name, '') AS tenantName,
          COALESCE(owner.nationalId, '') AS ownerNationalId,
          COALESCE(tenant.nationalId, '') AS tenantNationalId,
          COALESCE(inst.remainingAmount, 0) AS remainingAmount
        FROM contracts c
        LEFT JOIN properties pr ON pr.id = c.propertyId
        LEFT JOIN people tenant ON tenant.id = c.tenantId
        LEFT JOIN people owner ON owner.id = pr.ownerId
        LEFT JOIN (
          SELECT i.contractId AS contractId, SUM(COALESCE(i.remaining, 0)) AS remainingAmount
          FROM installments i
          WHERE (i.isArchived IS NULL OR i.isArchived = 0)
            AND (i.status IS NULL OR i.status <> 'ملغي')
            AND COALESCE(i.remaining, 0) > 0
          GROUP BY i.contractId
        ) inst ON inst.contractId = c.id
        ${whereSql}
        ORDER BY ${(() => {
          // NOTE: Keep SQL injection-safe by mapping to fixed ORDER BY clauses.
          const createdExpr =
            "COALESCE(NULLIF(JSON_EXTRACT(c.data, '$.تاريخ_الانشاء'), ''), COALESCE(c.startDate, ''), '')";
          switch (sort) {
            case 'created-asc':
              return `${createdExpr} ASC, c.id ASC`;
            case 'end-asc':
              return "COALESCE(c.endDate, '') ASC, c.id ASC";
            case 'end-desc':
              return "COALESCE(c.endDate, '') DESC, c.id DESC";
            case 'created-desc':
            default:
              return `${createdExpr} DESC, c.id DESC`;
          }
        })()}
        LIMIT ? OFFSET ?
      `
      )
      .all(...whereArgs, cap, offset) as unknown[];

    const items = rows
      .map((row) => {
        const r = toRecord(row);

        let contract: unknown = null;
        try {
          contract = JSON.parse(String(r.contractData ?? 'null'));
        } catch {
          contract = null;
        }
        if (!contract) return null;
        return {
          contract,
          propertyCode: String(r.propertyCode ?? ''),
          ownerName: String(r.ownerName ?? ''),
          tenantName: String(r.tenantName ?? ''),
          ownerNationalId: String(r.ownerNationalId ?? ''),
          tenantNationalId: String(r.tenantNationalId ?? ''),
          remainingAmount: toNumber(r.remainingAmount),
        };
      })
      .filter(isNonNull);

    return { ok: true, items, total };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل البحث عن العقود';
    return { ok: false, message };
  }
}

export function domainPeoplePickerSearch(payload: {
  query?: string;
  role?: string;
  onlyIdleOwners?: boolean;
  address?: string;
  nationalId?: string;
  classification?: string;
  minRating?: number;
  sort?: string;
  offset?: number;
  limit?: number;
}): { ok: boolean; items?: unknown[]; total?: number; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(payload?.query || '').trim();
  const qText = normalizeSearchText(q);
  const qDigits = normalizeDigitsLoose(q);
  const role = String(payload?.role || '').trim();
  const onlyIdleOwners = !!payload?.onlyIdleOwners;
  const address = String(payload?.address || '').trim();
  const addressText = normalizeSearchText(address);
  const nationalIdFilter = String(payload?.nationalId || '').trim();
  const nationalIdDigits = normalizeDigitsLoose(nationalIdFilter);
  const classification = String(payload?.classification || '').trim();
  const minRating = Number(payload?.minRating ?? 0) || 0;
  const sort = String(payload?.sort || '').trim();
  const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
  const cap = Math.max(1, Math.min(200, Math.trunc(Number(payload?.limit) || 48)));
  const likeText = `%${qText}%`;
  const likeDigits = qDigits ? `%${qDigits}%` : '';
  const addressLike = `%${addressText}%`;
  const nidLike = nationalIdDigits ? `%${nationalIdDigits}%` : '';
  const today = toIsoDateOnly(new Date());

  try {
    const contractStatusExpr = (alias: string) =>
      sqlNormalizeArabicTextLower(`TRIM(COALESCE(${alias}.status, ''))`);
    const contractIsTerminatedSql = (alias: string) => {
      const s = contractStatusExpr(alias);
      return `(${s} LIKE 'مفسوخ%' OR ${s} LIKE 'ملغ%' OR ${s} LIKE '%الغاء%')`;
    };
    const contractIsExpiredSql = (alias: string) => {
      const s = contractStatusExpr(alias);
      return `(${s} LIKE 'منتهي%')`;
    };

    const whereParts: string[] = [];
    const args: unknown[] = [];

    if (q) {
      const orParts: string[] = [];
      orParts.push(`${sqlNormalizeArabicTextLower("COALESCE(pe.name,'')")} LIKE ?`);
      args.push(likeText);

      if (qDigits) {
        orParts.push(`${sqlNormalizeDigits("COALESCE(pe.phone,'')")} LIKE ?`);
        orParts.push(`${sqlNormalizeDigits("COALESCE(pe.nationalId,'')")} LIKE ?`);
        orParts.push(
          `${sqlNormalizeDigits("COALESCE(JSON_EXTRACT(pe.data, '$.رقم_هاتف_اضافي'), '')")} LIKE ?`
        );
        args.push(likeDigits, likeDigits, likeDigits);
      }

      whereParts.push(`(${orParts.join(' OR ')})`);
    }

    if (addressText) {
      whereParts.push(
        `${sqlNormalizeArabicTextLower("COALESCE(JSON_EXTRACT(pe.data, '$.العنوان'), '')")} LIKE ?`
      );
      args.push(addressLike);
    }

    if (nationalIdDigits) {
      whereParts.push(`${sqlNormalizeDigits("COALESCE(pe.nationalId,'')")} LIKE ?`);
      args.push(nidLike);
    }

    if (classification && classification !== 'All') {
      whereParts.push("COALESCE(JSON_EXTRACT(pe.data, '$.تصنيف'), '') = ?");
      args.push(classification);
    }

    if (minRating > 0) {
      whereParts.push("CAST(COALESCE(JSON_EXTRACT(pe.data, '$.تقييم'), 0) AS REAL) >= ?");
      args.push(minRating);
    }

    if (role && role !== 'all') {
      if (role === 'blacklisted') {
        whereParts.push(
          'EXISTS (SELECT 1 FROM blacklist bl WHERE bl.personId = pe.id AND COALESCE(bl.isActive, 1) = 1)'
        );
      } else {
        whereParts.push(
          'EXISTS (SELECT 1 FROM person_roles pr WHERE pr.personId = pe.id AND pr.role = ?)'
        );
        args.push(role);
      }
    }

    if (onlyIdleOwners && role === 'مالك') {
      // Owners whose properties are all vacant (no rented property).
      whereParts.push(
        `NOT EXISTS (
          SELECT 1
          FROM properties pr
          WHERE pr.ownerId = pe.id
            AND (
              COALESCE(pr.isRented,0) = 1
              OR ${sqlNormalizeArabicTextLower("TRIM(COALESCE(pr.status,''))")} LIKE 'مؤجر%'
            )
        )`
      );
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(1) AS cnt FROM people pe ${whereSql}`;

    const sql = `
      WITH base AS (
        SELECT
          pe.id AS personId,
          pe.data AS personData,
          pe.name AS personName,
          pe.phone AS personPhone,
          pe.nationalId AS personNationalId,
          pe.updatedAt AS personUpdatedAt,
          (SELECT GROUP_CONCAT(role, ' | ') FROM person_roles pr WHERE pr.personId = pe.id) AS rolesCsv,
          EXISTS (SELECT 1 FROM blacklist bl WHERE bl.personId = pe.id AND COALESCE(bl.isActive, 1) = 1) AS isBlacklisted,
          (
            SELECT c.id
            FROM contracts c
            WHERE c.tenantId = pe.id
              AND (c.isArchived IS NULL OR c.isArchived = 0)
              AND (
                c.status IN ('نشط', 'قريب الانتهاء', 'قريبة الانتهاء', 'مجدد')
                OR (
                  c.endDate IS NOT NULL
                  AND c.endDate >= ?
                  AND NOT ${contractIsExpiredSql('c')}
                  AND NOT ${contractIsTerminatedSql('c')}
                )
              )
            ORDER BY COALESCE(c.startDate, '') DESC, c.id DESC
            LIMIT 1
          ) AS tenantCid,
          (
            SELECT c.id
            FROM contracts c
            WHERE c.guarantorId = pe.id
              AND (c.isArchived IS NULL OR c.isArchived = 0)
              AND (
                c.status IN ('نشط', 'قريب الانتهاء', 'قريبة الانتهاء', 'مجدد')
                OR (
                  c.endDate IS NOT NULL
                  AND c.endDate >= ?
                  AND NOT ${contractIsExpiredSql('c')}
                  AND NOT ${contractIsTerminatedSql('c')}
                )
              )
            ORDER BY COALESCE(c.startDate, '') DESC, c.id DESC
            LIMIT 1
          ) AS guarCid,
          (
            SELECT c.id
            FROM contracts c
            WHERE c.propertyId IN (SELECT pr2.id FROM properties pr2 WHERE pr2.ownerId = pe.id)
              AND (c.isArchived IS NULL OR c.isArchived = 0)
              AND (
                c.status IN ('نشط', 'قريب الانتهاء', 'قريبة الانتهاء', 'مجدد')
                OR (
                  c.endDate IS NOT NULL
                  AND c.endDate >= ?
                  AND NOT ${contractIsExpiredSql('c')}
                  AND NOT ${contractIsTerminatedSql('c')}
                )
              )
            ORDER BY COALESCE(c.startDate, '') DESC, c.id DESC
            LIMIT 1
          ) AS ownerCid
        FROM people pe
        ${whereSql}
      )
      SELECT
        b.personData,
        b.rolesCsv,
        b.isBlacklisted,
        COALESCE(b.tenantCid, b.guarCid, b.ownerCid) AS pickCid,
        CASE
          WHEN b.tenantCid IS NOT NULL THEN 'tenant'
          WHEN b.guarCid IS NOT NULL THEN 'guarantor'
          WHEN b.ownerCid IS NOT NULL THEN 'owner'
          ELSE ''
        END AS pickSource,
        COALESCE(c.status, '') AS contractStatus,
        COALESCE(pr.internalCode, '') AS propertyCode,
        COALESCE(t.name, '') AS tenantName,
        COALESCE(g.name, '') AS guarantorName
      FROM base b
      LEFT JOIN contracts c ON c.id = COALESCE(b.tenantCid, b.guarCid, b.ownerCid)
      LEFT JOIN properties pr ON pr.id = c.propertyId
      LEFT JOIN people t ON t.id = c.tenantId
      LEFT JOIN people g ON g.id = c.guarantorId
      ORDER BY ${(() => {
        // NOTE: Keep SQL injection-safe by mapping to fixed ORDER BY clauses.
        const nameExpr = "COALESCE(JSON_EXTRACT(b.personData, '$.الاسم'), b.personName, '')";
        switch (sort) {
          case 'updated-asc':
            return "COALESCE(b.personUpdatedAt, '') ASC, b.personId ASC";
          case 'updated-desc':
            return "COALESCE(b.personUpdatedAt, '') DESC, b.personId DESC";
          case 'name-desc':
            return `${nameExpr} DESC`;
          case 'name-asc':
          default:
            return `${nameExpr} ASC`;
        }
      })()}
      LIMIT ? OFFSET ?
    `;

    const total = toNumber(toRecord(dbh.prepare(countSql).get(...args)).cnt);
    const rows = dbh.prepare(sql).all(today, today, today, ...args, cap, offset) as unknown[];
    const items = rows
      .map((row) => {
        const r = toRecord(row);

        let person: unknown = null;
        try {
          person = JSON.parse(String(r.personData ?? 'null'));
        } catch {
          person = null;
        }
        if (!person) return null;
        const rolesCsv = String(r.rolesCsv ?? '').trim();
        const roles = rolesCsv
          ? rolesCsv
              .split(' | ')
              .map((x) => x.trim())
              .filter(Boolean)
          : [];
        const pickCid = String(r.pickCid ?? '').trim();
        const pickSource = String(r.pickSource ?? '').trim();
        return {
          person,
          roles,
          isBlacklisted: !!r.isBlacklisted,
          link: pickCid
            ? {
                contractId: pickCid,
                status: String(r.contractStatus ?? ''),
                propertyCode: String(r.propertyCode ?? ''),
                tenantName: String(r.tenantName ?? ''),
                guarantorName: String(r.guarantorName ?? ''),
                source: pickSource,
              }
            : null,
        };
      })
      .filter(isNonNull);

    return { ok: true, items, total };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل البحث عن الأشخاص';
    return { ok: false, message };
  }
}

export function domainInstallmentsContractsSearch(payload: {
  query?: string;
  filter?: 'all' | 'debt' | 'paid' | 'due' | string;
  sort?: string;
  offset?: number;
  limit?: number;
  filterStartDate?: string;
  filterEndDate?: string;
  filterMinAmount?: number;
  filterMaxAmount?: number;
  filterPaymentMethod?: string;
}): { ok: boolean; items?: unknown[]; total?: number; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(payload?.query || '').trim();
  const qLower = q.toLowerCase();
  const qDigits = normalizeDigitsLoose(q);
  const filter = String(payload?.filter || 'all').trim() as
    | 'all'
    | 'debt'
    | 'paid'
    | 'due'
    | string;
  const sort = String(payload?.sort || 'due-asc').trim();
  const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
  const cap = Math.max(1, Math.min(100, Math.trunc(Number(payload?.limit) || 20)));

  const filterStartDate = String(payload?.filterStartDate || '').trim().slice(0, 32);
  const filterEndDate = String(payload?.filterEndDate || '').trim().slice(0, 32);
  const rawMin = payload?.filterMinAmount;
  const rawMax = payload?.filterMaxAmount;
  const filterMinNum =
    rawMin !== undefined && rawMin !== null && String(rawMin) !== '' && Number.isFinite(Number(rawMin))
      ? Number(rawMin)
      : NaN;
  const filterMaxNum =
    rawMax !== undefined && rawMax !== null && String(rawMax) !== '' && Number.isFinite(Number(rawMax))
      ? Number(rawMax)
      : NaN;
  const filterPaymentMethod = String(payload?.filterPaymentMethod || 'all').trim().toLowerCase();

  const today = toIsoDateOnly(new Date());
  const like = `%${qLower}%`;
  const likeDigits = qDigits ? `%${qDigits}%` : '';

  try {
    // Prefer JSON snapshot (i.data) over indexed columns — same as debt/due expressions below.
    const instTypeSql = `trim(COALESCE(NULLIF(json_extract(i.data, '$.نوع_الكمبيالة'), ''), NULLIF(i.type, ''), ''))`;
    const instStatusSql = `trim(COALESCE(NULLIF(json_extract(i.data, '$.حالة_الكمبيالة'), ''), NULLIF(i.status, ''), ''))`;
    const instDueYmdSql = `substr(trim(COALESCE(NULLIF(json_extract(i.data, '$.تاريخ_استحقاق'), ''), NULLIF(i.dueDate, ''))), 1, 10)`;
    const instRemainingSql = `CASE WHEN ${instStatusSql} = 'مدفوع' THEN 0 ELSE COALESCE(CAST(json_extract(i.data, '$.القيمة_المتبقية') AS REAL), i.remaining, 0) END`;

    const whereParts: string[] = [];
    const args: unknown[] = [];

    // In Desktop mode, datasets may have inconsistent contract statuses or non-ISO date strings.
    // For installments view, the most reliable signal is: the contract has any relevant installment rows.
    whereParts.push(
      `(
        (c.isArchived IS NULL OR c.isArchived = 0)
        AND EXISTS (
          SELECT 1 FROM installments i
          WHERE i.contractId = c.id
            AND (i.isArchived IS NULL OR i.isArchived = 0)
            AND ${instTypeSql} <> 'تأمين'
            AND ${instStatusSql} <> 'ملغي'
        )
      )`
    );

    if (q) {
      const orParts: string[] = [];
      orParts.push(`lower(COALESCE(t.name,'')) LIKE ?`);
      orParts.push(`lower(COALESCE(p.internalCode,'')) LIKE ?`);
      orParts.push(`COALESCE(c.id,'') LIKE ?`);
      // Also match common identifiers users search by
      orParts.push(`COALESCE(t.nationalId,'') LIKE ?`);
      orParts.push(`COALESCE(t.phone,'') LIKE ?`);
      // Extra phone isn't extracted as a column in the domain table; read from JSON snapshot.
      orParts.push(`COALESCE(JSON_EXTRACT(t.data, '$.رقم_هاتف_اضافي'), '') LIKE ?`);
      args.push(like, like, like, like, like, like);

      if (qDigits) {
        orParts.push(`${sqlNormalizeDigits("COALESCE(p.internalCode,'')")} LIKE ?`);
        orParts.push(`${sqlNormalizeDigits("COALESCE(t.nationalId,'')")} LIKE ?`);
        orParts.push(`${sqlNormalizeDigits("COALESCE(t.phone,'')")} LIKE ?`);
        orParts.push(
          `${sqlNormalizeDigits("COALESCE(JSON_EXTRACT(t.data, '$.رقم_هاتف_اضافي'), '')")} LIKE ?`
        );
        args.push(likeDigits, likeDigits, likeDigits, likeDigits);
      }

      whereParts.push(`(${orParts.join(' OR ')})`);
    }

    const baseWhereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const debtExpr = `EXISTS (
      SELECT 1 FROM installments i
      WHERE i.contractId = c.id
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND ${instTypeSql} <> 'تأمين'
        AND ${instStatusSql} <> 'ملغي'
        AND (${instRemainingSql}) > 0
        AND ${instDueYmdSql} IS NOT NULL AND ${instDueYmdSql} != ''
        AND date(${instDueYmdSql}) IS NOT NULL
        AND date(${instDueYmdSql}) <= date(?)
    )`;

    const postponedExpr = `EXISTS (
      SELECT 1 FROM installments i
      WHERE i.contractId = c.id
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND ${instTypeSql} <> 'تأمين'
        AND ${instStatusSql} <> 'ملغي'
        AND TRIM(COALESCE(JSON_EXTRACT(i.data, '$.تاريخ_التأجيل'), '')) <> ''
    )`;

    const dueSoonExpr = `EXISTS (
      SELECT 1 FROM installments i
      WHERE i.contractId = c.id
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND ${instTypeSql} <> 'تأمين'
        AND ${instStatusSql} <> 'ملغي'
        AND (${instRemainingSql}) > 0
        AND ${instDueYmdSql} IS NOT NULL AND ${instDueYmdSql} != ''
        AND date(${instDueYmdSql}) IS NOT NULL
        AND date(${instDueYmdSql}) > date(?)
        AND date(${instDueYmdSql}) <= date(?, '+7 day')
    )`;

    const anyRelevantExpr = `EXISTS (
      SELECT 1 FROM installments i
      WHERE i.contractId = c.id
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND ${instTypeSql} <> 'تأمين'
        AND ${instStatusSql} <> 'ملغي'
    )`;

    const fullyPaidExpr = `(
      ${anyRelevantExpr}
      AND NOT EXISTS (
        SELECT 1 FROM installments i
        WHERE i.contractId = c.id
          AND (i.isArchived IS NULL OR i.isArchived = 0)
          AND ${instTypeSql} <> 'تأمين'
          AND ${instStatusSql} <> 'ملغي'
          AND (${instRemainingSql}) > 0
      )
    )`;

    const nextDueDateExpr = `(
      SELECT MIN(date(${instDueYmdSql}))
      FROM installments i
      WHERE i.contractId = c.id
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND ${instTypeSql} <> 'تأمين'
        AND ${instStatusSql} <> 'ملغي'
        AND (${instRemainingSql}) > 0
        AND ${instDueYmdSql} IS NOT NULL AND ${instDueYmdSql} != ''
        AND date(${instDueYmdSql}) IS NOT NULL
    )`;

    const lastPostponeDateExpr = `(
      SELECT MAX(JSON_EXTRACT(i.data, '$.تاريخ_التأجيل'))
      FROM installments i
      WHERE i.contractId = c.id
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND COALESCE(i.type,'') <> 'تأمين'
        AND COALESCE(i.status,'') <> 'ملغي'
        AND TRIM(COALESCE(JSON_EXTRACT(i.data, '$.تاريخ_التأجيل'), '')) <> ''
    )`;

    const filterWhereParts: string[] = [];
    const filterArgs: unknown[] = [];
    if (filter === 'debt') {
      filterWhereParts.push('hasDebt = 1');
    } else if (filter === 'due') {
      filterWhereParts.push('hasDueSoon = 1');
    } else if (filter === 'paid') {
      filterWhereParts.push('isFullyPaid = 1');
    } else     if (filter === 'postponed') {
      filterWhereParts.push('hasPostponed = 1');
    }

    const instScope = `
      SELECT 1 FROM installments i
      WHERE i.contractId = base.contractId
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND ${instTypeSql} <> 'تأمين'
        AND ${instStatusSql} <> 'ملغي'
    `;

    if (filterStartDate) {
      filterWhereParts.push(`EXISTS (
      ${instScope}
        AND ${instDueYmdSql} IS NOT NULL AND ${instDueYmdSql} != ''
        AND date(${instDueYmdSql}) IS NOT NULL
        AND date(${instDueYmdSql}) >= date(?)
    )`);
      filterArgs.push(filterStartDate);
    }
    if (filterEndDate) {
      filterWhereParts.push(`EXISTS (
      ${instScope}
        AND ${instDueYmdSql} IS NOT NULL AND ${instDueYmdSql} != ''
        AND date(${instDueYmdSql}) IS NOT NULL
        AND date(${instDueYmdSql}) <= date(?)
    )`);
      filterArgs.push(filterEndDate);
    }
    if (Number.isFinite(filterMinNum)) {
      filterWhereParts.push(`EXISTS (
      ${instScope}
        AND COALESCE(i.amount, 0) >= ?
    )`);
      filterArgs.push(filterMinNum);
    }
    if (Number.isFinite(filterMaxNum)) {
      filterWhereParts.push(`EXISTS (
      ${instScope}
        AND COALESCE(i.amount, 0) <= ?
    )`);
      filterArgs.push(filterMaxNum);
    }
    if (filterPaymentMethod && filterPaymentMethod !== 'all') {
      filterWhereParts.push(`(
        lower(trim(COALESCE(
          NULLIF(trim(COALESCE(base.contractPaymentMethod, '')), ''),
          JSON_EXTRACT(base.contractData, '$.طريقة_الدفع'),
          ''
        ))) = ?
      )`);
      filterArgs.push(filterPaymentMethod);
    }

    const filterWhereSql = filterWhereParts.length ? `WHERE ${filterWhereParts.join(' AND ')}` : '';

    const cteSql = `
      WITH base AS (
        SELECT
          c.id AS contractId,
          TRIM(COALESCE(c.paymentMethod, '')) AS contractPaymentMethod,
          c.data AS contractData,
          t.data AS tenantData,
          p.data AS propertyData,
          ${debtExpr} AS hasDebt,
          ${dueSoonExpr} AS hasDueSoon,
          ${postponedExpr} AS hasPostponed,
          ${fullyPaidExpr} AS isFullyPaid,
          ${nextDueDateExpr} AS nextDueDate,
          ${lastPostponeDateExpr} AS lastPostponeDate
        FROM contracts c
        LEFT JOIN people t ON t.id = c.tenantId
        LEFT JOIN properties p ON p.id = c.propertyId
        ${baseWhereSql}
      )
    `;

    const countSql = `${cteSql} SELECT COUNT(1) AS cnt FROM base ${filterWhereSql};`;
    const listSql = `${cteSql}
      SELECT *
      FROM base
      ${filterWhereSql}
      ORDER BY ${(() => {
        // NOTE: Keep SQL injection-safe by mapping to fixed ORDER BY clauses.
        const tenantNameExpr = "lower(COALESCE(JSON_EXTRACT(tenantData, '$.الاسم'), ''))";
        const nullsLast =
          "CASE WHEN nextDueDate IS NULL OR TRIM(COALESCE(nextDueDate,'')) = '' THEN 1 ELSE 0 END";
        const overdueFirst =
          'CASE WHEN hasDebt = 1 THEN 0 ELSE 1 END';
        const postponeNullsLast =
          "CASE WHEN lastPostponeDate IS NULL OR TRIM(COALESCE(lastPostponeDate,'')) = '' THEN 1 ELSE 0 END";
        switch (sort) {
          case 'postpone-asc':
            return `${postponeNullsLast} ASC, COALESCE(lastPostponeDate,'') ASC, contractId ASC`;
          case 'postpone-desc':
            return `${postponeNullsLast} ASC, COALESCE(lastPostponeDate,'') DESC, contractId DESC`;
          case 'due-asc':
            return `${overdueFirst} ASC, ${nullsLast} ASC, COALESCE(nextDueDate,'') ASC, contractId ASC`;
          case 'due-desc':
            return `${overdueFirst} ASC, ${nullsLast} ASC, COALESCE(nextDueDate,'') DESC, contractId DESC`;
          case 'tenant-desc':
            return `${tenantNameExpr} DESC, contractId DESC`;
          case 'tenant-asc':
          default:
            return `${tenantNameExpr} ASC, contractId ASC`;
        }
      })()}
      LIMIT ? OFFSET ?;
    `;

    // Order of args:
    // baseWhere: [today] + optional search like params
    // then expressions: debt(today), dueSoon(today,today)
    const total = toNumber(
      toRecord(dbh.prepare(countSql).get(...args, today, today, today, ...filterArgs)).cnt
    );

    const rows = dbh
      .prepare(listSql)
      .all(...args, today, today, today, ...filterArgs, cap, offset) as unknown[];
    if (!rows.length) return { ok: true, items: [], total };

    const contractIds = rows.map((row) => String(toRecord(row).contractId ?? '')).filter(Boolean);
    const placeholders = contractIds.map(() => '?').join(',');
    const instRows = dbh
      .prepare(
        `
        SELECT contractId, data
        FROM installments
        WHERE contractId IN (${placeholders})
          AND (isArchived IS NULL OR isArchived = 0)
        ORDER BY COALESCE(dueDate, '') ASC, id ASC
      `
      )
      .all(...contractIds) as Array<{ contractId: string; data: string }>;

    const instByContract = new Map<string, unknown[]>();
    for (const r of instRows) {
      let inst: unknown = null;
      try {
        inst = JSON.parse(String(r?.data || 'null'));
      } catch {
        inst = null;
      }
      if (!inst) continue;
      const cid = String(r.contractId || '').trim();
      if (!cid) continue;
      const arr = instByContract.get(cid);
      if (arr) arr.push(inst);
      else instByContract.set(cid, [inst]);
    }

    const items = rows
      .map((row) => {
        const r = toRecord(row);

        let contract: unknown = null;
        let tenant: unknown = null;
        let property: unknown = null;
        try {
          contract = JSON.parse(String(r.contractData ?? 'null'));
        } catch {
          contract = null;
        }
        try {
          tenant = JSON.parse(String(r.tenantData ?? 'null'));
        } catch {
          tenant = null;
        }
        try {
          property = JSON.parse(String(r.propertyData ?? 'null'));
        } catch {
          property = null;
        }
        if (!contract) return null;

        const cid = String(r.contractId ?? '').trim();
        const installments = cid ? instByContract.get(cid) || [] : [];
        return {
          contract,
          tenant,
          property,
          installments,
          hasDebt: !!r.hasDebt,
          hasDueSoon: !!r.hasDueSoon,
          isFullyPaid: !!r.isFullyPaid,
        };
      })
      .filter(isNonNull);

    return { ok: true, items, total };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل تحميل بيانات الأقساط';
    return { ok: false, message };
  }
}

export function domainDashboardSummary(payload: { todayYMD: string; weekYMD: string }): {
  ok: boolean;
  message?: string;
  data?: {
    totalPeople: number;
    totalProperties: number;
    occupiedProperties: number;
    totalContracts: number;
    activeContracts: number;
    dueNext7Payments: number;
    paymentsToday: number;
    revenueToday: number;
    contractsExpiring30: number;
    maintenanceOpen: number;
    propertyTypeCounts: Array<{ name: string; value: number }>;
    contractStatusCounts: Array<{ name: string; value: number }>;
  };
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const todayYMD = String(payload?.todayYMD || '').slice(0, 10);
  const weekYMD = String(payload?.weekYMD || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayYMD) || !/^\d{4}-\d{2}-\d{2}$/.test(weekYMD)) {
    return errorResult('ERR_INVALID_DATES', 'تواريخ غير صالحة');
  }

  try {
    const totalPeople = toNumber(toRecord(dbh.prepare('SELECT COUNT(*) AS c FROM people').get()).c);
    const totalProperties = toNumber(
      toRecord(dbh.prepare('SELECT COUNT(*) AS c FROM properties').get()).c
    );
    const occupiedProperties = toNumber(
      toRecord(
        dbh.prepare('SELECT COUNT(*) AS c FROM properties WHERE COALESCE(isRented, 0) = 1').get()
      ).c
    );
    const totalContracts = toNumber(
      toRecord(dbh.prepare('SELECT COUNT(*) AS c FROM contracts').get()).c
    );

    const activeContracts = toNumber(
      toRecord(
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM contracts
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND status IN ('نشط', 'قريب الانتهاء', 'مجدد')`
          )
          .get()
      ).c
    );

    const dueNext7Payments = toNumber(
      toRecord(
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM installments
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(status, '') != 'مدفوع'
               AND COALESCE(remaining, amount, 0) > 0
               AND COALESCE(dueDate, '') > ?
               AND COALESCE(dueDate, '') <= ?`
          )
          .get(todayYMD, weekYMD)
      ).c
    );

    const paymentsToday = toNumber(
      toRecord(
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM installments
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(status, '') = 'مدفوع'
               AND COALESCE(dueDate, '') = ?`
          )
          .get(todayYMD)
      ).c
    );

    const revenueToday = toNumber(
      toRecord(
        dbh
          .prepare(
            `SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) AS s
             FROM installments
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(status, '') = 'مدفوع'
               AND COALESCE(dueDate, '') = ?`
          )
          .get(todayYMD)
      ).s
    );

    const contractsExpiring30 = toNumber(
      toRecord(
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM contracts
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(endDate, '') > ?
               AND COALESCE(endDate, '') <= date(?, '+30 day')`
          )
          .get(todayYMD, todayYMD)
      ).c
    );

    const maintenanceOpen = toNumber(
      toRecord(
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM maintenance_tickets
             WHERE COALESCE(status, '') IN ('مفتوح', 'قيد التنفيذ')`
          )
          .get()
      ).c
    );

    const propertyTypeCounts = dbh
      .prepare(
        `SELECT COALESCE(type, 'غير محدد') AS name, COUNT(*) AS value
         FROM properties
         GROUP BY COALESCE(type, 'غير محدد')
         ORDER BY value DESC, name ASC`
      )
      .all() as Array<{ name: string; value: number }>;

    const contractStatusCounts = dbh
      .prepare(
        `SELECT COALESCE(status, 'غير محدد') AS name, COUNT(*) AS value
         FROM contracts
         GROUP BY COALESCE(status, 'غير محدد')
         ORDER BY value DESC, name ASC`
      )
      .all() as Array<{ name: string; value: number }>;

    return {
      ok: true,
      data: {
        totalPeople,
        totalProperties,
        occupiedProperties,
        totalContracts,
        activeContracts,
        dueNext7Payments,
        paymentsToday,
        revenueToday,
        contractsExpiring30,
        maintenanceOpen,
        propertyTypeCounts,
        contractStatusCounts,
      },
    };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل إنشاء ملخص لوحة التحكم';
    return { ok: false, message };
  }
}

export function domainDashboardPerformance(payload: { monthKey: string; prevMonthKey: string }): {
  ok: boolean;
  message?: string;
  data?: {
    currentMonthCollections: number;
    previousMonthCollections: number;
    paidCountThisMonth: number;
    dueUnpaidThisMonth: number;
  };
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const monthKey = String(payload?.monthKey || '').slice(0, 7);
  const prevMonthKey = String(payload?.prevMonthKey || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthKey) || !/^\d{4}-\d{2}$/.test(prevMonthKey)) {
    return errorResult('ERR_INVALID_MONTH', 'شهر غير صالح');
  }

  try {
    const sumPaidForMonth = (m: string) =>
      toNumber(
        toRecord(
          dbh
            .prepare(
              `SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) AS s
               FROM installments
               WHERE (isArchived IS NULL OR isArchived = 0)
                 AND COALESCE(status, '') = 'مدفوع'
                 AND SUBSTR(COALESCE(paidAt, dueDate, ''), 1, 7) = ?`
            )
            .get(m)
        ).s
      );

    const currentMonthCollections = sumPaidForMonth(monthKey);
    const previousMonthCollections = sumPaidForMonth(prevMonthKey);

    const paidCountThisMonth = toNumber(
      toRecord(
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM installments
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(status, '') = 'مدفوع'
               AND SUBSTR(COALESCE(paidAt, dueDate, ''), 1, 7) = ?`
          )
          .get(monthKey)
      ).c
    );

    const dueUnpaidThisMonth = toNumber(
      toRecord(
        dbh
          .prepare(
            `SELECT COALESCE(SUM(COALESCE(remaining, amount, 0)), 0) AS s
             FROM installments
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(status, '') != 'مدفوع'
               AND SUBSTR(COALESCE(dueDate, ''), 1, 7) = ?`
          )
          .get(monthKey)
      ).s
    );

    return {
      ok: true,
      data: {
        currentMonthCollections,
        previousMonthCollections,
        paidCountThisMonth,
        dueUnpaidThisMonth,
      },
    };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل حساب الأداء المالي';
    return { ok: false, message };
  }
}

export function domainDashboardHighlights(payload: { todayYMD: string }): {
  ok: boolean;
  message?: string;
  data?: {
    dueInstallmentsToday: Array<{
      contractId: string;
      tenantName: string;
      dueDate: string;
      remaining: number;
    }>;
    expiringContracts: Array<{
      contractId: string;
      propertyId: string;
      propertyCode: string;
      tenantId: string;
      tenantName: string;
      endDate: string;
    }>;
    incompleteProperties: Array<{
      propertyId: string;
      propertyCode: string;
      missingWater: boolean;
      missingElectric: boolean;
      missingArea: boolean;
    }>;
  };
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const todayYMD = String(payload?.todayYMD || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayYMD)) {
    return errorResult('ERR_INVALID_DATE', 'تاريخ غير صالح');
  }

  try {
    const dueInstallmentsToday = dbh
      .prepare(
        `
        SELECT
          i.contractId AS contractId,
          COALESCE(t.name, '') AS tenantName,
          COALESCE(i.dueDate, '') AS dueDate,
          COALESCE(i.remaining, i.amount, 0) AS remaining
        FROM installments i
        LEFT JOIN contracts c ON c.id = i.contractId
        LEFT JOIN people t ON t.id = c.tenantId
        WHERE (i.isArchived IS NULL OR i.isArchived = 0)
          AND COALESCE(i.status, '') != 'مدفوع'
          AND COALESCE(i.remaining, i.amount, 0) > 0
          AND COALESCE(i.dueDate, '') = ?
        ORDER BY COALESCE(t.name, '') ASC, COALESCE(i.id, '') ASC
        LIMIT 30
      `
      )
      .all(todayYMD) as Array<{
      contractId: string;
      tenantName: string;
      dueDate: string;
      remaining: number;
    }>;

    // Tenancy-relevant: status or endDate in future and not ended/canceled.
    const expiringContracts = dbh
      .prepare(
        `
        SELECT
          c.id AS contractId,
          COALESCE(c.propertyId, '') AS propertyId,
          COALESCE(p.internalCode, '') AS propertyCode,
          COALESCE(c.tenantId, '') AS tenantId,
          COALESCE(t.name, '') AS tenantName,
          COALESCE(c.endDate, '') AS endDate
        FROM contracts c
        LEFT JOIN properties p ON p.id = c.propertyId
        LEFT JOIN people t ON t.id = c.tenantId
        WHERE (c.isArchived IS NULL OR c.isArchived = 0)
          AND (
            c.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
            OR (
              c.endDate IS NOT NULL
              AND c.endDate >= ?
              AND COALESCE(c.status, '') NOT IN ('منتهي', 'مفسوخ', 'ملغي')
            )
          )
          AND COALESCE(c.endDate, '') > ?
          AND COALESCE(c.endDate, '') <= date(?, '+30 day')
        ORDER BY COALESCE(c.endDate, '') ASC, COALESCE(p.internalCode, '') ASC
        LIMIT 30
      `
      )
      .all(todayYMD, todayYMD, todayYMD) as Array<{
      contractId: string;
      propertyId: string;
      propertyCode: string;
      tenantId: string;
      tenantName: string;
      endDate: string;
    }>;

    // Incomplete property fields - read from JSON snapshot for compatibility.
    const incompleteProperties = dbh
      .prepare(
        `
        SELECT
          p.id AS propertyId,
          COALESCE(p.internalCode, '') AS propertyCode,
          CASE WHEN TRIM(COALESCE(JSON_EXTRACT(p.data, '$.رقم_اشتراك_المياه'), '')) = '' THEN 1 ELSE 0 END AS missingWater,
          CASE WHEN TRIM(COALESCE(JSON_EXTRACT(p.data, '$.رقم_اشتراك_الكهرباء'), '')) = '' THEN 1 ELSE 0 END AS missingElectric,
          CASE WHEN COALESCE(JSON_EXTRACT(p.data, '$.المساحة'), NULL) IS NULL OR COALESCE(JSON_EXTRACT(p.data, '$.المساحة'), 0) = 0 THEN 1 ELSE 0 END AS missingArea
        FROM properties p
        WHERE (
          TRIM(COALESCE(JSON_EXTRACT(p.data, '$.رقم_اشتراك_المياه'), '')) = ''
          OR TRIM(COALESCE(JSON_EXTRACT(p.data, '$.رقم_اشتراك_الكهرباء'), '')) = ''
          OR COALESCE(JSON_EXTRACT(p.data, '$.المساحة'), NULL) IS NULL
          OR COALESCE(JSON_EXTRACT(p.data, '$.المساحة'), 0) = 0
        )
        ORDER BY COALESCE(p.internalCode, '') ASC
        LIMIT 30
      `
      )
      .all() as Array<{
      propertyId: string;
      propertyCode: string;
      missingWater: number;
      missingElectric: number;
      missingArea: number;
    }>;

    return {
      ok: true,
      data: {
        dueInstallmentsToday: dueInstallmentsToday.map((r) => ({
          contractId: String(r.contractId || '').trim(),
          tenantName: String(r.tenantName || '').trim(),
          dueDate: String(r.dueDate || '').trim(),
          remaining: Number(r.remaining || 0) || 0,
        })),
        expiringContracts: expiringContracts.map((r) => ({
          contractId: String(r.contractId || '').trim(),
          propertyId: String(r.propertyId || '').trim(),
          propertyCode: String(r.propertyCode || '').trim(),
          tenantId: String(r.tenantId || '').trim(),
          tenantName: String(r.tenantName || '').trim(),
          endDate: String(r.endDate || '').trim(),
        })),
        incompleteProperties: incompleteProperties.map((r) => ({
          propertyId: String(r.propertyId || '').trim(),
          propertyCode: String(r.propertyCode || '').trim(),
          missingWater: !!r.missingWater,
          missingElectric: !!r.missingElectric,
          missingArea: !!r.missingArea,
        })),
      },
    };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل تحميل مؤشرات لوحة التحكم';
    return { ok: false, message };
  }
}

export function domainPaymentNotificationTargets(payload: {
  daysAhead: number;
  todayYMD?: string;
}): {
  ok: boolean;
  message?: string;
  items?: Array<{
    key: string;
    tenantId?: string;
    tenantName: string;
    phone?: string;
    extraPhone?: string;
    contractId: string;
    propertyId?: string;
    propertyCode?: string;
    paymentPlanRaw?: string;
    paymentFrequency?: number;
    items: Array<{
      installmentId: string;
      contractId: string;
      dueDate: string;
      amountRemaining: number;
      daysUntilDue: number;
      bucket: 'overdue' | 'today' | 'upcoming';
    }>;
  }>;
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const daysAhead = Math.max(1, Math.min(60, Math.trunc(Number(payload?.daysAhead) || 7)));
  const todayYMD = String(payload?.todayYMD || toIsoDateOnly(new Date())).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayYMD)) {
    return errorResult('ERR_INVALID_DATE', 'تاريخ غير صالح');
  }

  try {
    // Tenancy-relevant contracts (mirror isTenancyRelevant-ish behavior)
    const contractWhere = `(
      (c.isArchived IS NULL OR c.isArchived = 0)
      AND (
        c.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
        OR (
          c.endDate IS NOT NULL
          AND c.endDate >= ?
          AND COALESCE(c.status, '') NOT IN ('منتهي', 'مفسوخ', 'ملغي')
        )
      )
    )`;

    type PaymentNotificationRow = {
      contractId: string;
      tenantId: string;
      propertyId: string;
      paymentPlanRaw: string;
      paymentFrequency: number;
      tenantName: string;
      phone: string;
      extraPhone: string;
      propertyCode: string;
      installmentId: string;
      dueDate: string;
      amountRemaining: number;
      daysUntilDue: number;
    };

    type PaymentNotificationInstallment = {
      installmentId: string;
      contractId: string;
      dueDate: string;
      amountRemaining: number;
      daysUntilDue: number;
      bucket: 'overdue' | 'today' | 'upcoming';
    };

    type PaymentNotificationTarget = {
      key: string;
      tenantId?: string;
      tenantName: string;
      phone?: string;
      extraPhone?: string;
      contractId: string;
      propertyId?: string;
      propertyCode?: string;
      paymentPlanRaw?: string;
      paymentFrequency?: number;
      items: PaymentNotificationInstallment[];
    };

    const rows = dbh
      .prepare(
        `
        SELECT
          c.id AS contractId,
          COALESCE(c.tenantId, '') AS tenantId,
          COALESCE(c.propertyId, '') AS propertyId,
          COALESCE(JSON_EXTRACT(c.data, '$.طريقة_الدفع'), '') AS paymentPlanRaw,
          COALESCE(CAST(JSON_EXTRACT(c.data, '$.تكرار_الدفع') AS INTEGER), 1) AS paymentFrequency,
          COALESCE(t.name, '') AS tenantName,
          COALESCE(JSON_EXTRACT(t.data, '$.رقم_الهاتف'), '') AS phone,
          COALESCE(JSON_EXTRACT(t.data, '$.رقم_هاتف_اضافي'), '') AS extraPhone,
          COALESCE(p.internalCode, '') AS propertyCode,
          i.id AS installmentId,
          COALESCE(i.dueDate, '') AS dueDate,
          COALESCE(i.remaining, i.amount, 0) AS amountRemaining,
          CAST((julianday(COALESCE(i.dueDate, '')) - julianday(?)) AS INTEGER) AS daysUntilDue
        FROM contracts c
        JOIN installments i ON i.contractId = c.id
        LEFT JOIN people t ON t.id = c.tenantId
        LEFT JOIN properties p ON p.id = c.propertyId
        WHERE ${contractWhere}
          AND (i.isArchived IS NULL OR i.isArchived = 0)
          AND COALESCE(i.type,'') <> 'تأمين'
          AND COALESCE(i.status,'') NOT IN ('ملغي', 'مدفوع')
          AND COALESCE(i.remaining, i.amount, 0) > 0
          AND COALESCE(i.dueDate, '') <> ''
          AND COALESCE(i.dueDate, '') <= date(?, '+' || ? || ' day')
        ORDER BY lower(COALESCE(t.name,'')) ASC, COALESCE(p.internalCode,'') ASC, COALESCE(i.dueDate,'') ASC, i.id ASC
        LIMIT 2000
        `
      )
      .all(todayYMD, todayYMD, todayYMD, daysAhead) as PaymentNotificationRow[];

    const byContract = new Map<string, PaymentNotificationTarget>();
    for (const r of rows) {
      const contractId = String(r.contractId || '').trim();
      if (!contractId) continue;
      const key = contractId;
      let target = byContract.get(contractId);
      if (!target) {
        target = {
          key,
          tenantId: String(r.tenantId || '').trim() || undefined,
          tenantName: String(r.tenantName || '').trim() || 'مستأجر',
          phone: String(r.phone || '').trim() || undefined,
          extraPhone: String(r.extraPhone || '').trim() || undefined,
          contractId,
          propertyId: String(r.propertyId || '').trim() || undefined,
          propertyCode: String(r.propertyCode || '').trim() || undefined,
          paymentPlanRaw: String(r.paymentPlanRaw || '').trim() || undefined,
          paymentFrequency: Number(r.paymentFrequency || 0) || 0,
          items: [],
        };
        byContract.set(contractId, target);
      }

      const dueDate = String(r.dueDate || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) continue;
      const daysUntilDue = Number(r.daysUntilDue ?? 0) || 0;

      const bucket: 'overdue' | 'today' | 'upcoming' =
        daysUntilDue < 0 ? 'overdue' : daysUntilDue === 0 ? 'today' : 'upcoming';
      if (bucket === 'upcoming' && daysUntilDue > daysAhead) continue;

      target.items.push({
        installmentId: String(r.installmentId || '').trim(),
        contractId,
        dueDate,
        amountRemaining: Number(r.amountRemaining || 0) || 0,
        daysUntilDue,
        bucket,
      });
    }

    const items = Array.from(byContract.values()).map((t) => ({
      ...t,
      items: t.items.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))),
    }));

    return { ok: true, items };
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === 'string'
          ? e
          : 'فشل تحميل أهداف إشعارات الدفعات';
    return { ok: false, message };
  }
}

export function domainCounts(): {
  ok: boolean;
  counts?: { people: number; properties: number; contracts: number };
  message?: string;
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  try {
    const people = toNumber(toRecord(dbh.prepare('SELECT COUNT(1) AS cnt FROM people').get()).cnt);
    const properties = toNumber(
      toRecord(dbh.prepare('SELECT COUNT(1) AS cnt FROM properties').get()).cnt
    );
    const contracts = toNumber(
      toRecord(dbh.prepare('SELECT COUNT(1) AS cnt FROM contracts').get()).cnt
    );
    return { ok: true, counts: { people, properties, contracts } };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل قراءة الأعداد';
    return { ok: false, message };
  }
}

function safeJsonParseArray(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function kvUpdatedAtIso(key: string): string {
  const meta = kvGetMeta(key);
  const ts = meta?.updatedAt ? String(meta.updatedAt) : '';
  return ts && ts.trim() ? ts.trim() : '';
}

function isKvNewerThanDomain(dbh: SqliteDb, key: string): boolean {
  const kvTs = kvUpdatedAtIso(key);
  const storedRaw = metaGet(dbh, `domain_src_updatedAt:${key}`);
  const stored = typeof storedRaw === 'string' ? storedRaw.trim() : String(storedRaw ?? '').trim();

  if (!stored) return true;

  // When KV has no updatedAt metadata, comparing timestamps is meaningless. Treating KV as
  // "always newer" (old behavior used Date.now() as a fake kvTs) forced a full domain rebuild
  // on almost every query and could leave lists empty or starve the DB. Assume not stale here;
  // domainEnsureReady() still repairs empty domain tables when KV JSON is non-empty.
  if (!kvTs) return false;

  const tKv = new Date(kvTs).getTime();
  const tSt = new Date(stored).getTime();
  if (!Number.isFinite(tKv) || !Number.isFinite(tSt)) return false;
  return tKv > tSt;
}

function toIsoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDigitsToLatin(input: string): string {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
    '۰': '0',
    '۱': '1',
    '۲': '2',
    '۳': '3',
    '۴': '4',
    '۵': '5',
    '۶': '6',
    '۷': '7',
    '۸': '8',
    '۹': '9',
    '٫': '.',
    '٬': ',',
  };

  return String(input || '').replace(/[٠-٩۰-۹٫٬]/g, (ch) => map[ch] ?? ch);
}

type SearchNormalizeMode = 'strict' | 'lenient';

function normalizeArabicLetters(input: string, mode: SearchNormalizeMode = 'strict'): string {
  const base = String(input || '')
    .replace(/[آأإ]/g, 'ا')
    .replace(/ٱ/g, 'ا')
    .replace(/ى/g, 'ي');

  if (mode === 'strict') return base;
  return base.replace(/ئ/g, 'ي').replace(/ؤ/g, 'و').replace(/ة/g, 'ه').replace(/ء/g, '');
}

function normalizeSearchText(input: unknown, mode: SearchNormalizeMode = 'strict'): string {
  const s = normalizeDigitsToLatin(String(input ?? ''));
  return normalizeArabicLetters(s, mode)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDigitsLoose(input: unknown): string {
  const s = normalizeDigitsToLatin(String(input ?? ''));
  return s.replace(/\D+/g, '').trim();
}

function sqlNormalizeDigits(expr: string): string {
  // Best-effort digit matching: normalize Arabic/Persian digits + remove common separators.
  // IMPORTANT: expr must be a trusted SQL expression (not user input).
  let e = expr;
  const rep = (from: string, to: string) => {
    e = `REPLACE(${e}, '${from}', '${to}')`;
  };

  // Remove separators
  rep(' ', '');
  rep('-', '');
  rep('+', '');
  rep('(', '');
  rep(')', '');

  // Arabic-Indic digits
  rep('٠', '0');
  rep('١', '1');
  rep('٢', '2');
  rep('٣', '3');
  rep('٤', '4');
  rep('٥', '5');
  rep('٦', '6');
  rep('٧', '7');
  rep('٨', '8');
  rep('٩', '9');

  // Persian digits
  rep('۰', '0');
  rep('۱', '1');
  rep('۲', '2');
  rep('۳', '3');
  rep('۴', '4');
  rep('۵', '5');
  rep('۶', '6');
  rep('۷', '7');
  rep('۸', '8');
  rep('۹', '9');

  return e;
}

function sqlNormalizeArabicTextLower(expr: string, mode: SearchNormalizeMode = 'strict'): string {
  // Best-effort Arabic search normalization (no custom extensions): unify common letter variants.
  // IMPORTANT: expr must be a trusted SQL expression (not user input).
  let e = expr;
  const rep = (from: string, to: string) => {
    e = `REPLACE(${e}, '${from}', '${to}')`;
  };

  // Tatweel
  rep('ـ', '');

  // Alef variants
  rep('أ', 'ا');
  rep('إ', 'ا');
  rep('آ', 'ا');
  rep('ٱ', 'ا');

  // Yeh variants
  rep('ى', 'ي');

  if (mode === 'lenient') {
    // Lenient-only variants
    rep('ئ', 'ي');
    rep('ؤ', 'و');
    rep('ة', 'ه');
    rep('ء', '');
  }

  // Strip common tashkeel (best-effort)
  for (const ch of ['ً', 'ٌ', 'ٍ', 'َ', 'ُ', 'ِ', 'ّ', 'ْ', 'ٰ']) rep(ch, '');

  return `lower(${e})`;
}

function computeInstallmentAmounts(inst: unknown): {
  amount: number;
  paid: number;
  remaining: number;
} {
  const instRec = toRecord(inst);

  const amount = toNumber(instRec['القيمة']);

  const remainingRaw = instRec['القيمة_المتبقية'];
  const remainingFromField = Number.isFinite(Number(remainingRaw)) ? Number(remainingRaw) : NaN;

  let paid = 0;
  const payments = instRec['سجل_الدفعات'];
  if (Array.isArray(payments)) {
    for (const p of payments) {
      paid += toNumber(toRecord(p)['المبلغ']);
    }
  }

  let remaining = Number.isFinite(remainingFromField) ? remainingFromField : amount - paid;
  if (!Number.isFinite(remaining)) remaining = amount;

  // Clamp
  remaining = Math.max(0, Math.min(amount, remaining));
  paid = Math.max(0, Math.min(amount, paid));

  // If remaining was authoritative and paid is missing, derive paid.
  if (paid === 0 && Number.isFinite(remainingFromField)) {
    paid = Math.max(0, Math.min(amount, amount - remaining));
  }

  return { amount, paid, remaining };
}

export function domainStatus(): { schemaVersion: number; migrated: boolean; migratedAt?: string } {
  const dbh = getDb();
  const schemaVersion = Number(metaGet(dbh, 'domain_schema_version') || '0') || 0;
  const migratedAt = metaGet(dbh, 'domain_migrated_at') || undefined;
  return { schemaVersion, migrated: !!migratedAt, migratedAt };
}

export function domainMigrateFromKvIfNeeded(): DomainMigrationResult {
  const dbh = getDb();
  ensureDomainSchema(dbh);

  const already = metaGet(dbh, 'domain_migrated_at');
  if (already) {
    return { ok: true, message: 'تمت التهيئة مسبقاً', migrated: false };
  }

  const keys = {
    people: 'db_people',
    properties: 'db_properties',
    contracts: 'db_contracts',
    installments: 'db_installments',
    maintenance: 'db_maintenance_tickets',
    roles: 'db_roles',
    blacklist: 'db_blacklist',
  };

  const people = safeJsonParseArray(kvGet(keys.people));
  const properties = safeJsonParseArray(kvGet(keys.properties));
  const contracts = safeJsonParseArray(kvGet(keys.contracts));
  const installments = safeJsonParseArray(kvGet(keys.installments));
  const maintenance = safeJsonParseArray(kvGet(keys.maintenance));
  const roles = safeJsonParseArray(kvGet(keys.roles));
  const blacklist = safeJsonParseArray(kvGet(keys.blacklist));

  const nowIso = new Date().toISOString();
  const counts: Record<string, number> = {};

  const upsertPeople = dbh.prepare(
    'INSERT INTO people (id, name, nationalId, phone, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, nationalId=excluded.nationalId, phone=excluded.phone, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const insertRole = dbh.prepare(
    'INSERT OR IGNORE INTO person_roles (personId, role) VALUES (?, ?)'
  );
  const upsertBlacklist = dbh.prepare(
    'INSERT INTO blacklist (personId, isActive, data, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(personId) DO UPDATE SET isActive=excluded.isActive, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const upsertProperty = dbh.prepare(
    'INSERT INTO properties (id, internalCode, ownerId, type, status, address, city, area, isRented, isForSale, isForRent, salePrice, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET internalCode=excluded.internalCode, ownerId=excluded.ownerId, type=excluded.type, status=excluded.status, address=excluded.address, city=excluded.city, area=excluded.area, isRented=excluded.isRented, isForSale=excluded.isForSale, isForRent=excluded.isForRent, salePrice=excluded.salePrice, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const upsertContract = dbh.prepare(
    'INSERT INTO contracts (id, propertyId, tenantId, guarantorId, status, startDate, endDate, annualValue, paymentFrequency, paymentMethod, isArchived, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET propertyId=excluded.propertyId, tenantId=excluded.tenantId, guarantorId=excluded.guarantorId, status=excluded.status, startDate=excluded.startDate, endDate=excluded.endDate, annualValue=excluded.annualValue, paymentFrequency=excluded.paymentFrequency, paymentMethod=excluded.paymentMethod, isArchived=excluded.isArchived, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const upsertInstallment = dbh.prepare(
    'INSERT INTO installments (id, contractId, dueDate, amount, paid, remaining, status, type, isArchived, paidAt, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET contractId=excluded.contractId, dueDate=excluded.dueDate, amount=excluded.amount, paid=excluded.paid, remaining=excluded.remaining, status=excluded.status, type=excluded.type, isArchived=excluded.isArchived, paidAt=excluded.paidAt, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const upsertTicket = dbh.prepare(
    'INSERT INTO maintenance_tickets (id, propertyId, tenantId, createdDate, status, priority, issue, closedDate, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET propertyId=excluded.propertyId, tenantId=excluded.tenantId, createdDate=excluded.createdDate, status=excluded.status, priority=excluded.priority, issue=excluded.issue, closedDate=excluded.closedDate, data=excluded.data, updatedAt=excluded.updatedAt'
  );

  const tx = dbh.transaction(() => {
    // Replace tables entirely to correctly reflect deletes.
    dbh.exec(
      'DELETE FROM people; DELETE FROM person_roles; DELETE FROM blacklist; DELETE FROM properties; DELETE FROM contracts; DELETE FROM installments; DELETE FROM maintenance_tickets;'
    );

    for (const p of people) {
      const pRec = toRecord(p);
      const id = String(pRec['رقم_الشخص'] ?? '').trim();
      if (!id) continue;

      const nationalId = pRec['الرقم_الوطني'] ? String(pRec['الرقم_الوطني']) : null;
      const phone = pRec['رقم_الهاتف'] ? String(pRec['رقم_الهاتف']) : null;

      upsertPeople.run(
        id,
        String(pRec['الاسم'] ?? ''),
        nationalId,
        phone,
        JSON.stringify(p),
        nowIso
      );
    }
    counts.people = people.length;

    for (const r of roles) {
      const rRec = toRecord(r);
      const personId = String(rRec['رقم_الشخص'] ?? '').trim();
      const role = String(rRec['الدور'] ?? '').trim();
      if (!personId || !role) continue;
      insertRole.run(personId, role);
    }
    counts.roles = roles.length;

    for (const b of blacklist) {
      const bRec = toRecord(b);
      const personId = String(bRec.personId ?? '').trim();
      if (!personId) continue;
      const isActive = bRec.isActive === false ? 0 : 1;
      upsertBlacklist.run(personId, isActive, JSON.stringify(b), nowIso);
    }
    counts.blacklist = blacklist.length;

    for (const pr of properties) {
      const prRec = toRecord(pr);
      const id = String(prRec['رقم_العقار'] ?? '').trim();
      if (!id) continue;

      const salePriceNum = toNumber(prRec.salePrice);
      upsertProperty.run(
        id,
        prRec['الكود_الداخلي'] ? String(prRec['الكود_الداخلي']) : null,
        prRec['رقم_المالك'] ? String(prRec['رقم_المالك']) : null,
        prRec['النوع'] ? String(prRec['النوع']) : null,
        prRec['حالة_العقار'] ? String(prRec['حالة_العقار']) : null,
        prRec['العنوان'] ? String(prRec['العنوان']) : null,
        prRec['المدينة'] ? String(prRec['المدينة']) : null,
        prRec['المنطقة'] ? String(prRec['المنطقة']) : null,
        prRec.IsRented ? 1 : 0,
        prRec.isForSale ? 1 : 0,
        prRec.isForRent === false ? 0 : 1,
        salePriceNum || null,
        JSON.stringify(pr),
        nowIso
      );
    }
    counts.properties = properties.length;

    for (const c of contracts) {
      const cRec = toRecord(c);
      const id = String(cRec['رقم_العقد'] ?? '').trim();
      if (!id) continue;
      upsertContract.run(
        id,
        cRec['رقم_العقار'] ? String(cRec['رقم_العقار']) : null,
        cRec['رقم_المستاجر'] ? String(cRec['رقم_المستاجر']) : null,
        cRec['رقم_الكفيل'] ? String(cRec['رقم_الكفيل']) : null,
        cRec['حالة_العقد'] ? String(cRec['حالة_العقد']) : null,
        cRec['تاريخ_البداية'] ? String(cRec['تاريخ_البداية']) : null,
        cRec['تاريخ_النهاية'] ? String(cRec['تاريخ_النهاية']) : null,
        toNumber(cRec['القيمة_السنوية']),
        toNumber(cRec['تكرار_الدفع']) || 1,
        cRec['طريقة_الدفع'] ? String(cRec['طريقة_الدفع']) : null,
        cRec.isArchived ? 1 : 0,
        JSON.stringify(c),
        nowIso
      );
    }
    counts.contracts = contracts.length;

    for (const inst of installments) {
      const instRec = toRecord(inst);
      const id = String(
        instRec['رقم_الكمبيالة'] ?? instRec.id ?? instRec.installmentId ?? ''
      ).trim();
      if (!id) continue;
      const { amount, paid, remaining } = computeInstallmentAmounts(inst);

      const contractId = String(
        instRec['رقم_العقد'] ?? instRec.contractId ?? instRec.contract_id ?? ''
      ).trim();
      const dueDate = String(
        instRec['تاريخ_استحقاق'] ?? instRec.dueDate ?? instRec.due_date ?? ''
      ).trim();
      const status = String(instRec['حالة_الكمبيالة'] ?? instRec.status ?? '').trim();
      const type = String(instRec['نوع_الكمبيالة'] ?? instRec.type ?? '').trim();
      const paidAt = String(
        instRec['تاريخ_الدفع'] ?? instRec.paidAt ?? instRec.paid_at ?? ''
      ).trim();

      upsertInstallment.run(
        id,
        contractId ? contractId : null,
        dueDate ? dueDate : null,
        amount,
        paid,
        remaining,
        status ? status : null,
        type ? type : null,
        instRec.isArchived ? 1 : 0,
        paidAt ? paidAt : null,
        JSON.stringify(inst),
        nowIso
      );
    }
    counts.installments = installments.length;

    for (const t of maintenance) {
      const tRec = toRecord(t);
      const id = String(tRec['رقم_التذكرة'] ?? '').trim();
      if (!id) continue;
      upsertTicket.run(
        id,
        tRec['رقم_العقار'] ? String(tRec['رقم_العقار']) : null,
        tRec['رقم_المستاجر'] ? String(tRec['رقم_المستاجر']) : null,
        tRec['تاريخ_الطلب'] ? String(tRec['تاريخ_الطلب']) : null,
        tRec['الحالة'] ? String(tRec['الحالة']) : null,
        tRec['الأولوية'] ? String(tRec['الأولوية']) : null,
        tRec['الوصف'] ? String(tRec['الوصف']) : null,
        tRec['تاريخ_الإغلاق'] ? String(tRec['تاريخ_الإغلاق']) : null,
        JSON.stringify(t),
        nowIso
      );
    }
    counts.maintenance = maintenance.length;
  });

  try {
    // Bulk load from KV can contain orphan links (installment→contract, contract→property, etc.)
    // after partial sync or legacy data. FK enforcement would abort the whole migration with
    // FOREIGN KEY constraint failed — disable only for this transaction, then restore.
    dbh.pragma('foreign_keys = OFF');
    try {
      tx();
    } finally {
      dbh.pragma('foreign_keys = ON');
    }
    metaSet(dbh, 'domain_migrated_at', nowIso);
    // Record KV updatedAt so we can detect staleness (fallback to migration time when KV has no meta).
    metaSet(dbh, `domain_src_updatedAt:${keys.people}`, kvUpdatedAtIso(keys.people) || nowIso);
    metaSet(dbh, `domain_src_updatedAt:${keys.properties}`, kvUpdatedAtIso(keys.properties) || nowIso);
    metaSet(dbh, `domain_src_updatedAt:${keys.contracts}`, kvUpdatedAtIso(keys.contracts) || nowIso);
    metaSet(dbh, `domain_src_updatedAt:${keys.installments}`, kvUpdatedAtIso(keys.installments) || nowIso);
    metaSet(dbh, `domain_src_updatedAt:${keys.maintenance}`, kvUpdatedAtIso(keys.maintenance) || nowIso);
    metaSet(dbh, `domain_src_updatedAt:${keys.roles}`, kvUpdatedAtIso(keys.roles) || nowIso);
    metaSet(dbh, `domain_src_updatedAt:${keys.blacklist}`, kvUpdatedAtIso(keys.blacklist) || nowIso);
    return { ok: true, message: 'تمت تهيئة جداول التقارير بنجاح', migrated: true, counts };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل ترحيل البيانات إلى الجداول';
    return { ok: false, message, migrated: false };
  }
}

/**
 * After every KV write, refresh denormalized SQLite columns from the same JSON the renderer saved.
 * Without this, indexed columns (dueDate, remaining, …) lag behind `data` until a full rebuild.
 */
export function domainSyncAfterKvSet(key: string, value: string): { ok: boolean; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const k = String(key || '').trim();
  if (!k.startsWith('db_')) return { ok: true };

  try {
    if (!metaGet(dbh, 'domain_migrated_at')) {
      const r = domainMigrateFromKvIfNeeded();
      return r.ok ? { ok: true } : { ok: false, message: r.message };
    }

    const nowIso = new Date().toISOString();

    if (k === 'db_installments') {
      syncInstallmentsKvPayload(dbh, value, nowIso);
    } else if (k === 'db_contracts') {
      syncContractsKvPayload(dbh, value, nowIso);
    } else if (k === 'db_people') {
      syncPeopleKvPayload(dbh, value, nowIso);
    } else if (k === 'db_properties') {
      syncPropertiesKvPayload(dbh, value, nowIso);
    } else if (k === 'db_maintenance_tickets') {
      syncMaintenanceKvPayload(dbh, value, nowIso);
    } else if (k === 'db_roles') {
      syncRolesKvPayload(dbh, value, nowIso);
    } else if (k === 'db_blacklist') {
      syncBlacklistKvPayload(dbh, value, nowIso);
    } else {
      return { ok: true };
    }

    const ts = kvUpdatedAtIso(k) || nowIso;
    metaSet(dbh, `domain_src_updatedAt:${k}`, ts);
    return { ok: true };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل مزامنة جداول التقارير مع التخزين';
    return { ok: false, message };
  }
}

function syncInstallmentsKvPayload(dbh: SqliteDb, value: string, nowIso: string): void {
  const installments = safeJsonParseArray(value);

  // Guard: Avoid deleting all data if payload is empty/malformed
  if (installments.length === 0) {
    console.warn('[db] syncInstallmentsKvPayload: payload فارغ — تم التجاهل');
    return;
  }

  const upsertInstallment = dbh.prepare(
    'INSERT INTO installments (id, contractId, dueDate, amount, paid, remaining, status, type, isArchived, paidAt, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET contractId=excluded.contractId, dueDate=excluded.dueDate, amount=excluded.amount, paid=excluded.paid, remaining=excluded.remaining, status=excluded.status, type=excluded.type, isArchived=excluded.isArchived, paidAt=excluded.paidAt, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const tx = dbh.transaction(() => {
    dbh.exec('DELETE FROM installments');
    for (const inst of installments) {
      const instRec = toRecord(inst);
      const id = String(
        instRec['رقم_الكمبيالة'] ?? instRec.id ?? instRec.installmentId ?? ''
      ).trim();
      if (!id) continue;
      const { amount, paid, remaining } = computeInstallmentAmounts(inst);

      const contractId = String(
        instRec['رقم_العقد'] ?? instRec.contractId ?? instRec.contract_id ?? ''
      ).trim();
      const dueDate = String(
        instRec['تاريخ_استحقاق'] ?? instRec.dueDate ?? instRec.due_date ?? ''
      ).trim();
      const status = String(instRec['حالة_الكمبيالة'] ?? instRec.status ?? '').trim();
      const type = String(instRec['نوع_الكمبيالة'] ?? instRec.type ?? '').trim();
      const paidAt = String(
        instRec['تاريخ_الدفع'] ?? instRec.paidAt ?? instRec.paid_at ?? ''
      ).trim();

      upsertInstallment.run(
        id,
        contractId ? contractId : null,
        dueDate ? dueDate : null,
        amount,
        paid,
        remaining,
        status ? status : null,
        type ? type : null,
        instRec.isArchived ? 1 : 0,
        paidAt ? paidAt : null,
        JSON.stringify(inst),
        nowIso
      );
    }
  });
  dbh.pragma('foreign_keys = OFF');
  try {
    tx();
  } finally {
    dbh.pragma('foreign_keys = ON');
  }
}

function syncContractsKvPayload(dbh: SqliteDb, value: string, nowIso: string): void {
  const contracts = safeJsonParseArray(value);

  // Guard: Avoid deleting all data if payload is empty/malformed
  if (contracts.length === 0) {
    console.warn('[db] syncContractsKvPayload: payload فارغ — تم التجاهل');
    return;
  }

  const upsertContract = dbh.prepare(
    'INSERT INTO contracts (id, propertyId, tenantId, guarantorId, status, startDate, endDate, annualValue, paymentFrequency, paymentMethod, isArchived, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET propertyId=excluded.propertyId, tenantId=excluded.tenantId, guarantorId=excluded.guarantorId, status=excluded.status, startDate=excluded.startDate, endDate=excluded.endDate, annualValue=excluded.annualValue, paymentFrequency=excluded.paymentFrequency, paymentMethod=excluded.paymentMethod, isArchived=excluded.isArchived, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const tx = dbh.transaction(() => {
    for (const c of contracts) {
      const cRec = toRecord(c);
      const id = String(cRec['رقم_العقد'] ?? '').trim();
      if (!id) continue;
      upsertContract.run(
        id,
        cRec['رقم_العقار'] ? String(cRec['رقم_العقار']) : null,
        cRec['رقم_المستاجر'] ? String(cRec['رقم_المستاجر']) : null,
        cRec['رقم_الكفيل'] ? String(cRec['رقم_الكفيل']) : null,
        cRec['حالة_العقد'] ? String(cRec['حالة_العقد']) : null,
        cRec['تاريخ_البداية'] ? String(cRec['تاريخ_البداية']) : null,
        cRec['تاريخ_النهاية'] ? String(cRec['تاريخ_النهاية']) : null,
        toNumber(cRec['القيمة_السنوية']),
        toNumber(cRec['تكرار_الدفع']) || 1,
        cRec['طريقة_الدفع'] ? String(cRec['طريقة_الدفع']) : null,
        cRec.isArchived ? 1 : 0,
        JSON.stringify(c),
        nowIso
      );
    }
  });
  tx();
}

function syncPeopleKvPayload(dbh: SqliteDb, value: string, nowIso: string): void {
  const people = safeJsonParseArray(value);

  // Guard: Avoid deleting all data if payload is empty/malformed
  if (people.length === 0) {
    console.warn('[db] syncPeopleKvPayload: payload فارغ — تم التجاهل');
    return;
  }

  const upsertPeople = dbh.prepare(
    'INSERT INTO people (id, name, nationalId, phone, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, nationalId=excluded.nationalId, phone=excluded.phone, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const tx = dbh.transaction(() => {
    for (const p of people) {
      const pRec = toRecord(p);
      const id = String(pRec['رقم_الشخص'] ?? '').trim();
      if (!id) continue;

      const nationalId = pRec['الرقم_الوطني'] ? String(pRec['الرقم_الوطني']) : null;
      const phone = pRec['رقم_الهاتف'] ? String(pRec['رقم_الهاتف']) : null;

      upsertPeople.run(
        id,
        String(pRec['الاسم'] ?? ''),
        nationalId,
        phone,
        JSON.stringify(p),
        nowIso
      );
    }
  });
  tx();
}

function syncPropertiesKvPayload(dbh: SqliteDb, value: string, nowIso: string): void {
  const properties = safeJsonParseArray(value);

  // Guard: Avoid deleting all data if payload is empty/malformed
  if (properties.length === 0) {
    console.warn('[db] syncPropertiesKvPayload: payload فارغ — تم التجاهل');
    return;
  }

  const upsertProperty = dbh.prepare(
    'INSERT INTO properties (id, internalCode, ownerId, type, status, address, city, area, isRented, isForSale, isForRent, salePrice, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET internalCode=excluded.internalCode, ownerId=excluded.ownerId, type=excluded.type, status=excluded.status, address=excluded.address, city=excluded.city, area=excluded.area, isRented=excluded.isRented, isForSale=excluded.isForSale, isForRent=excluded.isForRent, salePrice=excluded.salePrice, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const tx = dbh.transaction(() => {
    for (const pr of properties) {
      const prRec = toRecord(pr);
      const id = String(prRec['رقم_العقار'] ?? '').trim();
      if (!id) continue;

      const salePriceNum = toNumber(prRec.salePrice);
      upsertProperty.run(
        id,
        prRec['الكود_الداخلي'] ? String(prRec['الكود_الداخلي']) : null,
        prRec['رقم_المالك'] ? String(prRec['رقم_المالك']) : null,
        prRec['النوع'] ? String(prRec['النوع']) : null,
        prRec['حالة_العقار'] ? String(prRec['حالة_العقار']) : null,
        prRec['العنوان'] ? String(prRec['العنوان']) : null,
        prRec['المدينة'] ? String(prRec['المدينة']) : null,
        prRec['المنطقة'] ? String(prRec['المنطقة']) : null,
        prRec.IsRented ? 1 : 0,
        prRec.isForSale ? 1 : 0,
        prRec.isForRent === false ? 0 : 1,
        salePriceNum || null,
        JSON.stringify(pr),
        nowIso
      );
    }
  });
  tx();
}

function syncMaintenanceKvPayload(dbh: SqliteDb, value: string, nowIso: string): void {
  const maintenance = safeJsonParseArray(value);

  // Guard: Avoid deleting all data if payload is empty/malformed
  if (maintenance.length === 0) {
    console.warn('[db] syncMaintenanceKvPayload: payload فارغ — تم التجاهل');
    return;
  }

  const upsertTicket = dbh.prepare(
    'INSERT INTO maintenance_tickets (id, propertyId, tenantId, createdDate, status, priority, issue, closedDate, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET propertyId=excluded.propertyId, tenantId=excluded.tenantId, createdDate=excluded.createdDate, status=excluded.status, priority=excluded.priority, issue=excluded.issue, closedDate=excluded.closedDate, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const tx = dbh.transaction(() => {
    for (const t of maintenance) {
      const tRec = toRecord(t);
      const id = String(tRec['رقم_التذكرة'] ?? '').trim();
      if (!id) continue;
      upsertTicket.run(
        id,
        tRec['رقم_العقار'] ? String(tRec['رقم_العقار']) : null,
        tRec['رقم_المستاجر'] ? String(tRec['رقم_المستاجر']) : null,
        tRec['تاريخ_الطلب'] ? String(tRec['تاريخ_الطلب']) : null,
        tRec['الحالة'] ? String(tRec['الحالة']) : null,
        tRec['الأولوية'] ? String(tRec['الأولوية']) : null,
        tRec['الوصف'] ? String(tRec['الوصف']) : null,
        tRec['تاريخ_الإغلاق'] ? String(tRec['تاريخ_الإغلاق']) : null,
        JSON.stringify(t),
        nowIso
      );
    }
  });
  tx();
}

function syncRolesKvPayload(dbh: SqliteDb, value: string, _nowIso: string): void {
  const roles = safeJsonParseArray(value);

  // Guard: Avoid deleting all data if payload is empty/malformed
  if (roles.length === 0) {
    console.warn('[db] syncRolesKvPayload: payload فارغ — تم التجاهل');
    return;
  }

  const insertRole = dbh.prepare('INSERT OR IGNORE INTO person_roles (personId, role) VALUES (?, ?)');
  const tx = dbh.transaction(() => {
    dbh.exec('DELETE FROM person_roles');
    for (const r of roles) {
      const rRec = toRecord(r);
      const personId = String(rRec['رقم_الشخص'] ?? '').trim();
      const role = String(rRec['الدور'] ?? '').trim();
      if (!personId || !role) continue;
      insertRole.run(personId, role);
    }
  });
  tx();
}

function syncBlacklistKvPayload(dbh: SqliteDb, value: string, nowIso: string): void {
  const blacklist = safeJsonParseArray(value);

  // Guard: Avoid deleting all data if payload is empty/malformed
  if (blacklist.length === 0) {
    console.warn('[db] syncBlacklistKvPayload: payload فارغ — تم التجاهل');
    return;
  }

  const upsertBlacklist = dbh.prepare(
    'INSERT INTO blacklist (personId, isActive, data, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(personId) DO UPDATE SET isActive=excluded.isActive, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const tx = dbh.transaction(() => {
    for (const b of blacklist) {
      const bRec = toRecord(b);
      const personId = String(bRec.personId ?? '').trim();
      if (!personId) continue;
      const isActive = bRec.isActive === false ? 0 : 1;
      upsertBlacklist.run(personId, isActive, JSON.stringify(b), nowIso);
    }
  });
  tx();
}

/** Full rebuild of domain SQLite tables from KV (forces migrate; use when tables are empty or inconsistent). */
export function domainRebuildFromKv(): DomainMigrationResult {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  metaSet(dbh, 'domain_migrated_at', '');
  return domainMigrateFromKvIfNeeded();
}

function domainRefreshFromKvIfStale(): DomainMigrationResult {
  const dbh = getDb();
  ensureDomainSchema(dbh);

  const keys = {
    people: 'db_people',
    properties: 'db_properties',
    contracts: 'db_contracts',
    installments: 'db_installments',
    maintenance: 'db_maintenance_tickets',
    roles: 'db_roles',
    blacklist: 'db_blacklist',
  };

  const stale =
    isKvNewerThanDomain(dbh, keys.people) ||
    isKvNewerThanDomain(dbh, keys.properties) ||
    isKvNewerThanDomain(dbh, keys.contracts) ||
    isKvNewerThanDomain(dbh, keys.installments) ||
    isKvNewerThanDomain(dbh, keys.maintenance) ||
    isKvNewerThanDomain(dbh, keys.roles) ||
    isKvNewerThanDomain(dbh, keys.blacklist);

  if (!stale) return { ok: true, message: 'الجداول محدثة', migrated: false };

  // For correctness, refresh all five tables as a single transaction.
  // (KV writes replace the whole array; row-level diffs are not available here.)
  metaSet(dbh, 'domain_migrated_at', '');
  return domainMigrateFromKvIfNeeded();
}

export function runSqlReport(reportId: string): ReportRunResult {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  // Ensure domain tables exist and are refreshed if KV changed.
  const initial = domainMigrateFromKvIfNeeded();
  if (!initial.ok) return { ok: false, message: initial.message };
  const refreshed = domainRefreshFromKvIfStale();
  if (!refreshed.ok) return { ok: false, message: refreshed.message };

  const id = String(reportId || '').trim();
  const generatedAt = new Date().toLocaleString(LOCALE_AR_LATN_GREGORY, {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const today = toIsoDateOnly(new Date());
  const cap = 5000;
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const todayPlus30 = toIsoDateOnly(thirtyDaysFromNow);

  try {
    if (id === 'financial_summary') {
      const row = dbh
        .prepare(
          `
          SELECT
            COALESCE(SUM(amount), 0) AS totalExpected,
            COALESCE(SUM(paid), 0) AS totalPaid,
            COALESCE(SUM(CASE WHEN remaining > 0 AND dueDate < ? THEN remaining ELSE 0 END), 0) AS totalLate,
            COALESCE(SUM(CASE WHEN remaining > 0 AND dueDate >= ? THEN remaining ELSE 0 END), 0) AS totalUpcoming
          FROM installments
          WHERE (type IS NULL OR type <> 'تأمين')
            AND (isArchived IS NULL OR isArchived = 0)
            AND (status IS NULL OR status <> 'ملغي')
        `
        )
        .get(today, today) as
        | { totalExpected?: number; totalPaid?: number; totalLate?: number; totalUpcoming?: number }
        | undefined;

      const totalExpected = toNumber(row?.totalExpected);
      const totalPaid = toNumber(row?.totalPaid);
      const totalLate = toNumber(row?.totalLate);
      const totalUpcoming = toNumber(row?.totalUpcoming);

      return {
        ok: true,
        result: {
          title: 'الملخص المالي',
          generatedAt,
          columns: [
            { key: 'item', header: 'البند' },
            { key: 'value', header: 'القيمة', type: 'currency' },
          ],
          data: [
            { item: 'إجمالي المتوقع', value: totalExpected },
            { item: 'إجمالي المحصل', value: totalPaid },
            { item: 'إجمالي المتأخر', value: totalLate },
            { item: 'إجمالي القادم', value: totalUpcoming },
            { item: 'المتبقي', value: totalExpected - totalPaid },
          ],
          summary: [
            {
              label: 'نسبة التحصيل',
              value: `${totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0}%`,
            },
          ],
        },
      };
    }

    if (id === 'late_installments') {
      const rows = dbh
        .prepare(
          `
          SELECT
            COALESCE(p.name, 'غير معروف') AS tenant,
            COALESCE(pr.internalCode, 'غير معروف') AS property,
            i.dueDate AS dueDate,
            i.remaining AS amount,
            CAST((julianday(?) - julianday(i.dueDate)) AS INTEGER) AS daysLate,
            COALESCE(i.status, '') AS status
          FROM installments i
          LEFT JOIN contracts c ON c.id = i.contractId
          LEFT JOIN people p ON p.id = c.tenantId
          LEFT JOIN properties pr ON pr.id = c.propertyId
          WHERE (i.type IS NULL OR i.type <> 'تأمين')
            AND (i.isArchived IS NULL OR i.isArchived = 0)
            AND (i.status IS NULL OR i.status <> 'ملغي')
            AND COALESCE(i.remaining, 0) > 0
            AND i.dueDate < ?
          ORDER BY i.dueDate ASC
          LIMIT ?
        `
        )
        .all(today, today, cap) as Array<{
        tenant: string;
        property: string;
        dueDate: string;
        amount: number;
        daysLate: number;
        status: string;
      }>;

      const data = rows.map((r) => ({
        tenant: r.tenant,
        property: r.property,
        dueDate: r.dueDate,
        amount: Number(r.amount ?? 0) || 0,
        daysLate: `${Number(r.daysLate ?? 0) || 0} يوم`,
        status: r.status,
      }));

      const summary: Array<{ label: string; value: string | number }> = [
        { label: 'عدد النتائج المعروضة', value: data.length },
      ];
      if (data.length >= cap)
        summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

      return {
        ok: true,
        result: {
          title: 'الأقساط المتأخرة',
          generatedAt,
          columns: [
            { key: 'tenant', header: 'المستأجر' },
            { key: 'property', header: 'العقار' },
            { key: 'dueDate', header: 'تاريخ الاستحقاق', type: 'date' },
            { key: 'amount', header: 'المبلغ', type: 'currency' },
            { key: 'daysLate', header: 'أيام التأخير' },
            { key: 'status', header: 'الحالة', type: 'status' },
          ],
          data,
          summary,
        },
      };
    }

    if (id === 'contracts_active') {
      const rows = dbh
        .prepare(
          `
          SELECT
            c.id AS contractNo,
            COALESCE(p.name, 'غير معروف') AS tenant,
            COALESCE(pr.internalCode, 'غير معروف') AS property,
            c.startDate AS startDate,
            c.endDate AS endDate,
            (COALESCE(c.annualValue, 0) / 12.0) AS monthlyRent,
            COALESCE(c.status, '') AS status
          FROM contracts c
          LEFT JOIN people p ON p.id = c.tenantId
          LEFT JOIN properties pr ON pr.id = c.propertyId
          WHERE (c.isArchived IS NULL OR c.isArchived = 0)
            AND c.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
          ORDER BY c.endDate ASC
          LIMIT ?
        `
        )
        .all(cap) as Array<{
        contractNo: string;
        tenant: string;
        property: string;
        startDate: string;
        endDate: string;
        monthlyRent: number;
        status: string;
      }>;

      const data = rows.map((r) => ({
        contractNo: r.contractNo,
        tenant: r.tenant,
        property: r.property,
        startDate: r.startDate,
        endDate: r.endDate,
        monthlyRent: Number(r.monthlyRent ?? 0) || 0,
        status: r.status,
      }));

      const totalMonthly = data.reduce((s, r) => s + toNumber(r.monthlyRent), 0);
      const summary = [
        { label: 'عدد العقود النشطة', value: data.length },
        {
          label: 'إجمالي الإيرادات الشهرية',
          value: `${Math.round(totalMonthly).toLocaleString(LOCALE_AR_LATN_GREGORY)} د.أ`,
        },
      ];
      if (data.length >= cap)
        summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

      return {
        ok: true,
        result: {
          title: 'العقود السارية',
          generatedAt,
          columns: [
            { key: 'contractNo', header: 'رقم العقد' },
            { key: 'tenant', header: 'المستأجر' },
            { key: 'property', header: 'العقار' },
            { key: 'startDate', header: 'تاريخ البداية', type: 'date' },
            { key: 'endDate', header: 'تاريخ النهاية', type: 'date' },
            { key: 'monthlyRent', header: 'الإيجار الشهري', type: 'currency' },
            { key: 'status', header: 'الحالة', type: 'status' },
          ],
          data,
          summary,
        },
      };
    }

    if (id === 'maintenance_open_tickets') {
      const rows = dbh
        .prepare(
          `
          WITH best_contract AS (
            SELECT
              c.propertyId,
              c.tenantId,
              ROW_NUMBER() OVER (
                PARTITION BY c.propertyId
                ORDER BY
                  CASE c.status
                    WHEN 'نشط' THEN 3
                    WHEN 'قريب الانتهاء' THEN 2
                    WHEN 'مجدد' THEN 1
                    ELSE 0
                  END DESC,
                  COALESCE(c.startDate, '') DESC,
                  COALESCE(c.endDate, '') DESC,
                  c.id DESC
              ) AS rn
            FROM contracts c
            WHERE (c.isArchived IS NULL OR c.isArchived = 0)
          )
          SELECT
            t.id AS ticketNo,
            COALESCE(pr.internalCode, 'غير معروف') AS property,
            COALESCE(p.name, '-') AS tenant,
            COALESCE(t.issue, '') AS issue,
            COALESCE(t.priority, '') AS priority,
            COALESCE(t.status, '') AS status,
            t.createdDate AS createdDate
          FROM maintenance_tickets t
          LEFT JOIN properties pr ON pr.id = t.propertyId
          LEFT JOIN best_contract bc ON bc.propertyId = t.propertyId AND bc.rn = 1
          LEFT JOIN people p ON p.id = bc.tenantId
          WHERE t.status IS NOT NULL AND t.status <> 'مغلق'
          ORDER BY t.createdDate DESC
          LIMIT ?
        `
        )
        .all(cap) as Array<{
        ticketNo: string;
        property: string;
        tenant: string;
        issue: string;
        priority: string;
        status: string;
        createdDate: string;
      }>;

      const data = rows.map((r) => ({
        ticketNo: r.ticketNo,
        property: r.property,
        tenant: r.tenant,
        issue: r.issue,
        priority: r.priority,
        status: r.status,
        createdDate: r.createdDate,
      }));

      const high = data.filter((d) => String(d.priority) === 'عالية').length;
      const summary: Array<{ label: string; value: string | number }> = [
        { label: 'عدد الطلبات المفتوحة', value: data.length },
        { label: 'طلبات عالية الأولوية', value: high },
      ];
      if (data.length >= cap)
        summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

      return {
        ok: true,
        result: {
          title: 'طلبات الصيانة المفتوحة',
          generatedAt,
          columns: [
            { key: 'ticketNo', header: 'رقم الطلب' },
            { key: 'property', header: 'العقار' },
            { key: 'tenant', header: 'المستأجر' },
            { key: 'issue', header: 'المشكلة' },
            { key: 'priority', header: 'الأولوية', type: 'status' },
            { key: 'status', header: 'الحالة', type: 'status' },
            { key: 'createdDate', header: 'تاريخ الإنشاء', type: 'date' },
          ],
          data,
          summary,
        },
      };
    }

    if (id === 'contracts_expiring') {
      const rows = dbh
        .prepare(
          `
          SELECT
            c.id AS contractNo,
            COALESCE(p.name, 'غير معروف') AS tenant,
            COALESCE(pr.internalCode, 'غير معروف') AS property,
            c.endDate AS endDate,
            CAST((julianday(c.endDate) - julianday(?)) AS INTEGER) AS daysRemaining,
            (COALESCE(c.annualValue, 0) / 12.0) AS monthlyRent
          FROM contracts c
          LEFT JOIN people p ON p.id = c.tenantId
          LEFT JOIN properties pr ON pr.id = c.propertyId
          WHERE (c.isArchived IS NULL OR c.isArchived = 0)
            AND c.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
            AND c.endDate >= ?
            AND c.endDate <= ?
          ORDER BY c.endDate ASC
          LIMIT ?
        `
        )
        .all(today, today, todayPlus30, cap) as Array<{
        contractNo: string;
        tenant: string;
        property: string;
        endDate: string;
        daysRemaining: number;
        monthlyRent: number;
      }>;

      const data = rows.map((r) => ({
        contractNo: r.contractNo,
        tenant: r.tenant,
        property: r.property,
        endDate: r.endDate,
        daysRemaining: `${Number(r.daysRemaining ?? 0) || 0} يوم`,
        monthlyRent: Number(r.monthlyRent ?? 0) || 0,
      }));

      const summary: Array<{ label: string; value: string | number }> = [
        { label: 'عدد العقود', value: data.length },
      ];
      if (data.length >= cap)
        summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

      return {
        ok: true,
        result: {
          title: 'العقود التي ستنتهي قريباً',
          generatedAt,
          columns: [
            { key: 'contractNo', header: 'رقم العقد' },
            { key: 'tenant', header: 'المستأجر' },
            { key: 'property', header: 'العقار' },
            { key: 'endDate', header: 'تاريخ الانتهاء', type: 'date' },
            { key: 'daysRemaining', header: 'الأيام المتبقة' },
            { key: 'monthlyRent', header: 'الإيجار الشهري', type: 'currency' },
          ],
          data,
          summary,
        },
      };
    }

    if (id === 'properties_vacant') {
      const rows = dbh
        .prepare(
          `
          SELECT
            COALESCE(pr.internalCode, '') AS code,
            COALESCE(pr.type, '') AS type,
            CAST(COALESCE(json_extract(pr.data, '$."المساحة"'), 0) AS REAL) AS areaNum,
            COALESCE(json_extract(pr.data, '$."الطابق"'), '-') AS floor,
            COALESCE(json_extract(pr.data, '$."عدد_الغرف"'), '-') AS rooms,
            COALESCE(o.name, 'غير معروف') AS owner,
            COALESCE(json_extract(pr.data, '$."العنوان"'), '-') AS location
          FROM properties pr
          LEFT JOIN people o ON o.id = pr.ownerId
          WHERE COALESCE(pr.isRented, 0) = 0
          ORDER BY pr.internalCode ASC
          LIMIT ?
        `
        )
        .all(cap) as Array<{
        code: string;
        type: string;
        areaNum: number;
        floor: string;
        rooms: string;
        owner: string;
        location: string;
      }>;

      const data = rows.map((r) => ({
        code: r.code,
        type: r.type,
        area: r.areaNum ? `${Number(r.areaNum)} م²` : '-',
        floor: String(r.floor ?? '-') || '-',
        rooms: String(r.rooms ?? '-') || '-',
        owner: r.owner,
        location: String(r.location ?? '-') || '-',
      }));

      const summary: Array<{ label: string; value: string | number }> = [
        { label: 'عدد العقارات الشاغرة', value: data.length },
      ];
      if (data.length >= cap)
        summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

      return {
        ok: true,
        result: {
          title: 'العقارات الشاغرة',
          generatedAt,
          columns: [
            { key: 'code', header: 'كود العقار' },
            { key: 'type', header: 'النوع' },
            { key: 'area', header: 'المساحة' },
            { key: 'floor', header: 'الطابق' },
            { key: 'rooms', header: 'الغرف' },
            { key: 'owner', header: 'المالك' },
            { key: 'location', header: 'الموقع' },
          ],
          data,
          summary,
        },
      };
    }

    if (id === 'properties_data_quality') {
      const rows = dbh
        .prepare(
          `
          SELECT
            COALESCE(pr.internalCode, '') AS code,
            COALESCE(pr.type, '') AS type,
            CASE WHEN json_extract(pr.data, '$."رقم_اشتراك_الكهرباء"') IS NULL OR TRIM(CAST(json_extract(pr.data, '$."رقم_اشتراك_الكهرباء"') AS TEXT)) = '' THEN 1 ELSE 0 END AS missElec,
            CASE WHEN json_extract(pr.data, '$."رقم_اشتراك_المياه"') IS NULL OR TRIM(CAST(json_extract(pr.data, '$."رقم_اشتراك_المياه"') AS TEXT)) = '' THEN 1 ELSE 0 END AS missWater,
            CASE WHEN json_extract(pr.data, '$."المساحة"') IS NULL OR CAST(json_extract(pr.data, '$."المساحة"') AS REAL) = 0 THEN 1 ELSE 0 END AS missArea,
            CASE WHEN json_extract(pr.data, '$."العنوان"') IS NULL OR TRIM(CAST(json_extract(pr.data, '$."العنوان"') AS TEXT)) = '' THEN 1 ELSE 0 END AS missAddr
          FROM properties pr
          WHERE
            (json_extract(pr.data, '$."رقم_اشتراك_الكهرباء"') IS NULL OR TRIM(CAST(json_extract(pr.data, '$."رقم_اشتراك_الكهرباء"') AS TEXT)) = '')
            OR (json_extract(pr.data, '$."رقم_اشتراك_المياه"') IS NULL OR TRIM(CAST(json_extract(pr.data, '$."رقم_اشتراك_المياه"') AS TEXT)) = '')
            OR (json_extract(pr.data, '$."المساحة"') IS NULL OR CAST(json_extract(pr.data, '$."المساحة"') AS REAL) = 0)
            OR (json_extract(pr.data, '$."العنوان"') IS NULL OR TRIM(CAST(json_extract(pr.data, '$."العنوان"') AS TEXT)) = '')
          ORDER BY pr.internalCode ASC
          LIMIT ?
        `
        )
        .all(cap) as Array<{
        code: string;
        type: string;
        missElec: number;
        missWater: number;
        missArea: number;
        missAddr: number;
      }>;

      const data = rows.map((r) => {
        const missing: string[] = [];
        if (Number(r.missElec) === 1) missing.push('عداد الكهرباء');
        if (Number(r.missWater) === 1) missing.push('عداد الماء');
        if (Number(r.missArea) === 1) missing.push('المساحة');
        if (Number(r.missAddr) === 1) missing.push('العنوان');
        const completeness = Math.round(((4 - missing.length) / 4) * 100);
        return {
          code: r.code,
          type: r.type,
          missingData: missing.join(', '),
          completeness: `${completeness}%`,
        };
      });

      const summary: Array<{ label: string; value: string | number }> = [
        { label: 'عقارات تحتاج تحديث', value: data.length },
      ];
      if (data.length >= cap)
        summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

      return {
        ok: true,
        result: {
          title: 'جودة بيانات العقارات',
          generatedAt,
          columns: [
            { key: 'code', header: 'كود العقار' },
            { key: 'type', header: 'النوع' },
            { key: 'missingData', header: 'البيانات الناقصة' },
            { key: 'completeness', header: 'نسبة الاكتمال' },
          ],
          data,
          summary,
        },
      };
    }

    return { ok: false, message: 'هذا التقرير غير مدعوم عبر SQL حالياً' };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'فشل توليد التقرير';
    return { ok: false, message };
  }
}

export function kvGet(key: string): string | null {
  const row = getDb().prepare('SELECT v FROM kv WHERE k = ?').get(key) as { v: string } | undefined;
  return row?.v ?? null;
}

export function kvGetMeta(key: string): { value: string; updatedAt: string } | null {
  const row = getDb().prepare('SELECT v, updatedAt FROM kv WHERE k = ?').get(key) as
    | { v: string; updatedAt: string }
    | undefined;
  if (!row) return null;
  return { value: row.v, updatedAt: row.updatedAt };
}

export function kvGetDeletedAt(key: string): string | null {
  const row = getDb().prepare('SELECT deletedAt FROM kv_deleted WHERE k = ?').get(key) as
    | { deletedAt: string }
    | undefined;
  return row?.deletedAt ?? null;
}

export function kvSet(key: string, value: string): void {
  // Any write cancels a pending deletion marker.
  getDb().prepare('DELETE FROM kv_deleted WHERE k = ?').run(key);
  const normalizedValue = normalizeKvValueOnWrite(key, value);
  getDb()
    .prepare(
      'INSERT INTO kv (k, v, updatedAt) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updatedAt=excluded.updatedAt'
    )
    .run(key, normalizedValue, new Date().toISOString());
}

export function kvSetWithUpdatedAt(key: string, value: string, updatedAtIso: string): void {
  getDb().prepare('DELETE FROM kv_deleted WHERE k = ?').run(key);
  const normalizedValue = normalizeKvValueOnWrite(key, value);
  getDb()
    .prepare(
      'INSERT INTO kv (k, v, updatedAt) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updatedAt=excluded.updatedAt'
    )
    .run(key, normalizedValue, updatedAtIso);
}

export function kvDelete(key: string): void {
  getDb().prepare('DELETE FROM kv WHERE k = ?').run(key);
  getDb()
    .prepare(
      'INSERT INTO kv_deleted (k, deletedAt) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET deletedAt=excluded.deletedAt'
    )
    .run(key, new Date().toISOString());
}

export function kvApplyRemoteDelete(key: string, deletedAtIso: string): void {
  getDb().prepare('DELETE FROM kv WHERE k = ?').run(key);
  getDb()
    .prepare(
      'INSERT INTO kv_deleted (k, deletedAt) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET deletedAt=excluded.deletedAt'
    )
    .run(key, deletedAtIso);
}

export function kvKeys(): string[] {
  const rows = getDb().prepare('SELECT k FROM kv ORDER BY k').all() as Array<{ k: string }>;
  return rows.map((r) => r.k);
}

export function kvListUpdatedSince(
  sinceIso: string
): Array<{ k: string; v: string; updatedAt: string }> {
  const since =
    sinceIso && String(sinceIso).trim() ? String(sinceIso).trim() : '1970-01-01T00:00:00.000Z';
  const rows = getDb()
    .prepare('SELECT k, v, updatedAt FROM kv WHERE updatedAt > ? ORDER BY updatedAt')
    .all(since) as Array<{ k: string; v: string; updatedAt: string }>;
  return rows || [];
}

export function kvListDeletedSince(sinceIso: string): Array<{ k: string; deletedAt: string }> {
  const since =
    sinceIso && String(sinceIso).trim() ? String(sinceIso).trim() : '1970-01-01T00:00:00.000Z';
  const rows = getDb()
    .prepare('SELECT k, deletedAt FROM kv_deleted WHERE deletedAt > ? ORDER BY deletedAt')
    .all(since) as Array<{ k: string; deletedAt: string }>;
  return rows || [];
}

export function kvResetAll(prefix = 'db_'): { deleted: number } {
  const stmt = getDb().prepare('DELETE FROM kv WHERE k LIKE ?');
  const res = stmt.run(`${prefix}%`) as unknown;
  return { deleted: toNumber(toRecord(res).changes) };
}

export async function exportDatabase(destinationPath: string): Promise<void> {
  const sourcePath = getDbPath();

  // Close DB connection temporarily for safe copy
  if (db) {
    db.close();
    db = null;
  }

  try {
    // Copy file
    await fs.copyFile(sourcePath, destinationPath);
  } finally {
    // Reopen DB always
    getDb();
  }
}

export async function exportDatabaseToMany(destinationPaths: string[]): Promise<void> {
  const sourcePath = getDbPath();

  // Close DB connection temporarily for safe copy
  if (db) {
    db.close();
    db = null;
  }

  try {
    for (const destinationPath of destinationPaths) {
      const dir = path.dirname(destinationPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.copyFile(sourcePath, destinationPath);
    }
  } finally {
    // Reopen DB always
    getDb();
  }
}

export async function importDatabase(sourcePath: string): Promise<void> {
  const destPath = getDbPath();

  // Close DB connection
  if (db) {
    db.close();
    db = null;
  }

  try {
    // Backup current database
    const backupPath = destPath + `.backup-${Date.now()}`;
    try {
      await fs.copyFile(destPath, backupPath);
    } catch {
      // Ignore if no existing DB
    }

    // Copy imported file over current DB
    await fs.copyFile(sourcePath, destPath);
  } finally {
    // Reopen DB always
    getDb();
  }
}

// Ensure database connection is closed cleanly on app shutdown to allow WAL commit
app.on('before-quit', () => {
  if (db) {
    try {
      db.close();
      db = null;
    } catch {
      // Ignore errors during shutdown
    }
  }
});
