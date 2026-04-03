import { app, safeStorage, shell } from 'electron';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import {
  getGoogleOAuthClientId,
  GOOGLE_CALENDAR_SCOPES,
  GOOGLE_OAUTH_AUTH,
  GOOGLE_OAUTH_REDIRECT_PATH,
  GOOGLE_OAUTH_REDIRECT_PORT,
  GOOGLE_OAUTH_REDIRECT_URI,
  GOOGLE_OAUTH_TOKEN,
  SAFE_STORAGE_GOOGLE_KEY,
} from './config.js';

export type StoredGoogleTokens = {
  accessToken: string;
  refreshToken?: string;
  /** Unix ms */
  accessTokenExpiresAt?: number;
};

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

function codeChallengeS256(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier, 'utf8').digest());
}

function encryptTokensJson(tokens: StoredGoogleTokens): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('تعذر تخزين بيانات Google بأمان: التشفير غير متاح على هذا الجهاز.');
  }
  const raw = JSON.stringify(tokens);
  return safeStorage.encryptString(raw);
}

function decryptTokensJson(buf: Buffer): StoredGoogleTokens | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const s = safeStorage.decryptString(buf);
    const j = JSON.parse(s) as StoredGoogleTokens;
    if (!j || typeof j.accessToken !== 'string') return null;
    return j;
  } catch {
    return null;
  }
}

function tokenFilePath(): string {
  return path.join(app.getPath('userData'), `${SAFE_STORAGE_GOOGLE_KEY}.bin`);
}

export function loadTokensFromSafeStorage(): StoredGoogleTokens | null {
  try {
    const p = tokenFilePath();
    if (!fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p);
    return decryptTokensJson(buf);
  } catch {
    return null;
  }
}

export function saveTokensToSafeStorage(tokens: StoredGoogleTokens): void {
  const p = tokenFilePath();
  const enc = encryptTokensJson(tokens);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, enc);
}

export function clearTokensFromSafeStorage(): void {
  try {
    const p = tokenFilePath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

export function hasValidTokens(): boolean {
  const t = loadTokensFromSafeStorage();
  return !!(t?.accessToken || t?.refreshToken);
}

async function postForm(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const bodyStr = new URLSearchParams(body).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyStr,
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = String(j.error || j.error_description || res.statusText || 'token_error');
    throw new Error(err);
  }
  return j;
}

export async function refreshAccessTokenIfNeeded(): Promise<StoredGoogleTokens | null> {
  let t = loadTokensFromSafeStorage();
  if (!t?.refreshToken && !t?.accessToken) return null;

  const now = Date.now();
  const skew = 60_000;
  if (t.accessToken && t.accessTokenExpiresAt && t.accessTokenExpiresAt - skew > now) {
    return t;
  }
  if (!t.refreshToken) return t;

  const clientId = getGoogleOAuthClientId();
  if (!clientId || clientId.startsWith('YOUR_')) {
    throw new Error('لم يُضبط معرّف عميل Google (AZRAR_GOOGLE_CALENDAR_CLIENT_ID).');
  }

  const j = await postForm(GOOGLE_OAUTH_TOKEN, {
    grant_type: 'refresh_token',
    refresh_token: t.refreshToken,
    client_id: clientId,
  });

  const accessToken = String(j.access_token || '');
  const expiresIn = Number(j.expires_in || 3600);
  if (!accessToken) throw new Error('رد غير صالح من Google عند تجديد الرمز.');

  const next: StoredGoogleTokens = {
    accessToken,
    refreshToken: t.refreshToken,
    accessTokenExpiresAt: Date.now() + expiresIn * 1000,
  };
  saveTokensToSafeStorage(next);
  return next;
}

function parseQuery(u: string): Record<string, string> {
  const q: Record<string, string> = {};
  try {
    const url = new URL(u, 'http://127.0.0.1');
    url.searchParams.forEach((v, k) => {
      q[k] = v;
    });
  } catch {
    // ignore
  }
  return q;
}

/**
 * Starts loopback OAuth with PKCE; opens system browser; resolves when redirect hits /callback.
 */
export async function startAuthorizationCodeFlowPkce(): Promise<StoredGoogleTokens> {
  const clientId = getGoogleOAuthClientId();
  if (!clientId || clientId.startsWith('YOUR_')) {
    throw new Error('اضبط معرّف عميل Google في الإعدادات أو متغير AZRAR_GOOGLE_CALENDAR_CLIENT_ID.');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeChallengeS256(codeVerifier);
  const state = base64Url(randomBytes(24));

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: [...GOOGLE_CALENDAR_SCOPES].join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `${GOOGLE_OAUTH_AUTH}?${authParams.toString()}`;

  return await new Promise<StoredGoogleTokens>((resolve, reject) => {
    let server: Server | undefined;
    const timer = setTimeout(() => {
      try {
        server?.close();
      } catch {
        // ignore
      }
      reject(new Error('انتهت مهلة تسجيل الدخول في Google.'));
    }, 300_000);

    const cleanup = () => {
      clearTimeout(timer);
      try {
        server?.close();
      } catch {
        // ignore
      }
    };

    server = createServer((req: IncomingMessage, res) => {
      try {
        const url = String(req.url || '');
        if (!url.startsWith(GOOGLE_OAUTH_REDIRECT_PATH)) {
          res.writeHead(404);
          res.end();
          return;
        }

        const full = `http://127.0.0.1${url}`;
        const q = parseQuery(full);
        if (q.error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            `<!DOCTYPE html><html><body dir="rtl"><p>فشل التفويض: ${String(
              q.error
            )}</p><p>يمكنك إغلاق هذه النافذة.</p></body></html>`
          );
          cleanup();
          reject(new Error(String(q.error)));
          return;
        }

        if (q.state !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<!DOCTYPE html><html><body>state غير صالح.</body></html>');
          cleanup();
          reject(new Error('state غير صالح'));
          return;
        }

        const code = String(q.code || '');
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<!DOCTYPE html><html><body>لم يُرجع رمز التفويض.</body></html>');
          cleanup();
          reject(new Error('لم يُرجع رمز التفويض'));
          return;
        }

        void (async () => {
          try {
            const j = await postForm(GOOGLE_OAUTH_TOKEN, {
              grant_type: 'authorization_code',
              code,
              redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
              client_id: clientId,
              code_verifier: codeVerifier,
            });

            const accessToken = String(j.access_token || '');
            const refreshToken = typeof j.refresh_token === 'string' ? j.refresh_token : undefined;
            const expiresIn = Number(j.expires_in || 3600);
            if (!accessToken) throw new Error('لم يُرجع رمز وصول من Google.');

            const tokens: StoredGoogleTokens = {
              accessToken,
              ...(refreshToken ? { refreshToken } : {}),
              accessTokenExpiresAt: Date.now() + expiresIn * 1000,
            };
            saveTokensToSafeStorage(tokens);

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(
              '<!DOCTYPE html><html><body dir="rtl"><p>تم الربط بنجاح. يمكنك إغلاق هذه النافذة والعودة إلى AZRAR.</p></body></html>'
            );
            cleanup();
            resolve(tokens);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html><html><body dir="rtl"><p>فشل تبادل الرمز: ${msg}</p></body></html>`);
            cleanup();
            reject(e instanceof Error ? e : new Error(msg));
          }
        })();
      } catch (e: unknown) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

    server.listen(GOOGLE_OAUTH_REDIRECT_PORT, '127.0.0.1', () => {
      try {
        void shell.openExternal(authUrl);
      } catch (e: unknown) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      cleanup();
      if (err.code === 'EADDRINUSE') {
        reject(
          new Error(
            `المنفذ ${GOOGLE_OAUTH_REDIRECT_PORT} مستخدم. أغلق التطبيقات الأخرى أو اضبط التفويض لاستخدام نفس المنفذ.`
          )
        );
      } else {
        reject(err);
      }
    });
  });
}

export function signOutGoogle(): void {
  clearTokensFromSafeStorage();
}
