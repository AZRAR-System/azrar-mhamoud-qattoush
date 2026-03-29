import type { PrintMode, ReportPrintPayload } from '../../print/engine/printEngine';
import type { HeaderFooterInput } from './headerFooter/types';
import type { OutputType } from './generation/types';
import type { HtmlDocMarginsMm } from './htmlDocumentWindow';

export type PrintEngineJob =
  | {
      type: 'currentView';
      mode: 'print';
    }
  | {
      type: 'text';
      mode: 'print';
      payload: {
        title?: string;
        text: string;
      };
    }
  | {
      type: 'docx';
      mode: 'docx';
      payload: {
        templateName?: string;
        data: Record<string, unknown>;
        defaultFileName?: string;
        headerFooter?: HeaderFooterInput;
      };
    }
  | {
      type: 'generate';
      mode: 'generate';
      payload: {
        templateName?: string;
        data: Record<string, unknown>;
        outputType: OutputType;
        defaultFileName?: string;
        headerFooter?: HeaderFooterInput;
      };
    }
  | {
      type: 'report';
      mode: PrintMode;
      payload: ReportPrintPayload;
    }
  | {
      type: 'printHtml';
      mode: 'print';
      payload: {
        html: string;
        orientation?: 'portrait' | 'landscape';
        marginsMm: HtmlDocMarginsMm;
        pageRanges?: string;
        copies: number;
        defaultFileName?: string;
      };
    };

export type PrintEngineResult =
  | {
      ok: true;
      // legacy results
      savedPath?: string;
      // phase 5 generation outputs
      outputType?: OutputType;
      tempPath?: string;
      fileName?: string;
    }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID' | 'FORBIDDEN' | string; message: string };
