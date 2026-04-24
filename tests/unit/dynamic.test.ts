import { 
  createDynamicTable, 
  getDynamicTables, 
  addFieldToTable,
  addDynamicRecord,
  getDynamicRecords,
  addFormField,
  getFormFields,
  deleteFormField
} from '@/services/db/system/dynamic';
import { buildCache } from '@/services/dbCache';

describe('Dynamic Fields Service - Customization Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('Dynamic Tables - create and add fields', () => {
    const table = createDynamicTable('Extra Info');
    expect(table.title).toBe('Extra Info');
    
    addFieldToTable(table.id, { name: 'Field 1', type: 'text', label: 'L1' });
    const updated = getDynamicTables().find(t => t.id === table.id);
    expect(updated?.fields).toHaveLength(1);
    expect(updated?.fields[0].name).toBe('Field 1');
  });

  test('Dynamic Records - add and retrieve', () => {
    addDynamicRecord({ tableId: 'DT-1', data: { f1: 'v1' } });
    const records = getDynamicRecords('DT-1');
    expect(records).toHaveLength(1);
    expect((records[0].data as any).f1).toBe('v1');
  });

  test('Form Fields - CRUD', () => {
    addFormField('F1', { label: 'Name', type: 'text' });
    const fields = getFormFields('F1');
    expect(fields).toHaveLength(1);
    
    const id = fields[0].id;
    deleteFormField(id);
    expect(getFormFields('F1')).toHaveLength(0);
  });
});
