import { createLegalHandlers, getLegalTemplates, getLegalNoticeHistory } from '@/services/db/system/legal';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Legal System Service - Litigation Suite', () => {
  const mockDeps = {
    logOperation: jest.fn(),
  };

  const handlers = createLegalHandlers(mockDeps);

  beforeEach(() => {
    localStorage.clear();
    buildCache();
    jest.clearAllMocks();
  });

  describe('Template Management', () => {
    test('addLegalTemplate - persists new template', () => {
      handlers.addLegalTemplate({ title: 'Notice 1', content: 'Hello {{tenant_name}}', category: 'General' });
      const templates = getLegalTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].title).toBe('Notice 1');
    });

    test('updateLegalTemplate - modifies fields', () => {
      handlers.addLegalTemplate({ title: 'Old', category: 'General' });
      const id = getLegalTemplates()[0].id;
      handlers.updateLegalTemplate(id, { title: 'New' });
      expect(getLegalTemplates()[0].title).toBe('New');
    });

    test('deleteLegalTemplate - removes template', () => {
      handlers.addLegalTemplate({ title: 'Delete', category: 'General' });
      const id = getLegalTemplates()[0].id;
      handlers.deleteLegalTemplate(id);
      expect(getLegalTemplates()).toHaveLength(0);
    });
  });

  describe('Notice Generation', () => {
    test('generateLegalNotice - replaces placeholders correctly', () => {
      // 1. Setup template
      handlers.addLegalTemplate({ title: 'T1', content: 'Notice for {{tenant_name}} on unit {{property_code}}', category: 'General' });
      const tmplId = getLegalTemplates()[0].id;

      // 2. Setup entities
      kv.save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'Ahmed Tenant', رقم_الهاتف: '1' }]);
      kv.save(KEYS.PROPERTIES, [{ 
        رقم_العقار: 'PR1', 
        الكود_الداخلي: 'UNIT-101', 
        رقم_المالك: 'O1', 
        النوع: 'شقة', العنوان: 'A', حالة_العقار: 'شاغر', IsRented: false, المساحة: 10
      }]);
      kv.save(KEYS.CONTRACTS, [{ 
        رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'P1',
        تاريخ_البداية: '2025-01-01', تاريخ_النهاية: '2025-12-31',
        مدة_العقد_بالاشهر: 12, القيمة_السنوية: 1200, تكرار_الدفع: 1, طريقة_الدفع: 'نقدي', حالة_العقد: 'نشط', isArchived: false,
        lateFeeType: 'none', lateFeeValue: 0, lateFeeGraceDays: 0
      }] as any);
      
      buildCache();

      const text = handlers.generateLegalNotice(tmplId, 'C1');
      expect(text).toBe('Notice for Ahmed Tenant on unit UNIT-101');
    });

    test('generateLegalNotice - returns null if template or contract missing', () => {
      expect(handlers.generateLegalNotice('any', 'any')).toBeNull();
    });
  });

  describe('Notice History', () => {
    test('saveLegalNoticeHistory and update/delete', () => {
      handlers.saveLegalNoticeHistory({ contractId: 'C1', contentSnapshot: 'Sent' });
      const history = getLegalNoticeHistory();
      expect(history).toHaveLength(1);
      
      const id = history[0].id;
      handlers.updateLegalNoticeHistory(id, { contentSnapshot: 'Updated' });
      expect(getLegalNoticeHistory()[0].contentSnapshot).toBe('Updated');
      
      handlers.deleteLegalNoticeHistory(id);
      expect(getLegalNoticeHistory()).toHaveLength(0);
    });
  });
});
