import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { 
  updateCommission, 
  upsertCommissionForContract, 
  upsertCommissionForSale, 
  getCommissions 
} from '@/services/db/financial';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';
import { العقود_tbl } from '@/types';

beforeAll(() => {
  installMemoryLocalStorage();
});

beforeEach(() => {
  resetKvAndCache();
  save(KEYS.COMMISSIONS, []);
  save(KEYS.CONTRACTS, []);
});

describe('Financial Service (financial.ts)', () => {

  describe('updateCommission', () => {
    it('should recalculate total (المجموع) when عمولة_المالك is updated (Rental)', () => {
      const initial = {
        رقم_العمولة: 'COM-1',
        رقم_العقد: 'C-1',
        نوع_العمولة: 'Rent',
        عمولة_المالك: 100,
        عمولة_المستأجر: 50,
        المجموع: 150,
      } as any;
      save(KEYS.COMMISSIONS, [initial]);

      const res = updateCommission('COM-1', { عمولة_المالك: 200 });
      
      expect(res.success).toBe(true);
      expect(res.data?.عمولة_المالك).toBe(200);
      expect(res.data?.المجموع).toBe(250); // 200 + 50
    });

    it('should recalculate total (المجموع) when عمولة_المستأجر is updated (Rental)', () => {
      const initial = {
        رقم_العمولة: 'COM-1',
        رقم_العقد: 'C-1',
        نوع_العمولة: 'Rent',
        عمولة_المالك: 100,
        عمولة_المستأجر: 50,
        المجموع: 150,
      } as any;
      save(KEYS.COMMISSIONS, [initial]);

      const res = updateCommission('COM-1', { عمولة_المستأجر: 150 });
      
      expect(res.success).toBe(true);
      expect(res.data?.المجموع).toBe(250); // 100 + 150
    });

    it('should recalculate total (المجموع) when عمولة_البائع is updated (Sale)', () => {
      const initial = {
        رقم_العمولة: 'COM-SALE-1',
        رقم_الاتفاقية: 'S-1',
        نوع_العمولة: 'Sale',
        عمولة_البائع: 1000,
        عمولة_المشتري: 500,
        عمولة_إدخال_عقار: 0,
        المجموع: 1500,
      } as any;
      save(KEYS.COMMISSIONS, [initial]);

      const res = updateCommission('COM-SALE-1', { عمولة_البائع: 2000 });
      
      expect(res.success).toBe(true);
      expect(res.data?.المجموع).toBe(2500); // 2000 + 500
    });

    it('should include عمولة_إدخال_عقار in total for Sales', () => {
      const initial = {
        رقم_العمولة: 'COM-SALE-1',
        رقم_الاتفاقية: 'S-1',
        نوع_العمولة: 'Sale',
        عمولة_البائع: 1000,
        عمولة_المشتري: 500,
        عمولة_إدخال_عقار: 100,
        المجموع: 1600,
      } as any;
      save(KEYS.COMMISSIONS, [initial]);

      const res = updateCommission('COM-SALE-1', { عمولة_إدخال_عقار: 300 });
      
      expect(res.success).toBe(true);
      expect(res.data?.المجموع).toBe(1800); // 1000 + 500 + 300
    });

    it('should NOT recalculate total if unrelated fields are updated', () => {
      const initial = {
        رقم_العمولة: 'COM-1',
        رقم_العقد: 'C-1',
        المجموع: 150,
        ملاحظات: 'قديم',
      } as any;
      save(KEYS.COMMISSIONS, [initial]);

      const res = updateCommission('COM-1', { ملاحظات: 'جديد' });
      
      expect(res.success).toBe(true);
      expect(res.data?.المجموع).toBe(150);
    });
  });

  describe('upsertCommissionForContract', () => {
    it('should create a new commission record for a contract', () => {
      const contract = { رقم_العقد: 'C-NEW' } as العقود_tbl;
      save(KEYS.CONTRACTS, [contract]);

      const res = upsertCommissionForContract('C-NEW', {
        commOwner: 250,
        commTenant: 125,
      });

      expect(res.success).toBe(true);
      expect(res.data?.المجموع).toBe(375);
      expect(getCommissions().length).toBe(1);
    });

    it('should update an existing commission record', () => {
      const contract = { رقم_العقد: 'C-EXIST' } as العقود_tbl;
      const initialComm = {
        رقم_العمولة: 'COM-C-EXIST',
        رقم_العقد: 'C-EXIST',
        عمولة_المالك: 100,
        المجموع: 100,
      } as any;
      save(KEYS.CONTRACTS, [contract]);
      save(KEYS.COMMISSIONS, [initialComm]);

      const res = upsertCommissionForContract('C-EXIST', {
        commOwner: 300,
        commTenant: 100,
      });

      expect(res.success).toBe(true);
      expect(res.data?.المجموع).toBe(400); // Triggered via updateCommission
      expect(getCommissions().length).toBe(1);
    });
  });

  describe('upsertCommissionForSale', () => {
    it('should create or update a sales commission with intro component', () => {
      const res = upsertCommissionForSale('SA-1', {
        sellerComm: 1000,
        buyerComm: 800,
        listingComm: 200,
      });

      expect(res.success).toBe(true);
      expect(res.data?.المجموع).toBe(2000); // 1000 + 800 + 200
      expect(res.data?.يوجد_ادخال_عقار).toBe(true);
    });
  });

});
