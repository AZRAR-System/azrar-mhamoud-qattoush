# 📊 تقرير ترابط البيانات في النظام
**© 2025 - Developed by Mahmoud Qattoush**
**AZRAR Real Estate Management System**

---

## ✅ حالة البيانات التجريبية

### 🔧 الإعدادات الحالية:
```typescript
const ENABLE_DEMO_DATA = false; // ❌ مُعطّل - نظام نظيف بدون بيانات تجريبية
```

**النتيجة:** النظام يعمل بدون أي بيانات تجريبية افتراضية ✅

---

## 🔗 ترابط الصفحات مع قاعدة البيانات

### 1️⃣ **صفحة الأشخاص** (`People.tsx`)
**الترابط:** ✅ **100% متصل بالبيانات الفعلية**

| العملية | المصدر |
|---------|--------|
| عرض الأشخاص | `DbService.getPeople()` |
| الأدوار | `DbService.getPersonRoles(id)` |
| إضافة شخص | `DbService.addPerson()` |
| تحديث شخص | `DbService.updatePerson()` |
| حذف شخص | `DbService.deletePerson()` |
| القائمة السوداء | `DbService.getPersonBlacklistStatus()` |
| العقارات المملوكة | `DbService.getProperties()` |

**التفاصيل:**
- ✅ جميع البيانات تُحمّل من `localStorage` عبر `DbService`
- ✅ التحديثات الفورية بعد كل عملية
- ✅ الفلترة والبحث يعملان على البيانات الفعلية

---

### 2️⃣ **صفحة العقارات** (`Properties.tsx`)
**الترابط:** ✅ **100% متصل بالبيانات الفعلية**

| العملية | المصدر |
|---------|--------|
| عرض العقارات | `DbService.getProperties()` |
| اسم المالك | `DbService.getPeople()` |
| إضافة عقار | `DbService.addProperty()` |
| تحديث عقار | `DbService.updateProperty()` |
| حذف عقار | `DbService.deleteProperty()` |
| تفاصيل العقار | `DbService.getPropertyDetails()` |

**التفاصيل:**
- ✅ ربط تلقائي بين العقار والمالك
- ✅ حساب نسبة الإشغال من البيانات الفعلية
- ✅ الفلترة المتقدمة (المساحة، السعر، الطابق)

---

### 3️⃣ **صفحة العقود** (`Contracts.tsx`)
**الترابط:** ✅ **100% متصل بالبيانات الفعلية**

| العملية | المصدر |
|---------|--------|
| عرض العقود | `DbService.getContracts()` |
| العقارات | `DbService.getProperties()` |
| الأشخاص | `DbService.getPeople()` |
| إضافة عقد | `DbService.addContract()` |
| تحديث عقد | `DbService.updateContract()` |
| حذف عقد | `DbService.deleteContract()` |

**التفاصيل:**
- ✅ ربط ثلاثي: عقد ← عقار ← مالك/مستأجر
- ✅ استخدام `useMemo` للأداء العالي
- ✅ Maps للبحث السريع

---

### 4️⃣ **صفحة الأقساط** (`Installments.tsx`)
**الترابط:** ✅ **100% متصل بالبيانات الفعلية**

| العملية | المصدر |
|---------|--------|
| عرض الأقساط | `DbService.getInstallments()` |
| العقود | `DbService.getContracts()` |
| الأشخاص | `DbService.getPeople()` |
| العقارات | `DbService.getProperties()` |
| تحديث حالة | `DbService.updateInstallment()` |

**التفاصيل:**
- ✅ حساب الأقساط المتأخرة من التاريخ الفعلي
- ✅ ربط رباعي: قسط ← عقد ← عقار ← مستأجر
- ✅ فلترة حسب الحالة والتاريخ

---

### 5️⃣ **صفحة العمليات** (`Operations.tsx`)
**الترابط:** ✅ **100% متصل بالبيانات الفعلية**

| العملية | المصدر |
|---------|--------|
| العقود النشطة | `DbService.getContracts()` |
| الأقساط | `DbService.getInstallments()` |
| الأشخاص | `DbService.getPeople()` |
| العقارات | `DbService.getProperties()` |
| تحديث الدفع | `DbService.updateInstallment()` |

**التفاصيل:**
- ✅ عرض الأقساط المستحقة فقط
- ✅ تحديث فوري للحالة
- ✅ إشعارات للمستخدم

---

### 6️⃣ **لوحة القيادة** (`Dashboard.tsx`)
**الترابط:** ✅ **100% متصل بالبيانات الفعلية**

| المؤشر | المصدر |
|--------|--------|
| إجمالي الإيرادات | `DbService.getCommissions()` |
| العقود النشطة | `DbService.getContracts()` |
| نسبة الإشغال | `DbService.getProperties()` |
| الأقساط المتأخرة | `DbService.getInstallments()` |
| المبيعات | `DbService.getSalesListings()` |
| المهام | `DbService.getFollowUps()` |
| التنبيهات | `DbService.getAlerts()` |

**التفاصيل:**
- ✅ جميع المؤشرات محسوبة من البيانات الفعلية
- ✅ تحديث تلقائي كل 30 ثانية
- ✅ رسوم بيانية ديناميكية

---

## 🗄️ قاعدة البيانات (LocalStorage)

### المفاتيح المستخدمة:
```typescript
const KEYS = {
  PEOPLE: 'db_people',                    // الأشخاص
  PROPERTIES: 'db_properties',            // العقارات
  CONTRACTS: 'db_contracts',              // العقود
  INSTALLMENTS: 'db_installments',        // الأقساط
  COMMISSIONS: 'db_commissions',          // العمولات
  SALES_LISTINGS: 'db_sales_listings',    // قوائم المبيعات
  FOLLOW_UPS: 'db_followups',             // المتابعات
  ALERTS: 'db_alerts',                    // التنبيهات
  MAINTENANCE: 'db_maintenance_tickets',  // الصيانة
  // ... المزيد
}
```

### ✅ جميع البيانات مخزنة محلياً في المتصفح
### ✅ لا توجد بيانات وهمية أو تجريبية افتراضية
### ✅ النظام يبدأ فارغاً تماماً

---

## 🔍 البيانات الثابتة في النظام

### ✅ البيانات الثابتة (ضرورية للنظام):

#### 1. **قوالب التقارير** (`MOCK_REPORTS`)
```typescript
const MOCK_REPORTS: ReportDefinition[] = [
  { id: 'financial_summary', title: 'الملخص المالي', ... },
  { id: 'late_installments', title: 'الأقساط المتأخرة', ... },
  { id: 'tenant_list', title: 'قائمة المستأجرين', ... },
  { id: 'contracts_active', title: 'العقود السارية', ... },
  { id: 'properties_vacant', title: 'العقارات الشاغرة', ... },
  // ... 9 قوالب تقارير
]
```
**الحالة:** ✅ **ضرورية** - قوالب ثابتة للنظام، ليست بيانات تجريبية
**الاستخدام:** تُستخدم في صفحة التقارير لتوليد تقارير ديناميكية من البيانات الفعلية

#### 2. **قوالب الإشعارات القانونية** (`MOCK_LEGAL_TEMPLATES`)
```typescript
const MOCK_LEGAL_TEMPLATES: LegalNoticeTemplate[] = [
  { id: 'late_payment_friendly', title: 'إشعار تأخير دفع (ودي)', ... },
  { id: 'late_payment_legal', title: 'إشعار تأخير دفع (قانوني)', ... },
  { id: 'eviction_notice', title: 'إخطار بالإخلاء', ... },
  { id: 'renewal_notice', title: 'إخطار مبدئي قبل التجديد', ... },
  { id: 'maintenance_entry', title: 'إشعار دخول للصيانة', ... },
  { id: 'mutual_termination', title: 'اتفاقية إنهاء بالتراضي', ... },
]
```
**الحالة:** ✅ **ضرورية** - قوالب ثابتة للنظام، ليست بيانات تجريبية
**الاستخدام:** تُستخدم في المركز القانوني لإنشاء إشعارات قانونية مخصصة

#### 3. **قوائم البحث الثابتة** (`Lookups`)
```typescript
// تُحمّل عند أول تشغيل فقط إذا كانت فارغة
[
  { id: '1', category: 'person_roles', label: 'مالك' },
  { id: '2', category: 'person_roles', label: 'مستأجر' },
  { id: '3', category: 'person_roles', label: 'كفيل' },
  { id: '4', category: 'prop_type', label: 'شقة' },
  { id: '5', category: 'prop_type', label: 'محل تجاري' },
  { id: '6', category: 'prop_status', label: 'شاغر' },
  { id: '7', category: 'prop_status', label: 'مؤجر' }
]
```
**الحالة:** ✅ **ضرورية** - قوائم أساسية للنظام
**الاستخدام:** تُستخدم في القوائم المنسدلة والفلاتر

#### 4. **مستخدم Admin الافتراضي**
```typescript
// يُنشأ فقط إذا لم يكن هناك مستخدمين
{
  id: '1',
  اسم_المستخدم: 'admin',
  كلمة_المرور: '123456',
  الدور: 'SuperAdmin',
  isActive: true
}
```
**الحالة:** ✅ **ضرورية** - للدخول الأول للنظام
**الاستخدام:** يسمح بالدخول الأول لإعداد النظام

---

## ✅ التحقق النهائي

### ✔️ **جميع الصفحات متصلة بالبيانات الفعلية**
- ✅ People.tsx - يستخدم `DbService.getPeople()`
- ✅ Properties.tsx - يستخدم `DbService.getProperties()`
- ✅ Contracts.tsx - يستخدم `DbService.getContracts()`
- ✅ Installments.tsx - يستخدم `DbService.getInstallments()`
- ✅ Operations.tsx - يستخدم بيانات فعلية من جميع الجداول
- ✅ Dashboard.tsx - جميع المؤشرات محسوبة من البيانات الفعلية
- ✅ Sales.tsx - يستخدم `DbService.getSalesListings()`
- ✅ Maintenance.tsx - يستخدم `DbService.getMaintenanceTickets()`
- ✅ Commissions.tsx - يستخدم `DbService.getCommissions()`

### ✔️ **لا توجد بيانات تجريبية افتراضية**
- ✅ `ENABLE_DEMO_DATA = false` في `mockDb.ts`
- ✅ النظام يبدأ فارغاً تماماً
- ✅ يمكن تفعيل البيانات التجريبية من صفحة "مدير قواعد البيانات"

### ✔️ **جميع العمليات تُحدّث قاعدة البيانات فوراً**
- ✅ إضافة/تحديث/حذف الأشخاص
- ✅ إضافة/تحديث/حذف العقارات
- ✅ إضافة/تحديث/حذف العقود
- ✅ تحديث حالة الأقساط
- ✅ إضافة العمولات
- ✅ تسجيل العمليات في السجل

### ✔️ **الترابط الكامل بين جميع الجداول**
```
الأشخاص ←→ العقارات (المالك)
الأشخاص ←→ العقود (المستأجر)
العقارات ←→ العقود (العقار)
العقود ←→ الأقساط (العقد)
العقود ←→ العمولات (العقد)
الأشخاص ←→ القائمة السوداء (الشخص)
العقارات ←→ الصيانة (العقار)
```

---

## 📊 إحصائيات النظام

### الصفحات الرئيسية: **15 صفحة**
- ✅ Dashboard (لوحة القيادة)
- ✅ People (الأشخاص)
- ✅ Properties (العقارات)
- ✅ Contracts (العقود)
- ✅ Installments (الأقساط)
- ✅ Operations (العمليات)
- ✅ Sales (المبيعات)
- ✅ Maintenance (الصيانة)
- ✅ Commissions (العمولات)
- ✅ Reports (التقارير)
- ✅ LegalHub (المركز القانوني)
- ✅ Settings (الإعدادات)
- ✅ DatabaseManager (مدير قواعد البيانات)
- ✅ AdminControlPanel (لوحة التحكم)
- ✅ SystemMaintenance (صيانة النظام)

### الجداول في قاعدة البيانات: **23 جدول**
```typescript
1.  db_people                  // الأشخاص
2.  db_properties              // العقارات
3.  db_contracts               // العقود
4.  db_installments            // الأقساط
5.  db_roles                   // أدوار الأشخاص
6.  db_commissions             // العمولات
7.  db_users                   // المستخدمين
8.  db_user_permissions        // صلاحيات المستخدمين
9.  db_alerts                  // التنبيهات
10. db_sales_listings          // قوائم المبيعات
11. db_sales_offers            // عروض الشراء
12. db_sales_agreements        // اتفاقيات البيع
13. db_maintenance_tickets     // تذاكر الصيانة
14. db_lookups                 // قوائم البحث
15. db_lookup_categories       // فئات قوائم البحث
16. db_settings                // الإعدادات
17. db_operations              // سجل العمليات
18. db_blacklist               // القائمة السوداء
19. db_attachments             // المرفقات
20. db_activities              // الأنشطة
21. db_notes                   // الملاحظات
22. db_legal_templates         // قوالب الإشعارات القانونية
23. db_followups               // المتابعات
```

---

## 📝 ملاحظات مهمة

### 1. **البيانات التجريبية**
- ❌ **معطلة افتراضياً:** `ENABLE_DEMO_DATA = false`
- ✅ **يمكن تفعيلها للاختبار:** من صفحة "مدير قواعد البيانات"
- ✅ **تحتوي على:** 4 أشخاص، 3 عقارات، 3 عقود، 36 قسط

### 2. **القوالب الثابتة**
- ✅ **9 قوالب تقارير** - للتقارير المالية والإدارية
- ✅ **6 قوالب إشعارات قانونية** - للإشعارات والإنذارات
- ✅ **7 قوائم بحث أساسية** - للأدوار والأنواع والحالات

### 3. **التخزين**
- 💾 **جميع البيانات محلية:** مخزنة في `localStorage`
- 🔄 **تحديث فوري:** كل عملية تُحدّث البيانات مباشرة
- 📊 **Cache ذكي:** لتحسين الأداء

### 4. **الأمان**
- 🔐 **نظام صلاحيات RBAC:** 4 أدوار (SuperAdmin, Admin, Employee, Tenant)
- 📝 **تسجيل العمليات:** كل عملية تُسجّل في السجل
- ⚠️ **عمليات حساسة:** تتطلب صلاحيات Admin أو أعلى

---

## 🚀 الخطوات التالية

### للاستخدام الإنتاجي:
1. ✅ النظام جاهز للاستخدام مباشرة
2. ✅ ابدأ بإضافة البيانات الفعلية
3. ✅ أو فعّل البيانات التجريبية للاختبار

### للتطوير:
1. 🔄 ربط النظام بقاعدة بيانات خارجية (SQL Server, PostgreSQL)
2. 🌐 إضافة API خلفي (Backend)
3. 📱 تطوير تطبيق موبايل
4. 📧 إضافة نظام إشعارات بالبريد الإلكتروني

---

**✅ النظام جاهز للاستخدام الإنتاجي بدون أي بيانات وهمية!**
**🎯 جميع الصفحات مترابطة بشكل كامل مع قاعدة البيانات!**
**🔒 نظام آمن ومحمي بصلاحيات RBAC!**

