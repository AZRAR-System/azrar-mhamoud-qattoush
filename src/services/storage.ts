import type { DesktopDbBridge } from '@/types/electron.types';
import { DbCache, buildCache } from './dbCache';

const isElectron = (): boolean => typeof window !== 'undefined' && !!(window as any).desktopDb;

const desktopDb = (): DesktopDbBridge | undefined => (window as any).desktopDb as DesktopDbBridge | undefined;

let rebuildTimer: any = null;
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
    if (DbCache?.isInitialized && (DbCache as any)?.arrays && (DbCache as any).arrays[key]) {
      delete (DbCache as any).arrays[key];
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
    const targetKeys = keys.filter(k => k.startsWith(prefix));

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
    if (isElectron()) return (await desktopDb()!.get(key)) ?? null;
    return localStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isElectron()) {
      // Update localStorage first so sync consumers (DbCache/get()) see the new value immediately.
      localStorage.setItem(key, value);
      notifyUiKeyChange(key);
      await desktopDb()!.set(key, value);
      return;
    }
    localStorage.setItem(key, value);
    notifyUiKeyChange(key);
  },

  async removeItem(key: string): Promise<void> {
    if (isElectron()) {
      await desktopDb()!.delete(key);
      localStorage.removeItem(key);
      notifyUiKeyChange(key);
      return;
    }
    localStorage.removeItem(key);
    notifyUiKeyChange(key);
  },

  async keys(): Promise<string[]> {
    if (isElectron()) return await desktopDb()!.keys();
    return Object.keys(localStorage);
  },
};
