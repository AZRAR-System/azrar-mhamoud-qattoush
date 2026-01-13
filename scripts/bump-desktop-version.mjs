import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

const dryRun = process.argv.includes('--dry-run');

function parseSemver(version) {
  const m = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function nextPatch(version) {
  const v = parseSemver(version);
  if (!v) throw new Error(`Unsupported version format: ${version}`);
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

async function main() {
  const raw = await fs.readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  const current = pkg.version;
  const next = nextPatch(current);

  if (dryRun) {
    console.log(next);
    return;
  }

  pkg.version = next;
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // Keep package-lock in sync (npm expects it).
  try {
    const lockRaw = await fs.readFile(lockPath, 'utf8');
    const lock = JSON.parse(lockRaw);
    lock.version = next;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = next;
    }
    await fs.writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  } catch {
    // ignore if missing or unparsable
  }

  console.log(next);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
