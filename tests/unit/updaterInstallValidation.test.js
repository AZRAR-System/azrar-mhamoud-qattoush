/** @jest-environment node */

let validateInstallerCandidate;

beforeAll(async () => {
  ({ validateInstallerCandidate } =
    await import('../../electron/security/updaterInstallValidation.js'));
});

describe('updater install-from-file validation', () => {
  const makeStat = ({ isFile = true, size = 1 } = {}) => ({
    isFile: () => isFile,
    size,
  });

  test('rejects empty path', () => {
    expect(validateInstallerCandidate('', makeStat(), 10).ok).toBe(false);
  });

  test('rejects UNC paths', () => {
    const res = validateInstallerCandidate('\\\\server\\share\\AZRAR-Setup.exe', makeStat(), 10);
    expect(res.ok).toBe(false);
  });

  test('rejects non-exe extension', () => {
    const res = validateInstallerCandidate('C:/tmp/update.zip', makeStat(), 10);
    expect(res.ok).toBe(false);
  });

  test('accepts .EXE extension case-insensitively', () => {
    const res = validateInstallerCandidate('C:/tmp/AZRAR-Setup.EXE', makeStat({ size: 5 }), 10);
    expect(res.ok).toBe(true);
  });

  test('rejects non-file', () => {
    const res = validateInstallerCandidate(
      'C:/tmp/AZRAR-Setup.exe',
      makeStat({ isFile: false }),
      10
    );
    expect(res.ok).toBe(false);
  });

  test('rejects zero/invalid size', () => {
    expect(validateInstallerCandidate('C:/tmp/AZRAR-Setup.exe', makeStat({ size: 0 }), 10).ok).toBe(
      false
    );
    expect(
      validateInstallerCandidate('C:/tmp/AZRAR-Setup.exe', makeStat({ size: NaN }), 10).ok
    ).toBe(false);
  });

  test('rejects too-large size', () => {
    const res = validateInstallerCandidate('C:/tmp/AZRAR-Setup.exe', makeStat({ size: 11 }), 10);
    expect(res.ok).toBe(false);
  });

  test('accepts valid candidate', () => {
    const res = validateInstallerCandidate('C:/tmp/AZRAR-Setup.exe', makeStat({ size: 10 }), 10);
    expect(res.ok).toBe(true);
  });
});
