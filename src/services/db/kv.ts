/**
 * Synchronous KV array access: localStorage + DbCache + optional desktop persistence via storage.
 */
const safeClone = <T>(data: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
};

import { buildCache, DbCache } from '../dbCache';
import { storage } from '@/services/storage';
import { validateBeforeSave } from './schemas';

export function get<T>(key: string): T[] {
  if (DbCache.isInitialized && DbCache.arrays[key]) {
    const data = DbCache.arrays[key] as T[];
    // Return a deep clone to prevent in-place mutation by callers
    return safeClone(data);
  }
  try {
    const str = localStorage.getItem(key);
    const data = (str ? JSON.parse(str) : []) as T[];
    if (DbCache.isInitialized) {
      DbCache.arrays[key] = data;
    }
    // Return a deep clone here as well
    return safeClone(data);
  } catch {
    return [];
  }
}

export function save<T>(key: string, data: T[]): void {
  // --- Data Integrity Phase 2: Schema Validation ---
  const validation = validateBeforeSave(key, data);
  if (!validation.valid) {
    const errorMsg = `[BLOCKED] Data validation failed for key "${key}":\n${validation.errors?.join('\n')}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Use safeClone (Phase 1) to ensure the cache doesn't hold references to mutable caller data
  const safeData = safeClone(data);
  const serialized = JSON.stringify(safeData);

  if (DbCache.isInitialized) {
    DbCache.arrays[key] = safeData;
  }

  // Persist (desktop will also write to SQLite)
  // Ensure sync readers see the latest value immediately.
  // storage.setItem handles updating localStorage synchronously in renderer.
  void storage.setItem(key, serialized);

  // Notify same-tab listeners (storage event won't fire in the same window).
  try {
    window.dispatchEvent(new CustomEvent('azrar:db-changed', { detail: { key } }));
  } catch {
    // ignore
  }

  buildCache();
}
