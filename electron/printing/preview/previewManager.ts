import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { BrowserWindow, app, dialog } from 'electron';

import type { PrintSettings } from '../settings/types';
import { loadPrintSettings } from '../settings/store';
import type {
  PreviewPrinterInfo,
  PrintPreviewActionResult,
  PrintPreviewOpenPayload,
  PrintPreviewOpenResult,
  PrintPreviewPrintOptions,
  PrintPreviewStateResult,
} from './types';
import { generateDocument } from '../generation/generationEngine';
import { generateDocxFromTemplate } from '../docx/docxTemplateEngine';
import { desktopUserHasPermission } from '../permissions';

type PreviewSession = {
  id: string;
  createdAtIso: string;
  payload: PrintPreviewOpenPayload;
  pdfTempPath: string;
  pdfFileName: string;
  userId?: string;
  webContentsId?: number;
};

const sessions = new Map<string, PreviewSession>();

const toErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message || fallback;
  const s = String(err ?? '').trim();
  return s || fallback;
};

const isPathInside = (parentDir: string, targetPath: string): boolean => {
  try {
    const parentResolved = path.resolve(parentDir);
    const targetResolved = path.resolve(targetPath);
    const rel = path.relative(parentResolved, targetResolved);
    return !!rel && rel !== '.' ? !rel.startsWith('..') && !path.isAbsolute(rel) : true;
  } catch {
    return false;
  }
};

const getPrintingUserDataRoot = (): string => path.join(app.getPath('userData'), 'printing');

const ensurePdfTempSafe = (pdfPath: string): { ok: true } | { ok: false; message: string } => {
  if (!pdfPath || typeof pdfPath !== 'string') return { ok: false, message: 'مسار PDF غير صالح' };
  if (!pdfPath.toLowerCase().endsWith('.pdf')) return { ok: false, message: 'الملف ليس PDF' };

  const root = getPrintingUserDataRoot();
  if (!isPathInside(root, pdfPath))
    return { ok: false, message: 'مسار PDF خارج نطاق مجلد الطباعة' };

  return { ok: true };
};

const getPreviewHtmlPath = (): string =>
  path.join(app.getAppPath(), 'electron', 'printing', 'preview', 'preview.html');

const openPreviewWindow = async (sessionId: string): Promise<BrowserWindow> => {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: true,
    title: 'معاينة الطباعة',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      safeDialogs: true,
      navigateOnDragDrop: false,
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'),
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('will-redirect', (e) => e.preventDefault());

  // Clean up session and temp files when window is closed
  win.on('closed', () => {
    const s = sessions.get(sessionId);
    if (s) {
      sessions.delete(sessionId);
      if (s.pdfTempPath) {
        fsp.rm(s.pdfTempPath, { force: true }).catch(() => {
          // ignore file cleanup errors
        });
      }
    }
  });

  await win.loadFile(getPreviewHtmlPath(), { query: { sid: sessionId } });

  return win;
};

const printPdfFile = async (
  pdfPath: string,
  options?: PrintPreviewPrintOptions
): Promise<PrintPreviewActionResult> => {
  const safe = ensurePdfTempSafe(pdfPath);
  if (safe.ok === false) {
    return { ok: false, code: 'INVALID', message: safe.message };
  }

  const pdfUrl = pathToFileURL(pdfPath).toString();

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
    await win.loadURL(pdfUrl);

    await new Promise<void>((resolve, reject) => {
      const silent = options?.silent === true;
      const printBackground = options?.printBackground !== false;
      const deviceName = String(options?.deviceName ?? '').trim();

      win.webContents.print(
        {
          silent,
          printBackground,
          ...(deviceName ? { deviceName } : {}),
        },
        (ok, reason) => {
          if (!ok) reject(new Error(reason || 'فشل الطباعة'));
          else resolve();
        }
      );
    });

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل طباعة PDF') };
  } finally {
    try {
      win.destroy();
    } catch {
      // ignore
    }
  }
};

const getSessionByWebContentsId = (webContentsId: number): PreviewSession | null => {
  if (!webContentsId || !Number.isFinite(webContentsId)) return null;
  for (const s of sessions.values()) {
    if (s.webContentsId === webContentsId) return s;
  }
  return null;
};

export const listPreviewPrinters = async (
  webContents: Electron.WebContents
): Promise<
  | { ok: true; printers: PreviewPrinterInfo[] }
  | { ok: false; code: 'FAILED' | 'FORBIDDEN' | string; message: string }
> => {
  try {
    const session = getSessionByWebContentsId(webContents.id);
    if (!session) return { ok: false, code: 'FORBIDDEN', message: 'جلسة المعاينة غير موجودة' };
    if (!desktopUserHasPermission(session.userId, 'PRINT_PREVIEW')) {
      return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية استخدام معاينة الطباعة' };
    }

    const printers = await webContents.getPrintersAsync();
    const mapped: PreviewPrinterInfo[] = (printers || [])
      .map((p) => ({
        name: String((p as unknown as { name?: unknown }).name ?? ''),
        displayName: String((p as unknown as { displayName?: unknown }).displayName ?? ''),
        isDefault: Boolean((p as unknown as { isDefault?: unknown }).isDefault),
      }))
      .filter((p) => !!p.name);

    mapped.sort((a, b) => {
      const ad = a.isDefault ? 0 : 1;
      const bd = b.isDefault ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return a.name.localeCompare(b.name);
    });

    return { ok: true, printers: mapped };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل جلب قائمة الطابعات') };
  }
};

const saveTempPdfAs = async (
  pdfPath: string,
  suggestedFileName: string
): Promise<PrintPreviewActionResult> => {
  const safe = ensurePdfTempSafe(pdfPath);
  if (safe.ok === false) {
    return { ok: false, code: 'INVALID', message: safe.message };
  }

  try {
    const res = (await dialog.showSaveDialog({
      title: 'تصدير PDF',
      defaultPath: suggestedFileName || 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    })) as unknown as Electron.SaveDialogReturnValue;

    if (res.canceled || !res.filePath)
      return { ok: false, code: 'CANCELED', message: 'تم الإلغاء' };

    const dest = res.filePath.toLowerCase().endsWith('.pdf') ? res.filePath : `${res.filePath}.pdf`;
    await fsp.copyFile(pdfPath, dest);
    return { ok: true, savedPath: dest };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل تصدير PDF') };
  }
};

const regeneratePdfTemp = async (
  payload: PrintPreviewOpenPayload,
  settings: PrintSettings | null
): Promise<{ ok: true; tempPath: string; fileName: string } | { ok: false; message: string }> => {
  const res = await generateDocument(
    {
      templateName: payload.templateName,
      data: payload.data,
      outputType: 'pdf',
      defaultFileName: payload.defaultFileName,
      headerFooter: payload.headerFooter,
    },
    { settings }
  );

  if (res.ok === false) {
    return { ok: false, message: res.message };
  }
  if (!res.tempPath || !res.fileName) return { ok: false, message: 'فشل توليد ملف PDF مؤقت' };
  return { ok: true, tempPath: res.tempPath, fileName: res.fileName };
};

export const openPrintPreview = async (
  payload: PrintPreviewOpenPayload,
  opts?: { userId?: string }
): Promise<PrintPreviewOpenResult> => {
  try {
    if (!desktopUserHasPermission(opts?.userId, 'PRINT_PREVIEW')) {
      return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية فتح نافذة معاينة الطباعة' };
    }

    if (!payload || typeof payload !== 'object')
      return { ok: false, code: 'INVALID', message: 'طلب المعاينة غير صالح' };
    if (!payload.data || typeof payload.data !== 'object')
      return { ok: false, code: 'INVALID', message: 'بيانات القالب غير صالحة' };

    const loaded = await loadPrintSettings();
    const settings = loaded.ok ? loaded.settings : null;

    const regen = await regeneratePdfTemp(payload, settings);
    if (regen.ok === false) {
      return { ok: false, code: 'FAILED', message: regen.message };
    }

    const id = crypto.randomBytes(8).toString('hex');
    const session: PreviewSession = {
      id,
      createdAtIso: new Date().toISOString(),
      payload,
      pdfTempPath: regen.tempPath,
      pdfFileName: regen.fileName,
      userId: opts?.userId,
    };

    sessions.set(id, session);
    const win = await openPreviewWindow(id);
    session.webContentsId = win.webContents.id;
    sessions.set(id, session);

    return { ok: true, sessionId: id };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل فتح نافذة المعاينة') };
  }
};

export const getPrintPreviewState = async (sessionId: string): Promise<PrintPreviewStateResult> => {
  try {
    const sid = String(sessionId || '').trim();
    if (!sid) return { ok: false, code: 'INVALID', message: 'معرّف الجلسة غير صالح' };

    const s = sessions.get(sid);
    if (!s) return { ok: false, code: 'INVALID', message: 'الجلسة غير موجودة' };

    if (!desktopUserHasPermission(s.userId, 'PRINT_PREVIEW')) {
      return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية استخدام معاينة الطباعة' };
    }

    const safe = ensurePdfTempSafe(s.pdfTempPath);
    if (safe.ok === false) {
      return { ok: false, code: 'FAILED', message: safe.message };
    }

    return {
      ok: true,
      sessionId: s.id,
      pdfPath: s.pdfTempPath,
      pdfUrl: pathToFileURL(s.pdfTempPath).toString(),
      fileName: s.pdfFileName,
      createdAtIso: s.createdAtIso,
    };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل قراءة حالة المعاينة') };
  }
};

export const printFromPreview = async (
  sessionId: string,
  options?: PrintPreviewPrintOptions
): Promise<PrintPreviewActionResult> => {
  const sid = String(sessionId || '').trim();
  if (!sid) return { ok: false, code: 'INVALID', message: 'معرّف الجلسة غير صالح' };

  const s = sessions.get(sid);
  if (!s) return { ok: false, code: 'INVALID', message: 'الجلسة غير موجودة' };

  if (!desktopUserHasPermission(s.userId, 'PRINT_EXECUTE')) {
    return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنفيذ الطباعة' };
  }

  return printPdfFile(s.pdfTempPath, options);
};

export const exportPdfFromPreview = async (
  sessionId: string
): Promise<PrintPreviewActionResult> => {
  const sid = String(sessionId || '').trim();
  if (!sid) return { ok: false, code: 'INVALID', message: 'معرّف الجلسة غير صالح' };

  const s = sessions.get(sid);
  if (!s) return { ok: false, code: 'INVALID', message: 'الجلسة غير موجودة' };

  if (!desktopUserHasPermission(s.userId, 'PRINT_EXPORT')) {
    return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تصدير ملفات الطباعة' };
  }

  const suggested = s.pdfFileName || 'document.pdf';
  return saveTempPdfAs(s.pdfTempPath, suggested);
};

export const exportDocxFromPreview = async (
  sessionId: string
): Promise<PrintPreviewActionResult> => {
  const sid = String(sessionId || '').trim();
  if (!sid) return { ok: false, code: 'INVALID', message: 'معرّف الجلسة غير صالح' };

  const s = sessions.get(sid);
  if (!s) return { ok: false, code: 'INVALID', message: 'الجلسة غير موجودة' };

  if (!desktopUserHasPermission(s.userId, 'PRINT_EXPORT')) {
    return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية تصدير ملفات الطباعة' };
  }

  const docxRes = await generateDocxFromTemplate({
    templateName: s.payload.templateName,
    data: s.payload.data,
    defaultFileName: s.payload.defaultFileName,
    headerFooter: s.payload.headerFooter,
  });

  if (docxRes.ok === false) {
    return {
      ok: false,
      code: docxRes.code as 'CANCELED' | 'FAILED' | 'INVALID',
      message: docxRes.message,
    };
  }
  return { ok: true, savedPath: docxRes.savedPath };
};

export const reloadPreview = async (sessionId: string): Promise<PrintPreviewActionResult> => {
  const sid = String(sessionId || '').trim();
  if (!sid) return { ok: false, code: 'INVALID', message: 'معرّف الجلسة غير صالح' };

  const s = sessions.get(sid);
  if (!s) return { ok: false, code: 'INVALID', message: 'الجلسة غير موجودة' };

  if (!desktopUserHasPermission(s.userId, 'PRINT_PREVIEW')) {
    return { ok: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية استخدام معاينة الطباعة' };
  }

  const loaded = await loadPrintSettings();
  const settings = loaded.ok ? loaded.settings : null;

  const regen = await regeneratePdfTemp(s.payload, settings);
  if (regen.ok === false) {
    return { ok: false, code: 'FAILED', message: regen.message };
  }

  s.pdfTempPath = regen.tempPath;
  s.pdfFileName = regen.fileName;
  sessions.set(sid, s);

  return { ok: true };
};
