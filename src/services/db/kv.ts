/**
 * Synchronous KV array access: localStorage + DbCache + optional desktop persistence via storage.
 */

import { buildCache, DbCache } from '../dbCache';
import { storage } from '@/services/storage';

export function get<T>(key: string): T[] {
  if (DbCache.isInitialized && DbCache.arrays[key]) {
    const data = DbCache.arrays[key] as T[];
    // Return a deep clone to prevent in-place mutation by callers
    return structuredClone(data);
  }
  try {
    const str = localStorage.getItem(key);
    const data = (str ? JSON.parse(str) : []) as T[];
    if (DbCache.isInitialized) {
      DbCache.arrays[key] = data;
    }
    // Return a deep clone here as well
    return structuredClone(data);
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
