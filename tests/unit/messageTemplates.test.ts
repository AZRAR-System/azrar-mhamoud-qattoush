import { 
  getTemplate, 
  saveTemplate, 
  resetTemplate, 
  getAllTemplates, 
  addCustomTemplate 
} from '@/services/db/messageTemplates';
import { buildCache } from '@/services/dbCache';
import { KEYS } from '@/services/db/keys';

describe('Message Templates Service - Communication Customization Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('getTemplate - returns builtin template if no override', () => {
    const body = getTemplate('pre_due_reminder');
    expect(body).toContain('موعد استحقاق الدفعة');
  });

  test('saveTemplate - overrides builtin template', () => {
    saveTemplate('pre_due_reminder', 'New Custom Message');
    expect(getTemplate('pre_due_reminder')).toBe('New Custom Message');
  });

  test('resetTemplate - reverts to builtin', () => {
    saveTemplate('pre_due_reminder', 'Temporary');
    resetTemplate('pre_due_reminder');
    expect(getTemplate('pre_due_reminder')).toContain('موعد استحقاق الدفعة');
  });

  test('addCustomTemplate - adds and persists custom template', () => {
    const custom = addCustomTemplate({
      name: 'Welcome Msg',
      category: 'reminder',
      body: 'Welcome {{tenant_name}}'
    });
    
    expect(custom.id).toContain('custom_');
    expect(getTemplate(custom.id)).toBe('Welcome {{tenant_name}}');
  });

  test('getAllTemplates - lists both builtin and custom', () => {
    addCustomTemplate({ name: 'C1', category: 'reminder', body: 'B1' });
    const all = getAllTemplates();
    expect(all.length).toBeGreaterThan(1);
    expect(all.find(t => t.isCustom)).toBeDefined();
  });

  describe('saveTemplate — custom template', () => {
    test('updates existing custom template body', () => {
      const row = addCustomTemplate({ name: 'قالب مخصص', category: 'reminder', body: 'نص أصلي' });
      saveTemplate(row.id, 'نص معدل');
      expect(getTemplate(row.id)).toBe('نص معدل');
    });

    test('does nothing when custom id not found', () => {
      expect(() => saveTemplate('nonexistent_custom_id_xyz', 'نص')).not.toThrow();
    });
  });

  describe('resetTemplate — custom template', () => {
    test('removes custom template', () => {
      const row = addCustomTemplate({ name: 'للحذف', category: 'late', body: 'نص' });
      resetTemplate(row.id);
      const all = getAllTemplates();
      expect(all.find(t => t.id === row.id)).toBeUndefined();
    });
  });

  describe('loadStore — error handling', () => {
    test('returns empty store when localStorage throws', () => {
      const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage error');
      });
      expect(() => getTemplate('pre_due_reminder')).not.toThrow();
      spy.mockRestore();
    });
  });
});
