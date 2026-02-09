import { app, safeStorage } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';

export type BackupEncryptionSettings = {
  v: 1;
  enabled?: boolean;
  passwordEnc?: string;
  updatedAt?: string;
};

export function encryptSecretBestEffort(plain: string): string {
  if (!plain) return '';
  try {
    if (safeStorage?.isEncryptionAvailable?.() === true) {
      return safeStorage.encryptString(plain).toString('base64');
    }
  } catch {
    // ignore
  }
  // Fallback: obfuscation only (NOT secure) - used only when OS encryption is not available.
  return Buffer.from(plain, 'utf8').toString('base64');
}

export function decryptSecretBestEffort(encB64: string): string {
  if (!encB64) return '';
  try {
    if (safeStorage?.isEncryptionAvailable?.() === true) {
      return safeStorage.decryptString(Buffer.from(encB64, 'base64'));
    }
    return Buffer.from(encB64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

export function getBackupEncryptionSettingsPath(): string {
  return path.join(app.getPath('userData'), 'backup-encryption.json');
}

export async function readBackupEncryptionSettings(): Promise<BackupEncryptionSettings> {
  try {
    const raw = await fsp.readFile(getBackupEncryptionSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as Record<string, unknown>;
      const v = rec.v === 1 ? 1 : 1;
      return {
        v,
        enabled: rec.enabled === undefined ? undefined : !!rec.enabled,
        passwordEnc: typeof rec.passwordEnc === 'string' ? rec.passwordEnc : undefined,
        updatedAt: typeof rec.updatedAt === 'string' ? rec.updatedAt : undefined,
      };
    }
  } catch {
    // ignore
  }
  return { v: 1, enabled: false };
}

export async function writeBackupEncryptionSettings(next: BackupEncryptionSettings): Promise<void> {
  await fsp.mkdir(path.dirname(getBackupEncryptionSettingsPath()), { recursive: true });
  await fsp.writeFile(
    getBackupEncryptionSettingsPath(),
    JSON.stringify({ ...next, v: 1, updatedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
}

export async function getBackupEncryptionPasswordState(): Promise<{
  enabled: boolean;
  configured: boolean;
  password: string;
}> {
  const s = await readBackupEncryptionSettings();
  const enabled = s.enabled === true;
  const configured = enabled && !!s.passwordEnc;
  const password = configured ? decryptSecretBestEffort(String(s.passwordEnc || '')) : '';
  return { enabled, configured, password };
}
