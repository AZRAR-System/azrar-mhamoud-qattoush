/**
 * متغيرات موثّقة لقوالب Word (Docxtemplater: {{مفتاح}}).
 * يمكن للنظام لاحقاً تمرير مفاتيح إضافية حسب سياق الطباعة.
 */
export type ContractWordVariableCategory =
  | 'parties'
  | 'property'
  | 'contract'
  | 'installment'
  | 'company'
  | 'docx_engine'
  | 'header_footer'
  | 'dynamic';

export type ContractWordTemplateVariable = {
  key: string;
  label: string;
  example?: string;
  category: ContractWordVariableCategory;
  /** ملاحظة تقنية اختيارية تظهر في الواجهة */
  note?: string;
};

/** تجميعات للواجهة (عناوين عربية) */
export const CONTRACT_WORD_CATEGORY_META: Record<
  ContractWordVariableCategory,
  { title: string; subtitle: string }
> = {
  parties: { title: 'الأطراف', subtitle: 'مؤجر، مستأجر، كفيل، بيانات اتصال' },
  property: { title: 'العقار', subtitle: 'كود، عنوان، وصف' },
  contract: { title: 'العقد', subtitle: 'تواريخ، مبالغ، مدة، دفعات' },
  installment: {
    title: 'الكمبيالات والأقساط',
    subtitle: 'مجمّعات، إشعارات، وقالب فاتورة القسط — كما في كتالوج الدمج',
  },
  company: { title: 'الشركة والهوية', subtitle: 'من إعدادات النظام / الترويسة' },
  docx_engine: {
    title: 'محرك القالب (اختبار / عينات)',
    subtitle: 'مفاتيح يستخدمها توليد العقد التجريبي (snake_case)',
  },
  header_footer: {
    title: 'الترويسة والذيل (DOCX)',
    subtitle: 'يُحقنها النظام في رأس/تذييل الملف عند التصدير',
  },
  dynamic: {
    title: 'صيغة الحقول الديناميكية',
    subtitle: 'أي حقل من جداول العقد / العقار / المستأجر / الكمبيالة',
  },
};

/**
 * حقول ديناميكية: {{العقد_<اسم_الحقل>}} — أسماء الحقول كما في قاعدة البيانات (عربي).
 * ينطبق نفس الأسلوب على العقار والمستأجر بالبادئات أدناه.
 */
/** ترتيب عرض الفئات في الواجهة (بدون صف «ديناميكي» المنفصل) */
export const CONTRACT_WORD_FLAT_CATEGORY_ORDER: readonly Exclude<
  ContractWordVariableCategory,
  'dynamic'
>[] = ['parties', 'property', 'contract', 'installment', 'company', 'docx_engine', 'header_footer'];

export const CONTRACT_WORD_DYNAMIC_PREFIXES: {
  prefix: string;
  label: string;
  exampleKey: string;
  altPrefix?: string;
}[] = [
  {
    prefix: 'العقد_',
    label: 'حقول سجل العقد',
    exampleKey: 'رقم_العقد',
    altPrefix: 'contract_',
  },
  {
    prefix: 'العقار_',
    label: 'حقول سجل العقار',
    exampleKey: 'الكود_الداخلي',
    altPrefix: 'property_',
  },
  {
    prefix: 'المستأجر_',
    label: 'حقول سجل المستأجر (الشخص)',
    exampleKey: 'الاسم',
    altPrefix: 'tenant_',
  },
  {
    prefix: 'الكمبيالة_',
    label: 'حقول سجل الكمبيالة (القسط)',
    exampleKey: 'رقم_الكمبيالة',
  },
];

export const CONTRACT_WORD_TEMPLATE_VARIABLES: ContractWordTemplateVariable[] = [
  // —— الأطراف ——
  { key: 'ownerName', label: 'اسم المؤجر / المالك', category: 'parties', example: 'أحمد علي' },
  { key: 'ownerPhone', label: 'هاتف المؤجر', category: 'parties', example: '0790000000' },
  {
    key: 'ownerNationalId',
    label: 'الرقم الوطني / الهوية للمؤجر',
    category: 'parties',
    example: '99010101010',
  },
  { key: 'tenantName', label: 'اسم المستأجر', category: 'parties', example: 'محمد حسن' },
  { key: 'tenantPhone', label: 'هاتف المستأجر', category: 'parties', example: '0780000000' },
  {
    key: 'tenantNationalId',
    label: 'الرقم الوطني للمستأجر',
    category: 'parties',
    example: '20010101555',
  },
  { key: 'guarantorName', label: 'اسم الكفيل', category: 'parties', example: 'علي يوسف' },
  { key: 'guarantorPhone', label: 'هاتف الكفيل', category: 'parties', example: '0770000000' },

  // —— العقار ——
  { key: 'propertyCode', label: 'كود العقار', category: 'property', example: 'A-102' },
  {
    key: 'propertyAddress',
    label: 'عنوان العقار',
    category: 'property',
    example: 'عمّان — تلاع العلي',
  },
  {
    key: 'propertyType',
    label: 'نوع / وصف العقار (نص حر)',
    category: 'property',
    example: 'شقة سكنية',
  },

  // —— العقد ——
  { key: 'contractNumber', label: 'رقم العقد', category: 'contract', example: '2026-001' },
  {
    key: 'contractStartDate',
    label: 'تاريخ بداية العقد',
    category: 'contract',
    example: '2026-01-01',
  },
  {
    key: 'contractEndDate',
    label: 'تاريخ نهاية العقد',
    category: 'contract',
    example: '2026-12-31',
  },
  {
    key: 'contractDurationText',
    label: 'مدة الإيجار (نص جاهز)',
    category: 'contract',
    example: 'سنة واحدة',
  },
  {
    key: 'contractAnnualRent',
    label: 'القيمة السنوية للإيجار',
    category: 'contract',
    example: '2400',
  },
  {
    key: 'contractRentPaymentText',
    label: 'كيفية أداء البدل (نص)',
    category: 'contract',
    example: 'شهرياً مقدماً',
  },
  {
    key: 'contractPaymentMethod',
    label: 'طريقة الدفع (حسب النظام)',
    category: 'contract',
    example: 'كاش / بنكي',
  },
  {
    key: 'depositAmount',
    label: 'قيمة التأمين / الوديعة',
    category: 'contract',
    example: '500',
  },
  {
    key: 'firstPaymentAmount',
    label: 'الدفعة الأولى',
    category: 'contract',
    example: '200',
  },

  // —— كمبيالات: مجمّعات (سياق العقد — إشعارات قانونية / رسائل) ——
  {
    key: 'دفعات_اجمالي_المتبقي',
    label: 'إجمالي المبالغ المتبقية لأقساط العقد',
    category: 'installment',
    example: '1500',
    note: 'يُحسب من جدول الكمبيالات عند توليد نص قانوني/إشعار',
  },
  {
    key: 'دفعات_عدد_الاقساط_المتأخرة',
    label: 'عدد الأقساط المتأخرة (غير المسددة بعد الاستحقاق)',
    category: 'installment',
    example: '2',
  },
  {
    key: 'دفعات_مجموع_المتأخر',
    label: 'مجموع مبالغ الأقساط المتأخرة',
    category: 'installment',
    example: '800',
  },
  {
    key: 'دفعات_اقدم_تاريخ_استحقاق_متأخر',
    label: 'أقدم تاريخ استحقاق بين الأقساط المتأخرة',
    category: 'installment',
    example: '2026-01-01',
  },
  {
    key: 'دفعات_اقصى_عدد_ايام_تأخر',
    label: 'أقصى عدد أيام تأخّر بين الأقساط المتأخرة',
    category: 'installment',
    example: '45',
  },
  {
    key: 'total_remaining_amount',
    label: 'إجمالي المتبقي (مفتاح إنجليزي — نفس مجمّع الدفعات)',
    category: 'installment',
    example: '1500',
    note: 'يُستخدم في بعض القوالب القانونية',
  },
  {
    key: 'overdue_installments_count',
    label: 'عدد الأقساط المتأخرة (مفتاح إنجليزي)',
    category: 'installment',
    example: '2',
  },
  {
    key: 'overdue_amount_total',
    label: 'مجموع المبالغ المتأخرة (مفتاح إنجليزي)',
    category: 'installment',
    example: '800',
  },
  {
    key: 'overdue_oldest_due_date',
    label: 'أقدم تاريخ استحقاق (مفتاح إنجليزي)',
    category: 'installment',
    example: '2026-01-01',
  },
  {
    key: 'overdue_max_days_late',
    label: 'أقصى أيام تأخّر (مفتاح إنجليزي)',
    category: 'installment',
    example: '45',
  },
  {
    key: 'عدد_الكمبيالات',
    label: 'عدد الكمبيالات (رسائل وتذكيرات)',
    category: 'installment',
    example: '3',
    note: 'سياق رسائل الواتساب / التذكير',
  },
  {
    key: 'مجموع_المبالغ_المتأخرة',
    label: 'مجموع المبالغ المتأخرة (رسائل)',
    category: 'installment',
    example: '1200',
  },
  {
    key: 'تفاصيل_الكمبيالات',
    label: 'نص تفصيلي للكمبيالات المتأخرة (رسائل)',
    category: 'installment',
    example: 'قسط 1: ...',
  },

  // —— قالب «الكمبيالات» في الإعدادات (أسماء عربية بسيطة في الدليل) ——
  {
    key: 'مبلغ_القسط',
    label: 'مبلغ القسط (قالب كمبيالات)',
    category: 'installment',
    example: '250',
    note: 'يظهر في دليل المتغيرات المضمّن في القالب',
  },
  {
    key: 'المدفوع',
    label: 'المبلغ المدفوع من القسط',
    category: 'installment',
    example: '100',
  },
  {
    key: 'المتبقي',
    label: 'المتبقي على القسط',
    category: 'installment',
    example: '150',
  },
  {
    key: 'رقم_العقد',
    label: 'رقم العقد (نص عربي — قوالب متعددة)',
    category: 'installment',
    example: '2026-001',
    note: 'يُستخدم في قالب الكمبيالات وغيره',
  },
  {
    key: 'اسم_المستأجر',
    label: 'اسم المستأجر (نص عربي)',
    category: 'installment',
    example: 'محمد',
    note: 'بديل عربي لـ tenantName في بعض القوالب',
  },
  {
    key: 'العقار',
    label: 'وصف العقار المختصر (قالب كمبيالات)',
    category: 'installment',
    example: 'شقة 12 — الجبيهة',
  },
  {
    key: 'تاريخ_الاستحقاق',
    label: 'تاريخ استحقاق القسط',
    category: 'installment',
    example: '2026-04-05',
  },

  // —— حقول شائعة من جدول الكمبيالة (مفاتيح كاملة للنسخ السريع) ——
  {
    key: 'الكمبيالة_رقم_الكمبيالة',
    label: 'رقم الكمبيالة',
    category: 'installment',
    example: 'INS-...',
    note: 'أو استخدم البادئة الديناميكية لأي عمود',
  },
  {
    key: 'الكمبيالة_القيمة',
    label: 'قيمة القسط',
    category: 'installment',
    example: '500',
  },
  {
    key: 'الكمبيالة_حالة_الكمبيالة',
    label: 'حالة القسط',
    category: 'installment',
    example: 'غير مدفوع',
  },
  {
    key: 'الكمبيالة_نوع_الكمبيالة',
    label: 'نوع القسط (إيجار / تأمين / …)',
    category: 'installment',
    example: 'إيجار',
  },

  // —— الشركة (من الإعدادات) ——
  { key: 'companyName', label: 'اسم الشركة', category: 'company', example: 'مكتب عقاري' },
  { key: 'companyPhone', label: 'هاتف الشركة', category: 'company', example: '0799999999' },
  {
    key: 'companyEmail',
    label: 'البريد الإلكتروني',
    category: 'company',
    example: 'info@example.com',
  },
  { key: 'companyAddress', label: 'عنوان الشركة', category: 'company', example: 'عمّان' },
  { key: 'companyWebsite', label: 'الموقع الإلكتروني', category: 'company', example: 'https://' },
  { key: 'taxNumber', label: 'الرقم الضريبي', category: 'company', example: '12345678' },
  { key: 'commercialRegister', label: 'السجل التجاري', category: 'company', example: 'CR-...' },

  // —— عينات محرك التوليد التجريبي (snake_case) ——
  {
    key: 'tenant_name',
    label: 'المستأجر (صيغة الاختبار التقنية)',
    category: 'docx_engine',
    example: 'اسم طويل للاختبار',
    note: 'يُستخدم في عقد تجريبي من الإعدادات',
  },
  {
    key: 'owner_name',
    label: 'المالك (صيغة الاختبار التقنية)',
    category: 'docx_engine',
    example: 'اسم شركة أو مالك',
  },
  {
    key: 'contract_amount',
    label: 'مبلغ / قيمة (رقم)',
    category: 'docx_engine',
    example: '1234',
  },
  {
    key: 'start_date',
    label: 'تاريخ البداية (اختبار)',
    category: 'docx_engine',
    example: '2026-01-01',
  },
  {
    key: 'qa_long_text',
    label: 'نص طويل لاختبار التفاف السطور',
    category: 'docx_engine',
    example: '—',
  },
  {
    key: 'qa_long_id',
    label: 'معرّف اختبار QA',
    category: 'docx_engine',
    example: 'QA-...',
  },

  // —— ترويسة/ذيل ملف Word ——
  {
    key: 'company_name',
    label: 'اسم الشركة (ترويسة الملف)',
    category: 'header_footer',
    example: 'نفس الهوية',
    note: 'قد يُدمج مع قوالب الرأس في Electron',
  },
  {
    key: 'company_slogan',
    label: 'الشعار اللفظي (ترويسة)',
    category: 'header_footer',
    example: '...',
  },
  {
    key: 'company_identity_text',
    label: 'نص هوية الشركة (ترويسة)',
    category: 'header_footer',
    example: 'سطر1\nسطر2',
  },
  { key: 'date', label: 'التاريخ (ذيل الصفحة)', category: 'header_footer', example: '2026-03-29' },
  {
    key: 'user_name',
    label: 'اسم المستخدم (ذيل)',
    category: 'header_footer',
    example: 'مدير النظام',
  },
  { key: 'page_number', label: 'رقم الصفحة (ذيل)', category: 'header_footer', example: '1' },
];

/** عدد المتغيرات القابلة للنسخ (بدون صفوف «ديناميكية» البادئة) */
export const CONTRACT_WORD_FLAT_VARIABLE_COUNT = CONTRACT_WORD_TEMPLATE_VARIABLES.length;
