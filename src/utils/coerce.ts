export const asString = (v: unknown): string => String(v ?? '');

export const asTrimmedString = (v: unknown): string => asString(v).trim();

export const asNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
