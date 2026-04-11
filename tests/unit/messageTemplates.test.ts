import { jest } from '@jest/globals';
import { getTemplate, saveTemplate, addCustomTemplate, resetTemplate } from '@/services/db/messageTemplates';

describe('Message Templates Service - Fixed IDs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveTemplate: should override builtin template and resolve it correctly', () => {
    // ID from notificationTemplates.DEFAULT_TEMPLATES
    const templateId = 'pre_due_reminder';
    const newBody = 'Pay your rent now!';
    
    saveTemplate(templateId, newBody);
    expect(getTemplate(templateId)).toBe(newBody);
  });

  it('addCustomTemplate: should create a new template with unique ID', () => {
    const custom = addCustomTemplate({
      name: 'Custom Alert',
      category: 'reminder',
      body: 'Hello {{name}}'
    });

    expect(custom.id).toContain('custom_');
    expect(getTemplate(custom.id)).toBe('Hello {{name}}');
  });

  it('resetTemplate: should remove override and revert to builtin', () => {
    const templateId = 'pre_due_reminder';
    saveTemplate(templateId, 'Override');
    resetTemplate(templateId);
    
    // Should return non-empty builtin body
    expect(getTemplate(templateId)).not.toBe('Override');
    expect(getTemplate(templateId)).toContain('السلام عليكم'); // Known part of builtin
  });
});
