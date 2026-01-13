# 🚀 دليل الاستخدام السريع - مسح البيانات التجريبية

## ⚡ 3 طرق سريعة

### 1️⃣ **من واجهة الإدارة (الأسهل)**

```
1. اذهب إلى الصفحة الرئيسية → قائمة الإدارة
2. اختر: الإدارة → لوحة التحكم المركزية
3. انقر على tab: "إدارة النظام" (⚙️)
4. اضغط الزر الأحمر: "مسح كل البيانات التجريبية"
5. أكّد عند الطلب
6. ✅ تمت إعادة التحميل تلقائياً - النظام نظيف!
```

**الوقت:** ~30 ثانية | **الأمان:** ⭐⭐⭐⭐⭐

---

### 2️⃣ **من Developer Console (للمطورين)**

```javascript
// فتح DevTools: F12 أو Ctrl+Shift+I
// انسخ والصق هذا في Console:

resetAllData()

// أو:
globalThis.resetAllData()
```

**النتيجة:**
```
✅ تم مسح كامل البيانات التجريبية
📊 البيانات المحفوظة: Users, Roles, Permissions, Lookups, Templates
🗑️  البيانات المحذوفة: 18 جداول
```

**الوقت:** ~5 ثوان | **الأمان:** ⭐⭐⭐

---

### 3️⃣ **برمجياً من الكود**

```typescript
// في أي مكون React
import { DbService } from '@/services/mockDb';

function MyComponent() {
  const handleReset = () => {
    const result = DbService.resetAllData();
    
    if (result.success) {
      console.log('✅', result.message);
      console.log('جداول محذوفة:', result.deletedTables);
      // إعادة تحميل البيانات من الخادم
      // أو إعادة توجيه المستخدم
    }
  };

  return <button onClick={handleReset}>مسح البيانات</button>;
}
```

**الوقت:** ~2 ثوان | **الأمان:** ⭐⭐

---

## ✅ التحقق من النجاح

بعد المسح، في Console اكتب:

```javascript
// يجب أن تكون النتائج 0:
DbService.getPeople().length           // 0 ✅
DbService.getProperties().length       // 0 ✅
DbService.getContracts().length        // 0 ✅
DbService.getInstallments().length     // 0 ✅

// يجب أن تكون محمية:
DbService.getSystemUsers().length      // 1+ ✅
DbService.getPermissionDefinitions()   // [... data] ✅
```

---

## 🎯 حالات الاستخدام

| الحالة | الطريقة | السرعة | الأمان |
|------|--------|------|------|
| تسليم للعميل (Demo) | Admin Panel | 30s | ⭐⭐⭐⭐⭐ |
| اختبار من الصفر | Console | 5s | ⭐⭐⭐ |
| أتمتة (Automation) | Code | 2s | ⭐⭐ |

---

## ⚠️ تحذيرات

- ❌ **لا يوجد Undo** - احفظ البيانات قبل المسح
- ❌ **حذف نهائي** - لا استرجاع بعد المسح
- ✅ **المستخدمين آمنين** - لا يتم حذفهم

---

## 📝 مثال عملي كامل

### قبل المسح:
```
👥 20 شخص
🏢 15 عقار
📋 10 عقود
💳 30 دفعة
```

### المسح:
```javascript
resetAllData()
```

### بعد المسح:
```
👥 0 شخص ✅
🏢 0 عقار ✅
📋 0 عقود ✅
💳 0 دفعة ✅
👤 1+ مستخدم (محمي) ✅
```

---

**جاهز الآن!** 🎉
