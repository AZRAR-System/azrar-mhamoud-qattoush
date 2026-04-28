import fsp from 'node:fs/promises';
import path from 'node:path';
import { app, dialog } from 'electron';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

import { resolveContractTemplatePath } from './templateStore';
import type { HeaderFooterInput } from '../headerFooter/types';
import { buildHeaderFooter } from '../headerFooter/headerFooterEngine';
import { injectHeaderFooterIntoDocxZip } from '../headerFooter/docxHeaderFooterInjector';
import { loadHeaderFooterTemplates } from '../headerFooter/templateStore';
import { loadPrintSettings } from '../settings/store';

export type GenerateDocxPayload = {
  templateName?: string;
  data: Record<string, unknown>;
  defaultFileName?: string;
  headerFooter?: HeaderFooterInput;
};

export type RenderDocxBufferResult =
  | { ok: true; bytes: Buffer; fileStem: string }
  | { ok: false; code: 'FAILED' | 'INVALID'; message: string };

export type GenerateDocxResult =
  | { ok: true; savedPath: string }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID'; message: string };

const toErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message || fallback;
  const s = String(err ?? '').trim();
  return s || fallback;
};

const safeFileStem = (v: string): string =>
  String(v || 'document')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim() || 'document';

export const renderDocxToBuffer = async (
  payload: GenerateDocxPayload
): Promise<RenderDocxBufferResult> => {
  try {
    const data = payload?.data;
    if (!data || typeof data !== 'object')
      return { ok: false, code: 'INVALID', message: 'بيانات القالب غير صالحة' };

    const { templatePath, fileName } = await resolveContractTemplatePath(payload?.templateName);
    const buf = await fsp.readFile(templatePath);

    const zip = new PizZip(buf);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: () => '',
    });

    doc.render(data);

    let headerFooter: HeaderFooterInput | undefined = payload?.headerFooter;
    if (headerFooter) {
      const templates = await loadHeaderFooterTemplates();
      const ps = await loadPrintSettings();
      const printSettings = ps.ok ? ps.settings : null;
      headerFooter = {
        ...headerFooter,
        headerEnabled: printSettings ? printSettings.headerEnabled : headerFooter.headerEnabled,
        footerEnabled: printSettings ? printSettings.footerEnabled : headerFooter.footerEnabled,
        headerTemplate: headerFooter.headerTemplate ?? templates.headerTemplate,
        footerTemplate: headerFooter.footerTemplate ?? templates.footerTemplate,
      };
    }

    const resolved = buildHeaderFooter(headerFooter);
    injectHeaderFooterIntoDocxZip(doc.getZip() as unknown as InstanceType<typeof PizZip>, resolved);

    const outBuf = Buffer.from(doc.getZip().generate({ type: 'nodebuffer' }));

    const stem = payload?.defaultFileName
      ? safeFileStem(payload.defaultFileName)
      : safeFileStem(path.basename(fileName, '.docx'));
    return { ok: true, bytes: outBuf, fileStem: stem };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل توليد ملف Word') };
  }
};

export const generateDocxFromTemplate = async (
  payload: GenerateDocxPayload
): Promise<GenerateDocxResult> => {
  try {
    const rendered = await renderDocxToBuffer(payload);
    if (rendered.ok === false) {
      return { ok: false, code: rendered.code, message: rendered.message };
    }

    const defaultName = `${rendered.fileStem}_${new Date().toISOString().slice(0, 10)}.docx`;

    const save = await dialog.showSaveDialog({
      title: 'حفظ ملف Word',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'Word (.docx)', extensions: ['docx'] }],
    });

    if (save.canceled || !save.filePath)
      return { ok: false, code: 'CANCELED', message: 'تم إلغاء الحفظ' };

    await fsp.writeFile(save.filePath, rendered.bytes);
    return { ok: true, savedPath: save.filePath };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل توليد ملف Word') };
  }
};
