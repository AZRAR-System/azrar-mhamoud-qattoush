import type { tbl_Alerts } from '@/types';
import type { AlertPrimaryAction, AlertSecondaryAction } from '@/services/alerts/alertActionTypes';
import type { OpenModalFn } from '@/context/ModalContext';
import {
  ALERT_TITLE_REMINDER_7D,
  ALERT_TITLE_RISK_COLLECTION,
  buildAlertsHashSuffix,
  classifyAlert,
  executeAction,
  executeNavigateForAlert,
  executeAlertOpen,
  getAlertPrimarySpec,
  intentKeyOf,
  isTasksFollowUpTitle,
  resetExecuteActionDedupeForTests,
  resolvePrimaryAction,
  resolveSecondaryActions,
  shouldOpenModalFirst,
} from '@/services/alerts/alertActionPolicy';

const base = (over: Partial<tbl_Alerts>): tbl_Alerts =>
  ({
    id: 't1',
    نوع_التنبيه: 'اختبار',
    الوصف: 'وصف',
    تاريخ_الانشاء: '2026-01-01',
    تم_القراءة: false,
    category: 'Financial',
    ...over,
  }) as tbl_Alerts;

describe('alertActionPolicy', () => {
  beforeEach(() => {
    resetExecuteActionDedupeForTests();
  });

  it('يفتح المودال أولاً للمالي وجودة البيانات', () => {
    expect(shouldOpenModalFirst(base({ category: 'Financial' }))).toBe(true);
    expect(shouldOpenModalFirst(base({ category: 'DataQuality' }))).toBe(true);
    expect(getAlertPrimarySpec(base({ category: 'Financial' })).mode).toBe('modal');
  });

  it('Expiry + عقد: زر مباشر للوجهة', () => {
    const a = base({
      category: 'Expiry',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_001',
    });
    expect(shouldOpenModalFirst(a)).toBe(false);
    expect(getAlertPrimarySpec(a)).toEqual(
      expect.objectContaining({ mode: 'destination', label: 'فتح العقد' })
    );
  });

  it('قرب انتهاء العقد / تجديد تلقائي: تسمية تفاصيل العقد', () => {
    const near = base({
      category: 'Expiry',
      نوع_التنبيه: 'قرب انتهاء العقد',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_001',
    });
    expect(getAlertPrimarySpec(near).label).toBe('تفاصيل العقد');
    const renew = base({
      category: 'Expiry',
      نوع_التنبيه: 'تجديد تلقائي قادم',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_002',
    });
    expect(getAlertPrimarySpec(renew).label).toBe('تفاصيل العقد');
  });

  it('تذكير 7 أيام / مخاطر تحصيل: لوحة السداد مباشرة', () => {
    const reminder = base({
      category: 'Financial',
      نوع_التنبيه: ALERT_TITLE_REMINDER_7D,
      مرجع_الجدول: 'الكمبيالات_tbl',
      مرجع_المعرف: '1',
    });
    expect(shouldOpenModalFirst(reminder)).toBe(false);
    expect(getAlertPrimarySpec(reminder).mode).toBe('destination');
    expect(getAlertPrimarySpec(reminder).label).toBe('لوحة السداد');

    const riskTitle = base({
      category: 'Risk',
      نوع_التنبيه: ALERT_TITLE_RISK_COLLECTION,
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_1',
      details: [{ id: '1', name: 'x', note: 'y' }],
    });
    expect(shouldOpenModalFirst(riskTitle)).toBe(false);
    expect(getAlertPrimarySpec(riskTitle).mode).toBe('destination');
  });

  it('Risk + عقود: مودال أولاً (جدول متأخرات) عندما العنوان ليس مخاطر تحصيل', () => {
    const a = base({
      category: 'Risk',
      نوع_التنبيه: 'مخاطر أخرى',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_001',
      details: [{ id: '1', name: 'x', note: 'y' }],
    });
    expect(shouldOpenModalFirst(a)).toBe(true);
  });

  it('Risk + شخص مفرد: وجهة مباشرة', () => {
    const a = base({
      category: 'Risk',
      مرجع_الجدول: 'الأشخاص_tbl',
      مرجع_المعرف: 'p1',
    });
    expect(getAlertPrimarySpec(a).mode).toBe('destination');
    expect(getAlertPrimarySpec(a).label).toContain('فتح');
  });

  it('executeAlertOpen يستدعي openPanel بالنوع المناسب', () => {
    const calls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      calls.push(args);
    };
    executeAlertOpen(
      base({
        category: 'Expiry',
        مرجع_الجدول: 'العقود_tbl',
        مرجع_المعرف: 'cot_x',
      }),
      openPanel as never
    );
    expect(calls[0]).toEqual(['CONTRACT_DETAILS', 'cot_x']);
  });

  it('executeAlertOpen: مخاطر تحصيل → تفاصيل الدفعات مع فلترة دين', () => {
    const calls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      calls.push(args);
    };
    executeAlertOpen(
      base({
        category: 'Risk',
        نوع_التنبيه: ALERT_TITLE_RISK_COLLECTION,
        مرجع_الجدول: 'العقود_tbl',
        مرجع_المعرف: 'c1',
      }),
      openPanel as never
    );
    expect(calls[0]).toEqual([
      'SECTION_VIEW',
      '/installments',
      {
        title: 'لوحة السداد الرئيسية',
        fromAlert: true,
        contractId: 'c1',
        installmentId: '',
        filter: 'debt',
        onlyTargetPanel: true,
        intentKey: expect.any(String),
      },
    ]);
    expect(String((calls[0][2] as Record<string, unknown>).intentKey)).toContain('alerts|');
  });

  it('executeAlertOpen: صيانة → قسم الصيانة وليس تفاصيل تذكرة', () => {
    const calls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      calls.push(args);
    };
    executeAlertOpen(
      base({
        category: 'System',
        مرجع_الجدول: 'تذاكر_الصيانة_tbl',
        مرجع_المعرف: 'tk1',
      }),
      openPanel as never
    );
    expect(calls[0][0]).toBe('SECTION_VIEW');
    expect(String(calls[0][1])).toContain('maintenance');
  });

  it('isTasksFollowUpTitle يتعرّف على عناوين المهام', () => {
    expect(isTasksFollowUpTitle('المهام')).toBe(true);
    expect(isTasksFollowUpTitle('')).toBe(false);
  });

  it('resolvePrimaryAction يطابق getAlertPrimarySpec', () => {
    const a = base({ category: 'Financial' });
    expect(resolvePrimaryAction(a)).toEqual(getAlertPrimarySpec(a));
  });

  it('intentKeyOf يبني مفتاحاً ثابتاً يتضمن المعرف', () => {
    const a = base({ id: 'x1', مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'c9' });
    expect(intentKeyOf(a)).toContain('x1');
    expect(intentKeyOf(a)).toContain('العقود_tbl');
  });

  it('classifyAlert يصنّف المجموعات والمالي', () => {
    expect(classifyAlert(base({ category: 'Financial' }))).toBe('financial');
    expect(
      classifyAlert(
        base({
          category: 'Financial',
          نوع_التنبيه: ALERT_TITLE_REMINDER_7D,
        })
      )
    ).toBe('collection_board');
  });

  it('executeAction record_payment يستدعي openModal بالحمولة', () => {
    const modalCalls: unknown[][] = [];
    const openModal: OpenModalFn = (...args) => {
      modalCalls.push(args);
    };
    const openPanel = () => {};
    const alert = base({ id: 'pay1' });
    const data = {
      installmentId: 'i1',
      contractId: 'c1',
      personId: 'p1',
      amount: 100,
      lateFee: 5,
    };
    const primary: AlertPrimaryAction = { role: 'primary', mode: 'modal', label: '' };
    executeAction(primary, { variant: 'record_payment', alert, data }, openPanel as never, openModal);
    expect(modalCalls).toHaveLength(1);
    expect(modalCalls[0][0]).toBe('record_payment');
    const props = modalCalls[0][1] as Record<string, unknown>;
    expect(props.sourceAlert).toBe(alert);
    expect(props.alertActionPayload).toEqual({ variant: 'record_payment', alert, data });
  });

  it('executeAction whatsapp يستدعي openModal بالحمولة', () => {
    const modalCalls: unknown[][] = [];
    const openModal: OpenModalFn = (...args) => {
      modalCalls.push(args);
    };
    const openPanel = () => {};
    const alert = base({ id: 'w1' });
    const data = {
      personId: 'p9',
      phone: '0790000000',
      templateKey: 'payment_reminder' as const,
    };
    const secondary: AlertSecondaryAction = {
      id: 'sec-wa',
      label: 'واتساب',
      type: 'layer',
      layer: 'whatsapp',
    };
    executeAction(secondary, { variant: 'whatsapp', alert, data }, openPanel as never, openModal);
    expect(modalCalls[0][0]).toBe('whatsapp');
    const props = modalCalls[0][1] as Record<string, unknown>;
    expect(props.alertActionPayload).toEqual({ variant: 'whatsapp', alert, data });
  });

  it('executeAction renew_contract يستدعي openModal بالحمولة', () => {
    const modalCalls: unknown[][] = [];
    const openModal: OpenModalFn = (...args) => {
      modalCalls.push(args);
    };
    const openPanel = () => {};
    const alert = base({ id: 'r1' });
    const data = {
      contractId: 'c2',
      personId: 'p2',
      propertyId: 'prop2',
      currentRent: 400,
      expiryDate: '2027-06-01',
    };
    const secondary: AlertSecondaryAction = {
      id: 'sec-renew',
      label: 'تجديد',
      type: 'layer',
      layer: 'renew_contract',
    };
    executeAction(secondary, { variant: 'renew_contract', alert, data }, openPanel as never, openModal);
    expect(modalCalls[0][0]).toBe('renew_contract');
    const props = modalCalls[0][1] as Record<string, unknown>;
    expect(props.alertActionPayload).toEqual({ variant: 'renew_contract', alert, data });
  });

  it('executeAction legal_file يستدعي openModal بالحمولة', () => {
    const modalCalls: unknown[][] = [];
    const openModal: OpenModalFn = (...args) => {
      modalCalls.push(args);
    };
    const panelCalls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      panelCalls.push(args);
    };
    const alert = base({ id: 'leg1' });
    const data = { contractId: 'c9', personId: 'p2', caseRef: 'CASE-1' };
    const secondary: AlertSecondaryAction = {
      id: 'sec-legal',
      label: 'إخطار قانوني',
      type: 'layer',
      layer: 'legal_file',
    };
    executeAction(secondary, { variant: 'legal_file', alert, data }, openPanel as never, openModal);
    expect(modalCalls).toHaveLength(1);
    expect(modalCalls[0][0]).toBe('legal_file');
    const props = modalCalls[0][1] as Record<string, unknown>;
    expect(props.sourceAlert).toBe(alert);
    expect(props.alertActionPayload).toEqual({ variant: 'legal_file', alert, data });
    const onGen = props.onOpenLegalGenerator as () => void;
    onGen();
    expect(panelCalls[0]).toEqual(['LEGAL_NOTICE_GENERATOR', 'c9']);
  });

  it('executeAction person_profile + view يفتح PERSON_DETAILS دون openModal', () => {
    const modalCalls: unknown[][] = [];
    const openModal: OpenModalFn = (...args) => {
      modalCalls.push(args);
    };
    const panelCalls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      panelCalls.push(args);
    };
    const alert = base({
      id: 'pv1',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'ct1',
    });
    const data = { personId: 'per88', openAction: 'view' as const };
    const secondary: AlertSecondaryAction = {
      id: 'sec-person',
      label: 'ملف',
      type: 'layer',
      layer: 'person_profile',
    };
    executeAction(secondary, { variant: 'person_profile', alert, data }, openPanel as never, openModal);
    expect(modalCalls.length).toBe(0);
    expect(panelCalls[0]).toEqual(['PERSON_DETAILS', 'per88']);
  });

  it('executeAction insurance يستدعي openModal وonOpenContract يفتح العقار', () => {
    const modalCalls: unknown[][] = [];
    const openModal: OpenModalFn = (...args) => {
      modalCalls.push(args);
    };
    const panelCalls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      panelCalls.push(args);
    };
    const alert = base({ id: 'in1' });
    const data = {
      propertyId: 'prop-x',
      expiryDate: '2028-01-15',
      currentPolicyRef: 'POL-1',
    };
    const secondary: AlertSecondaryAction = {
      id: 'sec-ins',
      label: 'تأمين',
      type: 'layer',
      layer: 'insurance',
    };
    executeAction(secondary, { variant: 'insurance', alert, data }, openPanel as never, openModal);
    expect(modalCalls[0][0]).toBe('insurance');
    const props = modalCalls[0][1] as Record<string, unknown>;
    (props.onOpenContract as () => void)();
    expect(panelCalls[0]).toEqual(['PROPERTY_DETAILS', 'prop-x']);
  });

  it('executeAction assign_technician يستدعي openModal بالحمولة', () => {
    const modalCalls: unknown[][] = [];
    const openModal: OpenModalFn = (...args) => {
      modalCalls.push(args);
    };
    const openPanel = () => {};
    const alert = base({ id: 'as1' });
    const data = {
      maintenanceId: 'mt-1',
      propertyId: 'prop-9',
      issueDescription: 'تسريب',
      priority: 'high' as const,
    };
    const secondary: AlertSecondaryAction = {
      id: 'sec-asg',
      label: 'فني',
      type: 'layer',
      layer: 'assign_technician',
    };
    executeAction(secondary, { variant: 'assign_technician', alert, data }, openPanel as never, openModal);
    expect(modalCalls[0][0]).toBe('assign_technician');
    expect((modalCalls[0][1] as Record<string, unknown>).alertActionPayload).toEqual({
      variant: 'assign_technician',
      alert,
      data,
    });
  });

  it('executeAction receipt يستدعي openModal بالحمولة', () => {
    const modalCalls: unknown[][] = [];
    const openModal: OpenModalFn = (...args) => {
      modalCalls.push(args);
    };
    const openPanel = () => {};
    const alert = base({ id: 'rc1' });
    const data = {
      installmentId: 'ins-1',
      contractId: 'c-1',
      personId: 'p-1',
      amount: 250,
      paidAt: '2026-03-10',
      paymentMethod: 'FULL',
    };
    const secondary: AlertSecondaryAction = {
      id: 'sec-rc',
      label: 'إيصال',
      type: 'layer',
      layer: 'receipt',
    };
    executeAction(secondary, { variant: 'receipt', alert, data }, openPanel as never, openModal);
    expect(modalCalls[0][0]).toBe('receipt');
    expect((modalCalls[0][1] as Record<string, unknown>).alertActionPayload).toEqual({
      variant: 'receipt',
      alert,
      data,
    });
  });

  it('executeNavigateForAlert يمنع استدعاء openPanel مرتين بسرعة لنفس التنبيه', () => {
    const calls: unknown[][] = [];
    const openPanel = (...args: unknown[]) => {
      calls.push(args);
    };
    const noopOpenModal: OpenModalFn = () => {};
    const a = base({
      id: 'dedupe1',
      category: 'Expiry',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'cot_z',
    });
    executeNavigateForAlert(a, openPanel as never, noopOpenModal);
    executeNavigateForAlert(a, openPanel as never, noopOpenModal);
    expect(calls.length).toBe(1);
  });

  it('resolveSecondaryActions يعيد إجراءات طبقة وانتقال للمالي', () => {
    const a = base({ category: 'Financial' });
    const sec = resolveSecondaryActions(a);
    expect(sec.some((x) => x.type === 'layer' && x.layer === 'whatsapp')).toBe(true);
    expect(sec.some((x) => x.type === 'navigate')).toBe(false);
    const dest = base({
      category: 'Expiry',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'c1',
    });
    const secDest = resolveSecondaryActions(dest);
    expect(secDest.some((x) => x.type === 'navigate')).toBe(true);
  });

  it('buildAlertsHashSuffix skips blank values', () => {
    expect(buildAlertsHashSuffix({})).toBe('');
    expect(buildAlertsHashSuffix({ a: '', b: undefined })).toBe('');
    expect(buildAlertsHashSuffix({ tab: 'alerts', id: '  ' })).toBe('?tab=alerts');
  });

  it('classifyAlert maps categories and table refs', () => {
    expect(classifyAlert(base({ category: 'SmartBehavior' }))).toBe('smart_behavior');
    expect(classifyAlert(base({ category: 'Risk' }))).toBe('risk');
    expect(classifyAlert(base({ category: 'DataQuality' }))).toBe('data_quality');
    expect(classifyAlert(base({ مرجع_الجدول: 'تذاكر_الصيانة_tbl' }))).toBe('maintenance');
    expect(classifyAlert(base({ مرجع_الجدول: 'العقارات_tbl', category: 'System' }))).toBe(
      'property'
    );
    expect(classifyAlert(base({ مرجع_الجدول: 'الأشخاص_tbl', category: 'System' }))).toBe('person');
    expect(classifyAlert(base({ مرجع_الجدول: 'الكمبيالات_tbl', category: 'System' }))).toBe(
      'installment'
    );
    expect(classifyAlert(base({ مرجع_الجدول: 'System', category: 'System' }))).toBe('system');
    expect(classifyAlert(base({ category: 'System', مرجع_الجدول: '' }))).toBe('generic');
  });

  it('resolveSecondaryActions risk on person adds profile layer', () => {
    const a = base({
      category: 'Risk',
      مرجع_الجدول: 'الأشخاص_tbl',
      مرجع_المعرف: 'per-99',
    });
    const sec = resolveSecondaryActions(a);
    expect(sec.some((x) => x.type === 'layer' && x.layer === 'person_profile')).toBe(true);
  });

  it('getAlertPrimarySpec SmartBehavior contract vs smart tools default', () => {
    const contractSmart = base({
      category: 'SmartBehavior',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'c-77',
    });
    expect(getAlertPrimarySpec(contractSmart).label).toBe('فتح العقد');
    const otherSmart = base({
      category: 'SmartBehavior',
      مرجع_الجدول: 'العقارات_tbl',
      مرجع_المعرف: 'pr-77',
    });
    expect(getAlertPrimarySpec(otherSmart).label).toContain('الأدوات');
  });

  it('getAlertPrimarySpec covers batch and empty mid destinations', () => {
    expect(
      getAlertPrimarySpec(
        base({ category: 'System', مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'batch' })
      ).label
    ).toContain('مستحقة');
    expect(
      getAlertPrimarySpec(base({ category: 'System', مرجع_الجدول: 'العقارات_tbl', مرجع_المعرف: '' }))
        .label
    ).toContain('قائمة العقارات');
    expect(
      getAlertPrimarySpec(base({ category: 'System', مرجع_الجدول: 'الأشخاص_tbl', مرجع_المعرف: '' }))
        .label
    ).toContain('قائمة الأشخاص');
    expect(
      getAlertPrimarySpec(base({ category: 'System', مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: '' }))
        .label
    ).toContain('قائمة العقود');
  });

  it('getAlertPrimarySpec System and installment contract paths', () => {
    expect(
      getAlertPrimarySpec(base({ category: 'System', مرجع_الجدول: 'System', مرجع_المعرف: 'x' }))
        .label
    ).toContain('العمليات');
    expect(
      getAlertPrimarySpec(
        base({ category: 'System', مرجع_الجدول: 'الكمبيالات_tbl', مرجع_المعرف: 'inst-1' })
      ).label
    ).toContain('الدفعات');
    expect(
      getAlertPrimarySpec(
        base({ category: 'System', مرجع_الجدول: 'العقارات_tbl', مرجع_المعرف: 'prop-1' })
      ).label
    ).toBe('فتح العقار');
    expect(
      getAlertPrimarySpec(
        base({ category: 'System', مرجع_الجدول: 'الأشخاص_tbl', مرجع_المعرف: 'per-1' })
      ).label
    ).toBe('فتح الملف');
  });

  it('shouldOpenModalFirst Risk uses details length for non-contract refs', () => {
    expect(
      shouldOpenModalFirst(
        base({
          category: 'Risk',
          مرجع_الجدول: 'الأشخاص_tbl',
          details: [{}, {}, {}] as tbl_Alerts['details'],
        })
      )
    ).toBe(true);
    expect(
      shouldOpenModalFirst(
        base({
          category: 'Risk',
          مرجع_الجدول: 'الأشخاص_tbl',
          details: [{}] as tbl_Alerts['details'],
        })
      )
    ).toBe(false);
  });

  it('resolveSecondaryActions maintenance adds technician layer', () => {
    const a = base({ category: 'System', مرجع_الجدول: 'تذاكر_الصيانة_tbl' });
    expect(
      resolveSecondaryActions(a).some(
        (x) => x.type === 'layer' && 'layer' in x && x.layer === 'assign_technician'
      )
    ).toBe(true);
  });

  it('getAlertPrimarySpec generic modal fallback', () => {
    const a = base({ category: 'System', مرجع_الجدول: '', مرجع_المعرف: '' });
    expect(getAlertPrimarySpec(a).mode).toBe('modal');
    expect(getAlertPrimarySpec(a).label).toContain('مراجعة');
  });

  it('getAlertPrimarySpec DataQuality modal label', () => {
    expect(getAlertPrimarySpec(base({ category: 'DataQuality' })).label).toContain('البيانات');
  });

  it('getAlertPrimarySpec Financial modal hint', () => {
    const spec = getAlertPrimarySpec(base({ category: 'Financial' }));
    expect(spec.mode).toBe('modal');
    expect(spec.hint || '').toMatch(/واتساب|تحصيل/);
  });

  it('getAlertPrimarySpec Risk modal when contract ref', () => {
    expect(
      getAlertPrimarySpec(
        base({ category: 'Risk', مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: 'c1' })
      ).label
    ).toContain('المخاطر');
  });

  it('resolveSecondaryActions data_quality adds whatsapp only', () => {
    const a = base({ category: 'DataQuality' });
    const sec = resolveSecondaryActions(a);
    expect(sec.some((x) => x.type === 'layer' && 'layer' in x && x.layer === 'whatsapp')).toBe(true);
    expect(
      sec.some((x) => x.type === 'layer' && 'layer' in x && x.layer === 'record_payment')
    ).toBe(false);
  });

  it('resolveSecondaryActions expiry contract includes renew and insurance', () => {
    const a = base({
      category: 'Expiry',
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'c-exp-1',
    });
    const sec = resolveSecondaryActions(a);
    expect(sec.some((x) => x.type === 'layer' && 'layer' in x && x.layer === 'renew_contract')).toBe(
      true
    );
    expect(sec.some((x) => x.type === 'layer' && 'layer' in x && x.layer === 'insurance')).toBe(
      true
    );
  });

  it('resolveSecondaryActions financial batch omits legal layer', () => {
    const a = base({
      category: 'Financial',
      مرجع_المعرف: 'batch',
    });
    const sec = resolveSecondaryActions(a);
    expect(sec.some((x) => x.type === 'layer' && x.layer === 'legal_file')).toBe(false);
  });
});
