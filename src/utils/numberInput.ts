export const normalizeDigitsToLatin = (input: string): string => {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
    '۰': '0',
    '۱': '1',
    '۲': '2',
    '۳': '3',
    '۴': '4',
    '۵': '5',
    '۶': '6',
    '۷': '7',
    '۸': '8',
    '۹': '9',
    '٫': '.',
    '٬': ',',
  };

  return String(input || '').replace(/[٠-٩۰-۹٫٬]/g, (ch) => map[ch] ?? ch);
};

export const normalizeNumericString = (input: string): string => {
  return normalizeDigitsToLatin(String(input || ''))
    .replace(/,/g, '')
    .trim();
};

export const parseNumberOrUndefined = (input: string): number | undefined => {
  const s = normalizeNumericString(input);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export const parseIntOrUndefined = (input: string): number | undefined => {
  const n = parseNumberOrUndefined(input);
  if (n === undefined) return undefined;
  return Math.trunc(n);
};
