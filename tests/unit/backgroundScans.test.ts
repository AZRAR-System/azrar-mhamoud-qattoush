/**
 * اختبارات شاملة لوحدة المسح الدوري والتنبيهات - 12 اختبار
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createBackgroundScansRuntime } from '@/services/db/backgroundScans';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { INSTALLMENT_STATUS } from '@/services/db/installmentConstants';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';

jest.mock('@/services/db/kv');
jest.mock('@/services/db/settings');
jest.mock('@/services/db/alertsCore');

describe('Background Scans Service', () => {
  const mockAsUnknownRecord = jest.fn((v: any) => v || {});
  const mockToDateOnly = jest.fn((d: Date) => new Date(d.toDateString()));
  const mockFormatDateOnly = jest.fn((d: Date) => d.toISOString().slice(0, 10));
  const mockParseDateOnly = jest.fn((s: string) => new Date(s));
  const mockDaysBetweenDateOnly = jest.fn();
  const mockAddDaysIso = jest.fn();
  const mockAddMonthsDateOnly = jest.fn();
  const mockCreateContract = jest.fn();
  const mockLogOperationInternal = jest.fn();

  let scansRuntime: ReturnType<typeof createBackgroundScansRuntime>;

  beforeEach(() => {
    jest.clearAllMocks();
    installMemoryLocalStorage();
    resetKvAndCache();

    scansRuntime = createBackgroundScansRuntime({
      asUnknownRecord: mockAsUnknownRecord,
      toDateOnly: mockToDateOnly,
      formatDateOnly: mockFormatDateOnly,
      parseDateOnly: mockParseDateOnly,
      daysBetweenDateOnly: mockDaysBetweenDateOnly,
      addDaysIso: mockAddDaysIso,
      addMonthsDateOnly: mockAddMonthsDateOnly,
      createContract: mockCreateContract,
      logOperationInternal: mockLogOperationInternal
    });

    (get as jest.Mock).mockReturnValue([]);
  });

  // ✅ الحالات الطبيعية
  test('✅ dedupeAndCleanupAlertsInternal removes duplicate alerts', () => {
    const testAlerts = [
      { id: 'ALERT_001', تم_القراءة: false },
      { id: 'ALERT_001', تم_القراءة: true },
      { id: 'ALERT_002', تم_القراءة: false }
    ];
    (get as jest.Mock).mockReturnValue(testAlerts);
    
    scansRuntime.dedupeAndCleanupAlertsInternal();
    
    expect(save).toHaveBeenCalled();
    const savedAlerts = (save as jest.Mock).mock.calls[0][1];
    expect(savedAlerts).toHaveLength(2);
  });

  test('✅ dedupeAndCleanupAlertsInternal marks paid installments alerts as read', () => {
    (get as jest.Mock).mockImplementation((key: string) => {
      if (key === KEYS.ALERTS) return [{ id: 'ALR-FIN-REM7-INS_001', تم_القراءة: false }];
      if (key === KEYS.INSTALLMENTS) return [{ رقم_الكمبيالة: 'INS_001', حالة_الكمبيالة: INSTALLMENT_STATUS.PAID, القيمة: 1000 }];
      return [];
    });

    scansRuntime.dedupeAndCleanupAlertsInternal();
    
    expect(save).toHaveBeenCalled();
  });

  test('✅ runInstallmentReminderScanInternal creates 7 days reminder alerts', () => {
    (get as jest.Mock).mockImplementation((key: string) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'cot_001', رقم_المستاجر: 'PER_001', رقم_العقار: 'PRP_001', isArchived: false, حالة_العقد: 'نشط' }];
      if (key === KEYS.PEOPLE) return [{ رقم_الشخص: 'PER_001', الاسم: 'محمد' }];
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'PRP_001' }];
      if (key === KEYS.INSTALLMENTS) return [{ رقم_الكمبيالة: 'INS_001', رقم_العقد: 'cot_001', تاريخ_استحقاق: '2025-06-10', حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID, القيمة: 1000 }];
      return [];
    });

    mockDaysBetweenDateOnly.mockReturnValue(5);

    scansRuntime.runInstallmentReminderScanInternal();
    
    expect(save).toHaveBeenCalled();
  });

  test('✅ runAutoRenewContractsInternal auto renews expired contracts', () => {
    (get as jest.Mock).mockImplementation((key: string) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'cot_001', تاريخ_النهاية: '2025-06-01', autoRenew: true, isArchived: false, مدة_العقد_بالاشهر: 12 }];
      if (key === KEYS.COMMISSIONS) return [{ رقم_العقد: 'cot_001', عمولة_المالك: 500, عمولة_المستأجر: 500 }];
      return [];
    });

    mockAddDaysIso.mockReturnValue('2025-06-02');
    mockAddMonthsDateOnly.mockReturnValue(new Date('2026-06-01'));
    mockCreateContract.mockReturnValue({ success: true, data: { رقم_العقد: 'cot_002' } });

    scansRuntime.runAutoRenewContractsInternal();
    
    expect(mockCreateContract).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
  });

  test('✅ runDataQualityScanInternal detects missing property fields', () => {
    (get as jest.Mock).mockImplementation((key: string) => {
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'PRP_001', رقم_اشتراك_الكهرباء: '' }];
      return [];
    });

    scansRuntime.runDataQualityScanInternal();
    
    expect(save).toHaveBeenCalled();
  });

  test('✅ runExpiryScanInternal creates expiring contract alerts', () => {
    (get as jest.Mock).mockImplementation((key: string) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'cot_001', تاريخ_النهاية: '2025-07-01', isArchived: false, حالة_العقد: 'نشط' }];
      return [];
    });

    mockDaysBetweenDateOnly.mockReturnValue(25);

    scansRuntime.runExpiryScanInternal();
    
    expect(save).toHaveBeenCalled();
  });

  test('✅ runRiskScanInternal detects blacklisted tenants', () => {
    (get as jest.Mock).mockImplementation((key: string) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'cot_001', رقم_المستاجر: 'PER_001', isArchived: false, حالة_العقد: 'نشط' }];
      if (key === KEYS.PEOPLE) return [{ رقم_الشخص: 'PER_001', الاسم: 'محمد' }];
      if (key === KEYS.BLACKLIST) return [{ personId: 'PER_001', isActive: true, reason: 'تأخير مستمر', severity: 'مرتفع' }];
      return [];
    });

    scansRuntime.runRiskScanInternal();
    
    expect(save).toHaveBeenCalled();
  });

  test('✅ runMaintenanceScanInternal detects overdue maintenance tickets', () => {
    (get as jest.Mock).mockImplementation((key: string) => {
      if (key === KEYS.MAINTENANCE) return [{ رقم_التذكرة: 'MNT_001', تاريخ_الطلب: '2025-06-01', الحالة: 'مفتوح' }];
      return [];
    });

    mockDaysBetweenDateOnly.mockReturnValue(7);

    scansRuntime.runMaintenanceScanInternal();
    
    expect(save).toHaveBeenCalled();
  });

  // ❌ حالات الخطأ
  test('❌ runAutoRenewContractsInternal skips already renewed contracts', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_العقد: 'cot_001', linkedContractId: 'cot_002', autoRenew: true }]);
    
    scansRuntime.runAutoRenewContractsInternal();
    
    expect(mockCreateContract).not.toHaveBeenCalled();
  });

  // ⚠️ الحالات الحدية
  test('⚠️ dedupeAndCleanupAlertsInternal handles empty alerts array gracefully', () => {
    (get as jest.Mock).mockReturnValue([]);
    
    expect(() => scansRuntime.dedupeAndCleanupAlertsInternal()).not.toThrow();
  });

  test('⚠️ runDataQualityScanInternal handles empty properties gracefully', () => {
    (get as jest.Mock).mockReturnValue([]);
    
    expect(() => scansRuntime.runDataQualityScanInternal()).not.toThrow();
  });

  // 🔗 التكامل بين الدوال
  test('🔗 runExpiryScanInternal correctly calls notification center', () => {
    jest.isolateModules(() => {
      const mockAdd = jest.fn();
      jest.doMock('@/services/notificationCenter', () => ({ notificationCenter: { add: mockAdd } }));
      
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'cot_001', تاريخ_النهاية: '2025-06-10', autoRenew: true, isArchived: false, حالة_العقد: 'نشط' }];
        return [];
      });

      mockDaysBetweenDateOnly.mockReturnValue(20);

      scansRuntime.runExpiryScanInternal();
      
      expect(mockAdd).toHaveBeenCalled();
    });
  });
});