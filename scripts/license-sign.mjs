import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPublicKeyAsync, signAsync } from '@noble/ed25519';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toStringOrUndef = (v) => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s : undefined;
};

const base64ToBytes = (b64) => new Uint8Array(Buffer.from(String(b64 || ''), 'base64'));
const bytesToBase64 = (bytes) => Buffer.from(bytes).toString('base64');
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
  const out = {
    privateKeyPath: undefined,
    privateKeyB64: undefined,
    deviceId: undefined,
    customer: undefined,
    expiresAt: undefined,
    outPath: undefined,
    features: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--privateKey' || a === '--privateKeyPath' || a === '-k') out.privateKeyPath = argv[++i];
    else if (a === '--privateKeyB64') out.privateKeyB64 = argv[++i];
    else if (a === '--deviceId' || a === '--device' || a === '-d') out.deviceId = argv[++i];
    else if (a === '--customer' || a === '-c') out.customer = argv[++i];
    else if (a === '--expiresAt' || a === '-e') out.expiresAt = argv[++i];
    else if (a === '--out' || a === '-o') out.outPath = argv[++i];
    else if (a === '--features' || a === '-f') out.features = argv[++i];
  }

  return out;
};

const loadPrivateKeyBytes = async (args) => {
  if (args.privateKeyB64 && String(args.privateKeyB64).trim()) {
    return base64ToBytes(String(args.privateKeyB64).trim());
  }

  const p = args.privateKeyPath ? String(args.privateKeyPath) : '';
  if (!p) return null;

  const raw = (await fs.readFile(p, 'utf8')).trim();
  if (!raw) return null;

  // support raw base64 or json { privateKeyB64 }
  try {
    const maybeJson = JSON.parse(raw);
    const b64 = typeof maybeJson?.privateKeyB64 === 'string' ? maybeJson.privateKeyB64.trim() : '';
    if (b64) return base64ToBytes(b64);
  } catch {
    // not json
  }

  return base64ToBytes(raw);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.deviceId) {
    console.error('Usage: node scripts/license-sign.mjs --privateKey <file> --deviceId <id> [--customer <name>] [--expiresAt <ISO>] [--features "a,b"] [--out <path>]');
    process.exitCode = 2;
    return;
  }

  const privateKeyBytes = await loadPrivateKeyBytes(args);
  if (!privateKeyBytes || privateKeyBytes.length !== 32) {
    console.error('Invalid private key. Expected base64 for 32 bytes, or json { privateKeyB64 }.');
    process.exitCode = 2;
    return;
  }

  const issuedAt = new Date().toISOString();
  const features = typeof args.features === 'string' && args.features.trim()
    ? args.features.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  const payload = {
    v: 1,
    product: 'AZRAR',
    deviceId: String(args.deviceId).trim(),
    issuedAt,
    expiresAt: toStringOrUndef(args.expiresAt),
    customer: toStringOrUndef(args.customer),
    features,
  };

  const msg = canonicalizeLicensePayloadV1(payload);
  const sigBytes = await signAsync(utf8ToBytes(msg), privateKeyBytes);
  const sig = bytesToBase64(sigBytes);

  const lic = { payload, sig };

  const outPath = args.outPath
    ? path.resolve(args.outPath)
    : path.resolve(__dirname, '..', 'tmp', `azrar-license-${payload.deviceId}.json`);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(lic, null, 2), 'utf8');

  const pub = await getPublicKeyAsync(privateKeyBytes);
  process.stdout.write('OK: license generated.\n');
  process.stdout.write(`out=${outPath}\n`);
  process.stdout.write(`publicKeyB64=${bytesToBase64(pub)}\n`);
};

main().catch((e) => {
  console.error(`FAILED: ${e?.message || String(e)}`);
  process.exitCode = 1;
});
