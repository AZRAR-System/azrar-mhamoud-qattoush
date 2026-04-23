import { 
  classifyAutoSendKind, 
  hasRecentAutoSendForInstallment, 
  tryAutoSendIfEligible 
} from '../../src/services/whatsAppAutoSender';
import { get } from '../../src/services/db/kv';
import { openWhatsAppForPhones } from '../../src/utils/whatsapp';
import { addNotificationSendLogInternal } from '../../src/services/db/paymentNotifications';

jest.mock('../../src/services/db/kv');
jest.mock('../../src/utils/whatsapp');
jest.mock('../../src/services/db/paymentNotifications');
jest.mock('../../src/services/geoSettings', () => ({
  getDefaultWhatsAppCountryCodeSync: () => '962'
}));
jest.mock('../../src/services/db/installments', () => ({
  getInstallmentPaidAndRemaining: () => ({ remaining: 100 })
}));
jest.mock('../../src/services/db/messageTemplates', () => ({
  getTemplate: () => ''
}));

describe('WhatsApp Auto Sender Logic - Comprehensive Suite', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Classification - Before Due
  test('classifyAutoSendKind - returns before_due when days match delay setting', () => {
    expect(classifyAutoSendKind(5, 5)).toBe('before_due');
  });

  // 2. Classification - Due Today
  test('classifyAutoSendKind - returns due_today when days are 0', () => {
    expect(classifyAutoSendKind(0, 3)).toBe('due_today');
  });

  // 3. Classification - Late
  test('classifyAutoSendKind - returns late when days are -3', () => {
    expect(classifyAutoSendKind(-3, 3)).toBe('late');
  });

  // 4. Duplicate Prevention
  test('hasRecentAutoSendForInstallment - returns true if sent in last 24h', () => {
    const recent = new Date().toISOString();
    (get as jest.Mock).mockReturnValue([{ installmentIds: ['I1'], category: 'whatsapp_auto_due', sentAt: recent }]);
    expect(hasRecentAutoSendForInstallment('I1')).toBe(true);
  });

  // 5. Duplicate Prevention - Old Log
  test('hasRecentAutoSendForInstallment - returns false if log is older than 24h', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    (get as jest.Mock).mockReturnValue([{ installmentIds: ['I1'], category: 'whatsapp_auto_due', sentAt: old }]);
    expect(hasRecentAutoSendForInstallment('I1')).toBe(false);
  });

  // 6. Eligibility - Disabled Setting
  test('tryAutoSendIfEligible - does nothing if auto-send is disabled', async () => {
    const params = { settings: { whatsAppAutoEnabled: false }, daysUntilDue: 0 } as any;
    await tryAutoSendIfEligible(params);
    expect(openWhatsAppForPhones).not.toHaveBeenCalled();
  });

  // 7. Eligibility - Work Hours
  test('tryAutoSendIfEligible - does nothing outside work hours', async () => {
    // Mock hours to be outside 8-20
    const now = new Date();
    now.setHours(2); // 2 AM
    jest.useFakeTimers().setSystemTime(now);

    const params = { settings: { whatsAppAutoEnabled: true, whatsAppWorkHoursStart: 8, whatsAppWorkHoursEnd: 20 }, daysUntilDue: 0 } as any;
    await tryAutoSendIfEligible(params);
    expect(openWhatsAppForPhones).not.toHaveBeenCalled();
    
    jest.useRealTimers();
  });

  // 8. Successful Send Workflow
  test('tryAutoSendIfEligible - opens WhatsApp and logs event on success', async () => {
    const now = new Date();
    now.setHours(12); // Noon
    jest.useFakeTimers().setSystemTime(now);

    (get as jest.Mock).mockReturnValue([]); // No recent logs
    const params = { 
      installment: { رقم_الكمبيالة: 'I1', تاريخ_استحقاق: '2025-01-01' },
      contract: { رقم_العقد: 'C1' },
      tenant: { الاسم: 'Moe', رقم_الهاتف: '079' },
      settings: { 
        whatsAppAutoEnabled: true, 
        whatsAppWorkHoursStart: 8, 
        whatsAppWorkHoursEnd: 20,
        whatsAppAutoDelayDays: 3
      },
      daysUntilDue: 0 
    } as any;

    await tryAutoSendIfEligible(params);
    expect(openWhatsAppForPhones).toHaveBeenCalled();
    expect(addNotificationSendLogInternal).toHaveBeenCalled();

    jest.useRealTimers();
  });
});
