import { 
  getPaymentNotificationTargetsInternal, 
  addNotificationSendLogInternal,
  updateNotificationSendLogInternal,
  deleteNotificationSendLogInternal
} from '@/services/db/paymentNotifications';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Payment Notifications Service - Reminders Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  const validContract = (id: string, tenantId: string) => ({
    رقم_العقد: id,
    رقم_العقار: 'PR1',
    رقم_المستاجر: tenantId,
    تاريخ_البداية: '2025-01-01',
    تاريخ_النهاية: '2025-12-31',
    مدة_العقد_بالاشهر: 12,
    القيمة_السنوية: 1200,
    تكرار_الدفع: 1,
    طريقة_الدفع: 'نقدي',
    حالة_العقد: 'نشط',
    isArchived: false,
    lateFeeType: 'none' as const,
    lateFeeValue: 0,
    lateFeeGraceDays: 0
  });

  test('getPaymentNotificationTargetsInternal - finds upcoming payments', () => {
    // 1. Setup entities
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'Ali', رقم_الهاتف: '999' }]);
    kv.save(KEYS.PROPERTIES, [{ 
      رقم_العقار: 'PR1', الكود_الداخلي: 'UNIT-1', رقم_المالك: 'O1', 
      النوع: 'شقة', العنوان: 'A', حالة_العقار: 'شاغر', IsRented: false, المساحة: 10
    }]);
    kv.save(KEYS.CONTRACTS, [validContract('C1', 'P1')]);
    
    // Future date (5 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureIso = futureDate.toISOString().split('T')[0];

    kv.save(KEYS.INSTALLMENTS, [
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: futureIso, القيمة: 100, حالة_الكمبيالة: 'غير مدفوع', نوع_الكمبيالة: 'إيجار' }
    ]);
    
    buildCache();

    const targets = getPaymentNotificationTargetsInternal(7); // look ahead 7 days
    expect(targets).toHaveLength(1);
    expect(targets[0].tenantName).toBe('Ali');
    expect(targets[0].items[0].installmentId).toBe('I1');
    expect(targets[0].items[0].bucket).toBe('upcoming');
  });

  test('Notification Logs - CRUD', () => {
    const log = addNotificationSendLogInternal({
      category: 'reminder',
      tenantName: 'Ali',
      sentAt: new Date().toISOString()
    });
    
    expect(log.id).toContain('NSL-');
    
    updateNotificationSendLogInternal(log.id, { note: 'Success' });
    const stored = kv.get<any>(KEYS.NOTIFICATION_SEND_LOGS);
    expect(stored[0].note).toBe('Success');
    
    deleteNotificationSendLogInternal(log.id);
    expect(kv.get<any>(KEYS.NOTIFICATION_SEND_LOGS)).toHaveLength(0);
  });
});
