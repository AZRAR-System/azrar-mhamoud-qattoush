#!/usr/bin/env node
/**
 * Guess the desktop SQLite DB path without Electron.
 * This is useful when `npx electron scripts/db-audit-readonly-electron.mjs` can't be run.
 */

import fsp from 'node:fs/promises';

const candidates = [];

const explicitPath = String(process.env.AZRAR_DESKTOP_DB_PATH ?? '').trim();
if (explicitPath) candidates.push({ source: 'AZRAR_DESKTOP_DB_PATH', path: explicitPath });

const explicitDir = String(process.env.AZRAR_DESKTOP_DB_DIR ?? '').trim();
if (explicitDir) candidates.push({ source: 'AZRAR_DESKTOP_DB_DIR', path: `${explicitDir.replace(/[\\/]+$/, '')}\\khaberni.sqlite` });

const appData = String(process.env.APPDATA ?? '').trim();
if (appData) {
  const base = appData.replace(/[\\/]+$/, '');
  candidates.push({ source: '%APPDATA%\\AZRAR', path: `${base}\\AZRAR\\khaberni.sqlite` });
  candidates.push({ source: '%APPDATA%\\Electron (dev default)', path: `${base}\\Electron\\khaberni.sqlite` });
}

async function statSafe(p) {
  try {
    const st = await fsp.stat(p);
    return { exists: true, sizeBytes: st.size, mtime: st.mtime?.toISOString?.() ?? null };
  } catch {
    return { exists: false };
  }
}

const out = [];
for (const c of candidates) {
  out.push({ ...c, ...(await statSafe(c.path)) });
}

process.stdout.write(`${JSON.stringify({ candidates: out }, null, 2)}\n`);
