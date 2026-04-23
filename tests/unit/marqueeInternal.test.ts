import { 
  sanitizeMarqueeTextForDb, 
  createMarqueeActionSanitizers,
  getNonExpiredMarqueeAdsInternal,
  getActiveMarqueeAdsInternal
} from '@/services/db/marqueeInternal';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Marquee Internal Service - Logic Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  describe('sanitizeMarqueeTextForDb', () => {
    test('strips control characters and extra whitespace', () => {
      const input = ' Hello \n \t World \r\n ';
      expect(sanitizeMarqueeTextForDb(input)).toBe('Hello World');
    });

    test('truncates to max length', () => {
      const input = 'a'.repeat(400);
      expect(sanitizeMarqueeTextForDb(input, 10)).toBe('a'.repeat(10));
    });

    test('handles null/undefined gracefully', () => {
      expect(sanitizeMarqueeTextForDb(null)).toBe('');
      expect(sanitizeMarqueeTextForDb(undefined)).toBe('');
    });
  });

  describe('createMarqueeActionSanitizers', () => {
    const { sanitizeAction } = createMarqueeActionSanitizers(['People', 'Contracts']);

    test('sanitizes hash actions', () => {
      expect(sanitizeAction({ kind: 'hash', hash: '/dashboard' })).toEqual({ kind: 'hash', hash: '/dashboard' });
      expect(sanitizeAction({ kind: 'hash', hash: 'invalid' })).toBeUndefined(); // Must start with /
    });

    test('sanitizes panel actions with allowed panels', () => {
      expect(sanitizeAction({ kind: 'panel', panel: 'People', id: 'P1' })).toEqual({ kind: 'panel', panel: 'People', id: 'P1' });
      expect(sanitizeAction({ kind: 'panel', panel: 'Invalid', id: 'P1' })).toBeUndefined();
    });

    test('sanitizes nested options in panel actions', () => {
      const action = { 
        kind: 'panel', 
        panel: 'Contracts', 
        options: { filter: 'active', page: 1, deep: { val: true } } 
      };
      const res = sanitizeAction(action);
      expect(res).toBeDefined();
      expect((res as any).options.filter).toBe('active');
      expect((res as any).options.deep.val).toBe(true);
    });
  });

  describe('Marquee Persistence Helpers', () => {
    test('getNonExpiredMarqueeAdsInternal filters expired ads', () => {
      const now = Date.now();
      const ads = [
        { id: '1', content: 'A1', expiresAt: new Date(now + 100000).toISOString() }, // Valid
        { id: '2', content: 'A2', expiresAt: new Date(now - 100000).toISOString() }, // Expired
        { id: '3', content: 'A3' } // No expiry
      ];
      kv.save(KEYS.MARQUEE, ads);

      const res = getNonExpiredMarqueeAdsInternal();
      expect(res).toHaveLength(2);
      expect(res.map(a => a.id)).toContain('1');
      expect(res.map(a => a.id)).toContain('3');
      
      // Verify persistence (expired ad should be gone from storage)
      const stored = kv.get(KEYS.MARQUEE);
      expect(stored).toHaveLength(2);
    });

    test('getActiveMarqueeAdsInternal filters disabled ads', () => {
      const ads = [
        { id: '1', content: 'A1', enabled: true },
        { id: '2', content: 'A2', enabled: false },
        { id: '3', content: 'A3' } // enabled undefined counts as enabled
      ];
      kv.save(KEYS.MARQUEE, ads);

      const res = getActiveMarqueeAdsInternal();
      expect(res).toHaveLength(2);
      expect(res.find(a => a.id === '2')).toBeUndefined();
    });
  });
});
