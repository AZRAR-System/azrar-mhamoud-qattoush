import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const nowIso = () => new Date().toISOString();

async function main() {
  // When running this script directly with `electron <script>`, Electron defaults the
  // app name to "Electron", which changes `app.getPath('userData')`.
  // Set it to match the packaged product name so the resolved DB path matches real installs.
  if (!process.env.AZRAR_APP_NAME) {
    app.setName('AZRAR');
  } else {
    app.setName(String(process.env.AZRAR_APP_NAME));
  }

  await app.whenReady();

  // Use the app's own path resolution logic.
  // IMPORTANT: do NOT call getDb() or anything that creates tables.
  const dbJsUrl = pathToFileURL(path.join(process.cwd(), 'electron', 'db.js')).href;
  const { getDbPath } = await import(dbJsUrl);
  const dbPath = String(getDbPath()).trim();

  const out = {
    ok: true,
    ranAt: nowIso(),
    dbPath,
    file: null,
    note: 'This script prints the resolved DB path + file size only. Full read-only audit is done via Node (better-sqlite3) because the dev environment may not have an Electron-compatible native build.',
    notes: [],
  };

  // File stats (read-only)
  try {
    const st = await fsp.stat(dbPath);
    out.file = {
      sizeBytes: st.size,
      sizeMB: Math.round((st.size / (1024 * 1024)) * 100) / 100,
      sizeGB: Math.round((st.size / (1024 * 1024 * 1024)) * 100) / 100,
      mtime: st.mtime.toISOString(),
    };
  } catch (e) {
    out.ok = false;
    out.notes.push(`Failed to stat DB file: ${String(e?.message ?? e)}`);
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);

  try {
    // Ensure the process exits; electron sometimes keeps handles.
    app.exit(0);
  } catch {
    // ignore
  }
}

main().catch((e) => {
  process.stderr.write(`FATAL: ${String(e?.stack ?? e)}\n`);
  try {
    app.exit(1);
  } catch {
    // ignore
  }
});
