import { jest } from '@jest/globals';
import { DbService } from '@/services/mockDb';
import { notificationCenter } from '@/services/notificationCenter';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('System Chores Logic - Fixed', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.FOLLOW_UPS, []);
    save(KEYS.REMINDERS, []);
    save(KEYS.ALERTS, []);
    notificationCenter.clear();
  });

  it('Followups: completeFollowUp should mark task as Done', () => {
    const reminderId = 'R1';
    save(KEYS.REMINDERS, [{ id: 'R1', title: 'R1', isDone: false }]);
    save(KEYS.FOLLOW_UPS, [{ id: 'FUP-1', status: 'Pending', reminderId }]);
    
    // completeFollowUp is spread on DbService from followUps logic
    DbService.completeFollowUp('FUP-1');
    
    const followups: any[] = get(KEYS.FOLLOW_UPS);
    expect(followups[0].status).toBe('Done');
    
    const reminders: any[] = get(KEYS.REMINDERS);
    expect(reminders[0].isDone).toBe(true);
  });

  it('NotificationCenter: should add a notification to the list', () => {
    notificationCenter.add({
      id: 'N1',
      title: 'Alert',
      message: 'Test Message',
      type: 'info'
    });

    const all = notificationCenter.getItems();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0].title).toBe('Alert');
  });
});
