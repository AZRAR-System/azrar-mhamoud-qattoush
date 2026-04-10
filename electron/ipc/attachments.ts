import type { IpcDeps } from './deps.js';
import * as ipc from './context.js';
import { ipcMain, dialog, app, shell } from 'electron';

import {
  kvDelete,
  kvGet,
  kvGetDeletedAt,
  kvKeys,
  kvSetWithUpdatedAt,
  getDbPath,
} from '../db';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { pushKvDelete, pushKvUpsert, logSyncError } from '../sqlSync';
import logger from '../logger';
import { ensureInsideRoot } from '../utils/pathSafety';
import { toErrorMessage } from '../utils/errors';
import { isRecord } from '../utils/unknown';
import {
  decryptFileToBuffer,
  decryptFileToFile,
  encryptBufferToFile,
  isEncryptedFile,
} from '../utils/fileEncryption';
import {
  decryptSecretBestEffort,
  getBackupEncryptionPasswordState,
  readBackupEncryptionSettings,
} from '../utils/backupEncryptionSettings';

export function registerAttachments(deps: IpcDeps): void {
  void deps;
  // =====================
  // Attachments (Files)
  // =====================
  
  // IMPORTANT: Keep attachments in a stable location across updates.
  // Storing next to the executable can change between versions/install folders and makes attachments appear "lost".
  const getStableAttachmentsRoot = () => path.join(path.dirname(getDbPath()), 'attachments');
  
  const getLegacyExeAttachmentsRoot = () => {
    if (!app.isPackaged) return null;
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      return path.join(exeDir, 'attachments');
    } catch {
      return null;
    }
  };
  
  const getLastResortAttachmentsRoot = () => path.join(app.getPath('userData'), 'attachments');
  
  const ensureWritableDir = async (dir: string) => {
    await fsp.mkdir(dir, { recursive: true });
    const probe = path.join(dir, '.write-test');
    await fsp.writeFile(probe, 'ok');
    await fsp.unlink(probe);
  };
  
  const directoryExists = (p: string): boolean => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  };
  
  const migrateLegacyAttachmentsOnce = async (stableRoot: string) => {
    const stableEntries = await fsp.readdir(stableRoot).catch(() => [] as string[]);
    const stableHasData =
      stableEntries.filter(
        (n) =>
          n && n !== '.write-test' && n !== '.migrated-from-exe' && n !== '.migrated-from-userData'
      ).length > 0;
    if (stableHasData) return;
  
    const tryMigrate = async (srcDir: string | null, markerName: string) => {
      if (!srcDir) return;
      if (!directoryExists(srcDir)) return;
      if (path.resolve(srcDir) === path.resolve(stableRoot)) return;
  
      const marker = path.join(stableRoot, markerName);
      try {
        await fsp.access(marker);
        return;
      } catch {
        // continue
      }
  
      try {
        const entries = await fsp.readdir(srcDir).catch(() => [] as string[]);
        const hasData = entries.length > 0;
        if (hasData) {
          await fsp.cp(srcDir, stableRoot, { recursive: true, force: false });
        }
      } catch {
        // ignore
      }
  
      try {
        await fsp.writeFile(marker, new Date().toISOString(), 'utf8');
      } catch {
        // ignore
      }
    };
  
    // 1) Legacy packaged behavior: attachments next to the executable.
    await tryMigrate(getLegacyExeAttachmentsRoot(), '.migrated-from-exe');
  
    // 2) Older/alternate behavior: attachments under userData.
    await tryMigrate(getLastResortAttachmentsRoot(), '.migrated-from-userData');
  };
  
  const getAttachmentsRoot = async () => {
    const stable = getStableAttachmentsRoot();
    try {
      await ensureWritableDir(stable);
      await migrateLegacyAttachmentsOnce(stable);
      return stable;
    } catch {
      const last = getLastResortAttachmentsRoot();
      await ensureWritableDir(last);
      return last;
    }
  };
  
  const resolveExistingAttachmentAbsPath = async (storedPath: string) => {
    let raw = String(storedPath || '').trim();
    if (!raw) throw new Error('Invalid attachment path');
  
    // Accept file:// URLs (some older code paths may store those)
    if (/^file:\/\//i.test(raw)) {
      try {
        raw = fileURLToPath(raw);
      } catch {
        // ignore and continue with raw
      }
    }
  
    const stableRoot = await getAttachmentsRoot();
    const legacyRoot = getLegacyExeAttachmentsRoot();
    const userDataRoot = getLastResortAttachmentsRoot();
  
    const normalizeRel = (p: string) =>
      String(p || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .trim();
  
    const tryRelative = async (relCandidate: string) => {
      const rel = normalizeRel(relCandidate);
      if (!rel) return null;
  
      const stableAbs = path.join(stableRoot, rel);
      ensureInsideRoot(stableRoot, stableAbs);
      try {
        await fsp.access(stableAbs);
        return stableAbs;
      } catch {
        // continue
      }
  
      if (legacyRoot) {
        const legacyAbs = path.join(legacyRoot, rel);
        ensureInsideRoot(legacyRoot, legacyAbs);
        await fsp.access(legacyAbs);
        return legacyAbs;
      }
  
      if (userDataRoot && path.resolve(userDataRoot) !== path.resolve(stableRoot)) {
        const udAbs = path.join(userDataRoot, rel);
        ensureInsideRoot(userDataRoot, udAbs);
        await fsp.access(udAbs);
        return udAbs;
      }
  
      return null;
    };
  
    const tryAbsoluteWithinRoots = async (absCandidate: string) => {
      const abs = path.normalize(absCandidate);
      try {
        ensureInsideRoot(stableRoot, abs);
        await fsp.access(abs);
        return abs;
      } catch {
        // continue
      }
  
      if (legacyRoot) {
        ensureInsideRoot(legacyRoot, abs);
        await fsp.access(abs);
        return abs;
      }
  
      if (userDataRoot && path.resolve(userDataRoot) !== path.resolve(stableRoot)) {
        ensureInsideRoot(userDataRoot, abs);
        await fsp.access(abs);
        return abs;
      }
  
      return null;
    };
  
    const extractKnownRelative = (p: string) => {
      const s = String(p || '').replace(/\\/g, '/');
      const markers = ['/Persons/', '/Properties/', '/Contracts/', '/Maintenance/', '/Sales/'];
      for (const m of markers) {
        const idx = s.toLowerCase().indexOf(m.toLowerCase());
        if (idx >= 0) return s.slice(idx + 1);
      }
      return null;
    };
  
    const looksAbsolute =
      path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\');
  
    if (looksAbsolute) {
      const okAbs = await tryAbsoluteWithinRoots(raw);
      if (okAbs) return okAbs;
  
      const relFromAbs = extractKnownRelative(raw);
      if (relFromAbs) {
        const okRel = await tryRelative(relFromAbs);
        if (okRel) return okRel;
      }
  
      throw new Error('Attachment file not found');
    }
  
    const okRel = await tryRelative(raw);
    if (okRel) return okRel;
  
    // Some sync/legacy values may have extra leading folders; attempt to recover.
    const relRecovered = extractKnownRelative(raw);
    if (relRecovered) {
      const okRel2 = await tryRelative(relRecovered);
      if (okRel2) return okRel2;
    }
  
    throw new Error('Attachment file not found');
  };
  
  const assertSafeIpcString = (value: unknown, label: string, maxLen = 2048): string => {
    const s = String(value ?? '');
    if (!s.trim()) throw new Error(`${label}: invalid`);
    if (s.length > maxLen) throw new Error(`${label}: too long`);
    // Defensive: reject null bytes
    if (s.includes('\u0000')) throw new Error(`${label}: invalid`);
    return s;
  };
  
  const getAttachmentRoots = async (): Promise<string[]> => {
    const stableRoot = await getAttachmentsRoot();
    const legacyRoot = getLegacyExeAttachmentsRoot();
    const userDataRoot = getLastResortAttachmentsRoot();
  
    const roots = [stableRoot];
    if (legacyRoot) roots.push(legacyRoot);
    if (userDataRoot && path.resolve(userDataRoot) !== path.resolve(stableRoot))
      roots.push(userDataRoot);
    return roots;
  };
  
  const ensureRealpathWithinAttachmentRoots = async (absPath: string): Promise<void> => {
    const roots = await getAttachmentRoots();
    let real: string;
    try {
      real = await fsp.realpath(absPath);
    } catch {
      // If realpath fails (rare on Windows), fall back to absPath checks.
      real = absPath;
    }
  
    for (const r of roots) {
      try {
        ensureInsideRoot(r, real);
        return;
      } catch {
        // try next root
      }
    }
    throw new Error('Invalid attachment path');
  };
  
  const assertSafeAttachmentFile = async (absPath: string): Promise<void> => {
    const st = await fsp.lstat(absPath);
    if (st.isSymbolicLink()) throw new Error('Invalid attachment path');
    if (!st.isFile()) throw new Error('Invalid attachment path');
    await ensureRealpathWithinAttachmentRoots(absPath);
  };
  
  const isDangerousToOpenByDefault = (absPath: string): boolean => {
    const ext = path.extname(absPath).toLowerCase();
    // SECURITY: Block common executable, script, shortcut, and dangerous formats.
    // This list is maintained to prevent execution of potentially harmful files.
    return [
      // Windows executables
      '.exe',
      '.msi',
      '.com',
      '.scr',
      '.pif',
      '.gadget',
      // Script files
      '.bat',
      '.cmd',
      '.ps1',
      '.psm1',
      '.psd1',
      '.vbs',
      '.vbe',
      '.js',
      '.jse',
      '.ws',
      '.wsf',
      '.wsc',
      '.wsh',
      // Java/Compiled
      '.jar',
      '.class',
      // HTML Application (dangerous)
      '.hta',
      '.mht',
      '.mhtml',
      // NOTE: .htm and .html removed - they are commonly used for documentation
      // and are generally safe when opened in browsers with proper sandbox
      // Control Panel / System
      '.cpl',
      '.inf',
      '.ins',
      '.isp',
      // Shortcuts and links
      '.lnk',
      '.url',
      '.scf',
      '.desktop',
      // Registry
      '.reg',
      // Microsoft Office macros (can contain malicious code)
      '.docm',
      '.xlsm',
      '.pptm',
      '.dotm',
      '.xltm',
      '.potm',
      '.ppam',
      '.xlam',
      // Other dangerous formats
      '.appref-ms',
      '.application',
      '.chm',
      '.hlp',
      '.lib',
      '.dll',
      '.sys',
      '.drv',
      '.ocx',
    ].includes(ext);
  };
  
  const sanitizeSegment = (input: string, maxLen = 80): string => {
    const raw = String(input ?? '').trim();
    if (!raw) return 'غير_معروف';
    // Remove path separators and Windows-illegal characters
    const cleaned = raw
      .replace(/[\\/]+/g, '-')
      .replace(/[<>:"|?*]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  
    // Remove ASCII control chars (0..31) without using a control-regex range.
    let cleanedNoControl = '';
    for (let i = 0; i < cleaned.length; i++) {
      const code = cleaned.charCodeAt(i);
      if (code >= 32) cleanedNoControl += cleaned[i];
    }
  
    const safeRaw = cleanedNoControl || 'غير_معروف';
    const safe = safeRaw === '.' || safeRaw === '..' ? 'غير_معروف' : safeRaw;
    return safe.length > maxLen ? safe.slice(0, maxLen).trim() : safe;
  };
  
  const mimeFromExt = (extRaw: string): string => {
    const ext = (extRaw || '').toLowerCase().replace(/^\./, '');
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'bmp':
        return 'image/bmp';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/octet-stream';
    }
  };
  
  const makeTimestampPrefix = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}__${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };
  
  const chooseTypeFolder = (referenceType: string): string => {
    switch (String(referenceType || '').toLowerCase()) {
      case 'person':
        return 'Persons';
      case 'property':
        return 'Properties';
      case 'contract':
        return 'Contracts';
      case 'maintenance':
        return 'Maintenance';
      case 'sales':
        return 'Sales';
      default:
        return sanitizeSegment(referenceType || 'Other');
    }
  };
  
  ipcMain.handle(
    'attachments:save',
    async (
      _e,
      payload: {
        referenceType: string;
        entityFolder: string;
        originalFileName: string;
        bytes: ArrayBuffer | ArrayBufferView;
      }
    ) => {
      try {
        const root = await getAttachmentsRoot();
        const typeFolder = chooseTypeFolder(payload?.referenceType);
        const entityFolder = sanitizeSegment(payload?.entityFolder || 'غير_معروف');
  
        const bytes = payload?.bytes;
        const byteLen: number =
          bytes instanceof ArrayBuffer
            ? bytes.byteLength
            : ArrayBuffer.isView(bytes)
              ? bytes.byteLength
              : 0;
        if (!byteLen) return { success: false, message: 'المرفق غير صالح' };
        if (byteLen > ipc.MAX_ATTACHMENT_BYTES)
          return { success: false, message: 'حجم المرفق كبير جداً' };
  
        const dir = path.join(root, typeFolder, entityFolder);
        ensureInsideRoot(root, dir);
        await fsp.mkdir(dir, { recursive: true });
  
        const original = String(payload?.originalFileName || 'file');
        const originalSafe = sanitizeSegment(original, 140);
        const stamped = `${makeTimestampPrefix()}__${originalSafe}`;
  
        const baseName = stamped;
        const ext = path.extname(originalSafe);
        const stem = ext ? baseName.slice(0, -ext.length) : baseName;
  
        let candidate = baseName;
        let i = 1;
        while (true) {
          const abs = path.join(dir, candidate);
          ensureInsideRoot(root, abs);
          try {
            await fsp.access(abs);
            // exists
            candidate = `${stem} (${i++})${ext}`;
          } catch {
            break;
          }
        }
  
        const absPath = path.join(dir, candidate);
        ensureInsideRoot(root, absPath);
  
        const buf = (() => {
          if (bytes instanceof ArrayBuffer) return Buffer.from(new Uint8Array(bytes));
          if (!ArrayBuffer.isView(bytes)) return Buffer.from([]);
          const u8 =
            bytes instanceof Uint8Array
              ? bytes
              : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          return Buffer.from(u8);
        })();
        // Encrypt attachments at rest when backup encryption is enabled.
        // NOTE: We only encrypt on-disk; callers still reference the same relativePath.
        const encState = await getBackupEncryptionPasswordState();
        if (!encState.enabled) {
          await fsp.writeFile(absPath, buf);
        } else {
          if (!encState.configured || !encState.password) {
            return {
              success: false,
              message:
                'تشفير البيانات مفعل لكن كلمة المرور غير مضبوطة. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.',
            };
          }
          await encryptBufferToFile({ bytes: buf, destPath: absPath, password: encState.password });
        }
  
        const relativePath = path.relative(root, absPath).split(path.sep).join('/');
        return { success: true, relativePath, filePath: absPath, storedFileName: candidate };
      } catch (err: unknown) {
        return { success: false, message: toErrorMessage(err, 'Failed to save attachment') };
      }
    }
  );
  
  ipcMain.handle('attachments:read', async (_e, relativePath: string) => {
    try {
      const safeRel = assertSafeIpcString(relativePath, 'relativePath');
      const abs = await resolveExistingAttachmentAbsPath(safeRel);
      await assertSafeAttachmentFile(abs);
      const st = await fsp.stat(abs);
      // Allow a tiny overhead for encrypted-at-rest files.
      if (st.size > ipc.MAX_ATTACHMENT_BYTES + 256) {
        return { success: false, message: 'حجم الملف كبير جداً' };
      }
      const looksEncrypted = await isEncryptedFile(abs);
      const data = looksEncrypted
        ? await (async () => {
            const s = await readBackupEncryptionSettings();
            const password = s.passwordEnc
              ? decryptSecretBestEffort(String(s.passwordEnc || ''))
              : '';
            if (!password)
              throw new Error(
                'لا توجد كلمة مرور لفك تشفير المرفقات. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.'
              );
            return await decryptFileToBuffer({
              sourcePath: abs,
              password,
              maxBytes: ipc.MAX_ATTACHMENT_BYTES,
            });
          })()
        : await fsp.readFile(abs);
      const ext = path.extname(abs);
      const mime = mimeFromExt(ext);
      const dataUri = `data:${mime};base64,${data.toString('base64')}`;
      return { success: true, dataUri };
    } catch (err: unknown) {
      logger.warn(
        '[IPC][attachments:read] blocked/failed',
        toErrorMessage(err, 'فشل قراءة المرفق')
      );
      return { success: false, message: toErrorMessage(err, 'Failed to read attachment') };
    }
  });
  
  ipcMain.handle('attachments:delete', async (_e, relativePath: string) => {
    try {
      const safeRel = assertSafeIpcString(relativePath, 'relativePath');
      const abs = await resolveExistingAttachmentAbsPath(safeRel);
      await assertSafeAttachmentFile(abs);
      await fsp.unlink(abs);
      return { success: true };
    } catch (err: unknown) {
      logger.warn(
        '[IPC][attachments:delete] blocked/failed',
        toErrorMessage(err, 'Failed to delete attachment')
      );
      return { success: false, message: toErrorMessage(err, 'Failed to delete attachment') };
    }
  });
  
  ipcMain.handle('attachments:open', async (_e, relativePath: string) => {
    try {
      const safeRel = assertSafeIpcString(relativePath, 'relativePath');
      const abs = await resolveExistingAttachmentAbsPath(safeRel);
      await assertSafeAttachmentFile(abs);
  
      if (isDangerousToOpenByDefault(abs)) {
        logger.warn('[IPC][attachments:open] blocked dangerous file type', abs);
        return { success: false, message: 'تم حظر فتح هذا النوع من الملفات لأسباب أمنية' };
      }
  
      const looksEncrypted = await isEncryptedFile(abs);
      const toOpen = !looksEncrypted
        ? abs
        : await (async () => {
            const s = await readBackupEncryptionSettings();
            const password = s.passwordEnc
              ? decryptSecretBestEffort(String(s.passwordEnc || ''))
              : '';
            if (!password) {
              throw new Error(
                'لا توجد كلمة مرور لفك تشفير المرفقات. اضبط كلمة المرور من الإعدادات ثم أعد المحاولة.'
              );
            }
            const ext = path.extname(abs);
            const tmp = path.join(
              app.getPath('temp'),
              `AZRAR-attachment-open-${Date.now()}${ext || ''}`
            );
            await decryptFileToFile({ sourcePath: abs, destPath: tmp, password });
            // Best-effort cleanup after some time (do not fail open if cleanup fails).
            setTimeout(
              () => {
                void fsp.unlink(tmp).catch(() => undefined);
              },
              10 * 60 * 1000
            );
            return tmp;
          })();
  
      const errMsg = await shell.openPath(toOpen);
      if (errMsg) return { success: false, message: String(errMsg) };
      return { success: true };
    } catch (err: unknown) {
      logger.warn(
        '[IPC][attachments:open] blocked/failed',
        toErrorMessage(err, 'Failed to open attachment')
      );
      return { success: false, message: toErrorMessage(err, 'Failed to open attachment') };
    }
  });
  
  ipcMain.handle('attachments:pullNow', async () => {
    try {
      const raw = kvGet('db_attachments');
      const json = typeof raw === 'string' && raw.trim() ? raw : '[]';
      const res = await pullAttachmentFilesForAttachmentsJson(json);
      return { success: true, ...res };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'فشل تنزيل المرفقات') };
    }
  });
  
  // Word templates
  type WordTemplateType = 'contracts' | 'installments' | 'handover';
  
  type StoredWordTemplate = {
    /** Stable ID for the template (part of the KV key). */
    key: string;
    templateType: WordTemplateType;
    fileName: string;
    bytesBase64: string;
    size: number;
    sha256?: string;
    updatedAt: string;
  };
  
  const WORD_TEMPLATE_KV_PREFIX = 'db_word_template_';
  
  const templateKvKeyPrefixFor = (t: WordTemplateType) => `${WORD_TEMPLATE_KV_PREFIX}${t}_`;
  const makeTemplateKvKey = (t: WordTemplateType, key: string) =>
    `${WORD_TEMPLATE_KV_PREFIX}${t}_${key}`;
  
  const safeJsonParseStoredWordTemplate = (raw: string): StoredWordTemplate | null => {
    const s = String(raw || '').trim();
    if (!s) return null;
    try {
      const parsed = JSON.parse(s) as unknown;
      if (!isRecord(parsed)) return null;
  
      const rec = parsed as Record<string, unknown>;
      const key = String(rec.key ?? '').trim();
      const templateType = normalizeTemplateType(rec.templateType);
      const fileName = path.basename(String(rec.fileName ?? '').trim());
      const bytesBase64 = String(rec.bytesBase64 ?? '').trim();
      const size = Number(rec.size ?? 0);
      const sha256 = String(rec.sha256 ?? '').trim() || undefined;
      const updatedAt = String(rec.updatedAt ?? '').trim() || new Date().toISOString();
  
      if (!key || !fileName || !fileName.toLowerCase().endsWith('.docx')) return null;
      if (!bytesBase64) return null;
      if (!Number.isFinite(size) || size <= 0 || size > ipc.MAX_TEMPLATE_BYTES) return null;
  
      return { key, templateType, fileName, bytesBase64, size, sha256, updatedAt };
    } catch {
      return null;
    }
  };
  
  const listStoredTemplatesFor = (
    t: WordTemplateType
  ): Array<{ kvKey: string; item: StoredWordTemplate }> => {
    try {
      const prefix = templateKvKeyPrefixFor(t);
      const keys = (kvKeys?.() || []).filter((k) => String(k || '').startsWith(prefix));
      const out: Array<{ kvKey: string; item: StoredWordTemplate }> = [];
      for (const k of keys) {
        try {
          const raw = kvGet(k);
          const item = safeJsonParseStoredWordTemplate(typeof raw === 'string' ? raw : '');
          if (item && item.templateType === t) out.push({ kvKey: k, item });
        } catch {
          // ignore
        }
      }
      return out;
    } catch {
      return [];
    }
  };
  
  const setKvAndPushUpsert = (k: string, v: string, updatedAt: string) => {
    kvSetWithUpdatedAt(k, v, updatedAt);
    void pushKvUpsert({ key: k, value: v, updatedAt }).catch((err: unknown) => {
      logSyncError('push:wordTemplate:set', err);
    });
  };
  
  const deleteKvAndPushDelete = (k: string) => {
    kvDelete(k);
    const deletedAt = kvGetDeletedAt(k) || new Date().toISOString();
    void pushKvDelete({ key: k, deletedAt }).catch((err: unknown) => {
      logSyncError('push:wordTemplate:delete', err);
    });
  };
  
  const sha256Hex = (buf: Buffer): string => crypto.createHash('sha256').update(buf).digest('hex');
  
  const materializeTemplateFileFromStored = async (
    templatesDir: string,
    stored: StoredWordTemplate
  ) => {
    const safeName = path.basename(stored.fileName);
    if (!safeName.toLowerCase().endsWith('.docx'))
      throw new Error('القالب يجب أن يكون ملف Word (.docx)');
    if (!stored.bytesBase64) throw new Error('القالب غير صالح');
  
    const abs = path.join(templatesDir, safeName);
    try {
      const st = await fsp.stat(abs);
      if (st.isFile() && st.size > 0) return abs;
    } catch {
      // ignore
    }
  
    const buf = Buffer.from(stored.bytesBase64, 'base64');
    if (!buf || buf.byteLength <= 0) throw new Error('القالب غير صالح');
    if (buf.byteLength > ipc.MAX_TEMPLATE_BYTES) throw new Error('حجم القالب كبير جداً');
  
    await fsp.writeFile(abs, buf);
    return abs;
  };
  
  const normalizeTemplateType = (raw: unknown): WordTemplateType => {
    const v = String(raw || '')
      .trim()
      .toLowerCase();
    if (v === 'contracts') return 'contracts';
    if (v === 'installments') return 'installments';
    if (v === 'handover') return 'handover';
    return 'contracts';
  };
  
  const templateTypeLabelAr = (t: WordTemplateType) => {
    if (t === 'contracts') return 'العقود';
    if (t === 'installments') return 'الكمبيالات';
    return 'محضر التسليم';
  };
  
  const templateFallbackFolder = (t: WordTemplateType) => {
    if (t === 'contracts') return 'العقود الورد';
    if (t === 'installments') return 'الكمبيالات الورد';
    return 'محضر التسليم الورد';
  };
  
  const getTemplatesDir = async (templateType: WordTemplateType) => {
    // Put templates next to the DB file. In server/LAN setups this can be a shared folder
    // by setting AZRAR_DESKTOP_DB_DIR or AZRAR_DESKTOP_DB_PATH.
    const dir = path.join(path.dirname(getDbPath()), 'templates', templateType);
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  };
  
  const ensureUniqueFileName = async (dir: string, fileName: string) => {
    const ext = path.extname(fileName);
    const stem = ext ? fileName.slice(0, -ext.length) : fileName;
    let candidate = fileName;
    let i = 1;
    while (true) {
      const abs = path.join(dir, candidate);
      try {
        await fsp.access(abs);
        candidate = `${stem} (${i++})${ext}`;
      } catch {
        return candidate;
      }
    }
  };
  
  ipcMain.handle('templates:list', async (_e, payload?: { templateType?: string }) => {
    try {
      const templateType = normalizeTemplateType(payload?.templateType);
      const dir = await getTemplatesDir(templateType);
      const nowIso = new Date().toISOString();
  
      // 1) Load stored templates for this type (synced via KV/SQL)
      const stored = listStoredTemplatesFor(templateType);
  
      // 2) Ensure local files exist for stored templates (materialize missing ones)
      for (const s of stored) {
        try {
          await materializeTemplateFileFromStored(dir, s.item);
        } catch {
          // ignore
        }
      }
  
      // 3) Read local templates
      const items = await fsp.readdir(dir);
      const localDocx = items.filter((x) => x.toLowerCase().endsWith('.docx'));
  
      // 4) Migrate any local templates missing from KV into KV (one-time self-heal)
      const storedByName = new Map<string, { kvKey: string; item: StoredWordTemplate }>();
      for (const s of stored) storedByName.set(String(s.item.fileName).toLowerCase(), s);
  
      for (const fileName of localDocx) {
        const lower = String(fileName).toLowerCase();
        if (storedByName.has(lower)) continue;
  
        try {
          const abs = path.join(dir, fileName);
          const st = await fsp.stat(abs);
          if (!st.isFile() || st.size <= 0 || st.size > ipc.MAX_TEMPLATE_BYTES) continue;
          const buf = await fsp.readFile(abs);
          if (!buf || buf.byteLength <= 0 || buf.byteLength > ipc.MAX_TEMPLATE_BYTES) continue;
  
          const key =
            crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const kvKey = makeTemplateKvKey(templateType, key);
          const item: StoredWordTemplate = {
            key,
            templateType,
            fileName,
            bytesBase64: Buffer.from(buf).toString('base64'),
            size: buf.byteLength,
            sha256: sha256Hex(buf),
            updatedAt: nowIso,
          };
          setKvAndPushUpsert(kvKey, JSON.stringify(item), nowIso);
          storedByName.set(lower, { kvKey, item });
        } catch {
          // ignore
        }
      }
  
      // 5) Return union of filenames (local + stored)
      const allNames = new Set<string>();
      for (const n of localDocx) allNames.add(n);
      for (const s of storedByName.values()) allNames.add(s.item.fileName);
      const docx = Array.from(allNames).filter((x) => String(x).toLowerCase().endsWith('.docx'));
  
      const details = docx
        .map((fileName) => {
          const hit = storedByName.get(String(fileName).toLowerCase());
          return {
            fileName,
            kvKey: hit?.kvKey,
            key: hit?.item?.key,
            updatedAt: hit?.item?.updatedAt,
          };
        })
        .sort((a, b) => String(a.fileName).localeCompare(String(b.fileName)));
  
      return { success: true, items: docx, details, dir, templateType };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to list templates') };
    }
  });
  
  ipcMain.handle('templates:import', async (e, payload?: { templateType?: string }) => {
    try {
      const templateType = normalizeTemplateType(payload?.templateType);
  
      const userId = ipc.getSessionUserId(e.sender);
      const allowed =
        desktopUserHasPermission(userId, 'PRINT_TEMPLATES_EDIT') ||
        desktopUserHasPermission(userId, 'SETTINGS_ADMIN');
      if (!allowed) return { success: false, message: 'ليس لديك صلاحية إدارة قوالب الطباعة' };
  
      const result = (await dialog.showOpenDialog({
        title: `اختر قالب Word لـ ${templateTypeLabelAr(templateType)}`,
        properties: ['openFile'],
        filters: [{ name: 'Word (.docx)', extensions: ['docx'] }],
      })) as any;
      if (result.canceled || result.filePaths.length === 0)
        return { success: false, message: 'تم الإلغاء' };
  
      const selected = result.filePaths[0];
      if (!selected) return { success: false, message: 'مسار الملف غير صالح' };
  
      const resolved = await fsp.realpath(selected).catch(() => path.resolve(selected));
      if (ipc.isUncPath(resolved))
        return { success: false, message: 'غير مسموح استيراد القالب من مسار شبكة (UNC)' };
  
      const st = await fsp.stat(resolved);
      if (!st.isFile()) return { success: false, message: 'الملف غير صالح' };
      if (st.size <= 0) return { success: false, message: 'الملف فارغ' };
      if (st.size > ipc.MAX_TEMPLATE_BYTES) return { success: false, message: 'حجم القالب كبير جداً' };
  
      const safeName = path.basename(resolved);
      if (!safeName.toLowerCase().endsWith('.docx'))
        return { success: false, message: 'الملف يجب أن يكون .docx' };
  
      const dir = await getTemplatesDir(templateType);
      const uniqueName = await ensureUniqueFileName(dir, safeName);
      const dest = path.join(dir, uniqueName);
      await fsp.copyFile(resolved, dest);
  
      // Persist the template bytes in KV so it gets a stable key and syncs to SQL.
      try {
        const nowIso = new Date().toISOString();
        const buf = await fsp.readFile(dest);
        if (buf && buf.byteLength > 0 && buf.byteLength <= ipc.MAX_TEMPLATE_BYTES) {
          const key =
            crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const kvKey = makeTemplateKvKey(templateType, key);
          const item: StoredWordTemplate = {
            key,
            templateType,
            fileName: uniqueName,
            bytesBase64: Buffer.from(buf).toString('base64'),
            size: buf.byteLength,
            sha256: sha256Hex(buf),
            updatedAt: nowIso,
          };
          setKvAndPushUpsert(kvKey, JSON.stringify(item), nowIso);
        }
      } catch {
        // ignore (file is still imported locally)
      }
  
      return { success: true, fileName: uniqueName, dir, templateType };
    } catch (err: unknown) {
      return { success: false, message: toErrorMessage(err, 'Failed to import template') };
    }
  });
  
  ipcMain.handle(
    'templates:read',
    async (_e, payload: { templateName: string; templateType?: string }) => {
      try {
        const rawName = String(payload?.templateName || '').trim();
        const templateType = normalizeTemplateType(payload?.templateType);
        const templatesDir = await getTemplatesDir(templateType);
  
        let safeName = path.basename(rawName);
        if (!safeName) {
          // If not provided, try auto-pick when there is exactly one template
          try {
            const items = (await fsp.readdir(templatesDir)).filter((x) =>
              x.toLowerCase().endsWith('.docx')
            );
            if (items.length === 1) safeName = items[0];
          } catch {
            // ignore
          }
        }
        if (!safeName) return { success: false, message: 'اسم القالب غير صالح' };
  
        if (!safeName.toLowerCase().endsWith('.docx')) {
          return { success: false, message: 'القالب يجب أن يكون ملف Word (.docx)' };
        }
  
        const candidates = [
          // Preferred: user-imported templates
          path.join(templatesDir, safeName),
          // Dev/workspace
          path.join(process.cwd(), templateFallbackFolder(templateType), safeName),
          // Packaged resources path (best-effort)
          path.join(app.getAppPath(), templateFallbackFolder(templateType), safeName),
          // Beside the installed EXE (portable/installed)
          path.join(
            path.dirname(app.getPath('exe')),
            templateFallbackFolder(templateType),
            safeName
          ),
        ];
  
        let found: string | null = null;
        for (const p of candidates) {
          try {
            if (fs.existsSync(p) && fs.statSync(p).isFile()) {
              found = p;
              break;
            }
          } catch {
            // ignore
          }
        }
  
        if (!found) {
          // If the file isn't available locally, try to reconstruct it from KV (synced from SQL).
          try {
            const stored = listStoredTemplatesFor(templateType);
            const hit = stored.find(
              (s) => String(s.item.fileName).toLowerCase() === safeName.toLowerCase()
            );
            if (hit) {
              const abs = await materializeTemplateFileFromStored(templatesDir, hit.item);
              found = abs;
            }
          } catch {
            // ignore
          }
  
          if (!found) {
            return {
              success: false,
              message: `لم يتم العثور على قالب Word: ${safeName}. يمكنك استيراد القالب من داخل البرنامج وسيتم حفظه تلقائياً داخل مجلد النظام: templates/${templateType}`,
            };
          }
        }
  
        const resolvedFound = await fsp.realpath(found).catch(() => found);
        const allowedRoots = [
          templatesDir,
          path.join(process.cwd(), templateFallbackFolder(templateType)),
          path.join(app.getAppPath(), templateFallbackFolder(templateType)),
          path.join(path.dirname(app.getPath('exe')), templateFallbackFolder(templateType)),
        ];
  
        const isInsideAnyRoot = allowedRoots.some((root) => {
          try {
            const rootResolved = path.resolve(root);
            const targetResolved = path.resolve(resolvedFound);
            const rel = path.relative(rootResolved, targetResolved);
            if (!rel || rel === '.') return true;
            return !rel.startsWith('..') && !path.isAbsolute(rel);
          } catch {
            return false;
          }
        });
  
        if (!isInsideAnyRoot) {
          return { success: false, message: 'مسار القالب غير صالح' };
        }
  
        const st = await fsp.stat(resolvedFound);
        if (!st.isFile()) return { success: false, message: 'القالب غير صالح' };
        if (st.size <= 0) return { success: false, message: 'القالب فارغ' };
        if (st.size > ipc.MAX_TEMPLATE_BYTES)
          return { success: false, message: 'حجم القالب كبير جداً' };
  
        const buf = await fsp.readFile(resolvedFound);
        if (buf.byteLength > ipc.MAX_TEMPLATE_BYTES) {
          return { success: false, message: 'حجم القالب كبير جداً' };
        }
  
        const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const dataUri = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
        return { success: true, dataUri, fileName: safeName };
      } catch (err: unknown) {
        return { success: false, message: toErrorMessage(err, 'Failed to read template') };
      }
    }
  );
  
  ipcMain.handle(
    'templates:delete',
    async (_e, payload: { templateName: string; templateType?: string }) => {
      try {
        const rawName = String(payload?.templateName || '').trim();
        const templateType = normalizeTemplateType(payload?.templateType);
        const templatesDir = await getTemplatesDir(templateType);
  
        const safeName = path.basename(rawName);
        if (!safeName) return { success: false, message: 'اسم القالب غير صالح' };
        if (!safeName.toLowerCase().endsWith('.docx')) {
          return { success: false, message: 'القالب يجب أن يكون ملف Word (.docx)' };
        }
  
        const abs = path.join(templatesDir, safeName);
        const resolvedAbs = await fsp.realpath(abs).catch(() => abs);
  
        // Ensure deletion only inside the template type directory.
        const templatesDirResolved = await fsp.realpath(templatesDir).catch(() => templatesDir);
        const rel = path.relative(templatesDirResolved, resolvedAbs);
        if (!rel || rel === '.') {
          return { success: false, message: 'مسار القالب غير صالح' };
        }
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          return { success: false, message: 'مسار القالب غير صالح' };
        }
  
        await fsp.unlink(resolvedAbs);
  
        // Remove from KV store (synced) if present.
        try {
          const stored = listStoredTemplatesFor(templateType);
          const hit = stored.find(
            (s) => String(s.item.fileName).toLowerCase() === safeName.toLowerCase()
          );
          if (hit) {
            deleteKvAndPushDelete(hit.kvKey);
          }
        } catch {
          // ignore
        }
        return { success: true };
      } catch (err: unknown) {
        const msg = toErrorMessage(err, 'Failed to delete template');
  
        if (/ENOENT/i.test(msg)) {
          return { success: false, message: 'القالب غير موجود (ربما تم حذفه مسبقاً)' };
        }
        if (/EPERM|EBUSY/i.test(msg)) {
          return {
            success: false,
            message: 'تعذر حذف القالب (قد يكون مفتوحاً في Word). أغلقه ثم أعد المحاولة.',
          };
        }
        return { success: false, message: msg };
      }
    }
  );
}
