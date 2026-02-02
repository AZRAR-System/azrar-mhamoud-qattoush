export const tryParseJson = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

export const safeJsonParseArray = (raw: unknown): unknown[] => {
  const s = typeof raw === 'string' ? raw : String(raw ?? '');
  const trimmed = s.trim();
  if (!trimmed) return [];
  const parsed = tryParseJson(trimmed);
  return Array.isArray(parsed) ? parsed : [];
};
