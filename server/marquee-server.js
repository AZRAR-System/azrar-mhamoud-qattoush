const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.MARQUEE_PORT || process.env.PORT || 5055);
const HOST = process.env.MARQUEE_HOST || '0.0.0.0';

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'marquee.json');

function nowIso() {
  return new Date().toISOString();
}

function sendJson(res, statusCode, body, headers = {}) {
  const payload = Buffer.from(JSON.stringify(body ?? null));
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    ...headers,
  });
  res.end(payload);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-Match');
  res.setHeader('Access-Control-Expose-Headers', 'ETag');
}

async function ensureStore() {
  await fsp.mkdir(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    await fsp.writeFile(dataFile, JSON.stringify({ items: [] }, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fsp.readFile(dataFile, 'utf8');
  try {
    const json = JSON.parse(raw);
    if (!json || !Array.isArray(json.items)) return { items: [] };
    return json;
  } catch {
    return { items: [] };
  }
}

async function writeStore(store) {
  await ensureStore();
  await fsp.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

function computeEtag(content) {
  return 'W/"' + crypto.createHash('sha1').update(content).digest('hex') + '"';
}

function isExpired(item) {
  if (!item?.expiresAt) return false;
  const t = Date.parse(String(item.expiresAt));
  if (!Number.isFinite(t)) return false;
  return Date.now() > t;
}

async function getActiveItemsAndMaybeClean() {
  const store = await readStore();
  const before = store.items || [];
  const active = before.filter(it => !isExpired(it));
  if (active.length !== before.length) {
    await writeStore({ items: active });
  }
  return active;
}

async function readBodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, time: nowIso() });
      return;
    }

    if (url.pathname === '/api/marquee' && req.method === 'GET') {
      const items = await getActiveItemsAndMaybeClean();
      const raw = JSON.stringify({ items });
      const etag = computeEtag(raw);
      res.setHeader('ETag', etag);
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304);
        res.end();
        return;
      }
      sendJson(res, 200, { items }, { ETag: etag });
      return;
    }

    if (url.pathname === '/api/marquee' && req.method === 'POST') {
      const body = await readBodyJson(req);
      const content = String(body?.content ?? '').trim();
      if (!content) {
        sendJson(res, 400, { message: 'content is required' });
        return;
      }

      const durationHours = Number(body?.durationHours ?? 0);
      const expiresAt = body?.expiresAt ? String(body.expiresAt) : (durationHours > 0 ? new Date(Date.now() + durationHours * 3600_000).toISOString() : null);

      const record = {
        id: 'srv_' + crypto.randomBytes(8).toString('hex'),
        content,
        type: String(body?.type ?? 'info'),
        priority: String(body?.priority ?? 'Normal'),
        createdAt: nowIso(),
        expiresAt: expiresAt || undefined,
      };

      const store = await readStore();
      const next = { items: [record, ...(store.items || [])] };
      await writeStore(next);

      sendJson(res, 201, { item: record });
      return;
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/marquee/')) {
      const id = decodeURIComponent(url.pathname.substring('/api/marquee/'.length));
      const store = await readStore();
      const before = store.items || [];
      const after = before.filter(it => String(it?.id) !== id);
      await writeStore({ items: after });
      sendJson(res, 200, { success: true });
      return;
    }

    sendJson(res, 404, { message: 'Not Found' });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { message: 'Internal Server Error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[marquee-server] listening on http://${HOST}:${PORT}`);
});
