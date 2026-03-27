/**
 * Database / KV layer split from `mockDb.ts` (incremental).
 * Re-exports grow as domains move here; `mockDb` remains the public `DbService` entry.
 */

export { KEYS, type DbStorageKey } from './keys';
export { get, save } from './kv';
export * from './people';
export * from './properties';
