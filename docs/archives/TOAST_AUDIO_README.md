# نظام الرسائل المنبثقة والصوت - دليل سريع

## ✅ ما تم إنجازه

### 1. **خدمة الصوت المتقدمة** (`src/services/audioService.ts`)
- ✅ نظام صوتي احترافي باستخدام Web Audio API
- ✅ 8 أنواع من الأصوات (نجاح، خطأ، تحذير، معلومة، حذف، إضافة، حفظ، إلغاء)
- ✅ تحكم في مستوى الصوت والتفعيل/التعطيل
- ✅ حفظ الإعدادات في localStorage

### 2. **نظام الرسائل المنبثقة المحترف** (`src/context/ToastContext.tsx`)
- ✅ رسائل نجاح، خطأ، تحذير، معلومة، حذف
- ✅ حوارات تأكيد متقدمة (Confirm Dialogs)
- ✅ تكامل مع نظام الصوت
- ✅ مدة عرض قابلة للتخصيص حسب النوع
- ✅ موضع التوضع: أسفل يمين الشاشة (RTL)

### 3. **رسوميات احترافية**
- ✅ تصاميم جميلة بتدرجات لونية
- ✅ أيقونات من lucide-react
- ✅ وضع مظلم كامل
- ✅ حركات سلسة (animations)

### 4. **نمط البرمجة**
- ✅ Hook `useToast()` سهل الاستخدام
- ✅ منطق واضح وموثق
- ✅ معالجة الأخطاء الآمنة

---

## 🎯 كيفية الاستخدام

### الاستخدام الأساسي:

```tsx
import { useToast } from '@/context/ToastContext';

export function MyComponent() {
  const toast = useToast();

  // رسالة نجاح
  toast.success('تمت العملية بنجاح');

  // رسالة خطأ
  toast.error('حدث خطأ ما');

  // رسالة تحذير
  toast.warning('تنبيه مهم');

  // رسالة معلومة
  toast.info('معلومة');

  // رسالة حذف
  toast.delete('تم الحذف بنجاح');
}
```

### حوارات التأكيد (للحذف والعمليات الخطرة):

```tsx
const handleDelete = async (id: string, name: string) => {
  const confirmed = await toast.confirm({
    title: 'حذف العنصر',
    message: `هل أنت متأكد من حذف "${name}"؟`,
    confirmText: 'نعم، احذف',
    cancelText: 'إلغاء',
    isDangerous: true,
    onConfirm: async () => {
      // تنفيذ عملية الحذف
      await deleteItem(id);
      console.log('تم الحذف');
    }
  });

  if (confirmed) {
    toast.delete(`تم حذف "${name}" بنجاح`);
  }
};
```

---

## 🔊 التحكم في الصوت

```tsx
import { audioService } from '@/services/audioService';

// تحديث مستوى الصوت (0 إلى 1)
audioService.setVolume(0.5);

// تفعيل/تعطيل الأصوات
audioService.setEnabled(true);

// الحصول على إعدادات الصوت
const settings = audioService.getSoundSettings('success');
console.log(settings);
// { frequency: 800, volume: 0.8, modulation: 0.3 }
```

---

## 📁 الملفات المُنشأة/المُعدّلة

| الملف | الحالة | الوصف |
|------|--------|-------|
| `src/services/audioService.ts` | ✅ جديد | خدمة الصوت المتقدمة |
| `src/context/ToastContext.tsx` | ✅ محدّث | نظام الرسائل والحوارات |
| `src/styles/animations.css` | ✅ جديد | تعريفات الحركات |
| `src/main.tsx` | ✅ محدّث | استيراد الحركات |

---

## 🎨 أنواع الرسائل والألوان

| النوع | اللون | الصوت | الاستخدام |
|------|-------|--------|----------|
| `success` | 🟢 أخضر | ✓ سعيد | عمليات ناجحة |
| `error` | 🔴 أحمر | ✗ خطير | أخطاء وفشل |
| `warning` | 🟠 برتقالي | ⚠️ تنبيه | تحذيرات |
| `info` | 🔵 أزرق | ℹ️ معلومة | معلومات عامة |
| `delete` | 🔴 أحمر | 🗑️ حذف | عمليات حذف |

---

## 🎬 الحركات والتأثيرات

```css
/* التأثيرات المتاحة */
.animate-slide-up      /* رسائل الـ Toast */
.animate-fade-in       /* خلفية الحوار */
.animate-scale-up      /* محتوى الحوار */
```

---

## 📋 قائمة الملفات المراد تحديثها

### يجب تطبيق نمط التأكيد على:

1. **`src/pages/Contracts.tsx`** - حذف العقود
2. **`src/pages/People.tsx`** - حذف الأشخاص
3. **`src/pages/Properties.tsx`** - حذف العقارات
4. **`src/components/dashboard/layers/CalendarTasksLayer.tsx`** - حذف المهام
5. **`src/pages/Sales.tsx`** - حذف المبيعات
6. **`src/pages/Installments.tsx`** - إلغاء الدفعات

### النمط الموحد:
```tsx
const confirmed = await toast.confirm({
  title: 'حذف [العنصر]',
  message: 'رسالة تأكيد واضحة',
  isDangerous: true,
  onConfirm: async () => { /* الحذف */ }
});
```

---

## ✨ المميزات

- ✅ **نظام صوتي احترافي** - أصوات طبيعية من Web Audio API
- ✅ **رسائل فورية** - تظهر وتختفي تلقائياً
- ✅ **حوارات تأكيد** - للعمليات الخطرة والحساسة
- ✅ **دعم RTL كامل** - العربية والإنجليزية
- ✅ **وضع مظلم** - تصاميم تتكيف مع المظهر
- ✅ **حركات سلسة** - انتقالات احترافية
- ✅ **سهولة الاستخدام** - Hook بسيط وواضح

---

## 🚀 الخطوات التالية

1. اختبر النظام بتشغيل `npm run dev`
2. جرّب رسائل النجاح والخطأ
3. اختبر حوارات التأكيد
4. طبّق النمط على صفحات الحذف
5. اختبر الصوت مع أنواع مختلفة

---

## 📞 تحتاج مساعدة؟

راجع ملف `TOAST_AUDIO_SYSTEM_GUIDE.ts` للأمثلة الكاملة والتفصيلية!
