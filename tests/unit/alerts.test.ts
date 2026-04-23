import { 
  createAlert, 
  upsertAlert, 
  markAlertAsRead, 
  markAllAlertsAsRead, 
  clearOldAlerts,
  stableAlertId,
  buildContractAlertContext
} from '@/services/db/alertsCore';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';
import { notificationCenter } from '@/services/notificationCenter';

describe('Alerts Core Service - Monitoring Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
    notificationCenter.markAllRead();
  });

  test('createAlert - generates stable ID and avoids duplicates', () => {
    createAlert('warning', 'Low Balance', 'Financial');
    createAlert('warning', 'Low Balance', 'Financial'); // Duplicate
    
    const alerts = kv.get(KEYS.ALERTS);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].الوصف).toBe('Low Balance');
    expect(alerts[0].id).toContain('ALR-GEN-Financial-');
  });

  test('createAlert - syncs with notificationCenter', () => {
    createAlert('error', 'Critical Fail', 'Risk');
    
    const ncItems = notificationCenter.getItems();
    expect(ncItems).toHaveLength(1);
    expect(ncItems[0].message).toBe('Critical Fail');
    expect(ncItems[0].urgent).toBe(true);
  });

  test('buildContractAlertContext - resolves names and codes', () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'Tenant A', رقم_الهاتف: '999' }]);
    kv.save(KEYS.PROPERTIES, [{ 
      رقم_العقار: 'PR1', الكود_الداخلي: 'UNIT-X', 
      رقم_المالك: 'O1', النوع: 'شقة', العنوان: 'A', حالة_العقار: 'شاغر', IsRented: false, المساحة: 10
    }]);
    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1',
      تاريخ_البداية: '2025-01-01', تاريخ_النهاية: '2025-12-31',
      مدة_العقد_بالاشهر: 12, القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'نقدي', حالة_العقد: 'نشط', isArchived: false,
      lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    }]);
    
    buildCache();

    const ctx = buildContractAlertContext('C1');
    expect(ctx.tenantName).toBe('Tenant A');
    expect(ctx.propertyCode).toBe('UNIT-X');
    expect(ctx.مرجع_المعرف).toBe('C1');
  });

  test('markAlertAsRead and markAllAlertsAsRead', () => {
    createAlert('info', 'M1', 'System');
    createAlert('info', 'M2', 'System');
    
    const alerts = kv.get<any>(KEYS.ALERTS);
    markAlertAsRead(alerts[1].id);
    expect(kv.get<any>(KEYS.ALERTS)[1].تم_القراءة).toBe(true);
    expect(kv.get<any>(KEYS.ALERTS)[0].تم_القراءة).toBe(false);
    
    markAllAlertsAsRead();
    expect(kv.get<any>(KEYS.ALERTS).every((a: any) => a.تم_القراءة)).toBe(true);
  });

  test('clearOldAlerts - purges based on date', () => {
    const today = new Date().toISOString().split('T')[0];
    const oldDate = '2020-01-01';
    
    kv.save(KEYS.ALERTS, [
      { id: 'A1', تاريخ_الانشاء: today, الوصف: 'New', تم_القراءة: false },
      { id: 'A2', تاريخ_الانشاء: oldDate, الوصف: 'Old', تم_القراءة: false }
    ]);
    
    clearOldAlerts(30);
    expect(kv.get(KEYS.ALERTS)).toHaveLength(1);
    expect((kv.get(KEYS.ALERTS) as any)[0].id).toBe('A1');
  });
});
