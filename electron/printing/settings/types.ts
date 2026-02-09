export type PrintPageSize =
  | 'A4'
  | 'A5'
  | 'Letter'
  | 'Legal'
  | { widthMm: number; heightMm: number };

export type PrintOrientation = 'portrait' | 'landscape';

export type PrintMarginsMm = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type PrintSettings = {
  pageSize: PrintPageSize;
  orientation: PrintOrientation;
  marginsMm: PrintMarginsMm;
  fontFamily: string;
  rtl: boolean;
  headerEnabled: boolean;
  footerEnabled: boolean;
  pdfExport?: {
    sofficePath?: string;
  };
};

export type PrintSettingsResult =
  | { ok: true; settings: PrintSettings; filePath: string }
  | { ok: false; code: 'FAILED' | 'FORBIDDEN' | string; message: string };

export type SavePrintSettingsResult =
  | { ok: true; filePath: string }
  | { ok: false; code: 'INVALID' | 'FAILED' | 'FORBIDDEN' | string; message: string };
