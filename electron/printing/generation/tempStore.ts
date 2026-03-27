import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

const ensureDir = async (dir: string): Promise<void> => {
  await fsp.mkdir(dir, { recursive: true });
};

export const getPrintTempDir = async (): Promise<string> => {
  const dir = path.join(app.getPath('userData'), 'printing', 'tmp');
  await ensureDir(dir);
  return dir;
};

const safeStem = (v: string): string =>
  String(v || 'document')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'document';

export const writeTempFile = async (opts: {
  ext: 'docx' | 'pdf';
  baseName?: string;
  bytes: Buffer;
}): Promise<{ tempPath: string; fileName: string }> => {
  const dir = await getPrintTempDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(6).toString('hex');

  const stem = safeStem(opts.baseName || 'document');
  const fileName = `${stem}_${stamp}_${rand}.${opts.ext}`;
  const tempPath = path.join(dir, fileName);

  await fsp.writeFile(tempPath, opts.bytes);

  return { tempPath, fileName };
};

export const cleanupTempDir = async (keepNewest = 80): Promise<void> => {
  try {
    const dir = await getPrintTempDir();
    const items = await fsp.readdir(dir);

    const files = await Promise.all(
      items.map(async (name) => {
        const p = path.join(dir, name);
        try {
          const st = await fsp.stat(p);
          return st.isFile() ? { name, p, mtimeMs: st.mtimeMs } : null;
        } catch {
          return null;
        }
      })
    );

    const sorted = files
      .filter((x): x is { name: string; p: string; mtimeMs: number } => !!x)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    const toDelete = sorted.slice(Math.max(0, keepNewest));
    await Promise.all(
      toDelete.map(async (f) => {
        try {
          await fsp.unlink(f.p);
        } catch {
          // ignore
        }
      })
    );
  } catch {
    // ignore
  }
};
