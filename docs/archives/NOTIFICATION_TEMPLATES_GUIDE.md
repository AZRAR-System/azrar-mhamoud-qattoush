# نظام نماذج الرسائل والإشعارات 📧

## نظرة عامة

تم إنشاء نظام متكامل لإدارة نماذج الرسائل والإشعارات للمستأجرين مع دعم كامل لـ:
- ✅ نماذج قابلة للتعديل والتخصيص
- ✅ متغيرات ديناميكية باستخدام `{{ }}`
- ✅ تكامل مع واتساب
- ✅ معاينة فورية للرسائل
- ✅ حفظ النماذج في localStorage
- ✅ تفعيل/تعطيل النماذج
- ✅ تصنيف تلقائي للنماذج حسب النوع

---

## المكونات الرئيسية

### 1. `src/services/notificationTemplates.ts`
ملف الخدمة الأساسي يحتوي على:

#### أنواع البيانات:
```typescript
interface NotificationTemplate {
  id: string;                    // معرّف فريد للنموذج
  name: string;                  // اسم النموذج
  category: 'reminder' | 'due' | 'late' | 'warning' | 'legal';  // الفئة
  title: string;                 // عنوان الرسالة (مع متغيرات)
  body: string;                  // نص الرسالة (مع متغيرات)
  enabled: boolean;              // هل النموذج مفعّل؟
  createdAt: string;             // تاريخ الإنشاء
  updatedAt: string;             // تاريخ آخر تعديل
  tags: string[];                // وسوم تصنيفية
}

interface TemplateContext {
  tenantName?: string;           // اسم المستأجر
  propertyCode?: string;         // كود العقار
  amount?: number;               // المبلغ المستحق
  dueDate?: string;              // تاريخ الاستحقاق
  daysLate?: number;             // عدد أيام التأخر
  contractNumber?: string;       // رقم العقد
  remainingAmount?: number;      // المبلغ المتبقي
  [key: string]: any;
}
```

#### الدوال الرئيسية:

##### 1. `fillTemplate(template, context)`
ملء النموذج بالبيانات الفعلية

```typescript
const template = NotificationTemplates.getById('pre_due_reminder');
const filledText = NotificationTemplates.fill(template, {
  tenantName: 'أحمد محمد',
  amount: 5000,
  dueDate: '2025-01-15'
});
```

##### 2. `fillTemplateComplete(template, context)`
ملء النموذج كاملاً (العنوان والنص)

```typescript
const complete = NotificationTemplates.fillComplete(template, context);
// Returns: { title: "...", body: "...", category: "...", enabled: true }
```

##### 3. `openWhatsApp(message, phoneNumber)`
فتح محادثة واتساب بالرسالة

```typescript
NotificationTemplates.openWhatsApp(message, '966501234567');
```

##### 4. `getWhatsAppLink(message, phoneNumber)`
الحصول على رابط واتساب بدون فتح الصفحة

---

### 2. `src/components/MessageComposer.tsx`
مكون متكامل لاختيار وتحرير الرسائل

#### الخصائص:
```typescript
interface MessageComposerProps {
  category?: NotificationTemplate['category'];  // فئة النموذج
  tenantName?: string;                          // اسم المستأجر
  tenantPhone?: string;                         // رقم المستأجر
  propertyCode?: string;                        // كود العقار
  amount?: number;                              // المبلغ
  dueDate?: string;                             // تاريخ الاستحقاق
  daysLate?: number;                            // أيام التأخر
  contractNumber?: string;                      // رقم العقد
  remainingAmount?: number;                     // المبلغ المتبقي
  onClose?: () => void;                         // عند الإغلاق
  onSent?: (message: string) => void;          // عند الإرسال
}
```

#### الميزات:
- قائمة اختيار النماذج
- تحرير النص بحرية
- نسخ للحافظة
- فتح في واتساب
- إرسال مخصص

---

### 3. `src/components/panels/NotificationTemplatesPanel.tsx`
لوحة إدارة النماذج الكاملة

#### الميزات:
- 📋 عرض جميع النماذج
- ✏️ تحرير النماذج
- 🔍 بحث وتصفية
- 👁️ معاينة مع بيانات حقيقية
- ➕ إضافة نماذج جديدة
- 🗑️ حذف نماذج
- 🔄 إعادة تعيين إلى الافتراضية
- 📱 اختبار في واتساب
- 📋 نسخ الرسالة

---

### 4. `src/pages/NotificationTemplates.tsx`
صفحة مخصصة لإدارة النماذج

---

## النماذج الافتراضية 📨

### 1. تذكير قبل الاستحقاق (pre_due_reminder)
**الفئة:** reminder
**متى يُستخدم:** عند الاقتراب من تاريخ الاستحقاق (أكثر من 3 أيام)
**المحتوى:**
```
العنوان: تذكير: قريباً موعد استحقاق الدفعة
النص: يتضمن بيانات الدفعة والتاريخ
```

### 2. يوم الاستحقاق (due_day_reminder)
**الفئة:** due
**متى يُستخدم:** في يوم الاستحقاق (3 أيام أو أقل قبل)
**المحتوى:**
```
العنوان: اليوم: موعد استحقاق الدفعة
النص: تذكير عاجل بدفع القسط اليوم
```

### 3. تأخير بسيط (post_late_reminder)
**الفئة:** late
**متى يُستخدم:** بعد تجاوز الموعد (أقل من أسبوع)
**المحتوى:**
```
العنوان: تنبيه: تأخر الدفعة بـ {{daysLate}} أيام
النص: تنبيه ودي بالدفع في أقرب وقت
```

### 4. إنذار رسمي (legal_warning)
**الفئة:** warning
**متى يُستخدم:** تأخير متوسط (أسبوع إلى شهر)
**المحتوى:**
```
العنوان: إنذار: تجاوز المدة المحددة للدفع
النص: إنذار رسمي بضرورة الدفع خلال 48 ساعة
```

### 5. إشعار قانوني (legal_notice)
**الفئة:** legal
**متى يُستخدم:** تأخير طويل (أكثر من شهر)
**المحتوى:**
```
العنوان: إشعار قانوني: إجراءات قانونية وشيكة
النص: إشعار رسمي بتحريك إجراءات قانونية
```

---

## المتغيرات المدعومة 🔤

| المتغير | الوصف | مثال |
|---------|-------|------|
| `{{tenantName}}` | اسم المستأجر | أحمد محمد |
| `{{propertyCode}}` | كود العقار | E-102 |
| `{{amount}}` | المبلغ المستحق | 5000 |
| `{{dueDate}}` | تاريخ الاستحقاق | 2025-01-15 |
| `{{daysLate}}` | عدد أيام التأخر | 5 |
| `{{contractNumber}}` | رقم العقد | CONT-2024-001 |
| `{{remainingAmount}}` | المبلغ المتبقي | 2500 |

---

## كيفية الاستخدام

### 1. في صفحة الكمبيالات (Installments)

الأزرار تظهر تلقائياً في جدول الكمبيالات حسب حالة الدفعة:

#### حسب الحالة:
- **تذكير** (أزرق): تذكير قبل الاستحقاق
- **استحقاق** (برتقالي): يوم الاستحقاق
- **متأخر** (أحمر): بعد الاستحقاق بأيام
- **إنذار** (أحمر داكن): تأخير متوسط
- **قانوني** (بنفسجي): تأخير طويل

#### خطوات الاستخدام:
1. اذهب إلى صفحة الكمبيالات
2. اختر العقد المطلوب
3. انظر إلى عمود "رسائل" في جدول الكمبيالات
4. اختر نوع الرسالة المناسب
5. اختر من:
   - نموذج مختلف (اختياري)
   - نسخ الرسالة
   - فتح في واتساب
   - إرسال مخصص

### 2. في لوحة إدارة النماذج

الرابط: `http://localhost:3000/notification-templates`

#### خطوات الاستخدام:
1. **عرض النماذج:**
   - كل النماذج
   - حسب الفئة (تذكيرات، استحقاق، إلخ)
   - بحث نصي

2. **تحرير نموذج:**
   - اضغط زر التحرير (✏️)
   - عدّل الاسم أو العنوان أو النص
   - استخدم `{{ }}` للمتغيرات
   - احفظ التغييرات

3. **معاينة:**
   - اضغط زر المعاينة (👁️)
   - عدّل بيانات المعاينة
   - شاهد الرسالة المملوءة
   - انسخها أو افتحها في واتساب

4. **إضافة نموذج:**
   - اضغط "نموذج جديد"
   - أكمل التفاصيل
   - احفظ

5. **حذف/تعطيل:**
   - اضغط زر الحذف (🗑️)
   - أو اضغط العين لتعطيل

---

## API المكتبة

### `NotificationTemplates` الكائن

```typescript
// الحصول على جميع النماذج
NotificationTemplates.getAll(): NotificationTemplate[]

// الحصول على نموذج بواسطة ID
NotificationTemplates.getById(id: string): NotificationTemplate | undefined

// الحصول على النماذج حسب الفئة
NotificationTemplates.getByCategory(category: 'reminder' | 'due' | 'late' | 'warning' | 'legal'): NotificationTemplate[]

// إضافة نموذج جديد
NotificationTemplates.add(template: ...): NotificationTemplate

// تحديث نموذج
NotificationTemplates.update(id: string, updates: ...): NotificationTemplate | undefined

// حذف نموذج
NotificationTemplates.delete(id: string): boolean

// تفعيل/تعطيل نموذج
NotificationTemplates.toggleEnabled(id: string): NotificationTemplate | undefined

// إعادة تعيين إلى الافتراضية
NotificationTemplates.reset(): void

// ملء النموذج بالبيانات
NotificationTemplates.fill(template: NotificationTemplate | string, context: TemplateContext): string

// ملء النموذج كاملاً
NotificationTemplates.fillComplete(template: NotificationTemplate, context: TemplateContext): FilledTemplateInfo

// الحصول على رابط واتساب
NotificationTemplates.getWhatsAppLink(message: string, phoneNumber: string): string

// فتح واتساب
NotificationTemplates.openWhatsApp(message: string, phoneNumber: string): void
```

---

## مثال عملي شامل

```typescript
import { NotificationTemplates, TemplateContext } from '@/services/notificationTemplates';

// 1. الحصول على النموذج
const template = NotificationTemplates.getById('post_late_reminder');

// 2. تحضير السياق
const context: TemplateContext = {
  tenantName: 'أحمد محمد علي',
  propertyCode: 'E-102',
  amount: 5000,
  dueDate: '2025-01-15',
  daysLate: 7,
  contractNumber: 'CONT-2024-001',
  remainingAmount: 5000
};

// 3. ملء النموذج
const filled = NotificationTemplates.fillComplete(template, context);

// 4. عرض الرسالة
console.log(filled.title);    // "تنبيه: تأخر الدفعة بـ 7 أيام"
console.log(filled.body);     // "السلام عليكم أحمد محمد علي..."

// 5. فتح في واتساب
const message = `${filled.title}\n\n${filled.body}`;
NotificationTemplates.openWhatsApp(message, '966501234567');

// أو نسخ للحافظة
navigator.clipboard.writeText(message);
```

---

## الحفظ والاستعادة 💾

جميع النماذج تُحفظ تلقائياً في:
- **localStorage** بمفتاح `notification_templates`
- **التنسيق:** JSON مشفر

### إعادة التعيين:
```typescript
NotificationTemplates.reset();
```

هذا سيستعيد جميع النماذج الافتراضية.

---

## الميزات الأمنية 🔒

- ✅ بدون إرسال تلقائي - يجب أن يضغط المستخدم الزر
- ✅ تفعيل/تعطيل النماذج - منع استخدام نماذج معينة
- ✅ المعاينة قبل الإرسال - اختبار الرسالة قبل الفعل
- ✅ التحقق من الرقم - التحقق من صحة رقم الهاتف
- ✅ عدم تخزين البيانات الحساسة - فقط النماذج

---

## الروابط المهمة 🔗

- **إدارة النماذج:** `/notification-templates`
- **صفحة الكمبيالات:** `/installments`

---

## الملفات المنشأة 📁

```
src/
├── services/
│   └── notificationTemplates.ts          # خدمة النماذج الأساسية
├── components/
│   ├── MessageComposer.tsx               # مكون منشئ الرسائل
│   └── panels/
│       └── NotificationTemplatesPanel.tsx# لوحة الإدارة
└── pages/
    └── NotificationTemplates.tsx         # صفحة إدارة النماذج
```

---

## الحالة الحالية ✅

- ✅ نماذج افتراضية 5
- ✅ دعم المتغيرات الديناميكية
- ✅ تكامل واتساب
- ✅ لوحة إدارة متكاملة
- ✅ حفظ في localStorage
- ✅ معاينة فورية
- ✅ تفعيل/تعطيل
- ✅ 0 أخطاء
- ✅ جاهز للاستخدام الفوري

---

## ملاحظات مهمة ⚠️

1. **بدون إرسال تلقائي:** لا يتم إرسال أي رسالة تلقائياً
2. **الرقم الافتراضي:** في المعاينة يُستخدم رقم افتراضي (966501234567)
3. **localStorage:** جميع النماذج تُخزّن محلياً في المتصفح فقط
4. **لا حد للنماذج:** يمكن إضافة عدد لا محدود من النماذج المخصصة
5. **عدم حذف الافتراضية:** النماذج الافتراضية يمكن استعادتها بزر "إعادة التعيين"

---

## التطوير المستقبلي 🚀

- [ ] إرسال فعلي للرسائل (SMS, Email)
- [ ] جدولة الرسائل (إرسال تلقائي في وقت محدد)
- [ ] إحصائيات الرسائل المرسلة
- [ ] قوالب HTML متقدمة
- [ ] دعم لغات متعددة
- [ ] مرفقات في الرسائل

---

**تم الإنشاء:** 22 ديسمبر 2024
**الإصدار:** 1.0.0
**الحالة:** جاهز للإنتاج ✅
