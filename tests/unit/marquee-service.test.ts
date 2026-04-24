import {
  addMarqueeAd,
  updateMarqueeAd,
  deleteMarqueeAd,
  getMarqueeMessages,
  getActiveMarqueeAds,
} from '@/services/db/system/marquee';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('Marquee Ads', () => {
  test('addMarqueeAd and getActiveMarqueeAds', () => {
    addMarqueeAd({ content: 'Sale 50%', priority: 'High' });
    expect(getActiveMarqueeAds()).toHaveLength(1);
    expect(getActiveMarqueeAds()[0].content).toBe('Sale 50%');
  });

  test('updateMarqueeAd', () => {
    const id = addMarqueeAd({ content: 'Old' }).data as string;
    updateMarqueeAd(id, { content: 'New', priority: 'High', type: 'alert', enabled: true });
    expect(getActiveMarqueeAds()[0].content).toBe('New');
    expect(getActiveMarqueeAds()[0].priority).toBe('High');
  });

  test('deleteMarqueeAd', () => {
    const id = addMarqueeAd({ content: 'To Delete' }).data as string;
    deleteMarqueeAd(id);
    expect(getActiveMarqueeAds()).toHaveLength(0);
  });
});

describe('getMarqueeMessages', () => {
  test('includes ads, alerts, tasks and reminders', () => {
    // 1. Add an Ad
    addMarqueeAd({ content: 'Active Ad', priority: 'High' });

    // 2. Add an Alert
    kv.save(KEYS.ALERTS, [{
      id: 'A1', الوصف: 'Critical Risk', تم_القراءة: false, category: 'Risk',
      مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'C1'
    } as any]);

    // 3. Add a Task
    kv.save(KEYS.FOLLOW_UPS, [{
      id: 'F1', task: 'Follow up', status: 'Pending', dueDate: '2026-01-01'
    } as any]);

    // 4. Add a Reminder
    kv.save(KEYS.REMINDERS, [{
      id: 'R1', title: 'Remind me', date: '2026-01-01', isDone: false, type: 'Task'
    }]);

    buildCache();

    const messages = getMarqueeMessages();
    expect(messages.some(m => m.content.includes('Active Ad'))).toBe(true);
    expect(messages.some(m => m.content.includes('تنبيه') && m.content.includes('غير مقروء'))).toBe(true);
    expect(messages.some(m => m.content.includes('مهام مفتوحة'))).toBe(true);
    expect(messages.some(m => m.content.includes('تذكيرات مفتوحة'))).toBe(true);
  });

  test('handles alerts with different references', () => {
    kv.save(KEYS.ALERTS, [
      { id: 'A1', الوصف: 'Contract', تم_القراءة: false, category: 'Risk', مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'C1' },
      { id: 'A2', الوصف: 'Installment', تم_القراءة: false, category: 'Financial', مرجع_الجدول: 'الكمبيالات_tbl' },
      { id: 'A3', الوصف: 'Property', تم_القراءة: false, category: 'Risk', مرجع_الجدول: 'العقارات_tbl', مرجع_المعرف: 'P1' },
      { id: 'A4', الوصف: 'Person', تم_القراءة: false, category: 'Financial', مرجع_الجدول: 'الأشخاص_tbl', مرجع_المعرف: 'batch' },
    ] as any);
    buildCache();
    const messages = getMarqueeMessages();
    expect(messages.length).toBeGreaterThan(1);
  });
});
