import type { HeaderFooterInput } from '../headerFooter/types';

export type OutputType = 'docx' | 'pdf';

export type GenerateDocumentPayload = {
  templateName?: string;
  data: Record<string, unknown>;
  outputType: OutputType;
  defaultFileName?: string;
  headerFooter?: HeaderFooterInput;
};

export type GenerateDocumentResult =
  | { ok: true; outputType: OutputType; tempPath: string; fileName: string }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID'; message: string };
