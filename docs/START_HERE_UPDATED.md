# 🚀 ابدأ من هنا - AZRAR Real Estate System

**آخر تحديث:** 15 يناير 2026  
**الحالة:** ✅ جاهز للاستخدام الفوري

---

## ⚡ البدء السريع (30 ثانية)

### 1. تشغيل النظام
```bash
npm run dev
```

### 2. افتح المتصفح
```
http://localhost:5173/#/login
```

### 3. تسجيل الدخول
- إذا كانت هذه أول مرة ولا يوجد مستخدمون، ستظهر بطاقة **"إعداد أول مرة"** في صفحة الدخول لإنشاء حساب **SuperAdmin**.
- إذا كان لديك مستخدمون بالفعل، سجّل الدخول بحساب مخوّل.

---

## 🎯 ما الجديد؟ (27 ديسمبر 2025)

### ⭐ نظام حذف البيانات وإعادة التهيئة الشامل

**الوصول:**
```
http://localhost:5173/#/reset-database
```

**الميزات:**
- ✅ حذف جميع البيانات (33+ جدول)
- ✅ إعادة تهيئة ذكية (admin + lookups)
- ✅ إحصائيات فورية
- ✅ واجهة سهلة وآمنة
- ✅ تأكيد مزدوج

**الملفات الجديدة:**
- `src/services/resetDatabase.ts` - خدمة الحذف
- `src/pages/DatabaseReset.tsx` - واجهة المستخدم
- `DATABASE_RESET_GUIDE.md` - دليل شامل

---

## 📚 التوثيق الأساسي

### للمستخدمين
- 📖 [README.md](./README.md) - نظرة عامة
- 🚀 [GETTING_STARTED.md](./GETTING_STARTED.md) - دليل البدء
- 📋 [ابدأ_الآن.md](./ابدأ_الآن.md) - دليل عربي

### للمطورين
- 📘 [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md) ⭐ **جديد!**
- 📊 [DATABASE_STRUCTURE.md](./DATABASE_STRUCTURE.md)
- 🔧 [DBSERVICE_IMPROVEMENTS.md](./DBSERVICE_IMPROVEMENTS.md)

### حذف البيانات
- 🗑️ [DATABASE_RESET_GUIDE.md](./DATABASE_RESET_GUIDE.md) ⭐ **جديد!**
- 🔄 [RESET_DATA_GUIDE.md](./RESET_DATA_GUIDE.md)
- ⚡ [QUICK_RESET_GUIDE.md](./QUICK_RESET_GUIDE.md)

### التقارير والملخصات
- 📊 [FINAL_REPORT.md](./FINAL_REPORT.md)
- ✅ [COMPREHENSIVE_GUIDE.md](./COMPREHENSIVE_GUIDE.md)
- 📋 [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) ⭐ **محدّث!**

---

## 🎨 الميزات الرئيسية

### 1. إدارة الأشخاص
- ✅ ملاك، مستأجرين، كفلاء، وسطاء
- ✅ أدوار متعددة للشخص الواحد
- ✅ التحقق من البيانات

### 2. إدارة العقارات
- ✅ شقق، محلات، فلل، أراضي
- ✅ تتبع الحالة (شاغر، مؤجر، صيانة)
- ✅ معلومات تفصيلية

### 3. إدارة العقود
- ✅ إنشاء وتجديد وإنهاء
- ✅ حساب تلقائي للأقساط
- ✅ دعم أنواع دفع متعددة

### 4. الكمبيالات والدفعات
- ✅ تتبع دقيق
- ✅ دفعات جزئية
- ✅ تنبيهات للمتأخرات

### 5. التقارير
- ✅ تقارير مالية
- ✅ رسوم بيانية
- ✅ تصدير PDF/Excel

### 6. حذف البيانات ⭐ جديد
- ✅ حذف شامل
- ✅ إعادة تهيئة ذكية
- ✅ إحصائيات فورية

---

## 🔧 الأوامر المهمة

### التطوير
```bash
npm run dev          # تشغيل النظام
npm run build        # بناء للإنتاج
npm run preview      # معاينة البناء
```

### الاختبار
```bash
npm run build        # اختبار البناء
```

---

## 📁 الهيكلية

```
src/
├── components/          # المكونات
├── pages/              # الصفحات
│   ├── Dashboard.tsx
│   ├── People.tsx
│   ├── Properties.tsx
│   ├── DatabaseReset.tsx  ⭐ جديد
│   └── ...
├── services/           # الخدمات
│   ├── mockDb.ts
│   ├── resetDatabase.ts   ⭐ جديد
│   └── ...
├── context/            # Contexts
├── types/              # TypeScript Types
└── utils/              # دوال مساعدة
```

---

## 🗺️ المسارات

```
/#/                  → لوحة التحكم
/#/people             → الأشخاص
/#/properties         → العقارات
/#/contracts          → العقود
/#/installments       → الكمبيالات
/#/reports            → التقارير
/#/settings           → الإعدادات
/#/operations         → العمليات والإجراءات
/#/sys-maintenance    → صيانة النظام (اختبارات/تشخيص)
/#/reset-database     → حذف البيانات ⭐ جديد
```

---

## 🆘 المساعدة السريعة

### كيف أحذف جميع البيانات؟
1. افتح `/#/reset-database`
2. اختر "حذف جميع البيانات"
3. اكتب "حذف نهائي"
4. اضغط تأكيد

### كيف أعيد تهيئة النظام؟
1. افتح `/#/reset-database`
2. اختر "إعادة تهيئة النظام"
3. اكتب "إعادة تهيئة"
4. اضغط تأكيد

### ماذا يحدث بعد إعادة التهيئة؟
- ✅ حذف جميع البيانات
- ✅ الاحتفاظ بمستخدم admin
- ✅ الاحتفاظ بالقوائم الأساسية
- ✅ النظام جاهز للاستخدام

---

## 📞 الدعم

### التوثيق
- 📚 [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) - فهرس شامل
- 📘 [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md) - توثيق تقني

### الأسئلة الشائعة
راجع ملفات التوثيق أعلاه

---

## ✅ قائمة التحقق

- [ ] قرأت README.md
- [ ] شغّلت النظام (`npm run dev`)
- [ ] سجّلت الدخول (admin / 123456)
- [ ] استكشفت الصفحات الرئيسية
- [ ] جرّبت نظام حذف البيانات
- [ ] راجعت التوثيق التقني

---

## 🎉 جاهز للبدء!

النظام جاهز للاستخدام الفوري. ابدأ بتشغيل `npm run dev` واستمتع!

---

**© 2025 — Developed by Mahmoud Qattoush**  
**AZRAR Real Estate Management System — All Rights Reserved**

