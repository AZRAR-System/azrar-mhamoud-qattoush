import path from 'node:path';
import { app, dialog } from 'electron';
import { createRequire } from 'node:module';
import type BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

type SqliteDb = InstanceType<typeof BetterSqlite3>;

const require = createRequire(import.meta.url);

let BetterSqlite3Ctor: any | null = null;

let db: SqliteDb | null = null;

let resolvedDbPath: string | null = null;

function ensureWritableDirSync(dir: string) {
  fsSync.mkdirSync(dir, { recursive: true });
  const probe = path.join(dir, '.write-test');
  fsSync.writeFileSync(probe, 'ok');
  fsSync.unlinkSync(probe);
}

function maybeMigrateLegacyDbSync(fromPath: string, toPath: string) {
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

  // Prefer the legacy behavior (DB next to the executable) when packaged AND writable.
  // Fall back to userData if the install directory is not writable (common for Program Files).
  if (app.isPackaged) {
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      const exeAdjacentPath = path.join(exeDir, 'khaberni.sqlite');

      // If a legacy DB exists there already, keep using it.
      if (fsSync.existsSync(exeAdjacentPath)) {
        resolvedDbPath = exeAdjacentPath;
        return resolvedDbPath;
      }

      // If we can write next to the exe, use the legacy path.
      try {
        ensureWritableDirSync(exeDir);
        resolvedDbPath = exeAdjacentPath;
        return resolvedDbPath;
      } catch {
        // Not writable: fall back to userData.
      }
    } catch {
      // Ignore and fall back to userData.
    }
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

export function getDb(): SqliteDb {
  if (db) return db;

  if (!BetterSqlite3Ctor) {
    try {
      const mod: any = require('better-sqlite3');
      BetterSqlite3Ctor = mod?.default ?? mod;
      if (!BetterSqlite3Ctor) throw new Error('better-sqlite3 module did not export a constructor');
    } catch (e: any) {
      const rawMsg = e?.message ? String(e.message) : String(e);
      const looksAbiMismatch = /NODE_MODULE_VERSION\s+\d+|compiled against a different Node\.js version/i.test(rawMsg);
      const detail = looksAbiMismatch
        ? 'تم بناء التطبيق أو التبعيات بإصدار Node/Electron مختلف. يلزم إعادة بناء/تثبيت نسخة Desktop بشكل صحيح.'
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

  const database = (db = new BetterSqlite3Ctor(dbPath) as SqliteDb);
  database.pragma(`journal_mode = ${getJournalMode()}`);
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
}

type DomainMigrationResult = {
  ok: boolean;
  message: string;
  migrated: boolean;
  counts?: Record<string, number>;
};

type ReportRunResult = {
  ok: boolean;
  result?: any;
  message?: string;
};

const DOMAIN_SCHEMA_VERSION = 3;

function metaGet(dbh: SqliteDb, key: string): string | null {
  const row = dbh.prepare('SELECT v FROM domain_meta WHERE k = ?').get(key) as { v: string } | undefined;
  return row?.v ?? null;
}

function metaSet(dbh: SqliteDb, key: string, value: string): void {
  dbh.prepare('INSERT INTO domain_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(key, value);
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
      role TEXT NOT NULL
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
      updatedAt TEXT NOT NULL
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
      updatedAt TEXT NOT NULL
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
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_maint_propertyId ON maintenance_tickets(propertyId);
    CREATE INDEX IF NOT EXISTS idx_maint_status ON maintenance_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_maint_priority ON maintenance_tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_maint_createdDate ON maintenance_tickets(createdDate);
  `);

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

    const peopleCnt = Number((dbh.prepare('SELECT COUNT(1) AS cnt FROM people').get() as any)?.cnt || 0) || 0;
    const propsCnt = Number((dbh.prepare('SELECT COUNT(1) AS cnt FROM properties').get() as any)?.cnt || 0) || 0;
    const contractsCnt = Number((dbh.prepare('SELECT COUNT(1) AS cnt FROM contracts').get() as any)?.cnt || 0) || 0;
    const instCnt = Number((dbh.prepare('SELECT COUNT(1) AS cnt FROM installments').get() as any)?.cnt || 0) || 0;

    const needsRepair =
      (peopleCnt === 0 && kvLooksNonEmpty('db_people')) ||
      (propsCnt === 0 && kvLooksNonEmpty('db_properties')) ||
      (contractsCnt === 0 && kvLooksNonEmpty('db_contracts')) ||
      (instCnt === 0 && kvLooksNonEmpty('db_installments'));

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

export function domainGetEntityById(entity: 'people' | 'properties' | 'contracts', id: string): { ok: boolean; data?: any; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const safeId = String(id || '').trim();
  if (!safeId) return { ok: false, message: 'معرف غير صالح' };

  const table = entity === 'people' ? 'people' : entity === 'properties' ? 'properties' : 'contracts';
  try {
    const row = dbh.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(safeId) as { data: string } | undefined;
    if (!row?.data) return { ok: false, message: 'غير موجود' };
    try {
      return { ok: true, data: JSON.parse(row.data) };
    } catch {
      return { ok: false, message: 'بيانات غير صالحة' };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل قراءة البيانات' };
  }
}

export function domainPersonDetails(personId: string): {
  ok: boolean;
  data?: {
    person: any;
    roles: string[];
    ownedProperties: any[];
    contracts: any[];
    blacklistRecord?: any;
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
  if (!id) return { ok: false, message: 'معرف غير صالح' };

  try {
    const personRow = dbh.prepare('SELECT data FROM people WHERE id = ?').get(id) as { data: string } | undefined;
    if (!personRow?.data) return { ok: false, message: 'غير موجود' };

    let person: any;
    try {
      person = JSON.parse(personRow.data);
    } catch {
      return { ok: false, message: 'بيانات غير صالحة' };
    }

    const roles = (dbh.prepare('SELECT role FROM person_roles WHERE personId = ? ORDER BY role ASC').all(id) as Array<{ role: string }>).map(
      (r) => String(r.role || '').trim()
    ).filter(Boolean);

    const ownedProperties = (dbh.prepare('SELECT data FROM properties WHERE ownerId = ? ORDER BY COALESCE(internalCode,\'\') ASC').all(id) as Array<{ data: string }>).map(
      (r) => {
        try {
          return JSON.parse(r.data);
        } catch {
          return null;
        }
      }
    ).filter(Boolean);

    const contracts = (dbh.prepare('SELECT data FROM contracts WHERE tenantId = ? AND COALESCE(isArchived,0) = 0 ORDER BY COALESCE(startDate,\'\') DESC, id DESC').all(id) as Array<{ data: string }>).map(
      (r) => {
        try {
          return JSON.parse(r.data);
        } catch {
          return null;
        }
      }
    ).filter(Boolean);

    const blacklistRow = dbh.prepare('SELECT data FROM blacklist WHERE personId = ? AND COALESCE(isActive,0) = 1').get(id) as { data: string } | undefined;
    let blacklistRecord: any | undefined = undefined;
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
    const commitmentRatio = totalInstallments ? Math.round(((totalInstallments - lateInstallments) / totalInstallments) * 100) : 100;

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
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل قراءة بيانات الشخص' };
  }
}

export function domainPersonTenancyContracts(personId: string): {
  ok: boolean;
  items?: Array<{ contract: any; propertyCode?: string; propertyAddress?: string; tenantName?: string }>;
  message?: string;
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const id = String(personId || '').trim();
  if (!id) return { ok: false, message: 'معرف غير صالح' };

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
      .all(id, id, id) as Array<{ contractData: string; propertyCode?: string; propertyAddress?: string; tenantName?: string }>;

    const items = rows
      .map((r) => {
        let contract: any | null = null;
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
      .filter(Boolean) as Array<{ contract: any; propertyCode?: string; propertyAddress?: string; tenantName?: string }>;

    return { ok: true, items };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل جلب عقود الشخص' };
  }
}

export function domainPropertyContracts(propertyId: string, limit = 5000): {
  ok: boolean;
  items?: Array<{ contract: any; tenantName?: string; guarantorName?: string }>;
  message?: string;
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const pid = String(propertyId || '').trim();
  if (!pid) return { ok: false, message: 'معرف غير صالح' };

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
      .filter(Boolean) as Array<{ contract: any; tenantName?: string; guarantorName?: string }>;

    return { ok: true, items };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل قراءة عقود العقار' };
  }
}

export function domainContractDetails(contractId: string): {
  ok: boolean;
  data?: { contract: any; property?: any; tenant?: any; installments: any[] };
  message?: string;
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const cid = String(contractId || '').trim();
  if (!cid) return { ok: false, message: 'معرف غير صالح' };

  try {
    const row = dbh
      .prepare('SELECT data, propertyId, tenantId FROM contracts WHERE id = ? LIMIT 1')
      .get(cid) as { data?: string; propertyId?: string; tenantId?: string } | undefined;

    if (!row?.data) return { ok: false, message: 'العقد غير موجود' };

    let contract: any;
    try {
      contract = JSON.parse(String(row.data || ''));
    } catch {
      return { ok: false, message: 'بيانات العقد غير صالحة' };
    }

    const pid = String(row.propertyId || '').trim();
    const tid = String(row.tenantId || '').trim();

    let property: any | undefined;
    if (pid) {
      const pr = dbh.prepare('SELECT data FROM properties WHERE id = ? LIMIT 1').get(pid) as { data?: string } | undefined;
      if (pr?.data) {
        try {
          property = JSON.parse(String(pr.data || ''));
        } catch {
          property = undefined;
        }
      }
    }

    let tenant: any | undefined;
    if (tid) {
      const tr = dbh.prepare('SELECT data FROM people WHERE id = ? LIMIT 1').get(tid) as { data?: string } | undefined;
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
      .filter(Boolean) as any[];

    // Keep legacy ordering semantics when rank is available.
    installments.sort((a, b) => {
      const ar = Number((a as any)?.ترتيب_الكمبيالة ?? (a as any)?.rank ?? 0) || 0;
      const br = Number((b as any)?.ترتيب_الكمبيالة ?? (b as any)?.rank ?? 0) || 0;
      if (ar !== br) return ar - br;
      return String((a as any)?.تاريخ_استحقاق ?? (a as any)?.dueDate ?? '').localeCompare(
        String((b as any)?.تاريخ_استحقاق ?? (b as any)?.dueDate ?? '')
      );
    });

    return { ok: true, data: { contract, property, tenant, installments } };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل تحميل تفاصيل العقد' };
  }
}

export function domainSearch(entity: 'people' | 'properties' | 'contracts', query: string, limit = 50): { ok: boolean; items?: any[]; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(query || '').trim();
  const qLower = q.toLowerCase();
  const cap = Math.max(1, Math.min(200, Math.trunc(Number(limit) || 50)));

  // For empty query, return a stable sample ordered by name/code.
  const like = `%${qLower}%`;

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
        .filter(Boolean);

      return { ok: true, items };
    }

    if (entity === 'properties') {
      const rows = q
        ? (dbh
            .prepare(
              `
              SELECT data
              FROM properties
              WHERE lower(COALESCE(internalCode,'')) LIKE ?
                 OR lower(COALESCE(address,'')) LIKE ?
              ORDER BY COALESCE(internalCode,'') ASC
              LIMIT ?
            `
            )
            .all(like, like, cap) as Array<{ data: string }>)
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
      .filter(Boolean);

    return { ok: true, items };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل البحث' };
  }
}

export function domainSearchGlobal(query: string): { ok: boolean; people?: any[]; properties?: any[]; contracts?: any[]; message?: string } {
  const q = String(query || '').trim();
  if (!q) return { ok: true, people: [], properties: [], contracts: [] };

  const peopleRes = domainSearch('people', q, 5);
  if (!peopleRes.ok) return { ok: false, message: peopleRes.message };

  const propRes = domainSearch('properties', q, 5);
  if (!propRes.ok) return { ok: false, message: propRes.message };

  const contRes = domainSearch('contracts', q, 5);
  if (!contRes.ok) return { ok: false, message: contRes.message };

  return { ok: true, people: peopleRes.items || [], properties: propRes.items || [], contracts: contRes.items || [] };
}

export function domainPropertyPickerSearch(payload: {
  query?: string;
  status?: string;
  type?: string;
  forceVacant?: boolean;
  occupancy?: 'all' | 'rented' | 'vacant';
  sale?: 'for-sale' | 'not-for-sale' | '';
  offset?: number;
  limit?: number;
}): { ok: boolean; items?: any[]; total?: number; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(payload?.query || '').trim();
  const qLower = q.toLowerCase();
  const status = String(payload?.status || '').trim();
  const type = String(payload?.type || '').trim();
  const forceVacant = !!payload?.forceVacant;
  const occupancyRaw = String((payload as any)?.occupancy || '').trim();
  const occupancy = occupancyRaw === 'rented' || occupancyRaw === 'vacant' || occupancyRaw === 'all' ? (occupancyRaw as any) : 'all';
  const saleRaw = String((payload as any)?.sale || '').trim();
  const sale = saleRaw === 'for-sale' || saleRaw === 'not-for-sale' ? (saleRaw as any) : '';
  const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
  const cap = Math.max(1, Math.min(500, Math.trunc(Number(payload?.limit) || 200)));
  const like = `%${qLower}%`;
  const today = toIsoDateOnly(new Date());

  try {
    const whereParts: string[] = [];
    const args: any[] = [];

    if (q) {
      whereParts.push('(lower(COALESCE(pr.internalCode,\'\')) LIKE ? OR lower(COALESCE(pr.address,\'\')) LIKE ? OR lower(COALESCE(owner.name,\'\')) LIKE ?)');
      args.push(like, like, like);
    }
    if (status) {
      whereParts.push('COALESCE(pr.status,\'\') = ?');
      args.push(status);
    }
    if (type) {
      whereParts.push('COALESCE(pr.type,\'\') = ?');
      args.push(type);
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

    if (forceVacant) {
      // Keep consistent with the active-contract subquery used in the SELECT.
      whereParts.push(
        `NOT EXISTS (
          SELECT 1
          FROM contracts c2
          WHERE c2.propertyId = pr.id
            AND (c2.isArchived IS NULL OR c2.isArchived = 0)
            AND (
              c2.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
              OR (
                c2.endDate IS NOT NULL
                AND c2.endDate >= ?
                AND COALESCE(c2.status, '') NOT IN ('منتهي', 'مفسوخ', 'ملغي')
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
            c.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
            OR (
              c.endDate IS NOT NULL
              AND c.endDate >= ?
              AND COALESCE(c.status, '') NOT IN ('منتهي', 'مفسوخ', 'ملغي')
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
      ORDER BY COALESCE(pr.internalCode, '') ASC
      LIMIT ? OFFSET ?
    `;

    // Note: today must be first arg (for subquery), then dynamic where args (may include today again for forceVacant), then paging.
    const total = Number((dbh.prepare(countSql).get(...args) as any)?.cnt || 0) || 0;
    const rows = dbh.prepare(sql).all(today, ...args, cap, offset) as any[];
    const items = rows
      .map((r) => {
        let property: any = null;
        try {
          property = JSON.parse(String(r?.propertyData || 'null'));
        } catch {
          property = null;
        }
        if (!property) return null;
        return {
          property,
          ownerName: String(r?.ownerName || ''),
          ownerPhone: String(r?.ownerPhone || ''),
          ownerNationalId: String(r?.ownerNationalId || ''),
          active: r?.activeContractId
            ? {
                contractId: String(r?.activeContractId || ''),
                status: String(r?.contractStatus || ''),
                startDate: String(r?.contractStartDate || ''),
                endDate: String(r?.contractEndDate || ''),
                tenantName: String(r?.tenantName || ''),
                tenantPhone: String(r?.tenantPhone || ''),
                guarantorName: String(r?.guarantorName || ''),
                guarantorPhone: String(r?.guarantorPhone || ''),
              }
            : null,
        };
      })
      .filter(Boolean);

    return { ok: true, items, total };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل البحث عن العقارات' };
  }
}

export function domainContractPickerSearch(payload: { query?: string; offset?: number; limit?: number }): { ok: boolean; items?: any[]; total?: number; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(payload?.query || '').trim();
  const qLower = q.toLowerCase();
  const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
  const cap = Math.max(1, Math.min(500, Math.trunc(Number(payload?.limit) || 200)));
  const like = `%${qLower}%`;

  const today = toIsoDateOnly(new Date());
  const soon = toIsoDateOnly(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const tab = String((payload as any)?.tab || '').trim();

  const tabWhere = () => {
    // NOTE: Tabs are in UI hash: active|expiring|expired|terminated|archived.
    // Keep best-effort alignment with existing logic.
    if (tab === 'archived') return { sql: 'COALESCE(CAST(c.isArchived AS INTEGER), 0) = 1', args: [] as any[] };

    // Default: exclude archived
    const base = { sql: '(c.isArchived IS NULL OR COALESCE(CAST(c.isArchived AS INTEGER), 0) = 0)', args: [] as any[] };
    if (tab === 'active') {
      return {
        sql: `${base.sql} AND TRIM(COALESCE(c.status, '')) IN ('نشط', 'مجدد') AND (c.endDate IS NULL OR c.endDate = '' OR c.endDate >= ?)` ,
        args: [today],
      };
    }
    if (tab === 'expiring') {
      return {
        sql: `${base.sql} AND (
          TRIM(COALESCE(c.status, '')) = 'قريب الانتهاء'
          OR (
            c.endDate IS NOT NULL AND c.endDate <> ''
            AND c.endDate >= ? AND c.endDate <= ?
            AND TRIM(COALESCE(c.status, '')) NOT IN ('منتهي', 'مفسوخ', 'ملغي')
          )
        )`,
        args: [today, soon],
      };
    }
    if (tab === 'expired') {
      return {
        sql: `${base.sql} AND (
          TRIM(COALESCE(c.status, '')) = 'منتهي'
          OR (
            c.endDate IS NOT NULL AND c.endDate <> ''
            AND c.endDate < ?
            AND TRIM(COALESCE(c.status, '')) NOT IN ('مفسوخ', 'ملغي')
          )
        )`,
        args: [today],
      };
    }
    if (tab === 'terminated') {
      return { sql: `${base.sql} AND TRIM(COALESCE(c.status, '')) IN ('مفسوخ', 'ملغي')`, args: [] as any[] };
    }

    // all / unknown
    return base;
  };

  try {
    const tabClause = tabWhere();
    const searchSql = q
      ? `(
          lower(COALESCE(c.id, '')) LIKE ?
          OR lower(COALESCE(pr.internalCode, '')) LIKE ?
          OR lower(COALESCE(owner.name, '')) LIKE ?
          OR lower(COALESCE(tenant.name, '')) LIKE ?
          OR lower(COALESCE(owner.nationalId, '')) LIKE ?
          OR lower(COALESCE(tenant.nationalId, '')) LIKE ?
        )`
      : '';

    const whereParts: string[] = [];
    const whereArgs: any[] = [];
    if (tabClause.sql) {
      whereParts.push(tabClause.sql);
      whereArgs.push(...tabClause.args);
    }
    if (searchSql) {
      whereParts.push(searchSql);
      whereArgs.push(like, like, like, like, like, like);
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
      .get(...whereArgs) as any;

    const total = Number(count?.cnt || 0) || 0;

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
        ORDER BY COALESCE(c.endDate, '') DESC, c.id DESC
        LIMIT ? OFFSET ?
      `
      )
      .all(...whereArgs, cap, offset) as any[];

    const items = rows
      .map((r) => {
        let contract: any = null;
        try {
          contract = JSON.parse(String(r?.contractData || 'null'));
        } catch {
          contract = null;
        }
        if (!contract) return null;
        return {
          contract,
          propertyCode: String(r?.propertyCode || ''),
          ownerName: String(r?.ownerName || ''),
          tenantName: String(r?.tenantName || ''),
          ownerNationalId: String(r?.ownerNationalId || ''),
          tenantNationalId: String(r?.tenantNationalId || ''),
          remainingAmount: Number(r?.remainingAmount ?? 0) || 0,
        };
      })
      .filter(Boolean);

    return { ok: true, items, total };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل البحث عن العقود' };
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
  offset?: number;
  limit?: number;
}): { ok: boolean; items?: any[]; total?: number; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(payload?.query || '').trim();
  const qLower = q.toLowerCase();
  const role = String(payload?.role || '').trim();
  const onlyIdleOwners = !!payload?.onlyIdleOwners;
  const address = String(payload?.address || '').trim();
  const addressLower = address.toLowerCase();
  const nationalIdFilter = String(payload?.nationalId || '').trim();
  const classification = String(payload?.classification || '').trim();
  const minRating = Number(payload?.minRating ?? 0) || 0;
  const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
  const cap = Math.max(1, Math.min(200, Math.trunc(Number(payload?.limit) || 48)));
  const like = `%${qLower}%`;
  const addressLike = `%${addressLower}%`;
  const nidLike = `%${nationalIdFilter}%`;
  const today = toIsoDateOnly(new Date());

  try {
    const whereParts: string[] = [];
    const args: any[] = [];

    if (q) {
      whereParts.push(
        "(lower(COALESCE(pe.name,'')) LIKE ? OR COALESCE(pe.phone,'') LIKE ? OR COALESCE(pe.nationalId,'') LIKE ? OR COALESCE(JSON_EXTRACT(pe.data, '$.رقم_هاتف_اضافي'), '') LIKE ?)"
      );
      args.push(like, q, q, q);
    }

    if (addressLower) {
      whereParts.push("lower(COALESCE(JSON_EXTRACT(pe.data, '$.العنوان'), '')) LIKE ?");
      args.push(addressLike);
    }

    if (nationalIdFilter) {
      whereParts.push("COALESCE(pe.nationalId,'') LIKE ?");
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
        whereParts.push('EXISTS (SELECT 1 FROM blacklist bl WHERE bl.personId = pe.id AND COALESCE(bl.isActive, 1) = 1)');
      } else {
        whereParts.push('EXISTS (SELECT 1 FROM person_roles pr WHERE pr.personId = pe.id AND pr.role = ?)');
        args.push(role);
      }
    }

    if (onlyIdleOwners && role === 'مالك') {
      // Owners whose properties are all vacant (no rented property).
      whereParts.push(
        "NOT EXISTS (SELECT 1 FROM properties pr WHERE pr.ownerId = pe.id AND (COALESCE(pr.isRented,0) = 1 OR COALESCE(pr.status,'') = 'مؤجر'))"
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
          (SELECT GROUP_CONCAT(role, ' | ') FROM person_roles pr WHERE pr.personId = pe.id) AS rolesCsv,
          EXISTS (SELECT 1 FROM blacklist bl WHERE bl.personId = pe.id AND COALESCE(bl.isActive, 1) = 1) AS isBlacklisted,
          (
            SELECT c.id
            FROM contracts c
            WHERE c.tenantId = pe.id
              AND (c.isArchived IS NULL OR c.isArchived = 0)
              AND (
                c.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
                OR (
                  c.endDate IS NOT NULL
                  AND c.endDate >= ?
                  AND COALESCE(c.status, '') NOT IN ('منتهي', 'مفسوخ', 'ملغي')
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
                c.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
                OR (
                  c.endDate IS NOT NULL
                  AND c.endDate >= ?
                  AND COALESCE(c.status, '') NOT IN ('منتهي', 'مفسوخ', 'ملغي')
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
                c.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
                OR (
                  c.endDate IS NOT NULL
                  AND c.endDate >= ?
                  AND COALESCE(c.status, '') NOT IN ('منتهي', 'مفسوخ', 'ملغي')
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
      ORDER BY COALESCE(JSON_EXTRACT(b.personData, '$.الاسم'), b.personName, '') ASC
      LIMIT ? OFFSET ?
    `;

    const total = Number((dbh.prepare(countSql).get(...args) as any)?.cnt || 0) || 0;
    const rows = dbh.prepare(sql).all(today, today, today, ...args, cap, offset) as any[];
    const items = rows
      .map((r) => {
        let person: any = null;
        try {
          person = JSON.parse(String(r?.personData || 'null'));
        } catch {
          person = null;
        }
        if (!person) return null;
        const rolesCsv = String(r?.rolesCsv || '').trim();
        const roles = rolesCsv ? rolesCsv.split(' | ').map((x) => x.trim()).filter(Boolean) : [];
        const pickCid = String(r?.pickCid || '').trim();
        const pickSource = String(r?.pickSource || '').trim();
        return {
          person,
          roles,
          isBlacklisted: !!r?.isBlacklisted,
          link: pickCid
            ? {
                contractId: pickCid,
                status: String(r?.contractStatus || ''),
                propertyCode: String(r?.propertyCode || ''),
                tenantName: String(r?.tenantName || ''),
                guarantorName: String(r?.guarantorName || ''),
                source: pickSource,
              }
            : null,
        };
      })
      .filter(Boolean);

    return { ok: true, items, total };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل البحث عن الأشخاص' };
  }
}

export function domainInstallmentsContractsSearch(payload: {
  query?: string;
  filter?: 'all' | 'debt' | 'paid' | 'due' | string;
  offset?: number;
  limit?: number;
}): { ok: boolean; items?: any[]; total?: number; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const q = String(payload?.query || '').trim();
  const qLower = q.toLowerCase();
  const filter = String(payload?.filter || 'all').trim() as 'all' | 'debt' | 'paid' | 'due' | string;
  const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
  const cap = Math.max(1, Math.min(100, Math.trunc(Number(payload?.limit) || 20)));

  const today = toIsoDateOnly(new Date());
  const like = `%${qLower}%`;

  try {
    const whereParts: string[] = [];
    const args: any[] = [];

    // Tenancy-relevant contracts (mirror isTenancyRelevant-ish behavior)
    whereParts.push(
      `(
        (c.isArchived IS NULL OR c.isArchived = 0)
        AND (
          c.status IN ('نشط', 'قريب الانتهاء', 'مجدد')
          OR (
            c.endDate IS NOT NULL
            AND c.endDate >= ?
            AND COALESCE(c.status, '') NOT IN ('منتهي', 'مفسوخ', 'ملغي')
          )
        )
      )`
    );
    args.push(today);

    if (q) {
      whereParts.push(
        `(lower(COALESCE(t.name,'')) LIKE ? OR lower(COALESCE(p.internalCode,'')) LIKE ? OR COALESCE(c.id,'') LIKE ?)`
      );
      args.push(like, like, like);
    }

    const baseWhereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const debtExpr = `EXISTS (
      SELECT 1 FROM installments i
      WHERE i.contractId = c.id
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND COALESCE(i.type,'') <> 'تأمين'
        AND COALESCE(i.status,'') <> 'ملغي'
        AND COALESCE(i.remaining,0) > 0
        AND i.dueDate IS NOT NULL
        AND i.dueDate <= ?
    )`;

    const dueSoonExpr = `EXISTS (
      SELECT 1 FROM installments i
      WHERE i.contractId = c.id
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND COALESCE(i.type,'') <> 'تأمين'
        AND COALESCE(i.status,'') <> 'ملغي'
        AND COALESCE(i.remaining,0) > 0
        AND i.dueDate IS NOT NULL
        AND i.dueDate > ?
        AND i.dueDate <= date(?, '+7 day')
    )`;

    const anyRelevantExpr = `EXISTS (
      SELECT 1 FROM installments i
      WHERE i.contractId = c.id
        AND (i.isArchived IS NULL OR i.isArchived = 0)
        AND COALESCE(i.type,'') <> 'تأمين'
        AND COALESCE(i.status,'') <> 'ملغي'
    )`;

    const fullyPaidExpr = `(
      ${anyRelevantExpr}
      AND NOT EXISTS (
        SELECT 1 FROM installments i
        WHERE i.contractId = c.id
          AND (i.isArchived IS NULL OR i.isArchived = 0)
          AND COALESCE(i.type,'') <> 'تأمين'
          AND COALESCE(i.status,'') <> 'ملغي'
          AND COALESCE(i.remaining,0) > 0
      )
    )`;

    const filterWhereParts: string[] = [];
    const filterArgs: any[] = [];
    if (filter === 'debt') {
      filterWhereParts.push('hasDebt = 1');
    } else if (filter === 'due') {
      filterWhereParts.push('hasDueSoon = 1');
    } else if (filter === 'paid') {
      filterWhereParts.push('isFullyPaid = 1');
    }
    const filterWhereSql = filterWhereParts.length ? `WHERE ${filterWhereParts.join(' AND ')}` : '';

    const cteSql = `
      WITH base AS (
        SELECT
          c.id AS contractId,
          c.data AS contractData,
          t.data AS tenantData,
          p.data AS propertyData,
          ${debtExpr} AS hasDebt,
          ${dueSoonExpr} AS hasDueSoon,
          ${fullyPaidExpr} AS isFullyPaid
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
      ORDER BY lower(COALESCE(JSON_EXTRACT(tenantData, '$.الاسم'), '')) ASC, contractId ASC
      LIMIT ? OFFSET ?;
    `;

    // Order of args:
    // baseWhere: [today] + optional search like params
    // then expressions: debt(today), dueSoon(today,today)
    const total = Number(
      (dbh.prepare(countSql).get(...args, today, today, today, ...filterArgs) as any)?.cnt || 0
    ) || 0;

    const rows = dbh.prepare(listSql).all(...args, today, today, today, ...filterArgs, cap, offset) as any[];
    if (!rows.length) return { ok: true, items: [], total };

    const contractIds = rows.map((r) => String(r?.contractId || '')).filter(Boolean);
    const placeholders = contractIds.map(() => '?').join(',');
    const instRows = (dbh
      .prepare(
        `
        SELECT contractId, data
        FROM installments
        WHERE contractId IN (${placeholders})
          AND (isArchived IS NULL OR isArchived = 0)
        ORDER BY COALESCE(dueDate, '') ASC, id ASC
      `
      )
      .all(...contractIds) as Array<{ contractId: string; data: string }>);

    const instByContract = new Map<string, any[]>();
    for (const r of instRows) {
      let inst: any = null;
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
      .map((r) => {
        let contract: any = null;
        let tenant: any = null;
        let property: any = null;
        try {
          contract = JSON.parse(String(r?.contractData || 'null'));
        } catch {
          contract = null;
        }
        try {
          tenant = JSON.parse(String(r?.tenantData || 'null'));
        } catch {
          tenant = null;
        }
        try {
          property = JSON.parse(String(r?.propertyData || 'null'));
        } catch {
          property = null;
        }
        if (!contract) return null;

        const cid = String(r?.contractId || '').trim();
        const installments = instByContract.get(cid) || [];
        return {
          contract,
          tenant,
          property,
          installments,
          hasDebt: !!r?.hasDebt,
          hasDueSoon: !!r?.hasDueSoon,
          isFullyPaid: !!r?.isFullyPaid,
        };
      })
      .filter(Boolean);

    return { ok: true, items, total };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل تحميل بيانات الأقساط' };
  }
}

export function domainDashboardSummary(payload: {
  todayYMD: string;
  weekYMD: string;
}): {
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
    return { ok: false, message: 'تواريخ غير صالحة' };
  }

  try {
    const totalPeople = Number((dbh.prepare('SELECT COUNT(*) AS c FROM people').get() as any)?.c || 0);
    const totalProperties = Number((dbh.prepare('SELECT COUNT(*) AS c FROM properties').get() as any)?.c || 0);
    const occupiedProperties = Number((dbh.prepare('SELECT COUNT(*) AS c FROM properties WHERE COALESCE(isRented, 0) = 1').get() as any)?.c || 0);
    const totalContracts = Number((dbh.prepare('SELECT COUNT(*) AS c FROM contracts').get() as any)?.c || 0);

    const activeContracts = Number(
      (
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM contracts
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND status IN ('نشط', 'قريب الانتهاء', 'مجدد')`
          )
          .get() as any
      )?.c || 0
    );

    const dueNext7Payments = Number(
      (
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
          .get(todayYMD, weekYMD) as any
      )?.c || 0
    );

    const paymentsToday = Number(
      (
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM installments
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(status, '') = 'مدفوع'
               AND COALESCE(dueDate, '') = ?`
          )
          .get(todayYMD) as any
      )?.c || 0
    );

    const revenueToday = Number(
      (
        dbh
          .prepare(
            `SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) AS s
             FROM installments
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(status, '') = 'مدفوع'
               AND COALESCE(dueDate, '') = ?`
          )
          .get(todayYMD) as any
      )?.s || 0
    );

    const contractsExpiring30 = Number(
      (
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM contracts
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(endDate, '') > ?
               AND COALESCE(endDate, '') <= date(?, '+30 day')`
          )
          .get(todayYMD, todayYMD) as any
      )?.c || 0
    );

    const maintenanceOpen = Number(
      (
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM maintenance_tickets
             WHERE COALESCE(status, '') IN ('مفتوح', 'قيد التنفيذ')`
          )
          .get() as any
      )?.c || 0
    );

    const propertyTypeCounts = (dbh
      .prepare(
        `SELECT COALESCE(type, 'غير محدد') AS name, COUNT(*) AS value
         FROM properties
         GROUP BY COALESCE(type, 'غير محدد')
         ORDER BY value DESC, name ASC`
      )
      .all() as Array<{ name: string; value: number }>);

    const contractStatusCounts = (dbh
      .prepare(
        `SELECT COALESCE(status, 'غير محدد') AS name, COUNT(*) AS value
         FROM contracts
         GROUP BY COALESCE(status, 'غير محدد')
         ORDER BY value DESC, name ASC`
      )
      .all() as Array<{ name: string; value: number }>);

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
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل إنشاء ملخص لوحة التحكم' };
  }
}

export function domainDashboardPerformance(payload: {
  monthKey: string;
  prevMonthKey: string;
}): {
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
    return { ok: false, message: 'شهر غير صالح' };
  }

  try {
    const sumPaidForMonth = (m: string) =>
      Number(
        (
          dbh
            .prepare(
              `SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) AS s
               FROM installments
               WHERE (isArchived IS NULL OR isArchived = 0)
                 AND COALESCE(status, '') = 'مدفوع'
                 AND SUBSTR(COALESCE(paidAt, dueDate, ''), 1, 7) = ?`
            )
            .get(m) as any
        )?.s || 0
      );

    const currentMonthCollections = sumPaidForMonth(monthKey);
    const previousMonthCollections = sumPaidForMonth(prevMonthKey);

    const paidCountThisMonth = Number(
      (
        dbh
          .prepare(
            `SELECT COUNT(*) AS c
             FROM installments
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(status, '') = 'مدفوع'
               AND SUBSTR(COALESCE(paidAt, dueDate, ''), 1, 7) = ?`
          )
          .get(monthKey) as any
      )?.c || 0
    );

    const dueUnpaidThisMonth = Number(
      (
        dbh
          .prepare(
            `SELECT COALESCE(SUM(COALESCE(remaining, amount, 0)), 0) AS s
             FROM installments
             WHERE (isArchived IS NULL OR isArchived = 0)
               AND COALESCE(status, '') != 'مدفوع'
               AND SUBSTR(COALESCE(dueDate, ''), 1, 7) = ?`
          )
          .get(monthKey) as any
      )?.s || 0
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
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل حساب الأداء المالي' };
  }
}

export function domainDashboardHighlights(payload: {
  todayYMD: string;
}): {
  ok: boolean;
  message?: string;
  data?: {
    dueInstallmentsToday: Array<{ contractId: string; tenantName: string; dueDate: string; remaining: number }>;
    expiringContracts: Array<{ contractId: string; propertyId: string; propertyCode: string; tenantId: string; tenantName: string; endDate: string }>;
    incompleteProperties: Array<{ propertyId: string; propertyCode: string; missingWater: boolean; missingElectric: boolean; missingArea: boolean }>;
  };
} {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  const todayYMD = String(payload?.todayYMD || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayYMD)) {
    return { ok: false, message: 'تاريخ غير صالح' };
  }

  try {
    const dueInstallmentsToday = (dbh
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
      .all(todayYMD) as Array<{ contractId: string; tenantName: string; dueDate: string; remaining: number }>);

    // Tenancy-relevant: status or endDate in future and not ended/canceled.
    const expiringContracts = (dbh
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
    }>);

    // Incomplete property fields - read from JSON snapshot for compatibility.
    const incompleteProperties = (dbh
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
      .all() as Array<{ propertyId: string; propertyCode: string; missingWater: number; missingElectric: number; missingArea: number }>);

    return {
      ok: true,
      data: {
        dueInstallmentsToday: dueInstallmentsToday.map((r) => ({
          contractId: String((r as any)?.contractId || '').trim(),
          tenantName: String((r as any)?.tenantName || '').trim(),
          dueDate: String((r as any)?.dueDate || '').trim(),
          remaining: Number((r as any)?.remaining || 0) || 0,
        })),
        expiringContracts: expiringContracts.map((r) => ({
          contractId: String((r as any)?.contractId || '').trim(),
          propertyId: String((r as any)?.propertyId || '').trim(),
          propertyCode: String((r as any)?.propertyCode || '').trim(),
          tenantId: String((r as any)?.tenantId || '').trim(),
          tenantName: String((r as any)?.tenantName || '').trim(),
          endDate: String((r as any)?.endDate || '').trim(),
        })),
        incompleteProperties: incompleteProperties.map((r) => ({
          propertyId: String((r as any)?.propertyId || '').trim(),
          propertyCode: String((r as any)?.propertyCode || '').trim(),
          missingWater: !!(r as any)?.missingWater,
          missingElectric: !!(r as any)?.missingElectric,
          missingArea: !!(r as any)?.missingArea,
        })),
      },
    };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل تحميل مؤشرات لوحة التحكم' };
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
    return { ok: false, message: 'تاريخ غير صالح' };
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

    const rows = (dbh
      .prepare(
        `
        SELECT
          c.id AS contractId,
          COALESCE(c.tenantId, '') AS tenantId,
          COALESCE(c.propertyId, '') AS propertyId,
          COALESCE(JSON_EXTRACT(c.data, '$.طريقة_الدفع'), '') AS paymentPlanRaw,
          COALESCE(CAST(JSON_EXTRACT(c.data, '$.تكرار_الدفع') AS INTEGER), 0) AS paymentFrequency,
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
      .all(todayYMD, todayYMD, todayYMD, daysAhead) as Array<any>);

    const byContract = new Map<string, any>();
    for (const r of rows) {
      const contractId = String(r?.contractId || '').trim();
      if (!contractId) continue;
      const key = contractId;
      let target = byContract.get(contractId);
      if (!target) {
        target = {
          key,
          tenantId: String(r?.tenantId || '').trim() || undefined,
          tenantName: String(r?.tenantName || '').trim() || 'مستأجر',
          phone: String(r?.phone || '').trim() || undefined,
          extraPhone: String(r?.extraPhone || '').trim() || undefined,
          contractId,
          propertyId: String(r?.propertyId || '').trim() || undefined,
          propertyCode: String(r?.propertyCode || '').trim() || undefined,
          paymentPlanRaw: String(r?.paymentPlanRaw || '').trim() || undefined,
          paymentFrequency: Number(r?.paymentFrequency || 0) || 0,
          items: [] as any[],
        };
        byContract.set(contractId, target);
      }

      const dueDate = String(r?.dueDate || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) continue;
      const daysUntilDue = Number(r?.daysUntilDue ?? 0) || 0;

      const bucket: 'overdue' | 'today' | 'upcoming' = daysUntilDue < 0 ? 'overdue' : daysUntilDue === 0 ? 'today' : 'upcoming';
      if (bucket === 'upcoming' && daysUntilDue > daysAhead) continue;

      target.items.push({
        installmentId: String(r?.installmentId || '').trim(),
        contractId,
        dueDate,
        amountRemaining: Number(r?.amountRemaining || 0) || 0,
        daysUntilDue,
        bucket,
      });
    }

    const items = Array.from(byContract.values()).map((t) => ({
      ...t,
      items: Array.isArray(t.items) ? t.items.sort((a: any, b: any) => String(a.dueDate).localeCompare(String(b.dueDate))) : [],
    }));

    return { ok: true, items };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل تحميل أهداف إشعارات الدفعات' };
  }
}

export function domainCounts(): { ok: boolean; counts?: { people: number; properties: number; contracts: number }; message?: string } {
  const dbh = getDb();
  ensureDomainSchema(dbh);
  const ready = domainEnsureReady();
  if (!ready.ok) return { ok: false, message: ready.message };

  try {
    const people = Number((dbh.prepare('SELECT COUNT(1) AS cnt FROM people').get() as any)?.cnt || 0) || 0;
    const properties = Number((dbh.prepare('SELECT COUNT(1) AS cnt FROM properties').get() as any)?.cnt || 0) || 0;
    const contracts = Number((dbh.prepare('SELECT COUNT(1) AS cnt FROM contracts').get() as any)?.cnt || 0) || 0;
    return { ok: true, counts: { people, properties, contracts } };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل قراءة الأعداد' };
  }
}

function safeJsonParseArray(value: string | null): any[] {
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
  return ts && ts.trim() ? ts.trim() : new Date().toISOString();
}

function isKvNewerThanDomain(dbh: SqliteDb, key: string): boolean {
  const kvTs = kvUpdatedAtIso(key);
  const stored = metaGet(dbh, `domain_src_updatedAt:${key}`) || '';
  if (!stored) return true;
  return new Date(kvTs).getTime() > new Date(stored).getTime();
}

function toIsoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeInstallmentAmounts(inst: any): { amount: number; paid: number; remaining: number } {
  const amount = Number(inst?.القيمة ?? 0) || 0;

  const remainingRaw = inst?.القيمة_المتبقية;
  const remainingFromField = Number.isFinite(Number(remainingRaw)) ? Number(remainingRaw) : NaN;

  let paid = 0;
  const payments = inst?.سجل_الدفعات;
  if (Array.isArray(payments)) {
    for (const p of payments) paid += Number(p?.المبلغ ?? 0) || 0;
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
  const insertRole = dbh.prepare('INSERT OR IGNORE INTO person_roles (personId, role) VALUES (?, ?)');
  const upsertBlacklist = dbh.prepare(
    'INSERT INTO blacklist (personId, isActive, data, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(personId) DO UPDATE SET isActive=excluded.isActive, data=excluded.data, updatedAt=excluded.updatedAt'
  );
  const upsertProperty = dbh.prepare(
    'INSERT INTO properties (id, internalCode, ownerId, type, status, address, city, area, isRented, isForSale, salePrice, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET internalCode=excluded.internalCode, ownerId=excluded.ownerId, type=excluded.type, status=excluded.status, address=excluded.address, city=excluded.city, area=excluded.area, isRented=excluded.isRented, isForSale=excluded.isForSale, salePrice=excluded.salePrice, data=excluded.data, updatedAt=excluded.updatedAt'
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
    dbh.exec('DELETE FROM people; DELETE FROM person_roles; DELETE FROM blacklist; DELETE FROM properties; DELETE FROM contracts; DELETE FROM installments; DELETE FROM maintenance_tickets;');

    for (const p of people) {
      const id = String(p?.رقم_الشخص ?? '').trim();
      if (!id) continue;
      upsertPeople.run(id, String(p?.الاسم ?? ''), p?.الرقم_الوطني ? String(p.الرقم_الوطني) : null, p?.رقم_الهاتف ? String(p.رقم_الهاتف) : null, JSON.stringify(p), nowIso);
    }
    counts.people = people.length;

    for (const r of roles) {
      const personId = String(r?.رقم_الشخص ?? '').trim();
      const role = String(r?.الدور ?? '').trim();
      if (!personId || !role) continue;
      insertRole.run(personId, role);
    }
    counts.roles = roles.length;

    for (const b of blacklist) {
      const personId = String(b?.personId ?? '').trim();
      if (!personId) continue;
      const isActive = (b as any)?.isActive === false ? 0 : 1;
      upsertBlacklist.run(personId, isActive, JSON.stringify(b), nowIso);
    }
    counts.blacklist = blacklist.length;

    for (const pr of properties) {
      const id = String(pr?.رقم_العقار ?? '').trim();
      if (!id) continue;
      upsertProperty.run(
        id,
        pr?.الكود_الداخلي ? String(pr.الكود_الداخلي) : null,
        pr?.رقم_المالك ? String(pr.رقم_المالك) : null,
        pr?.النوع ? String(pr.النوع) : null,
        pr?.حالة_العقار ? String(pr.حالة_العقار) : null,
        pr?.العنوان ? String(pr.العنوان) : null,
        pr?.المدينة ? String(pr.المدينة) : null,
        pr?.المنطقة ? String(pr.المنطقة) : null,
        pr?.IsRented ? 1 : 0,
        (pr as any)?.isForSale ? 1 : 0,
        Number((pr as any)?.salePrice ?? 0) || null,
        JSON.stringify(pr),
        nowIso
      );
    }
    counts.properties = properties.length;

    for (const c of contracts) {
      const id = String(c?.رقم_العقد ?? '').trim();
      if (!id) continue;
      upsertContract.run(
        id,
        c?.رقم_العقار ? String(c.رقم_العقار) : null,
        c?.رقم_المستاجر ? String(c.رقم_المستاجر) : null,
        c?.رقم_الكفيل ? String(c.رقم_الكفيل) : null,
        c?.حالة_العقد ? String(c.حالة_العقد) : null,
        c?.تاريخ_البداية ? String(c.تاريخ_البداية) : null,
        c?.تاريخ_النهاية ? String(c.تاريخ_النهاية) : null,
        Number(c?.القيمة_السنوية ?? 0) || 0,
        Number(c?.تكرار_الدفع ?? 0) || 0,
        c?.طريقة_الدفع ? String(c.طريقة_الدفع) : null,
        (c as any)?.isArchived ? 1 : 0,
        JSON.stringify(c),
        nowIso
      );
    }
    counts.contracts = contracts.length;

    for (const inst of installments) {
      const id = String(inst?.رقم_الكمبيالة ?? '').trim();
      if (!id) continue;
      const { amount, paid, remaining } = computeInstallmentAmounts(inst);
      upsertInstallment.run(
        id,
        inst?.رقم_العقد ? String(inst.رقم_العقد) : null,
        inst?.تاريخ_استحقاق ? String(inst.تاريخ_استحقاق) : null,
        amount,
        paid,
        remaining,
        inst?.حالة_الكمبيالة ? String(inst.حالة_الكمبيالة) : null,
        inst?.نوع_الكمبيالة ? String(inst.نوع_الكمبيالة) : null,
        (inst as any)?.isArchived ? 1 : 0,
        inst?.تاريخ_الدفع ? String(inst.تاريخ_الدفع) : null,
        JSON.stringify(inst),
        nowIso
      );
    }
    counts.installments = installments.length;

    for (const t of maintenance) {
      const id = String(t?.رقم_التذكرة ?? '').trim();
      if (!id) continue;
      upsertTicket.run(
        id,
        t?.رقم_العقار ? String(t.رقم_العقار) : null,
        t?.رقم_المستاجر ? String(t.رقم_المستاجر) : null,
        t?.تاريخ_الطلب ? String(t.تاريخ_الطلب) : null,
        t?.الحالة ? String(t.الحالة) : null,
        t?.الأولوية ? String(t.الأولوية) : null,
        t?.الوصف ? String(t.الوصف) : null,
        t?.تاريخ_الإغلاق ? String(t.تاريخ_الإغلاق) : null,
        JSON.stringify(t),
        nowIso
      );
    }
    counts.maintenance = maintenance.length;
  });

  try {
    tx();
    metaSet(dbh, 'domain_migrated_at', nowIso);
    // Record KV updatedAt so we can detect staleness.
    metaSet(dbh, `domain_src_updatedAt:${keys.people}`, kvUpdatedAtIso(keys.people));
    metaSet(dbh, `domain_src_updatedAt:${keys.properties}`, kvUpdatedAtIso(keys.properties));
    metaSet(dbh, `domain_src_updatedAt:${keys.contracts}`, kvUpdatedAtIso(keys.contracts));
    metaSet(dbh, `domain_src_updatedAt:${keys.installments}`, kvUpdatedAtIso(keys.installments));
    metaSet(dbh, `domain_src_updatedAt:${keys.maintenance}`, kvUpdatedAtIso(keys.maintenance));
    metaSet(dbh, `domain_src_updatedAt:${keys.roles}`, kvUpdatedAtIso(keys.roles));
    metaSet(dbh, `domain_src_updatedAt:${keys.blacklist}`, kvUpdatedAtIso(keys.blacklist));
    return { ok: true, message: 'تمت تهيئة جداول التقارير بنجاح', migrated: true, counts };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل ترحيل البيانات إلى الجداول', migrated: false };
  }
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
  const generatedAt = new Date().toLocaleString('ar-JO', { dateStyle: 'full', timeStyle: 'short' });
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
        .get(today, today) as any;

      const totalExpected = Number(row?.totalExpected ?? 0) || 0;
      const totalPaid = Number(row?.totalPaid ?? 0) || 0;
      const totalLate = Number(row?.totalLate ?? 0) || 0;
      const totalUpcoming = Number(row?.totalUpcoming ?? 0) || 0;

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
            { label: 'نسبة التحصيل', value: `${totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0}%` },
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
        .all(today, today, cap) as any[];

      const data = rows.map((r) => ({
        tenant: r.tenant,
        property: r.property,
        dueDate: r.dueDate,
        amount: Number(r.amount ?? 0) || 0,
        daysLate: `${Number(r.daysLate ?? 0) || 0} يوم`,
        status: r.status,
      }));

      const summary: Array<{ label: string; value: string | number }> = [{ label: 'عدد النتائج المعروضة', value: data.length }];
      if (data.length >= cap) summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

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
        .all(cap) as any[];

      const data = rows.map((r) => ({
        contractNo: r.contractNo,
        tenant: r.tenant,
        property: r.property,
        startDate: r.startDate,
        endDate: r.endDate,
        monthlyRent: Number(r.monthlyRent ?? 0) || 0,
        status: r.status,
      }));

      const totalMonthly = data.reduce((s, r) => s + (Number((r as any).monthlyRent) || 0), 0);
      const summary = [
        { label: 'عدد العقود النشطة', value: data.length },
        { label: 'إجمالي الإيرادات الشهرية', value: `${Math.round(totalMonthly).toLocaleString('ar-JO')} د.أ` },
      ];
      if (data.length >= cap) summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

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
        .all(cap) as any[];

      const data = rows.map((r) => ({
        ticketNo: r.ticketNo,
        property: r.property,
        tenant: r.tenant,
        issue: r.issue,
        priority: r.priority,
        status: r.status,
        createdDate: r.createdDate,
      }));

      const high = data.filter((d) => String((d as any).priority) === 'عالية').length;
      const summary: Array<{ label: string; value: string | number }> = [
        { label: 'عدد الطلبات المفتوحة', value: data.length },
        { label: 'طلبات عالية الأولوية', value: high },
      ];
      if (data.length >= cap) summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

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
        .all(today, today, todayPlus30, cap) as any[];

      const data = rows.map((r) => ({
        contractNo: r.contractNo,
        tenant: r.tenant,
        property: r.property,
        endDate: r.endDate,
        daysRemaining: `${Number(r.daysRemaining ?? 0) || 0} يوم`,
        monthlyRent: Number(r.monthlyRent ?? 0) || 0,
      }));

      const summary: Array<{ label: string; value: string | number }> = [{ label: 'عدد العقود', value: data.length }];
      if (data.length >= cap) summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

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
        .all(cap) as any[];

      const data = rows.map((r) => ({
        code: r.code,
        type: r.type,
        area: r.areaNum ? `${Number(r.areaNum)} م²` : '-',
        floor: String(r.floor ?? '-') || '-',
        rooms: String(r.rooms ?? '-') || '-',
        owner: r.owner,
        location: String(r.location ?? '-') || '-',
      }));

      const summary: Array<{ label: string; value: string | number }> = [{ label: 'عدد العقارات الشاغرة', value: data.length }];
      if (data.length >= cap) summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

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
        .all(cap) as any[];

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

      const summary: Array<{ label: string; value: string | number }> = [{ label: 'عقارات تحتاج تحديث', value: data.length }];
      if (data.length >= cap) summary.unshift({ label: 'ملاحظة', value: `تم عرض أول ${cap} نتيجة فقط` });

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
  } catch (e: any) {
    return { ok: false, message: e?.message || 'فشل توليد التقرير' };
  }
}

export function kvGet(key: string): string | null {
  const row = getDb().prepare('SELECT v FROM kv WHERE k = ?').get(key) as { v: string } | undefined;
  return row?.v ?? null;
}

export function kvGetMeta(key: string): { value: string; updatedAt: string } | null {
  const row = getDb().prepare('SELECT v, updatedAt FROM kv WHERE k = ?').get(key) as { v: string; updatedAt: string } | undefined;
  if (!row) return null;
  return { value: row.v, updatedAt: row.updatedAt };
}

export function kvGetDeletedAt(key: string): string | null {
  const row = getDb().prepare('SELECT deletedAt FROM kv_deleted WHERE k = ?').get(key) as { deletedAt: string } | undefined;
  return row?.deletedAt ?? null;
}

export function kvSet(key: string, value: string): void {
  // Any write cancels a pending deletion marker.
  getDb().prepare('DELETE FROM kv_deleted WHERE k = ?').run(key);
  getDb()
    .prepare('INSERT INTO kv (k, v, updatedAt) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updatedAt=excluded.updatedAt')
    .run(key, value, new Date().toISOString());
}

export function kvSetWithUpdatedAt(key: string, value: string, updatedAtIso: string): void {
  getDb().prepare('DELETE FROM kv_deleted WHERE k = ?').run(key);
  getDb()
    .prepare('INSERT INTO kv (k, v, updatedAt) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updatedAt=excluded.updatedAt')
    .run(key, value, updatedAtIso);
}

export function kvDelete(key: string): void {
  getDb().prepare('DELETE FROM kv WHERE k = ?').run(key);
  getDb().prepare('INSERT INTO kv_deleted (k, deletedAt) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET deletedAt=excluded.deletedAt').run(key, new Date().toISOString());
}

export function kvApplyRemoteDelete(key: string, deletedAtIso: string): void {
  getDb().prepare('DELETE FROM kv WHERE k = ?').run(key);
  getDb().prepare('INSERT INTO kv_deleted (k, deletedAt) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET deletedAt=excluded.deletedAt').run(key, deletedAtIso);
}

export function kvKeys(): string[] {
  return getDb().prepare('SELECT k FROM kv ORDER BY k').all().map((r: any) => r.k as string);
}

export function kvListUpdatedSince(sinceIso: string): Array<{ k: string; v: string; updatedAt: string }> {
  const since = sinceIso && String(sinceIso).trim() ? String(sinceIso).trim() : '1970-01-01T00:00:00.000Z';
  const rows = getDb()
    .prepare('SELECT k, v, updatedAt FROM kv WHERE updatedAt > ? ORDER BY updatedAt')
    .all(since) as Array<{ k: string; v: string; updatedAt: string }>;
  return rows || [];
}

export function kvListDeletedSince(sinceIso: string): Array<{ k: string; deletedAt: string }> {
  const since = sinceIso && String(sinceIso).trim() ? String(sinceIso).trim() : '1970-01-01T00:00:00.000Z';
  const rows = getDb()
    .prepare('SELECT k, deletedAt FROM kv_deleted WHERE deletedAt > ? ORDER BY deletedAt')
    .all(since) as Array<{ k: string; deletedAt: string }>;
  return rows || [];
}

export function kvResetAll(prefix = 'db_'): { deleted: number } {
  const stmt = getDb().prepare('DELETE FROM kv WHERE k LIKE ?');
  const res = stmt.run(`${prefix}%`) as any;
  return { deleted: Number(res.changes || 0) };
}

export async function exportDatabase(destinationPath: string): Promise<void> {
  const sourcePath = getDbPath();
  
  // Close DB connection temporarily for safe copy
  if (db) {
    db.close();
    db = null;
  }

  // Copy file
  await fs.copyFile(sourcePath, destinationPath);

  // Reopen DB
  getDb();
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
    // Reopen DB
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

  // Backup current database
  const backupPath = destPath + `.backup-${Date.now()}`;
  try {
    await fs.copyFile(destPath, backupPath);
  } catch {
    // Ignore if no existing DB
  }

  // Copy imported file over current DB
  await fs.copyFile(sourcePath, destPath);

  // Reopen DB
  getDb();
}
