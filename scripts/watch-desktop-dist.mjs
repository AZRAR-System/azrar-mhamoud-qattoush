import chokidar from 'chokidar';
import { spawn } from 'node:child_process';

const once = process.argv.includes('--once');

const watchGlobs = [
  'src/**/*',
  'electron/**/*',
  'vite.config.ts',
  'package.json',
  'tsconfig.json',
];

const ignored = [
  '**/node_modules/**',
  'dist/**',
  'release2_build/**',
  'release2_build_stage/**',
  '**/*.sqlite',
  '**/*.db',
  '**/*.log',
];

let buildInProgress = false;
let buildQueued = false;
let debounceTimer = null;

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[desktop:dist:watch] ${msg}`);
}

function runBuild() {
  if (buildInProgress) {
    buildQueued = true;
    return;
  }

  buildInProgress = true;
  buildQueued = false;

  log('Building installer artifacts (release2_build)...');

  // On Windows, spawning npm(.cmd) directly can fail with EINVAL depending on how
  // the parent process is launched. Using `shell: true` is the most robust.
  const child = spawn('npm', ['run', 'desktop:dist:auto'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    windowsHide: false,
  });

  child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk) => process.stderr.write(chunk));

  child.on('exit', (code) => {
    buildInProgress = false;

    if (code === 0) {
      log('Build finished successfully.');
    } else {
      log(`Build failed (exit ${code}). Watching continues...`);
    }

    if (buildQueued) {
      log('Changes detected during build; rebuilding...');
      runBuild();
    }

    if (once) {
      process.exitCode = code ?? 0;
      process.exit();
    }
  });
}

function scheduleBuild() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runBuild(), 1500);
}

async function main() {
  log('Starting watch...');
  log(`Watching: ${watchGlobs.join(', ')}`);

  if (once) {
    runBuild();
    return;
  }

  const watcher = chokidar.watch(watchGlobs, {
    ignored,
    ignoreInitial: true,
  });

  watcher
    .on('add', scheduleBuild)
    .on('change', scheduleBuild)
    .on('unlink', scheduleBuild)
    .on('error', (err) => log(`Watcher error: ${err?.message || err}`));

  // Do an initial build on start.
  runBuild();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
