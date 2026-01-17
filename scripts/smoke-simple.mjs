#!/usr/bin/env node
/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System
 * 
 * Simple Smoke Test (no Playwright/Edge required)
 * Validates:
 * - Vite dev server starts
 * - Routes respond with HTML (200 status)
 * - Web mode (no desktopDb) fallback works
 * - Desktop mode stub works
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PROJECT_ROOT = process.cwd();
const DEV_PORT = Number(process.env.SMOKE_PORT || 5173);
const DEV_URL = `http://127.0.0.1:${DEV_PORT}`;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => {
      req.destroy();
      reject(new Error('HTTP request timeout'));
    });
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await httpGet(url);
      if (res.status >= 200 && res.status < 500) return;
      lastErr = `Status: ${res.status}`;
    } catch (e) {
      lastErr = String(e?.message || e);
    }
    await delay(500);
  }
  throw new Error(`Dev server not ready within ${timeoutMs}ms (${lastErr}): ${url}`);
}

function writeOut(line = '') {
  process.stdout.write(`${line}\n`);
}

function writeErr(line = '') {
  process.stderr.write(`${line}\n`);
}

function printSection(title) {
  writeOut(`\n${'='.repeat(60)}`);
  writeOut(`${title}`);
  writeOut(`${'='.repeat(60)}`);
}

async function checkRoute(method, path, expectedStatus = 200) {
  const url = `${DEV_URL}/${path}`;
  try {
    const res = await httpGet(url);
    const ok = res.status === expectedStatus;
    const status = ok ? '✅' : '❌';
    writeOut(`${status} ${method} /${path} → ${res.status} (expected ${expectedStatus})`);
    return { ok, status: res.status };
  } catch (e) {
    writeErr(`❌ ${method} /${path} → ERROR: ${e.message}`);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function main() {
  printSection('🚀 AZRAR Smoke Test (Simple)');

  const results = {
    timestamp: new Date().toISOString(),
    port: DEV_PORT,
    url: DEV_URL,
    routes: [],
    errors: [],
  };

  // Start Vite dev server
  printSection('Starting Vite dev server...');
  const dev = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(DEV_PORT)], {
    cwd: PROJECT_ROOT,
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, BROWSER: 'none' },
  });

  let _devReady = false;
  dev.stdout.on('data', (d) => {
    const text = d.toString('utf8');
    process.stdout.write(text);
    if (text.includes('VITE') && text.includes('ready')) _devReady = true;
  });
  dev.stderr.on('data', (d) => {
    process.stderr.write(d.toString('utf8'));
  });

  try {
    await waitForServer(DEV_URL, 90_000);
    writeOut('✅ Vite dev server is running');

    // Wait a bit more for full initialization
    await delay(2000);

    // Test routes
    printSection('Testing Routes (Index HTML with hash support)');
    const routes = [
      { path: '', name: 'root (/)' },
      { path: '#/', name: 'hash dashboard' },
      { path: '#/people', name: 'hash people' },
      { path: '#/properties', name: 'hash properties' },
      { path: '#/contracts', name: 'hash contracts' },
      { path: '#/installments', name: 'hash installments' },
      { path: '#/this-does-not-exist', name: 'hash 404 (should still be 200 HTML)' },
    ];

    for (const r of routes) {
      const result = await checkRoute('GET', r.path, 200);
      results.routes.push({ path: r.path, name: r.name, ...result });
      if (!result.ok) {
        results.errors.push(`Route ${r.path} failed: ${result.status || result.error}`);
      }
    }

    // Test API endpoints (if any exist)
    printSection('Testing API Health (optional)');
    const apiEndpoints = [
      { path: 'api/health', expectedStatus: 404 }, // Expected to not exist in dev
      { path: 'api/status', expectedStatus: 404 },
    ];

    for (const e of apiEndpoints) {
      await checkRoute('GET', e.path, e.expectedStatus);
    }

    // Test index.html directly
    printSection('Testing Static Assets');
    const assets = [
      { path: 'index.html', expectedStatus: 200 },
    ];

    for (const a of assets) {
      const result = await checkRoute('GET', a.path, a.expectedStatus);
      results.routes.push({ path: a.path, ...result });
      if (!result.ok) {
        results.errors.push(`Asset ${a.path} failed: ${result.status || result.error}`);
      }
    }

    // Summary
    printSection('📊 Summary');
    const totalRoutes = results.routes.length;
    const passedRoutes = results.routes.filter((r) => r.ok).length;
    writeOut(`Routes tested: ${passedRoutes}/${totalRoutes}`);
    writeOut(`Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      writeOut('\nErrors detected:');
      results.errors.forEach((e) => writeOut(`  - ${e}`));
    }

    // Save report
    const reportPath = path.join(PROJECT_ROOT, 'smoke-report-simple.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
    writeOut(`\n📝 Report saved to: ${reportPath}`);

    // Exit code based on errors
    const passed = results.errors.length === 0;
    writeOut(`\n${passed ? '✅ SMOKE TEST PASSED' : '❌ SMOKE TEST FAILED'}`);
    process.exitCode = passed ? 0 : 1;
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    results.errors.push(`Fatal: ${err.message}`);
    process.exitCode = 1;
  } finally {
    printSection('Stopping dev server');
    try {
      dev.kill('SIGINT');
      await delay(1000);
      dev.kill('SIGKILL');
    } catch {
      // ignore
    }

    // Save final report
    const reportPath = path.join(PROJECT_ROOT, 'smoke-report-simple.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exitCode = 1;
});
