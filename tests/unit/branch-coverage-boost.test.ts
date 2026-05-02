/**
 * ملف مخصص لرفع تغطية الفروع (Branches)
 * في الملفات ذات التغطية المنخفضة.
 */

import { buildAlertTemplateContext } from '@/services/alerts/alertTemplateContext';
import { getTenancyStatusScore, isTenancyRelevant, isBetterTenancyContract, pickBestTenancyContract } from '@/utils/tenancy';
import {
  addNotificationSendLogInternal,
  updateNotificationSendLogInternal,
  deleteNotificationSendLogInternal,
} from '@/services/db/paymentNotifications';
import { getPropertyInspections, getInspection, getLatestInspectionForProperty, createInspectionHandlers } from '@/services/db/system/inspections';
import { createLegalHandlers, getLegalTemplates } from '@/services/db/system/legal';
import { getSettings } from '@/services/db/settings';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';
import type { tbl_Alerts } from '@/types';

// ============================================================
// 1. buildAlertTemplateContext — branches للقيم الفارغة / count
// ============================================================
describe('buildAlertTemplateContext', () => {
  const base: tbl_Alerts = {
    id: 'A1',
    نوع_التنبيه: 'test',
    الوصف: '',
    تاريخ_الانشاء: '',
    تم_القراءة: false,
    category: 'System',
  };

  it('يستخدم الافتراضي عند tenantName فارغ', () => {
    const ctx = buildAlertTemplateContext({ ...base, tenantName: '', propertyCode: 'P1' });
    expect(ctx.tenantName).toBe('المستأجر الكريم');
    expect(ctx['اسم_المستأجر']).toBe('المستأجر الكريم');
  });

  it('يستخدم الافتراضي عند tenantName undefined', () => {
    const ctx = buildAlertTemplateContext({ ...base });
    expect(ctx.tenantName).toBe('المستأجر الكريم');
  });

  it('يستخدم الافتراضي عند propertyCode فارغ', () => {
    const ctx = buildAlertTemplateContext({ ...base, tenantName: 'أحمد', propertyCode: '' });
    expect(ctx.propertyCode).toBe('—');
  });

  it('يستخدم count=1 عند count=null', () => {
    const ctx = buildAlertTemplateContext({ ...base, count: null as unknown as number });
    expect(ctx.count).toBe(1);
  });

  it('يستخدم count=1 عند count=0', () => {
    const ctx = buildAlertTemplateContext({ ...base, count: 0 });
    expect(ctx.count).toBe(1);
  });

  it('يستخدم count=1 عند count سالب', () => {
    const ctx = buildAlertTemplateContext({ ...base, count: -5 });
    expect(ctx.count).toBe(1);
  });

  it('يستخدم count صحيح عند count=3', () => {
    const ctx = buildAlertTemplateContext({ ...base, count: 3 });
    expect(ctx.count).toBe(3);
  });

  it('يعيد المتغيرات الصحيحة كاملة', () => {
    const ctx = buildAlertTemplateContext({ ...base, tenantName: 'سارة', propertyCode: 'A-01', الوصف: 'إشعار', count: 2 });
    expect(ctx.propertyCode).toBe('A-01');
    expect(ctx['الوصف']).toBe('إشعار');
  });
});

// ============================================================
// 2. tenancy — branches في isBetterTenancyContract (سطور 50-54)
// ============================================================
describe('tenancy', () => {
  const makeContract = (overrides: Partial<{ حالة_العقد: string; تاريخ_البداية: string; تاريخ_النهاية: string; رقم_العقد: string }>) =>
    ({ حالة_العقد: 'نشط', تاريخ_البداية: '2024-01-01', تاريخ_النهاية: '2025-01-01', رقم_العقد: 'C1', isArchived: false, ...overrides } as unknown as import('@/types').العقود_tbl);

  describe('isBetterTenancyContract', () => {
    it('يختار نفس الدرجة + التاريخ الأحدث', () => {
      const prev = makeContract({ تاريخ_البداية: '2023-01-01' });
      const next = makeContract({ تاريخ_البداية: '2024-06-01' });
      expect(isBetterTenancyContract(next, prev)).toBe(true);
    });

    it('يختار نفس الدرجة + نفس البداية + تاريخ نهاية أحدث', () => {
      const prev = makeContract({ تاريخ_النهاية: '2025-01-01' });
      const next = makeContract({ تاريخ_النهاية: '2026-01-01' });
      expect(isBetterTenancyContract(next, prev)).toBe(true);
    });

    it('يختار برقم عقد أكبر عند تساوي كل شيء', () => {
      const prev = makeContract({ رقم_العقد: 'C1' });
      const next = makeContract({ رقم_العقد: 'C2' });
      expect(isBetterTenancyContract(next, prev)).toBe(true);
    });

    it('لا يختار عند تاريخ نهاية أقدم', () => {
      const prev = makeContract({ تاريخ_النهاية: '2026-01-01' });
      const next = makeContract({ تاريخ_النهاية: '2024-01-01' });
      expect(isBetterTenancyContract(next, prev)).toBe(false);
    });
  });

  describe('pickBestTenancyContract', () => {
    it('يعيد undefined على قائمة فارغة', () => {
      expect(pickBestTenancyContract([])).toBeUndefined();
    });

    it('يتجاهل العقود غير ذات صلة', () => {
      const archived = makeContract({ isArchived: true } as never);
      expect(pickBestTenancyContract([archived])).toBeUndefined();
    });
  });

  describe('isTenancyRelevant', () => {
    it('يعيد false لـ null', () => expect(isTenancyRelevant(null)).toBe(false));
    it('يعيد false لعقد مؤرشف', () => expect(isTenancyRelevant({ حالة_العقد: 'نشط', isArchived: true })).toBe(false));
    it('يعيد false لعقد منتهي', () => expect(isTenancyRelevant({ حالة_العقد: 'منتهي' })).toBe(false));
    it('يعيد true ل renewed', () => expect(isTenancyRelevant({ حالة_العقد: 'مجدد' })).toBe(true));
    it('يعيد false لقيمة غير كائن', () => expect(isTenancyRelevant(42)).toBe(false));
  });

  describe('getTenancyStatusScore', () => {
    it('يعطي 3 لـ active بالإنجليزية', () => expect(getTenancyStatusScore('active')).toBe(3));
    it('يعطي 3 لـ فعال', () => expect(getTenancyStatusScore('فعال')).toBe(3));
    it('يعطي 1 لـ renewed', () => expect(getTenancyStatusScore('renewed')).toBe(1));
    it('يعطي 0 لقيمة غير معروفة', () => expect(getTenancyStatusScore('مجهول')).toBe(0));
    it('يعطي 0 لسلسلة فارغة', () => expect(getTenancyStatusScore('')).toBe(0));
  });
});

// ============================================================
// 3. settings — branches غير مغطاة (69, 76, 81)
// ============================================================
describe('settings', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  it('يعيد الافتراضيات عند غياب مدخل التخزين', () => {
    const s = getSettings();
    expect(s.inactivityTimeoutMinutes).toBe(15);
    expect(s.autoLockMinutes).toBe(30);
  });

  it('يعيد الافتراضي عند inactivityTimeoutMinutes غير محدود (سطر 69)', () => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ inactivityTimeoutMinutes: 'NaN_value' }));
    const s = getSettings();
    expect(s.inactivityTimeoutMinutes).toBe(15);
  });

  it('يعيد الافتراضي عند autoLockMinutes غير محدود (سطر 76)', () => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ autoLockMinutes: 'invalid' }));
    const s = getSettings();
    expect(s.autoLockMinutes).toBe(30);
  });

  it('يعيد الافتراضيات عند JSON تالف (سطر 81)', () => {
    localStorage.setItem(KEYS.SETTINGS, '{BROKEN_JSON}');
    const s = getSettings();
    expect(s.companyName).toBe('');
  });

  it('يطبّق تحديداً على inactivityTimeoutMinutes', () => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ inactivityTimeoutMinutes: 999 }));
    const s = getSettings();
    expect(s.inactivityTimeoutMinutes).toBe(240);
  });

  it('يعيد 0 لـ autoLockMinutes=0', () => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ autoLockMinutes: 0 }));
    const s = getSettings();
    expect(s.autoLockMinutes).toBe(0);
  });

  it('يتجاهل ولا يرمي عند JSON غير كائن', () => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify([1, 2, 3]));
    const s = getSettings();
    expect(s.companyName).toBe('');
  });
});

// ============================================================
// 4. inspections — branches غير مغطاة (15, 23, 51-64)
// ============================================================
describe('inspections', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  const deps = {
    logOperation: jest.fn(),
  };
  const { createInspection, updateInspection, deleteInspection } = createInspectionHandlers(deps);

  it('يعيد مصفوفة فارغة عند عقار غير موجود (15)', () => {
    expect(getPropertyInspections('nonexistent')).toEqual([]);
  });

  it('يعيد null من getLatestInspectionForProperty عند قائمة فارغة (23)', () => {
    expect(getLatestInspectionForProperty('nonexistent')).toBeNull();
  });

  it('يفشل createInspection بدون propertyId', () => {
    const r = createInspection({ inspectionDate: '2024-01-01', status: 'pending' } as never);
    expect(r.success).toBe(false);
  });

  it('يفشل createInspection بدون inspectionDate', () => {
    const r = createInspection({ propertyId: 'P1', status: 'pending' } as never);
    expect(r.success).toBe(false);
  });

  it('يفشل updateInspection لمعرّف غير موجود (51)', () => {
    const r = updateInspection('NONEXISTENT', { notes: 'تعديل' });
    expect(r.success).toBe(false);
  });

  it('ينجح deleteInspection عند معرّف غير موجود (null سليم)', () => {
    const r = deleteInspection('NONEXISTENT');
    expect(r.success).toBe(true);
  });

  it('دورة كاملة: إنشاء ثم تعديل ثم حذف', () => {
    const cr = createInspection({ propertyId: 'P1', inspectionDate: '2024-03-01', status: 'pending' } as never);
    expect(cr.success).toBe(true);
    const id = cr.data?.id as string;
    const ur = updateInspection(id, { notes: 'تم التحديث' });
    expect(ur.success).toBe(true);
    const dr = deleteInspection(id);
    expect(dr.success).toBe(true);
    expect(getInspection(id)).toBeNull();
  });
});

// ============================================================
// 5. paymentNotifications — branches update/delete (146, 152)
// ============================================================
describe('paymentNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  it('updateNotificationSendLogInternal يفشل لمعرّف غير موجود (146)', () => {
    const r = updateNotificationSendLogInternal('NONEXISTENT', { note: 'ملاحظة' });
    expect(r.success).toBe(false);
  });

  it('deleteNotificationSendLogInternal ينجح بصمت عند معرّف غير موجود (152)', () => {
    const r = deleteNotificationSendLogInternal('NONEXISTENT');
    expect(r.success).toBe(true);
  });

  it('دورة كاملة: إضافة ثم تحديث ثم حذف', () => {
    const log = addNotificationSendLogInternal({
      category: 'installment_reminder',
      tenantName: 'أحمد',
      sentAt: new Date().toISOString(),
    });
    const ur = updateNotificationSendLogInternal(log.id, { note: 'تم' });
    expect(ur.success).toBe(true);
    const dr = deleteNotificationSendLogInternal(log.id);
    expect(dr.success).toBe(true);
  });
});

// ============================================================
// 6. legal — branches غير مغطاة (44, 65-107)
// ============================================================
describe('legal', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  const deps = { logOperation: jest.fn() };
  const {
    addLegalTemplate, updateLegalTemplate,
    generateLegalNotice, saveLegalNoticeHistory, updateLegalNoticeHistory, deleteLegalNoticeHistory,
  } = createLegalHandlers(deps);

  it('updateLegalTemplate لا يرمي عند معرّف غير موجود (44)', () => {
    expect(() => updateLegalTemplate('NONEXISTENT', { title: 'لا يوجد' })).not.toThrow();
  });

  it('generateLegalNotice يعيد null عند قالب غير موجود', () => {
    expect(generateLegalNotice('NONEXISTENT_TMPL', 'C1')).toBeNull();
  });

  it('generateLegalNotice يعيد null عند عقد غير موجود', () => {
    addLegalTemplate({ title: 'اختبار', content: 'محتوى {{tenant_name}}', category: 'General' });
    const raw = localStorage.getItem(KEYS.LEGAL_TEMPLATES);
    expect(raw).toBeTruthy();
    const arr = JSON.parse(raw!) as Array<{ id: string }>;
    const id = arr[0]?.id;
    expect(getLegalTemplates()[0]?.id).toBe(id);
    expect(generateLegalNotice(id, 'NONEXISTENT_CONTRACT')).toBeNull();
  });

  it('دورة كاملة لسجل الإخطارات', () => {
    saveLegalNoticeHistory({ contractId: 'C1', templateTitle: 'تجربة', sentMethod: 'WhatsApp' });
    const raw = localStorage.getItem(KEYS.LEGAL_HISTORY);
    const arr = JSON.parse(raw!) as Array<{ id: string }>;
    const id = arr[0]?.id;
    updateLegalNoticeHistory(id, { reply: 'تم الرد' });
    const r = deleteLegalNoticeHistory(id);
    expect(r.success).toBe(true);
  });
});
