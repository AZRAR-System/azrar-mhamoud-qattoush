import { 
  addMarqueeAd,
  updateMarqueeAd,
  deleteMarqueeAd,
  getMarqueeMessages
} from '@/services/db/system/marquee';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Marquee System Service - API Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
    jest.clearAllMocks();
  });

  describe('addMarqueeAd', () => {
    test('successfully adds an ad and dispatches event', () => {
      const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
      const res = addMarqueeAd({ content: 'Test Ad', priority: 'High', type: 'success' });
      
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
      
      const stored = kv.get<any>(KEYS.MARQUEE);
      expect(stored).toHaveLength(1);
      expect(stored[0].content).toBe('Test Ad');
    });

    test('fails if content is empty', () => {
      const res = addMarqueeAd({ content: '' });
      expect(res.success).toBe(false);
    });
  });

  describe('getMarqueeMessages', () => {
    test('aggregates custom ads and system status', () => {
      addMarqueeAd({ content: 'Custom Ad' });

      kv.save(KEYS.ALERTS, [{ 
        id: 'A1', 
        الوصف: 'Critical', 
        category: 'Financial', 
        تم_القراءة: false 
      }]);

      kv.save(KEYS.FOLLOW_UPS, [{ 
        id: 'F1', 
        task: 'Call', 
        status: 'Pending', 
        dueDate: '2025-01-01' 
      }]);

      const messages = getMarqueeMessages();
      
      expect(messages.some(m => m.content === 'Custom Ad')).toBe(true);
      // Check for 'تنبيه' instead of 'تنبيع'
      expect(messages.some(m => m.content.includes('تنبيه حرِج'))).toBe(true);
      expect(messages.some(m => m.content.includes('مهام مفتوحة'))).toBe(true);
    });
  });
});
