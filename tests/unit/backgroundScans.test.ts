import { 
  createBackgroundScansRuntime, 
  BackgroundScansDeps 
} from '@/services/db/backgroundScans';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Background Scans Service - Automation Suite', () => {
  const deps: BackgroundScansDeps = {
    asUnknownRecord: (v) => v as Record<string, unknown>,
    toDateOnly: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    formatDateOnly: (d) => d.toISOString().split('T')[0],
    parseDateOnly: (iso) => {
      if (!iso) return null;
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    daysBetweenDateOnly: (f, t) => Math.round((t.getTime() - f.getTime()) / (1000 * 3600 * 24)),
    addDaysIso: (iso, days) => {
      const d = new Date(iso);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    },
    addMonthsDateOnly: (iso, months) => {
      const d = new Date(iso);
      d.setMonth(d.getMonth() + months);
      return d;
    },
    createContract: jest.fn().mockReturnValue({ success: true, data: { رقم_العقد: 'NEW-C1' } }),
    logOperationInternal: jest.fn(),
  };

  const runtime = createBackgroundScansRuntime(deps);

  beforeEach(() => {
    localStorage.clear();
    buildCache();
    jest.clearAllMocks();
  });

  test('dedupeAndCleanupAlertsInternal - handles installment reminders', () => {
    kv.save(KEYS.ALERTS, [{ id: 'ALR-FIN-REM7-I1', تم_القراءة: false, الوصف: 'Remind' }]);
    kv.save(KEYS.INSTALLMENTS, [{ 
      رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', حالة_الكمبيالة: 'مدفوع', القيمة: 100, سجل_الدفعات: [], 
      نوع_الكمبيالة: 'Rental', تاريخ_استحقاق: '2025-01-01' 
    }]);

    runtime.dedupeAndCleanupAlertsInternal();
    const alerts = kv.get<any>(KEYS.ALERTS);
    expect(alerts[0].تم_القراءة).toBe(true);
  });

  test('runAutoRenewContractsInternal - creates new contract for expired ones', () => {
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);

    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'OLD-1', 
      تاريخ_البداية: lastYear.toISOString().split('T')[0],
      تاريخ_النهاية: lastMonth.toISOString().split('T')[0],
      autoRenew: true,
      isArchived: false,
      مدة_العقد_بالاشهر: 12,
      رقم_المستاجر: 'P1',
      رقم_العقار: 'PR1',
      القيمة_السنوية: 1200,
      تكرار_الدفع: 1,
      طريقة_الدفع: 'Cash',
      حالة_العقد: 'Active',
      lateFeeType: 'none',
      lateFeeValue: 0,
      lateFeeGraceDays: 0
    }]);

    runtime.runAutoRenewContractsInternal();
    expect(deps.createContract).toHaveBeenCalled();
    const contracts = kv.get<any>(KEYS.CONTRACTS);
    expect(contracts[0].حالة_العقد).toBe('مجدد');
  });

  test('runDataQualityScanInternal - detects missing fields', () => {
    kv.save(KEYS.PROPERTIES, [{ 
      رقم_العقار: 'PR1', الكود_الداخلي: 'P-101', العنوان: 'Amman',
      رقم_المالك: 'O1', النوع: 'Apartment', حالة_العقار: 'Active', IsRented: false, المساحة: 100
    }]);
    runtime.runDataQualityScanInternal();
    const alerts = kv.get<any>(KEYS.ALERTS);
    expect(alerts.some(a => a.id === 'ALR-DQ-PROP-UTILS')).toBe(true);
  });

  test('runExpiryScanInternal - alerts for upcoming expiry', () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    const nextWeekIso = nextWeek.toISOString().split('T')[0];

    kv.save(KEYS.CONTRACTS, [{ 
      رقم_العقد: 'EXP-1', 
      تاريخ_البداية: '2024-01-01',
      تاريخ_النهاية: nextWeekIso,
      isArchived: false,
      رقم_المستاجر: 'P1',
      رقم_العقار: 'PR1',
      مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 1200,
      تكرار_الدفع: 1,
      طريقة_الدفع: 'Cash',
      حالة_العقد: 'Active',
      lateFeeType: 'none',
      lateFeeValue: 0,
      lateFeeGraceDays: 0
    }]);

    runtime.runExpiryScanInternal();
    const alerts = kv.get<any>(KEYS.ALERTS);
    expect(alerts.some(a => a.id === 'ALR-EXP-EXP-1')).toBe(true);
  });
});
