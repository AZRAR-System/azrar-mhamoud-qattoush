import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getPublicKeyAsync, signAsync } from '@noble/ed25519';
import crypto from 'node:crypto';
import { toErrorMessage } from './utils/errors';
import { tryParseJson } from './utils/json';

type LicensePayloadV1 = {
  v: 1;
  product: 'AZRAR';
  deviceId: string;
  issuedAt: string;
  expiresAt?: string;
  customer?: string;
  features?: string[];
};

type SignedLicenseFileV1 = {
  payload: LicensePayloadV1;
  sig: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Best-effort: ensure Chromium userData/caches use a writable location.
// Some environments (AV/OneDrive/policies) may deny AppData cache moves/creation.
try {
  const base = path.join(app.getPath('temp'), 'AZRAR-LicenseGen');
  const userDataDir = path.join(base, 'userData');
  const diskCacheDir = path.join(base, 'cache');
  const gpuCacheDir = path.join(base, 'gpu-cache');
  app.setPath('userData', userDataDir);
  app.setPath('cache', diskCacheDir);
  app.commandLine.appendSwitch('disk-cache-dir', diskCacheDir);
  app.commandLine.appendSwitch('gpu-disk-cache-dir', gpuCacheDir);
} catch {
  // ignore
}

try {
  // Avoid GPU/cache-related crashes on constrained environments.
  app.disableHardwareAcceleration();
} catch {
  // ignore
}

app.on('render-process-gone', (_e, _wc, details) => {
  try {
    console.error('[LicenseGen][render-process-gone]', JSON.stringify(details));
  } catch {
    // ignore
  }
});

app.on('child-process-gone', (_e, details) => {
  try {
    console.error('[LicenseGen][child-process-gone]', JSON.stringify(details));
  } catch {
    // ignore
  }
});

process.on('uncaughtException', (e: unknown) => {
  try {
    const msg = e instanceof Error ? (e.stack || e.message) : String(e);
    console.error('[LicenseGen][uncaughtException]', msg);
    void dialog.showErrorBox('AZRAR-LicenseGen', msg);
  } catch {
    // ignore
  }
});

process.on('unhandledRejection', (e: unknown) => {
  try {
    const msg = e instanceof Error ? (e.stack || e.message) : String(e);
    console.error('[LicenseGen][unhandledRejection]', msg);
    void dialog.showErrorBox('AZRAR-LicenseGen', msg);
  } catch {
    // ignore
  }
});

app.on('before-quit', () => {
  try {
    console.warn('[LicenseGen] before-quit');
  } catch {
    // ignore
  }
});

app.on('will-quit', () => {
  try {
    console.warn('[LicenseGen] will-quit');
  } catch {
    // ignore
  }
});

let mainWindow: BrowserWindow | null = null;
let privateKeyBytes: Uint8Array | null = null;
let publicKeyB64: string | null = null;
let expectedPublicKeyB64: string | null = null;

type LicenseGenCustomerProfileV1 = {
  name: string;
  seatCount?: number;
  defaultDurationDays?: number;
  defaultDurationMonths?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type LicenseGenIssuedLicenseV1 = {
  deviceId: string;
  customer?: string;
  issuedAt: string;
  expiresAt?: string;
  filePath?: string;
};

type LicenseGenStateV1 = {
  version: 1;
  lastPrivateKeyPath?: string;
  lastPrivateKeyFileName?: string;
  lastCustomer?: string;
  lastSeatCount?: number;
  lastDurationDays?: number;
  lastDurationMonths?: number;
  customers: LicenseGenCustomerProfileV1[];
  issuedLicenses: LicenseGenIssuedLicenseV1[];
};

const getStateFilePath = () => {
  return path.join(app.getPath('userData'), 'licensegen-state.json');
};

const readState = async (): Promise<LicenseGenStateV1> => {
  const fallback: LicenseGenStateV1 = { version: 1, customers: [], issuedLicenses: [] };
  try {
    const raw = await fsp.readFile(getStateFilePath(), 'utf8');
    const parsed = tryParseJson(String(raw || '').trim());
    if (!parsed || typeof parsed !== 'object') return fallback;
    const rec = parsed as Record<string, unknown>;
    const version = rec.version === 1 ? 1 : 1;
    const customers = Array.isArray(rec.customers) ? (rec.customers as unknown[]) : [];
    const issuedLicenses = Array.isArray(rec.issuedLicenses) ? (rec.issuedLicenses as unknown[]) : [];
    const safeCustomers: LicenseGenCustomerProfileV1[] = customers
      .map((c) => {
        if (!c || typeof c !== 'object') return null;
        const r = c as Record<string, unknown>;
        const name = String(r.name ?? '').trim();
        if (!name) return null;
        const seatCount = typeof r.seatCount === 'number' && Number.isFinite(r.seatCount) ? Math.max(0, Math.floor(r.seatCount)) : undefined;
        const defaultDurationDays = typeof r.defaultDurationDays === 'number' && Number.isFinite(r.defaultDurationDays)
          ? Math.max(0, Math.floor(r.defaultDurationDays))
          : undefined;
        const defaultDurationMonths = typeof r.defaultDurationMonths === 'number' && Number.isFinite(r.defaultDurationMonths)
          ? Math.max(0, Math.floor(r.defaultDurationMonths))
          : undefined;
        const notes = typeof r.notes === 'string' ? r.notes : undefined;
        const createdAt = typeof r.createdAt === 'string' && r.createdAt.trim() ? String(r.createdAt) : new Date().toISOString();
        const updatedAt = typeof r.updatedAt === 'string' && r.updatedAt.trim() ? String(r.updatedAt) : createdAt;
        return { name, seatCount, defaultDurationDays, defaultDurationMonths, notes, createdAt, updatedAt };
      })
      .filter(Boolean) as LicenseGenCustomerProfileV1[];

    const safeIssued: LicenseGenIssuedLicenseV1[] = issuedLicenses
      .map((x) => {
        if (!x || typeof x !== 'object') return null;
        const r = x as Record<string, unknown>;
        const deviceId = String(r.deviceId ?? '').trim();
        if (!deviceId) return null;
        const customer = typeof r.customer === 'string' && r.customer.trim() ? String(r.customer).trim() : undefined;
        const issuedAt = typeof r.issuedAt === 'string' && r.issuedAt.trim() ? String(r.issuedAt) : new Date().toISOString();
        const expiresAt = typeof r.expiresAt === 'string' && r.expiresAt.trim() ? String(r.expiresAt) : undefined;
        const filePath = typeof r.filePath === 'string' && r.filePath.trim() ? String(r.filePath) : undefined;
        return { deviceId, customer, issuedAt, expiresAt, filePath };
      })
      .filter(Boolean) as LicenseGenIssuedLicenseV1[];

    const state: LicenseGenStateV1 = {
      version,
      lastPrivateKeyPath: typeof rec.lastPrivateKeyPath === 'string' ? String(rec.lastPrivateKeyPath) : undefined,
      lastPrivateKeyFileName: typeof rec.lastPrivateKeyFileName === 'string' ? String(rec.lastPrivateKeyFileName) : undefined,
      lastCustomer: typeof rec.lastCustomer === 'string' ? String(rec.lastCustomer) : undefined,
      lastSeatCount: typeof rec.lastSeatCount === 'number' && Number.isFinite(rec.lastSeatCount) ? Math.max(0, Math.floor(rec.lastSeatCount)) : undefined,
      lastDurationDays: typeof rec.lastDurationDays === 'number' && Number.isFinite(rec.lastDurationDays) ? Math.max(0, Math.floor(rec.lastDurationDays)) : undefined,
      lastDurationMonths: typeof rec.lastDurationMonths === 'number' && Number.isFinite(rec.lastDurationMonths) ? Math.max(0, Math.floor(rec.lastDurationMonths)) : undefined,
      customers: safeCustomers,
      issuedLicenses: safeIssued,
    };
    return state;
  } catch {
    return fallback;
  }
};

const writeState = async (state: LicenseGenStateV1): Promise<void> => {
  const p = getStateFilePath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(state, null, 2), 'utf8');
};

const upsertCustomerProfile = (state: LicenseGenStateV1, next: Omit<LicenseGenCustomerProfileV1, 'createdAt' | 'updatedAt'>): LicenseGenStateV1 => {
  const name = String(next.name || '').trim();
  if (!name) return state;
  const now = new Date().toISOString();
  const idx = state.customers.findIndex((c) => c.name === name);
  const seatCount = typeof next.seatCount === 'number' && Number.isFinite(next.seatCount) ? Math.max(0, Math.floor(next.seatCount)) : undefined;
  const defaultDurationDays = typeof next.defaultDurationDays === 'number' && Number.isFinite(next.defaultDurationDays)
    ? Math.max(0, Math.floor(next.defaultDurationDays))
    : undefined;
  const defaultDurationMonths = typeof next.defaultDurationMonths === 'number' && Number.isFinite(next.defaultDurationMonths)
    ? Math.max(0, Math.floor(next.defaultDurationMonths))
    : undefined;
  const notes = typeof next.notes === 'string' && next.notes.trim() ? next.notes : undefined;

  if (idx >= 0) {
    const existing = state.customers[idx];
    const updated: LicenseGenCustomerProfileV1 = {
      ...existing,
      seatCount,
      defaultDurationDays,
      defaultDurationMonths,
      notes,
      updatedAt: now,
    };
    const customers = [...state.customers];
    customers[idx] = updated;
    return { ...state, customers };
  }

  const created: LicenseGenCustomerProfileV1 = {
    name,
    seatCount,
    defaultDurationDays,
    defaultDurationMonths,
    notes,
    createdAt: now,
    updatedAt: now,
  };
  return { ...state, customers: [created, ...state.customers] };
};

const countIssuedForCustomer = (state: LicenseGenStateV1, customerName: string): number => {
  const name = String(customerName || '').trim();
  if (!name) return 0;
  return state.issuedLicenses.filter((x) => String(x.customer || '').trim() === name).length;
};

const bytesToBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

const normalizeB64 = (raw: string): string => {
  const s = String(raw || '').trim().replace(/\s+/g, '');
  if (!s) return '';
  let out = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = out.length % 4;
  if (pad === 2) out += '==';
  else if (pad === 3) out += '=';
  else if (pad === 1) return '';
  return out;
};

const base64ToBytesSafe = (b64: string): Uint8Array => {
  const norm = normalizeB64(b64);
  if (!norm) return new Uint8Array();
  return new Uint8Array(Buffer.from(norm, 'base64'));
};

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const loadExpectedPublicKeyB64 = async (): Promise<string> => {
  const envKey = String(process.env.AZRAR_LICENSE_PUBLIC_KEY_B64 || process.env.VITE_AZRAR_LICENSE_PUBLIC_KEY || '').trim();
  if (envKey) return envKey;

  const candidates = [
    path.join(__dirname, 'assets', 'azrar-license-public.key.json'),
    path.join(process.resourcesPath, 'app.asar', 'electron', 'assets', 'azrar-license-public.key.json'),
    path.join(process.resourcesPath, 'electron', 'assets', 'azrar-license-public.key.json'),
  ];

  for (const p of candidates) {
    try {
      const raw = await fsp.readFile(p, 'utf8');
      const parsed = tryParseJson(String(raw || '').trim());
      const b64 = parsed && typeof parsed === 'object' && typeof parsed.publicKeyB64 === 'string' ? String(parsed.publicKeyB64).trim() : '';
      if (b64) return b64;
    } catch {
      // try next
    }
  }

  return '';
};

const isPrivateKeyMatchingExpected = (derivedPublicKeyB64: string): boolean => {
  if (!expectedPublicKeyB64) return true; // if not configured, don't block
  const a = base64ToBytesSafe(derivedPublicKeyB64);
  const b = base64ToBytesSafe(expectedPublicKeyB64);
  if (a.length !== 32 || b.length !== 32) return false;
  return bytesEqual(a, b);
};

const canonicalizePayload = (payload: LicensePayloadV1): string => {
  const canonical: LicensePayloadV1 = {
    v: 1,
    product: 'AZRAR',
    deviceId: String(payload.deviceId || ''),
    customer: payload.customer ? String(payload.customer) : undefined,
    issuedAt: String(payload.issuedAt || ''),
    expiresAt: payload.expiresAt ? String(payload.expiresAt) : undefined,
    features: Array.isArray(payload.features) ? payload.features.map(String) : undefined,
  };
  return JSON.stringify(canonical);
};

async function createMainWindow() {
  const preloadPath = path.join(__dirname, 'licensegen-preload.cjs');
  const htmlPath = path.join(__dirname, 'licensegen-renderer', 'index.html');

  const shouldForceAttention = !app.isPackaged;

  const workArea = (() => {
    try {
      return screen.getPrimaryDisplay().workArea;
    } catch {
      return { x: 0, y: 0, width: 980, height: 640 };
    }
  })();

  const width = Math.min(980, Math.max(720, workArea.width));
  const height = Math.min(640, Math.max(520, workArea.height));
  const x = workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2));
  const y = workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2));

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    resizable: true,
    autoHideMenuBar: true,
    alwaysOnTop: shouldForceAttention,
    show: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    try {
      mainWindow?.restore();
      if (shouldForceAttention) {
        mainWindow?.setAlwaysOnTop(true, 'floating');
        mainWindow?.flashFrame(true);
      }
      mainWindow?.show();
      mainWindow?.focus();
    } catch {
      // ignore
    }
  });

  mainWindow.on('show', () => {
    console.warn('[LicenseGen] window shown');
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[LicenseGen][did-fail-load]', { code, desc, url });
  });

  await mainWindow.loadFile(htmlPath);
  try {
    mainWindow.show();
    mainWindow.focus();
  } catch {
    // ignore
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('licensegen:pickPrivateKey', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: 'اختر مفتاح التوقيع (Private Key)',
      properties: ['openFile'],
      filters: [
        { name: 'Key Files', extensions: ['key', 'txt', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    };

    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const raw = (await fsp.readFile(filePath, 'utf8')).trim();
    if (!raw) return { ok: false, error: 'الملف فارغ.' };

    let b64 = raw;
    const parsed = tryParseJson(raw);
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as Record<string, unknown>;
      const maybe = rec.privateKeyB64 ?? rec.privateKey ?? rec.key;
      if (typeof maybe === 'string' && maybe.trim()) b64 = maybe.trim();
    }

    const bytes = base64ToBytesSafe(b64);
    if (bytes.length !== 32) {
      return { ok: false, error: 'صيغة المفتاح غير صحيحة. المطلوب Base64 لعدد 32 بايت.' };
    }

    privateKeyBytes = bytes;
    const pub = await getPublicKeyAsync(privateKeyBytes);
    publicKeyB64 = bytesToBase64(pub);

    if (expectedPublicKeyB64 && !isPrivateKeyMatchingExpected(publicKeyB64)) {
      privateKeyBytes = null;
      publicKeyB64 = null;
      return {
        ok: false,
        error:
          'هذا المفتاح الخاص لا يطابق مفتاح النظام. يرجى استخدام ملف azrar-license-private.key.json الصحيح (المطابق للمفتاح العام المثبّت في النظام).',
        derivedPublicKeyB64: bytesToBase64(pub),
        expectedPublicKeyB64,
      };
    }

    try {
      const st = await readState();
      await writeState({
        ...st,
        lastPrivateKeyPath: filePath,
        lastPrivateKeyFileName: path.basename(filePath),
      });
    } catch {
      // ignore
    }

    return { ok: true, publicKeyB64, fileName: path.basename(filePath) };
  } catch (e: unknown) {
    return { ok: false, error: toErrorMessage(e, 'تعذر تحميل المفتاح.') };
  }
});

ipcMain.handle('licensegen:generateKeypairAndSave', async () => {
  try {
    if (app.isPackaged) {
      return { ok: false, error: 'هذه النسخة لا تسمح بتوليد مفاتيح جديدة لتفادي تغيير مفتاح النظام بالخطأ.' };
    }

    const win = BrowserWindow.getFocusedWindow();
    const save = win
      ? await dialog.showSaveDialog(win, {
          title: 'حفظ مفتاح التوقيع (Private Key)',
          defaultPath: 'azrar-license-private.key.json',
          filters: [
            { name: 'Key File', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        })
      : await dialog.showSaveDialog({
      title: 'حفظ مفتاح التوقيع (Private Key)',
      defaultPath: 'azrar-license-private.key.json',
      filters: [
        { name: 'Key File', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      });

    if (save.canceled || !save.filePath) {
      return { ok: false, canceled: true };
    }

    const priv = new Uint8Array(crypto.randomBytes(32));
    const pub = await getPublicKeyAsync(priv);

    privateKeyBytes = priv;
    publicKeyB64 = bytesToBase64(pub);

    const privObj = { privateKeyB64: bytesToBase64(priv), note: 'KEEP THIS SECRET - used ONLY by license generator' };
    const pubObj = { publicKeyB64: publicKeyB64, note: 'Embed this in the app build (VITE_AZRAR_LICENSE_PUBLIC_KEY)' };

    const privatePath = save.filePath;
    const publicPath = path.join(path.dirname(privatePath), 'azrar-license-public.key.json');

    await fsp.writeFile(privatePath, JSON.stringify(privObj, null, 2), 'utf8');
    await fsp.writeFile(publicPath, JSON.stringify(pubObj, null, 2), 'utf8');

    try {
      const st = await readState();
      await writeState({
        ...st,
        lastPrivateKeyPath: privatePath,
        lastPrivateKeyFileName: path.basename(privatePath),
      });
    } catch {
      // ignore
    }

    return { ok: true, publicKeyB64, privatePath, publicPath };
  } catch (e: unknown) {
    return { ok: false, error: toErrorMessage(e, 'تعذر توليد المفتاح.') };
  }
});

ipcMain.handle('licensegen:generateAndSave', async (_e, payload: unknown) => {
  try {
    if (!privateKeyBytes) {
      return { ok: false, error: 'يرجى تحميل مفتاح التوقيع أولاً.' };
    }

    if (publicKeyB64 && expectedPublicKeyB64 && !isPrivateKeyMatchingExpected(publicKeyB64)) {
      return { ok: false, error: 'المفتاح الحالي لا يطابق مفتاح النظام. لا يمكن إنشاء ملف تفعيل بهذا المفتاح.' };
    }

    const rec = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
    const deviceId = String(rec.deviceId ?? '').trim();
    const customer = String(rec.customer ?? '').trim();
    const expiresAt = String(rec.expiresAt ?? '').trim();

    if (!deviceId) return { ok: false, error: 'بصمة الجهاز مطلوبة.' };

    if (expiresAt) {
      const d = new Date(expiresAt);
      if (!Number.isFinite(d.getTime())) return { ok: false, error: 'تاريخ الانتهاء غير صالح. استخدم ISO.' };
    }

    const licensePayload: LicensePayloadV1 = {
      v: 1,
      product: 'AZRAR',
      deviceId,
      issuedAt: new Date().toISOString(),
      expiresAt: expiresAt || undefined,
      customer: customer || undefined,
    };

    const msg = canonicalizePayload(licensePayload);
    const sigBytes = await signAsync(new TextEncoder().encode(msg), privateKeyBytes);

    const lic: SignedLicenseFileV1 = {
      payload: licensePayload,
      sig: bytesToBase64(sigBytes),
    };

    const win = BrowserWindow.getFocusedWindow();
    const save = win
      ? await dialog.showSaveDialog(win, {
          title: 'حفظ ملف التفعيل',
          defaultPath: `AZRAR-License-${deviceId}.json`,
          filters: [
            { name: 'Activation / License', extensions: ['json', 'lic'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        })
      : await dialog.showSaveDialog({
      title: 'حفظ ملف التفعيل',
      defaultPath: `AZRAR-License-${deviceId}.json`,
      filters: [
        { name: 'Activation / License', extensions: ['json', 'lic'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      });

    if (save.canceled || !save.filePath) {
      return { ok: false, canceled: true };
    }

    await fsp.writeFile(save.filePath, JSON.stringify(lic, null, 2), 'utf8');

    try {
      const st0 = await readState();
      const nextIssued: LicenseGenIssuedLicenseV1 = {
        deviceId,
        customer: customer || undefined,
        issuedAt: licensePayload.issuedAt,
        expiresAt: licensePayload.expiresAt,
        filePath: save.filePath,
      };

      let st = st0;
      if (customer) {
        st = upsertCustomerProfile(st, {
          name: customer,
          seatCount: st.lastSeatCount,
          defaultDurationDays: st.lastDurationDays,
          defaultDurationMonths: st.lastDurationMonths,
          notes: undefined,
        });
      }

      const issuedLicenses = [nextIssued, ...st.issuedLicenses].slice(0, 2000);
      await writeState({ ...st, issuedLicenses, lastCustomer: customer || st.lastCustomer });
    } catch {
      // ignore
    }

    return { ok: true, filePath: save.filePath };
  } catch (e: unknown) {
    return { ok: false, error: toErrorMessage(e, 'تعذر إنشاء ملف التفعيل.') };
  }
});

ipcMain.handle('licensegen:getState', async () => {
  try {
    const st = await readState();
    return {
      ok: true,
      state: st,
      runtime: {
        hasKey: !!privateKeyBytes,
        publicKeyB64: publicKeyB64 || '',
        expectedPublicKeyConfigured: !!expectedPublicKeyB64,
      },
      computed: {
        issuedCountByCustomer: Object.fromEntries(
          st.customers.map((c) => [c.name, countIssuedForCustomer(st, c.name)])
        ),
      },
    };
  } catch (e: unknown) {
    return { ok: false, error: toErrorMessage(e, 'تعذر قراءة حالة البرنامج.') };
  }
});

ipcMain.handle('licensegen:saveCustomer', async (_e, payload: unknown) => {
  try {
    const rec = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
    const name = String(rec.name ?? '').trim();
    if (!name) return { ok: false, error: 'اسم العميل مطلوب.' };
    const seatCount = typeof rec.seatCount === 'number' && Number.isFinite(rec.seatCount) ? Math.max(0, Math.floor(rec.seatCount)) : undefined;
    const defaultDurationDays = typeof rec.defaultDurationDays === 'number' && Number.isFinite(rec.defaultDurationDays)
      ? Math.max(0, Math.floor(rec.defaultDurationDays))
      : undefined;
    const defaultDurationMonths = typeof rec.defaultDurationMonths === 'number' && Number.isFinite(rec.defaultDurationMonths)
      ? Math.max(0, Math.floor(rec.defaultDurationMonths))
      : undefined;
    const notes = typeof rec.notes === 'string' ? rec.notes : undefined;

    const st0 = await readState();
    const st1 = upsertCustomerProfile(st0, { name, seatCount, defaultDurationDays, defaultDurationMonths, notes });
    await writeState(st1);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: toErrorMessage(e, 'تعذر حفظ بيانات العميل.') };
  }
});

ipcMain.handle('licensegen:setLastOptions', async (_e, payload: unknown) => {
  try {
    const rec = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
    const lastCustomer = typeof rec.lastCustomer === 'string' ? String(rec.lastCustomer).trim() : undefined;
    const lastSeatCount = typeof rec.lastSeatCount === 'number' && Number.isFinite(rec.lastSeatCount) ? Math.max(0, Math.floor(rec.lastSeatCount)) : undefined;
    const lastDurationDays = typeof rec.lastDurationDays === 'number' && Number.isFinite(rec.lastDurationDays)
      ? Math.max(0, Math.floor(rec.lastDurationDays))
      : undefined;
    const lastDurationMonths = typeof rec.lastDurationMonths === 'number' && Number.isFinite(rec.lastDurationMonths)
      ? Math.max(0, Math.floor(rec.lastDurationMonths))
      : undefined;

    const st0 = await readState();
    const st1: LicenseGenStateV1 = {
      ...st0,
      lastCustomer: lastCustomer || st0.lastCustomer,
      lastSeatCount,
      lastDurationDays,
      lastDurationMonths,
    };

    await writeState(st1);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: toErrorMessage(e, 'تعذر حفظ الإعدادات الأخيرة.') };
  }
});

ipcMain.handle('licensegen:forgetPrivateKey', async () => {
  try {
    privateKeyBytes = null;
    publicKeyB64 = null;
    const st0 = await readState();
    const st1: LicenseGenStateV1 = { ...st0 };
    delete st1.lastPrivateKeyPath;
    delete st1.lastPrivateKeyFileName;
    await writeState(st1);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: toErrorMessage(e, 'تعذر نسيان المفتاح.') };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.whenReady().then(async () => {
  try {
    const k = await loadExpectedPublicKeyB64();
    expectedPublicKeyB64 = k ? k.trim() : null;
    if (expectedPublicKeyB64) {
      console.warn('[LicenseGen] loaded expected public key');
    } else {
      console.warn('[LicenseGen] expected public key not configured');
    }
  } catch {
    // ignore
  }

  // Best-effort auto-load last used private key.
  try {
    const st = await readState();
    const filePath = String(st.lastPrivateKeyPath || '').trim();
    if (filePath) {
      const raw = (await fsp.readFile(filePath, 'utf8')).trim();
      if (raw) {
        let b64 = raw;
        const parsed = tryParseJson(raw);
        if (parsed && typeof parsed === 'object') {
          const rec = parsed as Record<string, unknown>;
          const maybe = rec.privateKeyB64 ?? rec.privateKey ?? rec.key;
          if (typeof maybe === 'string' && maybe.trim()) b64 = maybe.trim();
        }

        const bytes = base64ToBytesSafe(b64);
        if (bytes.length === 32) {
          const pub = await getPublicKeyAsync(bytes);
          const derived = bytesToBase64(pub);
          if (!expectedPublicKeyB64 || isPrivateKeyMatchingExpected(derived)) {
            privateKeyBytes = bytes;
            publicKeyB64 = derived;
            console.warn('[LicenseGen] auto-loaded last private key');
          } else {
            console.warn('[LicenseGen] last private key does not match expected public key; skipping');
          }
        }
      }
    }
  } catch {
    // ignore
  }

  await createMainWindow();
});
