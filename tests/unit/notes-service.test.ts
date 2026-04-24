import {
  getNotes,
  addNote,
  addEntityNote,
  getDashboardNotes,
  addDashboardNote,
  archiveDashboardNote,
} from '@/services/db/system/notes';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('getNotes', () => {
  test('returns all notes when no filter', () => {
    kv.save(KEYS.NOTES, [{ id: 'N1', referenceId: 'R1', referenceType: 'Person' }]);
    buildCache();
    expect(getNotes()).toHaveLength(1);
  });

  test('filters by refId and type', () => {
    kv.save(KEYS.NOTES, [
      { id: 'N1', referenceId: 'R1', referenceType: 'Person' },
      { id: 'N2', referenceId: 'R2', referenceType: 'Property' },
    ]);
    buildCache();
    expect(getNotes('R1', 'Person')).toHaveLength(1);
  });
});

describe('addEntityNote', () => {
  test('fails for empty note', () => {
    expect(addEntityNote('Table', 'ID', '').success).toBe(false);
  });

  test('fails for empty table or id', () => {
    expect(addEntityNote('', 'ID', 'Note').success).toBe(false);
    expect(addEntityNote('Table', '', 'Note').success).toBe(false);
  });

  test('handles Person table', () => {
    addEntityNote('الأشخاص_tbl', 'P1', 'Note');
    expect(getNotes('P1', 'Person')).toHaveLength(1);
  });

  test('handles Property table', () => {
    addEntityNote('العقارات_tbl', 'PR1', 'Note');
    expect(getNotes('PR1', 'Property')).toHaveLength(1);
  });

  test('handles Contract table', () => {
    addEntityNote('العقود_tbl', 'C1', 'Note');
    expect(getNotes('C1', 'Contract')).toHaveLength(1);
  });

  test('handles Installment table', () => {
    kv.save(KEYS.INSTALLMENTS, [{ رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', القيمة: 100, تاريخ_استحقاق: '2026-01-01', حالة_الكمبيالة: 'Paid', نوع_الكمبيالة: 'دورية' }]);
    buildCache();
    addEntityNote('الكمبيالات_tbl', 'I1', 'Note');
    expect(getNotes('C1', 'Contract')).toHaveLength(1);
    expect(getNotes()[0].content).toContain('[كمبيالة I1]');
  });

  test('handles generic table', () => {
    addEntityNote('Unknown', 'G1', 'Note');
    expect(getNotes('G1', 'Generic')).toHaveLength(1);
  });
});

describe('Dashboard Notes', () => {
  test('addDashboardNote and getDashboardNotes', () => {
    addDashboardNote({ content: 'Important' });
    const notes = getDashboardNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toBe('Important');
  });

  test('archiveDashboardNote', () => {
    addDashboardNote({ content: 'To Archive' });
    const id = getDashboardNotes()[0].id;
    archiveDashboardNote(id);
    expect(getDashboardNotes()).toHaveLength(0);
  });
});
