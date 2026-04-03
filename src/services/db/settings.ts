/**
 * Persisted system settings (company profile, commissions defaults, etc.).
 */

import type { SystemSettings } from '@/types';
import { storage } from '@/services/storage';
import { KEYS } from './keys';
import { auditLog } from '@/services/auditLog';

const isUnknownRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

export const getSettings = (): SystemSettings => {
  const defaults: SystemSettings = {
    companyName: '',
    companySlogan: '',
    companyAddress: '',
    companyPhone: '',
    companyPhones: [],
    companyEmail: '',
    companyWebsite: '',
    logoUrl: '',
    currency: 'JOD',
    countryIso2: 'JO',
    countryDialCode: '962',
    taxNumber: '',
    commercialRegister: '',
    letterheadEnabled: true,
    companyIdentityText: '',
    socialFacebook: '',
    socialInstagram: '',
    socialLinkedin: '',
    socialTwitter: '',
    alertThresholdDays: 30,
    salesCommissionPercent: 2,
    rentalCommissionOwnerPercent: 0,
    rentalCommissionTenantPercent: 2,
    clearanceText: '',
    inactivityTimeoutMinutes: 15,
    /** قفل الشاشة بعد خمول (دقائق). 0 = معطّل. افتراضي 30 */
    autoLockMinutes: 30,
    contractWordTemplateName: 'عقد شقة فارغة الجديد .docx',
    installmentWordTemplateName: '',
    handoverWordTemplateName: '',
    contractWhatsAppPromptAfterCreate: true,
    whatsAppTarget: 'auto',
    whatsAppDelayMs: 10_000,
    whatsAppAutoEnabled: false,
    whatsAppWorkHoursStart: 8,
    whatsAppWorkHoursEnd: 20,
    whatsAppAutoDelayDays: 3,
    paymentMethods: [],
  };

  const raw = localStorage.getItem(KEYS.SETTINGS);
  if (!raw) return defaults;

  try {
    const parsedUnknown = JSON.parse(raw) as unknown;
    const parsed = isUnknownRecord(parsedUnknown) ? parsedUnknown : undefined;
    const merged: SystemSettings = { ...defaults, ...((parsed || {}) as Partial<SystemSettings>) };

    const minutesRaw = Number(merged.inactivityTimeoutMinutes);
    if (Number.isFinite(minutesRaw)) {
      const clamped = Math.max(1, Math.min(240, Math.floor(minutesRaw)));
      merged.inactivityTimeoutMinutes = clamped;
    } else {
      merged.inactivityTimeoutMinutes = defaults.inactivityTimeoutMinutes;
    }

    const lockRaw = Number(merged.autoLockMinutes);
    if (Number.isFinite(lockRaw)) {
      merged.autoLockMinutes = Math.max(0, Math.min(240, Math.floor(lockRaw)));
    } else {
      merged.autoLockMinutes = defaults.autoLockMinutes;
    }

    return merged;
  } catch {
    return defaults;
  }
};

export const saveSettings = (s: SystemSettings) => {
  const serialized = JSON.stringify(s);

  localStorage.setItem(KEYS.SETTINGS, serialized);

  void storage.setItem(KEYS.SETTINGS, serialized);

  try {
    auditLog.record('SETTINGS_SAVE', 'Settings', undefined, 'تحديث إعدادات النظام');
  } catch {
    /* ignore */
  }

  try {
    window.dispatchEvent(new CustomEvent('azrar:db-changed', { detail: { key: KEYS.SETTINGS } }));
  } catch {
    /* ignore */
  }
};
