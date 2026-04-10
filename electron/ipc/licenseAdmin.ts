import type { IpcDeps } from './deps.js';
import { ipcMain, dialog, app } from 'electron';
import { kvGet, kvSet } from '../db';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { toErrorMessage } from '../utils/errors';

export function registerLicenseAdmin(deps: IpcDeps): void {
  void deps;
  // =====================
  // License Admin (Desktop)
  // =====================
  
  const ADMIN_TOKEN_KEY = 'lic_admin_server_token_v1';
  type StoredAdminTokensV2 = {
    v: 2;
    defaultToken?: string;
    byOrigin: Record<string, string>;
    updatedAt: string;
  };
  
  const readStoredAdminTokensUnsafe = (): StoredAdminTokensV2 | null => {
    try {
      const raw = String(kvGet(ADMIN_TOKEN_KEY) ?? '').trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredAdminTokensV2;
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.v !== 2) return null;
      return parsed;
    } catch {
      return null;
    }
  };
  
  const envDefaultToken = String(
    process.env.AZRAR_LICENSE_SERVER_ADMIN_TOKEN || process.env.AZRAR_LICENSE_ADMIN_TOKEN || ''
  ).trim();
  
  let storedAdminTokens: StoredAdminTokensV2 = {
    v: 2,
    defaultToken: envDefaultToken || undefined,
    byOrigin: {},
    updatedAt: new Date().toISOString(),
  };
  
  try {
    const v2 = readStoredAdminTokensUnsafe();
    if (v2) {
      storedAdminTokens = {
        v: 2,
        defaultToken:
          typeof v2.defaultToken === 'string' ? v2.defaultToken : envDefaultToken || undefined,
        byOrigin: v2.byOrigin && typeof v2.byOrigin === 'object' ? v2.byOrigin : {},
        updatedAt: typeof v2.updatedAt === 'string' ? v2.updatedAt : storedAdminTokens.updatedAt,
      };
    } else if (!envDefaultToken) {
      const legacy = String(kvGet(ADMIN_TOKEN_KEY) ?? '').trim();
      if (legacy) storedAdminTokens.defaultToken = legacy;
    }
  } catch {
    // ignore
  }
  
  const persistStoredAdminTokensBestEffort = (): void => {
    try {
      kvSet(ADMIN_TOKEN_KEY, JSON.stringify(storedAdminTokens));
    } catch {
      // ignore
    }
  };
  
  const getAdminTokenForOrigin = (origin: string): string => {
    const byOrigin = storedAdminTokens.byOrigin || {};
    if (origin && typeof byOrigin[origin] === 'string' && String(byOrigin[origin] || '').trim()) {
      return String(byOrigin[origin]).trim();
    }
    return String(storedAdminTokens.defaultToken || '').trim();
  };
  
  const setAdminTokenForOrigin = (origin: string, token: string): void => {
    const t = String(token || '').trim();
    if (!t) return;
    if (origin) {
      storedAdminTokens.byOrigin = storedAdminTokens.byOrigin || {};
      storedAdminTokens.byOrigin[origin] = t;
    } else {
      storedAdminTokens.defaultToken = t;
    }
    storedAdminTokens.updatedAt = new Date().toISOString();
    persistStoredAdminTokensBestEffort();
  };
  
  let adminSessionOk = false;
  
  const ADMIN_AUTH_KEY = 'lic_admin_auth_v1';
  const DEFAULT_ADMIN_USERNAME = 'admin';
  // SECURITY: Generate a cryptographically random password for first-time setup.
  // This replaces the hardcoded password to prevent credential exposure.
  // Admin must set credentials via environment variables or change after first login.
  const generateSecureDefaultPassword = (): string => {
    // Use hex encoding for simplicity and full entropy preservation (48 chars)
    return crypto.randomBytes(24).toString('hex');
  };
  let generatedDefaultPassword: string | null = null;
  const getDefaultAdminPassword = (): string => {
    if (!generatedDefaultPassword) {
      generatedDefaultPassword = generateSecureDefaultPassword();
    }
    return generatedDefaultPassword;
  };
  const normalizeUser = (u: unknown) =>
    String(u ?? '')
      .trim()
      .slice(0, 64);
  const normalizePass = (p: unknown) =>
    String(p ?? '')
      .trim()
      .slice(0, 128);
  
  const hashPassword = (password: string, salt: Buffer, iterations: number): Buffer => {
    return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  };
  
  const createAuth = (username: string, password: string) => {
    const iterations = 180_000;
    const salt = crypto.randomBytes(16);
    const hash = hashPassword(password, salt, iterations);
    return {
      v: 1,
      username,
      saltB64: salt.toString('base64'),
      iterations,
      hashB64: hash.toString('base64'),
      updatedAt: new Date().toISOString(),
    };
  };
  
  const readAuthUnsafe = (): null | {
    v: 1;
    username: string;
    saltB64: string;
    iterations: number;
    hashB64: string;
    updatedAt?: string;
  } => {
    try {
      const raw = String(kvGet(ADMIN_AUTH_KEY) ?? '').trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.v !== 1) return null;
      if (!parsed.username || !parsed.saltB64 || !parsed.hashB64) return null;
      if (!Number.isFinite(Number(parsed.iterations))) return null;
      return parsed as never;
    } catch {
      return null;
    }
  };
  
  const ensureAuth = () => {
    const existing = readAuthUnsafe();
    if (existing) return existing;
  
    const envUser = normalizeUser(
      process.env.AZRAR_LICENSE_ADMIN_UI_USERNAME || process.env.AZRAR_ADMIN_USERNAME
    );
    const envPass = normalizePass(
      process.env.AZRAR_LICENSE_ADMIN_UI_PASSWORD || process.env.AZRAR_ADMIN_PASSWORD
    );
    const username = envUser || DEFAULT_ADMIN_USERNAME;
    const password = envPass || getDefaultAdminPassword();
    const created = createAuth(username, password);
    try {
      kvSet(ADMIN_AUTH_KEY, JSON.stringify(created));
    } catch {
      // ignore
    }
    return created;
  };
  
  const verifyLogin = (username: string, password: string): boolean => {
    try {
      const auth = ensureAuth();
      if (normalizeUser(username).toLowerCase() !== String(auth.username).trim().toLowerCase())
        return false;
      const salt = Buffer.from(String(auth.saltB64), 'base64');
      const iterations = Number(auth.iterations);
      const expected = Buffer.from(String(auth.hashB64), 'base64');
      const actual = hashPassword(password, salt, iterations);
      if (expected.length !== actual.length) return false;
      return crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  };
  
  const requireAdminSession = (): { ok: true } | { ok: false; error: string } => {
    if (!adminSessionOk) return { ok: false, error: 'Unauthorized' };
    return { ok: true };
  };
  
  const normalizeServerUrl = (raw: unknown): string => {
    const s = String(raw || '').trim();
    if (!s) return '';
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.origin;
    } catch {
      return '';
    }
  };
  
  const postJson = async (serverUrl: string, pathname: string, body: unknown): Promise<unknown> => {
    const adminToken = getAdminTokenForOrigin(serverUrl);
    if (!adminToken) throw new Error('Admin token not configured.');
  
    const resp = await fetch(`${serverUrl}${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
      },
      body: JSON.stringify(body ?? null),
    });
  
    const json = await resp.json().catch(() => null);
    if (!resp.ok) {
      const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
      const msg = String(rec?.error || `HTTP ${resp.status}`).trim();
      throw new Error(msg || 'Request failed');
    }
    return json;
  };
  
  ipcMain.handle('licenseAdmin:login', async (_e, payload: unknown) => {
    try {
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const user = normalizeUser(p.username);
      const pass = normalizePass(p.password);
      if (!user) return { ok: false, error: 'Username is required.' };
      if (!pass) return { ok: false, error: 'Password is required.' };
      if (!verifyLogin(user, pass)) return { ok: false, error: 'Invalid credentials.' };
      adminSessionOk = true;
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to login') };
    }
  });
  
  ipcMain.handle('licenseAdmin:logout', async () => {
    adminSessionOk = false;
    return { ok: true };
  });
  
  ipcMain.handle('licenseAdmin:getAdminTokenStatus', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const origin = normalizeServerUrl(p.serverUrl);
      const configured = !!getAdminTokenForOrigin(origin);
      return { ok: true, configured };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to get token status') };
    }
  });
  
  ipcMain.handle('licenseAdmin:setAdminToken', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const token = String(p.token ?? '').trim();
      if (!token) return { ok: false, error: 'token is required.' };
      const origin = normalizeServerUrl(p.serverUrl);
      setAdminTokenForOrigin(origin, token);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to set token') };
    }
  });
  
  ipcMain.handle('licenseAdmin:getUser', async () => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const a = ensureAuth();
      return { ok: true, user: { username: a.username, updatedAt: a.updatedAt } };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to load user') };
    }
  });
  
  ipcMain.handle('licenseAdmin:updateUser', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const nextUser = normalizeUser(p.username);
      const nextPass = normalizePass(p.newPassword);
      if (!nextUser) return { ok: false, error: 'username is required.' };
      const current = ensureAuth();
      const updated = createAuth(nextUser, nextPass || getDefaultAdminPassword());
      if (!nextPass) {
        (updated as Record<string, unknown>).saltB64 = (current as Record<string, unknown>).saltB64;
        (updated as Record<string, unknown>).iterations = (
          current as Record<string, unknown>
        ).iterations;
        (updated as Record<string, unknown>).hashB64 = (current as Record<string, unknown>).hashB64;
      }
      kvSet(ADMIN_AUTH_KEY, JSON.stringify(updated));
      return { ok: true, user: { username: updated.username, updatedAt: updated.updatedAt } };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to update user') };
    }
  });
  
  ipcMain.handle('licenseAdmin:list', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const q = typeof p.q === 'string' ? p.q : '';
      const limit = Number.isFinite(Number(p.limit)) ? Number(p.limit) : undefined;
      const json = await postJson(serverUrl, '/api/license/admin/list', { q, limit });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to list licenses') };
    }
  });
  
  ipcMain.handle('licenseAdmin:get', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      const json = await postJson(serverUrl, '/api/license/admin/get', { licenseKey });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to fetch license') };
    }
  });
  
  ipcMain.handle('licenseAdmin:issue', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const body: Record<string, unknown> = {
        ...(p.licenseKey ? { licenseKey: String(p.licenseKey) } : {}),
        ...(p.expiresAt ? { expiresAt: String(p.expiresAt) } : {}),
        ...(Number.isFinite(Number(p.maxActivations))
          ? { maxActivations: Number(p.maxActivations) }
          : {}),
        ...(p.features && typeof p.features === 'object' ? { features: p.features } : {}),
      };
      const json = await postJson(serverUrl, '/api/license/admin/issue', body);
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to issue license') };
    }
  });
  
  ipcMain.handle('licenseAdmin:setStatus', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      const status = String(p.status || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      if (!status) return { ok: false, error: 'status is required.' };
      const json = await postJson(serverUrl, '/api/license/admin/setStatus', {
        licenseKey,
        status,
        ...(p.note ? { note: String(p.note) } : {}),
      });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to set status') };
    }
  });
  
  ipcMain.handle('licenseAdmin:activate', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      const deviceId = String(p.deviceId || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      if (!deviceId) return { ok: false, error: 'deviceId is required.' };
  
      const resp = await fetch(`${serverUrl}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, deviceId }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
        const msg = String(rec?.error || `HTTP ${resp.status}`).trim();
        return { ok: false, error: msg || 'Activate failed' };
      }
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to activate') };
    }
  });
  
  ipcMain.handle('licenseAdmin:checkStatus', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      const deviceId = String(p.deviceId || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      if (!deviceId) return { ok: false, error: 'deviceId is required.' };
  
      const resp = await fetch(`${serverUrl}/api/license/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, deviceId }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
        const msg = String(rec?.error || `HTTP ${resp.status}`).trim();
        return { ok: false, error: msg || 'Status check failed' };
      }
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to check status') };
    }
  });
  
  ipcMain.handle('licenseAdmin:saveLicenseFile', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const confirmPassword = String(p.confirmPassword || '').trim();
      if (!confirmPassword) return { ok: false, error: 'confirmPassword is required.' };
      const a = ensureAuth();
      if (!verifyLogin(a.username, confirmPassword))
        return { ok: false, error: 'Invalid password.' };
      const content = String(p.content || '');
      if (!content.trim()) return { ok: false, error: 'content is required.' };
      const safeName = String(p.defaultFileName || 'azrar-license.json')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 120);
      const defaultPath = path.join(app.getPath('documents'), safeName || 'azrar-license.json');
      const result = (await dialog.showSaveDialog({
        title: 'حفظ ملف الترخيص',
        defaultPath,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })) as any;
      if (result.canceled || !result.filePath) return { ok: false, error: 'Canceled' };
      await fsp.writeFile(result.filePath, content, 'utf8');
      return { ok: true, filePath: result.filePath };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to save file') };
    }
  });
  
  ipcMain.handle('licenseAdmin:updateAfterSales', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      const patch = p.patch && typeof p.patch === 'object' ? p.patch : {};
      const json = await postJson(serverUrl, '/api/license/admin/updateAfterSales', {
        licenseKey,
        patch,
      });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to update after-sales') };
    }
  });
  
  ipcMain.handle('licenseAdmin:unbindDevice', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      const deviceId = String(p.deviceId || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      if (!deviceId) return { ok: false, error: 'deviceId is required.' };
      const json = await postJson(serverUrl, '/api/license/admin/unbindDevice', {
        licenseKey,
        deviceId,
      });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to unbind device') };
    }
  });
  
  ipcMain.handle('licenseAdmin:delete', async (_e, payload: unknown) => {
    try {
      const auth = requireAdminSession();
      if (!auth.ok) return { ok: false, error: auth.error };
      const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const serverUrl = normalizeServerUrl(p.serverUrl);
      if (!serverUrl) return { ok: false, error: 'Invalid serverUrl.' };
      const licenseKey = String(p.licenseKey || '').trim();
      if (!licenseKey) return { ok: false, error: 'licenseKey is required.' };
      const json = await postJson(serverUrl, '/api/license/admin/delete', { licenseKey });
      return { ok: true, result: json };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to delete license') };
    }
  });
}
