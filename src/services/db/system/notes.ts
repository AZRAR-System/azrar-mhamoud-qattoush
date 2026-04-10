import { get, save } from '../kv';
import { KEYS } from '../keys';
import { NoteRecord, الكمبيالات_tbl, DbResult, ReferenceType, DashboardNote } from '@/types';
import { dbFail, dbOk } from '@/services/localDbStorage';

const fail = dbFail;
const ok = dbOk;

/**
 * System Notes service
 */

export const getNotes = (refId?: string, type?: string) => {
  const all = get<NoteRecord>(KEYS.NOTES);
  if (refId && type) {
    return all.filter((n) => n.referenceId === refId && n.referenceType === type);
  }
  return all;
};

export const addNote = (data: Omit<NoteRecord, 'id' | 'date' | 'employee'>): DbResult<null> => {
  const all = getNotes();
  const newRec: NoteRecord = {
    ...data,
    id: `NT-${Date.now()}`,
    date: new Date().toISOString(),
    employee: 'Admin',
  };
  save(KEYS.NOTES, [...all, newRec]);
  return ok();
};

export const addEntityNote = (table: string, id: string, note: string): DbResult<null> => {
  const clean = String(note || '').trim();
  if (!clean) return fail('يرجى كتابة ملاحظة');
  const t = String(table || '').trim();
  const rawId = String(id || '').trim();
  if (!t || !rawId) return fail('مرجع غير صالح');

  if (t === 'الأشخاص_tbl') {
    return addNote({ referenceType: 'Person', referenceId: rawId, content: clean });
  }
  if (t === 'العقارات_tbl') {
    return addNote({ referenceType: 'Property', referenceId: rawId, content: clean });
  }
  if (t === 'العقود_tbl') {
    return addNote({ referenceType: 'Contract', referenceId: rawId, content: clean });
  }
  if (t === 'الكمبيالات_tbl') {
    const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find(
      (x) => String(x.رقم_الكمبيالة) === rawId
    );
    const contractId = String(inst?.رقم_العقد || '').trim();
    if (contractId) {
      return addNote({
        referenceType: 'Contract',
        referenceId: contractId,
        content: `[كمبيالة ${rawId}] ${clean}`,
      });
    }
  }

  return addNote({ referenceType: 'Generic' as ReferenceType, referenceId: rawId, content: clean });
};

export const getDashboardNotes = (): DashboardNote[] => {
  return get<DashboardNote>(KEYS.DASHBOARD_NOTES)
    .filter((n) => !n.isArchived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addDashboardNote = (data: { content: string; priority?: DashboardNote['priority'] }) => {
  const all = get<DashboardNote>(KEYS.DASHBOARD_NOTES);
  const next: DashboardNote = {
    id: `DNB-${Date.now()}`,
    content: String(data.content || '').trim(),
    priority: data.priority || 'Normal',
    createdAt: new Date().toISOString(),
    isArchived: false,
  };
  save(KEYS.DASHBOARD_NOTES, [...all, next]);
  return ok(next, 'تم إضافة الملاحظة');
};

export const archiveDashboardNote = (id: string) => {
  const all = get<DashboardNote>(KEYS.DASHBOARD_NOTES);
  const idx = all.findIndex((n) => String(n.id) === String(id));
  if (idx > -1) {
    all[idx] = { ...all[idx], isArchived: true };
    save(KEYS.DASHBOARD_NOTES, all);
  }
  return ok(null, 'تم أرشفة الملاحظة');
};

