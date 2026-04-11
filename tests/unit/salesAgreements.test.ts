import { jest } from '@jest/globals';
import { createSalesHandlers } from '@/services/db/system/sales_agreements';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Sales Agreements Service Logic - DI Fix', () => {
  let handlers: any;

  beforeEach(() => {
    localStorage.clear();
    save(KEYS.PROPERTIES, [
      { رقم_العقار: 'PR1', الكود_الداخلي: 'S-101', رقم_المالك: 'O1' }
    ]);
    save(KEYS.SALES_LISTINGS, [
      { id: 'L1', رقم_العقار: 'PR1', رقم_المالك: 'O1', الحالة: 'Active' }
    ]);

    const mockDeps = {
      logOperation: jest.fn(),
      getPersonRoles: jest.fn(() => ['Owner']),
      updatePersonRoles: jest.fn(),
      terminateContract: jest.fn(() => ({ success: true, data: null, message: '' })),
      upsertCommissionForSale: jest.fn(() => ({ success: true, data: {}, message: '' }))
    };

    handlers = createSalesHandlers(mockDeps as any);
  });

  it('addSalesAgreement: should save a new agreement', async () => {
    const agreement = {
      listingId: 'L1',
      رقم_المشتري: 'B1',
      رقم_العقار: 'PR1',
      رقم_البائع: 'O1',
      السعر_النهائي: 50000
    };

    const res = handlers.addSalesAgreement(agreement);
    expect(res.success).toBe(true);
    expect(res.data.listingId).toBe('L1');
  });

  it('updateSalesAgreement: should persist changes', async () => {
    save(KEYS.SALES_AGREEMENTS, [{ id: 'AG1', listingId: 'L1', السعر_النهائي: 40000 }]);
    
    const res = handlers.updateSalesAgreement('AG1', { السعر_النهائي: 45000 });
    expect(res.success).toBe(true);
    
    const all = JSON.parse(localStorage.getItem(KEYS.SALES_AGREEMENTS) || '[]');
    expect(all[0].السعر_النهائي).toBe(45000);
  });
});
