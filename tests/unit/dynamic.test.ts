import {
  getDynamicTables,
  createDynamicTable,
  getDynamicRecords,
  addDynamicRecord,
  addFieldToTable,
  getFormFields,
  addFormField,
  deleteFormField,
} from '@/services/db/system/dynamic';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('dynamic tables', () => {
  test('creates and retrieves table', () => {
    const t = createDynamicTable('جدول اختبار');
    expect(getDynamicTables().find(x => x.id === t.id)).toBeDefined();
    expect(t.title).toBe('جدول اختبار');
  });

  test('addFieldToTable - adds field to existing table', () => {
    const t = createDynamicTable('جدول');
    addFieldToTable(t.id, { name: 'حقل1', type: 'text', label: 'حقل 1' });
    const updated = getDynamicTables().find(x => x.id === t.id);
    expect(updated?.fields).toHaveLength(1);
  });

  test('addFieldToTable - noop for nonexistent table', () => {
    expect(() => addFieldToTable('MISSING', { name: 'x', type: 'text', label: 'x' })).not.toThrow();
  });
});

describe('dynamic records', () => {
  test('adds and retrieves record', () => {
    const t = createDynamicTable('جدول');
    addDynamicRecord({ tableId: t.id, data: { val: 1 } });
    expect(getDynamicRecords(t.id)).toHaveLength(1);
  });

  test('filters by tableId', () => {
    addDynamicRecord({ tableId: 'T1', data: {} });
    addDynamicRecord({ tableId: 'T2', data: {} });
    expect(getDynamicRecords('T1')).toHaveLength(1);
  });
});

describe('form fields', () => {
  test('adds and retrieves form field', () => {
    addFormField('form1', { name: 'field1', type: 'text', label: 'حقل' });
    expect(getFormFields('form1')).toHaveLength(1);
  });

  test('deletes form field', () => {
    addFormField('form2', { name: 'f', type: 'text', label: 'x' });
    const fields = getFormFields('form2');
    deleteFormField(fields[0].id);
    expect(getFormFields('form2')).toHaveLength(0);
  });
});
