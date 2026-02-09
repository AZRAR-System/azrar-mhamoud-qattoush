import type { DesktopPrintDispatchRequest, DesktopPrintDispatchResult } from '@/types/electron.types';

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

export const printCurrentViewUnified = async (ctx: UnifiedPrintContext): Promise<DesktopPrintDispatchResult | undefined> => {
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
    return (await window.desktopPrintEngine.run({ type: 'currentView', mode: 'print' })) as unknown as DesktopPrintDispatchResult;
  }

  // Web mode: no-op.
  return undefined;
};

export const printTextUnified = async (ctx: UnifiedPrintContext & { text: string; title?: string }): Promise<DesktopPrintDispatchResult | undefined> => {
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
  },
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

export const exportDocxUnified = async (
  ctx: UnifiedPrintContext & {
    templateName?: string;
    data: Record<string, unknown>;
    defaultFileName?: string;
    headerFooter?: UnifiedHeaderFooter;
  },
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
