import { jest } from '@jest/globals';
import type { tbl_Alerts } from '@/types';
import { DbService } from '@/services/mockDb';
import {
  buildAssignTechnicianPayloadFromAlert,
  buildDefaultWhatsAppPrefillBody,
  buildInsurancePayloadFromAlert,
  buildPersonProfilePayloadFromAlert,
  buildReceiptPayloadFromAlert,
  buildRenewContractPayloadFromAlert,
  buildWhatsAppPayloadFromAlert,
  inferWhatsAppTemplateKey,
  isValidInsurancePayload,
  isValidRenewContractPayload,
} from '@/services/alerts/alertActionPayloadBuild';

const minimalAlert = (over: Partial<tbl_Alerts>): tbl_Alerts =>
  ({
    id: 'a1',
    نوع_التنبيه: 'تنبيه',
    الوصف: 'وصف تجريبي',
    تاريخ_الانشاء: '2026-01-01',
    تم_القراءة: false,
    category: 'Financial',
    tenantName: 'أحمد',
    propertyCode: 'P-1',
    ...over,
  }) as tbl_Alerts;

describe('alertActionPayloadBuild', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('inferWhatsAppTemplateKey + buildDefaultWhatsAppPrefillBody للمالي (payment_reminder)', () => {
    const a = minimalAlert({ category: 'Financial' });
    const key = inferWhatsAppTemplateKey(a);
    expect(key).toBe('payment_reminder');
    const body = buildDefaultWhatsAppPrefillBody(a, key);
    expect(body).toContain('مرحباً');
    expect(body).toContain('أحمد');
    expect(body).toContain('وصف تجريبي');
  });

  it('inferWhatsAppTemplateKey يميّز قانوني / انتهاء / افتراضي', () => {
    expect(inferWhatsAppTemplateKey(minimalAlert({ نوع_التنبيه: 'إخطار قانوني' }))).toBe('legal_notice');
    expect(
      inferWhatsAppTemplateKey(minimalAlert({ نوع_التنبيه: 'x', الوصف: 'مراسلات legal هنا' }))
    ).toBe('legal_notice');
    expect(inferWhatsAppTemplateKey(minimalAlert({ category: 'Expiry' }))).toBe('renewal_offer');
    expect(inferWhatsAppTemplateKey(minimalAlert({ category: 'System' }))).toBe('custom');
  });

  it('buildDefaultWhatsAppPrefillBody للمالي مع تجميع عدة دفعات', () => {
    const a = minimalAlert({ category: 'Financial', count: 4 });
    const body = buildDefaultWhatsAppPrefillBody(a, 'payment_reminder');
    expect(body).toContain('4');
    expect(body).toContain('دفعات');
  });

  it('buildDefaultWhatsAppPrefillBody يتبع templateKey حتى لو اختلف تصنيف التنبيه', () => {
    const a = minimalAlert({ category: 'System' });
    const bodyRenewal = buildDefaultWhatsAppPrefillBody(a, 'renewal_offer');
    expect(bodyRenewal).toContain('للتجديد');
    const bodyLegal = buildDefaultWhatsAppPrefillBody(a, 'legal_notice');
    expect(bodyLegal).toContain('إفادتكم');
  });

  it('buildWhatsAppPayloadFromAlert يستخدم هاتف التنبيه عند توفره', () => {
    const a = minimalAlert({ phone: '0791111111' });
    const p = buildWhatsAppPayloadFromAlert(a);
    expect(p?.phone).toBe('0791111111');
    expect(p?.templateKey).toBe('payment_reminder');
  });

  it('buildRenewContractPayloadFromAlert يبني الحمولة من العقد', () => {
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      {
        رقم_العقد: 'C99',
        رقم_المستاجر: 'P77',
        رقم_العقار: 'PROP1',
        تكرار_الدفع: 12,
        القيمة_السنوية: 12000,
        تاريخ_النهاية: '2026-06-30',
      },
    ] as ReturnType<typeof DbService.getContracts>);

    const a = minimalAlert({
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'C99',
    });
    const p = buildRenewContractPayloadFromAlert(a);
    expect(p).not.toBeNull();
    expect(p?.contractId).toBe('C99');
    expect(p?.personId).toBe('P77');
    expect(p?.propertyId).toBe('PROP1');
    expect(p?.currentRent).toBe(1000);
  });

  it('buildPersonProfilePayloadFromAlert للشخص ولتصنيف Risk', () => {
    const view = buildPersonProfilePayloadFromAlert(
      minimalAlert({
        مرجع_الجدول: 'الأشخاص_tbl',
        مرجع_المعرف: '555',
        category: 'DataQuality',
      })
    );
    expect(view?.personId).toBe('555');
    expect(view?.openAction).toBe('view');

    const decision = buildPersonProfilePayloadFromAlert(
      minimalAlert({
        مرجع_الجدول: 'الأشخاص_tbl',
        مرجع_المعرف: '555',
        category: 'Risk',
      })
    );
    expect(decision?.openAction).toBe('decision');
  });

  it('buildInsurancePayloadFromAlert لعقار مع حقول ديناميكية', () => {
    jest.spyOn(DbService, 'getProperties').mockReturnValue([
      {
        رقم_العقار: 'PR1',
        حقول_ديناميكية: {
          insurance_expiry_date: '2027-01-15',
          insurance_provider: 'ACME',
        },
      },
    ] as unknown as ReturnType<typeof DbService.getProperties>);

    const a = minimalAlert({
      مرجع_الجدول: 'العقارات_tbl',
      مرجع_المعرف: 'PR1',
    });
    const ins = buildInsurancePayloadFromAlert(a);
    expect(ins?.propertyId).toBe('PR1');
    expect(ins?.expiryDate).toBe('2027-01-15');
    expect(ins?.currentProvider).toBe('ACME');
  });

  it('isValidInsurancePayload', () => {
    expect(isValidInsurancePayload({ propertyId: 'x', expiryDate: '2026-01-01' })).toBe(true);
    expect(isValidInsurancePayload({ propertyId: '', expiryDate: '2026-01-01' })).toBe(false);
    expect(isValidInsurancePayload({ propertyId: 'x', expiryDate: '31-01-2026' })).toBe(false);
    expect(isValidInsurancePayload(null)).toBe(false);
  });

  it('buildAssignTechnicianPayloadFromAlert لتذكرة صيانة', () => {
    jest.spyOn(DbService, 'getMaintenanceTickets').mockReturnValue([
      {
        رقم_التذكرة: 'T1',
        رقم_العقار: 'PROP9',
        الوصف: 'تسريب',
        الأولوية: 'عالية',
        حقول_ديناميكية: {},
      },
    ] as unknown as ReturnType<typeof DbService.getMaintenanceTickets>);

    const a = minimalAlert({
      مرجع_الجدول: 'تذاكر_الصيانة_tbl',
      مرجع_المعرف: 'T1',
    });
    const p = buildAssignTechnicianPayloadFromAlert(a);
    expect(p?.maintenanceId).toBe('T1');
    expect(p?.propertyId).toBe('PROP9');
    expect(p?.priority).toBe('high');
  });

  it('buildReceiptPayloadFromAlert من كمبيالة مع تاريخ دفع', () => {
    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      {
        رقم_الكمبيالة: 'INS1',
        رقم_العقد: 'C1',
        القيمة: 500,
        تاريخ_الدفع: '2026-03-10',
        حالة_الكمبيالة: 'مدفوع',
        سجل_الدفعات: [],
      },
    ] as ReturnType<typeof DbService.getInstallments>);
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'C1', رقم_المستاجر: 'P1', رقم_العقار: 'PR' },
    ] as ReturnType<typeof DbService.getContracts>);

    const a = minimalAlert({
      مرجع_الجدول: 'الكمبيالات_tbl',
      مرجع_المعرف: 'INS1',
    });
    const r = buildReceiptPayloadFromAlert(a);
    expect(r?.installmentId).toBe('INS1');
    expect(r?.contractId).toBe('C1');
    expect(r?.personId).toBe('P1');
    expect(r?.paidAt).toMatch(/^2026-03-10/);
    expect(r?.amount).toBe(500);
  });

  it('isValidRenewContractPayload يقبل حمولة سليمة ويرفض أخطاء', () => {
    expect(
      isValidRenewContractPayload({
        contractId: 'c1',
        personId: 'p1',
        propertyId: 'pr1',
        currentRent: 350,
        expiryDate: '2026-12-31',
      })
    ).toBe(true);

    expect(
      isValidRenewContractPayload({
        contractId: '',
        personId: 'p1',
        propertyId: 'pr1',
        currentRent: 350,
        expiryDate: '2026-12-31',
      })
    ).toBe(false);

    expect(
      isValidRenewContractPayload({
        contractId: 'c1',
        personId: 'p1',
        propertyId: 'pr1',
        currentRent: -1,
        expiryDate: '2026-12-31',
      })
    ).toBe(false);

    expect(
      isValidRenewContractPayload({
        contractId: 'c1',
        personId: 'p1',
        propertyId: 'pr1',
        currentRent: 100,
        expiryDate: '31-12-2026',
      })
    ).toBe(false);
  });

  it('buildWhatsAppPayloadFromAlert يجمع الهاتف من الأشخاص_tbl', () => {
    jest.spyOn(DbService, 'getPeople').mockReturnValue([
      { رقم_الشخص: 'P9', رقم_الهاتف: '0792222222', رقم_هاتف_اضافي: null },
    ] as ReturnType<typeof DbService.getPeople>);
    const a = minimalAlert({
      phone: undefined,
      مرجع_الجدول: 'الأشخاص_tbl',
      مرجع_المعرف: 'P9',
    });
    const p = buildWhatsAppPayloadFromAlert(a);
    expect(p?.phone).toBe('0792222222');
    expect(p?.personId).toBe('P9');
  });

  it('buildWhatsAppPayloadFromAlert يجمع هاتف المستأجر من العقد', () => {
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'CX', رقم_المستاجر: 'TEN1', رقم_العقار: 'X' },
    ] as ReturnType<typeof DbService.getContracts>);
    jest.spyOn(DbService, 'getPeople').mockReturnValue([
      { رقم_الشخص: 'TEN1', رقم_الهاتف: '0793333333', رقم_هاتف_اضافي: '' },
    ] as ReturnType<typeof DbService.getPeople>);
    const a = minimalAlert({
      phone: undefined,
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'CX',
    });
    const p = buildWhatsAppPayloadFromAlert(a);
    expect(p?.phone).toBe('0793333333');
    expect(p?.personId).toBe('TEN1');
  });

  it('buildWhatsAppPayloadFromAlert يجمع هاتف المستأجر عبر الكمبيالة', () => {
    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      { رقم_الكمبيالة: 'K1', رقم_العقد: 'CC1' },
    ] as ReturnType<typeof DbService.getInstallments>);
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'CC1', رقم_المستاجر: 'T2', رقم_العقار: 'P' },
    ] as ReturnType<typeof DbService.getContracts>);
    jest.spyOn(DbService, 'getPeople').mockReturnValue([
      { رقم_الشخص: 'T2', رقم_الهاتف: '0794444444' },
    ] as ReturnType<typeof DbService.getPeople>);
    const a = minimalAlert({
      phone: undefined,
      مرجع_الجدول: 'الكمبيالات_tbl',
      مرجع_المعرف: 'K1',
    });
    expect(buildWhatsAppPayloadFromAlert(a)?.phone).toBe('0794444444');
  });

  it('buildWhatsAppPayloadFromAlert يعيد null عند غياب الأرقام', () => {
    jest.spyOn(DbService, 'getPeople').mockReturnValue([]);
    jest.spyOn(DbService, 'getContracts').mockReturnValue([]);
    jest.spyOn(DbService, 'getInstallments').mockReturnValue([]);
    expect(buildWhatsAppPayloadFromAlert(minimalAlert({ phone: '' }))).toBeNull();
  });

  it('buildDefaultWhatsAppPrefillBody — payment_reminder لغير المالي وقالب custom', () => {
    const nonFin = buildDefaultWhatsAppPrefillBody(minimalAlert({ category: 'System' }), 'payment_reminder');
    expect(nonFin).toContain('تذكير بالسداد');
    const custom = buildDefaultWhatsAppPrefillBody(minimalAlert({ الوصف: 'نص مخصص' }), 'custom');
    expect(custom).toContain('نص مخصص');
    expect(custom).toContain('إشعار بخصوص العقار');
  });

  it('buildRenewContractPayloadFromAlert يعيد null للحالات الحدية', () => {
    expect(buildRenewContractPayloadFromAlert(minimalAlert({ مرجع_الجدول: 'الأشخاص_tbl' }))).toBeNull();
    expect(buildRenewContractPayloadFromAlert(minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'batch' }))).toBeNull();
    jest.spyOn(DbService, 'getContracts').mockReturnValue([]);
    expect(
      buildRenewContractPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'MISS' })
      )
    ).toBeNull();
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      {
        رقم_العقد: 'C0',
        رقم_المستاجر: '',
        رقم_العقار: 'P',
        تكرار_الدفع: 1,
        القيمة_السنوية: 1000,
        تاريخ_النهاية: '2026-01-01',
      },
    ] as ReturnType<typeof DbService.getContracts>);
    expect(
      buildRenewContractPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'C0' })
      )
    ).toBeNull();
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      {
        رقم_العقد: 'C0b',
        رقم_المستاجر: 'U',
        رقم_العقار: '',
        تكرار_الدفع: 1,
        القيمة_السنوية: 1000,
        تاريخ_النهاية: '2026-01-01',
      },
    ] as ReturnType<typeof DbService.getContracts>);
    expect(
      buildRenewContractPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'C0b' })
      )
    ).toBeNull();
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      {
        رقم_العقد: 'C0c',
        رقم_المستاجر: 'U',
        رقم_العقار: 'P',
        تكرار_الدفع: 1,
        القيمة_السنوية: Number.NaN,
        تاريخ_النهاية: '2026-01-01',
      },
    ] as ReturnType<typeof DbService.getContracts>);
    expect(
      buildRenewContractPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'C0c' })
      )
    ).toBeNull();
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      {
        رقم_العقد: 'C0d',
        رقم_المستاجر: 'U',
        رقم_العقار: 'P',
        تكرار_الدفع: 1,
        القيمة_السنوية: 1200,
        تاريخ_النهاية: 'غير-تاريخ',
      },
    ] as ReturnType<typeof DbService.getContracts>);
    expect(
      buildRenewContractPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'C0d' })
      )
    ).toBeNull();
  });

  it('buildPersonProfilePayloadFromAlert من عقد مع مستأجر', () => {
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'C55', رقم_المستاجر: 'Z1', رقم_العقار: 'PR' },
    ] as ReturnType<typeof DbService.getContracts>);
    const p = buildPersonProfilePayloadFromAlert(
      minimalAlert({
        مرجع_الجدول: 'العقود_tbl',
        مرجع_المعرف: 'C55',
        category: 'Expiry',
      })
    );
    expect(p?.personId).toBe('Z1');
    expect(p?.contractId).toBe('C55');
    expect(p?.openAction).toBe('view');
  });

  it('buildPersonProfilePayloadFromAlert يعيد null عند عدم استنتاج شخص', () => {
    jest.spyOn(DbService, 'getContracts').mockReturnValue([]);
    expect(buildPersonProfilePayloadFromAlert(minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'X' }))).toBeNull();
  });

  it('buildInsurancePayloadFromAlert يعيد null لمرجع جدول غير مدعوم', () => {
    expect(
      buildInsurancePayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'الأشخاص_tbl', مرجع_المعرف: 'P1' })
      )
    ).toBeNull();
  });

  it('buildInsurancePayloadFromAlert لعقد ولمفتاح تاريخ بديل', () => {
    jest.spyOn(DbService, 'getProperties').mockReturnValue([]);
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'CINS2', رقم_العقار: 'PROPZ', تاريخ_النهاية: '2028-02-01T00:00:00.000Z' },
    ] as ReturnType<typeof DbService.getContracts>);
    const fromContract = buildInsurancePayloadFromAlert(
      minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'CINS2' })
    );
    expect(fromContract?.propertyId).toBe('PROPZ');
    expect(fromContract?.expiryDate).toContain('2028');

    jest.spyOn(DbService, 'getProperties').mockReturnValue([
      {
        رقم_العقار: 'PR_ALT',
        حقول_ديناميكية: { تاريخ_انتهاء_التأمين: '2026-06-01', policy_ref: 'POL99' },
      },
    ] as unknown as ReturnType<typeof DbService.getProperties>);
    const fromProp = buildInsurancePayloadFromAlert(
      minimalAlert({ مرجع_الجدول: 'العقارات_tbl', مرجع_المعرف: 'PR_ALT' })
    );
    expect(fromProp?.expiryDate).toBe('2026-06-01');
    expect(fromProp?.currentPolicyRef).toBe('POL99');

    jest.spyOn(DbService, 'getProperties').mockReturnValue([]);
    expect(buildInsurancePayloadFromAlert(minimalAlert({ مرجع_الجدول: 'العقارات_tbl', مرجع_المعرف: 'NOP' }))).toBeNull();
  });

  it('buildAssignTechnicianPayloadFromAlert — أولويات ومسار فارغ', () => {
    expect(buildAssignTechnicianPayloadFromAlert(minimalAlert({ مرجع_الجدول: 'العقود_tbl' }))).toBeNull();
    expect(
      buildAssignTechnicianPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'تذاكر_الصيانة_tbl', مرجع_المعرف: 'batch' })
      )
    ).toBeNull();
    jest.spyOn(DbService, 'getMaintenanceTickets').mockReturnValue([]);
    expect(
      buildAssignTechnicianPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'تذاكر_الصيانة_tbl', مرجع_المعرف: 'NO' })
      )
    ).toBeNull();

    jest.spyOn(DbService, 'getMaintenanceTickets').mockReturnValue([
      {
        رقم_التذكرة: 'TLOW',
        رقم_العقار: 'P1',
        الوصف: '',
        الأولوية: 'منخفضة',
        حقول_ديناميكية: { رقم_الشقة: '12' },
      },
    ] as unknown as ReturnType<typeof DbService.getMaintenanceTickets>);
    const low = buildAssignTechnicianPayloadFromAlert(
      minimalAlert({ مرجع_الجدول: 'تذاكر_الصيانة_tbl', مرجع_المعرف: 'TLOW' })
    );
    expect(low?.priority).toBe('low');
    expect(low?.unitRef).toBe('12');
    expect(low?.issueDescription).toBe('—');

    jest.spyOn(DbService, 'getMaintenanceTickets').mockReturnValue([
      {
        رقم_التذكرة: 'THI',
        رقم_العقار: 'P1',
        الوصف: 'تسريب',
        الأولوية: 'عالية',
        حقول_ديناميكية: {},
      },
    ] as unknown as ReturnType<typeof DbService.getMaintenanceTickets>);
    expect(
      buildAssignTechnicianPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'تذاكر_الصيانة_tbl', مرجع_المعرف: 'THI' })
      )?.priority
    ).toBe('high');

    jest.spyOn(DbService, 'getMaintenanceTickets').mockReturnValue([
      {
        رقم_التذكرة: 'TMED',
        رقم_العقار: 'P1',
        الوصف: 'x',
        الأولوية: 'متوسطة',
        حقول_ديناميكية: {},
      },
    ] as unknown as ReturnType<typeof DbService.getMaintenanceTickets>);
    expect(
      buildAssignTechnicianPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'تذاكر_الصيانة_tbl', مرجع_المعرف: 'TMED' })
      )?.priority
    ).toBe('medium');
  });

  it('buildReceiptPayloadFromAlert من سجل_الدفعات ورفض بلا تاريخ', () => {
    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      {
        رقم_الكمبيالة: 'INSL',
        رقم_العقد: 'C2',
        القيمة: 0,
        تاريخ_الدفع: '',
        حالة_الكمبيالة: '—',
        سجل_الدفعات: [
          { التاريخ: '2026-01-10', المبلغ: 50, الملاحظات: 'نقدي' },
          { التاريخ: '2026-02-11', المبلغ: 75, النوع: 'شيك' },
        ],
      },
    ] as ReturnType<typeof DbService.getInstallments>);
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'C2', رقم_المستاجر: 'P9', رقم_العقار: 'PR' },
    ] as ReturnType<typeof DbService.getContracts>);
    const r = buildReceiptPayloadFromAlert(
      minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'INSL' })
    );
    expect(r?.paidAt).toMatch(/^2026-02-11/);
    expect(r?.amount).toBe(75);
    expect(r?.paymentMethod).toBe('شيك');

    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      {
        رقم_الكمبيالة: 'INSNAT',
        رقم_العقد: 'C2',
        القيمة: 0,
        تاريخ_الدفع: '',
        حالة_الكمبيالة: '—',
        سجل_الدفعات: [{ التاريخ: 'March 20, 2026', المبلغ: 99, النوع: 'تحويل' }],
      },
    ] as unknown as ReturnType<typeof DbService.getInstallments>);
    const rNat = buildReceiptPayloadFromAlert(
      minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'INSNAT' })
    );
    expect(rNat?.paidAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rNat?.amount).toBe(99);

    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      {
        رقم_الكمبيالة: 'INSX',
        رقم_العقد: 'C2',
        القيمة: 10,
        تاريخ_الدفع: '',
        سجل_الدفعات: [],
      },
    ] as ReturnType<typeof DbService.getInstallments>);
    expect(
      buildReceiptPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'INSX' })
      )
    ).toBeNull();

    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      {
        رقم_الكمبيالة: 'INSBAD',
        رقم_العقد: 'C2',
        القيمة: 10,
        تاريخ_الدفع: '',
        سجل_الدفعات: [{ التاريخ: '___not-a-date___', المبلغ: 1 }],
      },
    ] as ReturnType<typeof DbService.getInstallments>);
    expect(
      buildReceiptPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'INSBAD' })
      )
    ).toBeNull();
  });

  it('فروع إضافية: collectPhones دون مستأجر، مرتجعات مبكرة، تأمين/إيصال/فني حدية', () => {
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'C_NO_T', رقم_المستاجر: '', رقم_العقار: 'P' },
    ] as ReturnType<typeof DbService.getContracts>);
    jest.spyOn(DbService, 'getPeople').mockReturnValue([]);
    const wContractNoTenant = buildWhatsAppPayloadFromAlert(
      minimalAlert({
        phone: '0790000001',
        مرجع_الجدول: 'العقود_tbl',
        مرجع_المعرف: 'C_NO_T',
      })
    );
    expect(wContractNoTenant?.phone).toBe('0790000001');
    expect(wContractNoTenant?.personId).toBe('unknown');

    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      { رقم_الكمبيالة: 'K_EMPTY', رقم_العقد: '' },
    ] as ReturnType<typeof DbService.getInstallments>);
    jest.spyOn(DbService, 'getContracts').mockReturnValue([]);
    jest.spyOn(DbService, 'getPeople').mockReturnValue([]);
    expect(
      buildWhatsAppPayloadFromAlert(
        minimalAlert({
          phone: '0790000002',
          مرجع_الجدول: 'الكمبيالات_tbl',
          مرجع_المعرف: 'K_EMPTY',
        })
      )?.personId
    ).toBe('unknown');

    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      { رقم_الكمبيالة: 'KNT', رقم_العقد: 'CZ' },
    ] as ReturnType<typeof DbService.getInstallments>);
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'CZ', رقم_المستاجر: '', رقم_العقار: 'P' },
    ] as ReturnType<typeof DbService.getContracts>);
    expect(
      buildWhatsAppPayloadFromAlert(
        minimalAlert({
          phone: '0790000003',
          مرجع_الجدول: 'الكمبيالات_tbl',
          مرجع_المعرف: 'KNT',
        })
      )?.personId
    ).toBe('unknown');

    jest.spyOn(DbService, 'getProperties').mockReturnValue([
      {
        رقم_العقار: 'PR_BAD_INS',
        حقول_ديناميكية: { insurance_expiry_date: 'غير-صالح' },
      },
    ] as unknown as ReturnType<typeof DbService.getProperties>);
    expect(
      buildInsurancePayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'العقارات_tbl', مرجع_المعرف: 'PR_BAD_INS' })
      )
    ).toBeNull();

    jest.spyOn(DbService, 'getProperties').mockReturnValue([
      {
        رقم_العقار: 'PR_PE',
        حقول_ديناميكية: {
          insurance_expiry_date: '',
          تاريخ_انتهاء_التأمين: '  ',
          policy_expiry: '2030-05-05',
        },
      },
    ] as unknown as ReturnType<typeof DbService.getProperties>);
    expect(
      buildInsurancePayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'العقارات_tbl', مرجع_المعرف: 'PR_PE' })
      )?.expiryDate
    ).toBe('2030-05-05');

    jest.spyOn(DbService, 'getProperties').mockReturnValue([
      {
        رقم_العقار: 'PR_PROV',
        حقول_ديناميكية: {
          insurance_expiry_date: '2031-06-06',
          insurance_provider: 'ProvX',
        },
      },
    ] as unknown as ReturnType<typeof DbService.getProperties>);
    expect(
      buildInsurancePayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'العقارات_tbl', مرجع_المعرف: 'PR_PROV' })
      )?.currentProvider
    ).toBe('ProvX');

    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'CBAD', رقم_العقار: '', تاريخ_النهاية: '2026-01-01' },
    ] as ReturnType<typeof DbService.getContracts>);
    expect(
      buildInsurancePayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'CBAD' })
      )
    ).toBeNull();

    expect(buildReceiptPayloadFromAlert(minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'X' }))).toBeNull();
    expect(
      buildReceiptPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: '' })
      )
    ).toBeNull();
    expect(
      buildReceiptPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'batch' })
      )
    ).toBeNull();

    jest.spyOn(DbService, 'getInstallments').mockReturnValue([]);
    expect(
      buildReceiptPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'NOPE' })
      )
    ).toBeNull();

    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      {
        رقم_الكمبيالة: 'NOC',
        رقم_العقد: '   ',
        القيمة: 1,
        تاريخ_الدفع: '2026-01-01',
        سجل_الدفعات: [],
      },
    ] as ReturnType<typeof DbService.getInstallments>);
    expect(
      buildReceiptPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'NOC' })
      )
    ).toBeNull();

    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      { رقم_الكمبيالة: 'NOP', رقم_العقد: 'C99', سجل_الدفعات: [] },
    ] as ReturnType<typeof DbService.getInstallments>);
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'C99', رقم_المستاجر: '', رقم_العقار: 'PR' },
    ] as ReturnType<typeof DbService.getContracts>);
    expect(
      buildReceiptPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'NOP' })
      )
    ).toBeNull();

    jest.spyOn(DbService, 'getInstallments').mockReturnValue([
      {
        رقم_الكمبيالة: 'INSNOTE',
        رقم_العقد: 'C2',
        القيمة: 0,
        تاريخ_الدفع: '',
        سجل_الدفعات: [{ التاريخ: '2026-04-01', المبلغ: 10, الملاحظات: 'كاش فقط' }],
      },
    ] as ReturnType<typeof DbService.getInstallments>);
    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      { رقم_العقد: 'C2', رقم_المستاجر: 'P9', رقم_العقار: 'PR' },
    ] as ReturnType<typeof DbService.getContracts>);
    expect(
      buildReceiptPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'INSNOTE' })
      )?.paymentMethod
    ).toBe('كاش فقط');

    jest.spyOn(DbService, 'getMaintenanceTickets').mockReturnValue([
      {
        رقم_التذكرة: 'TNP',
        رقم_العقار: '',
        الوصف: 'x',
        الأولوية: 'منخفضة',
        حقول_ديناميكية: {},
      },
    ] as unknown as ReturnType<typeof DbService.getMaintenanceTickets>);
    expect(
      buildAssignTechnicianPayloadFromAlert(
        minimalAlert({ مرجع_الجدول: 'تذاكر_الصيانة_tbl', مرجع_المعرف: 'TNP' })
      )
    ).toBeNull();

    expect(isValidRenewContractPayload('x' as unknown)).toBe(false);
    expect(
      isValidRenewContractPayload({
        contractId: 'c1',
        personId: 'p1',
        propertyId: 'pr1',
        currentRent: Number.NaN,
        expiryDate: '2026-12-31',
      })
    ).toBe(false);

    expect(isValidInsurancePayload(undefined)).toBe(false);

    const bodyDefaults = buildDefaultWhatsAppPrefillBody(
      minimalAlert({
        tenantName: undefined,
        propertyCode: undefined,
        الوصف: 'تجربة',
        category: 'System',
      }),
      'custom'
    );
    expect(bodyDefaults).toContain('المستأجر الكريم');
    expect(bodyDefaults).toContain('—');

    jest.spyOn(DbService, 'getContracts').mockReturnValue([
      {
        رقم_العقد: 'CF0',
        رقم_المستاجر: 'U',
        رقم_العقار: 'P',
        تكرار_الدفع: 0,
        القيمة_السنوية: 1200,
        تاريخ_النهاية: '2026-12-31',
      },
    ] as ReturnType<typeof DbService.getContracts>);
    const renewZeroFreq = buildRenewContractPayloadFromAlert(
      minimalAlert({ مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'CF0' })
    );
    expect(renewZeroFreq?.currentRent).toBe(1200);
  });
});
