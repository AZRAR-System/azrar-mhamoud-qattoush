import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Runs Desktop dev mode with integration-test data enabled.
// This avoids relying on shell-specific env syntax (cmd/powershell).

const env = {
  ...process.env,
  VITE_ENABLE_INTEGRATION_TEST_DATA: 'true',
  // Dev-test only: allow code activation so autorun bootstrap can activate without a license file.
  VITE_ALLOW_CODE_ACTIVATION: 'true',
  // Force full mutation-mode integration suite during autorun.
  VITE_AUTORUN_SYSTEM_TESTS_MUTATION: 'true',
};

const DEFAULT_TIMEOUT_MS = Number(process.env.DESKTOP_DEV_TESTS_TIMEOUT_MS || 300_000);

const ensureDir = (p) => {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {
    // ignore
  }
};

const resolveLogPath = (argv) => {
  const idx = argv.indexOf('--log');
  const argPath = idx >= 0 ? String(argv[idx + 1] || '').trim() : '';
  const envPath = String(process.env.DESKTOP_DEV_TESTS_LOG_PATH || '').trim();
  const chosen = argPath || envPath;

  const root = process.cwd();
  const fallbackDir = path.join(root, 'tmp');
  ensureDir(fallbackDir);
  const fallback = path.join(fallbackDir, 'desktop-dev-tests-latest.log');

  if (!chosen) return fallback;
  const abs = path.isAbsolute(chosen) ? chosen : path.join(root, chosen);
  ensureDir(path.dirname(abs));
  return abs;
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write('Usage: node scripts/desktop-dev-tests.mjs [--print] [--autorun] [--timeout <ms>] [--log <path>]\n');
  process.stdout.write('Runs: npm run desktop:dev with VITE_ENABLE_INTEGRATION_TEST_DATA=true\n');
  process.stdout.write('Options:\n');
  process.stdout.write('  --autorun   Automatically open System Maintenance and run tests\n');
  process.stdout.write('  --timeout   Timeout in ms (default: DESKTOP_DEV_TESTS_TIMEOUT_MS or 300000)\n');
  process.stdout.write('  --log       Write combined stdout/stderr to a log file (default: tmp/desktop-dev-tests-latest.log)\n');
  process.exit(0);
}

if (args.includes('--print')) {
  process.stdout.write('Will run: npm run desktop:dev\n');
  process.stdout.write('With env: VITE_ENABLE_INTEGRATION_TEST_DATA=true\n');
  if (args.includes('--autorun')) {
    process.stdout.write('Plus env: VITE_AUTORUN_SYSTEM_TESTS=true\n');
  }
  process.exit(0);
}

if (args.includes('--autorun')) {
  env.VITE_AUTORUN_SYSTEM_TESTS = 'true';
}

const timeoutMs = (() => {
  const idx = args.indexOf('--timeout');
  if (idx >= 0) {
    const v = Number(args[idx + 1]);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_TIMEOUT_MS;
  }
  return DEFAULT_TIMEOUT_MS;
})();

const logPath = resolveLogPath(args);
try {
  // Write UTF-8 BOM so Windows tools (PowerShell/Notepad) detect encoding correctly.
  fs.writeFileSync(logPath, '\ufeff', 'utf8');
} catch {
  // ignore
}

const appendLog = (s) => {
  try {
    fs.appendFileSync(logPath, s, 'utf8');
  } catch {
    // ignore
  }
};

let sawSuccessSummary = false;
let sawFailSummary = false;
let autorunFailedCount = null;

const onData = (buf, writeTo) => {
  const s = buf.toString('utf8');
  writeTo.write(s);
  appendLog(s);
  // Signals printed by IntegrationTestSuite summary
  if (s.includes('🎉 جميع الاختبارات نجحت')) sawSuccessSummary = true;
  if (s.includes('⚠️') && s.includes('اختبار') && s.includes('فشلت')) sawFailSummary = true;

  // Signals printed by SystemMaintenance autorun
  if (s.includes('[autorun] system tests done')) {
    const m = s.match(/\[autorun\] system tests done \(failed=(\d+)\)/);
    if (m) {
      const failed = Number(m[1]);
      if (Number.isFinite(failed)) {
        autorunFailedCount = failed;
        if (failed === 0) sawSuccessSummary = true;
        if (failed > 0) sawFailSummary = true;
      }
    }
  }
};

const child = spawn('npm run desktop:dev', {
  stdio: ['ignore', 'pipe', 'pipe'],
  env,
  shell: true,
});

child.stdout?.on('data', (d) => onData(d, process.stdout));
child.stderr?.on('data', (d) => onData(d, process.stderr));

const timer = setTimeout(() => {
  console.error(`\n[desktop:dev:tests] Timeout after ${timeoutMs}ms. Terminating...`);
  appendLog(`\n[desktop:dev:tests] Timeout after ${timeoutMs}ms. Terminating...\n`);
  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
  // Give it a moment then hard-kill.
  setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }, 1500);
  process.exitCode = 1;
}, timeoutMs);

child.on('exit', (code) => {
  clearTimeout(timer);

  appendLog(`\n[desktop:dev:tests] child exit code=${code ?? ''}\n`);
  appendLog(`[desktop:dev:tests] logPath=${logPath}\n`);

  // Prefer semantic result when autorun is enabled.
  if (env.VITE_AUTORUN_SYSTEM_TESTS) {
    if (typeof autorunFailedCount === 'number') {
      process.exitCode = autorunFailedCount > 0 ? 1 : 0;
      return;
    }
    if (sawFailSummary) {
      process.exitCode = 1;
      return;
    }
    if (sawSuccessSummary) {
      process.exitCode = 0;
      return;
    }
  }

  process.exitCode = code ?? 1;
});
