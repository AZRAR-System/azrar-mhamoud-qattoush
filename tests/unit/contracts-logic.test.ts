import { createContractWrites } from '../../src/services/db/contracts';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/services/localDbStorage', () => ({
  dbOk: (data?: any) => ({ success: true, data }),
  dbFail: (msg: string) => ({ success: false, message: msg }),
}));

describe('Contracts Lifecycle Real Logic', () => {
  const mockDeps = {
    logOperation: jest.fn(),
    handleSmartEngine: jest.fn(),
    formatDateOnly: jest.fn(d => d.toISOString().split('T')[0]),
    addDaysIso: jest.fn(),
    addMonthsDateOnly: jest.fn(),
  };

  const { autoArchiveContracts, terminateContract } = createContractWrites(mockDeps as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('autoArchiveContracts', () => {
    test('archives expired contract with all installments paid', () => {
      // Contract must be 'منتهي' already to enter the archive block directly in one call
      const contract = {
        رقم_العقد: 'COT-1',
        تاريخ_النهاية: '2025-01-01',
        حالة_العقد: 'منتهي',
        isArchived: false
      };
      
      const installments = [
        { رقم_العقد: 'COT-1', حالة_الكمبيالة: 'مدفوع', القيمة: 100 }
      ];

      (get as jest.Mock).mockImplementation((key) => {
        if (key === KEYS.CONTRACTS) return [contract];
        if (key === KEYS.INSTALLMENTS) return installments;
        return [];
      });

      autoArchiveContracts();
      
      const savedContracts = (save as jest.Mock).mock.calls.find(call => call[0] === KEYS.CONTRACTS)[1];
      expect(savedContracts[0].حالة_العقد).toBe('مؤرشف');
      expect(savedContracts[0].isArchived).toBe(true);
    });

    test('marks expired contract as "تحصيل" if installments are unpaid', () => {
      const contract = {
        رقم_العقد: 'COT-2',
        تاريخ_النهاية: '2025-01-01',
        حالة_العقد: 'منتهي',
        isArchived: false
      };
      
      const installments = [
        { رقم_العقد: 'COT-2', حالة_الكمبيالة: 'غير مدفوع', القيمة: 100 }
      ];

      (get as jest.Mock).mockImplementation((key) => {
        if (key === KEYS.CONTRACTS) return [contract];
        if (key === KEYS.INSTALLMENTS) return installments;
        return [];
      });

      autoArchiveContracts();
      
      const savedContracts = (save as jest.Mock).mock.calls.find(call => call[0] === KEYS.CONTRACTS)[1];
      expect(savedContracts[0].حالة_العقد).toBe('تحصيل');
    });
  });

  describe('terminateContract', () => {
    test('termination cancels future installments', () => {
      const contract = { رقم_العقد: 'COT-3', حالة_العقد: 'نشط', رقم_العقار: 'PROP-1' };
      const installments = [
        { رقم_الكمبيالة: 'I1', رقم_العقد: 'COT-3', حالة_الكمبيالة: 'مدفوع', تاريخ_استحقاق: '2025-01-01', القيمة: 100 },
        { رقم_الكمبيالة: 'I2', رقم_العقد: 'COT-3', حالة_الكمبيالة: 'غير مدفوع', تاريخ_استحقاق: '2026-01-01', القيمة: 100 }
      ];

      (get as jest.Mock).mockImplementation((key) => {
        if (key === KEYS.CONTRACTS) return [contract];
        if (key === KEYS.INSTALLMENTS) return installments;
        if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'PROP-1' }];
        return [];
      });

      terminateContract('COT-3', 'Reason', '2025-06-01');
      
      const savedInstallments = (save as jest.Mock).mock.calls.find(call => call[0] === KEYS.INSTALLMENTS)[1];
      const futureInst = savedInstallments.find((i: any) => i.رقم_الكمبيالة === 'I2');
      expect(futureInst.حالة_الكمبيالة).toBe('ملغي');
    });
  });
});
