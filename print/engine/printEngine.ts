import { BrowserWindow, dialog, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

export type PrintMode = 'print' | 'pdf';

export type ReportPrintPayload = {
  report: {
    title: string;
    generatedAt: string;
    columns: Array<{ key: string; header: string; type?: string }>;
    data: Array<Record<string, unknown>>;
    summary?: Array<{ label: string; value: unknown }>;
  };
  company?: {
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
  };
};

export type PrintResult =
  | { ok: true; savedPath?: string }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID'; message: string };

let cached: null | {
  base: string;
  header: string;
  footer: string;
  report: string;
  css: string;
} = null;

function escapeHtml(value: unknown): string {
  const s = String(value ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolvePrintRoot(): string {
  const candidates = [
    path.join(app.getAppPath(), 'print'),
    path.join(process.cwd(), 'print'),
    path.join(path.dirname(app.getAppPath()), 'print'),
  ];
  for (const p of candidates) {
    try {
      if (fsSync.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  // Default: appPath/print
  return candidates[0];
}

async function loadAssets(): Promise<NonNullable<typeof cached>> {
  if (cached) return cached;

  const root = resolvePrintRoot();
  const [base, header, footer, report, css] = await Promise.all([
    fs.readFile(path.join(root, 'templates', 'base.html'), 'utf8'),
    fs.readFile(path.join(root, 'templates', 'header.html'), 'utf8'),
    fs.readFile(path.join(root, 'templates', 'footer.html'), 'utf8'),
    fs.readFile(path.join(root, 'templates', 'report.html'), 'utf8'),
    fs.readFile(path.join(root, 'styles', 'print.css'), 'utf8'),
  ]);

  cached = { base, header, footer, report, css };
  return cached;
}

function applyTokens(template: string, tokens: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(tokens)) {
    // Support both raw tokens ({{TOKEN}}) and CSS-comment-wrapped tokens (/*{{TOKEN}}*/)
    // so templates remain valid for editor tooling before substitution.
    out = out.split(`/*{{${k}}}*/`).join(v);
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function buildReportBody(tpl: string, payload: ReportPrintPayload): string {
  const r = payload.report;

  const headers = (r.columns || [])
    .map((c) => `<th>${escapeHtml(c.header)}</th>`)
    .join('');

  const rows = (r.data || [])
    .map((row) => {
      const tds = (r.columns || [])
        .map((c) => {
          const v = row?.[c.key];
          return `<td>${escapeHtml(v ?? '')}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  const summary = Array.isArray(r.summary) && r.summary.length
    ? `<div class="section"><div class="kv">${r.summary
        .map((s) => {
          return `<div class="k">${escapeHtml(s.label)}</div><div class="v">${escapeHtml(s.value)}</div>`;
        })
        .join('')}</div></div>`
    : '';

  return applyTokens(tpl, {
    REPORT_TITLE: escapeHtml(r.title || ''),
    GENERATED_AT: escapeHtml(r.generatedAt || ''),
    SUMMARY: summary,
    TABLE_HEADERS: headers,
    TABLE_ROWS: rows,
  });
}

async function waitForStableLayout(win: BrowserWindow): Promise<void> {
  try {
    await win.webContents.executeJavaScript(
      `(() => {
        const waitFonts = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(() => null) : Promise.resolve(null);
        const waitImages = Promise.all(Array.from(document.images || []).map(img => img.complete ? Promise.resolve() : new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); })));
        return Promise.all([waitFonts, waitImages]).then(() => true);
      })();`,
      true
    );
  } catch {
    // ignore
  }
}

export async function runReportPrintJob(mode: PrintMode, payload: ReportPrintPayload): Promise<PrintResult> {
  try {
    if (!payload?.report?.title || !Array.isArray(payload?.report?.columns) || !Array.isArray(payload?.report?.data)) {
      return { ok: false, code: 'INVALID', message: 'بيانات التقرير غير صالحة للطباعة' };
    }

    // Basic size limits to prevent accidental giant prints.
    const rowCount = payload.report.data.length;
    if (rowCount > 5000) {
      return { ok: false, code: 'INVALID', message: 'عدد صفوف التقرير كبير جداً للطباعة' };
    }

    const assets = await loadAssets();

    const companyName = escapeHtml(payload.company?.companyName || '');
    const companyAddress = escapeHtml(payload.company?.companyAddress || '');
    const companyPhone = escapeHtml(payload.company?.companyPhone || '');

    const headerHtml = applyTokens(assets.header, {
      COMPANY_NAME: companyName,
      COMPANY_ADDRESS: companyAddress,
      COMPANY_PHONE: companyPhone,
    });

    const footerHtml = applyTokens(assets.footer, {
      FOOTER_LEFT: escapeHtml(`AZRAR — ${new Date().toISOString().slice(0, 10)}`),
    });

    const bodyHtml = buildReportBody(assets.report, payload);

    const html = applyTokens(assets.base, {
      TITLE: escapeHtml(payload.report.title || 'Report'),
      PRINT_CSS: assets.css,
      HEADER: headerHtml,
      BODY: bodyHtml,
      FOOTER: footerHtml,
    });

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

    // Hard deny any popups/navigation.
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.webContents.on('will-redirect', (e) => e.preventDefault());

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    await win.loadURL(dataUrl);
    await waitForStableLayout(win);

    if (mode === 'print') {
      await new Promise<void>((resolve, reject) => {
        win.webContents.print({ printBackground: true, silent: false }, (ok, failureReason) => {
          if (!ok) reject(new Error(failureReason || 'فشل الطباعة'));
          else resolve();
        });
      });

      try {
        win.destroy();
      } catch {
        // ignore
      }

      return { ok: true };
    }

    // mode === 'pdf'
    const defaultFileName = `${String(payload.report.title || 'report').replace(/[\\/:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

    const save = await dialog.showSaveDialog({
      title: 'حفظ التقرير كملف PDF',
      defaultPath: path.join(app.getPath('documents'), defaultFileName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (save.canceled || !save.filePath) {
      try {
        win.destroy();
      } catch {
        // ignore
      }
      return { ok: false, code: 'CANCELED', message: 'تم إلغاء حفظ ملف PDF' };
    }

    const pdfBytes = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
    });

    await fs.writeFile(save.filePath, pdfBytes);

    try {
      win.destroy();
    } catch {
      // ignore
    }

    return { ok: true, savedPath: save.filePath };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'فشل تنفيذ الطباعة';
    return { ok: false, code: 'FAILED', message };
  }
}
