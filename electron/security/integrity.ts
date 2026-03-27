import { app, dialog } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

type ManifestFile = { bytes: number; sha256: string };

type IntegrityManifestV1 = {
  v: 1;
  createdAt: string;
  algo: 'sha256';
  files: Record<string, ManifestFile>;
};

const readJson = async (p: string): Promise<unknown> => {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(String(raw || '').trim());
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const parseManifest = (v: unknown): IntegrityManifestV1 | null => {
  if (!isRecord(v)) return null;
  if (v.v !== 1) return null;
  if (v.algo !== 'sha256') return null;
  if (!isRecord(v.files)) return null;

  const files: Record<string, ManifestFile> = {};
  for (const [k, val] of Object.entries(v.files)) {
    if (!isRecord(val)) return null;
    const bytes = Number(val.bytes);
    const sha256 = String(val.sha256 || '');
    if (!Number.isFinite(bytes) || bytes < 0) return null;
    if (!/^[a-f0-9]{64}$/i.test(sha256)) return null;
    files[k] = { bytes, sha256: sha256.toLowerCase() };
  }

  return {
    v: 1,
    createdAt: String(v.createdAt || ''),
    algo: 'sha256',
    files,
  };
};

const sha256BufferHex = (buf: Buffer): string => {
  return crypto.createHash('sha256').update(buf).digest('hex');
};

export async function verifyAppIntegrityOrQuit(): Promise<void> {
  // Dev builds are mutable; do not enforce.
  if (!app.isPackaged) return;

  // Support break-glass for support/debugging.
  const allow = String(process.env.AZRAR_ALLOW_TAMPERED_APP || '')
    .trim()
    .toLowerCase();
  if (allow === '1' || allow === 'true') return;

  const appPath = app.getAppPath();
  const manifestPath = path.join(appPath, 'electron', 'assets', 'integrity.manifest.json');

  let manifest: IntegrityManifestV1 | null = null;
  try {
    manifest = parseManifest(await readJson(manifestPath));
  } catch {
    manifest = null;
  }

  if (!manifest) {
    try {
      dialog.showMessageBoxSync({
        type: 'error',
        title: 'خطأ في سلامة التطبيق',
        message: 'تعذر التحقق من سلامة ملفات التطبيق',
        detail:
          'ملف التحقق (Integrity Manifest) غير موجود أو تالف.\n' +
          'يرجى إعادة تثبيت البرنامج من المصدر الرسمي.',
        buttons: ['إغلاق'],
      });
    } catch {
      // ignore
    }
    app.quit();
    return;
  }

  const failures: string[] = [];
  for (const [rel, expected] of Object.entries(manifest.files)) {
    const abs = path.join(appPath, rel);
    try {
      const buf = await fs.readFile(abs);
      const gotBytes = buf.length;
      const gotHash = sha256BufferHex(buf);
      if (gotBytes !== expected.bytes || gotHash !== expected.sha256) {
        failures.push(rel);
      }
    } catch {
      failures.push(rel);
    }
  }

  if (failures.length === 0) return;

  try {
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'تم اكتشاف عبث بالبرنامج',
      message: 'تعذر تشغيل البرنامج بسبب عدم تطابق سلامة الملفات',
      detail:
        'يبدو أن ملفات البرنامج قد تم تعديلها أو تلفها.\n' +
        'يرجى إعادة التثبيت من المصدر الرسمي.\n\n' +
        `الملفات المتأثرة: ${failures.slice(0, 10).join(', ')}${failures.length > 10 ? ' ...' : ''}`,
      buttons: ['إغلاق'],
    });
  } catch {
    // ignore
  }

  app.quit();
}
