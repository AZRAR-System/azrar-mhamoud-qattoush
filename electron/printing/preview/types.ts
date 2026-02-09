import type { HeaderFooterInput } from '../headerFooter/types';

export type PrintPreviewOpenPayload = {
  templateName?: string;
  data: Record<string, unknown>;
  defaultFileName?: string;
  headerFooter?: HeaderFooterInput;
};

export type PrintPreviewOpenResult =
  | { ok: true; sessionId: string }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID' | 'FORBIDDEN'; message: string };

export type PrintPreviewStateResult =
  | {
      ok: true;
      sessionId: string;
      pdfPath: string;
      pdfUrl: string;
      fileName: string;
      createdAtIso: string;
    }
  | { ok: false; code: 'FAILED' | 'INVALID' | 'FORBIDDEN'; message: string };

export type PrintPreviewActionResult =
  | { ok: true; savedPath?: string }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID' | 'FORBIDDEN'; message: string };

export type PreviewPrinterInfo = {
  name: string;
  displayName?: string;
  isDefault?: boolean;
};

export type PrintPreviewPrintersResult =
  | { ok: true; printers: PreviewPrinterInfo[] }
  | { ok: false; code: 'FAILED' | 'FORBIDDEN'; message: string };

export type PrintPreviewPrintOptions = {
  deviceName?: string;
  silent?: boolean;
  printBackground?: boolean;
};
