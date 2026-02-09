import type { GenerateDocumentPayload, GenerateDocumentResult } from './types';
import { cleanupTempDir, writeTempFile } from './tempStore';
import { renderDocxToBuffer } from '../docx/docxTemplateEngine';
import type { PrintSettings } from '../settings/types';
import { convertDocxBytesToPdfBytes } from '../pdf/libreOfficeConverter';

export const generateDocument = async (
  payload: GenerateDocumentPayload,
  opts?: { settings?: PrintSettings | null },
): Promise<GenerateDocumentResult> => {
  try {
    if (!payload || typeof payload !== 'object') return { ok: false, code: 'INVALID', message: 'طلب التوليد غير صالح' };
    if (!payload.outputType) return { ok: false, code: 'INVALID', message: 'نوع الإخراج غير محدد' };

    const docx = await renderDocxToBuffer({
      templateName: payload.templateName,
      data: payload.data,
      defaultFileName: payload.defaultFileName,
      headerFooter: payload.headerFooter,
    });

    if (!docx.ok) return docx;

    if (payload.outputType === 'docx') {
      const written = await writeTempFile({ ext: 'docx', baseName: docx.fileStem, bytes: docx.bytes });
      void cleanupTempDir();
      return { ok: true, outputType: 'docx', tempPath: written.tempPath, fileName: written.fileName };
    }

    if (payload.outputType === 'pdf') {
      const pdf = await convertDocxBytesToPdfBytes(docx.bytes, { sofficePath: opts?.settings?.pdfExport?.sofficePath });
      if (!pdf.ok) return { ok: false, code: 'FAILED', message: pdf.message };

      const written = await writeTempFile({ ext: 'pdf', baseName: docx.fileStem, bytes: pdf.pdfBytes });
      void cleanupTempDir();
      return { ok: true, outputType: 'pdf', tempPath: written.tempPath, fileName: written.fileName };
    }

    return { ok: false, code: 'INVALID', message: 'نوع إخراج غير مدعوم' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل توليد المستند';
    return { ok: false, code: 'FAILED', message };
  }
};
