
/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 */

// Production Configuration
// Desktop build runs in local/offline mode.

type ImportMetaWithEnv = ImportMeta & {
  env?: Record<string, unknown>;
};

const getEnvString = (key: string, fallback = ''): string => {
  const env = (import.meta as unknown as ImportMetaWithEnv).env;
  const raw = env?.[key];
  return String(raw ?? fallback);
};

export const SERVER_CONFIG = {
  // Controlled via Vite env vars (LAN/server mode).
  USE_REAL_SERVER: getEnvString('VITE_USE_REAL_SERVER', 'false') === 'true',

  // Example: http://192.168.1.10:5055
  API_BASE_URL: getEnvString('VITE_API_BASE_URL', ''),

  // Request Settings
  TIMEOUT: 15000,
  RETRY_ATTEMPTS: 3,
  
  // Headers
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-App-Version': '3.0.1-PROD',
  }
};

export const IS_PRODUCTION = getEnvString('MODE', '') === 'production';
