/**
 * © 2025 — Developed by Mahmoud Qattoush
 * نظام الصلاحيات المركزي - Centralized Permission System
 *
 * هذا النظام يضمن:
 * ✅ صلاحيات واحدة موحدة في كل النظام
 * ✅ سهولة إضافة roles جديدة
 * ✅ صلاحيات واضحة قانونياً
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 1️⃣ تعريف الإجراءات (Actions)
// ═══════════════════════════════════════════════════════════════════════════════
export type Action =
  // 💰 إجراءات مالية
  | 'INSTALLMENT_PAY' // سداد الكمبيالة
  | 'INSTALLMENT_PARTIAL_PAY' // سداد جزئي
  | 'INSTALLMENT_REVERSE' // عكس السداد (High Risk)
  | 'INSTALLMENT_EDIT' // تعديل بيانات الكمبيالة

  // 📧 إشعارات
  | 'SEND_REMINDER' // تذكير عادي
  | 'SEND_WARNING' // تحذير
  | 'SEND_LEGAL_NOTICE' // إشعار قانوني

  // 👤 إدارة المستخدمين
  | 'MANAGE_USERS' // إدارة المستخدمين
  | 'MANAGE_ROLES' // إدارة الأدوار
  | 'VIEW_AUDIT_LOG'; // عرض سجل التدقيق

// ═══════════════════════════════════════════════════════════════════════════════
// 2️⃣ مصفوفة الصلاحيات (RBAC Matrix)
// ═══════════════════════════════════════════════════════════════════════════════
export const ROLE_PERMISSIONS: Record<string, Action[]> = {
  /**
   * 👑 SuperAdmin
   * - جميع الصلاحيات
   * - يمكنه عكس السداد (High Risk)
   * - يمكنه إدارة النظام
   */
  SuperAdmin: [
    'INSTALLMENT_PAY',
    'INSTALLMENT_PARTIAL_PAY',
    'INSTALLMENT_REVERSE', // ⚠️ صلاحية خطرة جداً
    'INSTALLMENT_EDIT',
    'SEND_REMINDER',
    'SEND_WARNING',
    'SEND_LEGAL_NOTICE',
    'MANAGE_USERS',
    'MANAGE_ROLES',
    'VIEW_AUDIT_LOG',
  ],

  /**
   * 🔧 Admin
   * - إدارة الدفعات (لكن ليس العكس)
   * - إرسال التذكيرات والتحذيرات
   * - لا يمكنه عكس السداد
   */
  Admin: [
    'INSTALLMENT_PAY',
    'INSTALLMENT_PARTIAL_PAY',
    'INSTALLMENT_EDIT',
    'SEND_REMINDER',
    'SEND_WARNING',
    'SEND_LEGAL_NOTICE',
    'VIEW_AUDIT_LOG',
  ],

  /**
   * 👷 Employee
   * - صلاحيات محدودة جداً
   * - فقط السداد والتذكيرات
   * - لا يمكنه العكس أو التعديل
   */
  Employee: ['INSTALLMENT_PAY', 'SEND_REMINDER'],

  /**
   * 👤 Tenant
   * - لا يوجد صلاحيات
   */
  Tenant: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3️⃣ دالة الفحص الموحدة (Permission Check)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * تحقق ما إذا كان المستخدم يمتلك صلاحية معينة
 *
 * @param userRole - دور المستخدم
 * @param action - الإجراء المطلوب
 * @returns true إذا كان لديه الصلاحية، false وإلا
 *
 * @example
 * if (can(user.role, 'INSTALLMENT_REVERSE')) {
 *   // عرض الزر
 * }
 */
export function can(userRole: string | undefined, action: Action): boolean {
  if (!userRole) return false;
  return ROLE_PERMISSIONS[userRole]?.includes(action) ?? false;
}

/**
 * تحقق ما إذا كان المستخدم يمتلك أي من الصلاحيات المعطاة
 *
 * @example
 * if (canAny(user.role, ['INSTALLMENT_REVERSE', 'MANAGE_USERS'])) {
 *   // لديه واحدة من الصلاحيتين على الأقل
 * }
 */
export function canAny(userRole: string | undefined, actions: Action[]): boolean {
  if (!userRole) return false;
  return actions.some((action) => can(userRole, action));
}

/**
 * تحقق ما إذا كان المستخدم يمتلك جميع الصلاحيات المعطاة
 *
 * @example
 * if (canAll(user.role, ['INSTALLMENT_REVERSE', 'MANAGE_USERS'])) {
 *   // لديه كلا الصلاحيتين
 * }
 */
export function canAll(userRole: string | undefined, actions: Action[]): boolean {
  if (!userRole) return false;
  return actions.every((action) => can(userRole, action));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4️⃣ High-Risk Actions (تحتاج معاملة خاصة)
// ═══════════════════════════════════════════════════════════════════════════════

export const HIGH_RISK_ACTIONS: Action[] = [
  'INSTALLMENT_REVERSE', // عكس السداد
  'MANAGE_USERS', // إدارة المستخدمين
  'MANAGE_ROLES', // إدارة الأدوار
];

/**
 * تحقق ما إذا كان الإجراء عالي المخاطرة
 */
export function isHighRiskAction(action: Action): boolean {
  return HIGH_RISK_ACTIONS.includes(action);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5️⃣ Error Messages
// ═══════════════════════════════════════════════════════════════════════════════

export const PERMISSION_ERRORS: Record<Action, string> = {
  INSTALLMENT_PAY: 'ليس لديك صلاحية سداد الكمبيالات',
  INSTALLMENT_PARTIAL_PAY: 'ليس لديك صلاحية السداد الجزئي',
  INSTALLMENT_REVERSE: 'فقط السوبر أدمن يمكنه عكس السداد',
  INSTALLMENT_EDIT: 'ليس لديك صلاحية تعديل الكمبيالات',
  SEND_REMINDER: 'ليس لديك صلاحية إرسال التذكيرات',
  SEND_WARNING: 'ليس لديك صلاحية إرسال التحذيرات',
  SEND_LEGAL_NOTICE: 'ليس لديك صلاحية إرسال الإشعارات القانونية',
  MANAGE_USERS: 'ليس لديك صلاحية إدارة المستخدمين',
  MANAGE_ROLES: 'ليس لديك صلاحية إدارة الأدوار',
  VIEW_AUDIT_LOG: 'ليس لديك صلاحية عرض سجل التدقيق',
};

/**
 * احصل على رسالة الخطأ المناسبة للإجراء
 */
export function getPermissionError(action: Action): string {
  return PERMISSION_ERRORS[action] || 'صلاحية غير كافية';
}
