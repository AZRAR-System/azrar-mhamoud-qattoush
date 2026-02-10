type GeoSettings = {
  countryIso2?: string;
  countryDialCode?: string;
  currency?: string;
};

const safeParseJsonRecord = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const getGeoSettingsSync = (): GeoSettings => {
  if (typeof window === 'undefined') return {};
  const rec = safeParseJsonRecord(localStorage.getItem('db_settings'));
  if (!rec) return {};

  const countryIso2 = typeof rec.countryIso2 === 'string' ? rec.countryIso2 : undefined;
  const countryDialCode = typeof rec.countryDialCode === 'string' ? rec.countryDialCode : undefined;
  const currency = typeof rec.currency === 'string' ? rec.currency : undefined;

  return { countryIso2, countryDialCode, currency };
};

export const getDefaultWhatsAppCountryCodeSync = (): string => {
  const s = getGeoSettingsSync();
  const dial = String(s.countryDialCode || '').trim();
  return dial || '962';
};
