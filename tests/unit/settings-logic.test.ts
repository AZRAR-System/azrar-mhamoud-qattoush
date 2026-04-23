import { getSettings, saveSettings } from '@/services/db/settings';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('System Settings Service - Comprehensive Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('getSettings - returns defaults when empty', () => {
    const s = getSettings();
    expect(s.currency).toBe('JOD');
    expect(s.alertThresholdDays).toBe(30);
  });

  test('saveSettings - persists data correctly', () => {
    const s = getSettings();
    s.companyName = 'Azrar Test';
    saveSettings(s);
    
    const saved = getSettings();
    expect(saved.companyName).toBe('Azrar Test');
  });

  test('getSettings - clamps inactivityTimeoutMinutes (1-240)', () => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ inactivityTimeoutMinutes: 999 }));
    buildCache();
    expect(getSettings().inactivityTimeoutMinutes).toBe(240);
  });
});
