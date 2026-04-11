import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  getTemplate, 
  saveTemplate, 
  resetTemplate, 
  addCustomTemplate, 
  getAllTemplates 
} from '@/services/db/messageTemplates';
import { KEYS } from '@/services/db/keys';

describe('Message Templates Service', () => {
  beforeEach(() => {
    localStorage.clear();
    // Prevent event dispatch errors in node
    global.window = { dispatchEvent: jest.fn() } as any;
  });

  it('should return built-in template as default', () => {
    // Using a valid built-in id
    const t = getTemplate('pre_due_reminder'); 
    expect(t).toBeDefined();
    expect(t).toContain('tenantName');
  });

  it('should allow overriding a built-in template', () => {
    saveTemplate('pre_due_reminder', 'My Custom Body');
    expect(getTemplate('pre_due_reminder')).toBe('My Custom Body');
  });

  it('should allow resetting an overridden template', () => {
    saveTemplate('pre_due_reminder', 'Overridden');
    resetTemplate('pre_due_reminder');
    const t = getTemplate('pre_due_reminder');
    expect(t).not.toBe('Overridden');
    expect(t).toContain('tenantName');
  });

  it('should add and retrieve custom templates', () => {
    const custom = addCustomTemplate({
      name: 'New Template',
      category: 'General',
      body: 'Hello User',
    });

    expect(custom.id).toMatch(/^custom_/);
    expect(getTemplate(custom.id)).toBe('Hello User');
    
    const all = getAllTemplates();
    expect(all.some(t => t.id === custom.id && t.isCustom)).toBe(true);
  });

  it('should delete custom template on reset', () => {
    const custom = addCustomTemplate({
      name: 'Temp',
      category: 'General',
      body: 'Content',
    });
    
    resetTemplate(custom.id);
    expect(getTemplate(custom.id)).toBe('');
  });
});
