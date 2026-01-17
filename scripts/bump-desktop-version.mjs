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

function nextDesktopVersion(version) {
  // Desktop version policy:
  // - patch is a serial counter (0..99)
  // - after 99, roll to next minor and reset patch to 0
  // Examples:
  //   3.1.0  -> 3.1.1
  //   3.1.99 -> 3.2.0
  // Also supports large patch values by carrying into minor automatically.
  const v = parseSemver(version);
  if (!v) throw new Error(`Unsupported version format: ${version}`);

  const nextPatch = v.patch + 1;
  const minorCarry = Math.floor(nextPatch / 100);
  const patch = nextPatch % 100;

  const nextMinor = v.minor + minorCarry;
  const majorCarry = Math.floor(nextMinor / 100);
  const minor = nextMinor % 100;
  const major = v.major + majorCarry;

  return `${major}.${minor}.${patch}`;
}

async function main() {
  const raw = await fs.readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  const current = pkg.version;
  const next = nextDesktopVersion(current);

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
