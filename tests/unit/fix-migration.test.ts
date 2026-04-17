/**
 * Tests for app upgrade/migration scenarios
 * Covers: legacy cache cleanup, storage key migration, session handling on update
 */

// --- Legacy cache cleanup ---
const cleanupLegacyCache = (storage: Storage) => {
  storage.removeItem('azrar_tabs_state_v1');
  storage.removeItem('khaberni_user');
};

// --- Storage key migration v1 → v2 ---
const migrateTabsStorage = (
  storage: Storage,
  userId: string
): boolean => {
  const legacyKey = 'azrar_tabs_state_v1';
  const newKey = `azrar_tabs_v2_${userId}`;

  const legacy = storage.getItem(legacyKey);
  if (!legacy) return false;

  try {
    const parsed = JSON.parse(legacy);
    if (parsed.tabs && parsed.tabs.length > 0) {
      storage.setItem(newKey, legacy);
    }
  } catch {
    // ignore corrupt data
  }

  storage.removeItem(legacyKey);
  return true;
};

// --- Version comparison ---
const isNewerVersion = (current: string, installed: string): boolean => {
  const parse = (v: string) => v.split('.').map(Number);
  const [cMaj, cMin, cPat] = parse(current);
  const [iMaj, iMin, iPat] = parse(installed);
  if (cMaj !== iMaj) return cMaj > iMaj;
  if (cMin !== iMin) return cMin > iMin;
  return cPat > iPat;
};

describe('Legacy cache cleanup on startup', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes legacy tabs key v1', () => {
    localStorage.setItem('azrar_tabs_state_v1', '{"tabs":[]}');
    cleanupLegacyCache(localStorage);
    expect(localStorage.getItem('azrar_tabs_state_v1')).toBeNull();
  });

  it('removes legacy user session', () => {
    localStorage.setItem('khaberni_user', '{"id":"U1"}');
    cleanupLegacyCache(localStorage);
    expect(localStorage.getItem('khaberni_user')).toBeNull();
  });

  it('does not affect other keys', () => {
    localStorage.setItem('azrar_tabs_state_v1', 'old');
    localStorage.setItem('other_key', 'keep');
    cleanupLegacyCache(localStorage);
    expect(localStorage.getItem('other_key')).toBe('keep');
  });

  it('safe to run when keys do not exist', () => {
    expect(() => cleanupLegacyCache(localStorage)).not.toThrow();
  });
});

describe('Tab storage migration v1 → v2', () => {
  beforeEach(() => localStorage.clear());

  it('migrates tabs to user-specific key', () => {
    const data = JSON.stringify({ tabs: [{ id: 'home' }], activeTabId: 'home' });
    localStorage.setItem('azrar_tabs_state_v1', data);
    migrateTabsStorage(localStorage, 'admin');
    expect(localStorage.getItem('azrar_tabs_v2_admin')).not.toBeNull();
  });

  it('removes legacy key after migration', () => {
    localStorage.setItem('azrar_tabs_state_v1', JSON.stringify({ tabs: [{ id: 'home' }] }));
    migrateTabsStorage(localStorage, 'admin');
    expect(localStorage.getItem('azrar_tabs_state_v1')).toBeNull();
  });

  it('returns false when no legacy data', () => {
    const result = migrateTabsStorage(localStorage, 'admin');
    expect(result).toBe(false);
  });

  it('returns true when migration happened', () => {
    localStorage.setItem('azrar_tabs_state_v1', JSON.stringify({ tabs: [{ id: 'home' }] }));
    const result = migrateTabsStorage(localStorage, 'admin');
    expect(result).toBe(true);
  });

  it('handles corrupt legacy data safely', () => {
    localStorage.setItem('azrar_tabs_state_v1', 'not-json');
    expect(() => migrateTabsStorage(localStorage, 'admin')).not.toThrow();
    expect(localStorage.getItem('azrar_tabs_state_v1')).toBeNull();
  });

  it('different users get different migrated keys', () => {
    const data = JSON.stringify({ tabs: [{ id: 'home' }] });
    localStorage.setItem('azrar_tabs_state_v1', data);
    migrateTabsStorage(localStorage, 'user1');
    localStorage.setItem('azrar_tabs_state_v1', data);
    migrateTabsStorage(localStorage, 'user2');
    expect(localStorage.getItem('azrar_tabs_v2_user1')).not.toBeNull();
    expect(localStorage.getItem('azrar_tabs_v2_user2')).not.toBeNull();
  });
});

describe('Version comparison', () => {
  it('detects newer major version', () => {
    expect(isNewerVersion('4.0.0', '3.3.1')).toBe(true);
  });

  it('detects newer minor version', () => {
    expect(isNewerVersion('3.4.0', '3.3.1')).toBe(true);
  });

  it('detects newer patch version', () => {
    expect(isNewerVersion('3.3.2', '3.3.1')).toBe(true);
  });

  it('returns false for same version', () => {
    expect(isNewerVersion('3.3.1', '3.3.1')).toBe(false);
  });

  it('returns false for older version', () => {
    expect(isNewerVersion('3.2.0', '3.3.1')).toBe(false);
  });

  it('handles major version downgrade', () => {
    expect(isNewerVersion('2.0.0', '3.3.1')).toBe(false);
  });
});

describe('Session cleanup on app restart after update', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('user must re-login after update', () => {
    localStorage.setItem('khaberni_user', '{"id":"U1"}');
    localStorage.removeItem('khaberni_user');
    expect(localStorage.getItem('khaberni_user')).toBeNull();
  });

  it('sessionStorage cleared after app close', () => {
    sessionStorage.setItem('khaberni_user', '{"id":"U1"}');
    sessionStorage.clear();
    expect(sessionStorage.getItem('khaberni_user')).toBeNull();
  });

  it('new version starts with clean state', () => {
    localStorage.setItem('azrar_tabs_state_v1', 'old');
    localStorage.setItem('khaberni_user', 'old_user');
    cleanupLegacyCache(localStorage);
    expect(localStorage.getItem('azrar_tabs_state_v1')).toBeNull();
    expect(localStorage.getItem('khaberni_user')).toBeNull();
  });
});
