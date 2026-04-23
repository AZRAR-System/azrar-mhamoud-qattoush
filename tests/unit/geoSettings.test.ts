import { 
  getGeoSettingsSync, 
  getDefaultWhatsAppCountryCodeSync 
} from '@/services/geoSettings';

describe('Geo Settings Service - Localization Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('getGeoSettingsSync - returns empty object when no settings exist', () => {
    expect(getGeoSettingsSync()).toEqual({});
  });

  test('getGeoSettingsSync - returns correct settings from localStorage', () => {
    const mockSettings = {
      countryIso2: 'JO',
      countryDialCode: '962',
      currency: 'JOD'
    };
    localStorage.setItem('db_settings', JSON.stringify(mockSettings));
    
    expect(getGeoSettingsSync()).toEqual(mockSettings);
  });

  test('getGeoSettingsSync - handles invalid JSON gracefully', () => {
    localStorage.setItem('db_settings', 'invalid-json');
    expect(getGeoSettingsSync()).toEqual({});
  });

  test('getDefaultWhatsAppCountryCodeSync - returns default (962) when no dial code set', () => {
    expect(getDefaultWhatsAppCountryCodeSync()).toBe('962');
  });

  test('getDefaultWhatsAppCountryCodeSync - returns dial code from settings', () => {
    localStorage.setItem('db_settings', JSON.stringify({ countryDialCode: '971' }));
    expect(getDefaultWhatsAppCountryCodeSync()).toBe('971');
  });

  test('getDefaultWhatsAppCountryCodeSync - trims whitespace from dial code', () => {
    localStorage.setItem('db_settings', JSON.stringify({ countryDialCode: '  20  ' }));
    expect(getDefaultWhatsAppCountryCodeSync()).toBe('20');
  });
});
