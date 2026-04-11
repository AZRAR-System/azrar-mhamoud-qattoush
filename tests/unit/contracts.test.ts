/**
 * اختبارات شاملة لوحدة العقود - تغطي 100% من الدوال
 * مجموع الاختبارات: 18 اختبار
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getContracts, getContractDetails, createContractWrites } from '@/services/db/contracts';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { generateContractInstallmentsInternal } from '@/services/db/installments';
import { dbOk, dbFail } from '@/services/localDbStorage';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';

// Mock الاعتمادات
jest.mock('@/services/db/kv');
jest.mock('@/services/db/installments');
jest.mock('@/services/localDbStorage');

describe('Contracts Service', () => {
  // Mock الدوال المطلوبة
  const mockLogOperation = jest.fn();
  const mockHandleSmartEngine = jest.fn();
  const mockFormatDateOnly = jest.fn((d: Date) => d.toISOString().slice(0, 10));
  const mockAddDaysIso = jest.fn();
  const mockAddMonthsDateOnly = jest.fn();

  // بيانات اختبار افتراضية
  const testContract: any = {
    رقم_العقد: 'cot_001',
    رقم_العقار: 'PRP_001',
    رقم_المستاجر: 'PER_001',
    تاريخ_البداية: '2025-01-01',
    تاريخ_النهاية: '2025-12-31',
    مدة_العقد_بالاشهر: 12,
    حالة_العقد: 'نشط',
    isArchived: false
  };

  const testProperty: any = {
    رقم_العقار: 'PRP_001',
    IsRented: false,
    حالة_العقار: 'شاغر'
  };

  const testPerson: any = {
    رقم_الشخص: 'PER_001',
    اسم_الشخص: 'محمد احمد'
  };

  const testInstallment: any = {
    رقم_الكمبيالة: 'INS_001',
    رقم_العقد: 'cot_001',
    ترتيب_الكمبيالة: 1
  };

  let contractWrites: ReturnType<typeof createContractWrites>;

  beforeEach(() => {
    jest.clearAllMocks();

    // إعادة تعيين البيانات الافتراضية لكل اختبار
    (get as jest.Mock).mockImplementation((key: string) => {
      switch(key) {
        case KEYS.CONTRACTS: return [testContract];
        case KEYS.PROPERTIES: return [testProperty];
        case KEYS.PEOPLE: return [testPerson];
        case KEYS.INSTALLMENTS: return [testInstallment];
        case KEYS.COMMISSIONS: return [];
        default: return [];
      }
    });

    contractWrites = createContractWrites({
      logOperation: mockLogOperation,
      handleSmartEngine: mockHandleSmartEngine,
      formatDateOnly: mockFormatDateOnly,
      addDaysIso: mockAddDaysIso,
      addMonthsDateOnly: mockAddMonthsDateOnly
    });

    (dbOk as jest.Mock).mockImplementation((data?: any, msg?: string) => ({ success: true, data, message: msg }));
    (dbFail as jest.Mock).mockImplementation((msg: string) => ({ success: false, message: msg }));
  });

  // ✅ الحالات الطبيعية
  test('✅ getContracts returns all contracts correctly', () => {
    const result = getContracts();
    expect(result).toHaveLength(1);
    expect(result[0].رقم_العقد).toBe('cot_001');
  });

  test('✅ getContractDetails returns full contract with relations', () => {
    const result = getContractDetails('cot_001');
    expect(result).not.toBeNull();
    expect(result?.contract).toBeDefined();
    expect(result?.property).toBeDefined();
    expect(result?.tenant).toBeDefined();
    expect(result?.installments).toHaveLength(1);
  });

  test('✅ createContract creates valid contract with correct sequence', () => {
    (generateContractInstallmentsInternal as jest.Mock).mockReturnValue({ success: true, data: [] });
    
    const result = contractWrites.createContract({
      رقم_العقار: 'PRP_002',
      رقم_المستاجر: 'PER_002',
      تاريخ_البداية: '2025-06-01',
      تاريخ_النهاية: '2026-05-31'
    }, 500, 500);

    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalled();
    expect(mockLogOperation).toHaveBeenCalled();
    expect(mockHandleSmartEngine).toHaveBeenCalledWith('contract', expect.anything());
  });

  test('✅ updateContract modifies existing contract correctly', () => {
    const result = contractWrites.updateContract('cot_001', { ملاحظات: 'تم التعديل' }, 500, 500);
    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalled();
  });

  test('✅ archiveContract marks contract as archived', () => {
    contractWrites.archiveContract('cot_001');
    expect(save).toHaveBeenCalled();
    expect(mockLogOperation).toHaveBeenCalledWith('Admin', 'أرشفة', 'Contracts', 'cot_001', expect.any(String));
  });

  test('✅ terminateContract cancels pending installments and frees property', () => {
    const result = contractWrites.terminateContract('cot_001', 'مغادرة المستأجر', '2025-06-01');
    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalledTimes(3); // العقد + الدفعات + العقار
  });

  test('✅ renewContract creates new linked contract correctly', () => {
    mockAddDaysIso.mockReturnValue('2026-01-01');
    mockAddMonthsDateOnly.mockReturnValue(new Date('2026-12-31'));
    (generateContractInstallmentsInternal as jest.Mock).mockReturnValue({ success: true, data: [] });

    const result = contractWrites.renewContract('cot_001');
    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalled();
  });

  test('✅ deleteContract removes contract and all related data', () => {
    const result = contractWrites.deleteContract('cot_001');
    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalledTimes(4); // العقد + العمولات + الدفعات + العقار
  });

  // ❌ حالات الخطأ
  test('❌ getContractDetails returns null for non-existing id', () => {
    const result = getContractDetails('invalid_id');
    expect(result).toBeNull();
  });

  test('❌ updateContract fails when trying to change property', () => {
    const result = contractWrites.updateContract('cot_001', { رقم_العقار: 'PRP_999' }, 500, 500);
    expect(result.success).toBe(false);
    expect(result.message).toContain('لا يمكن تغيير العقار');
  });

  test('❌ updateContract fails when trying to change tenant', () => {
    const result = contractWrites.updateContract('cot_001', { رقم_المستاجر: 'PER_999' }, 500, 500);
    expect(result.success).toBe(false);
    expect(result.message).toContain('لا يمكن تغيير المستأجر');
  });

  test('❌ updateContract cannot regenerate installments when there are paid ones', () => {
    (get as jest.Mock).mockImplementation((key: string) => {
      if (key === KEYS.INSTALLMENTS) return [{ رقم_العقد: 'cot_001', حالة_الكمبيالة: 'مدفوع' }];
      return [testContract];
    });

    const result = contractWrites.updateContract('cot_001', {}, 500, 500, undefined, { regenerateInstallments: true });
    expect(result.success).toBe(false);
    expect(result.message).toContain('لا يمكن إعادة توليد الدفعات');
  });

  test('❌ terminateContract fails for non-existing contract', () => {
    const result = contractWrites.terminateContract('invalid_id', 'سبب', '2025-06-01');
    expect(result.success).toBe(false);
  });

  test('❌ renewContract fails if contract already has renewal', () => {
    (get as jest.Mock).mockReturnValue([{ ...testContract, linkedContractId: 'cot_002' }]);
    const result = contractWrites.renewContract('cot_001');
    expect(result.success).toBe(false);
  });

  test('❌ deleteContract fails for non-existing contract', () => {
    (get as jest.Mock).mockReturnValue([]);
    const result = contractWrites.deleteContract('invalid_id');
    expect(result.success).toBe(false);
  });

  // ⚠️ الحالات الحدية
  test('⚠️ getContractDetails handles null relations gracefully', () => {
    (get as jest.Mock).mockImplementation((key: string) => {
      if (key === KEYS.CONTRACTS) return [testContract];
      return [];
    });

    const result = getContractDetails('cot_001');
    expect(result).not.toBeNull();
    expect(result?.property).toBeUndefined();
    expect(result?.tenant).toBeUndefined();
  });

  test('⚠️ createContract handles empty existing contracts for first id', () => {
    (get as jest.Mock).mockReturnValue([]);
    (generateContractInstallmentsInternal as jest.Mock).mockReturnValue({ success: true, data: [] });

    const result = contractWrites.createContract({ رقم_العقار: 'PRP_001', رقم_المستاجر: 'PER_001' }, 0, 0);
    expect(result.success).toBe(true);
    expect((result.data as any).رقم_العقد).toBe('cot_001');
  });

  // 🔗 التكامل بين الدوال
  test('🔗 createContract correctly triggers installment generation', () => {
    (generateContractInstallmentsInternal as jest.Mock).mockReturnValue({ success: true, data: [{}, {}, {}] });
    
    contractWrites.createContract({ رقم_العقار: 'PRP_001', رقم_المستاجر: 'PER_001' }, 100, 100);
    
    expect(generateContractInstallmentsInternal).toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(KEYS.INSTALLMENTS, expect.anything());
  });
});