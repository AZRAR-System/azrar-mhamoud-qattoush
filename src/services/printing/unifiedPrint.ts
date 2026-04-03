import type {
  DesktopPrintDispatchRequest,
  DesktopPrintDispatchResult,
} from '@/types/electron.types';

export type UnifiedPrintContext = {
  documentType: string;
  entityId?: string;
  data?: Record<string, unknown>;
};

export type UnifiedHeaderFooter = {
  headerEnabled?: boolean;
  footerEnabled?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  companyName?: string;
  companySlogan?: string;
  companyIdentityText?: string;
  userName?: string;
  dateIso?: string;
};

export const printCurrentViewUnified = async (
  ctx: UnifiedPrintContext
): Promise<DesktopPrintDispatchResult | undefined> => {
  // Desktop unified dispatch (Phase 10). Falls back to legacy desktopPrintEngine if not available.
  const request: DesktopPrintDispatchRequest = {
    action: 'printCurrentView',
    documentType: String(ctx.documentType || '').trim() || 'unknown',
    entityId: ctx.entityId ? String(ctx.entityId).trim() : undefined,
    data: ctx.data,
  };

  if (window.desktopPrintDispatch?.run) {
    return window.desktopPrintDispatch.run(request);
  }

  if (window.desktopPrintEngine?.run) {
    // Legacy (still main-process printing). No metadata support.
    return (await window.desktopPrintEngine.run({
      type: 'currentView',
      mode: 'print',
    })) as unknown as DesktopPrintDispatchResult;
  }

  // Web mode: no-op.
  return undefined;
};

export const printTextUnified = async (
  ctx: UnifiedPrintContext & { text: string; title?: string }
): Promise<DesktopPrintDispatchResult | undefined> => {
  const request: DesktopPrintDispatchRequest = {
    action: 'printText',
    documentType: String(ctx.documentType || '').trim() || 'unknown',
    entityId: ctx.entityId ? String(ctx.entityId).trim() : undefined,
    title: ctx.title,
    text: String(ctx.text ?? ''),
    data: ctx.data,
  };

  if (window.desktopPrintDispatch?.run) {
    return window.desktopPrintDispatch.run(request);
  }

  if (window.desktopPrintEngine?.run) {
    return (await window.desktopPrintEngine.run({
      type: 'text',
      mode: 'print',
      payload: {
        title: ctx.title,
        text: String(ctx.text ?? ''),
      },
    })) as unknown as DesktopPrintDispatchResult;
  }

  return undefined;
};

export const generateTemplateUnified = async (
  ctx: UnifiedPrintContext & {
    templateName?: string;
    data: Record<string, unknown>;
    outputType: 'docx' | 'pdf';
    defaultFileName?: string;
    headerFooter?: UnifiedHeaderFooter;
  }
): Promise<DesktopPrintDispatchResult | undefined> => {
  const request: DesktopPrintDispatchRequest = {
    action: 'generate',
    documentType: String(ctx.documentType || '').trim() || 'unknown',
    entityId: ctx.entityId ? String(ctx.entityId).trim() : undefined,
    templateName: ctx.templateName,
    outputType: ctx.outputType,
    defaultFileName: ctx.defaultFileName,
    headerFooter: ctx.headerFooter,
    data: ctx.data,
  };

  if (window.desktopPrintDispatch?.run) {
    return window.desktopPrintDispatch.run(request);
  }

  if (window.desktopPrintEngine?.run) {
    return (await window.desktopPrintEngine.run({
      type: 'generate',
      mode: 'generate',
      payload: {
        templateName: ctx.templateName,
        data: ctx.data,
        outputType: ctx.outputType,
        defaultFileName: ctx.defaultFileName,
        headerFooter: ctx.headerFooter,
      },
    })) as unknown as DesktopPrintDispatchResult;
  }

  return undefined;
};

export const printHtmlUnified = async (
  ctx: UnifiedPrintContext & {
    html: string;
    orientation?: 'portrait' | 'landscape';
    marginsMm?: { top: number; right: number; bottom: number; left: number };
    pageRanges?: string;
    copies?: number;
    defaultFileName?: string;
  }
): Promise<DesktopPrintDispatchResult | undefined> => {
  const request: DesktopPrintDispatchRequest = {
    action: 'printHtml',
    documentType: String(ctx.documentType || '').trim() || 'unknown',
    entityId: ctx.entityId ? String(ctx.entityId).trim() : undefined,
    html: String(ctx.html ?? ''),
    orientation: ctx.orientation,
    marginsMm: ctx.marginsMm,
    pageRanges: ctx.pageRanges,
    copies: ctx.copies,
    defaultFileName: ctx.defaultFileName,
    data: ctx.data,
  };

  if (window.desktopPrintDispatch?.run) {
    return window.desktopPrintDispatch.run(request);
  }

  const defaultMm = { top: 20, right: 20, bottom: 20, left: 20 };
  const copies =
    typeof ctx.copies === 'number' && Number.isFinite(ctx.copies)
      ? Math.max(1, Math.min(99, Math.floor(ctx.copies)))
      : 1;

  if (window.desktopPrintEngine?.run) {
    return (await window.desktopPrintEngine.run({
      type: 'printHtml',
      mode: 'print',
      payload: {
        html: String(ctx.html ?? ''),
        orientation: ctx.orientation,
        marginsMm: ctx.marginsMm ?? defaultMm,
        pageRanges: ctx.pageRanges,
        copies,
        defaultFileName: ctx.defaultFileName,
      },
    })) as DesktopPrintDispatchResult;
  }

  if (window.desktopPrinting?.printHtml) {
    return window.desktopPrinting.printHtml({
      html: String(ctx.html ?? ''),
      orientation: ctx.orientation,
      marginsMm: ctx.marginsMm ?? defaultMm,
      pageRanges: ctx.pageRanges,
      copies,
      defaultFileName: ctx.defaultFileName,
    });
  }

  return undefined;
};

/** When no Electron print bridge exists, open a hidden iframe and trigger the browser print dialog. */
export function printHtmlInBrowserIframe(fullHtml: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
  );
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    try {
      document.body.removeChild(iframe);
    } catch {
      // ignore
    }
    return;
  }
  doc.open();
  doc.write(fullHtml);
  doc.close();
  const cleanup = () => {
    try {
      document.body.removeChild(iframe);
    } catch {
      // ignore
    }
  };
  const doPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(cleanup, 500);
    }
  };
  if (doc.readyState === 'complete') {
    setTimeout(doPrint, 0);
  } else {
    iframe.onload = () => doPrint();
  }
}

/** Like {@link printHtmlUnified}, but falls back to the browser print dialog when no desktop bridge is available. */
export const printHtmlUnifiedWithBrowserFallback = async (
  ctx: Parameters<typeof printHtmlUnified>[0]
): Promise<DesktopPrintDispatchResult | undefined> => {
  const res = await printHtmlUnified(ctx);
  if (res !== undefined) return res;
  printHtmlInBrowserIframe(ctx.html);
  return undefined;
};

export const exportDocxUnified = async (
  ctx: UnifiedPrintContext & {
    templateName?: string;
    data: Record<string, unknown>;
    defaultFileName?: string;
    headerFooter?: UnifiedHeaderFooter;
  }
): Promise<DesktopPrintDispatchResult | undefined> => {
  const request: DesktopPrintDispatchRequest = {
    action: 'exportDocx',
    documentType: String(ctx.documentType || '').trim() || 'unknown',
    entityId: ctx.entityId ? String(ctx.entityId).trim() : undefined,
    templateName: ctx.templateName,
    defaultFileName: ctx.defaultFileName,
    headerFooter: ctx.headerFooter,
    data: ctx.data,
  };

  if (window.desktopPrintDispatch?.run) {
    return window.desktopPrintDispatch.run(request);
  }

  if (window.desktopPrintEngine?.run) {
    return (await window.desktopPrintEngine.run({
      type: 'docx',
      mode: 'docx',
      payload: {
        templateName: ctx.templateName,
        defaultFileName: ctx.defaultFileName,
        headerFooter: ctx.headerFooter,
        data: ctx.data,
      },
    })) as unknown as DesktopPrintDispatchResult;
  }

  return undefined;
};
