import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sha256File = async (filePath) => {
  const buf = await fsp.readFile(filePath);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  return { bytes: buf.length, sha256 };
};

const main = async () => {
  // Keep list small: protect only critical entrypoints.
  const relPaths = [
    'electron/main.js',
    'electron/ipc.js',
    'electron/db.js',
    'electron/preload.cjs',
    'dist/index.html',
    'electron/assets/azrar-license-public.key.json',
  ];

  const files = {};
  for (const rel of relPaths) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(
        `Missing file for integrity manifest: ${rel}\n` +
          `Run: npm run build && npm run electron:build (or npm run verify) before generating.`
      );
    }
    files[rel] = await sha256File(abs);
  }

  const manifest = {
    v: 1,
    createdAt: new Date().toISOString(),
    algo: 'sha256',
    files,
  };

  const outPath = path.join(repoRoot, 'electron', 'assets', 'integrity.manifest.json');
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.warn(`[integrity] wrote ${path.relative(repoRoot, outPath)}`);
};

main().catch((e) => {
  console.error('[integrity] failed:', e && e.message ? e.message : e);
  process.exit(1);
});
