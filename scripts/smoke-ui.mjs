import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';

const PROJECT_ROOT = process.cwd();
const DEV_PORT = Number(process.env.SMOKE_PORT || 5173);
const DEV_URL = `http://127.0.0.1:${DEV_PORT}`;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
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

  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveEdgePath() || undefined,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

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
    if (type === 'error') errors.push(`[console.error] ${text}`);
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

  const clickIfVisible = async (locator, label) => {
    try {
      if (await locator.isVisible({ timeout: 1500 })) {
        await locator.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        return true;
      }
    } catch {
      // ignore
    }
    warnings.push(`[smoke] Could not click: ${label}`);
    return false;
  };

  await gotoHash('/login');
  await page.getByPlaceholder('أدخل اسم المستخدم').fill('admin');
  await page.getByPlaceholder('••••••••').fill('admin123');
  await page.getByRole('button', { name: /تسجيل الدخول|دخول|Login/i }).click();
  await page.waitForTimeout(1300);

  const routes = [
    { path: '/', title: 'Dashboard' },
    { path: '/people', title: 'People' },
    { path: '/properties', title: 'Properties' },
    { path: '/contracts', title: 'Contracts' },
    { path: '/installments', title: 'Installments' },
  ];

  for (const r of routes) {
    await gotoHash(r.path);

    await clickIfVisible(page.getByRole('button', { name: /جديد|إضافة/i }).first(), `${r.title}: add`);
    await closeTopPanelIfAny();

    await clickIfVisible(page.getByRole('button', { name: 'التفاصيل' }).first(), `${r.title}: details`);
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
  printSection('Starting Vite dev server');
  const dev = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(DEV_PORT)], {
    cwd: PROJECT_ROOT,
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, BROWSER: 'none' },
  });

  dev.stdout.on('data', (d) => process.stdout.write(d.toString('utf8')));
  dev.stderr.on('data', (d) => process.stderr.write(d.toString('utf8')));

  try {
    await waitForServer(DEV_URL, 60_000);

    printSection('Smoke: WEB mode (no desktopDb)');
    const web = await runUiFlow({ mode: 'web' });

    printSection('Smoke: DESKTOP-stub mode (desktopDb present)');
    const desk = await runUiFlow({ mode: 'desktop' });

    printSection('Results');
    const report = {
      devUrl: DEV_URL,
      web: {
        errors: web.errors,
        warnings: web.warnings,
      },
      desktop: {
        errors: desk.errors,
        warnings: desk.warnings,
        desktopCounters: desk.desktopCounters,
      },
    };

    const outPath = path.join(PROJECT_ROOT, 'smoke-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    console.warn(`\nWrote report: ${outPath}`);

    console.warn(`WEB errors: ${web.errors.length}, warnings: ${web.warnings.length}`);
    console.warn(`DESKTOP errors: ${desk.errors.length}, warnings: ${desk.warnings.length}`);

    if (desk.desktopCounters) {
      console.warn('Desktop stub call counters (top):');
      const entries = Object.entries(desk.desktopCounters).sort((a, b) => (b[1] || 0) - (a[1] || 0));
      console.warn(entries.slice(0, 12).map(([k, v]) => `${k}=${v}`).join(', '));
    }
  } finally {
    printSection('Stopping dev server');
    try {
      dev.kill('SIGINT');
    } catch {
      // ignore
    }
    await delay(800);
    try {
      dev.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
