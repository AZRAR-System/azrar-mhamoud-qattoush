import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { hashes, utils as edUtils, getPublicKey } from '@noble/ed25519';

// @noble/ed25519 requires sha512 to be configured in some environments.
// Use Node.js crypto here to keep dev scripts self-contained.
if (!hashes.sha512) {
  hashes.sha512 = (message) => new Uint8Array(crypto.createHash('sha512').update(Buffer.from(message)).digest());
}

const workspaceRoot = process.cwd();
const secretsDir = path.join(workspaceRoot, 'secrets');
const privateKeyFile = path.join(secretsDir, 'azrar-license-private.key.json');
const publicKeyFile = path.join(workspaceRoot, 'electron', 'assets', 'azrar-license-public.key.json');

const nowIso = () => new Date().toISOString();

const writeJson = async (filePath, obj) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8');
};

const toB64 = (u8) => Buffer.from(u8).toString('base64');

const main = async () => {
  const privateKey = edUtils.randomSecretKey();
  const publicKey = await getPublicKey(privateKey);

  const privateKeyB64 = toB64(privateKey);
  const publicKeyB64 = toB64(publicKey);

  const generatedAt = nowIso();

  await writeJson(privateKeyFile, {
    privateKeyB64,
    publicKeyB64,
    generatedAt,
    note: 'DEV ONLY: keep this private key secret. Do not commit.'
  });

  await writeJson(publicKeyFile, {
    publicKeyB64,
    generatedAt,
    note: 'Public key for AZRAR license verification (safe to embed)'
  });

  console.error('[license-keys] generated');
  console.error('private:', privateKeyFile);
  console.error('public :', publicKeyFile);
  console.error('AZRAR_LICENSE_PRIVATE_KEY_FILE=' + privateKeyFile);
  console.error('AZRAR_LICENSE_PUBLIC_KEY_B64=' + publicKeyB64);
};

main().catch((e) => {
  console.error('[license-keys] failed:', e);
  process.exit(1);
});
