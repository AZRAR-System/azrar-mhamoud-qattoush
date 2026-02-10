export type GeoCountry = {
  iso2: string;
  nameAr: string;
  dialCode: string;
  currencyCode: string;
  flag: string;
};

export type GeoCurrency = {
  code: string;
  nameAr: string;
};

// Minimal curated list (can be expanded later).
export const GEO_COUNTRIES: GeoCountry[] = [
  { iso2: 'JO', nameAr: 'الأردن', dialCode: '962', currencyCode: 'JOD', flag: '🇯🇴' },
  { iso2: 'SA', nameAr: 'السعودية', dialCode: '966', currencyCode: 'SAR', flag: '🇸🇦' },
  { iso2: 'AE', nameAr: 'الإمارات', dialCode: '971', currencyCode: 'AED', flag: '🇦🇪' },
  { iso2: 'KW', nameAr: 'الكويت', dialCode: '965', currencyCode: 'KWD', flag: '🇰🇼' },
  { iso2: 'IQ', nameAr: 'العراق', dialCode: '964', currencyCode: 'IQD', flag: '🇮🇶' },
  { iso2: 'EG', nameAr: 'مصر', dialCode: '20', currencyCode: 'EGP', flag: '🇪🇬' },
  { iso2: 'QA', nameAr: 'قطر', dialCode: '974', currencyCode: 'QAR', flag: '🇶🇦' },
  { iso2: 'BH', nameAr: 'البحرين', dialCode: '973', currencyCode: 'BHD', flag: '🇧🇭' },
  { iso2: 'OM', nameAr: 'عُمان', dialCode: '968', currencyCode: 'OMR', flag: '🇴🇲' },
  { iso2: 'US', nameAr: 'الولايات المتحدة', dialCode: '1', currencyCode: 'USD', flag: '🇺🇸' },
  { iso2: 'GB', nameAr: 'المملكة المتحدة', dialCode: '44', currencyCode: 'GBP', flag: '🇬🇧' },
  { iso2: 'EU', nameAr: 'الاتحاد الأوروبي', dialCode: '', currencyCode: 'EUR', flag: '🇪🇺' },
];

export const GEO_CURRENCIES: GeoCurrency[] = [
  { code: 'JOD', nameAr: 'دينار أردني' },
  { code: 'USD', nameAr: 'دولار أمريكي' },
  { code: 'EUR', nameAr: 'يورو' },
  { code: 'GBP', nameAr: 'جنيه إسترليني' },
  { code: 'SAR', nameAr: 'ريال سعودي' },
  { code: 'AED', nameAr: 'درهم إماراتي' },
  { code: 'EGP', nameAr: 'جنيه مصري' },
  { code: 'IQD', nameAr: 'دينار عراقي' },
  { code: 'KWD', nameAr: 'دينار كويتي' },
  { code: 'QAR', nameAr: 'ريال قطري' },
  { code: 'BHD', nameAr: 'دينار بحريني' },
  { code: 'OMR', nameAr: 'ريال عُماني' },
];

export const getGeoCountryByIso2 = (iso2: string | null | undefined): GeoCountry | undefined => {
  const key = String(iso2 || '').trim().toUpperCase();
  if (!key) return undefined;
  return GEO_COUNTRIES.find((c) => c.iso2 === key);
};
