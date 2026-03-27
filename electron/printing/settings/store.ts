import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

import type {
  PrintMarginsMm,
  PrintPageSize,
  PrintSettings,
  PrintSettingsResult,
  PrintOrientation,
  SavePrintSettingsResult,
} from './types';

const toErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message || fallback;
  const s = String(err ?? '').trim();
  return s || fallback;
};

const ensureDir = async (dir: string): Promise<void> => {
  await fsp.mkdir(dir, { recursive: true });
};

export const getPrintSettingsFilePath = async (): Promise<string> => {
  const dir = path.join(app.getPath('userData'), 'printing');
  await ensureDir(dir);
  return path.join(dir, 'print.settings.json');
};

const clampNumber = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const normalizeMargins = (raw: unknown): PrintMarginsMm => {
  const r = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {};
  return {
    top: clampNumber(r.top, 0, 100, 16),
    right: clampNumber(r.right, 0, 100, 16),
    bottom: clampNumber(r.bottom, 0, 100, 16),
    left: clampNumber(r.left, 0, 100, 16),
  };
};

const normalizePageSize = (raw: unknown): PrintPageSize => {
  if (raw === 'A4' || raw === 'A5' || raw === 'Letter' || raw === 'Legal') return raw;
  if (typeof raw === 'object' && raw) {
    const r = raw as Record<string, unknown>;
    const widthMm = clampNumber(r.widthMm, 50, 1000, 210);
    const heightMm = clampNumber(r.heightMm, 50, 1000, 297);
    return { widthMm, heightMm };
  }
  return 'A4';
};

const normalizeOrientation = (raw: unknown): PrintOrientation =>
  raw === 'landscape' ? 'landscape' : 'portrait';

const normalizeFontFamily = (raw: unknown): string => {
  const s = String(raw ?? '').trim();
  return s || 'system-ui, -apple-system, Segoe UI, Tahoma, Arial, sans-serif';
};

const normalizeBool = (raw: unknown, fallback: boolean): boolean => {
  if (raw === true || raw === false) return raw;
  return fallback;
};

const normalizeSofficePath = (raw: unknown): string | undefined => {
  const s = String(raw ?? '').trim();
  return s ? s : undefined;
};

const normalizePdfExport = (raw: unknown): PrintSettings['pdfExport'] => {
  const r = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {};
  const sofficePath = normalizeSofficePath(r.sofficePath);
  if (!sofficePath) return undefined;
  return { sofficePath };
};

export const getDefaultPrintSettings = (): PrintSettings => ({
  pageSize: 'A4',
  orientation: 'portrait',
  marginsMm: { top: 16, right: 16, bottom: 16, left: 16 },
  fontFamily: 'system-ui, -apple-system, Segoe UI, Tahoma, Arial, sans-serif',
  rtl: true,
  headerEnabled: true,
  footerEnabled: true,
});

export const loadPrintSettings = async (): Promise<PrintSettingsResult> => {
  try {
    const filePath = await getPrintSettingsFilePath();

    let raw: string | null = null;
    try {
      raw = await fsp.readFile(filePath, 'utf8');
    } catch {
      // create defaults on first run
      const defaults = getDefaultPrintSettings();
      await fsp.writeFile(filePath, JSON.stringify(defaults, null, 2), 'utf8');
      raw = JSON.stringify(defaults);
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(String(raw || ''));
    } catch {
      parsed = null;
    }

    const r = typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : {};

    const settings: PrintSettings = {
      pageSize: normalizePageSize(r.pageSize),
      orientation: normalizeOrientation(r.orientation),
      marginsMm: normalizeMargins(r.marginsMm),
      fontFamily: normalizeFontFamily(r.fontFamily),
      rtl: normalizeBool(r.rtl, true),
      headerEnabled: normalizeBool(r.headerEnabled, true),
      footerEnabled: normalizeBool(r.footerEnabled, true),
      pdfExport: normalizePdfExport(r.pdfExport),
    };

    return { ok: true, settings, filePath };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل تحميل إعدادات الطباعة') };
  }
};

export const savePrintSettings = async (next: unknown): Promise<SavePrintSettingsResult> => {
  try {
    if (typeof next !== 'object' || !next)
      return { ok: false, code: 'INVALID', message: 'إعدادات الطباعة غير صالحة' };

    const r = next as Record<string, unknown>;

    const settings: PrintSettings = {
      pageSize: normalizePageSize(r.pageSize),
      orientation: normalizeOrientation(r.orientation),
      marginsMm: normalizeMargins(r.marginsMm),
      fontFamily: normalizeFontFamily(r.fontFamily),
      rtl: normalizeBool(r.rtl, true),
      headerEnabled: normalizeBool(r.headerEnabled, true),
      footerEnabled: normalizeBool(r.footerEnabled, true),
      pdfExport: normalizePdfExport(r.pdfExport),
    };

    const filePath = await getPrintSettingsFilePath();
    await fsp.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
    return { ok: true, filePath };
  } catch (err: unknown) {
    return { ok: false, code: 'FAILED', message: toErrorMessage(err, 'فشل حفظ إعدادات الطباعة') };
  }
};

export const buildCssPageSize = (
  pageSize: PrintPageSize,
  orientation: PrintOrientation
): string => {
  const orient = orientation === 'landscape' ? 'landscape' : 'portrait';

  if (pageSize === 'A4' || pageSize === 'A5' || pageSize === 'Letter' || pageSize === 'Legal') {
    return `${pageSize} ${orient}`;
  }

  const w = clampNumber(pageSize.widthMm, 50, 1000, 210);
  const h = clampNumber(pageSize.heightMm, 50, 1000, 297);
  return `${w}mm ${h}mm ${orient}`;
};

export const buildCssMargins = (m: PrintMarginsMm): string => {
  const top = clampNumber(m.top, 0, 100, 16);
  const right = clampNumber(m.right, 0, 100, 16);
  const bottom = clampNumber(m.bottom, 0, 100, 16);
  const left = clampNumber(m.left, 0, 100, 16);
  return `${top}mm ${right}mm ${bottom}mm ${left}mm`;
};
