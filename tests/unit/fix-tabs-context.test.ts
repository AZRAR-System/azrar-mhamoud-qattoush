/**
 * Tests for TabsContext improvements
 * Covers: user-specific storage keys, tab limits, badge logic
 */

// --- Storage key logic ---
const buildStorageKey = (userId: string | null): string | null => {
  if (!userId) return null;
  return `azrar_tabs_v2_${userId}`;
};

// --- Tab badge logic ---
const shouldShowBadge = (
  tabPath: string,
  alertsPath: string,
  unreadCount: number
): boolean => {
  return tabPath === alertsPath && unreadCount > 0;
};

const formatBadgeCount = (count: number): string => {
  if (count > 99) return '99+';
  return String(count);
};

// --- Tab limit logic ---
const MAX_TABS = 10;
const canOpenNewTab = (currentCount: number): boolean => currentCount < MAX_TABS;

// --- Tab reorder logic ---
const reorderTabs = <T>(arr: T[], from: number, to: number): T[] => {
  const result = [...arr];
  const [removed] = result.splice(from, 1);
  result.splice(to, 0, removed);
  return result;
};

describe('User-specific storage key', () => {
  it('returns null when no userId', () => {
    expect(buildStorageKey(null)).toBeNull();
  });

  it('builds key with userId', () => {
    expect(buildStorageKey('admin')).toBe('azrar_tabs_v2_admin');
  });

  it('different users get different keys', () => {
    const key1 = buildStorageKey('user1');
    const key2 = buildStorageKey('user2');
    expect(key1).not.toBe(key2);
  });

  it('same user always gets same key', () => {
    expect(buildStorageKey('admin')).toBe(buildStorageKey('admin'));
  });

  it('key contains user id', () => {
    const key = buildStorageKey('U-123');
    expect(key).toContain('U-123');
  });
});

describe('Tab badge logic', () => {
  const ALERTS_PATH = '/alerts';

  it('shows badge on alerts tab with unread', () => {
    expect(shouldShowBadge(ALERTS_PATH, ALERTS_PATH, 5)).toBe(true);
  });

  it('hides badge when count is 0', () => {
    expect(shouldShowBadge(ALERTS_PATH, ALERTS_PATH, 0)).toBe(false);
  });

  it('hides badge on non-alerts tab', () => {
    expect(shouldShowBadge('/contracts', ALERTS_PATH, 10)).toBe(false);
  });

  it('formats count normally under 100', () => {
    expect(formatBadgeCount(5)).toBe('5');
    expect(formatBadgeCount(99)).toBe('99');
  });

  it('formats count as 99+ above 99', () => {
    expect(formatBadgeCount(100)).toBe('99+');
    expect(formatBadgeCount(999)).toBe('99+');
  });
});

describe('Tab limit', () => {
  it('allows opening when under limit', () => {
    expect(canOpenNewTab(5)).toBe(true);
    expect(canOpenNewTab(9)).toBe(true);
  });

  it('prevents opening at limit', () => {
    expect(canOpenNewTab(10)).toBe(false);
  });

  it('max tabs is 10', () => {
    expect(MAX_TABS).toBe(10);
  });
});

describe('Tab reorder', () => {
  const tabs = ['a', 'b', 'c', 'd'];

  it('moves tab from left to right', () => {
    expect(reorderTabs(tabs, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves tab from right to left', () => {
    expect(reorderTabs(tabs, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('does not mutate original array', () => {
    const original = ['a', 'b', 'c'];
    reorderTabs(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('handles adjacent tabs', () => {
    expect(reorderTabs(tabs, 0, 1)).toEqual(['b', 'a', 'c', 'd']);
  });
});
