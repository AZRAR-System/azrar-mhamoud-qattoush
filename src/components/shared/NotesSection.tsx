import React, { useState, useEffect, useCallback } from 'react';
import { NoteRecord, ReferenceType } from '@/types';
import { addNoteSmart, listNotesSmart } from '@/services/refsDataSmart';
import { MessageSquare, Send, User } from 'lucide-react';

interface NotesSectionProps {
  referenceId: string;
  type: ReferenceType;
}

export const NotesSection: React.FC<NotesSectionProps> = ({ referenceId, type }) => {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [newNote, setNewNote] = useState('');

  const loadNotes = useCallback(() => {
    let alive = true;
    const run = async () => {
      try {
        const items = await listNotesSmart(type, referenceId);
        if (alive) setNotes(items);
      } catch {
        if (alive) setNotes([]);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [referenceId, type]);

  useEffect(() => {
    const cleanup = loadNotes();
    return () => cleanup?.();
  }, [loadNotes]);

  const handleAdd = async () => {
    const content = newNote.trim();
    if (!content) return;

    const res = await addNoteSmart({ referenceType: type, referenceId, content });
    if (res.success) {
      setNewNote('');
      loadNotes();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
        <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2">
          <MessageSquare size={18} className="text-indigo-500" /> الملاحظات ({notes.length})
        </h4>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[300px] custom-scrollbar">
        {notes.length === 0 && (
          <div className="text-center text-gray-400 py-8 text-sm">
            لا توجد ملاحظات. أضف أول ملاحظة.
          </div>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-100 dark:border-yellow-800/30"
          >
            <p className="text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
              {note.content}
            </p>
            <div className="mt-2 pt-2 border-t border-yellow-100 dark:border-yellow-800/30 flex justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <User size={10} /> {note.employee}
              </span>
              <span dir="ltr">{new Date(note.date).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 dark:text-white"
            placeholder="اكتب ملاحظة..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleAdd()}
          />
          <button
            onClick={() => void handleAdd()}
            className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
