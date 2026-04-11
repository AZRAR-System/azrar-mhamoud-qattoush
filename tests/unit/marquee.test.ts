import { jest } from '@jest/globals';
import { getMarqueeMessages, addMarqueeAd } from '@/services/db/system/marquee';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Marquee Service Logic - API Fix', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.MARQUEE, []);
  });

  it('getMarqueeMessages: should return empty list initially', () => {
    const msgs = getMarqueeMessages();
    expect(msgs).toHaveLength(0);
  });

  it('addMarqueeAd: should create an ad that appears in messages', () => {
    addMarqueeAd({
      content: 'Important Announcement',
      priority: 'High',
      type: 'alert'
    });
    
    const msgs = getMarqueeMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toContain('Important Announcement');
    expect(msgs[0].priority).toBe('High');
  });
});
