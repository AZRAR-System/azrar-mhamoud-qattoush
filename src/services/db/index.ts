/**
 * Database / KV layer split from `mockDb.ts` (incremental).
 * Re-exports grow as domains move here; `mockDb` remains the public `DbService` entry.
 */

export { KEYS, type DbStorageKey } from './keys';
export { get, save } from './kv';
export { purgeRefs, isDesktop, getDesktopBridge, deleteAttachmentFilesBestEffort } from './refs';
export { makeCascadeDeletes } from './cascade';
export * from './people';
export * from './properties';
export * from './contracts';
export * from './installmentConstants';
export * from './installments';
export * from './settings';
export * from './sales';
