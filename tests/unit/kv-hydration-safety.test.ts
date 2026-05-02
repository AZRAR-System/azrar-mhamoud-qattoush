const mockQuit = jest.fn();
const mockShowMessageBoxSync = jest.fn();
const mockSqliteCtor = jest.fn(() => {
  throw new Error('SQLITE_IOERR: disk I/O error');
});

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => (name === 'userData' ? '/tmp/azrar-test' : '/tmp')),
    isPackaged: false,
    quit: mockQuit,
  },
  dialog: {
    showMessageBoxSync: mockShowMessageBoxSync,
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => false),
  },
}));

jest.mock('better-sqlite3', () => mockSqliteCtor);

describe('initial SQL hydration empty-local detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not classify an unreadable local DB as a fresh empty install', async () => {
    const { isLocalBusinessDataEmptyForInitialSqlHydration } = await import('../../electron/db.js');

    expect(isLocalBusinessDataEmptyForInitialSqlHydration()).toBe(false);
    expect(mockSqliteCtor).toHaveBeenCalled();
  });
});
