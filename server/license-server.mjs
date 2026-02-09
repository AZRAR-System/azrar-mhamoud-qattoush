import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashes, sign } from '@noble/ed25519';

// @noble/ed25519 requires sha512 to be configured in some environments.
// Use Node.js crypto for the local dev server.
if (!hashes.sha512) {
  hashes.sha512 = (message) => new Uint8Array(crypto.createHash('sha512').update(Buffer.from(message)).digest());
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.AZRAR_LICENSE_PORT || process.env.PORT || 5056);
const HOST = process.env.AZRAR_LICENSE_HOST || '0.0.0.0';

const ADMIN_TOKEN = String(process.env.AZRAR_LICENSE_ADMIN_TOKEN || '').trim();

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'licenses.json');

const nowIso = () => new Date().toISOString();

const clampStr = (v, maxLen) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

const normalizeOptionalIso = (v) => {
  const s = clampStr(v, 64);
  if (!s) return undefined;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return undefined;
  return new Date(t).toISOString();
};

const appendAudit = (rec, action, note, meta) => {
  try {
    rec.audit = Array.isArray(rec.audit) ? rec.audit : [];
    const entry = {
      at: nowIso(),
      action: clampStr(action, 64),
      ...(note ? { note: clampStr(note, 500) } : {}),
      ...(meta && typeof meta === 'object' ? { meta } : {}),
    };
    rec.audit.unshift(entry);
    if (rec.audit.length > 200) rec.audit.length = 200;
  } catch {
    // ignore
  }
};

const sendJson = (res, statusCode, body, headers = {}) => {
  const payload = Buffer.from(JSON.stringify(body ?? null));
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    ...headers,
  });
  res.end(payload);
};

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
};

const ensureStore = async () => {
  await fsp.mkdir(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    const init = { licenses: {} };
    await fsp.writeFile(dataFile, JSON.stringify(init, null, 2), 'utf8');
  }
};

const readStore = async () => {
  await ensureStore();
  try {
    const raw = await fsp.readFile(dataFile, 'utf8');
    const json = JSON.parse(String(raw || ''));
    if (!json || typeof json !== 'object') return { licenses: {} };
    if (!json.licenses || typeof json.licenses !== 'object') return { licenses: {} };
    return json;
  } catch {
    return { licenses: {} };
  }
};

const writeStore = async (store) => {
  await ensureStore();
  await fsp.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
};

const readBodyJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeKey = (s) => String(s || '').trim();

// License keys are treated case/whitespace-insensitively to avoid common copy/paste issues.
// Do NOT apply this normalization to deviceId, since device binding must remain exact.
const normalizeLicenseKey = (s) => String(s || '').trim().replace(/\s+/g, '').toUpperCase();

const normalizeDeviceId = (s) => String(s || '').trim().replace(/\s+/g, '');

const findLicenseRecord = (store, licenseKeyNormalized) => {
  try {
    const licenses = store?.licenses;
    if (!licenses || typeof licenses !== 'object') return null;
    if (licenses[licenseKeyNormalized]) return licenses[licenseKeyNormalized];
    const foundKey = Object.keys(licenses).find((k) => normalizeLicenseKey(k) === licenseKeyNormalized);
    return foundKey ? licenses[foundKey] : null;
  } catch {
    return null;
  }
};

const parseIsoOrNull = (s) => {
  if (!s) return null;
  const t = Date.parse(String(s));
  return Number.isFinite(t) ? t : null;
};

const canonicalizePayloadV1 = (payload) => {
  const canonical = {
    v: 1,
    deviceId: String(payload.deviceId || '').trim(),
    issuedAt: String(payload.issuedAt || '').trim(),
    ...(payload.expiresAt ? { expiresAt: String(payload.expiresAt).trim() } : {}),
    ...(payload.features && typeof payload.features === 'object' ? { features: payload.features } : {}),
  };
  return JSON.stringify(canonical);
};

const loadPrivateKey = async () => {
  // Option A: provide base64 directly.
  const b64 = String(process.env.AZRAR_LICENSE_PRIVATE_KEY_B64 || '').trim();
  if (b64) return Buffer.from(b64, 'base64');

  // Option B: point to a JSON file like secrets/azrar-license-private.key.json
  const keyFile = String(process.env.AZRAR_LICENSE_PRIVATE_KEY_FILE || '').trim();
  const candidates = [
    keyFile,
    path.join(__dirname, '..', 'secrets', 'azrar-license-private.key.json'),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      const raw = await fsp.readFile(p, 'utf8');
      const parsed = JSON.parse(String(raw || '').trim());
      const fileB64 = String(parsed?.privateKeyB64 || '').trim();
      if (fileB64) return Buffer.from(fileB64, 'base64');
    } catch {
      // try next
    }
  }

  return null;
};

const requireAdmin = (req) => {
  if (!ADMIN_TOKEN) return { ok: false, error: 'Server admin token not configured.' };
  const tok = String(req.headers['x-admin-token'] || '').trim();
  if (!tok || tok !== ADMIN_TOKEN) return { ok: false, error: 'Unauthorized' };
  return { ok: true };
};

const issueLicenseKey = () => {
  return 'LIC-' + crypto.randomBytes(16).toString('hex').toUpperCase();
};

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      sendJson(res, 200, {
        ok: true,
        service: 'azrar-license-server',
        time: nowIso(),
        endpoints: {
          health: { method: 'GET', path: '/health' },
          activate: { method: 'POST', path: '/api/license/activate' },
          status: { method: 'POST', path: '/api/license/status' },
          adminIssue: { method: 'POST', path: '/api/license/admin/issue', header: 'X-Admin-Token' },
          adminSetStatus: { method: 'POST', path: '/api/license/admin/setStatus', header: 'X-Admin-Token' },
          adminList: { method: 'POST', path: '/api/license/admin/list', header: 'X-Admin-Token' },
          adminGet: { method: 'POST', path: '/api/license/admin/get', header: 'X-Admin-Token' },
          adminDelete: { method: 'POST', path: '/api/license/admin/delete', header: 'X-Admin-Token' },
          adminUpdateAfterSales: { method: 'POST', path: '/api/license/admin/updateAfterSales', header: 'X-Admin-Token' },
        },
        note: 'This is an API server; most endpoints require POST with JSON body.',
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, time: nowIso() });
      return;
    }

    // Admin: issue a license key.
    if (req.method === 'POST' && url.pathname === '/api/license/admin/issue') {
      const auth = requireAdmin(req);
      if (!auth.ok) return sendJson(res, 401, { ok: false, error: auth.error });

      const body = await readBodyJson(req);
      const expiresAt = body?.expiresAt ? String(body.expiresAt) : undefined;
      const features = body?.features && typeof body.features === 'object' ? body.features : undefined;
      const maxActivations = Number.isFinite(Number(body?.maxActivations)) ? Number(body.maxActivations) : 1;

      const store = await readStore();
      const licenseKey = normalizeLicenseKey(body?.licenseKey) || issueLicenseKey();
      if (store.licenses[licenseKey]) {
        return sendJson(res, 409, { ok: false, error: 'License key already exists.' });
      }

      store.licenses[licenseKey] = {
        licenseKey,
        status: 'active',
        createdAt: nowIso(),
        expiresAt,
        features,
        maxActivations,
        activations: [],
        afterSales: {
          customer: {},
          note: '',
          followUp: { status: '' },
          updatedAt: nowIso(),
        },
        audit: [],
      };

      appendAudit(store.licenses[licenseKey], 'issued', '', { maxActivations, expiresAt: expiresAt || null });

      await writeStore(store);
      sendJson(res, 201, { ok: true, licenseKey, record: store.licenses[licenseKey] });
      return;
    }

    // Admin: change status (active/suspended/revoked)
    if (req.method === 'POST' && url.pathname === '/api/license/admin/setStatus') {
      const auth = requireAdmin(req);
      if (!auth.ok) return sendJson(res, 401, { ok: false, error: auth.error });

      const body = await readBodyJson(req);
      const licenseKey = normalizeLicenseKey(body?.licenseKey);
      const status = normalizeKey(body?.status);
      if (!licenseKey) return sendJson(res, 400, { ok: false, error: 'licenseKey is required' });
      if (!['active', 'suspended', 'revoked'].includes(status)) {
        return sendJson(res, 400, { ok: false, error: 'status must be active|suspended|revoked' });
      }

      const store = await readStore();
      const rec = findLicenseRecord(store, licenseKey);
      if (!rec) return sendJson(res, 404, { ok: false, error: 'Not found' });

      rec.status = status;
      rec.statusUpdatedAt = nowIso();
      rec.statusNote = body?.note ? String(body.note) : undefined;

      appendAudit(rec, 'status_changed', rec.statusNote || '', { status });

      await writeStore(store);
      sendJson(res, 200, { ok: true, record: rec });
      return;
    }

    // Admin: list/search licenses.
    if (req.method === 'POST' && url.pathname === '/api/license/admin/list') {
      const auth = requireAdmin(req);
      if (!auth.ok) return sendJson(res, 401, { ok: false, error: auth.error });

      const body = await readBodyJson(req);
      const qRaw = body?.q ? String(body.q) : '';
      const q = normalizeKey(qRaw).toUpperCase();
      const limit = Number.isFinite(Number(body?.limit)) ? Math.max(1, Math.min(500, Number(body.limit))) : 200;

      const store = await readStore();
      const all = Object.values(store.licenses || {});
      const filtered = q
        ? all.filter((r) => String(r.licenseKey || '').toUpperCase().includes(q))
        : all;

      filtered.sort((a, b) => {
        const ta = parseIsoOrNull(a?.createdAt) ?? 0;
        const tb = parseIsoOrNull(b?.createdAt) ?? 0;
        return tb - ta;
      });

      const items = filtered.slice(0, limit).map((r) => ({
        licenseKey: r.licenseKey,
        status: r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        maxActivations: r.maxActivations,
        activationsCount: Array.isArray(r.activations) ? r.activations.length : 0,
        statusUpdatedAt: r.statusUpdatedAt,
        statusNote: r.statusNote,
        customerName: r?.afterSales?.customer?.name,
        customerCompany: r?.afterSales?.customer?.company,
        customerPhone: r?.afterSales?.customer?.phone,
        customerCity: r?.afterSales?.customer?.city,
        followUpStatus: r?.afterSales?.followUp?.status,
        followUpLastContactAt: r?.afterSales?.followUp?.lastContactAt,
        followUpNextAt: r?.afterSales?.followUp?.nextAt,
      }));

      sendJson(res, 200, { ok: true, time: nowIso(), total: filtered.length, items });
      return;
    }

    // Admin: get full record (incl. activations) for a given licenseKey.
    if (req.method === 'POST' && url.pathname === '/api/license/admin/get') {
      const auth = requireAdmin(req);
      if (!auth.ok) return sendJson(res, 401, { ok: false, error: auth.error });

      const body = await readBodyJson(req);
      const licenseKey = normalizeLicenseKey(body?.licenseKey);
      if (!licenseKey) return sendJson(res, 400, { ok: false, error: 'licenseKey is required' });

      const store = await readStore();
      const rec = findLicenseRecord(store, licenseKey);
      if (!rec) return sendJson(res, 404, { ok: false, error: 'Not found' });

      sendJson(res, 200, { ok: true, time: nowIso(), record: rec });
      return;
    }

    // Admin: delete a license key (hard delete).
    if (req.method === 'POST' && url.pathname === '/api/license/admin/delete') {
      const auth = requireAdmin(req);
      if (!auth.ok) return sendJson(res, 401, { ok: false, error: auth.error });

      const body = await readBodyJson(req);
      const licenseKeyNorm = normalizeLicenseKey(body?.licenseKey);
      if (!licenseKeyNorm) return sendJson(res, 400, { ok: false, error: 'licenseKey is required' });

      const store = await readStore();
      const licenses = store.licenses && typeof store.licenses === 'object' ? store.licenses : {};

      let deletedKey = '';
      if (licenses[licenseKeyNorm]) {
        deletedKey = licenseKeyNorm;
      } else {
        const found = Object.keys(licenses).find((k) => normalizeLicenseKey(k) === licenseKeyNorm);
        if (found) deletedKey = found;
      }

      if (!deletedKey) return sendJson(res, 404, { ok: false, error: 'Not found' });

      delete licenses[deletedKey];
      store.licenses = licenses;
      await writeStore(store);

      sendJson(res, 200, { ok: true, time: nowIso(), deleted: { licenseKey: licenseKeyNorm } });
      return;
    }

    // Admin: update after-sales metadata (customer + notes + follow-up) for a given licenseKey.
    if (req.method === 'POST' && url.pathname === '/api/license/admin/updateAfterSales') {
      const auth = requireAdmin(req);
      if (!auth.ok) return sendJson(res, 401, { ok: false, error: auth.error });

      const body = await readBodyJson(req);
      const licenseKey = normalizeLicenseKey(body?.licenseKey);
      if (!licenseKey) return sendJson(res, 400, { ok: false, error: 'licenseKey is required' });

      const store = await readStore();
      const rec = findLicenseRecord(store, licenseKey);
      if (!rec) return sendJson(res, 404, { ok: false, error: 'Not found' });

      rec.afterSales = rec.afterSales && typeof rec.afterSales === 'object' ? rec.afterSales : {};
      rec.afterSales.customer = rec.afterSales.customer && typeof rec.afterSales.customer === 'object'
        ? rec.afterSales.customer
        : {};
      rec.afterSales.followUp = rec.afterSales.followUp && typeof rec.afterSales.followUp === 'object'
        ? rec.afterSales.followUp
        : { status: '' };

      const patch = body?.patch && typeof body.patch === 'object' ? body.patch : {};

      const cust = patch?.customer && typeof patch.customer === 'object' ? patch.customer : null;
      if (cust) {
        const name = clampStr(cust?.name, 120);
        const company = clampStr(cust?.company, 160);
        const phone = clampStr(cust?.phone, 64);
        const city = clampStr(cust?.city, 80);

        if (name) rec.afterSales.customer.name = name;
        else if (cust?.name !== undefined) delete rec.afterSales.customer.name;
        if (company) rec.afterSales.customer.company = company;
        else if (cust?.company !== undefined) delete rec.afterSales.customer.company;
        if (phone) rec.afterSales.customer.phone = phone;
        else if (cust?.phone !== undefined) delete rec.afterSales.customer.phone;
        if (city) rec.afterSales.customer.city = city;
        else if (cust?.city !== undefined) delete rec.afterSales.customer.city;
      }

      if (patch?.note !== undefined) {
        const note = clampStr(patch.note, 2000);
        rec.afterSales.note = note;
      }

      const fu = patch?.followUp && typeof patch.followUp === 'object' ? patch.followUp : null;
      if (fu) {
        const status = clampStr(fu?.status, 64);
        const lastContactAt = normalizeOptionalIso(fu?.lastContactAt);
        const nextAt = normalizeOptionalIso(fu?.nextAt);

        if (status) rec.afterSales.followUp.status = status;
        else if (fu?.status !== undefined) rec.afterSales.followUp.status = '';

        if (lastContactAt) rec.afterSales.followUp.lastContactAt = lastContactAt;
        else if (fu?.lastContactAt !== undefined) delete rec.afterSales.followUp.lastContactAt;

        if (nextAt) rec.afterSales.followUp.nextAt = nextAt;
        else if (fu?.nextAt !== undefined) delete rec.afterSales.followUp.nextAt;
      }

      rec.afterSales.updatedAt = nowIso();
      appendAudit(rec, 'after_sales_updated', clampStr(patch?.logNote, 500), {
        customer: rec.afterSales.customer,
        followUp: rec.afterSales.followUp,
      });

      await writeStore(store);
      sendJson(res, 200, { ok: true, time: nowIso(), record: rec });
      return;
    }

    // Client: status check
    if (req.method === 'POST' && url.pathname === '/api/license/status') {
      const body = await readBodyJson(req);
      const licenseKey = normalizeLicenseKey(body?.licenseKey);
      const deviceId = normalizeDeviceId(body?.deviceId);
      if (!licenseKey) return sendJson(res, 400, { ok: false, error: 'licenseKey is required' });
      if (!deviceId) return sendJson(res, 400, { ok: false, error: 'deviceId is required' });

      const store = await readStore();
      const rec = findLicenseRecord(store, licenseKey);
      if (!rec) return sendJson(res, 404, { ok: false, error: 'invalid_license' });

      const exp = parseIsoOrNull(rec.expiresAt);
      if (exp !== null && Date.now() > exp) {
        return sendJson(res, 200, { ok: true, time: nowIso(), status: 'expired' });
      }

      if (rec.status === 'suspended') {
        return sendJson(res, 200, {
          ok: true,
          time: nowIso(),
          status: 'suspended',
          statusUpdatedAt: rec.statusUpdatedAt,
          statusNote: rec.statusNote,
        });
      }
      if (rec.status === 'revoked') {
        return sendJson(res, 200, {
          ok: true,
          time: nowIso(),
          status: 'revoked',
          statusUpdatedAt: rec.statusUpdatedAt,
          statusNote: rec.statusNote,
        });
      }

      const bound = rec.activations?.[0]?.deviceId;
      if (bound && bound !== deviceId) {
        return sendJson(res, 200, { ok: true, time: nowIso(), status: 'mismatch' });
      }

      return sendJson(res, 200, {
        ok: true,
        time: nowIso(),
        status: 'active',
        statusUpdatedAt: rec.statusUpdatedAt,
        statusNote: rec.statusNote,
      });
    }

    // Client: activate/bind device → returns signed offline license JSON
    if (req.method === 'POST' && url.pathname === '/api/license/activate') {
      const body = await readBodyJson(req);
      const licenseKey = normalizeLicenseKey(body?.licenseKey);
      const deviceId = normalizeDeviceId(body?.deviceId);
      if (!licenseKey) return sendJson(res, 400, { ok: false, error: 'licenseKey is required' });
      if (!deviceId) return sendJson(res, 400, { ok: false, error: 'deviceId is required' });

      const store = await readStore();
      const rec = findLicenseRecord(store, licenseKey);
      if (!rec) return sendJson(res, 404, { ok: false, error: 'invalid_license' });

      const exp = parseIsoOrNull(rec.expiresAt);
      if (exp !== null && Date.now() > exp) {
        return sendJson(res, 403, { ok: false, time: nowIso(), error: 'expired' });
      }

      if (rec.status === 'suspended') return sendJson(res, 403, { ok: false, time: nowIso(), error: 'suspended' });
      if (rec.status === 'revoked') return sendJson(res, 403, { ok: false, time: nowIso(), error: 'revoked' });

      rec.activations = Array.isArray(rec.activations) ? rec.activations : [];
      const maxActivations = Number.isFinite(Number(rec.maxActivations)) ? Number(rec.maxActivations) : 1;

      const existing = rec.activations.find((a) => String(a?.deviceId) === deviceId);
      if (!existing) {
        // If already activated for a different device and max=1, reject.
        if (rec.activations.length >= maxActivations) {
          return sendJson(res, 409, { ok: false, time: nowIso(), error: 'requires_new_activation' });
        }
        rec.activations.unshift({ deviceId, at: nowIso() });
        appendAudit(rec, 'device_activated', '', { deviceId });
      }

      rec.lastSeenAt = nowIso();
      await writeStore(store);

      const privateKey = await loadPrivateKey();
      if (!privateKey) {
        return sendJson(res, 500, { ok: false, error: 'Missing license private key on server.' });
      }

      const payload = {
        v: 1,
        deviceId,
        issuedAt: nowIso(),
        ...(rec.expiresAt ? { expiresAt: String(rec.expiresAt) } : {}),
        ...(rec.features ? { features: rec.features } : {}),
      };

      const msg = canonicalizePayloadV1(payload);
      const sigBytes = await sign(Buffer.from(msg, 'utf8'), privateKey);
      const signedLicense = {
        payload,
        sig: Buffer.from(sigBytes).toString('base64'),
      };

      return sendJson(res, 200, { ok: true, time: nowIso(), signedLicense });
    }

    sendJson(res, 404, { ok: false, error: 'Not Found' });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { ok: false, error: 'Internal Server Error' });
  }
});

server.on('error', (err) => {
  const code = String(err?.code || '').trim();
  if (code === 'EADDRINUSE') {
    console.error(
      `[license-server] PORT in use: http://${HOST}:${PORT}\n` +
        `- غيّر المنفذ عبر AZRAR_LICENSE_PORT أو أوقف العملية التي تستخدمه.`
    );
    process.exit(1);
  }

  console.error('[license-server] server error:', err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  // Use warn/error only to satisfy repo lint rules.
  console.warn(`[license-server] listening on http://${HOST}:${PORT}`);
  console.warn(`[license-server] data file: ${dataFile}`);
});
