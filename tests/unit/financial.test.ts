import { 
  upsertCommissionForSale, 
  updateCommission,
  getCommissions 
} from '@/services/db/financial';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Financial Service - Sales & Recalcs', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.COMMISSIONS, []);
  });

  it('upsertCommissionForSale: should create sale record and sync legacy fields', () => {
    upsertCommissionForSale('A1', {
      sellerComm: 1000,
      buyerComm: 500,
      listingComm: 200,
      date: '2024-10-10'
    });

    const comms = getCommissions();
    expect(comms).toHaveLength(1);
    expect(comms[0].نوع_العمولة).toBe('Sale');
    expect(comms[0].المجموع).toBe(1700);
    // Legacy sync check
    expect(comms[0].عمولة_المالك).toBe(1000);
  });

  it('updateCommission: should handle various commission types', () => {
    save(KEYS.COMMISSIONS, [{
      رقم_العمولة: 'C1',
      نوع_العمولة: 'Rent',
      عمولة_المالك: 100,
      عمولة_المستأجر: 50
    }]);

    const res = updateCommission('C1', { عمولة_المالك: 200 });
    expect(res.data?.المجموع).toBe(250);
  });
});
