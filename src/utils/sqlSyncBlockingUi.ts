/**
 * Global UI lock during SQL sync: shows a blocking overlay (see SqlSyncBlockingOverlay).
 */
export const SQL_SYNC_BLOCKING_EVENT = 'azrar:sql-sync-blocking';

export type SqlSyncBlockingDetail = {
  active: boolean;
  /** Shown while active; ignored when active is false */
  message?: string;
};

const defaultMessage = 'جاري المزامنة الآن…';

export function setSqlSyncBlocking(active: boolean, message?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SqlSyncBlockingDetail>(SQL_SYNC_BLOCKING_EVENT, {
      detail: {
        active,
        message: message ?? defaultMessage,
      },
    })
  );
}

/** Shows full-screen blocking overlay until the promise settles (success or error). */
export async function runWithSqlSyncBlocking<T>(
  fn: () => Promise<T>,
  message = defaultMessage
): Promise<T> {
  setSqlSyncBlocking(true, message);
  try {
    return await fn();
  } finally {
    setSqlSyncBlocking(false);
  }
}
