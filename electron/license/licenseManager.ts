import { kvSet } from '../db';
import type { LicenseStatus } from './types';

const ACTIVATED_FLAG_KEY = 'db_app_activated';

// تم إزالة التفعيل بالكامل بناءً على طلب المستخدم
// هذا الملف تم تبسيطه لضمان بقاء النظام مفعلاً دائماً دون الحاجة لفحص تراخيص

export const getLicenseServerUrl = (): string => '';
export const setLicenseServerUrl = (_url: string) => ({ ok: true, url: '' });

export const getDeviceFingerprint = () => ({ ok: true, fingerprint: 'bypassed-fingerprint' });

export const getLicenseStatus = async (): Promise<LicenseStatus> => {
  // تفعيل النظام دائماً
  kvSet(ACTIVATED_FLAG_KEY, '1');

  return {
    activated: true,
    reason: 'active',
    activatedAt: new Date().toISOString(),
    license: {
      features: { '*': true }, // تفعيل جميع الميزات
    },
  };
};

export const activateFromContent = async (_rawContent: string) => ({ ok: true });
export const activateOnline = async (_params: { licenseKey: string; serverUrl?: string }) => ({
  ok: true,
});
export const deactivate = async () => ({ ok: true });
export const refreshOnlineStatus = async () => ({ ok: true, status: await getLicenseStatus() });
export const startOnlineStatusMonitor = () => {};
export const stopOnlineStatusMonitor = () => {};
export const activateWithLicenseContent = async (_rawContent: string) => ({ ok: true });
export const getBoundDeviceIdForThisMachine = async () => 'bypassed-device-id';
