import {
  classifyAutoSendKind,
  classifyAlertType,
  hasRecentAutoSendForInstallment,
} from '@/services/whatsAppAutoSender';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

jest.mock('@/utils/whatsapp', () => ({
  openWhatsAppForPhones: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/geoSettings', () => ({
  getDefaultWhatsAppCountryCodeSync: jest.fn(() => '962'),
}));
jest.mock('@/services/db/messageTemplates', () => ({
  getTemplate: jest.fn(() => ''),
}));
jest.mock('@/services/notificationTemplates', () => ({
  fillTemplate: jest.fn((t: string) => t),
}));
jest.mock('@/services/db/paymentNotifications', () => ({
  addNotificationSendLogInternal: jest.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  buildCache();
  jest.clearAllMocks();
});

describe('classifyAutoSendKind', () => {
  test('returns before_due when daysUntilDue equals delayDays', () => {
    expect(classifyAutoSendKind(3, 3)).toBe('before_due');
  });

  test('returns due_today when daysUntilDue is 0', () => {
    expect(classifyAutoSendKind(0, 3)).toBe('due_today');
  });

  test('returns late when daysUntilDue is -3', () => {
    expect(classifyAutoSendKind(-3, 3)).toBe('late');
  });

  test('returns null for other values', () => {
    expect(classifyAutoSendKind(5, 3)).toBeNull();
    expect(classifyAutoSendKind(-1, 3)).toBeNull();
    expect(classifyAutoSendKind(10, 3)).toBeNull();
  });

  test('delayDays=0 falls back to default 3', () => {
    expect(classifyAutoSendKind(3, 0)).toBe('before_due');
  });

  test('clamps delayDays maximum to 30', () => {
    expect(classifyAutoSendKind(30, 100)).toBe('before_due');
  });
});

describe('classifyAlertType', () => {
  test('due_today for daysUntilDue = 0', () => {
    expect(classifyAlertType(0)).toBe('due_today');
  });

  test('overdue for negative days', () => {
    expect(classifyAlertType(-1)).toBe('overdue');
    expect(classifyAlertType(-10)).toBe('overdue');
  });

  test('upcoming for 1-7 days', () => {
    expect(classifyAlertType(1)).toBe('upcoming');
    expect(classifyAlertType(7)).toBe('upcoming');
  });

  test('null for more than 7 days', () => {
    expect(classifyAlertType(8)).toBeNull();
    expect(classifyAlertType(30)).toBeNull();
  });
});

describe('hasRecentAutoSendForInstallment', () => {
  test('returns false when no logs', () => {
    expect(hasRecentAutoSendForInstallment('I-1')).toBe(false);
  });

  test('returns false when log is older than 24 hours', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    kv.save(KEYS.NOTIFICATION_SEND_LOGS, [{
      installmentIds: ['I-1'],
      category: 'whatsapp_auto_before',
      sentAt: old,
      tenantName: 'محمود',
    }]);
    buildCache();
    expect(hasRecentAutoSendForInstallment('I-1')).toBe(false);
  });

  test('returns true when recent log exists', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    kv.save(KEYS.NOTIFICATION_SEND_LOGS, [{
      installmentIds: ['I-1'],
      category: 'whatsapp_auto_due',
      sentAt: recent,
      tenantName: 'محمود',
    }]);
    buildCache();
    expect(hasRecentAutoSendForInstallment('I-1')).toBe(true);
  });

  test('returns false for different installment id', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    kv.save(KEYS.NOTIFICATION_SEND_LOGS, [{
      installmentIds: ['I-999'],
      category: 'whatsapp_auto_due',
      sentAt: recent,
      tenantName: 'خالد',
    }]);
    buildCache();
    expect(hasRecentAutoSendForInstallment('I-1')).toBe(false);
  });

  test('returns false when category is not whatsapp_auto', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    kv.save(KEYS.NOTIFICATION_SEND_LOGS, [{
      installmentIds: ['I-1'],
      category: 'email_reminder',
      sentAt: recent,
      tenantName: 'أحمد الزعبي',
    }]);
    buildCache();
    expect(hasRecentAutoSendForInstallment('I-1')).toBe(false);
  });
});

describe('tryAutoSendIfEligible', () => {
  const { tryAutoSendIfEligible } = require('@/services/whatsAppAutoSender');

  const baseSettings = {
    whatsAppAutoEnabled: true,
    whatsAppWorkHoursStart: 0,
    whatsAppWorkHoursEnd: 24,
    whatsAppAutoDelayDays: 3,
    whatsAppDelayMs: 0,
    whatsAppTarget: 'web',
  };

  const makeInstallment = (id: string) => ({
    رقم_الكمبيالة: id,
    رقم_العقد: 'C-1',
    القيمة: 500,
    المبلغ_المدفوع: 0,
    القيمة_المتبقية: 500,
    تاريخ_استحقاق: '2026-05-01',
    حالة_الكمبيالة: 'غير مدفوع',
    نوع_الكمبيالة: 'إيجار',
    نوع_الدفعة: 'دورية',
  } as any);

  const contract = { رقم_العقد: 'C-1' } as any;
  const tenant = { رقم_الشخص: 'P-1', الاسم: 'محمد القطوش', رقم_الهاتف: '0791234567' } as any;
  const property = { رقم_العقار: 'PR-1', الكود_الداخلي: 'P-101' } as any;

  test('does nothing when whatsAppAutoEnabled is false', async () => {
    const { openWhatsAppForPhones } = require('@/utils/whatsapp');
    await tryAutoSendIfEligible({
      installment: makeInstallment('I-1'),
      contract, tenant, property,
      settings: { ...baseSettings, whatsAppAutoEnabled: false },
      daysUntilDue: 3,
    });
    expect(openWhatsAppForPhones).not.toHaveBeenCalled();
  });

  test('does nothing when kind is null', async () => {
    const { openWhatsAppForPhones } = require('@/utils/whatsapp');
    await tryAutoSendIfEligible({
      installment: makeInstallment('I-2'),
      contract, tenant, property,
      settings: baseSettings,
      daysUntilDue: 5,
    });
    expect(openWhatsAppForPhones).not.toHaveBeenCalled();
  });

  test('sends when eligible', async () => {
    const { openWhatsAppForPhones } = require('@/utils/whatsapp');
    await tryAutoSendIfEligible({
      installment: makeInstallment('I-3'),
      contract, tenant, property,
      settings: baseSettings,
      daysUntilDue: 3,
    });
    expect(openWhatsAppForPhones).toHaveBeenCalled();
  });

  test('skips when recently sent', async () => {
    const { openWhatsAppForPhones } = require('@/utils/whatsapp');
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    kv.save(KEYS.NOTIFICATION_SEND_LOGS, [{
      installmentIds: ['I-4'],
      category: 'whatsapp_auto_before',
      sentAt: recent,
      tenantName: 'محمد',
    }]);
    buildCache();
    await tryAutoSendIfEligible({
      installment: makeInstallment('I-4'),
      contract, tenant, property,
      settings: baseSettings,
      daysUntilDue: 3,
    });
    expect(openWhatsAppForPhones).not.toHaveBeenCalled();
  });

  test('skips when installment id is empty', async () => {
    const { openWhatsAppForPhones } = require('@/utils/whatsapp');
    await tryAutoSendIfEligible({
      installment: { ...makeInstallment(''), رقم_الكمبيالة: '' },
      contract, tenant, property,
      settings: baseSettings,
      daysUntilDue: 3,
    });
    expect(openWhatsAppForPhones).not.toHaveBeenCalled();
  });
});
