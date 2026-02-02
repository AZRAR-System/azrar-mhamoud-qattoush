import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyAsync } from '@noble/ed25519';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const toStringOrUndef = (v) => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s : undefined;
};

const base64ToBytes = (b64) => new Uint8Array(Buffer.from(String(b64 || ''), 'base64'));
const utf8ToBytes = (s) => new TextEncoder().encode(String(s));

const canonicalizeLicensePayloadV1 = (payload) => {
  const canonical = {
    v: 1,
    product: 'AZRAR',
    deviceId: String(payload?.deviceId || ''),
    customer: toStringOrUndef(payload?.customer) ?? undefined,
    issuedAt: String(payload?.issuedAt || ''),
    expiresAt: toStringOrUndef(payload?.expiresAt) ?? undefined,
    features: Array.isArray(payload?.features) ? payload.features.map(String) : undefined,
  };
  return JSON.stringify(canonical);
};

const parseArgs = (argv) => {
  const out = { licensePath: undefined, deviceId: undefined, publicKeyB64: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--license' || a === '-l') out.licensePath = argv[++i];
    else if (a === '--device' || a === '--deviceId' || a === '-d') out.deviceId = argv[++i];
    else if (a === '--publicKey' || a === '--publicKeyB64' || a === '-p') out.publicKeyB64 = argv[++i];
  }
  return out;
};

const loadPublicKeyB64 = async (explicit) => {
  const envKey = String(process.env.VITE_AZRAR_LICENSE_PUBLIC_KEY || '').trim();
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  if (envKey) return envKey;

  // Developer convenience: fall back to repo secret public key if present.
  try {
    const p = path.join(rootDir, 'secrets', 'azrar-license-public.key.json');
    const raw = await fs.readFile(p, 'utf8');
    const parsed = JSON.parse(raw);
    const b64 = typeof parsed?.publicKeyB64 === 'string' ? parsed.publicKeyB64.trim() : '';
    if (b64) return b64;
  } catch {
    // ignore
  }

  return '';
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.licensePath) {
    console.error('Usage: node scripts/license-verify.mjs --license <path> [--deviceId <id>] [--publicKeyB64 <b64>]');
    process.exitCode = 2;
    return;
  }

  const publicKeyB64 = await loadPublicKeyB64(args.publicKeyB64);
  if (!publicKeyB64) {
    console.error('Missing public key. Provide VITE_AZRAR_LICENSE_PUBLIC_KEY or --publicKeyB64.');
    process.exitCode = 2;
    return;
  }

  const licenseFile = await fs.readFile(args.licensePath, 'utf8');
  const parsed = JSON.parse(String(licenseFile || '').trim());

  const payload = parsed?.payload;
  const sig = typeof parsed?.sig === 'string' ? parsed.sig.trim() : '';
  if (!sig) throw new Error('Missing sig in license file.');
  if (!payload || typeof payload !== 'object') throw new Error('Missing payload in license file.');
  if (payload.v !== 1) throw new Error('Unsupported license version.');
  if (payload.product !== 'AZRAR') throw new Error('Wrong product.');

  const deviceId = String(payload.deviceId || '').trim();
  if (!deviceId) throw new Error('Missing deviceId.');

  const expectedDeviceId = String(args.deviceId || '').trim();
  if (expectedDeviceId && deviceId !== expectedDeviceId) {
    throw new Error('DeviceId mismatch.');
  }

  if (payload.expiresAt) {
    const exp = new Date(String(payload.expiresAt));
    if (!Number.isFinite(exp.getTime())) throw new Error('Invalid expiresAt.');
    if (Date.now() > exp.getTime()) throw new Error('License expired.');
  }

  const msg = canonicalizeLicensePayloadV1(payload);
  const ok = await verifyAsync(base64ToBytes(sig), utf8ToBytes(msg), base64ToBytes(publicKeyB64));
  if (!ok) throw new Error('Invalid signature.');

  process.stdout.write('OK: license signature is valid.\n');
  process.stdout.write(`deviceId=${deviceId}\n`);
  if (payload.expiresAt) process.stdout.write(`expiresAt=${payload.expiresAt}\n`);
};

main().catch((e) => {
  console.error(`FAILED: ${e?.message || String(e)}`);
  process.exitCode = 1;
});
