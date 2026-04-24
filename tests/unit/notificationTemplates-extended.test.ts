import {
  NotificationTemplates,
  fillTemplate,
  fillTemplateComplete,
  getWhatsAppLink,
} from '@/services/notificationTemplates';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
  NotificationTemplates.reset();
});

describe('fillTemplate', () => {
  test('returns placeholder when value is undefined', () => {
    const r = fillTemplate('Hello {{missing}}', {});
    expect(r).toBe('Hello {{missing}}');
  });

  test('returns placeholder when value is null', () => {
    const r = fillTemplate('Val: {{nullKey}}', { nullKey: null as any });
    expect(r).toBe('Val: {{nullKey}}');
  });

  test('formats number with English digits', () => {
    const r = fillTemplate('Amount: {{amount}}', { amount: 1500 });
    expect(r).toContain('1,500');
  });

  test('converts other types to string', () => {
    const r = fillTemplate('Code: {{code}}', { code: 'ABC-123' });
    expect(r).toBe('Code: ABC-123');
  });

  test('accepts string as template', () => {
    const r = fillTemplate('Hi {{tenantName}}', { tenantName: 'Ali' });
    expect(r).toBe('Hi Ali');
  });

  test('accepts NotificationTemplate object', () => {
    const t = NotificationTemplates.getById('pre_due_reminder')!;
    const r = fillTemplate(t, { tenantName: 'Sara' });
    expect(r).toContain('Sara');
  });

  test('handles Arabic placeholder keys', () => {
    const r = fillTemplate('السلام {{اسم_المستأجر}}', { اسم_المستأجر: 'محمد' });
    expect(r).toBe('السلام محمد');
  });
});

describe('fillTemplateComplete', () => {
  test('fills both title and body', () => {
    const t = NotificationTemplates.getById('pre_due_reminder')!;
    const r = fillTemplateComplete(t, { tenantName: 'Omar', amount: 500, dueDate: '2026-05-01' });
    expect(r.title).toBeTruthy();
    expect(r.body).toContain('Omar');
    expect(r.category).toBe('reminder');
    expect(r.enabled).toBe(true);
  });
});

describe('NotificationTemplates.getByCategory', () => {
  test('returns only enabled templates in category', () => {
    const reminders = NotificationTemplates.getByCategory('reminder');
    expect(reminders.every(t => t.enabled)).toBe(true);
    expect(reminders.every(t => t.category === 'reminder')).toBe(true);
  });

  test('disabled template excluded from results', () => {
    const all = NotificationTemplates.getAll();
    const first = all.find(t => t.category === 'reminder');
    if (first) {
      NotificationTemplates.toggleEnabled(first.id);
      const results = NotificationTemplates.getByCategory('reminder');
      expect(results.find(t => t.id === first.id)).toBeUndefined();
    }
  });
});

describe('NotificationTemplates.update', () => {
  test('returns undefined when id not found', () => {
    const r = NotificationTemplates.update('NONEXISTENT', { body: 'new' });
    expect(r).toBeUndefined();
  });

  test('updates existing template', () => {
    const r = NotificationTemplates.update('pre_due_reminder', { body: 'updated body' });
    expect(r?.body).toBe('updated body');
  });
});

describe('NotificationTemplates.delete', () => {
  test('returns false when id not found', () => {
    const r = NotificationTemplates.delete('NONEXISTENT');
    expect(r).toBe(false);
  });

  test('deletes existing template and returns true', () => {
    NotificationTemplates.add({
      id: 'temp_delete',
      name: 'Temp',
      category: 'reminder',
      title: 'T',
      body: 'B',
      enabled: true,
      tags: [],
    });
    const r = NotificationTemplates.delete('temp_delete');
    expect(r).toBe(true);
    expect(NotificationTemplates.getById('temp_delete')).toBeUndefined();
  });
});

describe('NotificationTemplates.toggleEnabled', () => {
  test('returns undefined for nonexistent id', () => {
    const r = NotificationTemplates.toggleEnabled('NONEXISTENT');
    expect(r).toBeUndefined();
  });

  test('toggles enabled state', () => {
    const before = NotificationTemplates.getById('pre_due_reminder')!;
    const wasEnabled = before.enabled;
    NotificationTemplates.toggleEnabled('pre_due_reminder');
    const after = NotificationTemplates.getById('pre_due_reminder')!;
    expect(after.enabled).toBe(!wasEnabled);
  });
});

describe('getWhatsAppLink', () => {
  test('returns link with phone number', () => {
    const r = getWhatsAppLink('hello', '962791234567');
    expect(r).toContain('962791234567');
  });

  test('returns empty for empty phone', () => {
    const r = getWhatsAppLink('hello', '');
    expect(r).toBe('');
  });
});
