/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 * 
 * Data Validation Service
 * التحقق من صحة البيانات والعلاقات والفهارس
 */

import { الأشخاص_tbl, العقارات_tbl, العقود_tbl, الكمبيالات_tbl, شخص_دور_tbl } from '../types';

// Storage functions
let parseWarnings: string[] = [];

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

const hasUnknownProp = <K extends string>(obj: UnknownRecord, key: K): obj is UnknownRecord & Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(obj, key);

const get = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  if (!data) return [];

  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) return parsed as T[];
    // Some keys may have been corrupted into a non-array value.
    parseWarnings.push(`تعذر قراءة بيانات ${key}: القيمة ليست مصفوفة كما هو متوقع`);
    return [];
  } catch {
    parseWarnings.push(`تعذر قراءة بيانات ${key}: JSON غير صالح أو ملف تالف`);
    return [];
  }
};

const KEYS = {
  PEOPLE: 'db_people',
  ROLES: 'db_roles',
  PROPERTIES: 'db_properties',
  CONTRACTS: 'db_contracts',
  INSTALLMENTS: 'db_installments',
  USERS: 'db_users',
};

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * التحقق من عدم تكرار المفاتيح الأساسية
 */
export const checkPrimaryKeyDuplicates = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // التحقق من الأشخاص
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const personIds = people.map(p => p.رقم_الشخص);
  const duplicatePersonIds = personIds.filter((id, index) => personIds.indexOf(id) !== index);
  if (duplicatePersonIds.length > 0) {
    errors.push(`تكرار في رقم الشخص: ${duplicatePersonIds.join(', ')}`);
  }

  // التحقق من العقارات
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const propertyIds = properties.map(p => p.رقم_العقار);
  const duplicatePropertyIds = propertyIds.filter((id, index) => propertyIds.indexOf(id) !== index);
  if (duplicatePropertyIds.length > 0) {
    errors.push(`تكرار في رقم العقار: ${duplicatePropertyIds.join(', ')}`);
  }

  // التحقق من العقود
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
  const contractIds = contracts.map(c => c.رقم_العقد);
  const duplicateContractIds = contractIds.filter((id, index) => contractIds.indexOf(id) !== index);
  if (duplicateContractIds.length > 0) {
    errors.push(`تكرار في رقم العقد: ${duplicateContractIds.join(', ')}`);
  }

  // التحقق من الكمبيالات
  const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
  const installmentIds = installments.map(i => i.رقم_الكمبيالة);
  const duplicateInstallmentIds = installmentIds.filter((id, index) => installmentIds.indexOf(id) !== index);
  if (duplicateInstallmentIds.length > 0) {
    errors.push(`تكرار في رقم الكمبيالة: ${duplicateInstallmentIds.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * التحقق من القيود الفريدة (Unique Constraints)
 */
export const checkUniqueConstraints = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);

  // التحقق من الرقم الوطني
  const nationalIds = people
    .map(p => p.الرقم_الوطني)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const duplicateNationalIds = nationalIds.filter((id, index) => nationalIds.indexOf(id) !== index);
  if (duplicateNationalIds.length > 0) {
    errors.push(`تكرار في الرقم الوطني: ${duplicateNationalIds.join(', ')}`);
  }

  // التحقق من الكود الداخلي للعقارات
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const propertyCodes = properties.map(p => p.الكود_الداخلي);
  const duplicatePropertyCodes = propertyCodes.filter((code, index) => propertyCodes.indexOf(code) !== index);
  if (duplicatePropertyCodes.length > 0) {
    errors.push(`تكرار في الكود الداخلي للعقار: ${duplicatePropertyCodes.join(', ')}`);
  }

  // التحقق من أسماء المستخدمين
  const users = get<unknown>(KEYS.USERS);
  const usernames = users.map(u => (isRecord(u) && hasUnknownProp(u, 'اسم_المستخدم') ? u.اسم_المستخدم : undefined));
  const duplicateUsernames = usernames.filter((name, index) => usernames.indexOf(name) !== index);
  if (duplicateUsernames.length > 0) {
    errors.push(`تكرار في اسم المستخدم: ${duplicateUsernames.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * التحقق من سلامة المفاتيح الخارجية (Foreign Key Integrity)
 */
export const checkForeignKeyIntegrity = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
  const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
  const roles = get<شخص_دور_tbl>(KEYS.ROLES);

  const personIds = new Set(people.map(p => p.رقم_الشخص));
  const propertyIds = new Set(properties.map(p => p.رقم_العقار));
  const contractIds = new Set(contracts.map(c => c.رقم_العقد));

  // التحقق من العقارات → المالك
  properties.forEach(property => {
    if (!personIds.has(property.رقم_المالك)) {
      errors.push(`العقار ${property.الكود_الداخلي}: المالك ${property.رقم_المالك} غير موجود`);
    }
  });

  // التحقق من العقود → العقار والمستأجر والكفيل
  contracts.forEach(contract => {
    if (!propertyIds.has(contract.رقم_العقار)) {
      errors.push(`العقد ${contract.رقم_العقد}: العقار ${contract.رقم_العقار} غير موجود`);
    }
    if (!personIds.has(contract.رقم_المستاجر)) {
      errors.push(`العقد ${contract.رقم_العقد}: المستأجر ${contract.رقم_المستاجر} غير موجود`);
    }
    if (contract.رقم_الكفيل && !personIds.has(contract.رقم_الكفيل)) {
      warnings.push(`العقد ${contract.رقم_العقد}: الكفيل ${contract.رقم_الكفيل} غير موجود`);
    }
  });

  // التحقق من الكمبيالات → العقد
  installments.forEach(installment => {
    if (!contractIds.has(installment.رقم_العقد)) {
      errors.push(`الكمبيالة ${installment.رقم_الكمبيالة}: العقد ${installment.رقم_العقد} غير موجود`);
    }
  });

  // التحقق من الأدوار → الشخص
  roles.forEach(role => {
    if (!personIds.has(role.رقم_الشخص)) {
      errors.push(`الدور: الشخص ${role.رقم_الشخص} غير موجود`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * التحقق من المنطق التجاري (Business Logic Validation)
 */
export const checkBusinessLogic = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS);

  // التحقق من حالة العقار مع العقود
  properties.forEach(property => {
    const activeContracts = contracts.filter(c =>
      c.رقم_العقار === property.رقم_العقار &&
      c.حالة_العقد === 'نشط'
    );

    if (property.IsRented && activeContracts.length === 0) {
      warnings.push(`العقار ${property.الكود_الداخلي}: محدد كمؤجر لكن لا يوجد عقد نشط`);
    }

    if (!property.IsRented && activeContracts.length > 0) {
      warnings.push(`العقار ${property.الكود_الداخلي}: محدد كشاغر لكن يوجد عقد نشط`);
    }

    if (activeContracts.length > 1) {
      errors.push(`العقار ${property.الكود_الداخلي}: يوجد أكثر من عقد نشط (${activeContracts.length})`);
    }
  });

  // التحقق من تواريخ العقود
  contracts.forEach(contract => {
    const startDate = new Date(contract.تاريخ_البداية);
    const endDate = new Date(contract.تاريخ_النهاية);

    if (endDate <= startDate) {
      errors.push(`العقد ${contract.رقم_العقد}: تاريخ النهاية قبل تاريخ البداية`);
    }

    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                       (endDate.getMonth() - startDate.getMonth());

    if (Math.abs(monthsDiff - contract.مدة_العقد_بالاشهر) > 1) {
      warnings.push(`العقد ${contract.رقم_العقد}: مدة العقد لا تتطابق مع الفرق بين التواريخ`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * التحقق الشامل من كل شيء
 */
export const validateAllData = (): ValidationResult => {
  // Reset parse warnings for this run
  parseWarnings = [];

  const results = [
    checkPrimaryKeyDuplicates(),
    checkUniqueConstraints(),
    checkForeignKeyIntegrity(),
    checkBusinessLogic()
  ];

  const allErrors = results.flatMap(r => r.errors);
  const allWarnings = [...parseWarnings, ...results.flatMap(r => r.warnings)];

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
};

/**
 * التحقق قبل إضافة شخص جديد
 */
export const validateNewPerson = (data: Partial<الأشخاص_tbl>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isLikelyJordanPhone = (phoneRaw: string) => {
    const v = String(phoneRaw || '').trim().replace(/\D/g, '');
    if (!v) return true;
    // Accept either local Jordan mobile format or already-international 962...
    return /^07[789]\d{7}$/.test(v) || /^9627[789]\d{7}$/.test(v);
  };

  // التحقق من الحقول المطلوبة
  if (!data.الاسم || data.الاسم.trim().length === 0) {
    errors.push('الاسم مطلوب');
  }

  if (!data.رقم_الهاتف || data.رقم_الهاتف.trim().length === 0) {
    errors.push('رقم الهاتف مطلوب');
  }

  // التحقق من صيغة رقم الهاتف
  if (data.رقم_الهاتف && !isLikelyJordanPhone(data.رقم_الهاتف)) {
    warnings.push('رقم الهاتف يجب أن يكون بصيغة أردنية (07xxxxxxxx) أو دولية (9627xxxxxxxx)');
  }

  const extraPhoneRaw = (() => {
    const rec = isRecord(data) ? data : undefined;
    return rec && hasUnknownProp(rec, 'رقم_هاتف_اضافي') ? rec.رقم_هاتف_اضافي : undefined;
  })();

  if (extraPhoneRaw && !isLikelyJordanPhone(String(extraPhoneRaw))) {
    warnings.push('رقم الهاتف الإضافي يجب أن يكون بصيغة أردنية (07xxxxxxxx) أو دولية (9627xxxxxxxx)');
  }

  // التحقق من صيغة الرقم الوطني
  if (data.الرقم_الوطني && !/^\d{10}$/.test(data.الرقم_الوطني)) {
    warnings.push('الرقم الوطني يجب أن يتكون من 10 أرقام');
  }

  // التحقق من عدم التكرار
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);

  if (data.الرقم_الوطني) {
    const duplicate = people.find(p => p.الرقم_الوطني === data.الرقم_الوطني);
    if (duplicate) {
      errors.push(`الرقم الوطني ${data.الرقم_الوطني} موجود مسبقاً للشخص: ${duplicate.الاسم}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * التحقق قبل إضافة عقار جديد
 */
export const validateNewProperty = (data: Partial<العقارات_tbl>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // التحقق من الحقول المطلوبة
  if (!data.الكود_الداخلي || data.الكود_الداخلي.trim().length === 0) {
    errors.push('الكود الداخلي مطلوب');
  }

  if (!data.رقم_المالك) {
    errors.push('المالك مطلوب');
  }

  if (!data.النوع) {
    errors.push('نوع العقار مطلوب');
  }

  if (!data.العنوان) {
    errors.push('العنوان مطلوب');
  }

  // التحقق من عدم تكرار الكود الداخلي
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const duplicate = properties.find(p => p.الكود_الداخلي === data.الكود_الداخلي);
  if (duplicate) {
    errors.push(`الكود الداخلي ${data.الكود_الداخلي} موجود مسبقاً`);
  }

  // التحقق من وجود المالك
  if (data.رقم_المالك) {
    const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
    const owner = people.find(p => p.رقم_الشخص === data.رقم_المالك);
    if (!owner) {
      errors.push(`المالك ${data.رقم_المالك} غير موجود`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

