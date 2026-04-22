/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 */

import type { ReferenceType } from './dynamic.types';

export type RoleType = 'SuperAdmin' | 'Admin' | 'Employee';
export type PersonRole = 'مالك' | 'مستأجر' | 'كفيل' | 'مشتري';
export type SalesType = 'Cash' | 'Installment' | 'Mortgage';
export type PaymentMethodType = 'Prepaid' | 'Postpaid' | 'DownPayment_Monthly';

export type ContractStatus = 'نشط' | 'مجدد' | 'منتهي' | 'قريب الانتهاء' | 'مفسوخ' | 'ملغي' | 'تحصيل';
export type PropertyStatus = 'شاغر' | 'مؤجر' | 'تحت الصيانة' | 'معروض للبيع';
export type MaintenanceStatus = 'مفتوح' | 'قيد التنفيذ' | 'مغلق';
export type MaintenancePriority = 'منخفضة' | 'متوسطة' | 'عالية';
export type AlertCategory =
  | 'Financial'
  | 'DataQuality'
  | 'Risk'
  | 'Expiry'
  | 'System'
  | 'SmartBehavior';

export interface DbResult<T> {
  success: boolean;
  message: string;
  data?: T;
}

export type PermissionCode =
  | 'ADD_PERSON'
  | 'EDIT_PERSON'
  | 'DELETE_PERSON'
  | 'ADD_PROPERTY'
  | 'EDIT_PROPERTY'
  | 'DELETE_PROPERTY'
  | 'CREATE_CONTRACT'
  | 'EDIT_CONTRACT'
  | 'DELETE_CONTRACT'
  | 'EDIT_MAINTENANCE'
  | 'CLOSE_MAINTENANCE'
  | 'DELETE_MAINTENANCE'
  | 'SETTINGS_VIEWER'
  | 'SETTINGS_ADMIN'
  | 'SETTINGS_AUDIT'
  | 'VIEW_REPORTS'
  | 'MANAGE_USERS'
  | 'BLACKLIST_VIEW'
  | 'BLACKLIST_ADD'
  | 'BLACKLIST_REMOVE'
  | 'PRINT_PREVIEW'
  | 'PRINT_EXECUTE'
  | 'PRINT_EXPORT'
  | 'PRINT_SETTINGS_EDIT'
  | 'PRINT_TEMPLATES_EDIT';

export interface الأشخاص_tbl {
  رقم_الشخص: string;
  الاسم: string;
  الرقم_الوطني?: string;
  رقم_الهاتف: string;
  رقم_هاتف_اضافي?: string;
  البريد_الإلكتروني?: string;
  العنوان?: string;
  عنوان_السكن?: string;
  ملاحظات?: string;
  رقم_نوع_الشخص?: string;
  تصنيف?: string;
  تقييم?: number;
  نوع_الملف?: 'فرد' | 'منشأة';
  طبيعة_الشركة?: string;
  تصنيف_السلوك?: {
    type: string;
    points: number;
    history: Array<{
      date: string;
      paymentType: 'full' | 'partial' | 'late';
      pointsChange: number;
      points: number;
    }>;
  };
  حقول_ديناميكية?: Record<string, unknown>;
}

export interface المنشآت_tbl {
  رقم_المنشأة: string;
  الاسم: string;
  رقم_الهاتف: string;
  رقم_هاتف_اضافي?: string;
  الرقم_الوطني_للمنشأة?: string;
  طبيعة_الشركة?: string;
  الأدوار?: string[];
  العنوان?: string;
  ملاحظات?: string;
}

export interface العقارات_tbl {
  رقم_العقار: string;
  الكود_الداخلي: string;
  رقم_المالك: string;
  النوع: string;
  العنوان: string;
  المدينة?: string;
  المنطقة?: string;
  حالة_العقار: PropertyStatus | string;
  الإيجار_التقديري?: number;
  IsRented: boolean;
  المساحة: number;
  الطابق?: string;
  عدد_الغرف?: string;
  نوع_التاثيث?: string;
  رقم_اشتراك_الكهرباء?: string;
  رقم_اشتراك_المياه?: string;
  اسم_اشتراك_الكهرباء?: string;
  اسم_اشتراك_المياه?: string;
  اسم_الحوض?: string;
  رقم_قطعة?: string;
  رقم_لوحة?: string;
  رقم_شقة?: string;
  // Marketing flags
  // - If omitted, the property is treated as rentable (backward-compatible).
  // - If false, the property is considered "للبيع فقط" and should be excluded from rent workflows.
  isForRent?: boolean;
  isForSale?: boolean;
  salePrice?: number;
  minSalePrice?: number;
  حدود_المأجور?: string;
  ملاحظات?: string;
  الصفة?: string;
  حقول_ديناميكية?: Record<string, unknown>;
}

export interface العقود_tbl {
  رقم_العقد: string;
  رقم_العقار: string;
  رقم_المستاجر: string;
  رقم_الكفيل?: string;
  تاريخ_الانشاء?: string; // YYYY-MM-DD
  رقم_الفرصة?: string;
  تاريخ_البداية: string;
  تاريخ_النهاية: string;
  مدة_العقد_بالاشهر: number;
  نص_مدة_العقد?: string;
  نص_كيفية_أداء_البدل?: string;
  القيمة_السنوية: number;
  تكرار_الدفع: number;
  طريقة_الدفع: PaymentMethodType;
  قيمة_التأمين?: number;
  يوجد_دفعة_اولى?: boolean;
  قيمة_الدفعة_الاولى?: number;
  عدد_أشهر_الدفعة_الأولى?: number;
  تقسيط_الدفعة_الأولى?: boolean;
  عدد_أقساط_الدفعة_الأولى?: number;
  احتساب_فرق_ايام?: boolean;
  حالة_العقد: ContractStatus | string;
  isArchived: boolean;
  عقد_مرتبط?: string;
  linkedContractId?: string;
  terminationDate?: string;
  terminationReason?: string;
  autoRenew?: boolean;
  lateFeeType: 'fixed' | 'percentage' | 'daily' | 'none';
  lateFeeValue: number;
  lateFeeGraceDays: number;
  lateFeeMaxAmount?: number;
  حقول_ديناميكية?: Record<string, unknown>;
}

export interface الكمبيالات_tbl {
  رقم_الكمبيالة: string;
  رقم_العقد: string;
  تاريخ_استحقاق: string;
  // Deferral metadata (when installment collection is postponed)
  تاريخ_التأجيل?: string; // YYYY-MM-DD
  تاريخ_الاستحقاق_السابق?: string; // YYYY-MM-DD
  القيمة: number;
  القيمة_المتبقية?: number; // ✅ المبلغ المتبقي بعد الدفعات الجزئية
  حالة_الكمبيالة: string;
  isArchived?: boolean;
  تاريخ_الدفع?: string;
  نوع_الكمبيالة: string;
  ترتيب_الكمبيالة?: number;
  نوع_الدفعة?: 'دفعة أولى' | 'دورية' | 'فرق أيام' | 'تأمين' | string;
  رقم_القسط?: number;
  // ✅ سجل الدفعات - يحفظ كل عملية دفع
  سجل_الدفعات?: Array<{
    رقم_العملية: string;
    المبلغ: number;
    التاريخ: string;
    الملاحظات?: string;
    المستخدم: string;
    الدور: string;
    النوع: 'FULL' | 'PARTIAL';
  }>;
  ملاحظات?: string;

  // Optional: late fee metadata (persisted only on explicit confirmation)
  غرامة_تأخير?: number;
  تصنيف_غرامة_تأخير?: string;
  تاريخ_احتساب_غرامة_تأخير?: string; // YYYY-MM-DD
  حقول_ديناميكية?: Record<string, unknown>;
}

export interface شخص_دور_tbl {
  رقم_الشخص: string;
  الدور: string;
}

export interface العمولات_tbl {
  رقم_العمولة: string;
  رقم_العقد?: string;
  رقم_الاتفاقية?: string;
  تاريخ_العقد: string;
  نوع_العمولة?: 'Rental' | 'Sale';
  شهر_دفع_العمولة?: string; // YYYY-MM
  // Optional: commission attribution to a specific employee/user
  اسم_المستخدم?: string;
  تاريخ_تحصيل_مؤجل?: string; // YYYY-MM-DD
  جهة_تحصيل_مؤجل?: 'مالك' | 'مستأجر';
  رقم_الفرصة?: string;
  يوجد_ادخال_عقار?: boolean;
  عمولة_المالك: number;
  عمولة_المستأجر: number;
  عمولة_البائع?: number;
  عمولة_المشتري?: number;
  عمولة_إدخال_عقار?: number;
  موظف_إدخال_العقار?: string;
  المجموع: number;
}

export interface المستخدمين_tbl {
  id: string;
  اسم_المستخدم: string;
  اسم_للعرض?: string;
  كلمة_المرور?: string;
  الدور: RoleType;
  linkedPersonId?: string;
  isActive: boolean;
}

export interface صلاحيات_المستخدمين_tbl {
  code: string;
  label: string;
  category: string;
}

export interface مستخدم_صلاحية_tbl {
  userId: string;
  permissionCode: string;
}

export interface tbl_Alerts {
  id: string;
  نوع_التنبيه: string;
  الوصف: string;
  تاريخ_الانشاء: string;
  تم_القراءة: boolean;
  category: AlertCategory;
  count?: number;
  details?: AlertDetail[];
  tenantName?: string;
  phone?: string;
  propertyCode?: string;
  مرجع_الجدول?: string;
  مرجع_المعرف?: string;
}

export type AlertDetail = {
  id: string;
  date?: string;
  amount?: number;
  note?: string;
  name?: string;
  [key: string]: unknown;
};

export interface عروض_البيع_tbl {
  id: string;
  رقم_العقار: string;
  رقم_المالك: string;
  السعر_المطلوب: number;
  أقل_سعر_مقبول?: number;
  نوع_البيع: SalesType;
  الحالة: 'Active' | 'Sold' | 'Cancelled' | 'Pending';
  تاريخ_العرض: string;
  ملاحظات?: string;
  متاح_للإيجار_أيضا?: boolean;
}

export interface عروض_الشراء_tbl {
  id: string;
  listingId: string;
  رقم_المشتري: string;
  قيمة_العرض: number;
  تاريخ_العرض: string;
  ملاحظات_التفاوض?: string;
  الحالة: 'Pending' | 'Accepted' | 'Rejected';
  مشتري_الرقم?: string;
  السعر_المعروض?: number;
  ملاحظات?: string;
  شروط_إضافية?: string;
}

export interface اتفاقيات_البيع_tbl {
  id: string;
  listingId: string;
  رقم_العقار?: string;
  رقم_البائع?: string;
  رقم_المشتري: string;
  رقم_الفرصة?: string;
  يوجد_ادخال_عقار?: boolean;
  // Optional: agreement attribution to a specific employee/user
  اسم_المستخدم?: string;
  تاريخ_الاتفاقية: string;
  السعر_النهائي: number;
  العمولة_الإجمالية: number;
  عمولة_البائع: number;
  عمولة_المشتري: number;
  عمولة_إدخال_عقار?: number;
  موظف_إدخال_العقار?: string;
  عمولة_وسيط_خارجي?: number;
  إجمالي_المصاريف?: number;
  طريقة_الدفع: SalesType;
  isCompleted: boolean;
  transactionId?: string;
  transferDate?: string;
  ملاحظات?: string;
  مصاريف_البيع?: {
    رسوم_التنازل?: number;
    ضريبة_الابنية?: number;
    نقل_اشتراك_الكهرباء?: number;
    نقل_اشتراك_المياه?: number;
    قيمة_التأمينات?: number;
    ملاحظات?: string;
  };
  إجمالي_العمولات?: number;
  قيمة_الدفعة_الاولى?: number;
  قيمة_المتبقي?: number;
  عقد_الرقم?: string;
  عرض_البيع_الرقم?: string;
  عرض_الشراء_الرقم?: string;
  سعر_الاتفاق?: number;
  تاريخ_الانتقال?: string;
}

export interface سجل_الملكية_tbl {
  id: string;
  رقم_العقار: string;
  رقم_المالك_القديم: string;
  رقم_المالك_الجديد: string;
  تاريخ_نقل_الملكية: string;
  رقم_المعاملة?: string;
  agreementId?: string;
  listingId?: string;
  السعر_النهائي?: number;
}

export interface العمولات_الخارجية_tbl {
  id: string;
  العنوان: string;
  النوع: string;
  التاريخ: string;
  القيمة: number;
  ملاحظات?: string;
}

export interface تذاكر_الصيانة_tbl {
  رقم_التذكرة: string;
  رقم_العقار: string;
  رقم_المستاجر?: string;
  تاريخ_الطلب: string;
  الوصف: string;
  الأولوية: MaintenancePriority;
  الحالة: MaintenanceStatus;
  الجهة_المسؤولة: 'المالك' | 'المستأجر' | 'مشترك';
  التكلفة_الفعلية?: number;
  تاريخ_الإغلاق?: string;
  ملاحظات_الإنهاء?: string;
  حقول_ديناميكية?: Record<string, unknown>;
}

export interface العمليات_tbl {
  id: string;
  اسم_المستخدم: string;
  نوع_العملية: string;
  اسم_الجدول: string;
  رقم_السجل: string;
  تاريخ_العملية: string;
  details?: string;
  ipAddress?: string;
  deviceInfo?: string;
}

export interface BlacklistRecord {
  id: string;
  personId: string;
  reason: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  dateAdded: string;
  addedBy: string;
  isActive: boolean;
}

export interface SystemLookup {
  id: string;
  category: string;
  // Stable machine key for the lookup item (used to dedupe and reference reliably)
  key?: string;
  label: string;
  isSystem?: boolean;
}

export interface LookupCategory {
  id: string;
  name: string;
  // Stable machine key for the category (defaults to name)
  key?: string;
  label: string;
  isSystem?: boolean;
}

export interface SystemSettings {
  companyName: string;
  companySlogan?: string;
  companyAddress: string;
  companyPhone: string;
  // Additional phone numbers (used in message templates/notifications and optional exports)
  companyPhones?: string[];
  companyEmail: string;
  companyWebsite: string;
  logoUrl: string;
  currency: string;
  // Country context (used for WhatsApp phone normalization and display)
  countryIso2?: string;
  // International dialing code without '+' (e.g. "962")
  countryDialCode?: string;
  taxNumber?: string;
  commercialRegister?: string;
  letterheadEnabled?: boolean;
  companyIdentityText?: string;
  socialFacebook?: string;
  socialInstagram?: string;
  socialLinkedin?: string;
  socialTwitter?: string;
  alertThresholdDays: number;
  salesCommissionPercent: number;
  rentalCommissionOwnerPercent?: number;
  rentalCommissionTenantPercent?: number;
  clearanceText: string;

  // Session / Security
  // Auto-logout after inactivity (minutes). Default: 15
  inactivityTimeoutMinutes?: number;
  /** قفل الشاشة بعد خمول (دقائق). افتراضي 30. صفر = معطّل */
  autoLockMinutes?: number;

  // Word contract template (Desktop)
  contractWordTemplateName?: string;
  installmentWordTemplateName?: string;
  handoverWordTemplateName?: string;

  // WhatsApp
  // If true (default), prompt to open the WhatsApp send screen right after creating a contract.
  contractWhatsAppPromptAfterCreate?: boolean;

  // WhatsApp sending behavior (used across all message sends)
  // - 'auto': desktop in Electron, otherwise web
  // - 'web': always use https://api.whatsapp.com/send
  // - 'desktop': always use whatsapp:// deep link
  whatsAppTarget?: 'auto' | 'web' | 'desktop';
  // Delay between opening multiple chats (ms). Default: 10000
  whatsAppDelayMs?: number;

  /** إرسال تلقائي من مسح الخلفية (معطّل افتراضياً — يتطلب تفعيلاً صريحاً) */
  whatsAppAutoEnabled?: boolean;
  /** بداية نافذة الإرسال (ساعة 0–23)، افتراضي 8 */
  whatsAppWorkHoursStart?: number;
  /** نهاية نافذة الإرسال (ساعة 0–24)، افتراضي 20 — لا يُرسل عند الساعة 20 أو بعدها */
  whatsAppWorkHoursEnd?: number;
  /** كم يوماً قبل الاستحقاق يُرسل التذكير الودي (افتراضي 3) */
  whatsAppAutoDelayDays?: number;

  /** تقارير مالية مجدولة (معطّلة افتراضياً) */
  scheduledReportsEnabled?: boolean;
  scheduledReportFrequency?: 'daily' | 'weekly' | 'monthly';
  /** وقت التشغيل المحلي "HH:mm" (افتراضي 08:00) */
  scheduledReportTime?: string;
  /** مجلد حفظ PDF التلقائي (سطح المكتب فقط) */
  scheduledReportExportPath?: string;

  // Messages/Notifications
  // Human-readable payment methods used in notifications (e.g., "نقداً", "تحويل بنكي").
  paymentMethods?: string[];
}

export interface MarqueeMessage {
  id: string;
  content: string;
  priority: 'Normal' | 'High';
  type: 'alert' | 'info' | 'success';
  action?:
    | { kind: 'panel'; panel: string; id?: string; options?: Record<string, unknown> }
    | { kind: 'hash'; hash: string };
}
export type {
  FieldType,
  DynamicFormField,
  DynamicTable,
  DynamicRecord,
  ReferenceType,
  Attachment,
} from './dynamic.types';

export interface PropertyInspection {
  id: string;
  propertyId: string;
  inspectionDate: string; // ISO date (YYYY-MM-DD)
  inspectorId?: string;
  clientId?: string;
  isReady?: boolean;
  notes?: string;
  items?: InspectionItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface ActivityRecord {
  id: string;
  referenceType: ReferenceType;
  referenceId: string;
  actionType: string;
  description: string;
  date: string;
  employee: string;
}

export interface NoteRecord {
  id: string;
  referenceType: ReferenceType;
  referenceId: string;
  content: string;
  date: string;
  employee: string;
}

export type ReportCategory = 'Financial' | 'Contracts' | 'Properties' | 'Tenants' | 'Maintenance';

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
}

export interface ReportResult {
  title: string;
  generatedAt: string;
  columns: {
    key: string;
    header: string;
    type?: 'text' | 'number' | 'currency' | 'date' | 'status';
  }[];
  data: unknown[];
  summary?: { label: string; value: string | number }[];
}

export interface WordTemplate {
  id: string;
  name: string;
  content: string;
  type: string;
  createdAt: string;
}

export interface LegalNoticeTemplate {
  id: string;
  title: string;
  category: 'Warning' | 'Eviction' | 'Renewal' | 'General';
  content: string;
}

export interface LegalNoticeRecord {
  id: string;
  contractId: string;
  tenantId: string;
  templateTitle: string;
  contentSnapshot: string;
  sentDate: string;
  sentMethod: 'WhatsApp' | 'Email' | 'Print';
  createdBy: string;
  note?: string;
  reply?: string;
}

export interface InspectionItem {
  id: string;
  name: string;
  status: 'Good' | 'Bad';
  note?: string;
}

export interface DamageRecord {
  id: string;
  description: string;
  cost: number;
  type: string;
}

export interface ClearanceRecord {
  id: string;
  contractId: string;
  propertyId: string;
  tenantId: string;
  date: string;
  inspectionItems: InspectionItem[];
  electricity: { paid: boolean; amountDue: number; reading: string };
  water: { paid: boolean; amountDue: number; reading: string };
  damages: DamageRecord[];
  rentArrears: number;
  cleaningFee: number;
  totalDebts: number;
  securityDepositValue: number;
  depositAction: 'Return' | 'Execute' | 'ExecutePartial';
  finalPropertyStatus: 'شاغر' | 'تحت الصيانة';
  notes: string;
  createdBy: string;
}

export interface SystemHealth {
  score: number;
  status: 'Excellent' | 'Good' | 'Warning' | 'Critical';
  issues: { id: string; type: 'Critical' | 'Warning'; category: string; description: string }[];
  stats: {
    integrityWarnings: number;
    orphans: number;
    logicErrors: number;
  };
}

export interface PredictiveInsight {
  score: number;
  status: 'Safe' | 'Risk';
  trend: 'Improving' | 'Stable' | 'Declining';
  riskFactors: { category: string; count: number; percentage: number }[];
  recommendations: string[];
}

export interface PerformanceRow {
  name: string;
  before: number;
  after: number;
}

// Interfaces for complex return types in DbService
export interface PersonDetailsResult {
  person: الأشخاص_tbl;
  roles: string[];
  ownedProperties: العقارات_tbl[];
  contracts: العقود_tbl[];
  blacklistRecord?: BlacklistRecord;
  stats: {
    totalInstallments: number;
    lateInstallments: number;
    commitmentRatio: number;
  };
}

export interface PropertyDetailsResult {
  property: العقارات_tbl;
  owner?: الأشخاص_tbl;
  currentTenant?: الأشخاص_tbl | null;
  currentGuarantor?: الأشخاص_tbl | null;
  currentContract?: العقود_tbl;
  history: العقود_tbl[];
}

export interface ContractDetailsResult {
  contract: العقود_tbl;
  property?: العقارات_tbl;
  tenant?: الأشخاص_tbl;
  installments: الكمبيالات_tbl[];
}

// Smart Engine Types
export type SmartCategory = 'person' | 'property' | 'contract' | 'maintenance';

export interface SmartBehaviorPattern {
  category: SmartCategory;
  field: string;
  value: unknown;
  timestamp: number;
}

export interface SmartSuggestion {
  field: string;
  suggestedValue: unknown;
  confidence: number; // 0 to 1
  reason?: string;
}

// Smart Rules Library
export interface SmartRule {
  learningKey: string; // matches field name
  hint: string;
  expectedType: 'string' | 'number' | 'email' | 'phone' | 'date';
  validation?: {
    regex?: RegExp;
    min?: number;
    max?: number;
    options?: string[];
  };
  severity: 'info' | 'warning' | 'error';
}

// --- NEW DASHBOARD WIDGET TYPES ---

export interface DashboardNote {
  id: string;
  content: string;
  priority: 'Normal' | 'Important' | 'Urgent';
  createdAt: string;
  isArchived: boolean;
}

export interface SystemReminder {
  id: string;
  title: string;
  date: string;
  time?: string; // optional HH:mm
  type: 'Payment' | 'Call' | 'Visit' | 'Expiry' | 'Task';
  isDone: boolean;
}

export interface ClientInteraction {
  id: string;
  clientId: string;
  clientName: string;
  type: 'Call' | 'Visit' | 'Complaint' | 'Service';
  details: string;
  date: string;
  status: 'Pending' | 'Resolved' | 'Logged';
}

export interface FollowUpTask {
  id: string;
  task: string;
  clientName?: string;
  phone?: string;
  type: 'Task' | 'Call' | 'Meeting' | 'Paperwork';
  dueDate: string;
  dueTime?: string; // optional HH:mm
  status: 'Pending' | 'Done';

  // Optional fields for richer task management (future-proof)
  personId?: string;
  contractId?: string;
  propertyId?: string;
  priority?: 'High' | 'Medium' | 'Low';
  category?: string;
  note?: string;
  reminderId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationSendLog {
  id: string;
  category: 'installment_reminder' | string;
  tenantId?: string;
  tenantName: string;
  phone?: string;
  contractId?: string;
  propertyId?: string;
  propertyCode?: string;
  installmentIds?: string[];
  sentAt: string; // ISO date-time
  message?: string;
  note?: string;
  reply?: string;
}
