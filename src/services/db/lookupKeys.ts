/** Stable keys for system lookups (used by initData / Settings). */

export const normKeySimple = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase();

export const stableHash32 = (input: string): string => {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
};

export const lookupKeyFor = (category: unknown, label: unknown): string => {
  const c = normKeySimple(category);
  const l = normKeySimple(label);
  if (!c || !l) return '';
  return `${c}_${stableHash32(l)}`;
};
