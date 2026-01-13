const ones: Record<number, string> = {
  0: 'صفر',
  1: 'واحد',
  2: 'اثنان',
  3: 'ثلاثة',
  4: 'أربعة',
  5: 'خمسة',
  6: 'ستة',
  7: 'سبعة',
  8: 'ثمانية',
  9: 'تسعة',
  10: 'عشرة',
  11: 'أحد عشر',
  12: 'اثنا عشر',
  13: 'ثلاثة عشر',
  14: 'أربعة عشر',
  15: 'خمسة عشر',
  16: 'ستة عشر',
  17: 'سبعة عشر',
  18: 'ثمانية عشر',
  19: 'تسعة عشر',
};

const tens: Record<number, string> = {
  20: 'عشرون',
  30: 'ثلاثون',
  40: 'أربعون',
  50: 'خمسون',
  60: 'ستون',
  70: 'سبعون',
  80: 'ثمانون',
  90: 'تسعون',
};

const hundreds: Record<number, string> = {
  100: 'مئة',
  200: 'مئتان',
  300: 'ثلاثمئة',
  400: 'أربعمئة',
  500: 'خمسمئة',
  600: 'ستمئة',
  700: 'سبعمئة',
  800: 'ثمانمئة',
  900: 'تسعمئة',
};

const joinParts = (parts: string[]) => parts.filter(Boolean).join(' و ');

const toWordsBelow100 = (n: number) => {
  if (n < 0 || n >= 100) return '';
  if (n < 20) return ones[n] || '';
  const t = Math.floor(n / 10) * 10;
  const u = n % 10;
  if (u === 0) return tens[t] || '';
  return joinParts([ones[u] || '', tens[t] || '']);
};

const toWordsBelow1000 = (n: number) => {
  if (n < 0 || n >= 1000) return '';
  if (n < 100) return toWordsBelow100(n);
  const h = Math.floor(n / 100) * 100;
  const rem = n % 100;
  if (rem === 0) return hundreds[h] || '';
  return joinParts([hundreds[h] || '', toWordsBelow100(rem)]);
};

const groupLabel = (value: number, singular: string, dual: string, plural: string) => {
  if (value === 1) return singular;
  if (value === 2) return dual;
  return plural;
};

export const arabicNumberToWords = (value: number): string => {
  const n = Math.floor(Math.abs(Number(value) || 0));
  if (!Number.isFinite(n)) return '';
  if (n === 0) return ones[0];

  const parts: string[] = [];

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  if (millions) {
    const millionWords = toWordsBelow1000(millions);
    const label = groupLabel(millions, 'مليون', 'مليونان', 'ملايين');
    parts.push(millionWords ? `${millionWords} ${label}` : label);
  }

  if (thousands) {
    if (thousands === 1) {
      parts.push('ألف');
    } else if (thousands === 2) {
      parts.push('ألفان');
    } else {
      const thousandWords = toWordsBelow1000(thousands);
      parts.push(thousandWords ? `${thousandWords} آلاف` : 'آلاف');
    }
  }

  if (rest) {
    parts.push(toWordsBelow1000(rest));
  }

  return joinParts(parts);
};
