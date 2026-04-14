/**
 * Synchronous KV array access: localStorage + DbCache + optional desktop persistence via storage.
 */

import { buildCache, DbCache } from '../dbCache';
import { storage } from '@/services/storage';

export function get<T>(key: string): T[] {
  if (DbCache.isInitialized && DbCache.arrays[key]) {
    const data = DbCache.arrays[key] as T[];
    // Return a shallow clone to prevent in-place mutation by callers
    return [...data];
  }
  try {
    // NOTE: In desktop mode, SQLite access is async via IPC.
    // For now we keep sync behavior: if running in desktop mode, rely on DbCache after initial hydration.
    const str = localStorage.getItem(key);
    const data = (str ? JSON.parse(str) : []) as T[];
    if (DbCache.isInitialized) {
      DbCache.arrays[key] = data;
    }
    // Return a shallow clone here as well
    return [...data];
  } catch {
    return [];
  }
}

export function save<T>(key: string, data: T[]): void {
  const serialized = JSON.stringify(data);
  // Ensure sync readers see the latest value immediately.
  localStorage.setItem(key, serialized);
  if (DbCache.isInitialized) {
    DbCache.arrays[key] = data;
  }

  // Persist (desktop will also write to SQLite)
  void storage.setItem(key, serialized);

  // Notify same-tab listeners (storage event won't fire in the same window).
  try {
    window.dispatchEvent(new CustomEvent('azrar:db-changed', { detail: { key } }));
  } catch {
    // ignore
  }

  buildCache();
}
