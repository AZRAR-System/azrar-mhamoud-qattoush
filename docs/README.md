# 📚 فهرس التوثيق - AZRAR Real Estate Management System

**آخر تحديث**: 2026-01-01  
**الإصدار**: 3.0

---

## 🎯 نظرة عامة

هذا المجلد يحتوي على جميع التوثيقات الخاصة بنظام إدارة العقارات AZRAR.

**الحالة الحالية**:
- ✅ **30 ملف** توثيق نشط (في `docs/`)
- ✅ **67 ملف** أرشيف (في `docs/archives/`)

---

## 📖 الملفات الأساسية (ابدأ هنا)

### 1️⃣ **للمستخدمين الجدد**
- 📄 `GETTING_STARTED.md` - دليل البدء السريع
- 📄 `COMPREHENSIVE_GUIDE.md` - الدليل الشامل للنظام
- 📄 `TECHNICAL_DOCUMENTATION.md` - الوثائق التقنية

### 2️⃣ **للمطورين**
- 📄 `DEVELOPER_REFERENCE.md` - مرجع المطور (المعمارية + البناء + أهم الدوال)
- 📄 `DATABASE_STRUCTURE.md` - هيكل قاعدة البيانات
- 📄 `INTEGRATION_TESTS.md` - دليل الاختبارات
- 📄 `SYSTEM_ANALYSIS_REPORT.md` - تحليل شامل للنظام

### 3️⃣ **للإدارة**
- 📄 `PAYMENT_SYSTEM.md` - نظام المدفوعات والكمبيالات
- 📄 `CLEANUP_RESET_GUIDE.md` - دليل مسح البيانات
- 📄 `MASTER_COMPLETION_REPORT.md` - تقرير الإنجاز الرئيسي

---

## 🗂️ التوثيقات حسب الموضوع

### 💰 **الأنظمة المالية**
- `PAYMENT_SYSTEM.md` - **دليل شامل** لنظام المدفوعات والكمبيالات والعمولات

### 🏗️ **البنية التحتية**
- `DATABASE_STRUCTURE.md` - هيكل قاعدة البيانات والعلاقات
- `DATABASE_INDEXES_DOCUMENTATION.md` - الفهارس وتحسين الأداء

### 🧪 **الاختبار والجودة**
- `INTEGRATION_TESTS.md` - **دليل شامل** للاختبارات والتكامل
- `COMPREHENSIVE_TEST_GUIDE.md` - دليل الاختبارات الشاملة

### 🗑️ **الصيانة والإدارة**
- `CLEANUP_RESET_GUIDE.md` - **دليل شامل** لمسح البيانات وإعادة التهيئة
- `SYSTEM_ANALYSIS_REPORT.md` - تحليل التكرارات والملفات
- `CLEANUP_EXECUTION_REPORT.md` - تقرير تنفيذ التنظيف

### 🔐 **الأمان والصلاحيات**
- ملفات RBAC موجودة في `archives/` (قديمة، يُفضل الرجوع للكود مباشرة)

### 📊 **التقارير والإحصائيات**
- `DASHBOARD_IMPLEMENTATION_REPORT.md` - تقرير تطبيق لوحة التحكم
- `MASTER_COMPLETION_REPORT.md` - تقرير الإنجاز الرئيسي

---

## 🗄️ الأرشيف (`docs/archives/`)

يحتوي على **67 ملف** قديم أو مكرر:
- Phase Reports (تقارير مراحل التطوير)
- Old Payment System docs (10 ملفات)
- Old Cleanup/Reset docs (19 ملف)
- Old Integration Test docs (8 ملفات)
- Database relation fixes (قديمة)
- RBAC old reports
- وغيرها...

**ملاحظة**: هذه الملفات **مُحفوظة للمرجعية** فقط، لا تُستخدم في العمل اليومي.

---

## 🚀 دليل الاستخدام السريع

### إذا كنت مستخدماً جديداً:
1. اقرأ `GETTING_STARTED.md`
2. اقرأ `COMPREHENSIVE_GUIDE.md`
3. راجع `PAYMENT_SYSTEM.md` (إذا كنت ستعمل على الدفعات)

### إذا كنت مطوراً:
1. ابدأ بـ `DEVELOPER_REFERENCE.md` (المعمارية + البناء + خريطة الدوال والملفات)
2. راجع `DATABASE_STRUCTURE.md` (فهم قاعدة البيانات)
3. راجع `INTEGRATION_TESTS.md` (كيفية كتابة الاختبارات)
4. راجع `TECHNICAL_DOCUMENTATION.md` (معمارية النظام)

### إذا كنت مديراً:
1. راجع `MASTER_COMPLETION_REPORT.md` (حالة النظام)
2. راجع `CLEANUP_RESET_GUIDE.md` (كيفية مسح البيانات التجريبية)
3. راجع `DASHBOARD_IMPLEMENTATION_REPORT.md` (مؤشرات الأداء)

---

## 📝 التحديثات الأخيرة

### 2026-01-01
- ✅ **دمج الملفات المكررة**: دُمجت 10 ملفات Payment إلى ملف واحد
- ✅ **دمج Cleanup**: دُمجت 19 ملف Cleanup إلى ملف واحد
- ✅ **دمج Integration Tests**: دُمجت 8 ملفات إلى ملف واحد
- ✅ **تنظيم الأرشيف**: 67 ملف قديم نُقلت إلى `archives/`
- ✅ **تحسين الفهرسة**: إنشاء `README.md` (هذا الملف)

### 2026-01-05
- ✅ **صيانة المزامنة (سطح المكتب)**: سجل المزامنة يسجل التعديل/الحذف بشكل أوضح
- ✅ **ملخص المزامنة**: إضافة سطر ملخّص بعد “مزامنة الآن” (Pull/Push + أخطاء إن وجدت)
- ✅ **لوحة المعلومات**: إضافة زر “مزامنة الآن”
- ✅ **مزامنة تلقائية**: تشغيل المزامنة الدورية كل 5 دقائق مع منع التزامن المتكرر
- ✅ **الترويسة**: إضافة خيار الترويسة في الإعدادات وتطبيقها على الطباعة + إضافة ورقة “الترويسة” في تصدير Excel

---

## 🔍 البحث في التوثيق

### البحث عن موضوع معين:

**في Windows**:
```powershell
Get-ChildItem *.md -Recurse | Select-String "keyword"
```

**في Linux/Mac**:
```bash
grep -r "keyword" *.md
```

**في VS Code**:
- `Ctrl + Shift + F` → ابحث في كل المجلد

---

## 📞 الدعم والمساعدة

### للأسئلة الشائعة:
- راجع `COMPREHENSIVE_GUIDE.md`
- راجع الملف المتعلق بالموضوع (حسب الجدول أعلاه)

### للمشاكل التقنية:
- راجع `INTEGRATION_TESTS.md` (للاختبار)
- راجع `DATABASE_STRUCTURE.md` (لمشاكل البيانات)
- راجع `CLEANUP_RESET_GUIDE.md` (لإعادة تهيئة النظام)

### للتطوير:
- راجع `TECHNICAL_DOCUMENTATION.md`
- راجع ملفات الكود مباشرة في `src/`

---

## 🎯 الخلاصة

هذا المجلد يحتوي على **كل ما تحتاجه** لفهم، استخدام، وتطوير نظام AZRAR.

**نصيحة**: ابدأ بالملفات الأساسية في قسم "للمستخدمين الجدد" ثم انتقل للملفات المتخصصة حسب حاجتك.

---

**© 2025 - Developed by Mahmoud Qattoush**  
**AZRAR Real Estate Management System - All Rights Reserved**
