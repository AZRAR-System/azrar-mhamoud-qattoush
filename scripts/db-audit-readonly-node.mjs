#!/usr/bin/env node
/**
 * Read-only SQLite audit runner.
 *
 * Usage:
 *   node scripts/db-audit-readonly-node.mjs "C:\\path\\to\\khaberni.sqlite" > audit.json
 *
 * Notes:
 * - Opens DB with readonly + fileMustExist.
 * - Attempts PRAGMA query_only=ON (best-effort).
 * - Does NOT create/alter/drop anything.
 */

import fsp from 'node:fs/promises';

const nowIso = () => new Date().toISOString();

function pickSamples(rows, max = 5) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, Math.max(0, max));
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function quoteIdent(name) {
  // Double-quote identifier and escape quotes.
  return `"${String(name).replaceAll('"', '""')}"`;
}

function usageAndExit(code) {
  process.stderr.write('Usage: node scripts/db-audit-readonly-node.mjs "<absolute-path-to-sqlite-file>"\n');
  process.stderr.write('Tip: If you omit the path, the script will try AZRAR_DESKTOP_DB_PATH / AZRAR_DESKTOP_DB_DIR / %APPDATA%\\AZRAR\\khaberni.sqlite.\n');
  process.exit(code);
}

function resolveDefaultDbPath() {
  const explicitPath = String(process.env.AZRAR_DESKTOP_DB_PATH ?? '').trim();
  if (explicitPath) return explicitPath;
  const explicitDir = String(process.env.AZRAR_DESKTOP_DB_DIR ?? '').trim();
  if (explicitDir) return `${explicitDir.replace(/[\\/]+$/, '')}\\khaberni.sqlite`;
  const appData = String(process.env.APPDATA ?? '').trim();
  if (appData) return `${appData.replace(/[\\/]+$/, '')}\\AZRAR\\khaberni.sqlite`;
  return '';
}

let dbPath = String(process.argv[2] ?? '').trim();
if (!dbPath) dbPath = resolveDefaultDbPath();
if (!dbPath) usageAndExit(2);

// Load better-sqlite3 in Node runtime (not Electron)
let BetterSqlite3Mod;
try {
  BetterSqlite3Mod = await import('better-sqlite3');
} catch (e) {
  console.error('Failed to import better-sqlite3. Try: npm i && npm rebuild better-sqlite3');
  console.error(String(e?.message ?? e));
  process.exit(1);
}

const BetterSqlite3 = BetterSqlite3Mod.default ?? BetterSqlite3Mod;

const out = {
  ok: true,
  ranAt: nowIso(),
  dbPath,
  file: null,
  pragmas: {},
  tables: [],
  indexes: [],
  foreignKeys: [],
  integrity: {
    quick: {},
    orphans: {},
    duplicates: {},
    nonsensical: {},
    attachments: {},
  },
  notes: [],
};

try {
  const st = await fsp.stat(dbPath);
  out.file = {
    sizeBytes: st.size,
    mtime: st.mtime?.toISOString?.() ?? null,
  };
} catch (e) {
  out.ok = false;
  out.notes.push(`Cannot stat DB file: ${String(e?.message ?? e)}`);
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exit(1);
}

const db = new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true });

try {
  db.pragma('query_only = ON');
} catch {
  out.notes.push('PRAGMA query_only not available; relying on readonly open.');
}

const pragmaSimple = (name) => {
  try {
    // better-sqlite3 returns a primitive with { simple: true } for single-value pragmas
    return db.pragma(name, { simple: true });
  } catch (e) {
    return { error: String(e?.message ?? e) };
  }
};

out.pragmas = {
  application_id: pragmaSimple('application_id'),
  user_version: pragmaSimple('user_version'),
  journal_mode: pragmaSimple('journal_mode'),
  synchronous: pragmaSimple('synchronous'),
  page_size: pragmaSimple('page_size'),
  page_count: pragmaSimple('page_count'),
  freelist_count: pragmaSimple('freelist_count'),
  auto_vacuum: pragmaSimple('auto_vacuum'),
  foreign_keys: pragmaSimple('foreign_keys'),
  wal_autocheckpoint: pragmaSimple('wal_autocheckpoint'),
  cache_size: pragmaSimple('cache_size'),
  temp_store: pragmaSimple('temp_store'),
  mmap_size: pragmaSimple('mmap_size'),
};

const runAll = (sql, params = []) => {
  return db.prepare(sql).all(params);
};

const runGet = (sql, params = []) => {
  return db.prepare(sql).get(params);
};

const runCheck = (label, sql, params = []) => {
  try {
    const rows = db.prepare(sql).all(params);
    return { ok: true, count: rows.length, samples: pickSamples(rows, 5) };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
};

// Tables
const tableRows = runAll(
  "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
);
const tables = tableRows.map((r) => String(r.name));

for (const r of tableRows) {
  const name = String(r.name);
  let rowCount = null;
  try {
    const cnt = runGet(`SELECT COUNT(1) AS cnt FROM ${quoteIdent(name)}`);
    rowCount = Number(cnt?.cnt ?? 0) || 0;
  } catch (e) {
    out.notes.push(`Count failed for table ${name}: ${String(e?.message ?? e)}`);
  }
  out.tables.push({ name, rowCount, ddl: r.sql ?? null });
}

// Indexes
try {
  out.indexes = runAll(
    "SELECT name, tbl_name AS tableName, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name"
  );
} catch (e) {
  out.notes.push(`Index list failed: ${String(e?.message ?? e)}`);
}

// Foreign keys (declared)
try {
  for (const t of tables) {
    const fks = db.pragma(`foreign_key_list(${quoteIdent(t)})`);
    if (Array.isArray(fks) && fks.length) {
      for (const fk of fks) {
        out.foreignKeys.push({ table: t, ...fk });
      }
    }
  }
} catch (e) {
  out.notes.push(`FK list failed: ${String(e?.message ?? e)}`);
}

// Built-in integrity (read-only)
out.integrity.quick.integrity_check = (() => {
  try {
    // Returns rows with a single column 'integrity_check'
    const rows = db.pragma('integrity_check');
    const first = rows?.[0];
    const ok = first && Object.values(first)[0] === 'ok';
    return { ok: true, result: ok ? 'ok' : rows };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
})();

out.integrity.quick.quick_check = (() => {
  try {
    const rows = db.pragma('quick_check');
    const first = rows?.[0];
    const ok = first && Object.values(first)[0] === 'ok';
    return { ok: true, result: ok ? 'ok' : rows };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
})();

const hasTable = (name) => tables.includes(name);

// Orphans
if (hasTable('contracts') && hasTable('properties')) {
  out.integrity.orphans.contractsWithoutProperty = runCheck(
    'contractsWithoutProperty',
    `
    SELECT c.id, c.propertyId, c.status, c.startDate, c.endDate
    FROM contracts c
    LEFT JOIN properties p ON p.id = c.propertyId
    WHERE TRIM(COALESCE(c.propertyId,'')) <> '' AND p.id IS NULL
    LIMIT 200
    `.trim()
  );
}

if (hasTable('contracts') && hasTable('people')) {
  out.integrity.orphans.contractsTenantMissing = runCheck(
    'contractsTenantMissing',
    `
    SELECT c.id, c.tenantId, c.propertyId, c.status
    FROM contracts c
    LEFT JOIN people t ON t.id = c.tenantId
    WHERE TRIM(COALESCE(c.tenantId,'')) <> '' AND t.id IS NULL
    LIMIT 200
    `.trim()
  );

  out.integrity.orphans.contractsGuarantorMissing = runCheck(
    'contractsGuarantorMissing',
    `
    SELECT c.id, c.guarantorId, c.propertyId, c.status
    FROM contracts c
    LEFT JOIN people g ON g.id = c.guarantorId
    WHERE TRIM(COALESCE(c.guarantorId,'')) <> '' AND g.id IS NULL
    LIMIT 200
    `.trim()
  );
}

if (hasTable('installments') && hasTable('contracts')) {
  out.integrity.orphans.installmentsWithoutContract = runCheck(
    'installmentsWithoutContract',
    `
    SELECT i.id, i.contractId, i.dueDate, i.amount, i.paid, i.remaining, i.status
    FROM installments i
    LEFT JOIN contracts c ON c.id = i.contractId
    WHERE TRIM(COALESCE(i.contractId,'')) <> '' AND c.id IS NULL
    LIMIT 200
    `.trim()
  );

  out.integrity.orphans.installmentsMissingContractId = runCheck(
    'installmentsMissingContractId',
    `
    SELECT i.id, i.contractId, i.dueDate, i.amount, i.remaining
    FROM installments i
    WHERE i.contractId IS NULL OR TRIM(COALESCE(i.contractId,'')) = ''
    LIMIT 200
    `.trim()
  );
}

// Duplicates (heuristics)
if (hasTable('people')) {
  out.integrity.duplicates.peopleNationalId = runCheck(
    'peopleNationalId',
    `
    SELECT nationalId, COUNT(*) AS cnt
    FROM people
    WHERE TRIM(COALESCE(nationalId,'')) <> ''
    GROUP BY nationalId
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, nationalId
    LIMIT 200
    `.trim()
  );

  out.integrity.duplicates.peoplePhone = runCheck(
    'peoplePhone',
    `
    SELECT phone, COUNT(*) AS cnt
    FROM people
    WHERE TRIM(COALESCE(phone,'')) <> ''
    GROUP BY phone
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, phone
    LIMIT 200
    `.trim()
  );
}

if (hasTable('properties')) {
  out.integrity.duplicates.propertiesInternalCode = runCheck(
    'propertiesInternalCode',
    `
    SELECT internalCode, COUNT(*) AS cnt
    FROM properties
    WHERE TRIM(COALESCE(internalCode,'')) <> ''
    GROUP BY internalCode
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, internalCode
    LIMIT 200
    `.trim()
  );
}

// Nonsensical
if (hasTable('contracts')) {
  out.integrity.nonsensical.contractDates = runCheck(
    'contractDates',
    `
    SELECT id, startDate, endDate, status
    FROM contracts
    WHERE TRIM(COALESCE(startDate,'')) <> ''
      AND TRIM(COALESCE(endDate,'')) <> ''
      AND date(endDate) < date(startDate)
    LIMIT 200
    `.trim()
  );

  out.integrity.nonsensical.contractMoney = runCheck(
    'contractMoney',
    `
    SELECT id, annualValue, paymentFrequency, status
    FROM contracts
    WHERE COALESCE(annualValue,0) <= 0 OR COALESCE(paymentFrequency,0) <= 0
    LIMIT 200
    `.trim()
  );
}

if (hasTable('installments')) {
  out.integrity.nonsensical.installmentMoney = runCheck(
    'installmentMoney',
    `
    SELECT id, contractId, dueDate, amount, paid, remaining, status
    FROM installments
    WHERE COALESCE(amount,0) <= 0
       OR COALESCE(paid,0) < 0
       OR COALESCE(remaining,0) < 0
       OR COALESCE(paid,0) > COALESCE(amount,0)
    LIMIT 200
    `.trim()
  );
}

// Attachments in KV (best-effort)
if (hasTable('kv')) {
  try {
    const row = runGet("SELECT v FROM kv WHERE k = 'db_attachments' LIMIT 1");
    const raw = String(row?.v ?? '');
    const arr = safeJsonParse(raw);
    if (Array.isArray(arr)) {
      const missingRef = arr
        .filter((a) => {
          const rt = String(a?.referenceType ?? '').trim();
          const rid = String(a?.referenceId ?? '').trim();
          return !rt || !rid;
        })
        .slice(0, 200);

      out.integrity.attachments.missingReference = {
        ok: true,
        count: missingRef.length,
        samples: pickSamples(missingRef, 5),
      };

      const byType = new Map();
      for (const a of arr) {
        const rt = String(a?.referenceType ?? '').trim();
        const rid = String(a?.referenceId ?? '').trim();
        if (!rt || !rid) continue;
        if (!byType.has(rt)) byType.set(rt, []);
        byType.get(rt).push({
          id: a?.id,
          name: a?.name,
          fileName: a?.fileName,
          referenceType: rt,
          referenceId: rid,
        });
      }

      const missingInDomain = [];
      const checkType = (rt, table) => {
        if (!hasTable(table)) return;
        const items = byType.get(rt) ?? [];
        if (!items.length) return;
        const seen = new Set();
        for (const it of items) {
          const key = String(it.referenceId);
          if (seen.has(key)) continue;
          seen.add(key);
          const exists = runGet(`SELECT 1 AS ok FROM ${quoteIdent(table)} WHERE id = ? LIMIT 1`, [key]);
          if (!exists) missingInDomain.push(it);
        }
      };

      checkType('Person', 'people');
      checkType('Property', 'properties');
      checkType('Contract', 'contracts');

      out.integrity.attachments.referenceMissingInDomain = {
        ok: true,
        count: missingInDomain.length,
        samples: pickSamples(missingInDomain, 5),
      };
    } else {
      out.integrity.attachments.missingReference = { ok: false, error: 'db_attachments is not a JSON array' };
    }
  } catch (e) {
    out.integrity.attachments.missingReference = { ok: false, error: String(e?.message ?? e) };
  }
}

try {
  db.close();
} catch {
  // ignore
}

process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
