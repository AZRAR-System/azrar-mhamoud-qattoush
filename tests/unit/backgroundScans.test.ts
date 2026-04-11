import { jest } from '@jest/globals';
import { DbService } from '@/services/mockDb';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Background Scans Service - Semantic Fix', () => {
  beforeEach(() => {
    localStorage.clear();
    save('db_alerts', []);
    save('db_contracts', [
      { رقم_العقد: 'C1', رقم_المستاجر: 'P1', رقم_العقار: 'PR1', حالة_العقد: 'نشط', تاريخ_النهاية: '2024-12-31' }
    ]);
    save('db_properties', [
      { رقم_العقار: 'PR1', الكود_الداخلي: 'VC-1', IsRented: true }
    ]);
    save('db_installments', [
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: 'غير مدفوع', تاريخ_استحقاق: '2024-02-05' }
    ]);
  });

  it('runDailyScheduler: should detect upcoming installments and create specific alerts', () => {
    // Current date is 2024-02-01, installment is 2024-02-05 (4 days ahead)
    // This should trigger the "7 days reminder" alert
    const mockDate = new Date('2024-02-01');
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    DbService.runDailyScheduler();

    const alerts = get<any[]>('db_alerts');
    expect(alerts.some(a => a.نوع_التنبيه.includes('تذكير قبل الاستحقاق'))).toBe(true);
    
    jest.useRealTimers();
  });

  it('runDailyScheduler: should catch missing contract data quality issues', () => {
    save('db_contracts', []); // Nullify contracts
    save('db_properties', [
      { رقم_العقار: 'PR1', الكود_الداخلي: 'VC-1', IsRented: true } // Still rented
    ]);

    DbService.runDailyScheduler();

    const alerts = get<any[]>('db_alerts');
    expect(alerts.some(a => a.نوع_التنبيه === 'جودة البيانات')).toBe(true);
  });

  it('runAutoRenewContractsInternal: should trigger renewal alerts for upcoming expirations', () => {
    save(KEYS.CONTRACTS, [{
      رقم_العقد: 'C-EXP',
      حالة_العقد: 'نشط',
      تاريخ_النهاية: '2024-02-15', // Expires in 14 days
      IsAutoRenew: true
    }]);

    const mockDate = new Date('2024-02-01');
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    DbService.runDailyScheduler();

    const alerts = get<any[]>('db_alerts');
    // Check for "تذكير بانتهاء عقد" alert
    expect(alerts.some(a => a.نوع_التنبيه.includes('انتهاء عقد'))).toBe(true);
    
    jest.useRealTimers();
  });
});
