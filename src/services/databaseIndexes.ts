/**
 * 🔍 نظام الفهارس (Database Indexes)
 *
 * هذا الملف يحتوي على جميع الفهارس والقيود الفريدة المشروطة
 * لضمان سلامة البيانات وسرعة البحث
 */

import { العقارات_tbl, العقود_tbl, الأشخاص_tbl, شخص_دور_tbl } from '../types/types';
import { isTenancyRelevant } from '@/utils/tenancy';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const KEYS = {
  PEOPLE: 'db_people',
  PROPERTIES: 'db_properties',
  CONTRACTS: 'db_contracts',
  ROLES: 'db_roles',
  USERS: 'db_users',
};

// Helper function to retrieve data from localStorage
const get = <T>(key: string): T[] => {
  try {
    const str = localStorage.getItem(key);
    return str ? JSON.parse(str) : [];
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return [];
  }
};

/**
 * 1️⃣ جدول الأشخاص - التحقق من القيود الفريدة
 */
export const checkPersonUniqueConstraints = (
  رقم_الوطني: string | undefined,
  excludeId?: string
): { isValid: boolean; error?: string } => {
  if (!رقم_الوطني) return { isValid: true };

  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const duplicate = people.find((p) => p.الرقم_الوطني === رقم_الوطني && p.رقم_الشخص !== excludeId);

  if (duplicate) {
    return {
      isValid: false,
      error: `الرقم الوطني ${رقم_الوطني} مستخدم بالفعل`,
    };
  }

  return { isValid: true };
};

/**
 * 2️⃣ جدول شخص_دور - التحقق من القيد الفريد المركب
 * Unique Composite Index على (رقم_الشخص, رقم_الدور)
 */
export const checkPersonRoleUniqueConstraint = (
  رقم_الشخص: string,
  رقم_الدور: string,
  _excludeId?: string
): { isValid: boolean; error?: string } => {
  const roles = get<شخص_دور_tbl>(KEYS.ROLES);
  const duplicate = roles.find((r) => r.رقم_الشخص === رقم_الشخص && r.الدور === رقم_الدور);

  if (duplicate) {
    return {
      isValid: false,
      error: `الشخص لديه هذا الدور بالفعل`,
    };
  }

  return { isValid: true };
};

/**
 * 3️⃣ جدول المستخدمين - التحقق من القيود الفريدة
 */
export const checkUserUniqueConstraints = (
  رقم_الشخص: string | undefined,
  اسم_الدخول: string,
  excludeId?: string
): { isValid: boolean; error?: string } => {
  const users = get<unknown>(KEYS.USERS);

  // التحقق من رقم_الشخص
  if (رقم_الشخص) {
    const duplicatePerson = users.find((u) => {
      if (!isRecord(u)) return false;
      const personId = u['رقم_الشخص'];
      if (typeof personId !== 'string') return false;
      const userId = u['id'];
      const userIdComparable = typeof userId === 'string' ? userId : undefined;
      return personId === رقم_الشخص && userIdComparable !== excludeId;
    });
    if (duplicatePerson) {
      return {
        isValid: false,
        error: `هذا الشخص لديه حساب مستخدم بالفعل`,
      };
    }
  }

  // التحقق من اسم_الدخول
  const duplicateUsername = users.find((u) => {
    if (!isRecord(u)) return false;
    const username = u['اسم_المستخدم'];
    if (typeof username !== 'string') return false;
    const userId = u['id'];
    const userIdComparable = typeof userId === 'string' ? userId : undefined;
    return username === اسم_الدخول && userIdComparable !== excludeId;
  });
  if (duplicateUsername) {
    return {
      isValid: false,
      error: `اسم المستخدم ${اسم_الدخول} مستخدم بالفعل`,
    };
  }

  return { isValid: true };
};

/**
 * 4️⃣ جدول العقارات - التحقق من الكود الداخلي الفريد
 */
export const checkPropertyCodeUnique = (
  الكود_الداخلي: string,
  excludeId?: string
): { isValid: boolean; error?: string } => {
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const duplicate = properties.find(
    (p) => p.الكود_الداخلي === الكود_الداخلي && p.رقم_العقار !== excludeId
  );

  if (duplicate) {
    return {
      isValid: false,
      error: `الكود الداخلي ${الكود_الداخلي} مستخدم بالفعل`,
    };
  }

  return { isValid: true };
};

/**
 * 4️⃣ جدول العقارات - القيد الفريد المشروط للأراضي
 * Unique Index على (رقم_القطعة, رقم_اللوحة) WHERE نوع_العقار = 'أرض'
 */
export const checkLandUniqueConstraint = (
  رقم_القطعة: string | undefined,
  رقم_اللوحة: string | undefined,
  نوع_العقار: string,
  excludeId?: string
): { isValid: boolean; error?: string } => {
  if (نوع_العقار !== 'أرض') return { isValid: true };
  if (!رقم_القطعة || !رقم_اللوحة) return { isValid: true };

  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const duplicate = properties.find(
    (p) =>
      p.النوع === 'أرض' &&
      p.رقم_قطعة === رقم_القطعة &&
      p.رقم_لوحة === رقم_اللوحة &&
      p.رقم_العقار !== excludeId
  );

  if (duplicate) {
    return {
      isValid: false,
      error: `يوجد أرض بنفس رقم القطعة (${رقم_القطعة}) ورقم اللوحة (${رقم_اللوحة})`,
    };
  }

  return { isValid: true };
};

/**
 * 4️⃣ جدول العقارات - القيد الفريد المشروط للشقق
 * Unique Index على (رقم_القطعة, رقم_اللوحة, رقم_الشقة) WHERE نوع_العقار = 'شقة'
 */
export const checkApartmentUniqueConstraint = (
  رقم_القطعة: string | undefined,
  رقم_اللوحة: string | undefined,
  رقم_الشقة: string | undefined,
  نوع_العقار: string,
  excludeId?: string
): { isValid: boolean; error?: string } => {
  if (نوع_العقار !== 'شقة') return { isValid: true };
  if (!رقم_القطعة || !رقم_اللوحة || !رقم_الشقة) return { isValid: true };

  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const duplicate = properties.find(
    (p) =>
      p.النوع === 'شقة' &&
      p.رقم_قطعة === رقم_القطعة &&
      p.رقم_لوحة === رقم_اللوحة &&
      p.رقم_شقة === رقم_الشقة &&
      p.رقم_العقار !== excludeId
  );

  if (duplicate) {
    return {
      isValid: false,
      error: `يوجد شقة بنفس رقم القطعة (${رقم_القطعة}) ورقم اللوحة (${رقم_اللوحة}) ورقم الشقة (${رقم_الشقة})`,
    };
  }

  return { isValid: true };
};

/**
 * 5️⃣ جدول العقود - القيد الفريد المشروط
 * Unique Index على (رقم_العقار, حالة_العقد) WHERE حالة_العقد = 'ساري'
 */
export const checkActiveContractUniqueConstraint = (
  رقم_العقار: string,
  حالة_العقد: string,
  excludeId?: string
): { isValid: boolean; error?: string } => {
  // التحقق فقط إذا كانت الحالة ضمن حالات "ساري" حسب منطق السكن الموحد
  if (حالة_العقد !== 'نشط' && حالة_العقد !== 'قريب الانتهاء' && حالة_العقد !== 'مجدد') {
    return { isValid: true };
  }

  const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
  const duplicate = contracts.find(
    (c) =>
      isTenancyRelevant(c) &&
      c.رقم_العقار === رقم_العقار &&
      c.رقم_العقد !== excludeId &&
      !c.isArchived
  );

  if (duplicate) {
    return {
      isValid: false,
      error: `يوجد عقد ساري بالفعل لهذا العقار (${duplicate.رقم_العقد})`,
    };
  }

  return { isValid: true };
};

/**
 * 8️⃣ جدول البيع - التحقق من القيد الفريد
 * Unique Index على رقم_العقار
 */
export const checkSalePropertyUnique = (
  رقم_العقار: string,
  excludeId?: string
): { isValid: boolean; error?: string } => {
  const sales = get<unknown>('db_sales');
  const duplicate = sales.find((s) => {
    if (!isRecord(s)) return false;
    const propertyId = s['رقم_العقار'];
    if (typeof propertyId !== 'string') return false;
    const saleId = s['id'];
    const saleIdComparable = typeof saleId === 'string' ? saleId : undefined;
    return propertyId === رقم_العقار && saleIdComparable !== excludeId;
  });

  if (duplicate) {
    return {
      isValid: false,
      error: `هذا العقار معروض للبيع بالفعل`,
    };
  }

  return { isValid: true };
};

/**
 * 🔍 دالة شاملة للتحقق من جميع القيود عند إضافة/تعديل عقار
 */
export const validatePropertyIndexes = (
  property: Partial<العقارات_tbl>,
  excludeId?: string
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 1. التحقق من الكود الداخلي
  if (property.الكود_الداخلي) {
    const codeCheck = checkPropertyCodeUnique(property.الكود_الداخلي, excludeId);
    if (!codeCheck.isValid && codeCheck.error) {
      errors.push(codeCheck.error);
    }
  }

  // 2. التحقق من القيد الفريد للأراضي
  if (property.النوع === 'أرض') {
    const landCheck = checkLandUniqueConstraint(
      property.رقم_قطعة,
      property.رقم_لوحة,
      property.النوع,
      excludeId
    );
    if (!landCheck.isValid && landCheck.error) {
      errors.push(landCheck.error);
    }
  }

  // 3. التحقق من القيد الفريد للشقق
  if (property.النوع === 'شقة') {
    const aptCheck = checkApartmentUniqueConstraint(
      property.رقم_قطعة,
      property.رقم_لوحة,
      property.رقم_شقة,
      property.النوع,
      excludeId
    );
    if (!aptCheck.isValid && aptCheck.error) {
      errors.push(aptCheck.error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 🔍 دالة شاملة للتحقق من جميع القيود عند إضافة/تعديل عقد
 */
export const validateContractIndexes = (
  contract: Partial<العقود_tbl>,
  excludeId?: string
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // التحقق من عدم وجود عقد ساري آخر لنفس العقار
  if (contract.رقم_العقار && contract.حالة_العقد) {
    const activeCheck = checkActiveContractUniqueConstraint(
      contract.رقم_العقار,
      contract.حالة_العقد,
      excludeId
    );
    if (!activeCheck.isValid && activeCheck.error) {
      errors.push(activeCheck.error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 📊 قائمة جميع الفهارس في النظام (للتوثيق)
 */
export const DATABASE_INDEXES = {
  // 1️⃣ جدول الأشخاص
  الأشخاص: {
    PK: 'رقم_الشخص',
    UNIQUE: ['الرقم_الوطني'],
    INDEX: ['الاسم', 'رقم_الهاتف'],
  },

  // 2️⃣ جدول شخص_دور
  شخص_دور: {
    UNIQUE_COMPOSITE: ['رقم_الشخص', 'رقم_الدور'],
    INDEX: ['رقم_الشخص', 'رقم_الدور'],
  },

  // 3️⃣ جدول المستخدمين
  المستخدمين: {
    UNIQUE: ['رقم_الشخص', 'اسم_الدخول'],
  },

  // 4️⃣ جدول العقارات
  العقارات: {
    PK: 'رقم_العقار',
    UNIQUE: ['الكود_الداخلي'],
    INDEX: ['رقم_القطعة', 'رقم_اللوحة', 'رقم_الشقة', 'نوع_العقار', 'رقم_المالك'],
    UNIQUE_CONDITIONAL: [
      { fields: ['رقم_القطعة', 'رقم_اللوحة'], where: "نوع_العقار = 'أرض'" },
      { fields: ['رقم_القطعة', 'رقم_اللوحة', 'رقم_الشقة'], where: "نوع_العقار = 'شقة'" },
    ],
  },

  // 5️⃣ جدول العقود
  العقود: {
    PK: 'رقم_العقد',
    INDEX: ['رقم_العقار', 'رقم_المستأجر', 'تاريخ_بداية_العقد'],
    UNIQUE_CONDITIONAL: [{ fields: ['رقم_العقار', 'حالة_العقد'], where: "حالة_العقد = 'ساري'" }],
  },

  // 6️⃣ جدول الكمبيالات
  الكمبيالات: {
    PK: 'رقم_الكمبيالة',
    INDEX: ['رقم_العقد', 'تاريخ_الاستحقاق', 'حالة_الكمبيالة'],
  },

  // 7️⃣ جدول الدفعات
  الدفعات: {
    PK: 'رقم_الدفعة',
    INDEX: ['رقم_الكمبيالة', 'تاريخ_الدفع'],
  },

  // 8️⃣ جدول البيع
  البيع: {
    UNIQUE: ['رقم_العقار'],
    INDEX: ['رقم_المشتري', 'تاريخ_البيع'],
  },

  // 9️⃣ جدول العمولات (إيجار)
  العمولات: {
    INDEX: ['رقم_العقد', 'رقم_الشخص_المستحق', 'نوع_العمولة'],
  },

  // 🔟 جدول عمولات البيع
  عمولات_البيع: {
    INDEX: ['رقم_البيع', 'رقم_الشخص_المستحق'],
  },

  // 1️⃣1️⃣ جدول الحظر
  الحظر: {
    INDEX: ['رقم_الشخص', 'حالة_الحظر'],
  },
};
