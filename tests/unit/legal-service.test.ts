import { createLegalHandlers, getLegalTemplates, getLegalNoticeHistory } from '@/services/db/system/legal';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

const mockDeps = {
  logOperation: jest.fn(),
};

const { 
  addLegalTemplate, 
  updateLegalTemplate, 
  deleteLegalTemplate, 
  generateLegalNotice, 
  saveLegalNoticeHistory, 
  updateLegalNoticeHistory, 
  deleteLegalNoticeHistory 
} = createLegalHandlers(mockDeps);

beforeEach(() => {
  localStorage.clear();
  buildCache();
  jest.clearAllMocks();
});

const makeTmpl = (id: string) => ({
  id,
  title: 'Test Template',
  category: 'Warning' as const,
  content: 'Contract {{contract_id}} for {{tenant_name}} has overdue {{overdue_amount_total}}',
});

const fullContract = (id: string) => ({ 
  رقم_العقد: id, 
  رقم_العقار: 'PR-1', 
  رقم_المستاجر: 'PER-1',
  تاريخ_البداية: '2026-01-01',
  تاريخ_النهاية: '2026-12-31',
  مدة_العقد_بالاشهر: 12,
  القيمة_السنوية: 4800,
  تكرار_الدفع: 1,
  طريقة_الدفع: 'نقدي',
  حالة_العقد: 'نشط',
  isArchived: false,
  lateFeeType: 'none',
  lateFeeValue: 0,
  lateFeeGraceDays: 0
});

describe('Legal Templates', () => {
  test('addLegalTemplate', () => {
    addLegalTemplate({ title: 'New', content: 'Text' });
    expect(getLegalTemplates()).toHaveLength(1);
    expect(getLegalTemplates()[0].title).toBe('New');
  });

  test('updateLegalTemplate', () => {
    kv.save(KEYS.LEGAL_TEMPLATES, [makeTmpl('L1')]);
    buildCache();
    updateLegalTemplate('L1', { title: 'Updated' });
    expect(getLegalTemplates()[0].title).toBe('Updated');
  });

  test('deleteLegalTemplate', () => {
    kv.save(KEYS.LEGAL_TEMPLATES, [makeTmpl('L1')]);
    buildCache();
    deleteLegalTemplate('L1');
    expect(getLegalTemplates()).toHaveLength(0);
  });
});

describe('generateLegalNotice', () => {
  test('returns null if template or contract missing', () => {
    expect(generateLegalNotice('MISSING', 'C1')).toBeNull();
  });

  test('generates notice with replacements', () => {
    kv.save(KEYS.LEGAL_TEMPLATES, [makeTmpl('L1')]);
    kv.save(KEYS.CONTRACTS, [fullContract('C1')]);
    kv.save(KEYS.PEOPLE, [
      { رقم_الشخص: 'PER-1', الاسم: 'John Doe', رقم_الهاتف: '123' },
      { رقم_الشخص: 'OWN-1', الاسم: 'Owner Name', رقم_الهاتف: '456' }
    ]);
    kv.save(KEYS.PROPERTIES, [{
      رقم_العقار: 'PR-1',
      الكود_الداخلي: 'PROP-X',
      رقم_المالك: 'OWN-1',
      النوع: 'شقة', العنوان: 'عمان', حالة_العقار: 'مؤجر', IsRented: true, المساحة: 100
    }]);
    kv.save(KEYS.INSTALLMENTS, [
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', القيمة: 500, تاريخ_استحقاق: '2026-01-01', حالة_الكمبيالة: 'غير مدفوع', نوع_الكمبيالة: 'دورية' }
    ]);
    buildCache();

    const notice = generateLegalNotice('L1', 'C1');
    expect(notice).toContain('Contract C1');
    expect(notice).toContain('John Doe');
    expect(notice).toContain('500');
  });
});

describe('Legal History', () => {
  test('save, update, delete history', () => {
    saveLegalNoticeHistory({ contractId: 'C1', contentSnapshot: 'Snap' });
    let history = getLegalNoticeHistory();
    expect(history).toHaveLength(1);
    const id = history[0].id;

    updateLegalNoticeHistory(id, { note: 'Updated Note' });
    expect(getLegalNoticeHistory()[0].note).toBe('Updated Note');

    deleteLegalNoticeHistory(id);
    expect(getLegalNoticeHistory()).toHaveLength(0);
  });
});
