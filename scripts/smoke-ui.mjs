import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';

const PROJECT_ROOT = process.cwd();
let DEV_PORT = Number(process.env.SMOKE_PORT || 5173);
let DEV_URL = `http://127.0.0.1:${DEV_PORT}`;

const ACTIVATION_STORAGE_KEY = 'azrar:activation:v1';
const ACTIVATION_LAST_SEEN_KEY = 'azrar:activation:lastSeenAt:v1';

async function isPortFree(port) {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host: '127.0.0.1' }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickAvailablePort(preferred, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const port = preferred + i;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${preferred}-${preferred + attempts - 1}`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error(`Request timeout: ${url}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await httpGet(url);
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      // ignore
    }
    await delay(350);
  }
  throw new Error(`Dev server did not become ready within ${timeoutMs}ms: ${url}`);
}

function resolveEdgePath() {
  const candidates = [
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

function printSection(title) {
  console.warn(`\n=== ${title} ===`);
}

function safeStr(v) {
  try {
    return String(v);
  } catch {
    return '[unstringifiable]';
  }
}

async function runUiFlow({ mode }) {
  const errors = [];
  const warnings = [];

  const deviceId = 'smoke-dev-device';

  const edge = resolveEdgePath();
  if (!edge) {
    throw new Error('Smoke UI requires a Chromium browser. Edge was not found at the usual install paths.');
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: edge,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Prevent long hangs on slow selectors.
  context.setDefaultTimeout(8_000);
  context.setDefaultNavigationTimeout(20_000);

  await context.addInitScript(({ mode }) => {
    const admin = { id: '1', اسم_المستخدم: 'admin', كلمة_المرور: 'admin123', الدور: 'SuperAdmin', isActive: true };

    const person = {
      رقم_الشخص: 'p1',
      الاسم: 'شخص تجريبي',
      رقم_الهاتف: '0790000000',
      الدور: 'مستأجر',
      isActive: true,
    };

    const property = {
      رقم_العقار: 'pr1',
      الكود_الداخلي: 'P-001',
      العنوان: 'عنوان تجريبي',
      نوع_العقار: 'شقة',
      حالة_العقار: 'متاح',
      رقم_المالك: 'p1',
      isForSale: false,
    };

    const contract = {
      رقم_العقد: 'c1',
      رقم_العقار: 'pr1',
      رقم_المالك: 'p1',
      رقم_المستاجر: 'p1',
      تاريخ_البداية: '2026-01-01',
      تاريخ_النهاية: '2026-12-31',
      تاريخ_الانشاء: '2026-01-10',
      القيمة_السنوية: 1200,
      حالة_العقد: 'سارية',
      isArchived: false,
    };

    const seed = (k, v) => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        // ignore
      }
    };

    seed('db_users', [admin]);
    seed('db_people', [person]);
    seed('db_properties', [property]);
    seed('db_contracts', [contract]);
    seed('db_installments', []);
    seed('db_user_permissions', []);
    seed('db_roles', []);
    seed('db_settings', {});

    // Smoke/dev: seed a locally-activated state so Login is enabled.
    // This relies on the dev server setting VITE_ALLOW_CODE_ACTIVATION=1.
    try {
      const deviceId = 'smoke-dev-device';
      localStorage.setItem(
        'azrar:activation:v1',
        JSON.stringify({ activated: true, activatedAt: new Date().toISOString(), deviceId })
      );
      localStorage.setItem('azrar:activation:lastSeenAt:v1', new Date().toISOString());
    } catch {
      // ignore
    }

    try {
      localStorage.removeItem('khaberni_user');
    } catch {
      // ignore
    }

    if (mode === 'desktop') {
      const counters = (window.__smoke = { calls: {} });
      const bump = (name) => {
        counters.calls[name] = (counters.calls[name] || 0) + 1;
      };

      const ok = (payload) => ({ ok: true, ...payload });

      window.desktopDb = {
        getDeviceId: async () => {
          bump('getDeviceId');
          return 'smoke-dev-device';
        },
        get: async (key) => {
          bump('get');
          return localStorage.getItem(key);
        },
        set: async (key, value) => {
          bump('set');
          localStorage.setItem(key, value);
          return true;
        },
        delete: async (key) => {
          bump('delete');
          localStorage.removeItem(key);
          return true;
        },
        keys: async () => {
          bump('keys');
          return Object.keys(localStorage);
        },

        domainGet: async () => {
          bump('domainGet');
          return ok({ item: null });
        },
        domainCounts: async () => {
          bump('domainCounts');
          return ok({ people: 1, properties: 1, contracts: 1 });
        },

        domainSearch: async (payload) => {
          bump('domainSearch');
          void payload;
          return ok({ items: [] });
        },

        domainSearchGlobal: async (payload) => {
          bump('domainSearchGlobal');
          void payload;
          return ok({ people: [], properties: [], contracts: [] });
        },

        domainPropertyPickerSearch: async (payload) => {
          bump('domainPropertyPickerSearch');
          void payload;
          return ok({ items: [], total: 0 });
        },

        domainContractPickerSearch: async (payload) => {
          bump('domainContractPickerSearch');
          void payload;
          return ok({ items: [], total: 0 });
        },

        domainInstallmentsContractsSearch: async (payload) => {
          bump('domainInstallmentsContractsSearch');
          void payload;
          return ok({ items: [], total: 0 });
        },

        domainPaymentNotificationTargets: async (payload) => {
          bump('domainPaymentNotificationTargets');
          void payload;
          return ok({ items: [] });
        },

        sqlStatus: async () => {
          bump('sqlStatus');
          return { configured: false, enabled: false, connected: false };
        },

        onSqlSyncEvent: (handler) => {
          bump('onSqlSyncEvent');
          void handler;
          return () => bump('offSqlSyncEvent');
        },

        onRemoteUpdate: (handler) => {
          bump('onRemoteUpdate');
          void handler;
          return () => bump('offRemoteUpdate');
        },
      };
    } else {
      try {
        delete window.desktopDb;
      } catch {
        // ignore
      }
    }
  }, { mode });

  const page = await context.newPage();

  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${safeStr(err?.message || err)}`);
  });

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      // Ignore benign missing assets (favicon, etc.) in Vite dev.
      if (/Failed to load resource/i.test(text) && /404/i.test(text)) return;
      errors.push(`[console.error] ${text}`);
    }
    else if (type === 'warning') warnings.push(`[console.warn] ${text}`);
  });

  const gotoHash = async (hashPath) => {
    await page.goto(`${DEV_URL}/#${hashPath}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
  };

  const closeTopPanelIfAny = async () => {
    const closeBtn = page.getByLabel('إغلاق').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  };

  const clickIfVisible = async (locator, label, { required = false } = {}) => {
    try {
      if (await locator.isVisible({ timeout: 1500 })) {
        await locator.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        return true;
      }
    } catch {
      // ignore
    }
    if (required) warnings.push(`[smoke] Could not click: ${label}`);
    return false;
  };

  await gotoHash('/login');

  // If activation is not satisfied, the login button is disabled and smoke would waste time.
  // Provide a direct actionable error.
  try {
    const loginBtn = page.getByRole('button', { name: /تسجيل الدخول|دخول|Login/i }).first();
    if (await loginBtn.isDisabled({ timeout: 1500 }).catch(() => false)) {
      errors.push(
        '[smoke] Login is disabled. Ensure the dev server is started with VITE_ALLOW_CODE_ACTIVATION=1 (this script sets it when spawning Vite).'
      );
    }
  } catch {
    // ignore
  }

  await page.getByPlaceholder('أدخل اسم المستخدم').fill('admin');
  await page.getByPlaceholder('••••••••').fill('admin123');
  await page.getByRole('button', { name: /تسجيل الدخول|دخول|Login/i }).click();
  await page
    .waitForFunction(() => String(window.location.hash || '') !== '#/login', null, { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(800);

  const routes = [
    { path: '/people', title: 'People' },
    { path: '/properties', title: 'Properties' },
    { path: '/contracts', title: 'Contracts' },
    { path: '/installments', title: 'Installments' },
  ];

  for (const r of routes) {
    await gotoHash(r.path);

    await clickIfVisible(page.getByRole('button', { name: /جديد|إضافة/i }).first(), `${r.title}: add`);
    await closeTopPanelIfAny();

    await clickIfVisible(page.getByPlaceholder(/بحث|ابحث/i).first(), `${r.title}: focus search`);
    try {
      const searchBox = page.getByPlaceholder(/بحث|ابحث/i).first();
      if (await searchBox.isVisible({ timeout: 800 })) {
        await searchBox.fill('x');
        await page.waitForTimeout(600);
      }
    } catch {
      // ignore
    }
  }

  await gotoHash('/this-route-does-not-exist');
  await page.waitForSelector('text=404', { timeout: 10_000 });

  let desktopCounters = null;
  if (mode === 'desktop') {
    desktopCounters = await page.evaluate(() => (window.__smoke?.calls ? window.__smoke.calls : null));
  }

  await browser.close();

  return { errors, warnings, desktopCounters };
}

async function main() {
  const argv = new Set(process.argv.slice(2));
  const runWeb = argv.has('--web') || argv.has('--both');
  const strict = argv.has('--strict') || argv.has('--fail-on-warnings');
  const skipSpawn = argv.has('--no-server') || String(process.env.SMOKE_SKIP_DEV_SERVER || '').trim() === '1';

  const hasExplicitPort = Object.prototype.hasOwnProperty.call(process.env, 'SMOKE_PORT');

  // If user provided SMOKE_PORT, assume they want that exact port.
  // Otherwise auto-pick a free port to avoid conflicts.
  if (!hasExplicitPort) {
    DEV_PORT = await pickAvailablePort(DEV_PORT, 10);
  }
  DEV_URL = `http://127.0.0.1:${DEV_PORT}`;

  // Detect an already-running dev server (fast path).
  let existingServer = false;
  if (skipSpawn) {
    existingServer = true;
  } else {
    try {
      const res = await httpGet(DEV_URL);
      if (res.status >= 200 && res.status < 500) existingServer = true;
    } catch {
      existingServer = false;
    }
  }

  let dev = null;
  if (!existingServer) {
    printSection('Starting Vite dev server');
    dev = spawn(
      'npm',
      ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(DEV_PORT), '--strictPort'],
      {
        cwd: PROJECT_ROOT,
        shell: true,
        stdio: 'pipe',
        env: { ...process.env, BROWSER: 'none', VITE_ALLOW_CODE_ACTIVATION: '1' },
      }
    );

    dev.stdout.on('data', (d) => process.stdout.write(d.toString('utf8')));
    dev.stderr.on('data', (d) => process.stderr.write(d.toString('utf8')));
  } else {
    printSection('Using existing dev server');
    console.warn(`DEV_URL=${DEV_URL}`);
  }

  try {
    await waitForServer(DEV_URL, 30_000);

    let web = null;
    if (runWeb) {
      printSection('Smoke: WEB mode (no desktopDb)');
      web = await runUiFlow({ mode: 'web' });
    }

    printSection('Smoke: DESKTOP-stub mode (desktopDb present)');
    const desk = await runUiFlow({ mode: 'desktop' });

    printSection('Results');
    const report = {
      devUrl: DEV_URL,
      web: web
        ? {
            errors: web.errors,
            warnings: web.warnings,
          }
        : undefined,
      desktop: {
        errors: desk.errors,
        warnings: desk.warnings,
        desktopCounters: desk.desktopCounters,
      },
    };

    const outPath = path.join(PROJECT_ROOT, 'smoke-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    console.warn(`\nWrote report: ${outPath}`);

    if (web) {
      console.warn(`WEB errors: ${web.errors.length}, warnings: ${web.warnings.length}`);
    } else {
      console.warn('WEB mode: skipped (desktop-only)');
    }
    console.warn(`DESKTOP errors: ${desk.errors.length}, warnings: ${desk.warnings.length}`);

    if (desk.desktopCounters) {
      console.warn('Desktop stub call counters (top):');
      const entries = Object.entries(desk.desktopCounters).sort((a, b) => (b[1] || 0) - (a[1] || 0));
      console.warn(entries.slice(0, 12).map(([k, v]) => `${k}=${v}`).join(', '));
    }

    const webErrors = web ? web.errors.length : 0;
    const webWarnings = web ? web.warnings.length : 0;
    const failed = desk.errors.length + webErrors > 0 || (strict && (desk.warnings.length + webWarnings > 0));
    process.exitCode = failed ? 1 : 0;
  } finally {
    if (!existingServer) {
      printSection('Stopping dev server');
      try {
        dev?.kill('SIGINT');
      } catch {
        // ignore
      }
      await delay(800);
      try {
        dev?.kill('SIGKILL');
      } catch {
        // ignore
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
