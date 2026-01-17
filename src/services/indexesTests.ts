/**
 * 🧪 اختبارات الفهارس (Indexes Tests)
 * 
 * هذا الملف يحتوي على اختبارات شاملة لجميع الفهارس والقيود الفريدة
 */

import {
  checkPersonUniqueConstraints,
  checkPersonRoleUniqueConstraint,
  checkUserUniqueConstraints as _checkUserUniqueConstraints,
  checkPropertyCodeUnique,
  checkLandUniqueConstraint,
  checkApartmentUniqueConstraint,
  checkActiveContractUniqueConstraint,
  checkSalePropertyUnique as _checkSalePropertyUnique,
  validatePropertyIndexes,
  validateContractIndexes,
  DATABASE_INDEXES as _DATABASE_INDEXES
} from './databaseIndexes';

import { get, save as _save } from './storage';
import { العقارات_tbl, العقود_tbl, الأشخاص_tbl, شخص_دور_tbl } from '../types/types';
import { isTenancyRelevant } from '@/utils/tenancy';

const KEYS = {
  PEOPLE: 'db_people',
  PROPERTIES: 'db_properties',
  CONTRACTS: 'db_contracts',
  ROLES: 'db_roles',
  USERS: 'db_users',
  SALES: 'db_sales'
};

/**
 * 🧪 اختبار 1: التحقق من الرقم الوطني الفريد
 */
export const testPersonUniqueConstraints = (): { success: boolean; message: string } => {
  try {
    const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
    
    // اختبار 1: التحقق من رقم وطني موجود
    if (people.length > 0 && people[0].الرقم_الوطني) {
      const result = checkPersonUniqueConstraints(people[0].الرقم_الوطني);
      if (result.isValid) {
        return { success: false, message: '❌ فشل: يجب أن يكتشف التكرار' };
      }
    }

    // اختبار 2: التحقق من رقم وطني جديد
    const newResult = checkPersonUniqueConstraints('9999999999');
    if (!newResult.isValid) {
      return { success: false, message: '❌ فشل: يجب أن يقبل رقم جديد' };
    }

    return { success: true, message: '✅ نجح: اختبار الرقم الوطني الفريد' };
  } catch (error) {
    return { success: false, message: `❌ خطأ: ${error}` };
  }
};

/**
 * 🧪 اختبار 2: التحقق من القيد الفريد المركب (شخص + دور)
 */
export const testPersonRoleUniqueConstraint = (): { success: boolean; message: string } => {
  try {
    const roles = get<شخص_دور_tbl>(KEYS.ROLES);
    
    if (roles.length > 0) {
      const result = checkPersonRoleUniqueConstraint(
        roles[0].رقم_الشخص,
        roles[0].الدور
      );
      
      if (result.isValid) {
        return { success: false, message: '❌ فشل: يجب أن يكتشف التكرار' };
      }
    }

    return { success: true, message: '✅ نجح: اختبار القيد الفريد المركب' };
  } catch (error) {
    return { success: false, message: `❌ خطأ: ${error}` };
  }
};

/**
 * 🧪 اختبار 3: التحقق من الكود الداخلي الفريد
 */
export const testPropertyCodeUnique = (): { success: boolean; message: string } => {
  try {
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
    
    if (properties.length > 0) {
      const result = checkPropertyCodeUnique(properties[0].الكود_الداخلي);
      if (result.isValid) {
        return { success: false, message: '❌ فشل: يجب أن يكتشف التكرار' };
      }
    }

    const newResult = checkPropertyCodeUnique('NEW-CODE-999');
    if (!newResult.isValid) {
      return { success: false, message: '❌ فشل: يجب أن يقبل كود جديد' };
    }

    return { success: true, message: '✅ نجح: اختبار الكود الداخلي الفريد' };
  } catch (error) {
    return { success: false, message: `❌ خطأ: ${error}` };
  }
};

/**
 * 🧪 اختبار 4: التحقق من القيد الفريد للأراضي
 */
export const testLandUniqueConstraint = (): { success: boolean; message: string } => {
  try {
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
    const lands = properties.filter(p => p.النوع === 'أرض' && p.رقم_قطعة && p.رقم_لوحة);
    
    if (lands.length > 0) {
      const land = lands[0];
      const result = checkLandUniqueConstraint(
        land.رقم_قطعة,
        land.رقم_لوحة,
        'أرض'
      );
      
      if (result.isValid) {
        return { success: false, message: '❌ فشل: يجب أن يكتشف تكرار الأرض' };
      }
    }

    // اختبار أرض جديدة
    const newResult = checkLandUniqueConstraint('9999', '9999', 'أرض');
    if (!newResult.isValid) {
      return { success: false, message: '❌ فشل: يجب أن يقبل أرض جديدة' };
    }

    return { success: true, message: '✅ نجح: اختبار القيد الفريد للأراضي' };
  } catch (error) {
    return { success: false, message: `❌ خطأ: ${error}` };
  }
};

/**
 * 🧪 اختبار 5: التحقق من القيد الفريد للشقق
 */
export const testApartmentUniqueConstraint = (): { success: boolean; message: string } => {
  try {
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
    const apartments = properties.filter(
      p => p.النوع === 'شقة' && p.رقم_قطعة && p.رقم_لوحة && p.رقم_شقة
    );
    
    if (apartments.length > 0) {
      const apt = apartments[0];
      const result = checkApartmentUniqueConstraint(
        apt.رقم_قطعة,
        apt.رقم_لوحة,
        apt.رقم_شقة,
        'شقة'
      );
      
      if (result.isValid) {
        return { success: false, message: '❌ فشل: يجب أن يكتشف تكرار الشقة' };
      }
    }

    return { success: true, message: '✅ نجح: اختبار القيد الفريد للشقق' };
  } catch (error) {
    return { success: false, message: `❌ خطأ: ${error}` };
  }
};

/**
 * 🧪 اختبار 6: التحقق من القيد الفريد للعقد الساري
 */
export const testActiveContractUniqueConstraint = (): { success: boolean; message: string } => {
  try {
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
    const activeContracts = contracts.filter(c => isTenancyRelevant(c));

    if (activeContracts.length > 0) {
      const contract = activeContracts[0];
      const result = checkActiveContractUniqueConstraint(
        contract.رقم_العقار,
        'نشط'
      );

      if (result.isValid) {
        return { success: false, message: '❌ فشل: يجب أن يكتشف عقد ساري موجود' };
      }
    }

    return { success: true, message: '✅ نجح: اختبار القيد الفريد للعقد الساري' };
  } catch (error) {
    return { success: false, message: `❌ خطأ: ${error}` };
  }
};

/**
 * 🧪 اختبار 7: التحقق الشامل للعقار
 */
export const testValidatePropertyIndexes = (): { success: boolean; message: string } => {
  try {
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

    if (properties.length > 0) {
      // اختبار عقار موجود (يجب أن يفشل)
      const existing = properties[0];
      const result = validatePropertyIndexes({
        الكود_الداخلي: existing.الكود_الداخلي,
        النوع: existing.النوع,
        رقم_قطعة: existing.رقم_قطعة,
        رقم_لوحة: existing.رقم_لوحة,
        رقم_شقة: existing.رقم_شقة
      });

      if (result.isValid) {
        return { success: false, message: '❌ فشل: يجب أن يكتشف التكرار' };
      }
    }

    // اختبار عقار جديد (يجب أن ينجح)
    const newResult = validatePropertyIndexes({
      الكود_الداخلي: 'NEW-999',
      النوع: 'أرض',
      رقم_قطعة: '9999',
      رقم_لوحة: '9999'
    });

    if (!newResult.isValid) {
      return { success: false, message: `❌ فشل: ${newResult.errors.join(', ')}` };
    }

    return { success: true, message: '✅ نجح: اختبار التحقق الشامل للعقار' };
  } catch (error) {
    return { success: false, message: `❌ خطأ: ${error}` };
  }
};

/**
 * 🧪 اختبار 8: التحقق الشامل للعقد
 */
export const testValidateContractIndexes = (): { success: boolean; message: string } => {
  try {
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
    const activeContracts = contracts.filter(c => isTenancyRelevant(c));

    if (activeContracts.length > 0) {
      const contract = activeContracts[0];
      const result = validateContractIndexes({
        رقم_العقار: contract.رقم_العقار,
        حالة_العقد: 'نشط'
      });

      if (result.isValid) {
        return { success: false, message: '❌ فشل: يجب أن يكتشف عقد ساري موجود' };
      }
    }

    return { success: true, message: '✅ نجح: اختبار التحقق الشامل للعقد' };
  } catch (error) {
    return { success: false, message: `❌ خطأ: ${error}` };
  }
};

/**
 * 🎯 تشغيل جميع الاختبارات
 */
export const runAllIndexesTests = (): {
  total: number;
  passed: number;
  failed: number;
  results: Array<{ test: string; success: boolean; message: string }>;
} => {
  const tests = [
    { name: '1️⃣ الرقم الوطني الفريد', fn: testPersonUniqueConstraints },
    { name: '2️⃣ القيد الفريد المركب (شخص + دور)', fn: testPersonRoleUniqueConstraint },
    { name: '3️⃣ الكود الداخلي الفريد', fn: testPropertyCodeUnique },
    { name: '4️⃣ القيد الفريد للأراضي', fn: testLandUniqueConstraint },
    { name: '5️⃣ القيد الفريد للشقق', fn: testApartmentUniqueConstraint },
    { name: '6️⃣ القيد الفريد للعقد الساري', fn: testActiveContractUniqueConstraint },
    { name: '7️⃣ التحقق الشامل للعقار', fn: testValidatePropertyIndexes },
    { name: '8️⃣ التحقق الشامل للعقد', fn: testValidateContractIndexes }
  ];

  const results = tests.map(test => {
    const result = test.fn();
    return {
      test: test.name,
      success: result.success,
      message: result.message
    };
  });

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    total: tests.length,
    passed,
    failed,
    results
  };
};

/**
 * 📊 عرض نتائج الاختبارات
 */
export const displayIndexesTestResults = (): string => {
  const testResults = runAllIndexesTests();

  let output = '\n';
  output += '═══════════════════════════════════════════════════════\n';
  output += '🧪 نتائج اختبارات الفهارس (Indexes Tests Results)\n';
  output += '═══════════════════════════════════════════════════════\n\n';

  testResults.results.forEach(result => {
    output += `${result.test}\n`;
    output += `${result.message}\n\n`;
  });

  output += '───────────────────────────────────────────────────────\n';
  output += `📊 الإجمالي: ${testResults.total} اختبار\n`;
  output += `✅ نجح: ${testResults.passed}\n`;
  output += `❌ فشل: ${testResults.failed}\n`;
  output += '═══════════════════════════════════════════════════════\n';

  return output;
};

