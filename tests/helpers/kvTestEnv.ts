/**
 * In-memory localStorage + rebuild DbCache for isolated db/* unit tests.
 */

import { buildCache } from '@/services/dbCache';

const mem: Record<string, string> = {};

export function installMemoryLocalStorage(): void {
  const store: Storage = {
    get length() {
      return Object.keys(mem).length;
    },
    clear: () => {
      for (const k of Object.keys(mem)) delete mem[k];
    },
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null),
    key: (index: number) => Object.keys(mem)[index] ?? null,
    removeItem: (key: string) => {
      delete mem[key];
    },
    setItem: (key: string, value: string) => {
      mem[key] = value;
    },
  };
  globalThis.localStorage = store;
}

/** Clears persisted KV and rebuilds DbCache from empty storage. */
export function resetKvAndCache(): void {
  for (const k of Object.keys(mem)) delete mem[k];
  buildCache();
}
