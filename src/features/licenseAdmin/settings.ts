const SERVERS_KEY = 'azrar:licenseAdmin:servers:v1';
const SELECTED_SERVER_KEY = 'azrar:licenseAdmin:selectedServer:v1';

export const normalizeServerOrigin = (raw: unknown): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.origin;
  } catch {
    return '';
  }
};

export type LicenseAdminServerSettings = {
  servers: string[];
  selectedServer: string;
};

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const loadLicenseAdminServerSettings = (): LicenseAdminServerSettings => {
  if (typeof window === 'undefined') return { servers: [], selectedServer: '' };

  const serversRaw = window.localStorage.getItem(SERVERS_KEY);
  const selectedRaw = window.localStorage.getItem(SELECTED_SERVER_KEY);

  const parsed = serversRaw ? safeJsonParse(serversRaw) : null;
  const servers = Array.isArray(parsed)
    ? parsed.map((x) => normalizeServerOrigin(x)).filter(Boolean)
    : [];

  const selectedServer = normalizeServerOrigin(selectedRaw);
  const effectiveSelected =
    selectedServer || servers[0] || normalizeServerOrigin('http://127.0.0.1:5056');

  const merged = Array.from(new Set([effectiveSelected, ...servers].filter(Boolean)));
  return { servers: merged, selectedServer: effectiveSelected };
};

export const saveLicenseAdminServers = (servers: string[]) => {
  if (typeof window === 'undefined') return;
  const normalized = Array.from(new Set(servers.map(normalizeServerOrigin).filter(Boolean)));
  window.localStorage.setItem(SERVERS_KEY, JSON.stringify(normalized));
};

export const saveLicenseAdminSelectedServer = (serverUrl: string) => {
  if (typeof window === 'undefined') return;
  const origin = normalizeServerOrigin(serverUrl);
  window.localStorage.setItem(SELECTED_SERVER_KEY, origin);
};
