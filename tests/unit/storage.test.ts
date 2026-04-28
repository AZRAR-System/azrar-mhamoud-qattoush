import { storage } from '@/services/storage';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
  delete (window as any).desktopDb;
});

afterEach(() => {
  delete (window as any).desktopDb;
});

const makeBridge = (overrides: Record<string, any> = {}) => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true),
  keys: jest.fn().mockResolvedValue([]),
  onRemoteUpdate: jest.fn().mockReturnValue(() => {}),
  ...overrides,
});

describe('storage.isDesktop', () => {
  test('returns false without desktopDb', () => {
    expect(storage.isDesktop()).toBe(false);
  });
  test('returns true with desktopDb', () => {
    (window as any).desktopDb = makeBridge();
    expect(storage.isDesktop()).toBe(true);
  });
});

describe('storage.getItem', () => {
  test('non-desktop returns localStorage value', async () => {
    localStorage.setItem('test_key', 'hello');
    expect(await storage.getItem('test_key')).toBe('hello');
  });

  test('desktop non-kv key returns localStorage', async () => {
    (window as any).desktopDb = makeBridge();
    localStorage.setItem('theme', 'dark');
    expect(await storage.getItem('theme')).toBe('dark');
  });

  test('desktop kv key uses bridge', async () => {
    (window as any).desktopDb = makeBridge({ get: jest.fn().mockResolvedValue('val') });
    expect(await storage.getItem('db_people')).toBe('val');
  });

  test('desktop kv key with null bridge falls back to localStorage', async () => {
    (window as any).desktopDb = null;
    localStorage.setItem('db_people', 'local');
    expect(await storage.getItem('db_people')).toBe('local');
  });
});

describe('storage.setItem', () => {
  test('non-desktop sets localStorage', async () => {
    await storage.setItem('key1', 'val1');
    expect(localStorage.getItem('key1')).toBe('val1');
  });

  test('desktop non-kv key sets localStorage only', async () => {
    const bridge = makeBridge();
    (window as any).desktopDb = bridge;
    await storage.setItem('theme', 'dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(bridge.set).not.toHaveBeenCalled();
  });

  test('desktop kv key sets localStorage and bridge', async () => {
    const bridge = makeBridge();
    (window as any).desktopDb = bridge;
    await storage.setItem('db_people', '[]');
    expect(bridge.set).toHaveBeenCalledWith('db_people', '[]');
  });

  test('desktop kv key with no bridge sets localStorage only', async () => {
    (window as any).desktopDb = null;
    await storage.setItem('db_people', '[]');
    expect(localStorage.getItem('db_people')).toBe('[]');
  });

  test('db_marquee triggers marquee event', async () => {
    jest.useFakeTimers();
    const fired: string[] = [];
    window.addEventListener('azrar:marquee-changed', () => fired.push('marquee'));
    await storage.setItem('db_marquee', 'data');
    jest.advanceTimersByTime(100);
    expect(fired).toContain('marquee');
    jest.useRealTimers();
  });
});

describe('storage.removeItem', () => {
  test('non-desktop removes from localStorage', async () => {
    localStorage.setItem('key1', 'val');
    await storage.removeItem('key1');
    expect(localStorage.getItem('key1')).toBeNull();
  });

  test('desktop kv key calls bridge.delete', async () => {
    const bridge = makeBridge();
    (window as any).desktopDb = bridge;
    await storage.removeItem('db_people');
    expect(bridge.delete).toHaveBeenCalledWith('db_people');
  });

  test('desktop non-kv key skips bridge', async () => {
    const bridge = makeBridge();
    (window as any).desktopDb = bridge;
    localStorage.setItem('theme', 'dark');
    await storage.removeItem('theme');
    expect(bridge.delete).not.toHaveBeenCalled();
    expect(localStorage.getItem('theme')).toBeNull();
  });

  test('desktop kv key without bridge still removes from localStorage', async () => {
    (window as any).desktopDb = null;
    localStorage.setItem('db_people', '[]');
    await storage.removeItem('db_people');
    expect(localStorage.getItem('db_people')).toBeNull();
  });
});

describe('storage.keys', () => {
  test('non-desktop returns localStorage keys', async () => {
    localStorage.setItem('k1', 'v1');
    localStorage.setItem('k2', 'v2');
    const keys = await storage.keys();
    expect(keys).toContain('k1');
    expect(keys).toContain('k2');
  });

  test('desktop with bridge returns bridge keys', async () => {
    (window as any).desktopDb = makeBridge({
      keys: jest.fn().mockResolvedValue(['db_people', 'db_contracts']),
    });
    const keys = await storage.keys();
    expect(keys).toContain('db_people');
  });

  test('desktop without bridge returns localStorage keys', async () => {
    (window as any).desktopDb = null;
    localStorage.setItem('fallback', '1');
    const keys = await storage.keys();
    expect(keys).toContain('fallback');
  });
});

describe('storage.hydrateDbKeysToLocalStorage', () => {
  test('non-desktop does nothing', async () => {
    await expect(storage.hydrateDbKeysToLocalStorage()).resolves.toBeUndefined();
  });

  test('desktop hydrates matching keys', async () => {
    (window as any).desktopDb = makeBridge({
      keys: jest.fn().mockResolvedValue(['db_people', 'theme']),
      get: jest.fn().mockImplementation((k: string) =>
        Promise.resolve(k === 'db_people' ? '[]' : null)
      ),
    });
    await storage.hydrateDbKeysToLocalStorage('db_');
    expect(localStorage.getItem('db_people')).toBe('[]');
    expect(localStorage.getItem('theme')).toBeNull();
  });

  test('desktop skips non-string values', async () => {
    (window as any).desktopDb = makeBridge({
      keys: jest.fn().mockResolvedValue(['db_test']),
      get: jest.fn().mockResolvedValue(null),
    });
    await storage.hydrateDbKeysToLocalStorage();
    expect(localStorage.getItem('db_test')).toBeNull();
  });
});

describe('storage.hydrateKeysToLocalStorage', () => {
  test('non-desktop does nothing', async () => {
    await expect(storage.hydrateKeysToLocalStorage(['k1'])).resolves.toBeUndefined();
  });

  test('desktop hydrates specified keys', async () => {
    (window as any).desktopDb = makeBridge({
      get: jest.fn().mockResolvedValue('value'),
    });
    await storage.hydrateKeysToLocalStorage(['db_people']);
    expect(localStorage.getItem('db_people')).toBe('value');
  });

  test('desktop skips empty keys', async () => {
    const bridge = makeBridge();
    (window as any).desktopDb = bridge;
    await storage.hydrateKeysToLocalStorage(['', 'db_people']);
    expect(bridge.get).toHaveBeenCalledTimes(1);
  });
});

describe('storage.subscribeDesktopRemoteUpdates', () => {
  test('returns null in non-desktop', () => {
    expect(storage.subscribeDesktopRemoteUpdates()).toBeNull();
  });

  test('returns null when bridge has no onRemoteUpdate', () => {
    (window as any).desktopDb = makeBridge({ onRemoteUpdate: undefined });
    expect(storage.subscribeDesktopRemoteUpdates()).toBeNull();
  });

  test('subscribes and handles string value update', () => {
    let handler: any;
    (window as any).desktopDb = makeBridge({
      onRemoteUpdate: jest.fn().mockImplementation((fn: any) => { handler = fn; return () => {}; }),
    });
    storage.subscribeDesktopRemoteUpdates('db_');
    handler({ key: 'db_people', value: '[]', isDeleted: false });
    expect(localStorage.getItem('db_people')).toBe('[]');
  });

  test('skips remote update when value is unchanged', () => {
    let handler: any;
    (window as any).desktopDb = makeBridge({
      onRemoteUpdate: jest.fn().mockImplementation((fn: any) => { handler = fn; return () => {}; }),
    });
    localStorage.setItem('db_people', '[]');
    storage.subscribeDesktopRemoteUpdates('db_');
    handler({ key: 'db_people', value: '[]', isDeleted: false });
    expect(localStorage.getItem('db_people')).toBe('[]');
  });

  test('handles isDeleted event', () => {
    let handler: any;
    (window as any).desktopDb = makeBridge({
      onRemoteUpdate: jest.fn().mockImplementation((fn: any) => { handler = fn; return () => {}; }),
    });
    localStorage.setItem('db_people', '[]');
    storage.subscribeDesktopRemoteUpdates('db_');
    handler({ key: 'db_people', isDeleted: true });
    expect(localStorage.getItem('db_people')).toBeNull();
  });

  test('ignores keys not matching prefix', () => {
    let handler: any;
    (window as any).desktopDb = makeBridge({
      onRemoteUpdate: jest.fn().mockImplementation((fn: any) => { handler = fn; return () => {}; }),
    });
    storage.subscribeDesktopRemoteUpdates('db_');
    handler({ key: 'theme', value: 'dark' });
    expect(localStorage.getItem('theme')).toBeNull();
  });

  test('object arg with includeKeys', () => {
    let handler: any;
    (window as any).desktopDb = makeBridge({
      onRemoteUpdate: jest.fn().mockImplementation((fn: any) => { handler = fn; return () => {}; }),
    });
    storage.subscribeDesktopRemoteUpdates({ prefix: '', includeKeys: ['db_people'] });
    handler({ key: 'db_people', value: '[]' });
    expect(localStorage.getItem('db_people')).toBe('[]');
  });

  test('handles empty key gracefully', () => {
    let handler: any;
    (window as any).desktopDb = makeBridge({
      onRemoteUpdate: jest.fn().mockImplementation((fn: any) => { handler = fn; return () => {}; }),
    });
    storage.subscribeDesktopRemoteUpdates('db_');
    expect(() => handler({ key: '', value: 'x' })).not.toThrow();
  });
});
