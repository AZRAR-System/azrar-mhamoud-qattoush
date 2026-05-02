import type { tbl_Alerts } from '@/types';
import {
  buildSettingsMessageTemplatesHref,
  buildSettingsMessageTemplatesHrefForWhatsApp,
  messageTemplateSourceGroupForListEntry,
  parseMessageTemplateSourceGroup,
  sourceGroupForWhatsAppTemplateKey,
  templateRowMatchesSourceGroup,
  templateSourceGroupForAlertClass,
} from '@/services/messageTemplateSourceGroups';

describe('messageTemplateSourceGroups', () => {
  test('parseMessageTemplateSourceGroup accepts known keys', () => {
    expect(parseMessageTemplateSourceGroup('collection')).toBe('collection');
    expect(parseMessageTemplateSourceGroup('')).toBeNull();
    expect(parseMessageTemplateSourceGroup('unknown')).toBeNull();
  });

  test('templateSourceGroupForAlertClass maps alert classes', () => {
    expect(templateSourceGroupForAlertClass('data_quality')).toBe('data_quality');
    expect(templateSourceGroupForAlertClass('collection_board')).toBe('collection');
    expect(templateSourceGroupForAlertClass('financial')).toBe('reminder');
    expect(templateSourceGroupForAlertClass('installment')).toBe('reminder');
    expect(templateSourceGroupForAlertClass('expiry')).toBe('renewal');
    expect(templateSourceGroupForAlertClass('risk')).toBe('legal');
    expect(templateSourceGroupForAlertClass('generic')).toBeNull();
  });

  test('buildSettingsMessageTemplatesHref builds query', () => {
    expect(buildSettingsMessageTemplatesHref({})).toContain('section=messages');
    expect(buildSettingsMessageTemplatesHref({ sourceGroup: 'renewal' })).toContain('msgGroup=renewal');
    expect(
      buildSettingsMessageTemplatesHref({ sourceGroup: 'reminder', templateId: 'pre_due_reminder' })
    ).toContain('template=pre_due_reminder');
  });

  test('sourceGroupForWhatsAppTemplateKey', () => {
    expect(sourceGroupForWhatsAppTemplateKey('payment_reminder')).toBe('reminder');
    expect(sourceGroupForWhatsAppTemplateKey('renewal_offer')).toBe('renewal');
    expect(sourceGroupForWhatsAppTemplateKey('legal_notice')).toBe('legal');
    expect(sourceGroupForWhatsAppTemplateKey('custom')).toBe('whatsapp_general');
  });

  test('buildSettingsMessageTemplatesHrefForWhatsApp includes template and group', () => {
    const alert = {
      id: 'a1',
      نوع_التنبيه: 'دفعة',
      الوصف: 'وصف',
      تاريخ_الانشاء: '2026-01-01',
      تم_القراءة: false,
      category: 'Financial',
      مرجع_الجدول: 'الكمبيالات_tbl',
    } as tbl_Alerts;
    const href = buildSettingsMessageTemplatesHrefForWhatsApp(alert, 'payment_reminder');
    expect(href).toContain('msgGroup=reminder');
    expect(href).toContain('template=wa_payment_reminder');
  });

  test('messageTemplateSourceGroupForListEntry resolves builtin id', () => {
    expect(
      messageTemplateSourceGroupForListEntry({
        id: 'wa_renewal_offer',
        category: 'reminder',
        isCustom: false,
      })
    ).toBe('renewal');
  });

  test('templateRowMatchesSourceGroup filters builtins and customs by category', () => {
    expect(
      templateRowMatchesSourceGroup(
        { id: 'collection_friendly_late_payment_fixed', category: 'late', isCustom: false },
        'collection'
      )
    ).toBe(true);
    expect(
      templateRowMatchesSourceGroup({ id: 'wa_renewal_offer', category: 'reminder', isCustom: false }, 'renewal')
    ).toBe(true);
    expect(
      templateRowMatchesSourceGroup({ id: 'custom_x', category: 'reminder', isCustom: true }, 'renewal')
    ).toBe(true);
    expect(
      templateRowMatchesSourceGroup({ id: 'custom_x', category: 'legal', isCustom: true }, 'renewal')
    ).toBe(false);
  });
});
