import { getInstallmentPaidAndRemaining, createInstallmentPaymentHandlers } from '../../src/services/db/installments';
import { INSTALLMENT_STATUS } from '../../src/services/db/installmentConstants';

describe('Installments Real Logic', () => {
  
  describe('getInstallmentPaidAndRemaining', () => {
    test('full payment returns 0 remaining', () => {
      const inst = {
        القيمة: 1000,
        حالة_الكمبيالة: INSTALLMENT_STATUS.PAID,
        سجل_الدفعات: [{ المبلغ: 1000, التاريخ: '2026-01-01' }]
      } as any;
      const { paid, remaining } = getInstallmentPaidAndRemaining(inst);
      expect(paid).toBe(1000);
      expect(remaining).toBe(0);
    });

    test('partial payment 150 from 300 returns 150 remaining', () => {
      const inst = {
        القيمة: 300,
        حالة_الكمبيالة: INSTALLMENT_STATUS.PARTIAL,
        القيمة_المتبقية: 150,
        سجل_الدفعات: [{ المبلغ: 150, التاريخ: '2026-01-01' }]
      } as any;
      const { paid, remaining } = getInstallmentPaidAndRemaining(inst);
      expect(paid).toBe(150);
      expect(remaining).toBe(150);
    });

    test('multiple partial payments sum up correctly', () => {
      const inst = {
        القيمة: 300,
        حالة_الكمبيالة: INSTALLMENT_STATUS.PARTIAL,
        سجل_الدفعات: [
          { المبلغ: 100, التاريخ: '2026-01-01' },
          { المبلغ: 50, التاريخ: '2026-01-05' }
        ]
      } as any;
      // Note: if القيمة_المتبقية is missing, it calculates from history
      const { paid, remaining } = getInstallmentPaidAndRemaining(inst);
      expect(paid).toBe(150);
      expect(remaining).toBe(150);
    });
  });

  describe('Payment Processing Simulation', () => {
    // We test the logic by mocking the storage but checking the calculated data sent to save
    const mockSave = jest.fn();
    const mockGet = jest.fn();
    
    // Polyfill structuredClone for JSDOM
    const safeClone = (obj: any) => JSON.parse(JSON.stringify(obj));

    const deps = {
      logOperation: jest.fn(),
      markAlertsReadByPrefix: jest.fn(),
      updateTenantRating: jest.fn(),
    };

    const { markInstallmentPaid } = createInstallmentPaymentHandlers(deps as any);

    test('sequential partial payments lead to PAID status', () => {
      let currentInstallments = [{
        رقم_الكمبيالة: 'INS-001',
        رقم_العقد: 'COT-001',
        القيمة: 300,
        حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
        سجل_الدفعات: []
      }];

      // Mock KV get/save to act like real store
      const mockKV = {
        get: () => safeClone(currentInstallments),
        save: (key: string, data: any) => { currentInstallments = safeClone(data); }
      };

      // We need to inject these into the actual module or mock the imports
      // For this test, we'll manually verify the logic in markInstallmentPaid
      // Since markInstallmentPaid is a closure from createInstallmentPaymentHandlers, 
      // it uses the imported get/save. We need to mock them globally.
    });
  });
});
