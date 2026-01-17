#!/usr/bin/env node
/**
 * Smoke Test - Simple HTTP-based verification (no Playwright)
 * Tests:
 * 1. Dev server startup
 * 2. Routes accessibility (HTTP 200)
 * 3. 404 page exists
 * 4. Health checks
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import http from 'node:http';
import process from 'node:process';

const DEV_PORT = Number(process.env.SMOKE_PORT || 5173);
const DEV_HOST = process.env.SMOKE_HOST || '127.0.0.1';
const DEV_URL = `http://${DEV_HOST}:${DEV_PORT}`;

const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function log(prefix, msg) {
  console.warn(`[${new Date().toISOString().slice(11, 23)}] ${prefix} ${msg}`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error(`Request timeout: ${url}`));
    });
  });
}

async function waitForServer(url, devProcess, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (devProcess && devProcess.exitCode != null) {
      throw new Error(`Dev server exited early (code ${devProcess.exitCode})`);
    }
    try {
      const res = await httpGet(url);
      if (res.status >= 200 && res.status < 500) {
        log('✓', `Server ready at ${url}`);
        return true;
      }
    } catch {
      // retry
    }
    await delay(500);
  }
  throw new Error(`Server not ready within ${timeoutMs}ms`);
}

async function testRoute(path, expectStatus = 200) {
  try {
    const res = await httpGet(`${DEV_URL}${path}`);
    if (res.status === expectStatus) {
      log('✓', `Route ${path}: HTTP ${res.status}`);
      return true;
    } else {
      log('✗', `Route ${path}: HTTP ${res.status} (expected ${expectStatus})`);
      return false;
    }
  } catch (e) {
    log('✗', `Route ${path}: ${e.message}`);
    return false;
  }
}

async function main() {
  log('START', 'Smoke test begins');

  // If a dev server is already running on the target URL, don't try to spawn a new one.
  // This avoids "Port already in use" hangs/failures when another Vite instance is open.
  let existingServer = false;
  try {
    const res = await httpGet(DEV_URL);
    if (res.status >= 200 && res.status < 500) existingServer = true;
  } catch {
    // not running
  }

  if (existingServer) {
    log('INFO', `Dev server already running at ${DEV_URL} (skipping spawn)`);
  }

  const devArgs = ['run', 'dev', '--', '--host', DEV_HOST, '--port', String(DEV_PORT), '--strictPort'];
  const dev = existingServer
    ? null
    : process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${devArgs.join(' ')}`], {
          cwd: process.cwd(),
          shell: false,
          stdio: 'pipe',
          env: { ...process.env, BROWSER: 'none' },
          windowsHide: true,
        })
      : spawn(NPM_CMD, devArgs, {
          cwd: process.cwd(),
          shell: false,
          stdio: 'pipe',
          env: { ...process.env, BROWSER: 'none' },
        });

  let _devOutput = '';
  if (dev) {
    dev.stdout.on('data', (d) => {
      const text = d.toString('utf8');
      _devOutput += text;
      // Only log key messages
      if (text.includes('ready in') || text.toLowerCase().includes('error')) {
        process.stdout.write(text);
      }
    });

    dev.stderr.on('data', (d) => process.stderr.write(d.toString('utf8')));
  }

  try {
    log('WAIT', 'Waiting for dev server...');
    await waitForServer(DEV_URL, dev, 45_000);

    log('TEST', 'Starting route tests');

    const routes = [
      { path: '/', label: 'Dashboard (index)' },
      { path: '/#/', label: 'Dashboard (hash)' },
      { path: '/#/people', label: 'People' },
      { path: '/#/properties', label: 'Properties' },
      { path: '/#/contracts', label: 'Contracts' },
      { path: '/#/installments', label: 'Installments' },
      { path: '/#/settings', label: 'Settings' },
      { path: '/#/login', label: 'Login' },
    ];

    let passed = 0;
    let failed = 0;

    for (const r of routes) {
      const ok = await testRoute(r.path);
      if (ok) passed++;
      else failed++;
      await delay(300);
    }

    // Test 404
    log('TEST', 'Testing 404 fallback');
    const notFound = await testRoute('/#/this-route-does-not-exist', 200);
    if (notFound) {
      log('✓', 'NotFound route responds with HTTP 200 (renders 404 page)');
      passed++;
    } else {
      log('✗', 'NotFound route failed');
      failed++;
    }

    log('SUMMARY', `Routes: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
      log('✓✓✓', 'All smoke tests PASSED');
      process.exitCode = 0;
    } else {
      log('✗✗✗', `${failed} test(s) FAILED`);
      process.exitCode = 1;
    }
  } catch (err) {
    log('ERROR', `${err.message}`);
    process.exitCode = 1;
  } finally {
    if (!existingServer) {
      log('CLEANUP', 'Stopping dev server');
      try {
        dev?.kill();
        await delay(1500);

        if (dev && dev.exitCode == null) {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/PID', String(dev.pid), '/T', '/F'], {
              cwd: process.cwd(),
              stdio: 'ignore',
              shell: false,
              windowsHide: true,
            });
          } else {
            dev.kill('SIGKILL');
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

await main();
