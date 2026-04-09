import { get, save } from '../kv';
import { KEYS } from '../keys';
import { NoteRecord, الكمبيالات_tbl, DbResult, ReferenceType } from '@/types';
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
