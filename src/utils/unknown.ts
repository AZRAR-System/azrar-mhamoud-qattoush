export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

export const isPlainRecord = (value: unknown): value is UnknownRecord =>
  isRecord(value) && !Array.isArray(value);

export const hasUnknownProp = <K extends string>(
  obj: UnknownRecord,
  key: K
): obj is UnknownRecord & Record<K, unknown> => Object.prototype.hasOwnProperty.call(obj, key);
