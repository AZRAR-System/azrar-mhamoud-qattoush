import { jest } from '@jest/globals';
import type { tbl_Alerts } from '@/types';
import { buildDefaultWhatsAppPrefillBody } from '@/services/alerts/alertActionPayloadBuild';
import { resolveWhatsAppBodyForAlert } from '@/services/alerts/resolveWhatsAppBodyForAlert';
import { NotificationTemplates } from '@/services/notificationTemplates';
import * as messageTemplatesDb from '@/services/db/messageTemplates';

const minimalAlert = (over: Partial<tbl_Alerts>): tbl_Alerts =>
  ({
    id: 'a1',
    نوع_التنبيه: 'تنبيه',
    الوصف: 'وصف تجريبي',
    تاريخ_الانشاء: '2026-01-01',
    تم_القراءة: false,
    category: 'Financial',
    tenantName: 'أحمد',
    propertyCode: 'P-1',
    ...over,
  }) as tbl_Alerts;

describe('resolveWhatsAppBodyForAlert', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('عند تعطيل قالب الإشعارات (enabled: false) يساوي buildDefaultWhatsAppPrefillBody لنفس التنبيه والمفتاح', () => {
    const a = minimalAlert({});
    const key = 'payment_reminder';
    const expected = buildDefaultWhatsAppPrefillBody(a, key);
    jest.spyOn(NotificationTemplates, 'getById').mockReturnValue({
      id: 'wa_payment_reminder',
      name: 'معطّل للاختبار',
      category: 'reminder',
      title: '',
      body: '',
      enabled: false,
      createdAt: '',
      updatedAt: '',
      tags: [],
    });
    expect(resolveWhatsAppBodyForAlert(a, key)).toStrictEqual(expected);
  });

  it('عند غياب نص القالب (فراغ من getTemplate) يساوي buildDefaultWhatsAppPrefillBody لنفس التنبيه والمفتاح', () => {
    const a = minimalAlert({ count: 2 });
    const key = 'renewal_offer';
    const expected = buildDefaultWhatsAppPrefillBody(a, key);
    jest.spyOn(messageTemplatesDb, 'getTemplate').mockReturnValue('');
    expect(resolveWhatsAppBodyForAlert(a, key)).toStrictEqual(expected);
  });

  it('يملأ القالب أو يقع على الاحتياطي مع بيانات التنبيه', () => {
    const a = minimalAlert({});
    const body = resolveWhatsAppBodyForAlert(a, 'payment_reminder');
    expect(body.length).toBeGreaterThan(15);
    expect(body).toMatch(/أحمد|وصف تجريبي|P-1/);
  });

  it('يتعامل مع مفتاح custom', () => {
    const a = minimalAlert({ category: 'System' });
    const body = resolveWhatsAppBodyForAlert(a, 'custom');
    expect(body.length).toBeGreaterThan(10);
  });
});
