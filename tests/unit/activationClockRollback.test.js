import { jest } from '@jest/globals';

// In-memory storage mock (used by src/services/activation.ts via @/services/storage)
const kv = new Map();

const storageMock = {
  getItem: jest.fn(async (key) => (kv.has(key) ? kv.get(key) : null)),
  setItem: jest.fn(async (key, value) => {
    kv.set(key, value);
  }),
  removeItem: jest.fn(async (key) => {
    kv.delete(key);
  }),
};

const verifyLicenseFileMock = jest.fn(async () => {});

jest.unstable_mockModule('@/services/storage', () => ({
  storage: storageMock,
}));

jest.unstable_mockModule('@/services/license', () => ({
  parseLicenseFileContent: jest.fn(() => ({ dummy: true })),
  verifyLicenseFile: verifyLicenseFileMock,
}));

describe('activation anti-rollback (clock rollback hardening)', () => {
  /** @type {import('../../src/services/activation').ActivationState} */
  let state;
  let isActivationValid;

  beforeEach(async () => {
    kv.clear();
    jest.clearAllMocks();

    // Ensure desktop device id is available.
    globalThis.window = globalThis.window || {};
    globalThis.window.desktopDb = {
      getDeviceId: jest.fn(async () => 'device-1'),
    };

    // Import after mocks are set.
    ({ isActivationValid } = await import('../../src/services/activation'));

    state = {
      activated: true,
      deviceId: 'device-1',
      // Any truthy object is fine here because verifyLicenseFile is mocked.
      license: { v: 1 },
    };
  });

  test('accepts valid license when no lastSeen exists (and records lastSeen)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-02T10:00:00.000Z'));

    const ok = await isActivationValid(state);

    expect(ok).toBe(true);
    expect(verifyLicenseFileMock).toHaveBeenCalledTimes(1);

    // anti-rollback key should be written (best-effort)
    expect(storageMock.setItem).toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('rejects license validation if clock rolled back more than tolerance', async () => {
    jest.useFakeTimers();

    // lastSeen is 3 hours in the future vs now.
    kv.set('azrar:activation:lastSeenAt:v1', new Date('2026-02-02T13:00:00.000Z').toISOString());
    jest.setSystemTime(new Date('2026-02-02T10:00:00.000Z'));

    const ok = await isActivationValid(state);

    expect(ok).toBe(false);
    // Verify should NOT run when anti-rollback blocks.
    expect(verifyLicenseFileMock).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('allows small backward drift within tolerance', async () => {
    jest.useFakeTimers();

    // lastSeen is 1 hour in the future vs now (tolerance is 2 hours).
    kv.set('azrar:activation:lastSeenAt:v1', new Date('2026-02-02T11:00:00.000Z').toISOString());
    jest.setSystemTime(new Date('2026-02-02T10:00:00.000Z'));

    const ok = await isActivationValid(state);

    expect(ok).toBe(true);
    expect(verifyLicenseFileMock).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
