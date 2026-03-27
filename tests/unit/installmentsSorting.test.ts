import { jest } from '@jest/globals';

import type { InstallmentsContractsItem } from '../../src/types/domain.types';
import type { الكمبيالات_tbl } from '../../src/types/types';

// Mock DbService used by installmentsContractsPagedSmart (non-desktop fallback)
const DbServiceMock = {
  getContracts: jest.fn<() => unknown[]>(),
  getPeople: jest.fn<() => unknown[]>(),
  getProperties: jest.fn<() => unknown[]>(),
  getInstallments: jest.fn<() => unknown[]>(),
};

jest.unstable_mockModule('@/services/mockDb', () => ({
  DbService: DbServiceMock,
}));

describe('installmentsContractsPagedSmart sorting (web/non-desktop parity)', () => {
  const baseNow = new Date('2026-02-02T10:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(baseNow);
    jest.clearAllMocks();

    // 3 contracts
    DbServiceMock.getContracts.mockReturnValue([
      { رقم_العقد: '1', رقم_المستاجر: 't1', رقم_العقار: 'p1' },
      { رقم_العقد: '2', رقم_المستاجر: 't2', رقم_العقار: 'p2' },
      { رقم_العقد: '3', رقم_المستاجر: 't3', رقم_العقار: 'p3' },
    ]);

    DbServiceMock.getPeople.mockReturnValue([
      { رقم_الشخص: 't1', الاسم: 'أحمد', رقم_الهاتف: '0790000001' },
      { رقم_الشخص: 't2', الاسم: 'باسم', رقم_الهاتف: '0790000002' },
      { رقم_الشخص: 't3', الاسم: 'زيد', رقم_الهاتف: '0790000003' },
    ]);

    DbServiceMock.getProperties.mockReturnValue([
      { رقم_العقار: 'p1', الكود_الداخلي: 'P-1', العنوان: 'عمّان' },
      { رقم_العقار: 'p2', الكود_الداخلي: 'P-2', العنوان: 'إربد' },
      { رقم_العقار: 'p3', الكود_الداخلي: 'P-3', العنوان: 'الزرقاء' },
    ]);

    // Installments: contract 1 has next due 2026-02-10 (and an ignored تأمين earlier)
    // contract 2 has no payable next due (paid/cancelled only)
    // contract 3 has next due 2026-02-05
    DbServiceMock.getInstallments.mockReturnValue([
      // contract 1
      { رقم_العقد: '1', نوع_الكمبيالة: 'تأمين', حالة_الكمبيالة: 'نشط', القيمة: 100, القيمة_المتبقية: 100, تاريخ_استحقاق: '2026-02-03T00:00:00.000Z' },
      { رقم_العقد: '1', نوع_الكمبيالة: 'قسط', حالة_الكمبيالة: 'نشط', القيمة: 500, القيمة_المتبقية: 500, تاريخ_استحقاق: '2026-02-10T00:00:00.000Z' },

      // contract 2
      { رقم_العقد: '2', نوع_الكمبيالة: 'قسط', حالة_الكمبيالة: 'نشط', القيمة: 500, القيمة_المتبقية: 0, تاريخ_استحقاق: '2026-02-08T00:00:00.000Z' },
      { رقم_العقد: '2', نوع_الكمبيالة: 'قسط', حالة_الكمبيالة: 'ملغي', القيمة: 500, القيمة_المتبقية: 500, تاريخ_استحقاق: '2026-02-06T00:00:00.000Z' },

      // contract 3
      { رقم_العقد: '3', نوع_الكمبيالة: 'قسط', حالة_الكمبيالة: 'نشط', القيمة: 500, القيمة_المتبقية: 500, تاريخ_استحقاق: '2026-02-05T00:00:00.000Z' },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('due-asc sorts by most relevant due date (unpaid first, then last paid)', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    const res = await installmentsContractsPagedSmart({ sort: 'due-asc', offset: 0, limit: 50 });
    expect(res.error).toBeUndefined();

    const ids = res.items.map((x: InstallmentsContractsItem) => String(x.contract?.رقم_العقد ?? ''));
    // contract 3 (Feb 5 unpaid) then contract 2 (Feb 8 paid) then contract 1 (Feb 10 unpaid)
    expect(ids).toEqual(['3', '2', '1']);
  });

  test('defaults to due-asc when sort is omitted', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    const res = await installmentsContractsPagedSmart({ offset: 0, limit: 50 });
    expect(res.error).toBeUndefined();

    const ids = res.items.map((x: InstallmentsContractsItem) => String(x.contract?.رقم_العقد ?? ''));
    expect(ids).toEqual(['3', '2', '1']);
  });

  test('due-desc sorts by most relevant due date descending', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    const res = await installmentsContractsPagedSmart({ sort: 'due-desc', offset: 0, limit: 50 });
    expect(res.error).toBeUndefined();

    const ids = res.items.map((x: InstallmentsContractsItem) => String(x.contract?.رقم_العقد ?? ''));
    // contract 1 (Feb 10) then contract 2 (Feb 8) then contract 3 (Feb 5)
    expect(ids).toEqual(['1', '2', '3']);
  });

  test('amount-asc / amount-desc sort by annual value', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    const resAsc = await installmentsContractsPagedSmart({ sort: 'amount-asc', offset: 0, limit: 50 });
    const amountsAsc = resAsc.items.map((x: InstallmentsContractsItem) => x.contract?.القيمة_السنوية ?? 0);
    for (let i = 0; i < amountsAsc.length - 1; i++) {
      expect(amountsAsc[i]).toBeLessThanOrEqual(amountsAsc[i + 1]);
    }

    const resDesc = await installmentsContractsPagedSmart({ sort: 'amount-desc', offset: 0, limit: 50 });
    const amountsDesc = resDesc.items.map((x: InstallmentsContractsItem) => x.contract?.القيمة_السنوية ?? 0);
    for (let i = 0; i < amountsDesc.length - 1; i++) {
      expect(amountsDesc[i]).toBeGreaterThanOrEqual(amountsDesc[i + 1]);
    }
  });

  test('filtering by amount and date', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    // Amount range
    const resAmount = await installmentsContractsPagedSmart({ filterMinAmount: 1000, filterMaxAmount: 5000, offset: 0, limit: 50 });
    resAmount.items.forEach(item => {
      const hasMatch = item.installments.some((i: الكمبيالات_tbl) => i.القيمة >= 1000 && i.القيمة <= 5000);
      expect(hasMatch).toBe(true);
    });

    // Date range
    const resDate = await installmentsContractsPagedSmart({ filterStartDate: '2025-02-06', filterEndDate: '2025-02-09', offset: 0, limit: 50 });
    resDate.items.forEach(item => {
      const hasMatch = item.installments.some((i: الكمبيالات_tbl) => i.تاريخ_استحقاق >= '2025-02-06' && i.تاريخ_استحقاق <= '2025-02-09');
      expect(hasMatch).toBe(true);
    });
  });

  test('filtering by payment method', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    const resPrepaid = await installmentsContractsPagedSmart({ filterPaymentMethod: 'Prepaid', offset: 0, limit: 50 });
    resPrepaid.items.forEach(item => {
      expect(item.contract?.طريقة_الدفع).toBe('Prepaid');
    });

    const resPostpaid = await installmentsContractsPagedSmart({ filterPaymentMethod: 'Postpaid', offset: 0, limit: 50 });
    resPostpaid.items.forEach(item => {
      expect(item.contract?.طريقة_الدفع).toBe('Postpaid');
    });
  });

  test('tenant-asc / tenant-desc sort by tenant name', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    const asc = await installmentsContractsPagedSmart({ sort: 'tenant-asc', offset: 0, limit: 50 });
    const ascNames = asc.items.map((x: InstallmentsContractsItem) => String(x.tenant?.الاسم ?? ''));
    expect(ascNames[0]).toBe('أحمد');
    expect(ascNames[ascNames.length - 1]).toBe('زيد');

    const desc = await installmentsContractsPagedSmart({ sort: 'tenant-desc', offset: 0, limit: 50 });
    const descNames = desc.items.map((x: InstallmentsContractsItem) => String(x.tenant?.الاسم ?? ''));
    expect(descNames[0]).toBe('زيد');
    expect(descNames[descNames.length - 1]).toBe('أحمد');
  });
});
