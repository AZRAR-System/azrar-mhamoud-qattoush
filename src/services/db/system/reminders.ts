import { get, save } from '../kv';
import { KEYS } from '../keys';
import { SystemReminder } from '@/types';

/**
 * Reminders and Calendar Events logic
 */
export const getReminders = (): SystemReminder[] => 
  get<SystemReminder>(KEYS.REMINDERS).filter((r) => !r.isDone);

export const getAllReminders = (): SystemReminder[] => 
  get<SystemReminder>(KEYS.REMINDERS);

export const addReminder = (reminder: Omit<SystemReminder, 'id' | 'isDone'>): string => {
  const all = get<SystemReminder>(KEYS.REMINDERS);
  const id = `REM-${Date.now()}`;
  save(KEYS.REMINDERS, [...all, { ...reminder, id, isDone: false }]);
  try {
    window.dispatchEvent(new Event('azrar:tasks-changed'));
  } catch {
    void 0;
  }
  return id;
};

export const updateReminder = (id: string, patch: Partial<Omit<SystemReminder, 'id'>>) => {
  const all = get<SystemReminder>(KEYS.REMINDERS);
  const idx = all.findIndex((r) => r.id === id);
  if (idx > -1) {
    all[idx] = { ...all[idx], ...patch };
    save(KEYS.REMINDERS, all);
    try {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    } catch {
      void 0;
    }
  }
};

export const setReminderDone = (id: string, isDone: boolean) => {
  const all = get<SystemReminder>(KEYS.REMINDERS);
  const idx = all.findIndex((r) => r.id === id);
  if (idx > -1) {
    all[idx].isDone = isDone;
    save(KEYS.REMINDERS, all);
    try {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    } catch {
      void 0;
    }
  }
};

export const toggleReminder = (id: string) => {
  const all = get<SystemReminder>(KEYS.REMINDERS);
  const idx = all.findIndex((r) => r.id === id);
  if (idx > -1) {
    all[idx].isDone = !all[idx].isDone;
    save(KEYS.REMINDERS, all);
    try {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    } catch {
      void 0;
    }
  }
};

export const deleteReminder = (id: string) => {
  const all = get<SystemReminder>(KEYS.REMINDERS);
  const next = all.filter((r) => r.id !== id);
  save(KEYS.REMINDERS, next);
  try {
    window.dispatchEvent(new Event('azrar:tasks-changed'));
  } catch {
    void 0;
  }
};
