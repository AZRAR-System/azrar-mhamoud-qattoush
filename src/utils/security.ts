/**
 * Simple obfuscation utility for sensitive data in localStorage/Electron settings.
 * Note: This is not "military-grade" encryption but prevents plain-text visibility 
 * for casual onlookers or in log files.
 */

const SALT = 'azrar-2025-security-salt';

export const obfuscate = (text: string): string => {
  if (!text) return '';
  const salted = `${SALT}${text}`;
  // Use btoa for simple base64 encoding (supported in browser and electron)
  try {
    return btoa(unescape(encodeURIComponent(salted)));
  } catch {
    return text; // fallback if encoding fails
  }
};

export const deobfuscate = (encoded: string): string => {
  if (!encoded) return '';
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    if (decoded.startsWith(SALT)) {
      return decoded.slice(SALT.length);
    }
    return decoded;
  } catch {
    return encoded; // fallback if decoding fails
  }
};

/**
 * Checks if a string looks like it's already obfuscated.
 */
export const isObfuscated = (text: string): boolean => {
  if (!text || text.length < 10) return false;
  try {
    const decoded = decodeURIComponent(escape(atob(text)));
    return decoded.startsWith(SALT);
  } catch {
    return false;
  }
};
