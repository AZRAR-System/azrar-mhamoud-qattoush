import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { الأشخاص_tbl, العقارات_tbl } from '@/types';
import { getContracts, createContractWrites } from '@/services/db/contracts';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';

const owner: الأشخاص_tbl = {
  رقم_الشخص: 'P-OWNER',
  الاسم: 'مالك',
  رقم_الهاتف: '0791111111',
};

const tenant: الأشخاص_tbl = {
  رقم_الشخص: 'P-TENANT',
  الاسم: 'مستأجر',
  رقم_الهاتف: '0792222222',
};

const property: العقارات_tbl = {
  رقم_العقار: 'PROP-1',
  الكود_الداخلي: 'INT-1',
  رقم_المالك: owner.رقم_الشخص,
  النوع: 'شقة',
  العنوان: 'عمان',
  حالة_العقار: 'شاغر',
  IsRented: false,
  المساحة: 100,
};

const contractWritesDeps = () =>
  createContractWrites({
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
  save(KEYS.PEOPLE, [owner, tenant]);
  save(KEYS.PROPERTIES, [property]);
  save(KEYS.CONTRACTS, []);
  save(KEYS.INSTALLMENTS, []);
  save(KEYS.COMMISSIONS, []);
});

describe('db/contracts', () => {
  it('getContracts returns empty when none', () => {
    resetKvAndCache();
    expect(getContracts()).toEqual([]);
  });

  it('createContract appends contract and getContracts sees it', () => {
    const { createContract } = contractWritesDeps();
    const res = createContract(
      {
        رقم_العقار: property.رقم_العقار,
        رقم_المستاجر: tenant.رقم_الشخص,
        تاريخ_البداية: '2026-01-01',
        تاريخ_النهاية: '2026-12-31',
        مدة_العقد_بالاشهر: 12,
        القيمة_السنوية: 12000,
        تكرار_الدفع: 12,
        طريقة_الدفع: 'Postpaid',
      },
      10,
      10
    );
    expect(res.success).toBe(true);
    const list = getContracts();
    expect(list.length).toBe(1);
    expect(list[0].رقم_العقد).toMatch(/^cot_/);
    expect(list[0].رقم_العقار).toBe('PROP-1');
  });
});
