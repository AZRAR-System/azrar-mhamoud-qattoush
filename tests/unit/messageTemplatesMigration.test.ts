import { KEYS } from '@/services/db/keys';
import { getBuiltinNotificationTemplates } from '@/services/notificationTemplateDefaults';

describe('messageTemplates legacy migration', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
  });

  test('imports overrides from notification_templates once then removes legacy key', async () => {
    const legacy = [
      {
        id: 'pre_due_reminder',
        name: 'تذكير قبل الاستحقاق',
        category: 'reminder',
        title: '',
        body: 'نص مُرحَّل من المخزن القديم {{tenantName}}',
        enabled: true,
        createdAt: '',
        updatedAt: '',
        tags: [],
      },
    ];
    localStorage.setItem('notification_templates', JSON.stringify(legacy));

    const { getTemplate } = await import('@/services/db/messageTemplates');
    expect(getTemplate('pre_due_reminder')).toContain('نص مُرحَّل من المخزن القديم');

    expect(localStorage.getItem('notification_templates')).toBeNull();
    expect(localStorage.getItem('azrar_legacy_notification_templates_migrated_v1')).toBe('1');

    const raw = localStorage.getItem(KEYS.MESSAGE_TEMPLATES);
    expect(raw).toBeTruthy();
    const store = JSON.parse(String(raw));
    expect(store.overrides.pre_due_reminder).toContain('نص مُرحَّل');
  });

  test('migrated disabled builtin becomes disabledBuiltins in KV', async () => {
    const builtin = getBuiltinNotificationTemplates().find((t) => t.id === 'wa_payment_reminder');
    const body = String(builtin?.body || 'x');
    localStorage.setItem(
      'notification_templates',
      JSON.stringify([
        {
          id: 'wa_payment_reminder',
          name: 'wa',
          category: 'reminder',
          title: '',
          body,
          enabled: false,
          createdAt: '',
          updatedAt: '',
          tags: [],
        },
      ])
    );

    const { isTemplateEnabled } = await import('@/services/db/messageTemplates');
    expect(isTemplateEnabled('wa_payment_reminder')).toBe(false);
  });
});
