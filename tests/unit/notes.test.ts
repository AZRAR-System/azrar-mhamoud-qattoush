import { 
  getNotes,
  addNote,
  addEntityNote,
  getDashboardNotes,
  addDashboardNote,
  archiveDashboardNote
} from '@/services/db/system/notes';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Notes System Service - Logic Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  describe('Entity Notes', () => {
    test('addNote and getNotes - persists and retrieves notes', () => {
      addNote({ referenceType: 'Person', referenceId: 'P1', content: 'Test Note' });
      const notes = getNotes('P1', 'Person');
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toBe('Test Note');
    });

    test('addEntityNote - handles installments by linking to contract', () => {
      kv.save(KEYS.INSTALLMENTS, [{ 
        رقم_الكمبيالة: 'I1', 
        رقم_العقد: 'C100',
        تاريخ_استحقاق: '2025-01-01',
        القيمة: 100,
        حالة_الكمبيالة: 'غير مدفوع',
        نوع_الكمبيالة: 'إيجار'
      }]);
      addEntityNote('الكمبيالات_tbl', 'I1', 'Payment issue');
      
      const notes = getNotes('C100', 'Contract');
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toContain('[كمبيالة I1] Payment issue');
    });
  });

  describe('Dashboard Notes', () => {
    test('addDashboardNote - adds and retrieves sorted notes', async () => {
      addDashboardNote({ content: 'Note 1' });
      
      // Delay to ensure unique timestamps if Date.now() is used
      await new Promise(r => setTimeout(r, 10));
      
      addDashboardNote({ content: 'Note 2', priority: 'High' });
      
      const notes = getDashboardNotes();
      expect(notes).toHaveLength(2);
      // Depending on sorting implementation (latest first)
      expect(notes[0].content).toBe('Note 2');
    });
  });
});
