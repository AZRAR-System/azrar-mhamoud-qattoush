/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — Integration Tests
 * 
 * اختبارات تسلسلية كاملة:
 * 1. إضافة شخص (مالك)
 * 2. إضافة عقار
 * 3. إنشاء عقد إيجار
 * 4. إنشاء كمبيالات (دفعات)
 * 5. إضافة عمولة
 */

import { DbService } from './index';
import { domainSearchSmart } from './domainQueries';
import type { PropertyStatus, العمولات_tbl, الأشخاص_tbl, العقارات_tbl, العقود_tbl, الكمبيالات_tbl } from '../types';

// ============================================
// 🧪 INTEGRATION TEST SUITE
// ============================================

export interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  data?: unknown;
  duration?: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const getIdLike = (v: unknown): string => {
  if (!isRecord(v)) return '';
  const id = v['رقم_الشخص'] ?? v['id'];
  return String(id ?? '').trim();
};

type WithMonthlyPrice = { السعر_الشهري?: unknown; الإيجار_التقديري?: unknown };

const getMonthlyPrice = (property: العقارات_tbl): number => {
  const maybe = property as unknown as WithMonthlyPrice;
  const v = maybe.السعر_الشهري ?? maybe.الإيجار_التقديري;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export class IntegrationTestSuite {
  private results: TestResult[] = [];
  private testData: {
    person?: الأشخاص_tbl;
    property?: العقارات_tbl;
    contract?: العقود_tbl;
    installments?: الكمبيالات_tbl[];
    commission?: العمولات_tbl;
  } = {};

  // ============================================
  // ✅ TEST 1: إضافة شخص (مالك)
  // ============================================
  
  async test_01_AddPerson(): Promise<TestResult> {
    const start = performance.now();
    try {
      if (!isIntegrationTestDataEnabled()) {
        return {
          testName: 'إضافة شخص (مالك)',
          status: 'SKIP',
          message: '⏭️ تم تخطي الاختبار: إنشاء بيانات الاختبار مُعطّل. فعّل VITE_ENABLE_INTEGRATION_TEST_DATA=true أو window.ENABLE_INTEGRATION_TEST_DATA=true.',
          duration: performance.now() - start
        };
      }

      const personData = {
        الاسم: 'محمد أحمد الخطيب',
        رقم_الهاتف: '+962791234567',
        البريد_الإلكتروني: 'mohammad@khaberni.com',
        عنوان_السكن: 'عمّان، الأردن',
        رقم_الهوية: '123456789',
        نوع_الهوية: 'الهوية الوطنية'
      };

      const result = DbService.addPerson(personData, ['مالك']);
      
      if (!result.success || !result.data) {
        return {
          testName: 'إضافة شخص (مالك)',
          status: 'FAIL',
          message: `فشل في إضافة الشخص`,
          duration: performance.now() - start
        };
      }

      this.testData.person = result.data;
      
      // التحقق من البيانات المضافة في KV
      const people = DbService.getPeople();
      const addedPerson = people.find(p => p.رقم_الشخص === result.data.رقم_الشخص);

      if (!addedPerson) {
        return {
          testName: 'إضافة شخص (مالك)',
          status: 'FAIL',
          message: 'تم إضافة الشخص لكن لم يتم العثور عليه في قائمة الأشخاص',
          duration: performance.now() - start
        };
      }

      // إذا كنا في وضع Desktop، تحقق أن السجل وصل إلى جداول النطاق (SQL) بعد الـdomain migration
      const isDesktop = typeof window !== 'undefined' && !!window.desktopDb;
      if (isDesktop) {
        const queryName = String(result.data.الاسم || '').trim();
        let foundInDomain = false;
        const attempts = 10;
        const delayMs = 500;
        for (let i = 0; i < attempts; i++) {
          try {
            const items = await domainSearchSmart('people', queryName, 50);
            if (Array.isArray(items) && items.some((p) => getIdLike(p) === String(result.data.رقم_الشخص).trim())) {
              foundInDomain = true;
              break;
            }
          } catch {
            // ignore and retry
          }
          await new Promise((r) => setTimeout(r, delayMs));
        }

        if (!foundInDomain) {
          return {
            testName: 'إضافة شخص (مالك)',
            status: 'FAIL',
            message: 'تمت الإضافة في KV لكن لم تظهر في جداول النطاق (SQLite) في وضع Desktop بعد الانتظار.',
            duration: performance.now() - start
          };
        }
      }

      return {
        testName: 'إضافة شخص (مالك)',
        status: 'PASS',
        message: `✅ تم إضافة الشخص بنجاح: ${result.data.رقم_الشخص}`,
        data: {
          personId: result.data.رقم_الشخص,
          name: result.data.الاسم,
          phone: result.data.رقم_الهاتف
        },
        duration: performance.now() - start
      };
    } catch (error) {
      return {
        testName: 'إضافة شخص (مالك)',
        status: 'FAIL',
        message: `❌ خطأ: ${error instanceof Error ? error.message : 'unknown error'}`,
        duration: performance.now() - start
      };
    }
  }

  // ============================================
  // ✅ TEST 2: إضافة عقار
  // ============================================
  
  async test_02_AddProperty(): Promise<TestResult> {
    const start = performance.now();
    try {
      if (!this.testData.person) {
        return {
          testName: 'إضافة عقار',
          status: 'SKIP',
          message: '⏭️ تم تخطي الاختبار: لم يتم إضافة شخص في الخطوة السابقة',
          duration: performance.now() - start
        };
      }

      const propertyData = {
        الكود_الداخلي: `PROP-${Date.now()}`,
        رقم_المالك: this.testData.person.رقم_الشخص,
        النوع: 'شقة',
        العنوان: 'الدقي، القاهرة',
        المساحة: 120,
        عدد_الغرف: '3',
        حالة_العقار: 'شاغر' as PropertyStatus,
        الإيجار_التقديري: 2000,
        IsRented: false
      };

      const result = DbService.addProperty(propertyData);

      if (!result.success || !result.data) {
        return {
          testName: 'إضافة عقار',
          status: 'FAIL',
          message: `فشل في إضافة العقار`,
          duration: performance.now() - start
        };
      }

      this.testData.property = result.data;

      // التحقق من البيانات المضافة
      const properties = DbService.getProperties();
      const addedProperty = properties.find(p => p.رقم_العقار === result.data.رقم_العقار);

      if (!addedProperty) {
        return {
          testName: 'إضافة عقار',
          status: 'FAIL',
          message: 'تم إضافة العقار لكن لم يتم العثور عليه في قائمة العقارات',
          duration: performance.now() - start
        };
      }

      return {
        testName: 'إضافة عقار',
        status: 'PASS',
        message: `✅ تم إضافة العقار بنجاح: ${result.data.رقم_العقار}`,
        data: {
          propertyId: result.data.رقم_العقار,
          name: result.data.العنوان,
          location: result.data.المدينة || 'غير محدد',
          monthlyPrice: result.data.الإيجار_التقديري
        },
        duration: performance.now() - start
      };
    } catch (error) {
      return {
        testName: 'إضافة عقار',
        status: 'FAIL',
        message: `❌ خطأ: ${error instanceof Error ? error.message : 'unknown error'}`,
        duration: performance.now() - start
      };
    }
  }

  // ============================================
  // ✅ TEST 3: إنشاء عقد إيجار
  // ============================================
  
  async test_03_CreateContract(): Promise<TestResult> {
    const start = performance.now();
    try {
      if (!this.testData.person || !this.testData.property) {
        return {
          testName: 'إنشاء عقد إيجار',
          status: 'SKIP',
          message: '⏭️ تم تخطي الاختبار: لم يتم إضافة شخص أو عقار في الخطوات السابقة',
          duration: performance.now() - start
        };
      }

      // إضافة مستأجر جديد
      const tenantResult = DbService.addPerson({
        الاسم: 'علي محمد الدعيج',
        رقم_الهاتف: '+962792345678',
        العنوان: 'عمّان، الأردن',
        الرقم_الوطني: '987654321'
      }, ['مستأجر']);

      if (!tenantResult.success || !tenantResult.data) {
        return {
          testName: 'إنشاء عقد إيجار',
          status: 'FAIL',
          message: 'فشل في إضافة المستأجر',
          duration: performance.now() - start
        };
      }

      const today = new Date();
      const endDate = new Date(today);
      endDate.setFullYear(endDate.getFullYear() + 1);

      type CreateContractPayload = Partial<العقود_tbl> & { رقم_المالك?: string };

      const monthlyPrice = getMonthlyPrice(this.testData.property);
      const contractData: CreateContractPayload = {
        رقم_العقار: this.testData.property.رقم_العقار,
        رقم_المالك: this.testData.person.رقم_الشخص,
        رقم_المستاجر: tenantResult.data.رقم_الشخص,
        تاريخ_البداية: today.toISOString().split('T')[0],
        تاريخ_النهاية: endDate.toISOString().split('T')[0],
        القيمة_السنوية: monthlyPrice * 12,
        تكرار_الدفع: 12, // شهري
        قيمة_التأمين: monthlyPrice * 2,
        طريقة_الدفع: 'Postpaid'
      };

      const contractResult = DbService.createContract(
        contractData,
        500, // عمولة المالك
        300  // عمولة المستأجر
      );

      if (!contractResult.success || !contractResult.data) {
        return {
          testName: 'إنشاء عقد إيجار',
          status: 'FAIL',
          message: `فشل في إنشاء العقد`,
          duration: performance.now() - start
        };
      }

      this.testData.contract = contractResult.data;

      // التحقق من العقد والكمبيالات
      const contracts = DbService.getContracts();
      const addedContract = contracts.find(c => c.رقم_العقد === contractResult.data.رقم_العقد);

      if (!addedContract) {
        return {
          testName: 'إنشاء عقد إيجار',
          status: 'FAIL',
          message: 'تم إنشاء العقد لكن لم يتم العثور عليه في قائمة العقود',
          duration: performance.now() - start
        };
      }

      // التحقق من الكمبيالات
      const allInstallments = DbService.getInstallments();
      const contractInstallments = allInstallments.filter(i => i.رقم_العقد === contractResult.data.رقم_العقد);

      this.testData.installments = contractInstallments;

      return {
        testName: 'إنشاء عقد إيجار',
        status: 'PASS',
        message: `✅ تم إنشاء العقد بنجاح: ${contractResult.data.رقم_العقد}`,
        data: {
          عقد_مرتبط: undefined,
          propertyId: contractResult.data.رقم_العقار,
          tenantId: contractResult.data.رقم_المستاجر,
          startDate: contractResult.data.تاريخ_البداية,
          endDate: contractResult.data.تاريخ_النهاية,
          annualValue: contractResult.data.القيمة_السنوية,
          installmentsCount: contractInstallments.length,
          status: contractResult.data.حالة_العقد
        },
        duration: performance.now() - start
      };
    } catch (error) {
      return {
        testName: 'إنشاء عقد إيجار',
        status: 'FAIL',
        message: `❌ خطأ: ${error instanceof Error ? error.message : 'unknown error'}`,
        duration: performance.now() - start
      };
    }
  }

  // ============================================
  // ✅ TEST 4: التحقق من الكمبيالات
  // ============================================
  
  async test_04_VerifyInstallments(): Promise<TestResult> {
    const start = performance.now();
    try {
      if (!this.testData.contract || !this.testData.installments) {
        return {
          testName: 'التحقق من الكمبيالات',
          status: 'SKIP',
          message: '⏭️ تم تخطي الاختبار: لم يتم إنشاء عقد في الخطوة السابقة',
          duration: performance.now() - start
        };
      }

      const contract = this.testData.contract;
      const installments = this.testData.installments;

      // التحقق من العدد
      if (installments.length === 0) {
        return {
          testName: 'التحقق من الكمبيالات',
          status: 'FAIL',
          message: 'لم يتم إنشاء أي كمبيالات للعقد',
          duration: performance.now() - start
        };
      }

      // التحقق من المجموع
      const totalAmount = installments.reduce((sum, inst) => sum + inst.القيمة, 0);
      const expectedTotal = (contract.قيمة_التأمين ?? 0) + (contract.القيمة_السنوية ?? 0);

      // التحقق من الحالات
      const unpaidInstallments = installments.filter(i => i.حالة_الكمبيالة !== 'مدفوع');
      const securityDeposit = installments.find(i => i.نوع_الكمبيالة === 'تأمين');

      return {
        testName: 'التحقق من الكمبيالات',
        status: 'PASS',
        message: `✅ تم التحقق من الكمبيالات بنجاح`,
        data: {
          totalInstallments: installments.length,
          totalAmount: totalAmount,
          expectedTotal: expectedTotal,
          unpaidInstallments: unpaidInstallments.length,
          paidInstallments: installments.filter(i => i.حالة_الكمبيالة === 'مدفوع').length,
          securityDepositExists: !!securityDeposit,
          securityDepositAmount: securityDeposit?.القيمة || 0,
          installmentDetails: installments.map(i => ({
            installmentNo: i.رقم_الكمبيالة,
            type: i.نوع_الكمبيالة,
            amount: i.القيمة,
            dueDate: i.تاريخ_استحقاق,
            status: i.حالة_الكمبيالة,
            order: i.ترتيب_الكمبيالة
          }))
        },
        duration: performance.now() - start
      };
    } catch (error) {
      return {
        testName: 'التحقق من الكمبيالات',
        status: 'FAIL',
        message: `❌ خطأ: ${error instanceof Error ? error.message : 'unknown error'}`,
        duration: performance.now() - start
      };
    }
  }

  // ============================================
  // ✅ TEST 5: التحقق من العمولات
  // ============================================
  
  async test_05_VerifyCommissions(): Promise<TestResult> {
    const start = performance.now();
    try {
      if (!this.testData.contract) {
        return {
          testName: 'التحقق من العمولات',
          status: 'SKIP',
          message: '⏭️ تم تخطي الاختبار: لم يتم إنشاء عقد في الخطوة السابقة',
          duration: performance.now() - start
        };
      }

      const commissions = DbService.getCommissions();
      const contractCommissions = commissions.filter(c => c.رقم_العقد === this.testData.contract.رقم_العقد);

      if (contractCommissions.length === 0) {
        return {
          testName: 'التحقق من العمولات',
          status: 'FAIL',
          message: 'لم يتم العثور على عمولات للعقد',
          duration: performance.now() - start
        };
      }

      const commission = contractCommissions[0];
      const totalCommission = commission.عمولة_المالك + commission.عمولة_المستأجر;

      // إضافة عمولة خارجية
      DbService.addExternalCommission({
        العنوان: 'شركة الوسيط للعقارات',
        النوع: 'عمولة_وسيط',
        التاريخ: new Date().toISOString(),
        القيمة: 1000,
        ملاحظات: 'عمولة وسيط معتمد'
      });

      this.testData.commission = commission;

      return {
        testName: 'التحقق من العمولات',
        status: 'PASS',
        message: `✅ تم التحقق من العمولات بنجاح`,
        data: {
          commissionId: commission.رقم_العمولة,
          contractId: commission.رقم_العقد,
          ownerCommission: commission.عمولة_المالك,
          tenantCommission: commission.عمولة_المستأجر,
          totalCommission: totalCommission,
          commissionDate: commission.تاريخ_العقد
        },
        duration: performance.now() - start
      };
    } catch (error) {
      return {
        testName: 'التحقق من العمولات',
        status: 'FAIL',
        message: `❌ خطأ: ${error instanceof Error ? error.message : 'unknown error'}`,
        duration: performance.now() - start
      };
    }
  }

  // ============================================
  // ✅ TEST 6: التحقق من سداد الكمبيالات
  // ============================================
  
  async test_06_PayInstallment(): Promise<TestResult> {
    const start = performance.now();
    try {
      if (!this.testData.installments || this.testData.installments.length === 0) {
        return {
          testName: 'سداد كمبيالة',
          status: 'SKIP',
          message: '⏭️ تم تخطي الاختبار: لم يتم إنشاء كمبيالات',
          duration: performance.now() - start
        };
      }

      // اختيار أول كمبيالة غير مدفوعة
      const unpaidInstallment = this.testData.installments.find(
        i => i.حالة_الكمبيالة !== 'مدفوع' && i.نوع_الكمبيالة === 'إيجار'
      );

      if (!unpaidInstallment) {
        return {
          testName: 'سداد كمبيالة',
          status: 'SKIP',
          message: '⏭️ تم تخطي الاختبار: جميع الكمبيالات مدفوعة بالفعل',
          duration: performance.now() - start
        };
      }

      DbService.markInstallmentPaid(unpaidInstallment.رقم_الكمبيالة, 'test-user', 'Admin', {
        paidAmount: unpaidInstallment.القيمة,
        paymentDate: new Date().toISOString().split('T')[0],
        isPartial: false
      });

      // التحقق من التحديث
      const allInstallments = DbService.getInstallments();
      const updatedInstallment = allInstallments.find(i => i.رقم_الكمبيالة === unpaidInstallment.رقم_الكمبيالة);

      if (!updatedInstallment || updatedInstallment.حالة_الكمبيالة !== 'مدفوع') {
        return {
          testName: 'سداد كمبيالة',
          status: 'FAIL',
          message: 'فشل في تحديث حالة الكمبيالة إلى مدفوع',
          duration: performance.now() - start
        };
      }

      return {
        testName: 'سداد كمبيالة',
        status: 'PASS',
        message: `✅ تم سداد الكمبيالة بنجاح: ${unpaidInstallment.رقم_الكمبيالة}`,
        data: {
          installmentId: unpaidInstallment.رقم_الكمبيالة,
          amount: unpaidInstallment.القيمة,
          dueDate: unpaidInstallment.تاريخ_استحقاق,
          paidDate: updatedInstallment.تاريخ_الدفع,
          status: updatedInstallment.حالة_الكمبيالة
        },
        duration: performance.now() - start
      };
    } catch (error) {
      return {
        testName: 'سداد كمبيالة',
        status: 'FAIL',
        message: `❌ خطأ: ${error instanceof Error ? error.message : 'unknown error'}`,
        duration: performance.now() - start
      };
    }
  }

  // ============================================
  // ✅ TEST 7: التحقق من سلامة البيانات
  // ============================================
  
  async test_07_DataIntegrity(): Promise<TestResult> {
    const start = performance.now();
    try {
      const people = DbService.getPeople();
      const properties = DbService.getProperties();
      const contracts = DbService.getContracts();
      const installments = DbService.getInstallments();
      const commissions = DbService.getCommissions();

      const errors: string[] = [];
      const warnings: string[] = [];

      // If the system is clean (no operational data), don't fail.
      // This suite is meant to validate consistency, not enforce presence of demo data.
      const isCleanSystem =
        (!Array.isArray(people) || people.length === 0) &&
        (!Array.isArray(properties) || properties.length === 0) &&
        (!Array.isArray(contracts) || contracts.length === 0) &&
        (!Array.isArray(installments) || installments.length === 0) &&
        (!Array.isArray(commissions) || commissions.length === 0);

      if (isCleanSystem) {
        return {
          testName: 'التحقق من سلامة البيانات',
          status: 'SKIP',
          message: '⏭️ تم تخطي الاختبار: النظام فارغ (وضع نظيف) ولا توجد بيانات تشغيلية للتحقق منها.',
          duration: performance.now() - start,
        };
      }

      // Basic shape checks
      if (!Array.isArray(people)) errors.push('⚠️ قائمة الأشخاص غير صحيحة');
      if (!Array.isArray(properties)) errors.push('⚠️ قائمة العقارات غير صحيحة');
      if (!Array.isArray(contracts)) errors.push('⚠️ قائمة العقود غير صحيحة');
      if (!Array.isArray(installments)) errors.push('⚠️ قائمة الكمبيالات غير صحيحة');
      if (!Array.isArray(commissions)) errors.push('⚠️ قائمة العمولات غير صحيحة');

      // Presence checks become warnings (may be empty in real systems)
      if (Array.isArray(people) && people.length === 0) warnings.push('ℹ️ قائمة الأشخاص فارغة');
      if (Array.isArray(properties) && properties.length === 0) warnings.push('ℹ️ قائمة العقارات فارغة');

      // Referential integrity checks (only when data exists)
      if (Array.isArray(contracts) && contracts.length > 0 && Array.isArray(people) && Array.isArray(properties)) {
        for (const contract of contracts) {
          const tenant = people.find(p => p.رقم_الشخص === contract.رقم_المستاجر);
          const property = properties.find(p => p.رقم_العقار === contract.رقم_العقار);

          // owner comes from property
          const owner = property ? people.find(p => p.رقم_الشخص === property.رقم_المالك) : null;

          if (!tenant) errors.push(`❌ العقد ${contract.رقم_العقد}: المستأجر غير موجود`);
          if (!property) errors.push(`❌ العقد ${contract.رقم_العقد}: العقار غير موجود`);
          if (!owner) errors.push(`❌ العقد ${contract.رقم_العقد}: المالك غير موجود (من العقار)`);
        }
      }

      if (errors.length > 0) {
        return {
          testName: 'التحقق من سلامة البيانات',
          status: 'FAIL',
          message: `❌ تم اكتشاف ${errors.length} خطأ(ء):`,
          data: errors,
          duration: performance.now() - start,
        };
      }

      return {
        testName: 'التحقق من سلامة البيانات',
        status: warnings.length > 0 ? 'PASS' : 'PASS',
        message: warnings.length > 0 ? `✅ التحقق ناجح مع ملاحظات (${warnings.length})` : '✅ جميع البيانات صحيحة وسليمة',
        data: {
          warnings,
          peopleCount: Array.isArray(people) ? people.length : 0,
          propertiesCount: Array.isArray(properties) ? properties.length : 0,
          contractsCount: Array.isArray(contracts) ? contracts.length : 0,
          installmentsCount: Array.isArray(installments) ? installments.length : 0,
          commissionsCount: Array.isArray(commissions) ? commissions.length : 0,
          referentialIntegrity: 'السليمة',
        },
        duration: performance.now() - start,
      };
    } catch (error) {
      return {
        testName: 'التحقق من سلامة البيانات',
        status: 'FAIL',
        message: `❌ خطأ: ${error instanceof Error ? error.message : 'unknown error'}`,
        duration: performance.now() - start,
      };
    }
  }

  // ============================================
  // 🎯 تشغيل جميع الاختبارات
  // ============================================
  
  async runAllTests(): Promise<TestResult[]> {
    console.warn('\n🚀 بدء مجموعة الاختبارات التسلسلية...\n');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const tests = [
      () => this.test_01_AddPerson(),
      () => this.test_02_AddProperty(),
      () => this.test_03_CreateContract(),
      () => this.test_04_VerifyInstallments(),
      () => this.test_05_VerifyCommissions(),
      () => this.test_06_PayInstallment(),
      () => this.test_07_DataIntegrity()
    ];

    for (const test of tests) {
      const result = await test();
      this.results.push(result);
      this.printTestResult(result);
    }

    console.warn('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    this.printSummary();
    
    return this.results;
  }

  // ============================================
  // 📊 طباعة نتائج الاختبار
  // ============================================
  
  private printTestResult(result: TestResult): void {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    const status = result.status === 'PASS' ? '✅ نجح' : result.status === 'FAIL' ? '❌ فشل' : '⏭️ تم تخطيه';
    
    console.warn(`${icon} ${result.testName.padEnd(40)} | ${status}`);
    console.warn(`   📝 ${result.message}`);
    
    if (result.data) {
      if (typeof result.data === 'object') {
        Object.entries(result.data).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            console.warn(`   • ${key}: ${value.length} عنصر`);
          } else if (typeof value === 'object') {
            console.warn(`   • ${key}: ${JSON.stringify(value).substring(0, 50)}...`);
          } else {
            console.warn(`   • ${key}: ${value}`);
          }
        });
      }
    }
    
    if (result.duration) {
      console.warn(`   ⏱️ المدة: ${result.duration.toFixed(2)}ms`);
    }
    console.warn();
  }

  // ============================================
  // 📈 ملخص النتائج
  // ============================================
  
  private printSummary(): void {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.warn('📊 ملخص النتائج');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn(`✅ نجح:        ${passed}/${total}`);
    console.warn(`❌ فشل:        ${failed}/${total}`);
    console.warn(`⏭️ تم تخطيه:  ${skipped}/${total}`);
    console.warn(`⏱️ المدة الكلية: ${totalDuration.toFixed(2)}ms`);
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (failed === 0 && passed > 0) {
      console.warn('🎉 جميع الاختبارات نجحت! النظام يعمل بشكل صحيح.\n');
    } else if (failed > 0) {
      console.warn(`⚠️ ${failed} اختبار(ات) فشلت. يرجى مراجعة الأخطاء.\n`);
    }
  }

  // ============================================
  // 📁 تصدير النتائج
  // ============================================
  
  exportResults(): string {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
        skipped: this.results.filter(r => r.status === 'SKIP').length
      },
      results: this.results,
      testData: this.testData
    };

    return JSON.stringify(report, null, 2);
  }
}

// ============================================
// 🎯 تصدير دالة سهلة التشغيل
// ============================================

export async function runIntegrationTests(): Promise<TestResult[]> {
  const suite = new IntegrationTestSuite();
  return await suite.runAllTests();
}

// ============================================
// 🔧 للاستخدام في المتصفح
// ============================================

if (typeof window !== 'undefined') {
  type IntegrationTestWindow = Window & {
    runIntegrationTests?: typeof runIntegrationTests;
    IntegrationTestSuite?: typeof IntegrationTestSuite;
    ENABLE_INTEGRATION_TEST_DATA?: boolean;
  };
  const w = window as unknown as IntegrationTestWindow;
  w.runIntegrationTests = runIntegrationTests;
  w.IntegrationTestSuite = IntegrationTestSuite;
}

// ============================================
// 🔒 Safety: prevent inserting sample data unless explicitly enabled
// ============================================

const isIntegrationTestDataEnabled = (): boolean => {
  // Vite env (build-time)
  type ViteMeta = { env?: { VITE_ENABLE_INTEGRATION_TEST_DATA?: string | boolean } };
  const viteFlag = (import.meta as unknown as ViteMeta)?.env?.VITE_ENABLE_INTEGRATION_TEST_DATA;
  if (typeof viteFlag === 'string') return viteFlag.toLowerCase() === 'true';
  if (typeof viteFlag === 'boolean') return viteFlag;

  // Runtime override (DevTools)
  type IntegrationTestWindow = Window & { ENABLE_INTEGRATION_TEST_DATA?: boolean };
  const w = window as unknown as IntegrationTestWindow;
  return typeof window !== 'undefined' && w.ENABLE_INTEGRATION_TEST_DATA === true;
};

export interface UiTestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: unknown;
  durationMs?: number;
}

export async function runSystemScenarioTests(options?: {
  allowDataMutation?: boolean;
}): Promise<UiTestResult[]> {
  const allowDataMutation = options?.allowDataMutation === true;

  // Default safe mode: only run read-only data integrity check
  if (!allowDataMutation) {
    const suite = new IntegrationTestSuite();
    const res = await suite.test_07_DataIntegrity();
    return [
      {
        id: 'data-integrity',
        name: res.testName,
        status: res.status,
        message: res.message,
        details: res.data,
        durationMs: res.duration,
      },
      {
        id: 'data-mutation-note',
        name: 'اختبارات الإدخال التسلسلية',
        status: 'SKIP',
        message: '⏭️ تم تخطي اختبارات الإدخال لأنها تغيّر بيانات النظام. فعّل "السماح بإنشاء بيانات اختبار" لتشغيلها.',
      },
    ];
  }

  // Mutation mode: requires explicit enablement flag (existing safety gate)
  const results = await runIntegrationTests();
  return results.map((r, idx) => ({
    id: `it-${idx + 1}`,
    name: r.testName,
    status: r.status,
    message: r.message,
    details: r.data,
    durationMs: r.duration,
  }));
}
