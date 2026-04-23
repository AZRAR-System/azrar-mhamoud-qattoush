import { createBackgroundScansRuntime } from '@/services/db/backgroundScans';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Background Scans - Comprehensive Logic', () => {
  const deps = {
    asUnknownRecord: (v: any) => v,
    toDateOnly: (d: Date) => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    },
    formatDateOnly: (d: Date) => d.toISOString().split('T')[0],
    parseDateOnly: (iso: string) => {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : d;
    },
    daysBetweenDateOnly: (from: Date, to: Date) => {
      return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    },
    addDaysIso: (iso: string, days: number) => {
      const d = new Date(iso);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    },
    addMonthsDateOnly: (iso: string, months: number) => {
      const d = new Date(iso);
      d.setMonth(d.getMonth() + months);
      return d;
    },
    createContract: jest.fn((data) => ({ success: true, data: { رقم_العقد: 'NEW-C1', ...data } })),
    logOperationInternal: jest.fn(),
  };

  const runtime = createBackgroundScansRuntime(deps as any);

  beforeEach(() => {
    localStorage.clear();
    buildCache();
    jest.clearAllMocks();
  });

  test('runMaintenanceScanInternal - alerts for old open tickets', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const oldIso = oldDate.toISOString().split('T')[0];

    kv.save(KEYS.MAINTENANCE, [{ 
      رقم_التذكرة: 'T1', الحالة: 'مفتوح', تاريخ_الطلب: oldIso, الوصف: 'Leak' 
    }]);

    runtime.runMaintenanceScanInternal();
    const alerts = kv.get<any>(KEYS.ALERTS);
    expect(alerts.some((a: any) => a.id === 'ALR-MNT-PENDING-T1')).toBe(true);
  });

  test('runDataQualityScanInternal - alerts for missing person data', () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'John', رقم_الهاتف: ' ' }]); 
    runtime.runDataQualityScanInternal();
    const alerts = kv.get<any>(KEYS.ALERTS);
    expect(alerts.some((a: any) => a.id === 'ALR-DQ-PEOPLE-IDPHONE')).toBe(true);
  });

  test('runAutoRenewContractsInternal - renews expired auto-renew contracts', () => {
    // Force end to be far in the past to avoid timezone/midnight edge cases
    const pastStart = '2020-01-01';
    const pastEnd = '2020-12-31';

    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'OLD-C1', 
      رقم_العقار: 'PR1', 
      رقم_المستاجر: 'P1',
      تاريخ_البداية: pastStart,
      تاريخ_النهاية: pastEnd,
      مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 1000,
      تكرار_الدفع: 1,
      طريقة_الدفع: 'Cash',
      حالة_العقد: 'نشط',
      isArchived: false,
      autoRenew: true,
      lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    }]);

    runtime.runAutoRenewContractsInternal();
    expect(deps.createContract).toHaveBeenCalled();
  });

  test('dedupeAndCleanupAlertsInternal - patches missing context', () => {
    kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'John Doe', رقم_الهاتف: '123' }]);
    kv.save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR1', الكود_الداخلي: 'P-101', رقم_المالك: 'O1', النوع: 'A', العنوان: 'A', حالة_العقار: 'A', IsRented: true, المساحة: 100 }]);
    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'C-123', رقم_العقار: 'PR1', رقم_المستاجر: 'P1',
      تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2021-01-01', مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'Cash', حالة_العقد: 'Active', isArchived: false,
      lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
    }]);

    kv.save(KEYS.ALERTS, [{
      id: 'ALR-TEMP',
      نوع_التنبيه: 'تأجيل تحصيل',
      الوصف: 'عقد #C-123',
      تم_القراءة: false
    }]);

    runtime.dedupeAndCleanupAlertsInternal();
    const alerts = kv.get<any>(KEYS.ALERTS);
    expect(alerts[0].tenantName).toBe('John Doe');
    expect(alerts[0].propertyCode).toBe('P-101');
  });
});
