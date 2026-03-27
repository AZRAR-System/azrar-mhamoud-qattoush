import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { getPrintTempDir } from '../generation/tempStore';

export type LibreOfficeExportConfig = {
  sofficePath?: string;
};

type SpawnResult = { code: number | null; stdout: string; stderr: string };

const spawnCollect = async (
  command: string,
  args: string[],
  opts?: { cwd?: string }
): Promise<SpawnResult> =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: opts?.cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d) => {
      stdout += String(d ?? '');
    });

    child.stderr?.on('data', (d) => {
      stderr += String(d ?? '');
    });

    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.on('error', () => resolve({ code: -1, stdout, stderr: stderr || 'فشل تشغيل محول PDF' }));
  });

const fileExists = async (p: string): Promise<boolean> => {
  try {
    const st = await fsp.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
};

const resolveSofficeFromPath = async (): Promise<string | null> => {
  try {
    if (process.platform === 'win32') {
      const r = await spawnCollect('where', ['soffice']);
      if (r.code !== 0) return null;
      const lines = r.stdout
        .split(/\r?\n/g)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const p of lines) {
        if (await fileExists(p)) return p;
      }
      return null;
    }

    const r = await spawnCollect('which', ['soffice']);
    if (r.code !== 0) return null;
    const first =
      r.stdout
        .split(/\r?\n/g)
        .map((s) => s.trim())
        .find(Boolean) || null;
    if (!first) return null;
    return (await fileExists(first)) ? first : null;
  } catch {
    return null;
  }
};

export const resolveSofficePath = async (cfg?: LibreOfficeExportConfig): Promise<string | null> => {
  const custom = String(cfg?.sofficePath ?? '').trim();
  if (custom) {
    return (await fileExists(custom)) ? custom : null;
  }
  return resolveSofficeFromPath();
};

const findFirstPdfInDir = async (dir: string): Promise<string | null> => {
  try {
    const items = await fsp.readdir(dir);
    for (const name of items) {
      if (name.toLowerCase().endsWith('.pdf')) {
        const p = path.join(dir, name);
        if (await fileExists(p)) return p;
      }
    }
    return null;
  } catch {
    return null;
  }
};

const waitForPdfPath = async (
  dir: string,
  expectedPath: string,
  timeoutMs = 4000
): Promise<string | null> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fileExists(expectedPath)) return expectedPath;
    const any = await findFirstPdfInDir(dir);
    if (any) return any;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
};

export const convertDocxBytesToPdfBytes = async (
  docxBytes: Buffer,
  cfg?: LibreOfficeExportConfig
): Promise<{ ok: true; pdfBytes: Buffer } | { ok: false; message: string }> => {
  const sofficePath = await resolveSofficePath(cfg);
  if (!sofficePath) {
    return {
      ok: false,
      message:
        'تعذر العثور على LibreOffice (soffice). ثبّت LibreOffice أو حدّد المسار في إعدادات الطباعة (pdfExport.sofficePath).',
    };
  }

  const baseDir = await getPrintTempDir();
  const workDir = await fsp.mkdtemp(path.join(baseDir, 'convert-'));

  try {
    const inputPath = path.join(workDir, 'input.docx');
    await fsp.writeFile(inputPath, docxBytes);

    const args = [
      '--headless',
      '--invisible',
      '--nologo',
      '--nofirststartwizard',
      '--norestore',
      '--nodefault',
      '--nolockcheck',
      '--convert-to',
      'pdf',
      '--outdir',
      workDir,
      inputPath,
    ];

    const r = await spawnCollect(sofficePath, args, { cwd: workDir });
    if (r.code !== 0) {
      const details = (r.stderr || r.stdout || '').trim();
      return {
        ok: false,
        message: details ? `فشل تحويل DOCX إلى PDF: ${details}` : 'فشل تحويل DOCX إلى PDF',
      };
    }

    const expectedPdf = path.join(workDir, 'input.pdf');
    const pdfPath = await waitForPdfPath(workDir, expectedPdf);
    if (!pdfPath)
      return { ok: false, message: 'تم تشغيل المحول لكن لم يتم العثور على ملف PDF الناتج' };

    const pdfBytes = await fsp.readFile(pdfPath);
    return { ok: true, pdfBytes };
  } finally {
    try {
      await fsp.rm(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
};
