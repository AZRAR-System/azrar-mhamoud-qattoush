import { BrowserWindow } from 'electron';
import type { WebContents } from 'electron';
import { runReportPrintJob } from '../../print/engine/printEngine';
import type { PrintEngineJob, PrintEngineResult } from './types';
import { generateDocxFromTemplate } from './docx/docxTemplateEngine';
import { buildCssMargins, buildCssPageSize, loadPrintSettings } from './settings/store';
import { generateDocument } from './generation/generationEngine';
import { printHtmlInHiddenWindow } from './htmlDocumentWindow';

export class PrintEngine {
  private buildTextHtml(
    title: string,
    text: string,
    settings: { pageSizeCss: string; marginsCss: string; fontFamily: string; rtl: boolean }
  ): string {
    const safeTitle = String(title || 'Print')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const safeText = String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const dir = settings.rtl ? 'rtl' : 'ltr';
    const align = settings.rtl ? 'right' : 'left';

    return `<!doctype html>
<html lang="ar" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      @page { size: ${settings.pageSizeCss}; margin: ${settings.marginsCss}; }
      body { margin: 0; font-family: ${settings.fontFamily}; direction: ${dir}; }
      pre { white-space: pre-wrap; word-break: break-word; padding: 0; margin: 0; font-size: 14px; line-height: 1.6; text-align: ${align}; }
      .wrap { padding: ${settings.marginsCss}; }
    </style>
  </head>
  <body>
    <div class="wrap"><pre>${safeText}</pre></div>
  </body>
</html>`;
  }

  async run(job: PrintEngineJob, ctx?: { webContents?: WebContents }): Promise<PrintEngineResult> {
    if (!job || typeof job !== 'object') {
      return { ok: false, code: 'INVALID', message: 'طلب الطباعة غير صالح' };
    }

    const loaded = await loadPrintSettings();
    const settings = loaded.ok ? loaded.settings : null;
    const pageSizeCss = settings
      ? buildCssPageSize(settings.pageSize, settings.orientation)
      : 'A4 portrait';
    const marginsCss = settings ? buildCssMargins(settings.marginsMm) : '16mm 16mm 16mm 16mm';
    const fontFamily =
      settings?.fontFamily || 'system-ui, -apple-system, Segoe UI, Tahoma, Arial, sans-serif';
    const rtl = settings?.rtl !== false;

    if (job.type === 'currentView') {
      const wc = ctx?.webContents;
      if (!wc) return { ok: false, code: 'INVALID', message: 'لا يوجد نافذة للطباعة' };

      try {
        await new Promise<void>((resolve, reject) => {
          wc.print({ silent: false, printBackground: true }, (ok, reason) => {
            if (!ok) reject(new Error(reason || 'فشل الطباعة'));
            else resolve();
          });
        });
        return { ok: true };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'فشل تنفيذ الطباعة';
        return { ok: false, code: 'FAILED', message };
      }
    }

    if (job.type === 'text') {
      const title = String(job.payload?.title || 'Print');
      const text = String(job.payload?.text || '');
      if (!text.trim()) return { ok: false, code: 'INVALID', message: 'النص فارغ' };

      const html = this.buildTextHtml(title, text, { pageSizeCss, marginsCss, fontFamily, rtl });

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

      try {
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
        await win.loadURL(dataUrl);

        await new Promise<void>((resolve, reject) => {
          win.webContents.print({ silent: false, printBackground: true }, (ok, reason) => {
            if (!ok) reject(new Error(reason || 'فشل الطباعة'));
            else resolve();
          });
        });

        return { ok: true };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'فشل تنفيذ الطباعة';
        return { ok: false, code: 'FAILED', message };
      } finally {
        try {
          win.destroy();
        } catch {
          // ignore
        }
      }
    }

    if (job.type === 'docx') {
      return generateDocxFromTemplate(job.payload);
    }

    if (job.type === 'generate') {
      return generateDocument(job.payload, { settings });
    }

    if (job.type === 'report') {
      return runReportPrintJob(job.mode, job.payload, { settings });
    }

    if (job.type === 'printHtml') {
      const p = job.payload;
      const html = String(p.html ?? '');
      if (!html.trim()) return { ok: false, code: 'INVALID', message: 'HTML فارغ' };

      return printHtmlInHiddenWindow(html, {
        orientation: p.orientation === 'landscape' ? 'landscape' : 'portrait',
        marginsMm: p.marginsMm,
        pageRanges: p.pageRanges,
        copies:
          typeof p.copies === 'number' && Number.isFinite(p.copies)
            ? Math.max(1, Math.min(99, Math.floor(p.copies)))
            : 1,
        defaultFileName: p.defaultFileName,
      });
    }

    return { ok: false, code: 'INVALID', message: 'نوع طلب الطباعة غير مدعوم' };
  }
}

export const printEngine = new PrintEngine();
