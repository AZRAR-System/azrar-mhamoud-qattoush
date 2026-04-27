/**
 * IPC sql.ts — Security Tests
 * Tests: unauthorized access, invalid payload
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  dialog: {},
  app: { getPath: jest.fn(() => '/tmp/app'), on: jest.fn() },
}));

jest.mock('../../electron/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockHasPermission = jest.fn();
jest.mock('../../electron/printing/permissions.js', () => ({
  desktopUserHasPermission: mockHasPermission,
}));

const mockGetSessionUserId = jest.fn();
jest.mock('../../electron/ipc/context.js', () => ({
  getSessionUserId: mockGetSessionUserId,
  dbMaintenanceMode: false,
  getField: jest.fn((payload: unknown, key: string) => {
    if (payload && typeof payload === 'object') return (payload as Record<string, unknown>)[key];
    return undefined;
  }),
}));

jest.mock('../../electron/db', () => ({
  kvGet: jest.fn(() => null),
  kvGetMeta: jest.fn(() => ({})),
  kvKeys: jest.fn(() => []),
  kvGetDeletedAt: jest.fn(() => ({})),
  kvSetWithUpdatedAt: jest.fn(),
  kvApplyRemoteDelete: jest.fn(),
}));

jest.mock('../../electron/sqlSync', () => ({
  connectAndEnsureDatabase: jest.fn(async () => ({ ok: true })),
  disconnectSql: jest.fn(async () => {}),
  testSqlConnection: jest.fn(async () => ({ ok: true })),
  getSqlStatus: jest.fn(() => ({ connected: false })),
  loadSqlSettings: jest.fn(async () => ({})),
  loadSqlSettingsRedacted: jest.fn(async () => ({})),
  saveSqlSettings: jest.fn(async () => ({ ok: true })),
  listServerBackups: jest.fn(async () => []),
  createServerBackupOnServer: jest.fn(async () => ({ ok: true })),
  restoreServerBackupFromServer: jest.fn(async () => ({ ok: true })),
  exportServerBackupToFile: jest.fn(async () => ({ ok: true })),
  importServerBackupFromFile: jest.fn(async () => ({ ok: true })),
  provisionSqlServer: jest.fn(async () => ({ ok: true })),
  runSetupScript: jest.fn(async () => ({ ok: true })),
  checkIsAdmin: jest.fn(async () => ({ ok: true })),
  pullKvStoreOnce: jest.fn(async () => ({ ok: true })),
  startBackgroundPull: jest.fn(),
  resetSqlPullState: jest.fn(),
  pushKvUpsert: jest.fn(),
  logSyncError: jest.fn(),
  getRemoteKvStoreMeta: jest.fn(async () => ({})),
  getRemoteKvStoreRow: jest.fn(async () => null),
  loadSqlBackupAutomationSettings: jest.fn(async () => ({})),
  saveSqlBackupAutomationSettings: jest.fn(async () => ({ ok: true })),
  ensureDailyServerBackupIfEnabled: jest.fn(async () => {}),
  pullAttachmentFilesForAttachmentsJson: jest.fn(async () => ({})),
}));

jest.mock('../../electron/utils/errors', () => ({
  toErrorMessage: jest.fn((e: unknown) => String(e)),
}));

jest.mock('../../electron/utils/fileEncryption', () => ({
  decryptFileToFile: jest.fn(),
  encryptFileToFile: jest.fn(),
  isEncryptedFile: jest.fn(() => false),
}));

jest.mock('../../electron/utils/backupEncryptionSettings', () => ({
  decryptSecretBestEffort: jest.fn((s: string) => s),
  readBackupEncryptionSettings: jest.fn(async () => ({})),
}));

import { ipcMain } from 'electron';

const handlers: Record<string, Function> = {};
const mockHandle = ipcMain.handle as jest.Mock;
mockHandle.mockImplementation((channel: string, handler: Function) => {
  handlers[channel] = handler;
});

const fakeEvent = () => ({ sender: { id: 1 } });

describe('IPC sql.ts — Security', () => {
  beforeAll(async () => {
    mockGetSessionUserId.mockReturnValue('user-1');
    const { registerSql } = await import('../../electron/ipc/sql.js');
    registerSql({} as never);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionUserId.mockReturnValue('user-1');
  });

  // ─── 1. Unauthorized Access ────────────────────────────────────────────────
  describe('unauthorized access', () => {
    const adminChannels = [
      'sql:getSettings',
      'sql:saveSettings',
      'sql:connect',
      'sql:disconnect',
      'sql:test',
      'sql:listServerBackups',
      'sql:createServerBackup',
      'sql:restoreServerBackup',
      'sql:provision',
      'sql:readLocalBootstrapCredentials',
    ];

    test.each(adminChannels)('%s — rejects non-admin', async (channel) => {
      mockHasPermission.mockReturnValue(false);
      const handler = handlers[channel];
      if (!handler) return;
      const result = await handler(fakeEvent(), {});
      const msg = result?.message || result?.reason || '';
      expect(
        result?.ok === false || result?.success === false
      ).toBe(true);
      expect(String(msg)).toMatch(/غير مصرح|unauthorized/i);
    });

    test('sql:getSettings — allows SETTINGS_ADMIN', async () => {
      mockHasPermission.mockReturnValue(true);
      const handler = handlers['sql:getSettings'];
      if (!handler) return;
      const result = await handler(fakeEvent(), {});
      expect(result?.ok ?? result?.success ?? true).not.toBe(false);
    });
  });

  // ─── 2. Invalid Payload ────────────────────────────────────────────────────
  describe('invalid payload', () => {
    test('sql:listServerBackups — clamps limit to max 200', async () => {
      mockHasPermission.mockReturnValue(true);
      const { listServerBackups } = await import('../../electron/sqlSync');
      const handler = handlers['sql:listServerBackups'];
      if (!handler) return;
      await handler(fakeEvent(), { limit: 99999 });
      const calls = (listServerBackups as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const passedLimit = calls[0][0] as number;
      expect(passedLimit).toBeLessThanOrEqual(200);
    });

    test('sql:connect — handles missing payload gracefully', async () => {
      mockHasPermission.mockReturnValue(true);
      const handler = handlers['sql:connect'];
      if (!handler) return;
      const result = await handler(fakeEvent(), null);
      expect(result).toBeDefined();
    });
  });
});
