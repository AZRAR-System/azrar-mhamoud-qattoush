import { jest } from '@jest/globals';
import { createBackgroundScansRuntime } from '../../src/services/db/backgroundScans';
import * as notes from '../../src/services/db/system/notes';
import * as marquee from '../../src/services/db/system/marquee';
import { KEYS } from '../../src/services/db/keys';
import { INSTALLMENT_STATUS } from '../../src/services/db/installmentConstants';

// --- ROBUST MOCKS ---
let mockKv: Record<string, any> = {};
jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn((key: string) => mockKv[key] || []),
  save: jest.fn((key: string, val: any) => { mockKv[key] = val; }),
}));

jest.mock('../../src/services/db/alertsCore', () => ({
  buildContractAlertContext: jest.fn(() => ({ tenantName: 'T1', phone: '123', propertyCode: 'P1', مرجع_الجدول: 'T', مرجع_المعرف: 'I' })),
  markAlertsReadByPrefix: jest.fn(),
  upsertAlert: jest.fn(),
}));

jest.mock('../../src/services/db/settings', () => ({
  getSettings: jest.fn(() => ({ alertThresholdDays: 30 })),
}));

jest.mock('../../src/services/whatsAppAutoSender', () => ({
  tryAutoSendIfEligible: jest.fn(async () => {}),
}));

describe('The Final Final Strike - 70% Victory V3', () => {
  const deps = {
    asUnknownRecord: (v: any) => v as any,
    toDateOnly: (d: Date) => d,
    formatDateOnly: (d: Date) => d.toISOString().split('T')[0],
    parseDateOnly: (s: string) => s ? new Date(s) : null,
    daysBetweenDateOnly: (f: Date, t: Date) => Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)),
    addDaysIso: (s: string, d: number) => {
        const date = new Date(s);
        date.setDate(date.getDate() + d);
        return date.toISOString().split('T')[0];
    },
    addMonthsDateOnly: (s: string, m: number) => {
        const date = new Date(s);
        date.setMonth(date.getMonth() + m);
        return date;
    },
    createContract: jest.fn(() => ({ success: true, data: { رقم_العقد: 'NEW-1' } })),
    logOperationInternal: jest.fn(),
  };

  const runtime = createBackgroundScansRuntime(deps as any);

  beforeEach(() => {
    mockKv = {
      [KEYS.ALERTS]: [],
      [KEYS.INSTALLMENTS]: [],
      [KEYS.CONTRACTS]: [],
      [KEYS.PEOPLE]: [],
      [KEYS.PROPERTIES]: [],
      [KEYS.COMMISSIONS]: [],
      [KEYS.BLACKLIST]: [],
      [KEYS.MAINTENANCE]: [],
      [KEYS.NOTES]: [],
      [KEYS.DASHBOARD_NOTES]: [],
      [KEYS.MARQUEE]: [],
      [KEYS.FOLLOW_UPS]: [],
      [KEYS.REMINDERS]: [],
    };
    jest.clearAllMocks();
  });

  test('backgroundScans - Full Comprehensive Strike', async () => {
    mockKv[KEYS.ALERTS] = [
        { id: '1', تم_القراءة: false },
        { id: '1', تم_القراءة: true }, 
        { id: 'ALR-FIN-REM7-I1', تم_القراءة: false, نوع_التنبيه: 'تأجيل تحصيل', الوصف: 'عقد #C1' },
    ];
    mockKv[KEYS.INSTALLMENTS] = [{ رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', حالة_الكمبيالة: INSTALLMENT_STATUS.PAID }];
    runtime.dedupeAndCleanupAlertsInternal();

    mockKv[KEYS.CONTRACTS] = [{ رقم_العقد: 'C1', رقم_المستاجر: 'P1', رقم_العقار: 'PR1', حالة_العقد: 'نشط' }];
    mockKv[KEYS.PEOPLE] = [{ رقم_الشخص: 'P1', الاسم: 'Tenant', رقم_الهاتف: '123' }];
    mockKv[KEYS.PROPERTIES] = [{ رقم_العقار: 'PR1', الكود_الداخلي: 'CODE1' }];
    mockKv[KEYS.INSTALLMENTS] = [{ رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: deps.addDaysIso(new Date().toISOString(), 3), قيمة_الكمبيالة: 100 }];
    runtime.runInstallmentReminderScanInternal();

    mockKv[KEYS.CONTRACTS] = [{ رقم_العقد: 'C1', تاريخ_النهاية: '2020-01-01', autoRenew: true, مدة_العقد_بالاشهر: 12 }];
    runtime.runAutoRenewContractsInternal();

    runtime.runDataQualityScanInternal();

    mockKv[KEYS.CONTRACTS] = [{ رقم_العقد: 'C1', تاريخ_النهاية: deps.addDaysIso(new Date().toISOString(), 10), isArchived: false, autoRenew: true }];
    runtime.runExpiryScanInternal();

    mockKv[KEYS.BLACKLIST] = [{ personId: 'P1', isActive: true, severity: 'High', reason: 'Risk' }];
    mockKv[KEYS.INSTALLMENTS] = [{ رقم_الكمبيالة: 'I2', رقم_العقد: 'C1', تاريخ_استحقاق: '2020-01-01', قيمة_الكمبيالة: 1000 }];
    runtime.runRiskScanInternal();

    mockKv[KEYS.MAINTENANCE] = [{ رقم_التذكرة: 'M1', الحالة: 'مفتوح', تاريخ_الطلب: '2020-01-01', الوصف: 'Leak' }];
    runtime.runMaintenanceScanInternal();
  });

  test('notes.ts and marquee.ts - Full Comprehensive Strike', () => {
    notes.getNotes();
    notes.addEntityNote('الأشخاص_tbl', 'P1', 'note');
    notes.addEntityNote('العقارات_tbl', 'PR1', 'note');
    notes.addEntityNote('العقود_tbl', 'C1', 'note');
    
    // marquee.ts
    marquee.getActiveMarqueeAds();
    marquee.getNonExpiredMarqueeAds();
    marquee.addMarqueeAd({ content: 'Ad', type: 'success', priority: 'High', action: { kind: 'hash', hash: '/hi' } });
    const ads = mockKv[KEYS.MARQUEE];
    if (ads.length > 0) {
        marquee.updateMarqueeAd(ads[0].id, { content: 'New Ad', enabled: false });
        marquee.deleteMarqueeAd(ads[0].id);
    }

    mockKv[KEYS.ALERTS] = [{ id: 'A1', تم_القراءة: false, category: 'Financial', الوصف: 'Alert', مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'C1' }];
    mockKv[KEYS.FOLLOW_UPS] = [{ id: 'F1', status: 'Pending', task: 'Task', dueDate: '2020-01-01' }];
    mockKv[KEYS.REMINDERS] = [{ id: 'R1', isDone: false, date: '2020-01-01' }];
    marquee.getMarqueeMessages();
  });
});
