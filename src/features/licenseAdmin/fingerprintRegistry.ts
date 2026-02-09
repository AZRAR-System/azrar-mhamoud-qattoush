export type FingerprintRegistryStatus = 'active' | 'cancelled';

export type FingerprintRegistryRecord = {
  id: string;
  fingerprint: string;
  owner: string;
  comment: string;
  status: FingerprintRegistryStatus;
  createdAt: string;
  updatedAt: string;
};

const KEY = 'azrar:licenseAdmin:fingerprints:v1';

const nowIso = () => new Date().toISOString();

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalize = (raw: unknown): string => String(raw ?? '').trim();

const makeIdFromFingerprint = (fingerprint: string): string => {
  // Stable id so upserts are deterministic.
  return `fp_${fingerprint}`;
};

const sanitizeRecord = (r: unknown): FingerprintRegistryRecord | null => {
  if (!r || typeof r !== 'object') return null;
  const rec = r as Record<string, unknown>;

  const fingerprint = normalize(rec.fingerprint);
  if (!fingerprint) return null;

  const statusRaw = normalize(rec.status).toLowerCase();
  const status: FingerprintRegistryStatus = statusRaw === 'cancelled' ? 'cancelled' : 'active';

  const createdAt = normalize(rec.createdAt) || nowIso();
  const updatedAt = normalize(rec.updatedAt) || createdAt;

  return {
    id: normalize(rec.id) || makeIdFromFingerprint(fingerprint),
    fingerprint,
    owner: normalize(rec.owner),
    comment: normalize(rec.comment),
    status,
    createdAt,
    updatedAt,
  };
};

export const loadFingerprintRegistry = (): FingerprintRegistryRecord[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];

  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed)) return [];

  const items = parsed.map(sanitizeRecord).filter((x): x is FingerprintRegistryRecord => !!x);
  // Most recently updated first
  items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return items;
};

export const saveFingerprintRegistry = (items: FingerprintRegistryRecord[]) => {
  if (typeof window === 'undefined') return;
  const sanitized = items
    .map(sanitizeRecord)
    .filter((x): x is FingerprintRegistryRecord => !!x)
    .map((x) => ({
      ...x,
      id: x.id || makeIdFromFingerprint(x.fingerprint),
    }));

  window.localStorage.setItem(KEY, JSON.stringify(sanitized));
};

export const upsertFingerprintRecord = (input: {
  fingerprint: string;
  owner?: string;
  comment?: string;
}): FingerprintRegistryRecord[] => {
  const fingerprint = normalize(input.fingerprint);
  if (!fingerprint) return loadFingerprintRegistry();

  const items = loadFingerprintRegistry();
  const id = makeIdFromFingerprint(fingerprint);
  const idx = items.findIndex((x) => x.id === id || x.fingerprint === fingerprint);

  const base: FingerprintRegistryRecord = {
    id,
    fingerprint,
    owner: normalize(input.owner),
    comment: normalize(input.comment),
    status: 'active',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (idx >= 0) {
    const prev = items[idx];
    items[idx] = {
      ...prev,
      fingerprint,
      owner: normalize(input.owner ?? prev.owner),
      comment: normalize(input.comment ?? prev.comment),
      status: 'active',
      updatedAt: nowIso(),
    };
  } else {
    items.unshift(base);
  }

  saveFingerprintRegistry(items);
  return loadFingerprintRegistry();
};

export const cancelFingerprintRecord = (fingerprintOrId: string): FingerprintRegistryRecord[] => {
  const key = normalize(fingerprintOrId);
  if (!key) return loadFingerprintRegistry();

  const items = loadFingerprintRegistry();
  const idx = items.findIndex((x) => x.id === key || x.fingerprint === key);
  if (idx < 0) return items;

  items[idx] = { ...items[idx], status: 'cancelled', updatedAt: nowIso() };
  saveFingerprintRegistry(items);
  return loadFingerprintRegistry();
};

export const deleteFingerprintRecord = (fingerprintOrId: string): FingerprintRegistryRecord[] => {
  const key = normalize(fingerprintOrId);
  if (!key) return loadFingerprintRegistry();

  const items = loadFingerprintRegistry().filter((x) => x.id !== key && x.fingerprint !== key);
  saveFingerprintRegistry(items);
  return loadFingerprintRegistry();
};
