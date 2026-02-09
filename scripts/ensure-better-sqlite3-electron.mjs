import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const electronCli = path.join(root, 'node_modules', 'electron', 'cli.js');
const checkScript = path.join(root, 'scripts', 'check-better-sqlite3-electron.cjs');

const readElectronVersion = () => {
  try {
    const pkgRaw = fs.readFileSync(path.join(root, 'node_modules', 'electron', 'package.json'), 'utf8');
    const pkg = JSON.parse(String(pkgRaw));
    const v = String(pkg?.version || '').trim();
    if (v) return v;
  } catch {
    // ignore
  }
  return '';
};

const runElectronCheck = () => {
  if (!fs.existsSync(electronCli)) {
    console.error('[native] electron is not installed. Run: npm i');
    return { status: 1 };
  }
  if (!fs.existsSync(checkScript)) {
    console.error('[native] missing check script:', checkScript);
    return { status: 1 };
  }

  return spawnSync(process.execPath, [electronCli, checkScript], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
};

const isOk = (r) => (typeof r?.status === 'number' ? r.status : 1) === 0;

const main = async () => {
  const first = runElectronCheck();
  if (isOk(first)) {
    console.warn('[native] better-sqlite3 OK in Electron runtime');
    return;
  }

  console.warn('[native] rebuilding native modules for Electron...');

  const electronVersion = readElectronVersion();
  if (!electronVersion) {
    console.warn('[native] could not resolve Electron version; rebuild may fail');
  } else {
    console.warn('[native] electronVersion:', electronVersion);
  }

  const rebuildMod = await import('@electron/rebuild');
  const rebuildFn = rebuildMod.rebuild ?? rebuildMod.default?.rebuild ?? rebuildMod.default;
  if (typeof rebuildFn !== 'function') {
    throw new Error('Could not resolve rebuild() from @electron/rebuild');
  }

  await rebuildFn({
    buildPath: root,
    electronVersion: electronVersion || undefined,
    onlyModules: ['better-sqlite3', 'better-sqlite3-multiple-ciphers'],
    force: true,
  });

  const second = runElectronCheck();
  if (isOk(second)) {
    console.warn('[native] rebuild OK');
    return;
  }

  process.exit(typeof second?.status === 'number' ? second.status : 1);
};

main().catch((e) => {
  console.error('[native] ensure failed:', e);
  process.exit(1);
});
