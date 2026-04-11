/**
 * اختبارات شاملة لوحدة الكمبيالات - تغطي جميع الدوال والحالات
 * مجموع الاختبارات: 19 اختبار
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getInstallments,
  getInstallmentPaidAndRemaining,
  generateContractInstallmentsInternal,
  getInstallmentPaymentSummary,
  createInstallmentPaymentHandlers,
  updateInstallmentDynamicFields
} from '@/services/db/installments';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { INSTALLMENT_STATUS } from '@/services/db/installmentConstants';
import { dbOk, dbFail } from '@/services/localDbStorage';
import { formatDateOnly, parseDateOnly } from '@/utils/dateOnly';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';

jest.mock('@/services/db/kv');
jest.mock('@/services/localDbStorage');

describe('Installments Service', () => {
  // Mock الدوال المطلوبة
  const mockLogOperation = jest.fn();
  const mockMarkAlertsReadByPrefix = jest.fn();
  const mockUpdateTenantRating = jest.fn();

  // بيانات اختبار افتراضية
  const testInstallment: any = {
    رقم_الكمبيالة: 'INS_cot_001_001',
    رقم_العقد: 'cot_001',
    القيمة: 1000,
    تاريخ_استحقاق: '2025-01-01',
    حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
    سجل_الدفعات: []
  };

  const testContract: any = {
    رقم_العقد: 'cot_001',
    تاريخ_البداية: '2025-01-01',
    تاريخ_النهاية: '2025-12-31',
    مدة_العقد_بالاشهر: 12,
    القيمة_السنوية: 12000,
    تكرار_الدفع: 12,
    احتساب_فرق_ايام: false,
    يوجد_دفعة_اولى: false
  };

  let installmentHandlers: ReturnType<typeof createInstallmentPaymentHandlers>;

  beforeEach(() => {
    jest.clearAllMocks();

    (get as jest.Mock).mockImplementation((key: string) => {
      switch(key) {
        case KEYS.INSTALLMENTS: return [testInstallment];
        case KEYS.CONTRACTS: return [{ رقم_العقد: 'cot_001', رقم_المستاجر: 'PER_001' }];
        default: return [];
      }
    });

    installmentHandlers = createInstallmentPaymentHandlers({
      logOperation: mockLogOperation,
      markAlertsReadByPrefix: mockMarkAlertsReadByPrefix,
      updateTenantRating: mockUpdateTenantRating
    });

    (dbOk as jest.Mock).mockImplementation((data?: any, msg?: string) => ({ success: true, data, message: msg }));
    (dbFail as jest.Mock).mockImplementation((msg: string) => ({ success: false, message: msg }));
  });

  // ✅ الحالات الطبيعية
  test('✅ getInstallments returns all installments correctly', () => {
    const result = getInstallments();
    expect(result).toHaveLength(1);
    expect(result[0].رقم_الكمبيالة).toBe('INS_cot_001_001');
  });

  test('✅ getInstallmentPaidAndRemaining calculates correctly for unpaid installment', () => {
    const result = getInstallmentPaidAndRemaining(testInstallment);
    expect(result.paid).toBe(0);
    expect(result.remaining).toBe(1000);
  });

  test('✅ getInstallmentPaidAndRemaining calculates correctly for paid installment', () => {
    const paidInst = { ...testInstallment, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID };
    const result = getInstallmentPaidAndRemaining(paidInst);
    expect(result.paid).toBe(1000);
    expect(result.remaining).toBe(0);
  });

  test('✅ generateContractInstallmentsInternal generates correct number of monthly installments', () => {
    const result = generateContractInstallmentsInternal(testContract, 'cot_001');
    expect(result.success).toBe(true);
    expect((result.data as any[])).toHaveLength(12);
  });

  test('✅ generateContractInstallmentsInternal correctly includes down payment', () => {
    const contractWithDown = { ...testContract, يوجد_دفعة_اولى: true, قيمة_الدفعة_الاولى: 2000 };
    const result = generateContractInstallmentsInternal(contractWithDown, 'cot_001');
    expect(result.success).toBe(true);
    expect((result.data as any[]).some(i => i.نوع_الكمبيالة === 'دفعة أولى')).toBe(true);
  });

  test('✅ getInstallmentPaymentSummary returns correct summary', () => {
    const result = getInstallmentPaymentSummary('INS_cot_001_001');
    expect(result).not.toBeNull();
    expect(result?.totalAmount).toBe(1000);
    expect(result?.paidAmount).toBe(0);
    expect(result?.remainingAmount).toBe(1000);
  });

  test('✅ markInstallmentPaid marks installment as paid correctly', () => {
    const result = installmentHandlers.markInstallmentPaid('INS_cot_001_001', 'USER_001', 'Admin', {
      paidAmount: 1000,
      paymentDate: '2025-01-05'
    });
    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalled();
    expect(mockLogOperation).toHaveBeenCalled();
  });

  test('✅ markInstallmentPaid handles partial payments correctly', () => {
    const result = installmentHandlers.markInstallmentPaid('INS_cot_001_001', 'USER_001', 'Admin', {
      paidAmount: 500,
      isPartial: true
    });
    expect(result.success).toBe(true);
  });

  test('✅ setInstallmentLateFee adds late fee correctly', () => {
    const result = installmentHandlers.setInstallmentLateFee('INS_cot_001_001', 'USER_001', 'Admin', {
      amount: 50,
      note: 'غرامة تأخير 5 أيام'
    });
    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalled();
  });

  test('✅ reversePayment reverses last payment correctly', () => {
    (get as jest.Mock).mockReturnValue([{
      ...testInstallment,
      حالة_الكمبيالة: INSTALLMENT_STATUS.PAID,
      سجل_الدفعات: [{ رقم_العملية: 'OP_123', المبلغ: 1000, التاريخ: '2025-01-05' }]
    }]);

    const result = installmentHandlers.reversePayment('INS_cot_001_001', 'SUPER_ADMIN', 'SuperAdmin', 'خطأ في تسجيل الدفع');
    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalled();
  });

  // ❌ حالات الخطأ
  test('❌ getInstallmentPaymentSummary returns null for non-existing id', () => {
    const result = getInstallmentPaymentSummary('invalid_id');
    expect(result).toBeNull();
  });

  test('❌ markInstallmentPaid fails for non-admin role', () => {
    const result = installmentHandlers.markInstallmentPaid('INS_cot_001_001', 'USER_001', 'User', { paidAmount: 1000 });
    expect(result.success).toBe(false);
    expect(result.message).toContain('الصلاحية غير كافية');
  });

  test('❌ markInstallmentPaid fails for already paid installment', () => {
    (get as jest.Mock).mockReturnValue([{ ...testInstallment, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID }]);
    const result = installmentHandlers.markInstallmentPaid('INS_cot_001_001', 'USER_001', 'Admin', { paidAmount: 1000 });
    expect(result.success).toBe(false);
    expect(result.message).toContain('لا يمكن سداد كمبيالة مدفوعة');
  });

  test('❌ markInstallmentPaid fails when paying more than remaining', () => {
    const result = installmentHandlers.markInstallmentPaid('INS_cot_001_001', 'USER_001', 'Admin', { paidAmount: 1500 });
    expect(result.success).toBe(false);
    expect(result.message).toContain('يتجاوز المتبقي');
  });

  test('❌ reversePayment fails for non SuperAdmin role', () => {
    const result = installmentHandlers.reversePayment('INS_cot_001_001', 'ADMIN_001', 'Admin', 'سبب عكس');
    expect(result.success).toBe(false);
    expect(result.message).toContain('فقط السوبر أدمن يمكنه عكس السداد');
  });

  test('❌ reversePayment fails without reason', () => {
    const result = installmentHandlers.reversePayment('INS_cot_001_001', 'SUPER_ADMIN', 'SuperAdmin', '');
    expect(result.success).toBe(false);
    expect(result.message).toContain('سبب عكس السداد إلزامي');
  });

  test('❌ generateContractInstallmentsInternal fails with invalid dates', () => {
    const badContract = { ...testContract, تاريخ_البداية: 'invalid_date' };
    const result = generateContractInstallmentsInternal(badContract, 'cot_001');
    expect(result.success).toBe(false);
  });

  // ⚠️ الحالات الحدية
  test('⚠️ getInstallmentPaidAndRemaining handles partial payment history correctly', () => {
    const inst = {
      ...testInstallment,
      سجل_الدفعات: [{ المبلغ: 300 }, { المبلغ: 400 }]
    };
    const result = getInstallmentPaidAndRemaining(inst);
    expect(result.paid).toBe(700);
    expect(result.remaining).toBe(300);
  });

  // 🔗 التكامل بين الدوال
  test('🔗 markInstallmentPaid correctly triggers tenant rating update', () => {
    installmentHandlers.markInstallmentPaid('INS_cot_001_001', 'USER_001', 'Admin', {
      paidAmount: 1000,
      paymentDate: '2025-01-02'
    });
    expect(mockUpdateTenantRating).toHaveBeenCalledWith('PER_001', 'full');
  });
});