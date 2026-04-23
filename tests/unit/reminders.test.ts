import { 
  getReminders,
  getAllReminders,
  addReminder,
  updateReminder,
  setReminderDone,
  toggleReminder,
  deleteReminder
} from '@/services/db/system/reminders';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Reminders System Service - Logic Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
    jest.clearAllMocks();
  });

  test('addReminder - successfully adds a new reminder and dispatches event', () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    const id = addReminder({ title: 'Test Reminder', date: '2025-01-01', type: 'info' });
    
    expect(id).toContain('REM-');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    
    const all = getAllReminders();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Test Reminder');
    expect(all[0].isDone).toBe(false);
  });

  test('getReminders - filters out completed reminders', () => {
    addReminder({ title: 'Open', date: '2025-01-01', type: 'info' });
    
    // Use unique ID for the second reminder to avoid collision if Date.now() is too fast
    const doneId = `REM-DONE-${Date.now()}-2`;
    const all = kv.get<any>(KEYS.REMINDERS);
    kv.save(KEYS.REMINDERS, [...all, { 
      id: doneId, 
      title: 'Done', 
      date: '2025-01-01', 
      type: 'info', 
      isDone: false 
    }]);
    
    setReminderDone(doneId, true);
    
    const open = getReminders();
    expect(open).toHaveLength(1);
    expect(open[0].title).toBe('Open');
  });

  test('updateReminder - modifies existing reminder properties', () => {
    const id = addReminder({ title: 'Old', date: '2025-01-01', type: 'info' });
    updateReminder(id, { title: 'New' });
    
    const all = getAllReminders();
    expect(all[0].title).toBe('New');
  });

  test('toggleReminder - flips completion status', () => {
    const id = addReminder({ title: 'Toggle', date: '2025-01-01', type: 'info' });
    
    toggleReminder(id);
    expect(getAllReminders()[0].isDone).toBe(true);
    
    toggleReminder(id);
    expect(getAllReminders()[0].isDone).toBe(false);
  });

  test('deleteReminder - removes reminder from storage', () => {
    const id = addReminder({ title: 'Delete me', date: '2025-01-01', type: 'info' });
    deleteReminder(id);
    expect(getAllReminders()).toHaveLength(0);
  });

  test('update/setDone/delete - handle non-existent IDs gracefully', () => {
    // Should not throw
    updateReminder('invalid', { title: 'X' });
    setReminderDone('invalid', true);
    deleteReminder('invalid');
  });
});
