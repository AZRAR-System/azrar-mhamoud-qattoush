/**
 * Synchronous KV array access: localStorage + DbCache + optional desktop persistence via storage.
 */

import { buildCache, DbCache } from '../dbCache';
import { storage } from '@/services/storage';
import { validateBeforeSave } from './schemas';

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
  // --- Data Integrity Phase 2: Schema Validation ---
  const validation = validateBeforeSave(key, data);
  if (!validation.valid) {
    const errorMsg = `[BLOCKED] Data validation failed for key "${key}":\n${validation.errors?.join('\n')}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Use structuredClone (Phase 1) to ensure the cache doesn't hold references to mutable caller data
  const safeData = structuredClone(data);
  const serialized = JSON.stringify(safeData);

  // Ensure sync readers see the latest value immediately.
  localStorage.setItem(key, serialized);
  if (DbCache.isInitialized) {
    DbCache.arrays[key] = safeData;
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
