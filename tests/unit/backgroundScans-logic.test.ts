import { createBackgroundScansRuntime } from '../../src/services/db/backgroundScans';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';
import { upsertAlert, markAlertsReadByPrefix } from '../../src/services/db/alertsCore';
import { INSTALLMENT_STATUS } from '../../src/services/db/installmentConstants';

jest.mock('../../src/services/db/kv');
jest.mock('../../src/services/db/alertsCore');
jest.mock('../../src/services/db/settings', () => ({
  getSettings: jest.fn(() => ({ alertThresholdDays: 30 }))
}));
jest.mock('../../src/services/notificationCenter', () => ({
  notificationCenter: { add: jest.fn() }
}));

const deps = {
  asUnknownRecord: (v: any) => v,
  toDateOnly: (d: Date) => { d.setHours(0,0,0,0); return d; },
  formatDateOnly: (d: Date) => d.toISOString().split('T')[0],
  parseDateOnly: (iso: string) => iso ? new Date(iso) : null,
  daysBetweenDateOnly: (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)),
  addDaysIso: (iso: string, days: number) => {
    const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0];
  },
  addMonthsDateOnly: (iso: string, months: number) => {
    const d = new Date(iso); d.setMonth(d.getMonth() + months); return d;
  },
  createContract: jest.fn(() => ({ success: true, data: { رقم_العقد: 'NEW-C1' } })),
  logOperationInternal: jest.fn()
};

const runtime = createBackgroundScansRuntime(deps as any);

describe('Background Scans Logic - Comprehensive Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Installment Reminders
  test('runInstallmentReminderScanInternal - alerts for upcoming installments (7 days)', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const iso = futureDate.toISOString().split('T')[0];

    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'C1', حالة_العقد: 'نشط' }];
      if (key === KEYS.INSTALLMENTS) return [{ رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: iso, القيمة: 100, حالة_الكمبيالة: 'Pending' }];
      if (key === KEYS.PEOPLE) return [];
      if (key === KEYS.PROPERTIES) return [];
      return [];
    });

    runtime.runInstallmentReminderScanInternal();
    expect(upsertAlert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ALR-FIN-REM7-I1',
      نوع_التنبيه: 'تذكير قبل الاستحقاق (7 أيام)'
    }));
  });

  // 2. Auto Renew Contracts
  test('runAutoRenewContractsInternal - renews expired contracts with autoRenew enabled', () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);
    const iso = pastDate.toISOString().split('T')[0];

    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [{ 
        رقم_العقد: 'C1', 
        تاريخ_النهاية: iso, 
        autoRenew: true, 
        isArchived: false,
        مدة_العقد_بالاشهر: 12
      }];
      if (key === KEYS.COMMISSIONS) return [];
      return [];
    });

    runtime.runAutoRenewContractsInternal();
    expect(deps.createContract).toHaveBeenCalled();
    const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.CONTRACTS)[1];
    expect(saved[0].linkedContractId).toBe('NEW-C1');
    expect(saved[0].حالة_العقد).toBe('مجدد');
  });

  // 3. Expiry Scan
  test('runExpiryScanInternal - alerts for contracts expiring within threshold', () => {
    const nearExpiry = new Date();
    nearExpiry.setDate(nearExpiry.getDate() + 10);
    const iso = nearExpiry.toISOString().split('T')[0];

    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'C1', تاريخ_النهاية: iso, حالة_العقد: 'نشط', isArchived: false }];
      return [];
    });

    runtime.runExpiryScanInternal();
    expect(upsertAlert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ALR-EXP-C1',
      نوع_التنبيه: 'قرب انتهاء العقد'
    }));
  });

  // 4. Data Quality - Property
  test('runDataQualityScanInternal - alerts for properties missing utilities info', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1', الكود_الداخلي: 'P1', رقم_اشتراك_الكهرباء: '' }];
      if (key === KEYS.PEOPLE) return [];
      return [];
    });

    runtime.runDataQualityScanInternal();
    expect(upsertAlert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ALR-DQ-PROP-UTILS'
    }));
  });

  // 5. Risk Scan - Blacklist
  test('runRiskScanInternal - alerts if active tenant is in blacklist', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'C1', رقم_المستاجر: 'P1', حالة_العقد: 'نشط' }];
      if (key === KEYS.PEOPLE) return [{ رقم_الشخص: 'P1', الاسم: 'Bad Tenant' }];
      if (key === KEYS.PROPERTIES) return [];
      if (key === KEYS.INSTALLMENTS) return [];
      if (key === KEYS.BLACKLIST) return [{ personId: 'P1', isActive: true, severity: 'High', reason: 'Non-payment' }];
      return [];
    });

    runtime.runRiskScanInternal();
    expect(upsertAlert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ALR-RISK-BL-C1'
    }));
  });

  // 6. Risk Scan - Overdue
  test('runRiskScanInternal - alerts for overdue installments (> 14 days)', () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 20);
    const iso = longAgo.toISOString().split('T')[0];

    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'C1', حالة_العقد: 'نشط' }];
      if (key === KEYS.INSTALLMENTS) return [{ رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: iso, القيمة: 100, حالة_الكمبيالة: 'Unpaid' }];
      if (key === KEYS.PEOPLE) return [];
      if (key === KEYS.PROPERTIES) return [];
      if (key === KEYS.BLACKLIST) return [];
      return [];
    });

    runtime.runRiskScanInternal();
    expect(upsertAlert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ALR-RISK-OD-C1'
    }));
  });

  // 7. Maintenance Scan
  test('runMaintenanceScanInternal - alerts for maintenance tickets open > 5 days', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const iso = oldDate.toISOString().split('T')[0];

    (get as jest.Mock).mockReturnValue([{ رقم_التذكرة: 'M1', تاريخ_الطلب: iso, الحالة: 'مفتوح', الوصف: 'Leak' }]);

    runtime.runMaintenanceScanInternal();
    expect(upsertAlert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ALR-MNT-PENDING-M1'
    }));
  });

  // 8. Dedupe Alerts
  test('dedupeAndCleanupAlertsInternal - marks alerts as read if installments are paid', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.ALERTS) return [{ id: 'ALR-FIN-REM7-I1', تم_القراءة: false }];
      if (key === KEYS.INSTALLMENTS) return [{ رقم_الكمبيالة: 'I1', حالة_الكمبيالة: INSTALLMENT_STATUS.PAID }];
      return [];
    });

    runtime.dedupeAndCleanupAlertsInternal();
    const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.ALERTS)[1];
    expect(saved[0].تم_القراءة).toBe(true);
  });
});
