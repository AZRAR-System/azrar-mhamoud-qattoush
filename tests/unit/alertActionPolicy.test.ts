import type { tbl_Alerts } from '@/types';
import {
  ALERT_TITLE_REMINDER_7D,
  ALERT_TITLE_RISK_COLLECTION,
  executeAlertOpen,
  getAlertPrimarySpec,
  isTasksFollowUpTitle,
  shouldOpenModalFirst,
} from '@/services/alerts/alertActionPolicy';

const base = (over: Partial<tbl_Alerts>): tbl_Alerts =>
  ({
    id: 't1',
    نوع_التنبيه: 'اختبار',
    الوصف: 'وصف',
    تاريخ_الانشاء: '2026-01-01',
    تم_القراءة: false,
    category: 'Financial',
    ...over,
  }) as tbl_Alerts;

describe('alertActionPolicy', () => {
  it('يفتح المودال أولاً للمالي وجودة البيانات', () => {
    expect(shouldOpenModalFirst(base({ category: 'Financial' }))).toBe(true);
    expect(shouldOpenModalFirst(base({ category: 'DataQuality' }))).toBe(true);
    expect(getAlertPrimarySpec(base({ category: 'Financial' })).mode).toBe('modal');
  });

  it('Expiry + عقد: زر مباشر للوجهة', () => {
    const a = base({
      category: 'Expiry',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_001',
    });
    expect(shouldOpenModalFirst(a)).toBe(false);
    expect(getAlertPrimarySpec(a)).toEqual(
      expect.objectContaining({ mode: 'destination', label: 'فتح العقد' })
    );
  });

  it('قرب انتهاء العقد / تجديد تلقائي: تسمية تفاصيل العقد', () => {
    const near = base({
      category: 'Expiry',
      نوع_التنبيه: 'قرب انتهاء العقد',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_001',
    });
    expect(getAlertPrimarySpec(near).label).toBe('تفاصيل العقد');
    const renew = base({
      category: 'Expiry',
      نوع_التنبيه: 'تجديد تلقائي قادم',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_002',
    });
    expect(getAlertPrimarySpec(renew).label).toBe('تفاصيل العقد');
  });

  it('تذكير 7 أيام / مخاطر تحصيل: لوحة السداد مباشرة', () => {
    const reminder = base({
      category: 'Financial',
      نوع_التنبيه: ALERT_TITLE_REMINDER_7D,
      مرجع_الجدول: 'الكمبيالات_tbl',
      مرجع_المعرف: '1',
    });
    expect(shouldOpenModalFirst(reminder)).toBe(false);
    expect(getAlertPrimarySpec(reminder).mode).toBe('destination');
    expect(getAlertPrimarySpec(reminder).label).toBe('لوحة السداد');

    const riskTitle = base({
      category: 'Risk',
      نوع_التنبيه: ALERT_TITLE_RISK_COLLECTION,
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_1',
      details: [{ id: '1', name: 'x', note: 'y' }],
    });
    expect(shouldOpenModalFirst(riskTitle)).toBe(false);
    expect(getAlertPrimarySpec(riskTitle).mode).toBe('destination');
  });

  it('Risk + عقود: مودال أولاً (جدول متأخرات) عندما العنوان ليس مخاطر تحصيل', () => {
    const a = base({
      category: 'Risk',
      نوع_التنبيه: 'مخاطر أخرى',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_001',
      details: [{ id: '1', name: 'x', note: 'y' }],
    });
    expect(shouldOpenModalFirst(a)).toBe(true);
  });

  it('Risk + شخص مفرد: وجهة مباشرة', () => {
    const a = base({
      category: 'Risk',
      مرجع_الجدول: 'الأشخاص_tbl',
      مرجع_المعرف: 'p1',
    });
    expect(getAlertPrimarySpec(a).mode).toBe('destination');
    expect(getAlertPrimarySpec(a).label).toContain('فتح');
  });

  it('executeAlertOpen يستدعي openPanel بالنوع المناسب', () => {
    const calls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      calls.push(args);
    };
    executeAlertOpen(
      base({
        category: 'Expiry',
        مرجع_الجدول: 'العقود_tbl',
        مرجع_المعرف: 'cot_x',
      }),
      openPanel as never
    );
    expect(calls[0]).toEqual(['CONTRACT_DETAILS', 'cot_x']);
  });

  it('executeAlertOpen: مخاطر تحصيل → تفاصيل الدفعات مع فلترة دين', () => {
    const calls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      calls.push(args);
    };
    executeAlertOpen(
      base({
        category: 'Risk',
        نوع_التنبيه: ALERT_TITLE_RISK_COLLECTION,
        مرجع_الجدول: 'العقود_tbl',
        مرجع_المعرف: 'c1',
      }),
      openPanel as never
    );
    expect(calls[0]).toEqual([
      'SECTION_VIEW',
      '/installments',
      {
        title: 'لوحة السداد الرئيسية',
        fromAlert: true,
        contractId: 'c1',
        installmentId: '',
        filter: 'debt',
        onlyTargetPanel: true,
        intentKey: expect.any(String),
      },
    ]);
    expect(String((calls[0][2] as Record<string, unknown>).intentKey)).toContain('alerts|');
  });

  it('executeAlertOpen: صيانة → قسم الصيانة وليس تفاصيل تذكرة', () => {
    const calls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      calls.push(args);
    };
    executeAlertOpen(
      base({
        category: 'System',
        مرجع_الجدول: 'تذاكر_الصيانة_tbl',
        مرجع_المعرف: 'tk1',
      }),
      openPanel as never
    );
    expect(calls[0][0]).toBe('SECTION_VIEW');
    expect(String(calls[0][1])).toContain('maintenance');
  });

  it('isTasksFollowUpTitle يتعرّف على عناوين المهام', () => {
    expect(isTasksFollowUpTitle('المهام')).toBe(true);
    expect(isTasksFollowUpTitle('')).toBe(false);
  });
});
