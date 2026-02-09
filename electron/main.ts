import logger from './logger';
import { app, BrowserWindow, shell, session, type Event } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { registerIpcHandlers } from './ipc';
import { startAutoMaintenance } from './autoMaintenance';
import { startOnlineStatusMonitor, stopOnlineStatusMonitor } from './license/licenseManager';
import { verifyAppIntegrityOrQuit } from './security/integrity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

type ProcessWarning = Error & { code?: string };

function isProcessWarning(value: unknown): value is ProcessWarning {
  return value instanceof Error;
}

// Help diagnose runtime warnings (notably DEP0123 about TLS SNI on IPs).
// This does not change behavior; it only improves observability.
process.on('warning', (w: unknown) => {
  try {
    if (!isProcessWarning(w)) return;
    const code = String(w.code ?? '');
    if (code === 'DEP0123') {
      logger.warn('[Node Warning][DEP0123]', w.message || String(w));
      if (w.stack) logger.warn(String(w.stack));
    }
  } catch {
    // ignore
  }
});

// The Chromium/Electron security warning about CSP is helpful, but very noisy in dev.
// In production we enforce a stricter CSP and do not disable warnings.
if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// Best-effort: enable Chromium sandboxing globally (must be called before app is ready).
// In some dev environments this can cause sandbox bundle/runtime issues; keep prod strict.
if (!isDev) {
  try {
    app.enableSandbox();
  } catch {
    // ignore
  }
}

// Best-effort: ensure Chromium caches use a writable location.
// Some environments (AV/OneDrive/policies) may deny cache moves/creation.
try {
  const userData = app.getPath('userData');
  const diskCacheDir = path.join(userData, 'cache');
  const gpuCacheDir = path.join(userData, 'gpu-cache');
  app.setPath('cache', diskCacheDir);
  app.commandLine.appendSwitch('disk-cache-dir', diskCacheDir);
  app.commandLine.appendSwitch('gpu-disk-cache-dir', gpuCacheDir);
} catch {
  // ignore
}

function extractInlineScriptBodiesFromHtml(html: string): string[] {
  const out: string[] = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const bodyRaw = String(m[1] ?? '');
    if (bodyRaw.trim()) out.push(bodyRaw);
  }
  return out;
}

function sha256Base64Utf8(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('base64');
}

async function getProdInlineScriptHashes(): Promise<string[]> {
  try {
    const indexHtmlPath = path.join(app.getAppPath(), 'dist', 'index.html');
    const html = await readFile(indexHtmlPath, 'utf8');
    const bodies = extractInlineScriptBodiesFromHtml(html);
    return bodies.map((b) => `\u0027sha256-${sha256Base64Utf8(b)}\u0027`);
  } catch {
    return [];
  }
}

function getContentSecurityPolicy(prodScriptHashes: string[] = []): string {
  // Keep the policy minimal and environment-aware:
  // - Dev: allow Vite HMR and dev-server assets
  // - Prod: stricter policy (no unsafe-eval)
  if (isDev) {
    return [
      "default-src 'self' http://localhost:3000 ws://localhost:3000",
      // Vite (and React fast refresh) uses a small inline preamble in dev.
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:3000",
      "style-src 'self' 'unsafe-inline' http://localhost:3000",
      "img-src 'self' data: blob: http://localhost:3000",
      "media-src 'self' data: blob: http://localhost:3000",
      "font-src 'self' data: http://localhost:3000",
      "connect-src 'self' http://localhost:3000 ws://localhost:3000",
      "worker-src 'self' blob: http://localhost:3000",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  const scriptSrc = ["'self'", ...prodScriptHashes].join(' ');

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

async function installContentSecurityPolicy() {
  try {
    const prodHashes = isDev ? [] : await getProdInlineScriptHashes();
    const csp = getContentSecurityPolicy(prodHashes);
    const ses = session.defaultSession;
    if (!ses) return;

    // Apply CSP via response headers (covers dev server + packaged file loads).
    ses.webRequest.onHeadersReceived(
      {
        urls: ['file://*/*', 'http://*/*', 'https://*/*'],
      },
      (details, callback) => {
        // Avoid interfering with internal devtools resources.
        if (details.url.startsWith('devtools://')) {
          callback({ responseHeaders: details.responseHeaders });
          return;
        }

        const responseHeaders = details.responseHeaders ?? {};
        responseHeaders['Content-Security-Policy'] = [csp];
        // Defense-in-depth headers (best-effort in Electron)
        responseHeaders['X-Content-Type-Options'] = ['nosniff'];
        responseHeaders['Referrer-Policy'] = ['no-referrer'];
        responseHeaders['X-Frame-Options'] = ['DENY'];
        responseHeaders['Permissions-Policy'] = [
          'camera=(), microphone=(), geolocation=(), payment=(), usb=(), hid=(), serial=(), clipboard-read=(), clipboard-write=()'
        ];
        callback({ responseHeaders });
      }
    );
  } catch {
    // Best-effort: don't crash app startup due to CSP wiring.
  }
}

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function inferIsLicenseAdminMode(): boolean {
  try {
    const envMode = String(process.env.AZRAR_APP_MODE || '').trim().toLowerCase();
    if (envMode) return envMode === 'license-admin';

    const argv = Array.isArray(process.argv) ? process.argv.map((s) => String(s || '').toLowerCase()) : [];
    if (argv.includes('--license-admin')) return true;
    if (argv.includes('--app=license-admin')) return true;
    if (argv.includes('--app-mode=license-admin')) return true;

    const name = String(app.getName() || '').trim().toLowerCase();
    if (!name) return false;
    return name.includes('license-admin') || name.includes('licenseadmin') || name.includes('azrar-license-admin');
  } catch {
    return false;
  }
}

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const u = new URL(String(rawUrl || ''));
    // Only allow common safe external schemes.
    return (
      u.protocol === 'https:' ||
      u.protocol === 'http:' ||
      u.protocol === 'mailto:' ||
      u.protocol === 'tel:' ||
      // Allow WhatsApp Desktop deep links (Windows protocol handler)
      u.protocol === 'whatsapp:'
    );
  } catch {
    return false;
  }
}

function isAllowedNavigationTarget(rawUrl: string): boolean {
  const url = String(rawUrl || '');
  if (!url) return false;
  if (url.startsWith('devtools://')) return true;
  if (isDev) {
    return url.startsWith('http://localhost:3000') || url.startsWith('ws://localhost:3000');
  }
  return url.startsWith('file://');
}

async function clearAppCacheOnExit(timeoutMs = 900) {
  try {
    const s = session.defaultSession;
    if (!s) return;

    await Promise.race([
      (async () => {
        await s.clearCache();
        if (typeof s.clearHostResolverCache === 'function') {
          await s.clearHostResolverCache();
        }
        await s.clearStorageData({ storages: ['cachestorage', 'serviceworkers'] });
      })(),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // Best-effort: never block quitting
  }
}

async function createMainWindow() {
  // In dev mode after esbuild bundle, preload.cjs is in same folder as main.js
  const preloadPath = path.join(__dirname, 'preload.cjs');

  logger.info('[Electron] Preload path:', preloadPath);
  logger.info('[Electron] isDev:', isDev);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: !isDev,
      webviewTag: false,
      devTools: isDev,
      safeDialogs: true,
      safeDialogsMessage: 'تم حظر نافذة حوار غير آمنة',
      navigateOnDragDrop: false,
      webSecurity: true,
      preload: preloadPath,
    },
  });

  const appMode = String(process.env.AZRAR_APP_MODE || '').trim().toLowerCase();
  const isLicenseAdminMode = inferIsLicenseAdminMode();
  if (isLicenseAdminMode) {
    try {
      mainWindow.setTitle('AZRAR License Admin');
    } catch {
      // ignore
    }
  }

  mainWindow.once('ready-to-show', () => {
    logger.info('[Electron] Window ready to show');
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('[Electron] Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('console-message', (_event: Event, ...args: unknown[]) => {
    // Helps diagnose renderer issues in packaged builds (white screen)
    // Electron is moving to a single params object; support both.
    const maybeParams = args[0];
    if (isRecord(maybeParams) && 'message' in maybeParams) {
      const level = stringifyUnknown(maybeParams.level);
      const message = stringifyUnknown(maybeParams.message);
      const sourceId = stringifyUnknown(maybeParams.sourceId);
      const line = stringifyUnknown(maybeParams.line);
      logger.info(`[Renderer:${level}] ${message} (${sourceId}:${line})`);
      return;
    }
    const [level, message, line, sourceId] = args;
    logger.info(
      `[Renderer:${stringifyUnknown(level)}] ${stringifyUnknown(message)} (${stringifyUnknown(sourceId)}:${stringifyUnknown(line)})`
    );
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('[Electron] Renderer process gone:', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('[Electron] Renderer unresponsive');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow internal app windows (e.g., tools opened in a separate window),
    // but keep external links out of the app for security.
    if (isAllowedNavigationTarget(url)) {
      return { action: 'allow' };
    }
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Prevent unexpected navigations (e.g., malicious links / redirects).
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationTarget(url)) event.preventDefault();
  });

  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedNavigationTarget(url)) event.preventDefault();
  });

  // Disable <webview> attachments.
  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  if (isDev) {
    const baseUrl = 'http://localhost:3000';
    const qs = new URLSearchParams();
    // Dev-test flags (passed from scripts/desktop-dev-tests.mjs).
    if (String(process.env.VITE_AUTORUN_SYSTEM_TESTS || '').toLowerCase() === 'true')
      qs.set('autorun', '1');
    if (String(process.env.VITE_ENABLE_INTEGRATION_TEST_DATA || '').toLowerCase() === 'true')
      qs.set('integrationData', '1');
    if (String(process.env.VITE_AUTORUN_SYSTEM_TESTS_MUTATION || '').toLowerCase() === 'true')
      qs.set('mutation', '1');
    if (String(process.env.VITE_ALLOW_CODE_ACTIVATION || '').toLowerCase() === 'true')
      qs.set('allowCodeActivation', '1');

    const hash = isLicenseAdminMode ? '#/license-admin' : '';
    const devUrl = qs.toString() ? `${baseUrl}/?${qs.toString()}${hash}` : `${baseUrl}/${hash}`;
    logger.info('[Electron] Loading dev URL:', devUrl);
    try {
      await mainWindow.loadURL(devUrl);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } catch (err) {
      logger.error('[Electron] Failed to load URL:', err);
    }
  } else {
    const indexHtmlPath = path.join(app.getAppPath(), 'dist', 'index.html');
    logger.info('[Electron] Loading production file:', indexHtmlPath);
    await mainWindow.loadFile(indexHtmlPath, {
      hash: isLicenseAdminMode ? '/license-admin' : undefined,
    });
  }
}

app.whenReady().then(async () => {
  logger.info('[Electron] App ready');
  await installContentSecurityPolicy();

  // Integrity check (prod only). If tampering is detected, the app quits.
  await verifyAppIntegrityOrQuit();

  // Apply the same navigation/open/webview restrictions to ALL web contents.
  // This prevents bypasses via unexpected secondary windows.
  app.on('web-contents-created', (_event, contents) => {
    try {
      contents.setWindowOpenHandler(({ url }) => {
        if (isAllowedNavigationTarget(url)) {
          return { action: 'allow' };
        }
        if (isAllowedExternalUrl(url)) {
          void shell.openExternal(url);
        }
        return { action: 'deny' };
      });

      contents.on('will-navigate', (event: Event, url: string) => {
        if (!isAllowedNavigationTarget(url)) event.preventDefault();
      });

      contents.on('will-redirect', (event: Event, url: string) => {
        if (!isAllowedNavigationTarget(url)) event.preventDefault();
      });

      contents.on('will-attach-webview', (event: Event) => {
        event.preventDefault();
      });

      contents.on('console-message', (_e: Event, ...args: unknown[]) => {
        const maybeParams = args[0];
        if (isRecord(maybeParams) && 'message' in maybeParams) {
          const level = stringifyUnknown(maybeParams.level);
          const message = stringifyUnknown(maybeParams.message);
          const sourceId = stringifyUnknown(maybeParams.sourceId);
          const line = stringifyUnknown(maybeParams.line);
          logger.info(`[Renderer:${level}] ${message} (${sourceId}:${line})`);
          return;
        }
        const [level, message, line, sourceId] = args;
        logger.info(
          `[Renderer:${stringifyUnknown(level)}] ${stringifyUnknown(message)} (${stringifyUnknown(sourceId)}:${stringifyUnknown(line)})`
        );
      });
    } catch {
      // Best-effort only
    }
  });

  // Deny permission requests by default (camera/mic/geolocation/notifications/etc).
  try {
    session.defaultSession?.setPermissionRequestHandler((_wc, _permission, callback) =>
      callback(false)
    );
    session.defaultSession?.setPermissionCheckHandler?.((_wc, _permission) => false);
  } catch {
    // Best-effort only
  }

  registerIpcHandlers();
  startOnlineStatusMonitor();
  startAutoMaintenance();
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('before-quit', (event) => {
  // Best-effort cache clear on exit without slowing down shutdown
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();
  stopOnlineStatusMonitor();
  void clearAppCacheOnExit().finally(() => {
    app.exit(0);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
