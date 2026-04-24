import { getExternalCommissions, createExternalCommHandlers } from '@/services/db/externalCommissions';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

const logOperation = jest.fn();
const { addExternalCommission, updateExternalCommission, deleteExternalCommission } =
  createExternalCommHandlers({ logOperation });

beforeEach(() => {
  localStorage.clear();
  buildCache();
  jest.clearAllMocks();
});

describe('getExternalCommissions', () => {
  test('returns empty array initially', () => {
    expect(getExternalCommissions()).toEqual([]);
  });
});

describe('addExternalCommission', () => {
  test('adds commission and logs operation', () => {
    const r = addExternalCommission({ العنوان: 'عمولة 1', النوع: 'وساطة', القيمة: 500, التاريخ: '2026-01-01' });
    expect(r.success).toBe(true);
    expect(getExternalCommissions()).toHaveLength(1);
    expect(logOperation).toHaveBeenCalledWith('Admin', 'إضافة', 'ExternalCommissions', expect.any(String), 'إضافة عمولة خارجية');
  });
});

describe('updateExternalCommission', () => {
  test('fails when id not found', () => {
    const r = updateExternalCommission('MISSING', { القيمة: 999 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('غير موجودة');
  });

  test('updates existing commission', () => {
    kv.save(KEYS.EXTERNAL_COMMISSIONS, [{ id: 'EXT-1', العنوان: 'قديم', النوع: 'وساطة', القيمة: 100, التاريخ: '2026-01-01' }]);
    buildCache();
    const r = updateExternalCommission('EXT-1', { القيمة: 200 });
    expect(r.success).toBe(true);
    expect(getExternalCommissions()[0].القيمة).toBe(200);
    expect(logOperation).toHaveBeenCalledWith('Admin', 'تعديل', 'ExternalCommissions', 'EXT-1', 'تعديل عمولة خارجية');
  });
});

describe('deleteExternalCommission', () => {
  test('deletes commission', () => {
    kv.save(KEYS.EXTERNAL_COMMISSIONS, [{ id: 'EXT-1', العنوان: 'x', النوع: 'وساطة', القيمة: 100, التاريخ: '2026-01-01' }]);
    buildCache();
    const r = deleteExternalCommission('EXT-1');
    expect(r.success).toBe(true);
    expect(getExternalCommissions()).toHaveLength(0);
    expect(logOperation).toHaveBeenCalledWith('Admin', 'حذف', 'ExternalCommissions', 'EXT-1', 'حذف عمولة خارجية');
  });

  test('noop when id not found', () => {
    kv.save(KEYS.EXTERNAL_COMMISSIONS, [{ id: 'EXT-1', العنوان: 'x', النوع: 'وساطة', القيمة: 100, التاريخ: '2026-01-01' }]);
    buildCache();
    deleteExternalCommission('MISSING');
    expect(getExternalCommissions()).toHaveLength(1);
  });
});
