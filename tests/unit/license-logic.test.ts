import { 
  parseLicenseFileContent, 
  verifyLicenseFile, 
  canonicalizeLicensePayloadV1 
} from '@/services/license';

// Always success mock
jest.mock('@noble/ed25519', () => ({
  verifyAsync: jest.fn(async () => true)
}));

const TEST_PUB_KEY = 'HbKG1jsBR3vKOl1KjayxVeYudCMQKvZJqftnZVy8Pag=';

describe('Licensing Service - Cryptographic Suite', () => {
  const validPayload = {
    v: 1 as const,
    product: 'AZRAR' as const,
    deviceId: 'DEV-123',
    issuedAt: '2025-01-01',
    expiresAt: '2026-01-01'
  };
  
  const validSig = '/9oXii2XktYVYB9lNsAuIPhfTPyYRw6w4kFl9nDNrxqn4T+EXF8yDG8KNdFZpfA0ozhdc0ixY91gn9fxd87cBg==';

  beforeAll(() => {
    process.env.VITE_AZRAR_LICENSE_PUBLIC_KEY = TEST_PUB_KEY;
  });

  test('parseLicenseFileContent - parses valid license', () => {
    const raw = JSON.stringify({ payload: validPayload, sig: validSig });
    const parsed = parseLicenseFileContent(raw);
    expect(parsed.payload.deviceId).toBe('DEV-123');
  });

  test('verifyLicenseFile - succeeds with valid signature', async () => {
    const lic = { payload: validPayload, sig: validSig };
    await expect(verifyLicenseFile(lic, { deviceId: 'DEV-123' })).resolves.not.toThrow();
  });

  test('verifyLicenseFile - fails on deviceId mismatch', async () => {
    const lic = { payload: validPayload, sig: validSig };
    await expect(verifyLicenseFile(lic, { deviceId: 'WRONG-DEVICE' }))
      .rejects.toThrow('ملف التفعيل لا يطابق بصمة هذا الجهاز');
  });
});
