import { 
  NotificationTemplates, 
  fillTemplate, 
  fillTemplateComplete,
  getBuiltinNotificationTemplates
} from '@/services/notificationTemplates';
import { buildCache } from '@/services/dbCache';

describe('Notification Templates Service - Message Formatting Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('fillTemplate - replaces placeholders with context values', () => {
    const text = 'Hello {{tenantName}}, your balance is {{amount}}';
    const ctx = { tenantName: 'Ahmed', amount: 500 };
    const filled = fillTemplate(text, ctx);
    expect(filled).toBe('Hello Ahmed, your balance is 500');
  });

  test('fillTemplate - leaves missing placeholders as is', () => {
    const text = 'Hello {{missing}}';
    expect(fillTemplate(text, {})).toBe('Hello {{missing}}');
  });

  test('NotificationTemplates.getAll - returns combined templates', () => {
    const all = NotificationTemplates.getAll();
    expect(all.length).toBeGreaterThan(0);
    expect(all.some(t => t.id === 'pre_due_reminder')).toBe(true);
  });

  test('NotificationTemplates.add and getById', () => {
    const t = NotificationTemplates.add({
      id: 'custom_1',
      name: 'Custom',
      category: 'reminder',
      title: 'T',
      body: 'B',
      enabled: true,
      tags: []
    });
    
    expect(NotificationTemplates.getById('custom_1')).toBeDefined();
    expect(t.createdAt).toBeDefined();
  });

  test('fillTemplateComplete - fills both title and body', () => {
    const t = NotificationTemplates.getById('pre_due_reminder')!;
    const ctx = { tenantName: 'Ali', amount: 100, dueDate: '2025-01-01' };
    const res = fillTemplateComplete(t, ctx);
    
    expect(res.body).toContain('Ali');
    expect(res.body).toContain('100');
  });

  test('reset - clears modifications and reverts to defaults', () => {
    NotificationTemplates.update('pre_due_reminder', { body: 'MODIFIED' });
    expect(NotificationTemplates.getById('pre_due_reminder')?.body).toBe('MODIFIED');
    
    NotificationTemplates.reset();
    expect(NotificationTemplates.getById('pre_due_reminder')?.body).not.toBe('MODIFIED');
  });
});
