import { getPublicKeyAsync } from '@noble/ed25519';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const outIdx = args.findIndex((a) => a === '--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : 'secrets';

const bytesToBase64 = (bytes) => Buffer.from(bytes).toString('base64');
const writeLine = (s) => {
  process.stdout.write(`${s}\n`);
};

const main = async () => {
  const priv = new Uint8Array(crypto.randomBytes(32));
  const pub = await getPublicKeyAsync(priv);

  const privateKeyB64 = bytesToBase64(priv);
  const publicKeyB64 = bytesToBase64(pub);

  const objPriv = { privateKeyB64, note: 'KEEP THIS SECRET - used ONLY by license generator' };
  const objPub = { publicKeyB64, note: 'Embed this in the app build (VITE_AZRAR_LICENSE_PUBLIC_KEY)' };

  writeLine('=== AZRAR License Keys (Ed25519) ===');
  writeLine(`publicKeyB64: ${publicKeyB64}`);
  writeLine(`privateKeyB64: ${privateKeyB64}`);

  const dir = path.resolve(outDir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'azrar-license-private.key.json'), JSON.stringify(objPriv, null, 2), 'utf8');
  await fs.writeFile(path.join(dir, 'azrar-license-public.key.json'), JSON.stringify(objPub, null, 2), 'utf8');
  writeLine(`Wrote: ${path.join(dir, 'azrar-license-private.key.json')}`);
  writeLine(`Wrote: ${path.join(dir, 'azrar-license-public.key.json')}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
