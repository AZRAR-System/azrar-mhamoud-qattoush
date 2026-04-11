import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import { 
  getContracts, 
  createContractWrites 
} from '@/services/db/contracts';
import { save, get } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';
import { العقود_tbl } from '@/types';

const contractWritesDeps = () => createContractWrites({
  logOperation: jest.fn(),
  handleSmartEngine: jest.fn(),
  formatDateOnly: (d: Date) => d.toISOString().slice(0, 10),
  addDaysIso: (iso: string, days: number) => {
    const d = new Date(iso + 'T12:00:00.000Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  },
  addMonthsDateOnly: (iso: string, months: number) => {
    const d = new Date(iso + 'T12:00:00.000Z');
    d.setUTCMonth(d.getUTCMonth() + months);
    return d;
  },
});

beforeAll(() => {
  installMemoryLocalStorage();
});

beforeEach(() => {
  resetKvAndCache();
  save(KEYS.CONTRACTS, []);
});

describe('Contracts Service', () => {
  it('should return empty list when no contracts exist', () => {
    expect(getContracts()).toEqual([]);
  });

  it('should create a new contract with generated ID', () => {
    const { createContract } = contractWritesDeps();
    const res = createContract({
      رقم_العقار: 'PROP-X',
      رقم_المستاجر: 'TEN-X',
      تاريخ_البداية: '2026-01-01',
      تاريخ_النهاية: '2026-12-31',
      مدة_العقد_بالاشهر: 12,
      القيمة_السنوية: 5000,
      تكرار_الدفع: 12,
      طريقة_الدفع: 'Postpaid',
    }, 0, 0);

    expect(res.success).toBe(true);
    expect(res.data?.رقم_العقد).toMatch(/^cot_/);
    expect(getContracts()).toHaveLength(1);
  });

  it('should filter contracts correctly', () => {
    save(KEYS.CONTRACTS, [
      { رقم_العقد: 'C1', رقم_العقار: 'P1', isArchived: false },
      { رقم_العقد: 'C2', رقم_العقار: 'P2', isArchived: true },
    ] as any);

    const active = getContracts().filter(c => !c.isArchived);
    expect(active).toHaveLength(1);
    expect(active[0].رقم_العقد).toBe('C1');
  });
});
