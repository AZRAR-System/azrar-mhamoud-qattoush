import { jest } from '@jest/globals';

import type { InstallmentsContractsItem } from '../../src/types/domain.types';

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

  test('due-asc sorts by next unpaid due date and keeps nulls last', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    const res = await installmentsContractsPagedSmart({ sort: 'due-asc', offset: 0, limit: 50 });
    expect(res.error).toBeUndefined();

    const ids = res.items.map((x: InstallmentsContractsItem) => String(x.contract?.رقم_العقد ?? ''));
    // contract 3 (Feb 5) then contract 1 (Feb 10), then contract 2 (no payable due)
    expect(ids).toEqual(['3', '1', '2']);
  });

  test('defaults to due-asc when sort is omitted', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    const res = await installmentsContractsPagedSmart({ offset: 0, limit: 50 });
    expect(res.error).toBeUndefined();

    const ids = res.items.map((x: InstallmentsContractsItem) => String(x.contract?.رقم_العقد ?? ''));
    expect(ids).toEqual(['3', '1', '2']);
  });

  test('due-desc sorts by next unpaid due date descending and keeps nulls last', async () => {
    const { installmentsContractsPagedSmart } = await import('../../src/services/domainQueries');

    const res = await installmentsContractsPagedSmart({ sort: 'due-desc', offset: 0, limit: 50 });
    expect(res.error).toBeUndefined();

    const ids = res.items.map((x: InstallmentsContractsItem) => String(x.contract?.رقم_العقد ?? ''));
    // contract 1 (Feb 10) then contract 3 (Feb 5), then contract 2 (no payable due)
    expect(ids).toEqual(['1', '3', '2']);
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
