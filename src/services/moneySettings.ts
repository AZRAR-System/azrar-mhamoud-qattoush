export type MoneySettings = {
  currencyCode?: string;
};

const STORAGE_KEY = 'azrar:moneySettings:v1';

const tryParseJson = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getMoneySettingsSync = (): MoneySettings => {
  try {
    const parsed = tryParseJson(localStorage.getItem(STORAGE_KEY));
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as Record<string, unknown>;
      const currencyCode = typeof rec.currencyCode === 'string' ? rec.currencyCode : undefined;
      return { currencyCode };
    }
  } catch {
    // ignore
  }

  // Prefer SystemSettings currency (db_settings) if available.
  try {
    const parsed = tryParseJson(localStorage.getItem('db_settings'));
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as Record<string, unknown>;
      const currencyCode = typeof rec.currency === 'string' ? rec.currency : undefined;
      if (currencyCode) return { currencyCode };
    }
  } catch {
    // ignore
  }

  // Backward-compatible defaults
  return { currencyCode: 'JOD' };
};

export const setMoneySettingsSync = (patch: MoneySettings): void => {
  const prev = getMoneySettingsSync();
  const next: MoneySettings = {
    ...prev,
    ...patch,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
};

export const getCurrencySuffix = (currencyCode: string): string => {
  const code = String(currencyCode || '')
    .trim()
    .toUpperCase();
  if (!code) return '';

  const map: Record<string, string> = {
    JOD: 'د.أ',
    USD: '$',
    EUR: '€',
    GBP: '£',
    SAR: 'ر.س',
    AED: 'د.إ',
    EGP: 'ج.م',
    IQD: 'د.ع',
    KWD: 'د.ك',
    QAR: 'ر.ق',
    BHD: 'د.ب',
    OMR: 'ر.ع',
  };

  return map[code] ?? code;
};
