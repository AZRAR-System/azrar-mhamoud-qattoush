import type { BrowserWindow } from 'electron';

/**
 * Shared dependencies for IPC register modules (reserved for tests / future injection).
 */
export type IpcDeps = {
  mainWindow?: BrowserWindow | null;
  getDbPath?: () => string;
};

export function createIpcDeps(): IpcDeps {
  return {};
}
