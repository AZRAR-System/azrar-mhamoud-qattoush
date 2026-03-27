import React, { useCallback, useEffect, useState } from 'react';
import { DbService } from '@/services/mockDb';
import {
  X,
  Plus,
  Phone,
  User,
  Calendar,
  Trash2,
  Check,
  Clock,
  StickyNote,
  ListTodo,
  type LucideIcon,
} from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import type { ClientInteraction, DashboardNote, FollowUpTask, SystemReminder } from '@/types';

export type WidgetKey =
  | 'CLIENT_TRACKING'
  | 'DASHBOARD_CALENDAR'
  | 'STICKY_NOTES'
  | 'SMART_REMINDERS'
  | 'FOLLOW_UP';

export interface WidgetComponentProps {
  isCustomizing?: boolean;
  onRemove?: () => void;
  action?: React.ReactNode;
}

export interface WidgetConfig<K extends WidgetKey = WidgetKey> {
  key: K;
  title: string;
  icon: LucideIcon;
  Component: React.ComponentType<WidgetComponentProps>;
}

const NO_EVENTS: readonly string[] = [];
const TASK_CHANGED_EVENTS: readonly string[] = ['azrar:tasks-changed'];

const useDbLiveRefresh = (load: () => void, events: readonly string[] = NO_EVENTS) => {
  useEffect(() => {
    load();

    const handler = () => load();
    const storageHandler = (e: StorageEvent) => {
      if (!e.key) return;
      if (String(e.key).startsWith('db_')) load();
    };

    window.addEventListener('focus', handler);
    window.addEventListener('storage', storageHandler);
    for (const ev of events) window.addEventListener(ev, handler);

    return () => {
      window.removeEventListener('focus', handler);
      window.removeEventListener('storage', storageHandler);
      for (const ev of events) window.removeEventListener(ev, handler);
    };
  }, [events, load]);
};

// Shared Wrapper
type WidgetWrapperProps = {
  isCustomizing?: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
};

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
  isCustomizing,
  onRemove,
  children,
  title,
  icon: Icon,
  action,
}) => (
  <div className="app-card h-full p-4 flex flex-col">
    <div
      className={`flex justify-between items-center mb-3 ${isCustomizing ? 'handle cursor-move' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-indigo-50 dark:bg-slate-700 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Icon size={16} />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white select-none">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {action}
        {isCustomizing && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-red-500 hover:bg-red-50 rounded-full p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative flex flex-col">
      {children}
    </div>
  </div>
);

// --- 1. Client Tracking Widget ---
export const ClientTrackingWidget: React.FC<WidgetComponentProps> = (props) => {
  const [interactions, setInteractions] = useState<ClientInteraction[]>([]);

  const loadInteractions = useCallback(() => {
    setInteractions(DbService.getClientInteractions());
  }, []);

  useDbLiveRefresh(loadInteractions);

  return (
    <WidgetWrapper {...props} title="متابعة العملاء" icon={User}>
      <table className="w-full text-right text-[10px]">
        <thead className="text-slate-400 bg-slate-50 dark:bg-slate-900 sticky top-0">
          <tr>
            <th className="p-2">العميل</th>
            <th className="p-2">الحدث</th>
            <th className="p-2">التاريخ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {interactions.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-4 text-center text-slate-400">
                لا توجد تفاعلات مسجلة
              </td>
            </tr>
          ) : (
            interactions.map((interaction) => (
              <tr key={interaction.id}>
                <td className="p-2 font-bold truncate max-w-[80px]">{interaction.clientName}</td>
                <td className="p-2 flex items-center gap-1">
                  <Phone size={10} className="text-indigo-500" /> {interaction.type}
                </td>
                <td className="p-2 text-slate-400">
                  {new Date(interaction.date).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </WidgetWrapper>
  );
};

// --- 2. Dashboard Calendar Widget ---
export const DashboardCalendarWidget: React.FC<WidgetComponentProps> = (props) => {
  const { openPanel } = useSmartModal();
  const days = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const handleDayClick = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    openPanel('CALENDAR_EVENTS', dateStr);
  };

  return (
    <WidgetWrapper
      {...props}
      title={`تقويم ${today.toLocaleDateString('ar-EG', { month: 'long' })}`}
      icon={Calendar}
    >
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] h-full">
        {days.map((d) => (
          <div key={d} className="text-slate-400 font-bold py-1">
            {d}
          </div>
        ))}
        {Array(firstDay)
          .fill(null)
          .map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
        {Array(daysInMonth)
          .fill(null)
          .map((_, i) => {
            const day = i + 1;
            const isToday = day === today.getDate();
            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`rounded-lg py-1 hover:bg-indigo-50 dark:hover:bg-slate-700 transition ${isToday ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700 dark:text-slate-300'}`}
              >
                {day}
              </button>
            );
          })}
      </div>
    </WidgetWrapper>
  );
};

// --- 3. Sticky Notes Widget ---
type NewNotePriority = Extract<DashboardNote['priority'], 'Normal' | 'Important'>;
const isNewNotePriority = (value: string): value is NewNotePriority =>
  value === 'Normal' || value === 'Important';

export const StickyNotesWidget: React.FC<WidgetComponentProps> = (props) => {
  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [priority, setPriority] = useState<NewNotePriority>('Normal');

  const loadNotes = useCallback(() => {
    setNotes(DbService.getDashboardNotes());
  }, []);

  useDbLiveRefresh(loadNotes);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    DbService.addDashboardNote({ content: newNote, priority });
    setNotes(DbService.getDashboardNotes());
    setNewNote('');
  };

  const archive = (id: string) => {
    DbService.archiveDashboardNote(id);
    setNotes(DbService.getDashboardNotes());
  };

  return (
    <WidgetWrapper {...props} title="ملاحظات سريعة" icon={StickyNote}>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <input
          className="flex-1 bg-slate-50 dark:bg-slate-900 border rounded-lg px-2 py-1 text-xs outline-none"
          placeholder="اكتب ملاحظة..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <select
          className="bg-slate-50 border rounded-lg text-xs"
          value={priority}
          onChange={(e) => {
            const value = e.target.value;
            if (isNewNotePriority(value)) setPriority(value);
          }}
        >
          <option value="Normal">عادي</option>
          <option value="Important">مهم</option>
        </select>
        <button type="submit" className="bg-indigo-600 text-white p-1 rounded-lg">
          <Plus size={14} />
        </button>
      </form>
      <div className="space-y-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`p-2 rounded-lg border text-xs flex justify-between items-start group ${note.priority === 'Important' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-yellow-50 border-yellow-100 text-yellow-800'}`}
          >
            <span>{note.content}</span>
            <button
              onClick={() => archive(note.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </WidgetWrapper>
  );
};

// --- 4. Smart Reminders Widget ---
export const SmartRemindersWidget: React.FC<WidgetComponentProps> = (props) => {
  const [reminders, setReminders] = useState<SystemReminder[]>([]);
  const [title, setTitle] = useState('');

  const loadReminders = useCallback(() => {
    setReminders(DbService.getReminders());
  }, []);

  useDbLiveRefresh(loadReminders, TASK_CHANGED_EVENTS);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    DbService.addReminder({ title, date: new Date().toISOString().split('T')[0], type: 'Task' });
    setReminders(DbService.getReminders());
    setTitle('');
  };

  const toggle = (id: string) => {
    DbService.toggleReminder(id);
    setReminders(DbService.getReminders());
  };

  return (
    <WidgetWrapper {...props} title="تذكيرات ذكية" icon={Clock}>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <input
          className="flex-1 bg-slate-50 dark:bg-slate-900 border rounded-lg px-2 py-1 text-xs outline-none"
          placeholder="تذكير جديد..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="bg-purple-600 text-white p-1 rounded-lg">
          <Plus size={14} />
        </button>
      </form>
      <div className="space-y-1">
        {reminders.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-4">لا توجد تذكيرات نشطة</p>
        )}
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg group"
          >
            <button
              onClick={() => toggle(reminder.id)}
              className={`w-4 h-4 rounded border flex items-center justify-center ${reminder.isDone ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}
            >
              {reminder.isDone && <Check size={10} className="text-white" />}
            </button>
            <span
              className={`text-xs flex-1 ${reminder.isDone ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}
            >
              {reminder.title}
            </span>
            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-500">
              {reminder.date}
            </span>
          </div>
        ))}
      </div>
    </WidgetWrapper>
  );
};

// --- 5. Follow Up Widget ---
export const FollowUpWidget: React.FC<WidgetComponentProps> = (props) => {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);

  const loadFollowUps = useCallback(() => {
    setTasks(DbService.getFollowUps());
  }, []);

  useDbLiveRefresh(loadFollowUps, TASK_CHANGED_EVENTS);

  const done = (id: string) => {
    DbService.completeFollowUp(id);
    setTasks(DbService.getFollowUps());
  };

  return (
    <WidgetWrapper {...props} title="جدولة المتابعات" icon={ListTodo}>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-4">لا توجد متابعات معلقة</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg"
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {task.task}
                </span>
                <span className="text-[10px] text-slate-400">
                  {task.clientName} • {task.dueDate}
                </span>
              </div>
              <button
                onClick={() => done(task.id)}
                className="text-green-500 hover:bg-green-50 p-1 rounded"
              >
                <Check size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </WidgetWrapper>
  );
};
