/**
 * IPC db.ts — Security Tests
 * Tests: unauthorized access, path traversal, invalid payload
 */

// Mock electron
jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  dialog: {},
  app: { getPath: jest.fn(() => '/tmp/app') },
  safeStorage: { isEncryptionAvailable: jest.fn(() => false) },
}));

// Mock logger
jest.mock('../../electron/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock permissions
const mockHasPermission = jest.fn();
jest.mock('../../electron/printing/permissions.js', () => ({
  desktopUserHasPermission: mockHasPermission,
}));

// Mock context
const mockGetSessionUserId = jest.fn();
const mockReadBackupSettings = jest.fn(async () => ({ backupDir: '/tmp/backups' }));
jest.mock('../../electron/ipc/context.js', () => ({
  getSessionUserId: mockGetSessionUserId,
  dbMaintenanceMode: false,
  setDbMaintenanceMode: jest.fn(),
  readBackupSettings: mockReadBackupSettings,
  isExistingDirectory: jest.fn(() => true),
}));

const mockRealpath = jest.fn(async (p: string) => p);
const mockStat = jest.fn(async () => ({ isFile: () => true }));
const mockUnlink = jest.fn(async () => undefined);
jest.mock('node:fs/promises', () => ({
  realpath: mockRealpath,
  stat: mockStat,
  unlink: mockUnlink,
}));

jest.mock('node:fs', () => ({
  existsSync: jest.fn(() => true),
}));

// Mock db
jest.mock('../../electron/db', () => ({
  kvGet: jest.fn(() => null),
  kvSet: jest.fn(),
  kvDelete: jest.fn(),
  kvGetMeta: jest.fn(() => ({})),
  kvKeys: jest.fn(() => []),
  kvGetDeletedAt: jest.fn(() => ''),
  kvResetAll: jest.fn(() => ({ deleted: 0 })),
  getDbPath: jest.fn(() => '/tmp/db.sqlite'),
  exportDatabaseToMany: jest.fn(async () => ({ ok: true })),
  importDatabase: jest.fn(async () => ({ ok: true })),
  domainSyncAfterKvSet: jest.fn(() => ({ ok: true })),
}));

jest.mock('../../electron/sqlSync', () => ({
  pushKvUpsert: jest.fn(),
  pushKvDelete: jest.fn(),
  logSyncError: jest.fn(),
}));

jest.mock('../../electron/utils/fileEncryption', () => ({
  decryptFileToFile: jest.fn(),
  encryptFileToFile: jest.fn(),
  isEncryptedFile: jest.fn(() => false),
}));

jest.mock('../../electron/utils/backupEncryptionSettings', () => ({
  decryptSecretBestEffort: jest.fn((s: string) => s),
  encryptSecretBestEffort: jest.fn((s: string) => s),
  getBackupEncryptionPasswordState: jest.fn(() => 'none'),
  readBackupEncryptionSettings: jest.fn(async () => ({})),
  writeBackupEncryptionSettings: jest.fn(async () => {}),
}));

import { ipcMain } from 'electron';

// Helper — intercept registered handlers
const handlers: Record<string, Function> = {};
const mockHandle = ipcMain.handle as jest.Mock;
mockHandle.mockImplementation((channel: string, handler: Function) => {
  handlers[channel] = handler;
});

const fakeEvent = (userId = 'user-1') =>
  ({
    sender: { id: 1, _userId: userId },
  }) as any;

describe('IPC db.ts — Security', () => {
  beforeAll(async () => {
    mockGetSessionUserId.mockReturnValue('user-1');
    const { registerDb } = await import('../../electron/ipc/db.js');
    registerDb({} as never);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionUserId.mockReturnValue('user-1');
    mockReadBackupSettings.mockResolvedValue({ backupDir: '/tmp/backups' });
    mockRealpath.mockImplementation(async (p: string) => p);
    mockStat.mockResolvedValue({ isFile: () => true });
  });

  // 1. Unauthorized Access
  describe('unauthorized access', () => {
    const adminChannels = [
      'db:resetAll',
      'db:export',
      'db:import',
      'db:runLocalBackupNow',
      'db:restoreLocalBackupFile',
      'db:deleteLocalBackupFile',
    ];

    test.each(adminChannels)('%s — rejects non-admin user', async (channel) => {
      mockHasPermission.mockReturnValue(false);
      const handler = handlers[channel];
      if (!handler) return;
      const result = await handler(fakeEvent(), '/tmp/backups/file.db');
      const resultText = JSON.stringify(result);
      expect(resultText).toMatch(/غير مصرح/);
    });

    test('db:resetAll — allows SETTINGS_ADMIN', async () => {
      mockHasPermission.mockReturnValue(true);
      const handler = handlers['db:resetAll'];
      if (!handler) return;
      const result = await handler(fakeEvent(), {});
      expect(String(result?.message || '')).not.toMatch(/غير مصرح/);
    });
  });

  // 2. Path Traversal
  describe('path traversal', () => {
    test('db:restoreLocalBackupFile — rejects traversal path', async () => {
      mockHasPermission.mockReturnValue(true);
      mockRealpath.mockImplementation(async (p: string) =>
        p === '/tmp/backups' ? '/tmp/backups' : '/tmp/etc/passwd'
      );
      const handler = handlers['db:restoreLocalBackupFile'];
      if (!handler) return;
      const result = await handler(fakeEvent(), '/tmp/backups/../../etc/passwd');
      expect(result).toMatchObject({ success: false });
      expect(String(result?.message || '')).toMatch(/خارج مجلد النسخ الاحتياطي|غير صالح/);
    });

    test('db:deleteLocalBackupFile — rejects null byte in path', async () => {
      mockHasPermission.mockReturnValue(true);
      const handler = handlers['db:deleteLocalBackupFile'];
      if (!handler) return;
      const result = await handler(fakeEvent(), '/tmp/backups/file\u0000.bak');
      expect(result).toMatchObject({ success: false });
      expect(String(result?.message || '')).toMatch(/مسار الملف غير صالح|فشل حذف الملف/);
    });

    test('db:restoreLocalBackupFile — rejects path longer than 4096 chars', async () => {
      mockHasPermission.mockReturnValue(true);
      const handler = handlers['db:restoreLocalBackupFile'];
      if (!handler) return;
      const longPath = `/tmp/backups/${'a'.repeat(5000)}`;
      const result = await handler(fakeEvent(), longPath);
      expect(result).toMatchObject({ success: false });
      expect(String(result?.message || '')).toMatch(/مسار الملف غير صالح|فشل استعادة النسخة الاحتياطية/);
    });
  });

  // 3. Invalid Payload
  describe('invalid payload', () => {
    test('db:get — rejects key not starting with db_', async () => {
      const handler = handlers['db:get'];
      if (!handler) return;
      const result = await handler(fakeEvent(), '../secret');
      expect(result).toBeNull();
    });

    test('db:get — rejects empty key', async () => {
      const handler = handlers['db:get'];
      if (!handler) return;
      const result = await handler(fakeEvent(), '');
      expect(result).toBeNull();
    });

    test('db:restoreLocalBackupFile — rejects empty filePath', async () => {
      mockHasPermission.mockReturnValue(true);
      const handler = handlers['db:restoreLocalBackupFile'];
      if (!handler) return;
      const result = await handler(fakeEvent(), '');
      expect(result).toMatchObject({ success: false });
      expect(String(result?.message || '')).toMatch(/الملف غير موجود|فشل استعادة النسخة الاحتياطية/);
    });
  });
});
