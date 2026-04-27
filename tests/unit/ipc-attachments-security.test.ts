/**
 * IPC attachments.ts — Security Tests
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  dialog: {},
  app: {
    getPath: jest.fn((name?: string) => (name === 'exe' ? '/tmp/app.exe' : '/tmp/userData')),
    isPackaged: false,
    on: jest.fn(),
    getAppPath: jest.fn(() => '/tmp/app'),
  },
  shell: { openPath: jest.fn(async () => '') },
}));

jest.mock('../../electron/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockHasPermission = jest.fn();
jest.mock('../../electron/printing/permissions.js', () => ({
  desktopUserHasPermission: mockHasPermission,
}));

const mockGetSessionUserId = jest.fn();
jest.mock('../../electron/ipc/context.js', () => ({
  getSessionUserId: mockGetSessionUserId,
  dbMaintenanceMode: false,
  MAX_ATTACHMENT_BYTES: 25 * 1024 * 1024,
  MAX_TEMPLATE_BYTES: 25 * 1024 * 1024,
  isUncPath: jest.fn(() => false),
}));

jest.mock('../../electron/db', () => ({
  kvDelete: jest.fn(),
  kvGet: jest.fn(() => null),
  kvGetDeletedAt: jest.fn(() => ''),
  kvKeys: jest.fn(() => []),
  kvSetWithUpdatedAt: jest.fn(),
  getDbPath: jest.fn(() => '/tmp/db.sqlite'),
}));

jest.mock('../../electron/sqlSync', () => ({
  pushKvUpsert: jest.fn(),
  pushKvDelete: jest.fn(),
  logSyncError: jest.fn(),
  pullAttachmentFilesForAttachmentsJson: jest.fn(async () => ({ downloaded: 0, missingRemote: 0 })),
  pushAttachmentFilesForAttachmentsJson: jest.fn(async () => ({ uploaded: 0 })),
}));

jest.mock('../../electron/utils/pathSafety', () => ({
  ensureInsideRoot: jest.fn(),
}));

jest.mock('../../electron/utils/errors', () => ({
  toErrorMessage: jest.fn((e: unknown, fallback?: string) =>
    e instanceof Error ? e.message : fallback || String(e)
  ),
}));

jest.mock('../../electron/utils/unknown', () => ({
  isRecord: jest.fn((v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)),
}));

jest.mock('../../electron/utils/fileEncryption', () => ({
  decryptFileToBuffer: jest.fn(),
  decryptFileToFile: jest.fn(),
  encryptBufferToFile: jest.fn(),
  isEncryptedFile: jest.fn(() => false),
}));

jest.mock('../../electron/utils/backupEncryptionSettings', () => ({
  decryptSecretBestEffort: jest.fn((s: string) => s),
  getBackupEncryptionPasswordState: jest.fn(async () => ({
    available: false,
    enabled: false,
    hasPassword: false,
    configured: false,
    password: '',
  })),
  readBackupEncryptionSettings: jest.fn(async () => ({})),
}));

const mockMkdir = jest.fn(async () => undefined);
const mockAccess = jest.fn(async () => undefined);
const mockWriteFile = jest.fn(async () => undefined);
const mockUnlink = jest.fn(async () => undefined);
const mockStat = jest.fn(async () => ({ isFile: () => true, isDirectory: () => false, size: 10 }));
const mockReadFile = jest.fn(async () => Buffer.from('x'));
const mockRealpath = jest.fn(async (p: string) => p);
const mockReaddir = jest.fn(async () => [] as string[]);
const mockRename = jest.fn(async () => undefined);
const mockCp = jest.fn(async () => undefined);

jest.mock('node:fs/promises', () => ({
  mkdir: mockMkdir,
  access: mockAccess,
  writeFile: mockWriteFile,
  unlink: mockUnlink,
  stat: mockStat,
  readFile: mockReadFile,
  realpath: mockRealpath,
  readdir: mockReaddir,
  rename: mockRename,
  cp: mockCp,
}));

jest.mock('node:fs', () => ({
  existsSync: jest.fn(() => false),
  statSync: jest.fn(() => ({ isDirectory: () => true })),
}));

import { ipcMain } from 'electron';

const handlers: Record<string, Function> = {};
const mockHandle = ipcMain.handle as jest.Mock;
mockHandle.mockImplementation((channel: string, handler: Function) => {
  handlers[channel] = handler;
});

const fakeEvent = () => ({ sender: { id: 1 } }) as Electron.IpcMainInvokeEvent;

describe('IPC attachments.ts — Security', () => {
  beforeAll(async () => {
    mockGetSessionUserId.mockReturnValue('user-1');
    const { registerAttachments } = await import('../../electron/ipc/attachments.js');
    registerAttachments({} as never);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionUserId.mockReturnValue('user-1');
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockStat.mockResolvedValue({ isFile: () => true, isDirectory: () => false, size: 10 });
  });

  describe('unauthenticated session', () => {
    const sessionCases: Array<[string, unknown[]]> = [
      [
        'attachments:save',
        [
          fakeEvent(),
          {
            referenceType: 'Property',
            entityFolder: 'P1',
            originalFileName: 'f.pdf',
            bytes: new Uint8Array([1]),
          },
        ],
      ],
      ['attachments:read', [fakeEvent(), 'Persons/P1/file.pdf']],
      ['attachments:delete', [fakeEvent(), 'Persons/P1/file.pdf']],
      ['attachments:open', [fakeEvent(), 'Persons/P1/file.pdf']],
    ];

    test.each(sessionCases)('%s — rejects empty session', async (channel, args) => {
      mockGetSessionUserId.mockReturnValue('');
      const handler = handlers[channel];
      if (!handler) return;
      const result = await handler(...(args as [Electron.IpcMainInvokeEvent, ...unknown[]]));
      expect(result?.success).toBe(false);
      expect(String(result?.message || '')).toMatch(/جلسة|تسجيل الدخول/);
    });
  });

  describe('unauthorized access — SETTINGS_ADMIN channels', () => {
    const adminChannels = ['attachments:pullNow', 'attachments:pushNow', 'attachments:getSyncStats'];

    test.each(adminChannels)('%s — rejects non-admin', async (channel) => {
      mockHasPermission.mockReturnValue(false);
      const handler = handlers[channel];
      if (!handler) return;
      const result = await handler(fakeEvent());
      expect(result?.success).toBe(false);
      expect(String(result?.message || '')).toMatch(/غير مصرح/);
    });

    test('attachments:pullNow — allows SETTINGS_ADMIN', async () => {
      mockHasPermission.mockReturnValue(true);
      const handler = handlers['attachments:pullNow'];
      if (!handler) return;
      const result = await handler(fakeEvent());
      expect(result?.success).toBe(true);
      expect(String(result?.message || '')).not.toMatch(/غير مصرح/);
    });
  });

  describe('invalid payload', () => {
    test('attachments:save — rejects empty referenceType', async () => {
      mockGetSessionUserId.mockReturnValue('user-1');
      const handler = handlers['attachments:save'];
      if (!handler) return;
      const result = await handler(fakeEvent(), {
        referenceType: '',
        entityFolder: 'ef',
        originalFileName: 'f.pdf',
        bytes: new Uint8Array([1]),
      });
      expect(result?.success).toBe(false);
      expect(String(result?.message || '')).toMatch(/referenceType: invalid|Failed to save attachment/);
    });

    test('attachments:save — rejects empty entityFolder', async () => {
      mockGetSessionUserId.mockReturnValue('user-1');
      const handler = handlers['attachments:save'];
      if (!handler) return;
      const result = await handler(fakeEvent(), {
        referenceType: 'Property',
        entityFolder: '',
        originalFileName: 'f.pdf',
        bytes: new Uint8Array([1]),
      });
      expect(result?.success).toBe(false);
      expect(String(result?.message || '')).toMatch(/entityFolder: invalid|Failed to save attachment/);
    });

    test('attachments:read — handles null relativePath', async () => {
      mockGetSessionUserId.mockReturnValue('user-1');
      const handler = handlers['attachments:read'];
      if (!handler) return;
      const result = await handler(fakeEvent(), null as unknown as string);
      expect(result).toBeDefined();
      expect(result?.success).toBe(false);
    });
  });
});
