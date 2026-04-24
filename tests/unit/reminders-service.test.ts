import {
  getReminders,
  getAllReminders,
  addReminder,
  updateReminder,
  setReminderDone,
  toggleReminder,
  deleteReminder,
} from '@/services/db/system/reminders';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('Reminders Service', () => {
  test('add and get reminders', () => {
    addReminder({ title: 'Task 1', date: '2026-01-01', type: 'Task' });
    expect(getReminders()).toHaveLength(1);
    expect(getAllReminders()).toHaveLength(1);
  });

  test('getReminders filters out done items', () => {
    kv.save(KEYS.REMINDERS, [
      { id: 'R1', title: 'Done', isDone: true, date: '2026-01-01', type: 'Task' },
      { id: 'R2', title: 'Open', isDone: false, date: '2026-01-01', type: 'Task' },
    ]);
    buildCache();
    expect(getReminders()).toHaveLength(1);
    expect(getReminders()[0].id).toBe('R2');
  });

  test('updateReminder', () => {
    const id = addReminder({ title: 'Old', date: '2026-01-01', type: 'Task' });
    updateReminder(id, { title: 'New' });
    expect(getReminders()[0].title).toBe('New');
  });

  test('setReminderDone', () => {
    const id = addReminder({ title: 'Task', date: '2026-01-01', type: 'Task' });
    setReminderDone(id, true);
    expect(getReminders()).toHaveLength(0);
    expect(getAllReminders()[0].isDone).toBe(true);
  });

  test('toggleReminder', () => {
    const id = addReminder({ title: 'Task', date: '2026-01-01', type: 'Task' });
    toggleReminder(id);
    expect(getAllReminders()[0].isDone).toBe(true);
    toggleReminder(id);
    expect(getAllReminders()[0].isDone).toBe(false);
  });

  test('deleteReminder', () => {
    const id = addReminder({ title: 'To Delete', date: '2026-01-01', type: 'Task' });
    deleteReminder(id);
    expect(getAllReminders()).toHaveLength(0);
  });
});
