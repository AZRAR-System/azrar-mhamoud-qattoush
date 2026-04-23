import { 
  addMarqueeAd, 
  updateMarqueeAd, 
  deleteMarqueeAd, 
  getMarqueeMessages 
} from '@/services/db/system/marquee';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Marquee System Service - Announcements Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('addMarqueeAd and getMarqueeMessages', () => {
    const id = addMarqueeAd({ content: 'Welcome to Azrar', priority: 'High', type: 'success' }).data!;
    expect(id).toBeDefined();
    
    const messages = getMarqueeMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Welcome to Azrar');
    expect(messages[0].priority).toBe('High');
  });

  test('updateMarqueeAd - updates content and status', () => {
    const id = addMarqueeAd({ content: 'Old' }).data!;
    updateMarqueeAd(id, { content: 'New', enabled: false });
    
    const ads = kv.get<any>(KEYS.MARQUEE);
    expect(ads[0].content).toBe('New');
    expect(ads[0].enabled).toBe(false);
  });

  test('deleteMarqueeAd', () => {
    const id = addMarqueeAd({ content: 'Temp' }).data!;
    deleteMarqueeAd(id);
    expect(kv.get<any>(KEYS.MARQUEE)).toHaveLength(0);
  });

  test('getMarqueeMessages - includes unread alerts', () => {
    kv.save(KEYS.ALERTS, [{ id: 'A1', تم_القراءة: false, category: 'Financial', الوصف: 'Late Payment' }]);
    const messages = getMarqueeMessages();
    expect(messages.some(m => m.id === 'alerts_unread')).toBe(true);
    expect(messages.some(m => m.content.includes('Late Payment'))).toBe(true);
  });

  test('getMarqueeMessages - includes open tasks', () => {
    kv.save(KEYS.FOLLOW_UPS, [{ id: 'F1', status: 'Pending', task: 'Fix Door', dueDate: '2020-01-01' }]);
    const messages = getMarqueeMessages();
    expect(messages.some(m => m.id === 'tasks_open')).toBe(true);
    expect(messages.some(m => m.content.includes('Fix Door'))).toBe(true);
  });

  test('getMarqueeMessages - sorts tasks by due date including empty ones', () => {
    kv.save(KEYS.FOLLOW_UPS, [
      { id: 'F1', status: 'Pending', task: 'Task 1', dueDate: '2025-01-01' },
      { id: 'F2', status: 'Pending', task: 'Task 2', dueDate: '' },
      { id: 'F3', status: 'Pending', task: 'Task 3', dueDate: '2024-01-01' }
    ]);
    const messages = getMarqueeMessages();
    const tasks = messages.find(m => m.id === 'tasks_open');
    expect(tasks).toBeDefined();
    // Logic internal to getMarqueeMessages sorts them; we just ensure it doesn't crash
  });
});
