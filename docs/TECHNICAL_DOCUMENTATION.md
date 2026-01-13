# 📘 AZRAR - التوثيق التقني الشامل

**آخر تحديث:** 05 يناير 2026  
**الإصدار:** 3.0  
**الحالة:** ✅ جاهز للإنتاج

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [الهيكلية التقنية](#الهيكلية-التقنية)
3. [قاعدة البيانات](#قاعدة-البيانات)
4. [الخدمات الأساسية](#الخدمات-الأساسية)
5. [نظام حذف البيانات](#نظام-حذف-البيانات)
6. [الأمان والصلاحيات](#الأمان-والصلاحيات)
7. [واجهة المستخدم](#واجهة-المستخدم)
8. [الاختبارات](#الاختبارات)
9. [النشر](#النشر)
10. [تحديثات الصيانة الأخيرة (سطح المكتب + المزامنة + الترويسة)](#تحديثات-الصيانة-الأخيرة-سطح-المكتب--المزامنة--الترويسة)

---

## 🎯 نظرة عامة

### المشروع
**الاسم:** AZRAR Real Estate Management System  
**النوع:** نظام إدارة عقارات شامل  
**التقنيات:** React 18, TypeScript, Tailwind CSS, Vite

### الميزات الرئيسية
- ✅ إدارة الأشخاص (ملاك، مستأجرين، كفلاء، وسطاء)
- ✅ إدارة العقارات (شقق، محلات، فلل، أراضي)
- ✅ إدارة العقود والكمبيالات
- ✅ نظام الدفعات والتحصيل
- ✅ التقارير والإحصائيات
- ✅ نظام الصلاحيات RBAC
- ✅ نظام حذف البيانات وإعادة التهيئة ⭐ جديد
- ✅ مزامنة SQL Server لنسخة سطح المكتب + سجل مزامنة مفصّل ⭐ (يناير 2026)
- ✅ ترويسة الشركة للطباعة والتصدير (Excel/Print) ⭐ (يناير 2026)

---

## 🏗️ الهيكلية التقنية

### Frontend Stack
```
React 18.3.1
├── TypeScript 5.6.2
├── Vite 6.4.1
├── Tailwind CSS 3.4.17
├── Recharts 2.15.0
└── Lucide React 0.469.0
```

### Project Structure
```
src/
├── components/          # المكونات القابلة لإعادة الاستخدام
│   ├── ui/             # مكونات واجهة المستخدم الأساسية
│   ├── dashboard/      # مكونات لوحة التحكم
│   ├── shared/         # مكونات مشتركة
│   └── forms/          # نماذج الإدخال
├── pages/              # صفحات التطبيق
│   ├── Dashboard.tsx
│   ├── People.tsx
│   ├── Properties.tsx
│   ├── Contracts.tsx
│   ├── DatabaseReset.tsx  ⭐ جديد
│   └── ...
├── services/           # خدمات البيانات والمنطق
│   ├── mockDb.ts       # خدمة قاعدة البيانات الرئيسية
│   ├── resetDatabase.ts ⭐ جديد
│   ├── dataValidation.ts
│   └── ...
├── context/            # React Contexts
│   ├── AuthContext.tsx
│   ├── ModalContext.tsx
│   └── ToastContext.tsx
├── types/              # تعريفات TypeScript
│   └── index.ts
├── utils/              # دوال مساعدة
├── hooks/              # Custom React Hooks
└── constants/          # الثوابت والإعدادات
```

---

## 💾 قاعدة البيانات

### نظام التخزين
**النوع:** localStorage (Browser Storage)  
**السبب:** نظام محلي بدون خادم  
**الحجم:** ~200-250KB (مع البيانات التجريبية)

### الجداول الرئيسية (33+ جدول)

#### 1. الجداول الأساسية (9 جداول)
```typescript
db_people              // الأشخاص
db_properties          // العقارات
db_contracts           // العقود
db_installments        // الكمبيالات
db_payments            // الدفعات
db_roles               // أدوار الأشخاص
db_commissions         // العمولات
db_users               // المستخدمين
db_user_permissions    // صلاحيات المستخدمين
```

#### 2. البيع (3 جداول)
```typescript
db_sales_listings      // عروض البيع
db_sales_offers        // عروض الشراء
db_sales_agreements    // اتفاقيات البيع
```

#### 3. الإدارة (8 جداول)
```typescript
db_maintenance_tickets // طلبات الصيانة
db_lookups            // القوائم
db_lookup_categories  // فئات القوائم
db_settings           // الإعدادات
db_operations         // سجل العمليات
db_blacklist          // قائمة الحظر
db_alerts             // التنبيهات
db_external_commissions // العمولات الخارجية
```

#### 4. الجداول الديناميكية (3 جداول)
```typescript
db_dynamic_tables      // الجداول الديناميكية
db_dynamic_records     // السجلات الديناميكية
db_dynamic_form_fields // حقول النماذج
```

#### 5. المرفقات والملاحظات (3 جداول)
```typescript
db_attachments         // المرفقات
db_activities          // الأنشطة
db_notes              // الملاحظات
```

#### 6. القانونية (2 جداول)
```typescript
db_legal_templates     // القوالب القانونية
db_legal_history       // السجل القانوني
```

#### 7. لوحة التحكم (5 جداول)
```typescript
db_dashboard_config    // إعدادات لوحة التحكم
db_clearance_records   // سجلات المخالصة
db_dashboard_notes     // ملاحظات لوحة التحكم
db_reminders          // التذكيرات
db_client_interactions // تفاعلات العملاء
db_followups          // المتابعات
```

---

## 🔧 الخدمات الأساسية

### 1. DbService (`mockDb.ts`)
**الوظيفة:** خدمة قاعدة البيانات الرئيسية

**الدوال الأساسية:**
```typescript
// CRUD Operations
getAllPeople(): الأشخاص_tbl[]
addPerson(person: الأشخاص_tbl): void
updatePerson(id: string, updates: Partial<الأشخاص_tbl>): void
deletePerson(id: string): void

// Properties
getAllProperties(): العقارات_tbl[]
addProperty(property: العقارات_tbl): void
updateProperty(id: string, updates: Partial<العقارات_tbl>): void
deleteProperty(id: string): void

// Contracts
getAllContracts(): العقود_tbl[]
addContract(contract: العقود_tbl): void
updateContract(id: string, updates: Partial<العقود_tbl>): void
deleteContract(id: string): void

// Installments & Payments
getAllInstallments(): الكمبيالات_tbl[]
getAllPayments(): الدفعات_tbl[]
recordPayment(payment: الدفعات_tbl): void

// System
resetAllData(): void
```

---

### 2. Reset Database Service (`resetDatabase.ts`) ⭐ جديد

**الوظيفة:** خدمة حذف البيانات وإعادة التهيئة

**الدوال:**

#### `clearAllData()`
```typescript
/**
 * حذف جميع البيانات نهائياً من localStorage
 * @returns {success: boolean, message: string, deletedKeys: string[]}
 */
function clearAllData(): {
  success: boolean;
  message: string;
  deletedKeys: string[];
}
```

**الاستخدام:**
```typescript
import { clearAllData } from '@/services/resetDatabase';

const result = clearAllData();
if (result.success) {
  console.log('تم حذف', result.deletedKeys.length, 'جدول');
  window.location.reload();
}
```

**ما يتم حذفه:**
- ✅ جميع الجداول (33+ جدول)
- ✅ البيانات التجريبية
- ✅ الإعدادات
- ✅ السجلات

---

#### `resetToFreshState()`
```typescript
/**
 * إعادة تهيئة النظام مع الاحتفاظ بـ admin + lookups
 * @returns {success: boolean, message: string}
 */
function resetToFreshState(): {
  success: boolean;
  message: string;
}
```

**الاستخدام:**
```typescript
import { resetToFreshState } from '@/services/resetDatabase';

const result = resetToFreshState();
if (result.success) {
  console.log('تم إعادة تهيئة النظام بنجاح');
  window.location.reload();
}
```

**ما يتم الاحتفاظ به:**
- ✅ مستخدم admin (اسم المستخدم: admin، كلمة المرور: 123456)
- ✅ القوائم الأساسية (11 lookup)
  - أدوار الأشخاص: مالك، مستأجر، كفيل، وسيط
  - أنواع العقارات: شقة، محل تجاري، فيلا، أرض
  - حالات العقارات: شاغر، مؤجر، صيانة

---

#### `getDatabaseStats()`
```typescript
/**
 * الحصول على إحصائيات البيانات الحالية
 * @returns Record<string, number>
 */
function getDatabaseStats(): Record<string, number>
```

**الاستخدام:**
```typescript
import { getDatabaseStats } from '@/services/resetDatabase';

const stats = getDatabaseStats();
console.table(stats);

// Output:
// {
//   "الأشخاص": 15,
//   "العقارات": 10,
//   "العقود": 8,
//   "الكمبيالات": 24,
//   ...
// }
```

---

### 3. Data Validation Service (`dataValidation.ts`)

**الوظيفة:** التحقق من صحة البيانات

**الدوال:**
```typescript
validateAllData(): ValidationResult
validatePerson(person: الأشخاص_tbl): ValidationError[]
validateProperty(property: العقارات_tbl): ValidationError[]
validateContract(contract: العقود_tbl): ValidationError[]
```

---

## 🗑️ نظام حذف البيانات

### نظرة عامة
نظام شامل لحذف جميع البيانات وإعادة النظام لحالته الأولية.

### المكونات

#### 1. الخدمة (`resetDatabase.ts`)
- ✅ 3 دوال رئيسية
- ✅ دعم 33+ جدول
- ✅ إحصائيات فورية
- ✅ معالجة الأخطاء

#### 2. الواجهة (`DatabaseReset.tsx`)
- ✅ عرض الإحصائيات
- ✅ خياران للحذف
- ✅ تأكيد مزدوج
- ✅ إعادة تحميل تلقائية

#### 3. المسار
```
http://localhost:5173/#/reset-database
```

### طرق الاستخدام

#### الطريقة 1: عبر الواجهة (موصى بها)
1. افتح `/#/reset-database`
2. اختر العملية (إعادة تهيئة أو حذف كامل)
3. اكتب كلمة التأكيد
4. اضغط تأكيد

#### الطريقة 2: عبر Console
```javascript
import { resetToFreshState } from './src/services/resetDatabase';
resetToFreshState();
```

#### الطريقة 3: يدوياً
افتح Developer Tools → Application → Local Storage → احذف المفاتيح

### الأمان
- ⚠️ حذف نهائي - لا يمكن الاسترجاع
- ✅ تأكيد مزدوج مطلوب
- ✅ كلمة تأكيد يجب كتابتها
- ✅ رسائل تحذير واضحة

---

## 🔒 الأمان والصلاحيات

### نظام RBAC

#### الأدوار
```typescript
type UserRole = 'SuperAdmin' | 'Admin' | 'Employee' | 'Accountant';
```

#### الصلاحيات
```typescript
type Permission =
  | 'VIEW_PEOPLE'
  | 'ADD_PERSON'
  | 'EDIT_PERSON'
  | 'DELETE_PERSON'
  | 'VIEW_PROPERTIES'
  | 'ADD_PROPERTY'
  | 'EDIT_PROPERTY'
  | 'DELETE_PROPERTY'
  | 'VIEW_CONTRACTS'
  | 'ADD_CONTRACT'
  | 'EDIT_CONTRACT'
  | 'DELETE_CONTRACT'
  | 'VIEW_PAYMENTS'
  | 'RECORD_PAYMENT'
  | 'REVERSE_PAYMENT'
  | 'VIEW_REPORTS'
  | 'EXPORT_DATA'
  | 'MANAGE_USERS'
  | 'MANAGE_SETTINGS'
  | 'RESET_DATABASE';  // ⭐ جديد
```

#### حماية المكونات
```typescript
import { RBACGuard } from '@/components/shared/RBACGuard';

<RBACGuard requiredPermission="ADD_PERSON">
  <Button onClick={handleAdd}>إضافة شخص</Button>
</RBACGuard>
```

---

## 🎨 واجهة المستخدم

### Design System
```typescript
// Colors
primary: 'blue-600'
secondary: 'slate-600'
success: 'green-600'
danger: 'red-600'
warning: 'yellow-600'

// Spacing
xs: '0.25rem'
sm: '0.5rem'
md: '1rem'
lg: '1.5rem'
xl: '2rem'
```

### المكونات الأساسية
- ✅ Button
- ✅ Input
- ✅ Card
- ✅ Modal
- ✅ Toast
- ✅ Table
- ✅ StatusBadge

### الصفحات
```
/                    → Dashboard
/people              → إدارة الأشخاص
/properties          → إدارة العقارات
/contracts           → إدارة العقود
/installments        → إدارة الكمبيالات
/payments            → إدارة الدفعات
/reports             → التقارير
/settings            → الإعدادات
/reset-database      → حذف البيانات ⭐ جديد
```

---

## 🧪 الاختبارات

### Build Test
```bash
npm run build
```
**النتيجة:** ✅ نجح (8.32s)

### Development Server
```bash
npm run dev
```
**النتيجة:** ✅ يعمل على http://localhost:5173

---

## 🚀 النشر

### المتطلبات
- Node.js 18+
- npm أو yarn

### التثبيت
```bash
# تحميل المشروع
git clone [repository-url]
cd azrar-real-estate

# تثبيت التبعيات
npm install

# تشغيل النظام
npm run dev
```

### البناء للإنتاج
```bash
npm run build
```

### النشر
```bash
# نشر المجلد dist على الخادم
```

---

## 📊 الإحصائيات

### حجم الملفات (بعد البناء)
```
dist/assets/index.js        415.87 kB │ gzip: 113.39 kB
dist/assets/charts.js       392.47 kB │ gzip: 115.13 kB
dist/assets/Dashboard.js     58.67 kB │ gzip:  11.84 kB
dist/assets/DatabaseReset.js  8.84 kB │ gzip:   2.70 kB ⭐
```

### الأداء
- ⚡ وقت التحميل الأولي: ~2s
- ⚡ وقت إعادة التحميل: ~0.5s
- ⚡ حجم localStorage: ~200-250KB (مع البيانات)
- ⚡ حجم localStorage: ~15-20KB (بعد إعادة التهيئة)

---

## 📝 الترخيص

© 2025 — Developed by **Mahmoud Qattoush**
AZRAR Real Estate Management System — All Rights Reserved

---

## 🎉 الخلاصة

✅ **نظام شامل ومتكامل**
✅ **33+ جدول بيانات**
✅ **نظام حذف وإعادة تهيئة متقدم**
✅ **واجهة مستخدم حديثة**
✅ **أمان وصلاحيات متقدمة**
✅ **توثيق شامل**
✅ **جاهز للإنتاج**

---

## 🛠️ تحديثات الصيانة الأخيرة (سطح المكتب + المزامنة + الترويسة)

هذا القسم يكمّل التوثيق السابق (الذي يركّز على نسخة المتصفح/الويب)، ويغطي آخر صيانة تم تطبيقها على **نسخة سطح المكتب (Electron)** وما ارتبط بها من تحسينات في الطباعة والتصدير.

### 1) سجل المزامنة: تسجيل التعديل والحذف
- تم تحسين سجل المزامنة ليعرض عمليات **التعديل (Upsert)** و**الحذف (Delete)** بشكل صريح أثناء تدفقات الاتصال/السحب، وليس فقط أثناء حلقات الخلفية.
- تمت إضافة **سطر ملخّص** في نهاية كل عملية “مزامنة الآن” يوضّح عدد العناصر التي تم سحبها/دفعها (Upserts/Deletes) وأي أخطاء إن وجدت.

**الملفات ذات العلاقة (للمطورين):**
- `electron/ipc.ts` (منطق المزامنة + بث أحداث سجل المزامنة + الملخّص)
- `src/components/panels/SqlSyncLogPanel.tsx` (عرض السجل وتسمية الأحداث)

### 2) زر “مزامنة الآن” في لوحة المعلومات + مزامنة تلقائية
- تمت إضافة زر **"مزامنة الآن"** في صفحة لوحة المعلومات لتشغيل المزامنة يدويًا عند الحاجة.
- تمت إضافة مزامنة تلقائية (Push delta) تعمل كل **5 دقائق** مع حارس يمنع تشغيل أكثر من مزامنة في نفس الوقت.

**الملفات ذات العلاقة:**
- `src/pages/Dashboard.tsx` (زر المزامنة)
- `electron/ipc.ts` (المؤقت/الحارس/تنفيذ المزامنة)
- `electron/db.ts` (استعلامات “تغير منذ وقت” لدعم دفع الدلتا)

### 3) الترويسة (الطباعة/التصدير)
- تمت إضافة خيار **تفعيل/تعطيل الترويسة** ضمن إعدادات النظام.
- تمت إضافة حقل **"هوية الشركة"** (نص متعدد الأسطر) لاستخدامه داخل الترويسة.
- عند التصدير إلى Excel، يتم إرفاق ورقة إضافية باسم **"الترويسة"** داخل ملف `.xlsx`.

**ملاحظات توافق:**
- الاستيراد المعتاد يعتمد على **الورقة الأولى**؛ إضافة ورقة “الترويسة” لا تكسر الاستيراد طالما أنه يقرأ الورقة الأساسية.

**الملفات ذات العلاقة:**
- `src/pages/Settings.tsx` (إعدادات الترويسة)
- `src/components/print/PrintLetterhead.tsx` (تطبيق الترويسة في الطباعة)
- `src/utils/xlsx.ts` (دعم إضافة أوراق إضافية عند التصدير)
- `src/utils/companySheet.ts` (بناء ورقة “الترويسة”)

### 4) ملاحظة حول النسخ (Web vs Desktop)
- قد يحتوي هذا المستودع على مكوّنات لكل من وضع الويب ووضع سطح المكتب.
- قسم “قاعدة البيانات” أعلاه يصف نموذج التخزين المحلي التاريخي (localStorage). أما في وضع سطح المكتب، توجد طبقة تخزين/مزامنة إضافية عبر Electron.

---

**آخر تحديث:** 05 يناير 2026
**الحالة:** ✅ PRODUCTION-READY

