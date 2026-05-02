import { 
  parseLicenseFileContent, 
  verifyLicenseFile,
  canonicalizeLicensePayloadV1
} from '@/services/license';
import * as noble from '@noble/ed25519';

// Note: @noble/ed25519 is mocked globally in tests/setup.ts to avoid ESM issues.
// We use the global mock to simulate signature success/failure as needed.

const TEST_PUB_KEY = 'HbKG1jsBR3vKOl1KjayxVeYudCMQKvZJqftnZVy8Pag=';

describe('Licensing Service - Comprehensive Logic Suite', () => {
  const validPayload = {
    v: 1 as const,
    product: 'AZRAR' as const,
    deviceId: 'DEV-123',
    issuedAt: '2025-01-01',
    expiresAt: '2030-01-01' // Use a far future date to ensure it's not expired during tests
  };
  
  const validSig = '/9oXii2XktYVYB9lNsAuIPhfTPyYRw6w4kFl9nDNrxqn4T+EXF8yDG8KNdFZpfA0ozhdc0ixY91gn9fxd87cBg==';

  beforeAll(() => {
    process.env.VITE_AZRAR_LICENSE_PUBLIC_KEY = TEST_PUB_KEY;
  });

  test('parseLicenseFileContent - parses valid license structure', () => {
    const raw = JSON.stringify({ payload: validPayload, sig: validSig });
    const parsed = parseLicenseFileContent(raw);
    expect(parsed.payload.deviceId).toBe('DEV-123');
    expect(parsed.sig).toBe(validSig);
  });

  test('parseLicenseFileContent - fails on invalid JSON', () => {
    expect(() => parseLicenseFileContent('invalid-json')).toThrow();
  });

  test('canonicalizeLicensePayloadV1 - produces consistent string', () => {
    const s1 = canonicalizeLicensePayloadV1(validPayload);
    const s2 = canonicalizeLicensePayloadV1({ ...validPayload });
    expect(s1).toBe(s2);
    expect(s1).toContain('DEV-123');
  });

  test('verifyLicenseFile - succeeds with valid signature flow', async () => {
    // The global mock returns true by default
    const lic = { payload: { ...validPayload }, sig: validSig };
    await expect(verifyLicenseFile(lic as any, { deviceId: 'DEV-123' })).resolves.not.toThrow();
  });

  test('verifyLicenseFile - fails when deviceId does not match', async () => {
    const lic = { payload: { ...validPayload }, sig: validSig };
    await expect(verifyLicenseFile(lic as any, { deviceId: 'WRONG-DEVICE' }))
      .rejects.toThrow('ملف التفعيل لا يطابق بصمة هذا الجهاز');
  });

  test('verifyLicenseFile - fails when signature is invalid (simulated)', async () => {
    // Override the global mock for this specific test
    const verifySpy = jest.spyOn(noble, 'verifyAsync').mockResolvedValueOnce(false);
    
    // Use a valid-length signature to bypass the initial format check
    const lic = { payload: { ...validPayload }, sig: validSig };
    await expect(verifyLicenseFile(lic as any, { deviceId: 'DEV-123' }))
      .rejects.toThrow('توقيع ملف التفعيل غير صحيح');
      
    verifySpy.mockRestore();
  });

  test('verifyLicenseFile - fails when license is expired', async () => {
    const expiredPayload = { ...validPayload, expiresAt: '2020-01-01' };
    const lic = { payload: expiredPayload, sig: validSig };
    await expect(verifyLicenseFile(lic as any, { deviceId: 'DEV-123' }))
      .rejects.toThrow('انتهت صلاحية ملف التفعيل');
  });

  test('verifyLicenseFile - rejects non-finite expiresAt', async () => {
    const lic = { payload: { ...validPayload, expiresAt: 'not-a-date' }, sig: validSig };
    await expect(verifyLicenseFile(lic as any, { deviceId: 'DEV-123' })).rejects.toThrow(
      'غير صالح'
    );
  });

  test('verifyLicenseFile - rejects signature or key byte length', async () => {
    const lic = { payload: { ...validPayload }, sig: 'dGVzdA==' };
    await expect(verifyLicenseFile(lic as any, { deviceId: 'DEV-123' })).rejects.toThrow(
      'صيغة التوقيع'
    );
  });
});
