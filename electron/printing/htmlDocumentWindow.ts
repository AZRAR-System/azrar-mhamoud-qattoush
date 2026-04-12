import { BrowserWindow, app, dialog } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { toErrorMessage } from '../utils/errors';

export type HtmlDocMarginsMm = { top: number; right: number; bottom: number; left: number };

export type HtmlDocPrintOptions = {
  orientation: 'portrait' | 'landscape';
  marginsMm: HtmlDocMarginsMm;
  pageRanges?: string;
  copies: number;
  defaultFileName?: string;
};

export type ParsePrintingHtmlResult =
  | { ok: true; value: HtmlDocPrintOptions & { html: string } }
  | { ok: false; message: string };

const DEFAULT_MM = 20;

function mmToMarginPx(mm: number): number {
  return Math.round((mm / 25.4) * 96);
}

function parseMarginsMm(input: unknown): HtmlDocMarginsMm {
  const d = DEFAULT_MM;
  if (!input || typeof input !== 'object') {
    return { top: d, right: d, bottom: d, left: d };
  }
  const o = input as Record<string, unknown>;
  const n = (v: unknown, fallback: number) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? x : fallback;
  };
  return {
    top: n(o.top, d),
    right: n(o.right, d),
    bottom: n(o.bottom, d),
    left: n(o.left, d),
  };
}

function parsePageRangesList(s: string | undefined): { from: number; to: number }[] | undefined {
  if (!s?.trim()) return undefined;
  const parts = s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const ranges: { from: number; to: number }[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Math.max(0, parseInt(m[1], 10) - 1);
    const b = m[2] ? Math.max(0, parseInt(m[2], 10) - 1) : a;
    ranges.push({ from: Math.min(a, b), to: Math.max(a, b) });
  }
  return ranges.length ? ranges : undefined;
}

export function parsePrintingHtmlPayload(payload: unknown): ParsePrintingHtmlResult {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'طلب غير صالح' };
  }
  const r = payload as Record<string, unknown>;
  const html = typeof r.html === 'string' ? r.html : '';
  if (!html.trim()) return { ok: false, message: 'HTML فارغ' };

  const orientation = r.orientation === 'landscape' ? 'landscape' : 'portrait';
  const marginsMm = parseMarginsMm(r.marginsMm);
  const pageRanges =
    typeof r.pageRanges === 'string' ? r.pageRanges.trim() || undefined : undefined;
  let copies = 1;
  if (typeof r.copies === 'number' && Number.isFinite(r.copies)) {
    copies = Math.max(1, Math.min(99, Math.floor(r.copies)));
  }
  const defaultFileName =
    typeof r.defaultFileName === 'string'
      ? String(r.defaultFileName).trim() || undefined
      : undefined;

  return {
    ok: true,
    value: { html, orientation, marginsMm, pageRanges, copies, defaultFileName },
  };
}

async function withHiddenHtmlWindow<T>(
  html: string,
  run: (wc: Electron.WebContents) => Promise<T>
): Promise<T> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      safeDialogs: true,
      navigateOnDragDrop: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('will-redirect', (e) => e.preventDefault());

  const tmp = path.join(
    app.getPath('temp'),
    `azrar-print-html-${crypto.randomBytes(8).toString('hex')}.html`
  );

  try {
    await fsp.writeFile(tmp, html, 'utf8');
    await new Promise<void>((resolve, reject) => {
      win.webContents.once('did-fail-load', (_e, code, desc) =>
        reject(new Error(desc || `فشل التحميل (${code})`))
      );
      win.webContents.once('did-finish-load', () => resolve());
      void win.loadFile(tmp);
    });

    await win.webContents
      .executeJavaScript('document.fonts?.ready?.catch?.(() => undefined)', true)
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, 200));

    return await run(win.webContents);
  } finally {
    try {
      win.destroy();
    } catch {
      // ignore
    }
    await fsp.unlink(tmp).catch(() => undefined);
  }
}

export async function printHtmlInHiddenWindow(
  html: string,
  options: HtmlDocPrintOptions
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  try {
    await withHiddenHtmlWindow(html, async (wc) => {
      const pageRanges = parsePageRangesList(options.pageRanges);
      await new Promise<void>((resolve, reject) => {
        wc.print(
          {
            silent: false,
            printBackground: true,
            landscape: options.orientation === 'landscape',
            margins: {
              marginType: 'custom',
              top: mmToMarginPx(options.marginsMm.top),
              bottom: mmToMarginPx(options.marginsMm.bottom),
              left: mmToMarginPx(options.marginsMm.left),
              right: mmToMarginPx(options.marginsMm.right),
            },
            copies: options.copies,
            ...(pageRanges?.length ? { pageRanges } : {}),
          },
          (success, failureReason) => {
            if (!success) reject(new Error(failureReason || 'فشلت الطباعة'));
            else resolve();
          }
        );
      });
    });
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشلت الطباعة') };
  }
}

async function htmlToPdfBuffer(html: string, options: HtmlDocPrintOptions): Promise<Buffer> {
  return withHiddenHtmlWindow(html, async (wc) => {
    const buf = await wc.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
      landscape: options.orientation === 'landscape',
      margins: {
        marginType: 'custom',
        top: mmToMarginPx(options.marginsMm.top),
        bottom: mmToMarginPx(options.marginsMm.bottom),
        left: mmToMarginPx(options.marginsMm.left),
        right: mmToMarginPx(options.marginsMm.right),
      },
      pageRanges: options.pageRanges?.trim() || undefined,
    });
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  });
}

/** حفظ PDF مباشرة بدون حوار (للتقارير المجدولة وغيرها). */
export async function saveHtmlPdfToFilePath(
  html: string,
  destPath: string,
  options: HtmlDocPrintOptions
): Promise<{ ok: true; savedPath: string } | { ok: false; code: string; message: string }> {
  try {
    const pdfBuffer = await htmlToPdfBuffer(html, options);
    const dir = path.dirname(destPath);
    await fsp.mkdir(dir, { recursive: true });
    const out = destPath.toLowerCase().endsWith('.pdf') ? destPath : `${destPath}.pdf`;
    await fsp.writeFile(out, pdfBuffer);
    return { ok: true, savedPath: out };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل حفظ PDF') };
  }
}

export async function htmlToPdfFromHtml(
  html: string,
  options: HtmlDocPrintOptions
): Promise<{ ok: true; savedPath: string } | { ok: false; code: string; message: string }> {
  try {
    const pdfBuffer = await htmlToPdfBuffer(html, options);

    const suggested = options.defaultFileName?.toLowerCase().endsWith('.pdf')
      ? options.defaultFileName
      : options.defaultFileName
        ? `${options.defaultFileName}.pdf`
        : 'document.pdf';

    const res = await dialog.showSaveDialog({
      title: 'تصدير PDF',
      defaultPath: suggested,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });

    if (res.canceled || !res.filePath) {
      return { ok: false, code: 'CANCELED', message: 'تم الإلغاء' };
    }

    const dest = res.filePath.toLowerCase().endsWith('.pdf') ? res.filePath : `${res.filePath}.pdf`;
    await fsp.writeFile(dest, pdfBuffer);
    return { ok: true, savedPath: dest };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل تصدير PDF') };
  }
}
