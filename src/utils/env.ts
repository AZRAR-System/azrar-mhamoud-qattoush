/**
 * Utility to safely access environment variables (Vite import.meta.env)
 * with fallbacks for test environments like Jest.
 */

export const getEnv = (key: string, fallback = ''): string => {
  let value: any = undefined;

  try {
    // We use a dynamic check to avoid syntax errors in some environments
    // but we still need the literal for Vite to replace it during build.
    // @ts-ignore
    value = import.meta.env[key];
  } catch (e) {
    // Fallback for environments where import.meta is not available (like Jest)
    if (typeof process !== 'undefined' && process.env) {
      value = process.env[key];
    }
  }

  return value !== undefined ? String(value) : fallback;
};

export const isDev = (): boolean => {
  try {
    // @ts-ignore
    return import.meta.env?.DEV === true;
  } catch (e) {
    return typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  }
};
