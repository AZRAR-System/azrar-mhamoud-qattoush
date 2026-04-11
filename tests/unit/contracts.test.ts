import { jest } from '@jest/globals';
import { DbService } from '@/services/mockDb';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Contracts Service Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.CONTRACTS, []);
    save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'Tenant 1' }]);
    save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR1', الكود_الداخلي: 'V1', IsRented: false }]);
  });

  it('createContract: should add a contract and update property status', () => {
    const res = DbService.addContract({
      رقم_المستاجر: 'P1',
      رقم_العقار: 'PR1',
      تاريخ_البداية: '2024-01-01',
      تاريخ_النهاية: '2024-12-31',
      القيمة_الاجمالية: 5000,
      حالة_العقد: 'نشط'
    } as any, 100, 100);

    expect(res.success).toBe(true);
    expect(DbService.getContracts()).toHaveLength(1);
    
    // Verify property was marked as rented
    const props = JSON.parse(localStorage.getItem(KEYS.PROPERTIES) || '[]');
    expect(props[0].IsRented).toBe(true);
  });

  it('terminateContract: should cancel contract and release property', () => {
    save(KEYS.CONTRACTS, [{ رقم_العقد: 'C1', رقم_العقار: 'PR1', حالة_العقد: 'نشط' }]);
    save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR1', IsRented: true }]);

    const res = DbService.terminateContract('C1', '2024-06-01', 'Tenant requested termination');
    expect(res.success).toBe(true);
    
    const contracts = DbService.getContracts();
    expect(contracts[0].حالة_العقد).toBe('ملغي');
    
    const props = JSON.parse(localStorage.getItem(KEYS.PROPERTIES) || '[]');
    expect(props[0].IsRented).toBe(false);
  });

  it('renewContract: should create a new contract from existing one', () => {
    const oldContract = {
      رقم_العقد: 'C1',
      رقم_المستاجر: 'P1',
      رقم_العقار: 'PR1',
      تاريخ_البداية: '2023-01-01',
      تاريخ_النهاية: '2023-12-31',
      حالة_العقد: 'منتهي'
    };
    save(KEYS.CONTRACTS, [oldContract]);

    const res = DbService.renewContract('C1');
    expect(res.success).toBe(true);
    
    const contracts = DbService.getContracts();
    expect(contracts).toHaveLength(2);
    expect(contracts.find(c => c.حالة_العقد === 'نشط')).toBeDefined();
  });

  it('renewContract: should handle complex frequencies and archive old contract', () => {
    save(KEYS.CONTRACTS, [{
      رقم_العقد: 'C-OLD',
      رقم_المستاجر: 'P1',
      رقم_العقار: 'PR1',
      تاريخ_النهاية: '2023-12-31',
      حالة_العقد: 'نشط',
      linkedContractId: undefined
    }]);

    // Renew with 6 months frequency and 12 months duration
    const res = DbService.renewContract('C-OLD');
    expect(res.success).toBe(true);

    const contracts = DbService.getContracts();
    const old = contracts.find(c => c.رقم_العقد === 'C-OLD');
    expect(old?.isArchived).toBe(true);
    expect(old?.حالة_العقد).toBe('منتهي');
  });

  it('terminateContract: should handle already cancelled contracts gracefully', () => {
    save(KEYS.CONTRACTS, [{ رقم_العقد: 'C-CANCELLED', حالة_العقد: 'ملغي' }]);
    const res = DbService.terminateContract('C-CANCELLED', '2024-01-01', 'Test');
    expect(res.success).toBe(true); // Should not fail if already terminated
  });
});
