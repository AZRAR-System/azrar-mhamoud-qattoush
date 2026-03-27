import { storage } from '@/services/storage';
import { buildCache } from '@/services/dbCache';
import type { DbResult } from '@/types';

export const localDbStorage = {
  getArray<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? (JSON.parse(data) as T[]) : [];
  },

  saveJson(key: string, data: unknown): void {
    const serialized = JSON.stringify(data);
    void storage.setItem(key, serialized);
    buildCache();
  },
};

export function dbOk<T = null>(data?: T, message = 'تمت العملية بنجاح'): DbResult<T> {
  return { success: true, message, data };
}

export function dbFail<T = null>(message = 'حدث خطأ'): DbResult<T> {
  return { success: false, message };
}
