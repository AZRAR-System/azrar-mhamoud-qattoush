import { jest } from '@jest/globals';
import { DbService } from '@/services/mockDb';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Follow-up Service Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.FOLLOW_UPS, []);
    save(KEYS.REMINDERS, []);
  });

  it('addFollowUp: should create a task and automatically add a reminder', () => {
    const id = DbService.addFollowUp({
      type: 'Task',
      task: 'Initial client briefing',
      dueDate: '2024-12-01',
      dueTime: '09:00',
      description: 'Review project goals'
    } as any);

    expect(id).toContain('FUP-');
    
    // Verify follow-up persistence
    const followups = DbService.getAllFollowUps();
    expect(followups).toHaveLength(1);
    
    // Verify reminder was created (dependency injection check)
    const reminders = DbService.getReminders();
    expect(reminders).toHaveLength(1);
    expect(reminders[0].title).toBe('Initial client briefing');
  });

  it('completeFollowUp: should mark as Done and sync with reminder', () => {
    const reminderId = DbService.addReminder({ title: 'R1', date: '2024-01-01', type: 'Task' });
    save(KEYS.FOLLOW_UPS, [{ id: 'FUP-1', status: 'Pending', reminderId }]);
    
    DbService.completeFollowUp('FUP-1');
    
    const followups = DbService.getAllFollowUps();
    expect(followups[0].status).toBe('Done');
    
    const reminders = DbService.getReminders();
    expect(reminders[0].isDone).toBe(true);
  });
});
