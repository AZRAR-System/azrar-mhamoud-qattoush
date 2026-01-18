import { ActivityRecord, Attachment, DbResult, NoteRecord, ReferenceType } from '@/types';
import { DbService } from '@/services/mockDb';

type DesktopDb = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: string) => Promise<unknown>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const ok = <T>(data?: T, message = 'OK'): DbResult<T> => ({ success: true, message, data });
const fail = <T>(message: string): DbResult<T> => ({ success: false, message });

const getDesktopDb = (): DesktopDb | undefined => {
  const w = window as unknown as { desktopDb?: unknown };
  if (!isRecord(w)) return undefined;
  const db = w.desktopDb;
  if (!isRecord(db)) return undefined;
  const get = db.get;
  const set = db.set;
  if (typeof get !== 'function' || typeof set !== 'function') return undefined;
  return { get: get as DesktopDb['get'], set: set as DesktopDb['set'] };
};

const parseJsonArray = (raw: unknown): unknown[] => {
  const s = typeof raw === 'string' ? raw : String(raw ?? '');
  const trimmed = s.trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const asString = (v: unknown): string => String(v ?? '');

const asAttachment = (v: unknown): Attachment | null => {
  if (!isRecord(v)) return null;
  const id = asString(v.id).trim();
  const referenceType = asString(v.referenceType).trim() as ReferenceType;
  const referenceId = asString(v.referenceId).trim();
  const fileName = asString(v.fileName);
  const fileType = asString(v.fileType);
  const fileExtension = asString(v.fileExtension);
  const uploadDate = asString(v.uploadDate);
  const uploadedBy = asString(v.uploadedBy);

  const fileSizeNum = Number(v.fileSize);
  const fileSize = Number.isFinite(fileSizeNum) ? fileSizeNum : 0;

  if (!id || !referenceType || !referenceId) return null;

  const att: Attachment = {
    id,
    referenceType,
    referenceId,
    fileName,
    fileSize,
    fileType,
    fileExtension,
    uploadDate,
    uploadedBy,
  };

  if (typeof v.fileData === 'string') att.fileData = v.fileData;
  if (typeof v.filePath === 'string') att.filePath = v.filePath;

  return att;
};

const asNote = (v: unknown): NoteRecord | null => {
  if (!isRecord(v)) return null;
  const id = asString(v.id).trim();
  const referenceType = asString(v.referenceType).trim() as ReferenceType;
  const referenceId = asString(v.referenceId).trim();
  const content = asString(v.content);
  const date = asString(v.date);
  const employee = asString(v.employee);
  if (!id || !referenceType || !referenceId) return null;
  return { id, referenceType, referenceId, content, date, employee };
};

const asActivity = (v: unknown): ActivityRecord | null => {
  if (!isRecord(v)) return null;
  const id = asString(v.id).trim();
  const referenceType = asString(v.referenceType).trim() as ReferenceType;
  const referenceId = asString(v.referenceId).trim();
  const actionType = asString(v.actionType);
  const description = asString(v.description);
  const date = asString(v.date);
  const employee = asString(v.employee);
  if (!id || !referenceType || !referenceId) return null;
  return { id, referenceType, referenceId, actionType, description, date, employee };
};

const KV_KEYS = {
  ATTACHMENTS: 'db_attachments',
  NOTES: 'db_notes',
  ACTIVITIES: 'db_activities',
} as const;

const flushLocalStorageKeyToDesktopKv = async (key: string): Promise<void> => {
  const db = getDesktopDb();
  if (!db) return;
  try {
    const v = localStorage.getItem(key);
    await db.set(key, v ?? '[]');
  } catch {
    // ignore
  }
};

export const listAttachmentsSmart = async (referenceType: ReferenceType, referenceId: string): Promise<Attachment[]> => {
  const db = getDesktopDb();
  if (!db) {
    return DbService.getAttachments(referenceType, referenceId);
  }

  const raw = await db.get(KV_KEYS.ATTACHMENTS);
  const arr = parseJsonArray(raw);
  const out: Attachment[] = [];
  for (const it of arr) {
    const att = asAttachment(it);
    if (!att) continue;
    if (att.referenceType === referenceType && att.referenceId === referenceId) out.push(att);
  }
  return out;
};

export const uploadAttachmentSmart = async (
  referenceType: ReferenceType,
  referenceId: string,
  file: File
): Promise<DbResult<Attachment>> => {
  // Keep original behavior (folder naming + cache updates), then ensure desktop KV is flushed.
  const res = await DbService.uploadAttachment(referenceType, referenceId, file);
  if (res.success) {
    await flushLocalStorageKeyToDesktopKv(KV_KEYS.ATTACHMENTS);
  }
  return res;
};

export const deleteAttachmentSmart = async (attachmentId: string): Promise<DbResult<null>> => {
  const res = await DbService.deleteAttachment(attachmentId);
  if (res.success) {
    await flushLocalStorageKeyToDesktopKv(KV_KEYS.ATTACHMENTS);
  }
  return res;
};

export const listNotesSmart = async (referenceType: ReferenceType, referenceId: string): Promise<NoteRecord[]> => {
  const db = getDesktopDb();
  if (!db) {
    return DbService.getNotes(referenceId, referenceType);
  }

  const raw = await db.get(KV_KEYS.NOTES);
  const arr = parseJsonArray(raw);
  const out: NoteRecord[] = [];
  for (const it of arr) {
    const note = asNote(it);
    if (!note) continue;
    if (note.referenceType === referenceType && note.referenceId === referenceId) out.push(note);
  }
  return out;
};

export const addNoteSmart = async (payload: { referenceType: ReferenceType; referenceId: string; content: string }): Promise<DbResult<null>> => {
  const content = String(payload.content || '').trim();
  if (!content) return fail('يرجى كتابة ملاحظة');

  const res = DbService.addNote({
    referenceType: payload.referenceType,
    referenceId: payload.referenceId,
    content,
  });

  if (res.success) {
    await flushLocalStorageKeyToDesktopKv(KV_KEYS.NOTES);
  }

  return res.success ? ok(null, res.message) : fail(res.message);
};

export const listActivitiesSmart = async (referenceType: ReferenceType, referenceId: string): Promise<ActivityRecord[]> => {
  const db = getDesktopDb();
  if (!db) {
    return DbService.getActivities(referenceId, referenceType);
  }

  const raw = await db.get(KV_KEYS.ACTIVITIES);
  const arr = parseJsonArray(raw);
  const out: ActivityRecord[] = [];
  for (const it of arr) {
    const act = asActivity(it);
    if (!act) continue;
    if (act.referenceType === referenceType && act.referenceId === referenceId) out.push(act);
  }
  return out;
};
