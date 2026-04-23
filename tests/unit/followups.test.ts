import { 
  createFollowUpHandlers 
} from '@/services/db/system/followups';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('FollowUps Service - Tasks and Reminders Suite', () => {
  const mockDeps = {
    addReminder: jest.fn().mockReturnValue('REM-1'),
    updateReminder: jest.fn(),
    setReminderDone: jest.fn(),
  };

  const handlers = createFollowUpHandlers(mockDeps);

  beforeEach(() => {
    localStorage.clear();
    buildCache();
    jest.clearAllMocks();
  });

  test('addFollowUp - creates task and adds reminder if needed', () => {
    const id = handlers.addFollowUp({ 
      task: 'Fix AC', 
      type: 'Task', 
      dueDate: '2025-01-01', 
      dueTime: '10:00' 
    } as any);

    expect(id).toBeDefined();
    expect(mockDeps.addReminder).toHaveBeenCalledWith({
      title: 'Fix AC',
      date: '2025-01-01',
      time: '10:00',
      type: 'Task'
    });

    const tasks = kv.get<any>(KEYS.FOLLOW_UPS);
    expect(tasks[0].status).toBe('Pending');
    expect(tasks[0].reminderId).toBe('REM-1');
  });

  test('updateFollowUp - updates task and synced reminder', () => {
    kv.save(KEYS.FOLLOW_UPS, [{ 
      id: 'F1', 
      task: 'Old Task', 
      reminderId: 'REM-1', 
      status: 'Pending', 
      dueDate: '2020-01-01' 
    }]);

    handlers.updateFollowUp('F1', { task: 'New Task', status: 'Done' });

    const tasks = kv.get<any>(KEYS.FOLLOW_UPS);
    expect(tasks[0].task).toBe('New Task');
    expect(tasks[0].status).toBe('Done');
    expect(mockDeps.updateReminder).toHaveBeenCalledWith('REM-1', { title: 'New Task' });
    expect(mockDeps.setReminderDone).toHaveBeenCalledWith('REM-1', true);
  });

  test('deleteFollowUp - removes task and marks reminder done', () => {
    kv.save(KEYS.FOLLOW_UPS, [{ id: 'F1', reminderId: 'REM-1' }]);
    handlers.deleteFollowUp('F1');

    expect(kv.get<any>(KEYS.FOLLOW_UPS)).toHaveLength(0);
    expect(mockDeps.setReminderDone).toHaveBeenCalledWith('REM-1', true);
  });

  test('completeFollowUp - marks task as Done', () => {
    kv.save(KEYS.FOLLOW_UPS, [{ id: 'F1', status: 'Pending', reminderId: 'REM-1' }]);
    handlers.completeFollowUp('F1');

    const tasks = kv.get<any>(KEYS.FOLLOW_UPS);
    expect(tasks[0].status).toBe('Done');
    expect(mockDeps.setReminderDone).toHaveBeenCalledWith('REM-1', true);
  });
});
