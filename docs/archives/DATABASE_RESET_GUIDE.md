# 🗑️ دليل حذف البيانات وإعادة تهيئة النظام

**التاريخ:** 27 ديسمبر 2025  
**الحالة:** ✅ **جاهز للاستخدام**

---

## 📋 نظرة عامة

تم إنشاء نظام شامل لحذف جميع البيانات وإعادة النظام لحالته الأولية، جاهز للاستخدام من جديد.

---

## 🎯 الميزات

### 1️⃣ حذف جميع البيانات
- ✅ حذف نهائي لجميع البيانات من localStorage
- ✅ حذف 23+ جدول بيانات
- ✅ لا يمكن استرجاع البيانات بعد الحذف

### 2️⃣ إعادة تهيئة النظام
- ✅ حذف جميع البيانات
- ✅ الاحتفاظ بمستخدم admin
- ✅ الاحتفاظ بالقوائم الأساسية (Lookups)
- ✅ النظام جاهز للاستخدام فوراً

### 3️⃣ عرض الإحصائيات
- ✅ عرض عدد السجلات في كل جدول
- ✅ إجمالي السجلات في النظام
- ✅ تحديث فوري للإحصائيات

---

## 🚀 طريقة الاستخدام

### الطريقة الأولى: عبر الواجهة (موصى بها)

1. **افتح الصفحة:**
   ```
   http://localhost:5173/#/reset-database
   ```

2. **اختر العملية المطلوبة:**
   - **إعادة تهيئة النظام** (موصى بها): حذف البيانات + الاحتفاظ بـ admin + Lookups
   - **حذف جميع البيانات**: حذف نهائي لكل شيء

3. **أدخل كلمة التأكيد:**
   - لإعادة التهيئة: اكتب `إعادة تهيئة`
   - للحذف النهائي: اكتب `حذف نهائي`

4. **اضغط تأكيد**
   - سيتم تنفيذ العملية فوراً
   - سيتم إعادة تحميل الصفحة تلقائياً

---

### الطريقة الثانية: عبر Console

افتح Developer Tools (F12) واكتب:

```javascript
// استيراد الخدمة
import { resetToFreshState, clearAllData, getDatabaseStats } from './src/services/resetDatabase';

// 1️⃣ عرض الإحصائيات
const stats = getDatabaseStats();
console.table(stats);

// 2️⃣ إعادة تهيئة النظام (موصى بها)
const result = resetToFreshState();
console.log(result);

// 3️⃣ حذف جميع البيانات (خطير!)
const clearResult = clearAllData();
console.log(clearResult);
```

---

### الطريقة الثالثة: يدوياً عبر localStorage

افتح Developer Tools (F12) → Application → Local Storage → localhost:5173

**احذف المفاتيح التالية:**

```
db_people
db_properties
db_contracts
db_installments
db_payments
db_roles
db_commissions
db_users
db_user_permissions
db_alerts
db_sales_listings
db_sales_offers
db_sales_agreements
db_maintenance_tickets
db_lookups
db_lookup_categories
db_settings
db_operations
db_blacklist
db_dynamic_tables
db_dynamic_records
db_dynamic_form_fields
db_attachments
db_activities
db_notes
db_legal_templates
db_legal_history
db_external_commissions
db_dashboard_config
db_clearance_records
db_dashboard_notes
db_reminders
db_client_interactions
db_followups
demo_data_loaded
db_initialized
```

---

## 📊 البيانات التي سيتم حذفها

### الجداول الأساسية (9 جداول)
- ✅ `db_people` - الأشخاص
- ✅ `db_properties` - العقارات
- ✅ `db_contracts` - العقود
- ✅ `db_installments` - الكمبيالات
- ✅ `db_payments` - الدفعات
- ✅ `db_roles` - أدوار الأشخاص
- ✅ `db_commissions` - العمولات
- ✅ `db_users` - المستخدمين
- ✅ `db_user_permissions` - صلاحيات المستخدمين

### البيع (3 جداول)
- ✅ `db_sales_listings` - عروض البيع
- ✅ `db_sales_offers` - عروض الشراء
- ✅ `db_sales_agreements` - اتفاقيات البيع

### الإدارة (8 جداول)
- ✅ `db_maintenance_tickets` - طلبات الصيانة
- ✅ `db_lookups` - القوائم
- ✅ `db_lookup_categories` - فئات القوائم
- ✅ `db_settings` - الإعدادات
- ✅ `db_operations` - سجل العمليات
- ✅ `db_blacklist` - قائمة الحظر
- ✅ `db_alerts` - التنبيهات
- ✅ `db_external_commissions` - العمولات الخارجية

### الجداول الديناميكية (3 جداول)
- ✅ `db_dynamic_tables` - الجداول الديناميكية
- ✅ `db_dynamic_records` - السجلات الديناميكية
- ✅ `db_dynamic_form_fields` - حقول النماذج

### المرفقات والملاحظات (3 جداول)
- ✅ `db_attachments` - المرفقات
- ✅ `db_activities` - الأنشطة
- ✅ `db_notes` - الملاحظات

### القانونية (2 جداول)
- ✅ `db_legal_templates` - القوالب القانونية
- ✅ `db_legal_history` - السجل القانوني

### لوحة التحكم (5 جداول)
- ✅ `db_dashboard_config` - إعدادات لوحة التحكم
- ✅ `db_clearance_records` - سجلات المخالصة
- ✅ `db_dashboard_notes` - ملاحظات لوحة التحكم
- ✅ `db_reminders` - التذكيرات
- ✅ `db_client_interactions` - تفاعلات العملاء
- ✅ `db_followups` - المتابعات

---

## ✅ البيانات التي سيتم الاحتفاظ بها (إعادة التهيئة فقط)

### 1️⃣ مستخدم Admin
```json
{
  "id": "1",
  "اسم_المستخدم": "admin",
  "كلمة_المرور": "123456",
  "الدور": "SuperAdmin",
  "isActive": true
}
```

### 2️⃣ القوائم الأساسية (11 lookup)
- مالك، مستأجر، كفيل، وسيط (أدوار الأشخاص)
- شقة، محل تجاري، فيلا، أرض (أنواع العقارات)
- شاغر، مؤجر، صيانة (حالات العقارات)

---

## ⚠️ تحذيرات مهمة

### 🔴 حذف نهائي - لا يمكن الاسترجاع
- ❌ لا يوجد نسخ احتياطي تلقائي
- ❌ لا يمكن التراجع عن العملية
- ❌ جميع البيانات ستُفقد نهائياً

### 🟡 قبل الحذف
- ✅ تأكد من عمل نسخة احتياطية إذا لزم الأمر
- ✅ تأكد من أنك تريد حذف جميع البيانات
- ✅ أغلق جميع النوافذ الأخرى للنظام

### 🟢 بعد الحذف
- ✅ سيتم إعادة تحميل الصفحة تلقائياً
- ✅ ستحتاج لتسجيل الدخول مرة أخرى (admin / 123456)
- ✅ النظام جاهز للاستخدام من جديد

---

## 🎉 النتيجة النهائية

✅ **نظام شامل لحذف البيانات**  
✅ **واجهة مستخدم سهلة وآمنة**  
✅ **تأكيد مزدوج قبل الحذف**  
✅ **إحصائيات فورية**  
✅ **إعادة تهيئة ذكية**

---

**© 2025 — AZRAR Real Estate Management System**

