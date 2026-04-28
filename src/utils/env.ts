/**
 * Utility to safely access environment variables (Vite import.meta.env)
 * with fallbacks for test environments like Jest.
 */

export const getEnv = (key: string, fallback = ''): string => {
  let value: unknown = undefined;

  try {
    // Dynamic key: ImportMetaEnv is fixed keys; cast for string-indexed lookup.
    const viteEnv = import.meta.env as unknown as Record<string, unknown>;
    value = viteEnv[key];
  } catch (_e) {
    // Fallback for environments where import.meta is not available (like Jest)
    if (typeof process !== 'undefined' && process.env) {
      value = process.env[key];
    }
  }

  return value !== undefined ? String(value) : fallback;
};

export const isDev = (): boolean => {
  try {
    const viteEnv = import.meta.env as { DEV?: boolean };
    return viteEnv.DEV === true;
  } catch (_e) {
    return typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  }
};
