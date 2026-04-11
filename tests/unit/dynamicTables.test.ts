import { 
  createDynamicTable, 
  getDynamicTables, 
  addDynamicRecord, 
  getDynamicRecords 
} from '@/services/db/system/dynamic';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Dynamic Tables Service', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.DYNAMIC_TABLES, []);
    save(KEYS.DYNAMIC_RECORDS, []);
  });

  it('createDynamicTable: should add a new table definition', () => {
    const res = createDynamicTable('ExtraData');
    expect(res).toBeDefined();
    expect(res.title).toBe('ExtraData');
    expect(getDynamicTables()).toHaveLength(1);
  });

  it('addDynamicRecord: should store records for a custom table', () => {
    createDynamicTable('ExtraData', [{ name: 'Notes', type: 'text' }]);
    
    const res = addDynamicRecord('ExtraData', { Notes: 'Some info' });
    expect(res.success).toBe(true);
    
    const records = getDynamicRecords('ExtraData');
    expect(records).toHaveLength(1);
    expect(records[0].Notes).toBe('Some info');
  });
});
