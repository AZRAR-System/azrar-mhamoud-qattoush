import { safeStorage } from 'electron';

// Simple encrypted storage (best-effort) for sensitive license state.
// Stored as a JSON string. When safeStorage is unavailable, falls back to plaintext.

export const encryptBestEffort = (
  plain: string
): { v: 1; encB64: string; plain?: never } | { v: 0; plain: string; encB64?: never } => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const enc = safeStorage.encryptString(String(plain ?? ''));
      return { v: 1, encB64: Buffer.from(enc).toString('base64') };
    }
  } catch {
    // ignore
  }
  return { v: 0, plain: String(plain ?? '') };
};

export const decryptBestEffort = (payload: unknown): string | null => {
  try {
    const rec = payload as { v?: number; encB64?: string; plain?: string };
    if (!rec || typeof rec !== 'object') return null;

    if (rec.v === 1 && typeof rec.encB64 === 'string') {
      const buf = Buffer.from(rec.encB64, 'base64');
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(buf);
      }
      return null;
    }

    if (rec.v === 0 && typeof rec.plain === 'string') {
      return rec.plain;
    }

    return null;
  } catch {
    return null;
  }
};
