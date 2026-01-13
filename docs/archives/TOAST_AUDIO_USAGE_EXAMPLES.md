# نظام الرسائل المنبثقة والصوتي - دليل الاستخدام المتقدم

## 📚 أمثلة الاستخدام

### 1. الاستخدام الأساسي

```tsx
import { useToast } from '@/context/ToastContext';

export function MyComponent() {
  const toast = useToast();

  // رسالة نجاح
  const handleSuccess = () => {
    toast.success('تمت العملية بنجاح!', 'نجاح');
  };

  // رسالة خطأ
  const handleError = () => {
    toast.error('حدث خطأ أثناء معالجة الطلب', 'خطأ');
  };

  // رسالة تحذير
  const handleWarning = () => {
    toast.warning('يرجى التحقق من البيانات قبل المتابعة', 'تحذير');
  };

  // رسالة معلومة
  const handleInfo = () => {
    toast.info('تم حفظ التغييرات في قاعدة البيانات', 'معلومة');
  };

  return (
    <div className="space-y-2">
      <button onClick={handleSuccess}>رسالة نجاح</button>
      <button onClick={handleError}>رسالة خطأ</button>
      <button onClick={handleWarning}>رسالة تحذير</button>
      <button onClick={handleInfo}>رسالة معلومة</button>
    </div>
  );
}
```

---

## 2. استخدام حوارات التأكيد

```tsx
export function DeleteItemComponent() {
  const toast = useToast();

  const handleDelete = async (itemId: string, itemName: string) => {
    const confirmed = await toast.confirm({
      title: 'حذف العنصر',
      message: `هل أنت متأكد من حذف "${itemName}"؟ لا يمكن التراجع عن هذه العملية.`,
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
      onConfirm: async () => {
        console.log('تم حذف:', itemName);
      },
      onCancel: () => {
        console.log('تم إلغاء الحذف');
      }
    });

    if (confirmed) {
      toast.success(`تم حذف "${itemName}" بنجاح`, 'عملية ناجحة');
    }
  };

  return (
    <button onClick={() => handleDelete('123', 'العقد رقم 001')}>
      حذف العقد
    </button>
  );
}
```

---

## 3. مثال عملي كامل: حذف شخص

```tsx
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { DbService } from '@/services/mockDb';

export function PeopleListItem({ person }) {
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePerson = async () => {
    setIsDeleting(true);

    const confirmed = await toast.confirm({
      title: `حذف الشخص: ${person.الاسم}`,
      message: `هل أنت متأكد من حذف "${person.الاسم}"?\n\nهذه العملية:\n• لا يمكن التراجع عنها\n• ستزيل جميع البيانات المرتبطة`,
      confirmText: 'نعم، احذف الآن',
      cancelText: 'لا، الغ العملية',
      isDangerous: true,
      onConfirm: async () => {
        try {
          const result = DbService.deletePerson(person.رقم_الشخص);
          
          if (result.success) {
            toast.delete(
              `تم حذف الشخص "${person.الاسم}" ورقمه ${person.رقم_الشخص} بنجاح`,
              'تم الحذف بنجاح'
            );
          } else {
            toast.error(result.message || 'فشل حذف الشخص', 'خطأ');
          }
        } catch (error) {
          toast.error(`خطأ: ${error.message}`, 'خطأ في الحذف');
        } finally {
          setIsDeleting(false);
        }
      },
      onCancel: () => {
        setIsDeleting(false);
      }
    });
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg">
      <div>
        <h3 className="font-bold">{person.الاسم}</h3>
        <p className="text-sm text-gray-500">{person.رقم_الهاتف}</p>
      </div>
      
      <button
        onClick={handleDeletePerson}
        disabled={isDeleting}
        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
```

---

## 4. التحكم في الصوت

```tsx
import { audioService } from '@/services/audioService';

// تحديث مستوى الصوت (0 إلى 1)
audioService.setVolume(0.5); // 50%

// تفعيل/تعطيل الأصوات
audioService.setEnabled(true);  // تفعيل
audioService.setEnabled(false); // تعطيل

// الحصول على إعدادات صوت معين
const settings = audioService.getSoundSettings('success');
console.log(settings);
// Output: { frequency: 800, volume: 0.8, modulation: 0.3 }
```

---

## 5. أنماط الرسائل المختلفة

### رسائل الخطأ الجيدة:

```tsx
// ❌ سيء: غير واضح
toast.error('Error 500');

// ✅ جيد: واضح وعملي
toast.error('فشل حفظ البيانات. تحقق من الاتصال بالإنترنت وحاول مجدداً');
```

### رسائل التحذير:

```tsx
// ❌ سيء: طويل جداً
toast.warning('حدث خطأ غير متوقع في النظام. يرجى التواصل مع الدعم الفني على...');

// ✅ جيد: موجز وعملي
toast.warning('هذه البيانات مفقودة. يرجى التحقق قبل المتابعة');
```

---

## 6. حوارات التأكيد المتقدمة

```tsx
// حوار غير خطر (أزرار زرقاء)
const confirmed = await toast.confirm({
  title: 'تسجيل الخروج',
  message: 'هل تريد تسجيل الخروج من حسابك؟',
  confirmText: 'نعم، اخرج',
  cancelText: 'لا، ابق',
  isDangerous: false  // ← غير خطر
});

// حوار خطر (أزرار حمراء)
const confirmed = await toast.confirm({
  title: 'حذف البيانات',
  message: 'سيتم حذف جميع البيانات بشكل نهائي',
  confirmText: 'نعم، احذف',
  cancelText: 'لا، ألغ',
  isDangerous: true   // ← خطر جداً
});
```

---

## 7. معالجة العمليات غير المتزامنة

```tsx
const handleComplexOperation = async () => {
  const confirmed = await toast.confirm({
    title: 'بدء عملية معقدة',
    message: 'هذه العملية قد تستغرق وقتاً. هل تريد المتابعة؟',
    isDangerous: false,
    onConfirm: async () => {
      try {
        toast.info('جاري معالجة البيانات...', 'الرجاء الانتظار');
        
        // عملية طويلة
        await new Promise(r => setTimeout(r, 3000));
        
        toast.success('اكتملت العملية بنجاح!', 'تم');
      } catch (error) {
        toast.error(`خطأ: ${error.message}`, 'فشل');
      }
    }
  });
};
```

---

## 8. استخدام في Hooks مخصصة

```tsx
// مثال: Hook مخصصة للحذف
export function useDeleteWithConfirmation() {
  const toast = useToast();

  const deleteWithConfirm = async (
    id: string,
    itemName: string,
    deleteFunction: (id: string) => Promise<void>
  ) => {
    const confirmed = await toast.confirm({
      title: 'حذف العنصر',
      message: `سيتم حذف "${itemName}" بشكل نهائي`,
      isDangerous: true,
      onConfirm: deleteFunction
    });

    if (confirmed) {
      toast.delete(`تم حذف "${itemName}" بنجاح`);
    }
  };

  return { deleteWithConfirm };
}

// الاستخدام:
export function Component() {
  const { deleteWithConfirm } = useDeleteWithConfirmation();

  const handleDelete = () => {
    deleteWithConfirm('123', 'العقد', async (id) => {
      await DbService.deleteContract(id);
    });
  };

  return <button onClick={handleDelete}>حذف</button>;
}
```

---

## 9. رسائل مع تفاصيل إضافية

```tsx
const handleImportantDelete = async () => {
  const item = {
    id: 'PROP-001',
    name: 'عقار في الدوار الرابع',
    area: 250,
    contracts: 3  // عدد العقود المرتبطة
  };

  const confirmed = await toast.confirm({
    title: `حذف العقار: ${item.name}`,
    message: `سيتم حذف العقار "${item.name}"\n\nالتفاصيل:\n• المساحة: ${item.area}م²\n• العقود المرتبطة: ${item.contracts}\n\nهذه العملية نهائية ولا يمكن التراجع`,
    isDangerous: true,
    onConfirm: async () => {
      // الحذف
    }
  });
};
```

---

## 10. أفضل الممارسات

### ✅ افعل:
- ✅ استخدم رسائل واضحة وقصيرة
- ✅ ضع `isDangerous: true` للعمليات الحساسة
- ✅ استخدم `toast.delete()` للرسائل الناجحة
- ✅ معالجة الأخطاء بـ try-catch
- ✅ تحديث البيانات بعد الحذف

### ❌ تجنب:
- ❌ الرسائل الطويلة جداً
- ❌ استخدام `toast.success()` للحذف (استخدم `toast.delete()`)
- ❌ عدم التحقق من الأخطاء
- ❌ نسيان تحديث الواجهة بعد الحذف
- ❌ رسائل غير واضحة أو مربكة

---

## 📌 ملخص الأنواع

```typescript
// أنواع الرسائل
type ToastType = 'success' | 'error' | 'warning' | 'info' | 'delete';

// خيارات الحوار
interface DialogOptions {
  title: string;              // العنوان
  message: string;            // الرسالة
  confirmText?: string;       // نص زر التأكيد
  cancelText?: string;        // نص زر الإلغاء
  onConfirm?: () => void;     // عند التأكيد
  onCancel?: () => void;      // عند الإلغاء
  isDangerous?: boolean;      // إذا كانت خطرة (أحمر)
}
```

---

## 🚀 الخطوات التالية

1. جرّب الأمثلة البسيطة أولاً
2. طبّق على صفحات الحذف
3. اختبر الأصوات والحركات
4. تأكد من معالجة الأخطاء
5. تحقق من تحديث البيانات

---

**تم تحضير النظام بنجاح! ✨**
