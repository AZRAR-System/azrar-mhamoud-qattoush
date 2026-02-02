import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const logDir = path.join(rootDir, 'tmp');
const logPath = path.join(logDir, 'licensegen-dev.log');

fs.mkdirSync(logDir, { recursive: true });
fs.writeFileSync(logPath, '', 'utf8');

const appendLog = (s) => {
  try {
    fs.appendFileSync(logPath, s, 'utf8');
  } catch {
    // ignore
  }
};

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    child.on('exit', (code, signal) => {
      if (code === 0) return resolve({ code, signal });
      return reject(new Error(`Command failed: ${cmd} ${args.join(' ')} (code=${code}, signal=${signal || ''})`));
    });
    child.on('error', reject);
  });

const runNpm = async (npmArgs) => {
  if (process.platform === 'win32') {
    // Batch files (.cmd) need cmd.exe; avoids spawn EINVAL.
    const cmdLine = `npm ${npmArgs.join(' ')}`;
    await run('cmd.exe', ['/d', '/s', '/c', cmdLine], { cwd: rootDir });
    return;
  }
  await run('npm', npmArgs, { cwd: rootDir });
};

const main = async () => {
  console.warn(`[licensegen:dev:verbose] writing log: ${logPath}`);
  appendLog(`[start] ${new Date().toISOString()}\n`);

  // Build bundles first.
  await runNpm(['run', 'electron:licensegen:preload']);
  await runNpm(['run', 'electron:licensegen:main']);

  // Sanity-check expected files.
  const expectedHtml = path.join(rootDir, 'electron', 'licensegen-renderer', 'index.html');
  const expectedMain = path.join(rootDir, 'electron', 'licensegen-main.js');
  const expectedPreload = path.join(rootDir, 'electron', 'licensegen-preload.cjs');
  for (const p of [expectedHtml, expectedMain, expectedPreload]) {
    if (!fs.existsSync(p)) {
      const msg = `[fatal] Missing required file: ${p}`;
      console.error(msg);
      appendLog(`${msg}\n`);
      process.exitCode = 1;
      return;
    }
  }

  const require = createRequire(import.meta.url);
  const electronBinary = /** @type {string} */ (require('electron'));

  console.warn('[licensegen:dev:verbose] launching Electron...');
  appendLog(`[launch] ${electronBinary} ${expectedMain}\n`);

  const env = {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1',
    ELECTRON_ENABLE_STACK_DUMPING: '1',
  };

  const child = spawn(electronBinary, [expectedMain, '--enable-logging', '--v=1'], {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: false,
    shell: false,
  });

  const onData = (chunk) => {
    const s = chunk.toString();
    process.stdout.write(s);
    appendLog(s);
  };

  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  child.on('exit', (code, signal) => {
    const msg = `\n[exit] code=${code} signal=${signal || ''}\n`;
    console.warn(msg.trim());
    appendLog(msg);
    console.warn(`[licensegen:dev:verbose] log saved: ${logPath}`);
  });

  child.on('error', (e) => {
    const msg = `[error] ${e?.stack || String(e)}\n`;
    console.error(msg.trim());
    appendLog(msg);
    process.exitCode = 1;
  });
};

main().catch((e) => {
  const msg = `[fatal] ${e?.stack || String(e)}\n`;
  console.error(msg.trim());
  appendLog(msg);
  process.exitCode = 1;
});
