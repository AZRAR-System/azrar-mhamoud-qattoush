type UnknownRecord = Record<string, unknown>;

const toRecord = (v: unknown): UnknownRecord =>
  typeof v === 'object' && v !== null ? (v as UnknownRecord) : {};

const safeJsonParseArray = (value: string): unknown[] => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function normalizeKvValueOnWrite(key: string, value: string): string {
  // Only enforce invariants on the specific KV dataset requested.
  if (key !== 'db_contracts') return value;

  const parsed = safeJsonParseArray(value);
  if (!Array.isArray(parsed) || parsed.length === 0) return value;

  let changed = false;
  const normalized = parsed.map((item) => {
    const rec = toRecord(item);
    if (!Object.keys(rec).length) return item;

    const raw = rec['تكرار_الدفع'];
    const n = Number(raw);
    const needsDefault = !Number.isFinite(n) || n <= 0;
    if (!needsDefault) return item;

    changed = true;
    return { ...rec, تكرار_الدفع: 12 };
  });

  return changed ? JSON.stringify(normalized) : value;
}
