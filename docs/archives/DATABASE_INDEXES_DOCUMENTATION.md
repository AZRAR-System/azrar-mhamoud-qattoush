# 🔍 توثيق الفهارس (Database Indexes Documentation)

**التاريخ:** 27 ديسمبر 2025  
**الملف المرجعي:** `src/services/databaseIndexes.ts`

---

## 📋 نظرة عامة

هذا المستند يوثق جميع الفهارس (Indexes) والقيود الفريدة (Unique Constraints) في قاعدة البيانات.

---

## 1️⃣ جدول الأشخاص (tbl_الأشخاص)

### Primary Key:
- `رقم_الشخص`

### Unique Indexes:
- `الرقم_الوطني` (Unique)

### Search Indexes:
- `الاسم` (للبحث السريع)
- `رقم_الهاتف` (للبحث السريع)

### الدوال المتاحة:
```typescript
checkPersonUniqueConstraints(رقم_الوطني, excludeId?)
```

---

## 2️⃣ جدول شخص_دور (tbl_شخص_دور)

### Unique Composite Index:
- `(رقم_الشخص, رقم_الدور)` - لمنع تكرار نفس الدور لنفس الشخص

### Indexes:
- `رقم_الشخص` (للبحث حسب الشخص)
- `رقم_الدور` (للبحث حسب الدور)

### الدوال المتاحة:
```typescript
checkPersonRoleUniqueConstraint(رقم_الشخص, رقم_الدور, excludeId?)
```

---

## 3️⃣ جدول المستخدمين (tbl_المستخدمين)

### Unique Indexes:
- `رقم_الشخص` (كل شخص له حساب واحد فقط)
- `اسم_الدخول` (اسم المستخدم فريد)

### الدوال المتاحة:
```typescript
checkUserUniqueConstraints(رقم_الشخص, اسم_الدخول, excludeId?)
```

---

## 4️⃣ جدول العقارات (tbl_العقارات)

### Primary Key:
- `رقم_العقار`

### Unique Indexes:
- `الكود_الداخلي` (فريد دائماً)

### Search Indexes:
- `رقم_القطعة`
- `رقم_اللوحة`
- `رقم_الشقة`
- `نوع_العقار`
- `رقم_المالك`

### ⚠️ القيود الفريدة المشروطة (Conditional Unique Constraints):

#### للأراضي:
```sql
Unique Index على (رقم_القطعة, رقم_اللوحة)
WHERE نوع_العقار = 'أرض'
```
**المعنى:** لا يمكن وجود أرضين بنفس رقم القطعة ورقم اللوحة

#### للشقق:
```sql
Unique Index على (رقم_القطعة, رقم_اللوحة, رقم_الشقة)
WHERE نوع_العقار = 'شقة'
```
**المعنى:** لا يمكن وجود شقتين بنفس رقم القطعة ورقم اللوحة ورقم الشقة

### الدوال المتاحة:
```typescript
checkPropertyCodeUnique(الكود_الداخلي, excludeId?)
checkLandUniqueConstraint(رقم_القطعة, رقم_اللوحة, نوع_العقار, excludeId?)
checkApartmentUniqueConstraint(رقم_القطعة, رقم_اللوحة, رقم_الشقة, نوع_العقار, excludeId?)
validatePropertyIndexes(property, excludeId?) // دالة شاملة
```

---

## 5️⃣ جدول العقود (tbl_العقود)

### Primary Key:
- `رقم_العقد`

### Indexes:
- `رقم_العقار`
- `رقم_المستأجر`
- `تاريخ_بداية_العقد`

### ⚠️ القيد الفريد المشروط:
```sql
Unique Index على (رقم_العقار, حالة_العقد)
WHERE حالة_العقد = 'ساري'
```
**المعنى:** لا يمكن وجود أكثر من عقد ساري (نشط/مجدد) لنفس العقار

### الدوال المتاحة:
```typescript
checkActiveContractUniqueConstraint(رقم_العقار, حالة_العقد, excludeId?)
validateContractIndexes(contract, excludeId?) // دالة شاملة
```

---

## 6️⃣ جدول الكمبيالات (tbl_الكمبيالات)

### Primary Key:
- `رقم_الكمبيالة`

### Indexes:
- `رقم_العقد` (للبحث حسب العقد)
- `تاريخ_الاستحقاق` (للبحث حسب التاريخ)
- `حالة_الكمبيالة` (للبحث حسب الحالة)

---

## 7️⃣ جدول الدفعات (tbl_الدفعات)

### Primary Key:
- `رقم_الدفعة`

### Indexes:
- `رقم_الكمبيالة` (للبحث حسب الكمبيالة)
- `تاريخ_الدفع` (للبحث حسب التاريخ)

---

## 8️⃣ جدول البيع (tbl_البيع)

### Unique Index:
- `رقم_العقار` (كل عقار له عرض بيع واحد فقط)

### Indexes:
- `رقم_المشتري`
- `تاريخ_البيع`

### الدوال المتاحة:
```typescript
checkSalePropertyUnique(رقم_العقار, excludeId?)
```

---

## 9️⃣ جدول العمولات - إيجار (tbl_العمولات)

### Indexes:
- `رقم_العقد`
- `رقم_الشخص_المستحق`
- `نوع_العمولة`

---

## 🔟 جدول عمولات البيع (tbl_عمولات_البيع)

### Indexes:
- `رقم_البيع`
- `رقم_الشخص_المستحق`

---

## 1️⃣1️⃣ جدول الحظر (tbl_blacklist)

### Indexes:
- `رقم_الشخص`
- `حالة_الحظر`

---

## 🎯 أمثلة الاستخدام

### مثال 1: التحقق من عقار قبل الإضافة
```typescript
import { validatePropertyIndexes } from './services/databaseIndexes';

const newProperty = {
  الكود_الداخلي: 'PROP-001',
  النوع: 'أرض',
  رقم_قطعة: '123',
  رقم_لوحة: '456'
};

const validation = validatePropertyIndexes(newProperty);
if (!validation.isValid) {
  console.error('أخطاء:', validation.errors);
}
```

### مثال 2: التحقق من عقد قبل الإضافة
```typescript
import { validateContractIndexes } from './services/databaseIndexes';

const newContract = {
  رقم_العقار: 'PROP-001',
  حالة_العقد: 'نشط'
};

const validation = validateContractIndexes(newContract);
if (!validation.isValid) {
  console.error('أخطاء:', validation.errors);
}
```

---

## ✅ التحقق من الصحة

### ✅ منع التكرار حسب نوع العقار:
- ✅ الأراضي: لا يمكن تكرار (رقم_القطعة + رقم_اللوحة)
- ✅ الشقق: لا يمكن تكرار (رقم_القطعة + رقم_اللوحة + رقم_الشقة)

### ✅ لا يوجد أكثر من عقد ساري لنفس العقار:
- ✅ يتم التحقق عند إنشاء عقد جديد
- ✅ يتم التحقق عند تجديد عقد

### ✅ الكود الداخلي فريد دائماً:
- ✅ يتم التحقق عند إضافة عقار
- ✅ يتم التحقق عند تعديل عقار

### ✅ جميع العلاقات تعمل بدون تضارب:
- ✅ الأشخاص ← العقارات (رقم_المالك)
- ✅ الأشخاص ← العقود (رقم_المستأجر فقط)
- ✅ العقارات ← العقود (رقم_العقار)

---

**© 2025 — AZRAR Real Estate Management System**

