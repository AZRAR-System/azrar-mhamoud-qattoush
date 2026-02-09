import { app, safeStorage } from 'electron';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

export type BackupEncryptionSettings = {
  v: 1;
  enabled?: boolean;
  passwordEnc?: string;
  updatedAt?: string;
};

const SETTINGS_FILE = 'backup-encryption-settings.json';

const getSettingsPath = (): string => {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
};

export const encryptSecretBestEffort = (plain: string): string => {
  const p = String(plain || '');
  if (!p) return '';
  try {
    if (safeStorage?.isEncryptionAvailable?.() === true) {
      const enc = safeStorage.encryptString(p);
      return enc.toString('base64');
    }
  } catch {
    // ignore
  }
  // Fallback: obfuscate (NOT secure), but keeps behavior working.
  return Buffer.from(p, 'utf8').toString('base64');
};

export const decryptSecretBestEffort = (encB64: string): string => {
  const s = String(encB64 || '').trim();
  if (!s) return '';
  try {
    if (safeStorage?.isEncryptionAvailable?.() === true) {
      const buf = Buffer.from(s, 'base64');
      return safeStorage.decryptString(buf);
    }
  } catch {
    // ignore
  }
  try {
    return Buffer.from(s, 'base64').toString('utf8');
  } catch {
    return '';
  }
};

export async function readBackupEncryptionSettings(): Promise<BackupEncryptionSettings> {
  const fallback: BackupEncryptionSettings = { v: 1, enabled: false };
  try {
    const raw = await fsp.readFile(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const rec = parsed as Record<string, unknown>;
    if (rec.v !== 1) return fallback;
    return {
      v: 1,
      enabled: rec.enabled === true,
      passwordEnc: typeof rec.passwordEnc === 'string' ? rec.passwordEnc : undefined,
      updatedAt: typeof rec.updatedAt === 'string' ? rec.updatedAt : undefined,
    };
  } catch {
    return fallback;
  }
}

export async function writeBackupEncryptionSettings(next: BackupEncryptionSettings): Promise<void> {
  const normalized: BackupEncryptionSettings = {
    v: 1,
    enabled: next.enabled === true,
    passwordEnc: next.passwordEnc ? String(next.passwordEnc) : undefined,
    updatedAt: new Date().toISOString(),
  };
  await fsp.mkdir(path.dirname(getSettingsPath()), { recursive: true });
  await fsp.writeFile(getSettingsPath(), JSON.stringify(normalized, null, 2), 'utf8');
}

export async function getBackupEncryptionPasswordState(): Promise<{
  available: boolean;
  enabled: boolean;
  hasPassword: boolean;
  configured: boolean;
  password: string;
}> {
  const s = await readBackupEncryptionSettings();
  const available = safeStorage?.isEncryptionAvailable?.() === true;
  const enabled = s.enabled === true;
  const hasPassword = !!s.passwordEnc;
  const password = hasPassword ? decryptSecretBestEffort(String(s.passwordEnc || '')) : '';
  const configured = enabled ? hasPassword && !!password : false;
  return { available, enabled, hasPassword, configured, password };
}
