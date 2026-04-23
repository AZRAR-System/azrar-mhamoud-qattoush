import { storage } from '@/services/storage';

describe('Storage Service - Bridge Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).desktopDb;
    jest.clearAllMocks();
  });

  describe('Non-Desktop Mode', () => {
    test('setItem and getItem work with localStorage', async () => {
      await storage.setItem('test-key', 'test-value');
      expect(localStorage.getItem('test-key')).toBe('test-value');
      
      const val = await storage.getItem('test-key');
      expect(val).toBe('test-value');
    });

    test('removeItem works', async () => {
      localStorage.setItem('test-key', 'val');
      await storage.removeItem('test-key');
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    test('keys returns all localStorage keys', async () => {
      localStorage.setItem('k1', 'v1');
      localStorage.setItem('k2', 'v2');
      const keys = await storage.keys();
      expect(keys).toContain('k1');
      expect(keys).toContain('k2');
    });
  });

  describe('Desktop Mode', () => {
    const mockBridge = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn(),
      onRemoteUpdate: jest.fn().mockReturnValue(() => {})
    };

    beforeEach(() => {
      (window as any).desktopDb = mockBridge;
    });

    test('setItem updates both localStorage and bridge for db_ keys', async () => {
      await storage.setItem('db_test', 'val');
      expect(localStorage.getItem('db_test')).toBe('val');
      expect(mockBridge.set).toHaveBeenCalledWith('db_test', 'val');
    });

    test('setItem only updates localStorage for non-db_ keys', async () => {
      await storage.setItem('theme', 'dark');
      expect(localStorage.getItem('theme')).toBe('dark');
      expect(mockBridge.set).not.toHaveBeenCalled();
    });

    test('getItem fetches from bridge for db_ keys', async () => {
      mockBridge.get.mockResolvedValue('bridge-val');
      const val = await storage.getItem('db_test');
      expect(val).toBe('bridge-val');
      expect(mockBridge.get).toHaveBeenCalledWith('db_test');
    });

    test('hydrateDbKeysToLocalStorage pulls keys from bridge', async () => {
      mockBridge.keys.mockResolvedValue(['db_1', 'db_2', 'other']);
      mockBridge.get.mockImplementation((key) => Promise.resolve(`${key}-val`));
      
      await storage.hydrateDbKeysToLocalStorage('db_');
      
      expect(localStorage.getItem('db_1')).toBe('db_1-val');
      expect(localStorage.getItem('db_2')).toBe('db_2-val');
      expect(localStorage.getItem('other')).toBeNull();
    });

    test('subscribeDesktopRemoteUpdates registers listener', () => {
      const unsubscribe = storage.subscribeDesktopRemoteUpdates('db_');
      expect(mockBridge.onRemoteUpdate).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    test('remote update event updates local state', () => {
      let callback: (evt: any) => void = () => {};
      mockBridge.onRemoteUpdate.mockImplementation((cb) => {
        callback = cb;
        return () => {};
      });

      storage.subscribeDesktopRemoteUpdates('db_');
      
      // Simulate remote update
      callback({ key: 'db_remote', value: 'new-val' });
      expect(localStorage.getItem('db_remote')).toBe('new-val');

      // Simulate remote delete
      callback({ key: 'db_remote', isDeleted: true });
      expect(localStorage.getItem('db_remote')).toBeNull();
    });
  });
});
