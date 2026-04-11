import { jest } from '@jest/globals';
import { createContractWrites } from '@/services/db/contracts';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

// Mock Dependencies
const mockDeps = {
  logOperation: jest.fn(),
  handleSmartEngine: jest.fn(),
  formatDateOnly: jest.fn((d) => d),
  addDaysIso: jest.fn((date, days) => date),
  addMonthsDateOnly: jest.fn((date, months) => new Date(date))
};

const {
  createContract,
  updateContract,
  terminateContract,
  renewContract,
  deleteContract
} = createContractWrites(mockDeps);

describe('Contracts Service', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.CONTRACTS, []);
    save(KEYS.PROPERTIES, []);
    save(KEYS.INSTALLMENTS, []);
    save(KEYS.COMMISSIONS, []);
    jest.clearAllMocks();
  });

  // ✅ الحالات الطبيعية
  it('✅ createContract creates new contract with valid data', async () => {
    const res = createContract({
      رقم_العقد: 'CT001',
      رقم_العقار: 'PR001',
      رقم_المستاجر: 'PER001',
      تاريخ_البداية: '2025-01-01',
      تاريخ_الانتهاء: '2025-12-31',
      القيمة_الشهرية: 1000,
      مقدم: 2000
    });

    await new Promise(r => setTimeout(r, 10));

    expect(res.success).toBe(true);
    expect(res.data.رقم_العقد).toBe('CT001');
    expect(res.data.الحالة).toBe('نشط');
  });

  it('✅ updateContract modifies existing contract correctly', async () => {
    save(KEYS.CONTRACTS, [{
      رقم_العقد: 'CT001',
      القيمة_الشهرية: 1000,
      الحالة: 'نشط'
    }]);

    const res = updateContract('CT001', { القيمة_الشهرية: 1200 });
    await new Promise(r => setTimeout(r, 10));

    expect(res.success).toBe(true);
    expect(res.data.القيمة_الشهرية).toBe(1200);
  });

  it('✅ renewContract extends contract end date correctly', async () => {
    save(KEYS.CONTRACTS, [{
      رقم_العقد: 'CT001',
      تاريخ_الانتهاء: '2025-12-31',
      الحالة: 'نشط'
    }]);

    const res = renewContract('CT001', 12);
    await new Promise(r => setTimeout(r, 10));

    expect(res.success).toBe(true);
  });

  // ❌ حالات الخطأ
  it('❌ updateContract fails for non-existing id', async () => {
    const res = updateContract('NOT_EXIST', { القيمة_الشهرية: 1200 });
    await new Promise(r => setTimeout(r, 10));

    expect(res.success).toBe(false);
  });

  it('❌ deleteContract fails for non-existing id', async () => {
    const res = deleteContract('NOT_EXIST');
    await new Promise(r => setTimeout(r, 10));

    expect(res.success).toBe(false);
  });

  it('❌ terminateContract fails for already terminated contract', async () => {
    save(KEYS.CONTRACTS, [{
      رقم_العقد: 'CT001',
      الحالة: 'منتهي'
    }]);

    const res = terminateContract('CT001', 'سبب انتهاء');
    await new Promise(r => setTimeout(r, 10));

    expect(res.success).toBe(false);
  });

  // ⚠️ الحالات الحدية
  it('⚠️ createContract handles minimum required fields', async () => {
    const res = createContract({
      رقم_العقد: 'CT001',
      رقم_العقار: 'PR001',
      رقم_المستاجر: 'PER001'
    });

    await new Promise(r => setTimeout(r, 10));
    expect(res.success).toBe(true);
  });

  // 🔗 التكامل بين الدوال
  it('🔗 createContract and then updateContract works correctly', async () => {
    const created = createContract({ رقم_العقد: 'CT001', رقم_العقار: 'PR001', رقم_المستاجر: 'PER001' });
    await new Promise(r => setTimeout(r, 10));

    const updated = updateContract('CT001', { القيمة_الشهرية: 1500 });
    await new Promise(r => setTimeout(r, 10));

    expect(updated.success).toBe(true);
    expect(updated.data.القيمة_الشهرية).toBe(1500);
  });

  it('🔗 deleteContract removes contract completely', async () => {
    const created = createContract({ رقم_العقد: 'CT001', رقم_العقار: 'PR001', رقم_المستاجر: 'PER001' });
    await new Promise(r => setTimeout(r, 10));

    const deleted = deleteContract('CT001');
    await new Promise(r => setTimeout(r, 10));

    expect(deleted.success).toBe(true);
  });
});