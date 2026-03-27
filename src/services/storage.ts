import type { DesktopDbBridge } from '@/types/electron.types';
import { DbCache, buildCache } from './dbCache';

const isElectron = (): boolean => typeof window !== 'undefined' && !!window.desktopDb;

const desktopDb = (): DesktopDbBridge | undefined =>
  typeof window !== 'undefined' ? window.desktopDb : undefined;

let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleRebuildCache = () => {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    try {
      buildCache();
    } catch {
      // ignore
    }
  }, 250);
};

const invalidateCacheKey = (key: string) => {
  try {
    if (!DbCache?.isInitialized) return;
    if (Object.prototype.hasOwnProperty.call(DbCache.arrays, key)) {
      delete DbCache.arrays[key];
    }
  } catch {
    // ignore
  }
};

const notifyUiKeyChange = (key: string) => {
  try {
    if (!key) return;
    if (key === 'db_marquee') {
      window.dispatchEvent(new Event('azrar:marquee-changed'));
    }
    if (key.startsWith('db_')) {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    }
  } catch {
    // ignore
  }
};

const isKvKey = (key: string): boolean => {
  // Desktop SQLite KV currently stores only db_* keys.
  // Non-db keys (theme, activation, etc.) must be kept in renderer localStorage.
  return String(key || '').startsWith('db_');
};

export const storage = {
  isDesktop: isElectron,

  subscribeDesktopRemoteUpdates(
    arg: string | { prefix?: string; includeKeys?: string[] } = 'db_'
  ): (() => void) | null {
    if (!isElectron()) return null;
    const bridge = desktopDb();
    if (!bridge?.onRemoteUpdate) return null;

    const prefix = typeof arg === 'string' ? arg : (arg.prefix ?? 'db_');
    const includeKeys = typeof arg === 'string' ? undefined : arg.includeKeys;
    const shouldInclude = (key: string) => {
      if (!key) return false;
      if (prefix && key.startsWith(prefix)) return true;
      if (!prefix && prefix !== '') return false;
      if (prefix === '') return true;
      return Array.isArray(includeKeys) ? includeKeys.includes(key) : false;
    };

    return bridge.onRemoteUpdate((evt) => {
      try {
        const key = String(evt?.key || '');
        if (!key) return;
        if (!shouldInclude(key)) return;

        // Notify UI listeners immediately (storage event does not fire in the same window).
        const notifyUi = () => {
          try {
            if (key === 'db_marquee') {
              window.dispatchEvent(new Event('azrar:marquee-changed'));
            }
            if (key.startsWith('db_')) {
              window.dispatchEvent(new Event('azrar:tasks-changed'));
            }
          } catch {
            // ignore
          }
        };

        if (evt?.isDeleted) {
          localStorage.removeItem(key);
          invalidateCacheKey(key);
          scheduleRebuildCache();
          notifyUi();
          return;
        }

        if (typeof evt?.value === 'string') {
          localStorage.setItem(key, evt.value);
          invalidateCacheKey(key);
          scheduleRebuildCache();
          notifyUi();
        }
      } catch {
        // ignore
      }
    });
  },

  async hydrateDbKeysToLocalStorage(prefix = 'db_'): Promise<void> {
    if (!isElectron()) return;

    const bridge = desktopDb();
    if (!bridge) return;

    const keys = await bridge.keys();
    const targetKeys = keys.filter((k) => k.startsWith(prefix));

    for (const k of targetKeys) {
      const v = await bridge.get(k);
      if (typeof v === 'string') {
        localStorage.setItem(k, v);
      }
    }
  },

  async hydrateKeysToLocalStorage(keys: string[]): Promise<void> {
    if (!isElectron()) return;
    const bridge = desktopDb();
    if (!bridge) return;

    for (const k of keys) {
      if (!k) continue;
      const v = await bridge.get(k);
      if (typeof v === 'string') {
        localStorage.setItem(k, v);
      }
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (isElectron()) {
      if (!isKvKey(key)) return localStorage.getItem(key);
      const bridge = desktopDb();
      if (!bridge) return localStorage.getItem(key);
      return (await bridge.get(key)) ?? null;
    }
    return localStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isElectron()) {
      // Always update localStorage first so sync consumers (DbCache/get()) see the new value immediately.
      localStorage.setItem(key, value);
      notifyUiKeyChange(key);

      // Only persist db_* keys through the desktop KV bridge.
      if (!isKvKey(key)) return;
      const bridge = desktopDb();
      if (!bridge) return;
      await bridge.set(key, value);
      return;
    }
    localStorage.setItem(key, value);
    notifyUiKeyChange(key);
  },

  async removeItem(key: string): Promise<void> {
    if (isElectron()) {
      if (isKvKey(key)) {
        const bridge = desktopDb();
        if (bridge) {
          await bridge.delete(key);
        }
      }
      localStorage.removeItem(key);
      notifyUiKeyChange(key);
      return;
    }
    localStorage.removeItem(key);
    notifyUiKeyChange(key);
  },

  async keys(): Promise<string[]> {
    if (isElectron()) {
      const bridge = desktopDb();
      if (!bridge) return Object.keys(localStorage);
      return await bridge.keys();
    }
    return Object.keys(localStorage);
  },
};
