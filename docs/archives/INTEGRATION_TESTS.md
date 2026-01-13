# 🧪 دليل الاختبارات والتكامل - الدليل الشامل

**آخر تحديث**: 2026-01-01  
**الحالة**: ✅ نظام اختبار كامل وجاهز

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [أنواع الاختبارات](#أنواع-الاختبارات)
3. [تشغيل الاختبارات](#تشغيل-الاختبارات)
4. [كتابة اختبارات جديدة](#كتابة-اختبارات-جديدة)
5. [حالات الاستخدام الشائعة](#حالات-الاستخدام-الشائعة)

---

## 🎯 نظرة عامة

نظام AZRAR يحتوي على 3 أنواع من الاختبارات:
- ✅ **Integration Tests**: اختبارات التكامل بين المكونات
- ✅ **System Tests**: اختبارات السيناريوهات الكاملة
- ✅ **Data Validation Tests**: اختبارات سلامة البيانات

---

## 🧩 أنواع الاختبارات

### 1️⃣ **Integration Tests**

**الملف**: `src/services/integrationTests.ts`

**الهدف**: التأكد من تكامل المكونات (Person → Property → Contract → Installments)

**السيناريوهات**:
1. إنشاء شخص → عقار → عقد → كمبيالات
2. التحقق من العلاقات الخارجية (Foreign Keys)
3. اختبار الحالات الحدية (Edge Cases)

**التشغيل**:
```
الصفحة: System Maintenance
التبويب: اختبار النظام
الزر: "تشغيل الاختبارات"
```

---

### 2️⃣ **System Tests**

**الملف**: `src/services/comprehensiveTests.ts`

**الهدف**: اختبار السيناريوهات الكاملة end-to-end

**السيناريوهات**:
- إنشاء مستأجر → بحث عن عقار → عقد إيجار → دفعات
- إضافة مالك → عقار → عرضه للبيع → بيعه
- اختبار RBAC (الصلاحيات)
- اختبار التنبيهات

---

### 3️⃣ **Data Validation Tests**

**الملف**: `src/services/dataValidation.ts`

**الهدف**: التحقق من سلامة البيانات في قاعدة البيانات

**الفحوصات**:
- ✅ Foreign Key Integrity (صحة العلاقات)
- ✅ Unique Constraints (عدم التكرار)
- ✅ Date Logic (منطق التواريخ)
- ✅ Orphaned Records (سجلات يتيمة)

**التشغيل**:
```typescript
import { validateAllData } from '@/services/dataValidation';

const result = validateAllData();
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);
```

---

## 🚀 تشغيل الاختبارات

### من الواجهة (UI)

**المسار**: System Maintenance → تبويب "اختبار النظام"

**الخطوات**:
1. افتح صفحة **System Maintenance** (`/#/system-maintenance`)
2. اضغط تبويب **"اختبار النظام"**
3. (اختياري) فعّل "السماح بإنشاء بيانات اختبار"
4. اضغط **"تشغيل الاختبارات"**
5. انتظر النتائج (~5-10 ثواني)

**النتيجة**:
- ✅ عرض ملخص (Pass / Fail / Skip)
- ✅ تفاصيل كل اختبار
- ✅ الوقت المستغرق لكل اختبار

---

### من الكود (Programmatic)

```typescript
import { runSystemScenarioTests } from '@/services/integrationTests';

// تشغيل الاختبارات (قراءة فقط)
const results = await runSystemScenarioTests({ 
  allowDataMutation: false 
});

console.log('Total:', results.length);
console.log('Passed:', results.filter(r => r.status === 'PASS').length);
console.log('Failed:', results.filter(r => r.status === 'FAIL').length);
```

---

### من Browser Console

```javascript
// 1) استدعاء الدالة
const tests = await window.runSystemTests();

// 2) عرض النتائج
console.table(tests.map(t => ({
  name: t.name,
  status: t.status,
  duration: `${t.durationMs}ms`
})));

// 3) عرض الاختبارات الفاشلة فقط
tests.filter(t => t.status === 'FAIL').forEach(t => {
  console.error('❌', t.name, ':', t.message);
});
```

---

## ✍️ كتابة اختبارات جديدة

### مثال: اختبار إنشاء عقد

```typescript
import { DbService } from '@/services/mockDb';

export function testContractCreation() {
  const start = performance.now();
  
  try {
    // 1) إنشاء مالك
    const owner = DbService.addPerson({
      الاسم_الأول: 'أحمد',
      اسم_العائلة: 'السالم',
      دور_الشخص: 'مالك',
      // ...
    });
    
    if (!owner.success) {
      return {
        id: 'test-contract-001',
        name: 'إنشاء عقد',
        status: 'FAIL',
        message: 'فشل إنشاء المالك',
        durationMs: performance.now() - start
      };
    }
    
    // 2) إنشاء عقار
    const property = DbService.addProperty({
      رقم_المالك: owner.data!.رقم_الشخص,
      نوع_العقار: 'شقة',
      // ...
    });
    
    // 3) إنشاء مستأجر
    const tenant = DbService.addPerson({
      دور_الشخص: 'مستأجر',
      // ...
    });
    
    // 4) إنشاء عقد
    const contract = DbService.addContract({
      رقم_العقار: property.data!.رقم_العقار,
      رقم_المستأجر: tenant.data!.رقم_الشخص,
      قيمة_الإيجار: 1000,
      // ...
    });
    
    // 5) التحقق
    if (!contract.success) {
      return {
        id: 'test-contract-001',
        name: 'إنشاء عقد',
        status: 'FAIL',
        message: contract.message,
        durationMs: performance.now() - start
      };
    }
    
    // 6) التحقق من الكمبيالات
    const installments = DbService.getInstallments()
      .filter(i => i.رقم_العقد === contract.data!.رقم_العقد);
    
    if (installments.length === 0) {
      return {
        id: 'test-contract-001',
        name: 'إنشاء عقد',
        status: 'FAIL',
        message: 'لم يتم إنشاء كمبيالات',
        durationMs: performance.now() - start
      };
    }
    
    // ✅ نجح
    return {
      id: 'test-contract-001',
      name: 'إنشاء عقد',
      status: 'PASS',
      message: `تم إنشاء ${installments.length} كمبيالة`,
      durationMs: performance.now() - start,
      details: { contractId: contract.data!.رقم_العقد }
    };
    
  } catch (err: any) {
    return {
      id: 'test-contract-001',
      name: 'إنشاء عقد',
      status: 'FAIL',
      message: err.message,
      durationMs: performance.now() - start
    };
  }
}
```

---

## 📚 حالات الاستخدام الشائعة

### 1️⃣ **التحقق من سلامة النظام قبل النشر**

```typescript
// 1) تشغيل جميع الاختبارات
const tests = await runSystemScenarioTests({ allowDataMutation: false });

// 2) التحقق من عدم وجود فشل
const failed = tests.filter(t => t.status === 'FAIL');

if (failed.length > 0) {
  console.error('⚠️ يوجد اختبارات فاشلة، لا تنشر!');
  failed.forEach(t => console.error('  -', t.name, ':', t.message));
  process.exit(1);
} else {
  console.log('✅ جميع الاختبارات نجحت، يمكن النشر');
}
```

---

### 2️⃣ **التحقق من البيانات بعد الاستيراد**

```typescript
// بعد استيراد بيانات من نظام قديم
import { validateAllData } from '@/services/dataValidation';

const validation = validateAllData();

if (!validation.isValid) {
  console.error('❌ أخطاء في البيانات المستوردة:');
  validation.errors.forEach(e => console.error('  -', e));
  
  console.warn('⚠️ تحذيرات:');
  validation.warnings.forEach(w => console.warn('  -', w));
}
```

---

### 3️⃣ **اختبار RBAC (الصلاحيات)**

```typescript
import { can } from '@/utils/permissions';

// اختبار جميع الأدوار والصلاحيات
const roles = ['SuperAdmin', 'Admin', 'Manager', 'Employee', 'Viewer'];
const actions = ['INSTALLMENT_PAY', 'INSTALLMENT_REVERSE', 'CONTRACT_DELETE'];

roles.forEach(role => {
  console.log(`\nRole: ${role}`);
  actions.forEach(action => {
    const allowed = can(role, action);
    console.log(`  ${allowed ? '✅' : '❌'} ${action}`);
  });
});
```

---

## 🎯 الخلاصة

نظام الاختبارات في AZRAR:
- ✅ **شامل**: يغطي جميع المكونات الرئيسية
- ✅ **سهل الاستخدام**: واجهة UI + Console + Programmatic
- ✅ **سريع**: ~5-10 ثواني لجميع الاختبارات
- ✅ **آمن**: وضع "قراءة فقط" افتراضيًا

---

**© 2025 - Developed by Mahmoud Qattoush**  
**AZRAR Real Estate Management System - All Rights Reserved**
