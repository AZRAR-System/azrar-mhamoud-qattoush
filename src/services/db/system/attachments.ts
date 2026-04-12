import { get, save } from '../kv';
import { KEYS } from '../keys';
import { Attachment, ReferenceType, DbResult } from '@/types';
import { getDesktopBridge } from '../refs';
import { buildAttachmentEntityFolder } from '../attachmentPaths';
import { dbFail, dbOk } from '@/services/localDbStorage';

const ok = dbOk;
const fail = dbFail;

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

/**
 * Attachment and Word Template management service
 */

export const getAttachments = (type: ReferenceType, id: string): Attachment[] =>
  get<Attachment>(KEYS.ATTACHMENTS).filter(
    (a) => a.referenceType === type && a.referenceId === id
  );

export const getAllAttachments = (): Attachment[] => get<Attachment>(KEYS.ATTACHMENTS);

export const uploadAttachment = async (
  type: ReferenceType,
  id: string,
  file: File
): Promise<DbResult<Attachment>> => {
  const desktopDb = getDesktopBridge();
  if (desktopDb?.saveAttachmentFile) {
    try {
      const entityFolder = buildAttachmentEntityFolder(type, id);
      const bytes = await file.arrayBuffer();
      const resultUnknown = await desktopDb.saveAttachmentFile({
        referenceType: type,
        entityFolder,
        originalFileName: file.name,
        bytes,
      });

      const result = asUnknownRecord(resultUnknown);
      if (result['success'] !== true || typeof result['relativePath'] !== 'string') {
        return fail(String(result['message'] || 'فشل حفظ الملف على القرص'));
      }

      const all = get<Attachment>(KEYS.ATTACHMENTS);
      const att: Attachment = {
        id: `ATT-${Date.now()}`,
        referenceType: type,
        referenceId: id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileExtension: file.name.split('.').pop() || '',
        uploadDate: new Date().toISOString(),
        uploadedBy: 'Admin',
        filePath: result['relativePath'] as string,
      };

      save(KEYS.ATTACHMENTS, [...all, att]);
      return ok(att);
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'فشل حفظ الملف');
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const all = get<Attachment>(KEYS.ATTACHMENTS);
      const att: Attachment = {
        id: `ATT-${Date.now()}`,
        referenceType: type,
        referenceId: id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileExtension: file.name.split('.').pop() || '',
        uploadDate: new Date().toISOString(),
        uploadedBy: 'Admin',
        fileData: reader.result as string,
      };
      try {
        save(KEYS.ATTACHMENTS, [...all, att]);
        resolve(ok(att));
      } catch {
        reject('File too large for mock storage');
      }
    };
    reader.onerror = reject;
  });
};

export const deleteAttachment = async (id: string): Promise<DbResult<null>> => {
  const all = get<Attachment>(KEYS.ATTACHMENTS);
  const att = all.find((a) => a.id === id);

  const desktopDb = getDesktopBridge();
  if (att?.filePath && desktopDb?.deleteAttachmentFile) {
    try {
      await desktopDb.deleteAttachmentFile(att.filePath);
    } catch { /* best-effort */ }
  }

  save(KEYS.ATTACHMENTS, all.filter((a) => a.id !== id));
  return ok();
};

export const readWordTemplate = async (
  templateName: string,
  templateType?: 'contracts' | 'installments' | 'handover'
): Promise<DbResult<ArrayBuffer>> => {
  const desktopDb = getDesktopBridge();
  if (!desktopDb?.readTemplateFile) return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');

  try {
    const resUnknown = await desktopDb.readTemplateFile({ templateName, templateType });
    const res = asUnknownRecord(resUnknown);
    if (res['success'] !== true || typeof res['dataUri'] !== 'string') {
      return fail(String(res['message'] || 'فشل تحميل قالب Word'));
    }

    const dataUri = res['dataUri'];
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx < 0) return fail('قالب Word غير صالح (dataUri)');
    const payload = dataUri.slice(commaIdx + 1);
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return ok(bytes.buffer);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'فشل تحميل قالب Word');
  }
};

export const listWordTemplates = async (
  templateType?: 'contracts' | 'installments' | 'handover'
): Promise<DbResult<string[]>> => {
  const desktopDb = getDesktopBridge();
  if (!desktopDb?.listTemplates) return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');

  try {
    const resUnknown = await desktopDb.listTemplates({ templateType });
    const res = asUnknownRecord(resUnknown);
    if (res['success'] !== true) return fail(String(res['message'] || 'تعذر قراءة قائمة القوالب'));
    const items = res['items'];
    return ok(Array.isArray(items) ? items.filter((x) => typeof x === 'string') : []);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'تعذر قراءة قائمة القوالب');
  }
};

export const downloadAttachment = async (id: string): Promise<string | null> => {
  const bridge = getDesktopBridge();
  if (bridge && typeof bridge.get === 'function') {
    try {
      const raw = await bridge.get(KEYS.ATTACHMENTS);
      const parsed = JSON.parse(String(raw || '[]'));
      const match = parsed.find((x: Attachment) => x.id === id);
      if (match && match.filePath && typeof bridge.readAttachmentFile === 'function') {
        const res = await bridge.readAttachmentFile(match.filePath);
        if (res && res.success) return res.dataUri;
      }
      return match?.fileData || null;
    } catch { return null; }
  }
  const all = get<Attachment>(KEYS.ATTACHMENTS);
  return all.find((a) => a.id === id)?.fileData || null;
};
