import { INSTALLMENT_STATUS } from '@/components/installments/installmentsConstants';
import {
  domainGetSmart,
  domainSearchGlobalSmart,
  domainSearchSmart,
  installmentsContractsPagedSmart,
  paymentNotificationTargetsSmart,
  peoplePickerSearchPagedSmart,
  propertyContractsSmart,
} from '@/services/domainQueries';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';
import { formatDateOnly } from '@/utils/dateOnly';

const addDays = (base: Date, days: number) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

describe('installmentsContractsPagedSmart web memory path', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).desktopDb;
  });

  function seedInstallmentsMatrix() {
    const people = [
      { رقم_الشخص: 'T1', الاسم: 'Tenant One', رقم_الهاتف: '0791111111', الرقم_الوطني: '' },
    ];
    const properties = [
      {
        رقم_العقار: 'P1',
        الكود_الداخلي: 'CODE-1',
        رقم_المالك: 'O1',
        العنوان: 'addr',
        النوع: 'شقة',
        حالة_العقار: 'مؤجر',
        IsRented: true,
        المساحة: 90,
      },
    ];
    const contracts = [
      {
        رقم_العقد: 'C_DEBT',
        رقم_المستاجر: 'T1',
        رقم_العقار: 'P1',
        حالة_العقد: 'نشط',
        isArchived: false,
        تاريخ_البداية: '2026-01-01',
        تاريخ_النهاية: '2027-01-01',
        القيمة_السنوية: 12000,
        طريقة_الدفع: 'Cash',
        تكرار_الدفع: 1,
        مدة_العقد_بالاشهر: 12,
        lateFeeType: 'none',
        lateFeeValue: 0,
        lateFeeGraceDays: 0,
      },
      {
        رقم_العقد: 'C_DUE',
        رقم_المستاجر: 'T1',
        رقم_العقار: 'P1',
        حالة_العقد: 'نشط',
        isArchived: false,
        تاريخ_البداية: '2026-01-01',
        تاريخ_النهاية: '2027-01-01',
        القيمة_السنوية: 6000,
        طريقة_الدفع: 'cash',
        تكرار_الدفع: 1,
        مدة_العقد_بالاشهر: 12,
        lateFeeType: 'none',
        lateFeeValue: 0,
        lateFeeGraceDays: 0,
      },
      {
        رقم_العقد: 'C_PAID',
        رقم_المستاجر: 'T1',
        رقم_العقار: 'P1',
        حالة_العقد: 'نشط',
        isArchived: false,
        تاريخ_البداية: '2026-01-01',
        تاريخ_النهاية: '2027-01-01',
        القيمة_السنوية: 3000,
        طريقة_الدفع: 'Bank',
        تكرار_الدفع: 1,
        مدة_العقد_بالاشهر: 12,
        lateFeeType: 'none',
        lateFeeValue: 0,
        lateFeeGraceDays: 0,
      },
    ];

    const dueSoon = formatDateOnly(addDays(new Date(), 4));
    const duePast = '2020-01-15';

    const installments = [
      {
        رقم_الكمبيالة: 'I-DEBT',
        رقم_العقد: 'C_DEBT',
        نوع_الكمبيالة: 'إيجار',
        حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
        القيمة: 500,
        القيمة_المتبقية: 500,
        تاريخ_استحقاق: duePast,
      },
      {
        رقم_الكمبيالة: 'I-DUE',
        رقم_العقد: 'C_DUE',
        نوع_الكمبيالة: 'إيجار',
        حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
        القيمة: 400,
        القيمة_المتبقية: 400,
        تاريخ_استحقاق: dueSoon,
      },
      {
        رقم_الكمبيالة: 'I-PAID',
        رقم_العقد: 'C_PAID',
        نوع_الكمبيالة: 'إيجار',
        حالة_الكمبيالة: INSTALLMENT_STATUS.PAID,
        القيمة: 300,
        القيمة_المتبقية: 0,
        تاريخ_استحقاق: '2025-06-01',
      },
      {
        رقم_الكمبيالة: 'I-INS',
        رقم_العقد: 'C_PAID',
        نوع_الكمبيالة: 'تأمين',
        حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
        القيمة: 999,
        القيمة_المتبقية: 999,
        تاريخ_استحقاق: duePast,
      },
      {
        رقم_الكمبيالة: 'I-CAN',
        رقم_العقد: 'C_PAID',
        نوع_الكمبيالة: 'إيجار',
        حالة_الكمبيالة: INSTALLMENT_STATUS.CANCELLED,
        القيمة: 200,
        القيمة_المتبقية: 200,
        تاريخ_استحقاق: duePast,
      },
    ];

    localStorage.setItem(KEYS.PEOPLE, JSON.stringify(people));
    localStorage.setItem(KEYS.PROPERTIES, JSON.stringify(properties));
    localStorage.setItem(KEYS.CONTRACTS, JSON.stringify(contracts));
    localStorage.setItem(KEYS.INSTALLMENTS, JSON.stringify(installments));
    localStorage.setItem(KEYS.ROLES, JSON.stringify([]));
    buildCache();
  }

  test('filters debt, due, paid and payment method', async () => {
    seedInstallmentsMatrix();
    const debt = await installmentsContractsPagedSmart({
      query: '',
      filter: 'debt',
      offset: 0,
      limit: 50,
    });
    expect(debt.items.some((x) => String(x?.contract?.رقم_العقد) === 'C_DEBT')).toBe(true);

    const due = await installmentsContractsPagedSmart({
      query: '',
      filter: 'due',
      offset: 0,
      limit: 50,
    });
    expect(due.items.some((x) => String(x?.contract?.رقم_العقد) === 'C_DUE')).toBe(true);

    const paid = await installmentsContractsPagedSmart({
      query: '',
      filter: 'paid',
      offset: 0,
      limit: 50,
    });
    expect(paid.items.some((x) => String(x?.contract?.رقم_العقد) === 'C_PAID')).toBe(true);

    const cash = await installmentsContractsPagedSmart({
      query: '',
      filter: 'all',
      filterPaymentMethod: 'cash',
      offset: 0,
      limit: 50,
    });
    expect(
      cash.items.every((x) => String(x?.contract?.طريقة_الدفع || '').toLowerCase() === 'cash')
    ).toBe(true);
  });

  test('text query and date or amount filters', async () => {
    seedInstallmentsMatrix();
    const q = await installmentsContractsPagedSmart({
      query: 'code-1',
      filter: 'all',
      offset: 0,
      limit: 50,
    });
    expect(q.total).toBeGreaterThanOrEqual(1);

    const byStart = await installmentsContractsPagedSmart({
      query: '',
      filter: 'all',
      filterStartDate: '2020-01-01',
      filterEndDate: '2030-12-31',
      offset: 0,
      limit: 50,
    });
    expect(byStart.total).toBeGreaterThanOrEqual(1);

    const byAmt = await installmentsContractsPagedSmart({
      query: '',
      filter: 'all',
      filterMinAmount: 350,
      filterMaxAmount: 450,
      offset: 0,
      limit: 50,
    });
    expect(byAmt.items.some((x) => String(x?.contract?.رقم_العقد) === 'C_DUE')).toBe(true);
  });

  test('sort due-desc, amount-asc, amount-desc, tenant-desc', async () => {
    seedInstallmentsMatrix();
    const d1 = await installmentsContractsPagedSmart({
      query: '',
      filter: 'all',
      sort: 'due-desc',
      offset: 0,
      limit: 10,
    });
    expect(d1.items.length).toBeGreaterThanOrEqual(1);

    const a1 = await installmentsContractsPagedSmart({
      query: '',
      filter: 'all',
      sort: 'amount-asc',
      offset: 0,
      limit: 10,
    });
    expect(a1.items.length).toBeGreaterThanOrEqual(2);

    const a2 = await installmentsContractsPagedSmart({
      query: '',
      filter: 'all',
      sort: 'amount-desc',
      offset: 0,
      limit: 10,
    });
    expect(a2.items.length).toBeGreaterThanOrEqual(2);

    const td = await installmentsContractsPagedSmart({
      query: '',
      filter: 'all',
      sort: 'tenant-desc',
      offset: 0,
      limit: 10,
    });
    expect(td.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('peoplePickerSearchPagedSmart legacy memory path', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).desktopDb;
  });

  test('role filter, address, nationalId, classification, minRating', async () => {
    localStorage.setItem(
      KEYS.PEOPLE,
      JSON.stringify([
        {
          رقم_الشخص: 'P-A',
          الاسم: 'أحمد المالك',
          رقم_الهاتف: '0790000001',
          الرقم_الوطني: '990000001',
          رقم_هاتف_اضافي: '',
          العنوان: 'عمان الجبيهة',
          تصنيف: 'VIP',
          تقييم: 5,
        },
        {
          رقم_الشخص: 'P-B',
          الاسم: 'بلال',
          رقم_الهاتف: '0790000002',
          الرقم_الوطني: '',
          رقم_هاتف_اضافي: '',
          العنوان: 'إربد',
          تصنيف: 'عادي',
          تقييم: 2,
        },
      ])
    );
    localStorage.setItem(
      KEYS.PROPERTIES,
      JSON.stringify([
        {
          رقم_العقار: 'PR-X',
          الكود_الداخلي: 'X',
          رقم_المالك: 'P-A',
          النوع: 'شقة',
          العنوان: '',
          حالة_العقار: 'شاغر',
          IsRented: false,
          المساحة: 100,
        },
      ])
    );
    localStorage.setItem(KEYS.CONTRACTS, JSON.stringify([]));
    localStorage.setItem(
      KEYS.ROLES,
      JSON.stringify([
        { رقم_الشخص: 'P-A', الدور: 'مالك' },
        { رقم_الشخص: 'P-B', الدور: 'مستأجر' },
      ])
    );
    localStorage.setItem(KEYS.INSTALLMENTS, JSON.stringify([]));
    localStorage.setItem(
      KEYS.BLACKLIST,
      JSON.stringify([{ id: 'BL-1', personId: 'P-B', isActive: true, reason: 'x' }])
    );
    buildCache();

    const owners = await peoplePickerSearchPagedSmart({
      query: '',
      role: 'مالك',
      offset: 0,
      limit: 20,
    });
    expect(owners.items.some((x) => String(x?.person?.رقم_الشخص) === 'P-A')).toBe(true);

    const idle = await peoplePickerSearchPagedSmart({
      query: '',
      role: 'مالك',
      onlyIdleOwners: true,
      offset: 0,
      limit: 20,
    });
    expect(idle.items.some((x) => String(x?.person?.رقم_الشخص) === 'P-A')).toBe(true);

    const bl = await peoplePickerSearchPagedSmart({
      query: '',
      role: 'blacklisted',
      offset: 0,
      limit: 20,
    });
    expect(bl.items.some((x) => String(x?.person?.رقم_الشخص) === 'P-B')).toBe(true);

    const addr = await peoplePickerSearchPagedSmart({
      query: '',
      role: '',
      address: 'جبيهة',
      offset: 0,
      limit: 20,
    });
    expect(addr.items).toHaveLength(1);

    const nid = await peoplePickerSearchPagedSmart({
      query: '',
      role: '',
      nationalId: '990000001',
      offset: 0,
      limit: 20,
    });
    expect(nid.items).toHaveLength(1);

    const cls = await peoplePickerSearchPagedSmart({
      query: '',
      role: '',
      classification: 'VIP',
      offset: 0,
      limit: 20,
    });
    expect(cls.items).toHaveLength(1);

    const rated = await peoplePickerSearchPagedSmart({
      query: '',
      role: '',
      minRating: 4,
      offset: 0,
      limit: 20,
    });
    expect(rated.items).toHaveLength(1);
  });
});

describe('domainGetSmart + propertyContracts + payment targets (web)', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).desktopDb;
  });

  test('domainSearchGlobalSmart returns empty for blank query', async () => {
    const r = await domainSearchGlobalSmart('   ');
    expect(r.people).toEqual([]);
    expect(r.contracts).toEqual([]);
  });

  test('domainGetSmart resolves people, properties, contracts from KV', async () => {
    localStorage.setItem(
      KEYS.PEOPLE,
      JSON.stringify([
        { رقم_الشخص: 'PX', الاسم: 'TenantX', رقم_الهاتف: '', الرقم_الوطني: '' },
        { رقم_الشخص: 'PG', الاسم: 'GuarX', رقم_الهاتف: '', الرقم_الوطني: '' },
      ])
    );
    localStorage.setItem(
      KEYS.PROPERTIES,
      JSON.stringify([
        {
          رقم_العقار: 'PRX',
          الكود_الداخلي: 'C',
          رقم_المالك: 'PX',
          النوع: 'شقة',
          العنوان: '',
          حالة_العقار: 'شاغر',
          IsRented: false,
          المساحة: 50,
        },
      ])
    );
    localStorage.setItem(
      KEYS.CONTRACTS,
      JSON.stringify([
        {
          رقم_العقد: 'CX',
          رقم_المستاجر: 'PX',
          رقم_العقار: 'PRX',
          رقم_الكفيل: 'PG',
          حالة_العقد: 'نشط',
          isArchived: false,
          تاريخ_البداية: '2026-01-01',
          تاريخ_النهاية: '2027-01-01',
          القيمة_السنوية: 1000,
          تكرار_الدفع: 1,
          مدة_العقد_بالاشهر: 12,
          طريقة_الدفع: 'Cash',
          lateFeeType: 'none',
          lateFeeValue: 0,
          lateFeeGraceDays: 0,
        },
      ])
    );
    localStorage.setItem(KEYS.INSTALLMENTS, JSON.stringify([]));
    localStorage.setItem(KEYS.ROLES, JSON.stringify([]));
    buildCache();

    const p = await domainGetSmart('people', 'PX');
    expect(String((p as { الاسم?: string })?.الاسم)).toBe('TenantX');

    const pr = await domainGetSmart('properties', 'PRX');
    expect(String((pr as { الكود_الداخلي?: string })?.الكود_الداخلي)).toBe('C');

    const c = await domainGetSmart('contracts', 'CX');
    expect(String((c as { رقم_العقد?: string })?.رقم_العقد)).toBe('CX');

    const pc = await propertyContractsSmart('PRX', 100);
    expect(pc?.length).toBe(1);
    expect(String(pc?.[0]?.tenantName)).toContain('Tenant');
    expect(String(pc?.[0]?.guarantorName)).toContain('Guar');
  });

  test('domainSearchSmart agreements entity falls through to contract list filter', async () => {
    localStorage.setItem(KEYS.CONTRACTS, JSON.stringify([{ رقم_العقد: 'AG1', حالة_العقد: 'نشط' }]));
    localStorage.setItem(KEYS.PEOPLE, JSON.stringify([]));
    localStorage.setItem(KEYS.PROPERTIES, JSON.stringify([]));
    localStorage.setItem(KEYS.INSTALLMENTS, JSON.stringify([]));
    localStorage.setItem(KEYS.ROLES, JSON.stringify([]));
    buildCache();
    const r = await domainSearchSmart('agreements', 'ag1', 20);
    expect(r).toHaveLength(1);
  });

  test('paymentNotificationTargetsSmart reads renderer targets when not desktop', async () => {
    const dueSoon = formatDateOnly(addDays(new Date(), 2));
    localStorage.setItem(
      KEYS.PEOPLE,
      JSON.stringify([
        { رقم_الشخص: 'TN', الاسم: 'TenantN', رقم_الهاتف: '0791111000', الرقم_الوطني: '' },
      ])
    );
    localStorage.setItem(
      KEYS.PROPERTIES,
      JSON.stringify([
        {
          رقم_العقار: 'PN',
          الكود_الداخلي: 'PCN',
          رقم_المالك: 'TN',
          النوع: 'شقة',
          العنوان: '',
          حالة_العقار: 'مؤجر',
          IsRented: true,
          المساحة: 80,
        },
      ])
    );
    localStorage.setItem(
      KEYS.CONTRACTS,
      JSON.stringify([
        {
          رقم_العقد: 'CN',
          رقم_المستاجر: 'TN',
          رقم_العقار: 'PN',
          حالة_العقد: 'نشط',
          isArchived: false,
          تاريخ_البداية: '2026-01-01',
          تاريخ_النهاية: '2027-01-01',
          القيمة_السنوية: 5000,
          تكرار_الدفع: 1,
          مدة_العقد_بالاشهر: 12,
          طريقة_الدفع: 'Cash',
          lateFeeType: 'none',
          lateFeeValue: 0,
          lateFeeGraceDays: 0,
        },
      ])
    );
    localStorage.setItem(
      KEYS.INSTALLMENTS,
      JSON.stringify([
        {
          رقم_الكمبيالة: 'IN-PAY',
          رقم_العقد: 'CN',
          نوع_الكمبيالة: 'إيجار',
          حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
          القيمة: 200,
          القيمة_المتبقية: 200,
          تاريخ_استحقاق: dueSoon,
        },
      ])
    );
    localStorage.setItem(KEYS.ROLES, JSON.stringify([]));
    buildCache();

    const r = await paymentNotificationTargetsSmart({ daysAhead: 14 });
    expect(Array.isArray(r)).toBe(true);
    expect(r!.length).toBeGreaterThanOrEqual(1);
    expect(String(r![0]?.contractId)).toBe('CN');
  });
});
