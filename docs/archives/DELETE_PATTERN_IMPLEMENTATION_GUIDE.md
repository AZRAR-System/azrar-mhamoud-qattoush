# دليل تطبيق نمط التأكيد على جميع صفحات الحذف

## 🎯 الهدف
تطبيق نمط موحد لحوارات التأكيد على جميع عمليات الحذف في النظام

---

## 📋 النمط الموحد

```tsx
const handleDelete = async (id: string, name: string) => {
  const confirmed = await toast.confirm({
    title: 'حذف [العنصر]',
    message: 'رسالة تأكيد واضحة',
    confirmText: 'نعم، احذف',
    cancelText: 'إلغاء',
    isDangerous: true,
    onConfirm: async () => {
      try {
        // حذف البيانات
        DbService.delete...(id);
        toast.delete('رسالة النجاح', 'تم الحذف');
        // تحديث الواجهة
        loadData();
      } catch (error) {
        toast.error(`خطأ: ${error}`, 'فشل الحذف');
      }
    }
  });
};
```

---

## 📝 الملفات المراد تحديثها

### 1. **`src/pages/People.tsx`** ✍️

#### قبل:
```tsx
const handleDelete = (id: string) => {
  DbService.deletePerson(id);
  toast.success('تم الحذف');
  loadData();
};
```

#### بعد:
```tsx
const handleDelete = async (id: string) => {
  const person = people.find(p => p.رقم_الشخص === id);
  if (!person) return;

  const confirmed = await toast.confirm({
    title: `حذف الشخص: ${person.الاسم}`,
    message: `سيتم حذف "${person.الاسم}" ورقمه ${id} بشكل نهائي.\nهذه العملية لا يمكن التراجع عنها.`,
    confirmText: 'نعم، احذف الآن',
    cancelText: 'إلغاء',
    isDangerous: true,
    onConfirm: async () => {
      try {
        const result = DbService.deletePerson(id);
        if (result.success) {
          toast.delete(
            `تم حذف الشخص "${person.الاسم}" بنجاح`,
            'تم الحذف'
          );
          loadData();
        } else {
          toast.error(result.message || 'فشل الحذف', 'خطأ');
        }
      } catch (error) {
        toast.error(`خطأ: ${error.message}`, 'خطأ في الحذف');
      }
    }
  });
};
```

---

### 2. **`src/pages/Properties.tsx`** ✍️

```tsx
const handleDeleteProperty = async (id: string) => {
  const property = properties.find(p => p.رقم_العقار === id);
  if (!property) return;

  const confirmed = await toast.confirm({
    title: `حذف العقار: ${property.الكود_الداخلي}`,
    message: `سيتم حذف العقار "${property.الكود_الداخلي}" بشكل نهائي.\nجميع البيانات المرتبطة به سيتم حذفها.`,
    confirmText: 'نعم، احذف',
    cancelText: 'إلغاء',
    isDangerous: true,
    onConfirm: async () => {
      try {
        DbService.deleteProperty(id);
        toast.delete(`تم حذف العقار "${property.الكود_الداخلي}"`, 'تم الحذف');
        loadData();
      } catch (error) {
        toast.error(`خطأ: ${error}`, 'فشل الحذف');
      }
    }
  });
};
```

---

### 3. **`src/components/dashboard/layers/CalendarTasksLayer.tsx`** ✍️

```tsx
const handleDeleteTask = async (taskId: string, taskTitle: string) => {
  const confirmed = await toast.confirm({
    title: 'حذف المهمة',
    message: `سيتم حذف المهمة "${taskTitle}" بشكل نهائي`,
    confirmText: 'احذف المهمة',
    cancelText: 'إلغاء',
    isDangerous: true,
    onConfirm: async () => {
      try {
        const tasks = JSON.parse(
          localStorage.getItem('calendar_tasks') || '[]'
        );
        const updatedTasks = tasks.filter(t => t.id !== taskId);
        localStorage.setItem('calendar_tasks', JSON.stringify(updatedTasks));
        
        toast.delete(`تم حذف المهمة "${taskTitle}"`, 'تم الحذف');
        setTasks(updatedTasks);
      } catch (error) {
        toast.error(`خطأ: ${error}`, 'فشل الحذف');
      }
    }
  });
};
```

---

### 4. **`src/pages/Sales.tsx`** ✍️

```tsx
const handleDeleteSale = async (id: string) => {
  const sale = sales.find(s => s.رقم_العملية === id);
  if (!sale) return;

  const confirmed = await toast.confirm({
    title: 'حذف عملية البيع',
    message: `سيتم حذف عملية البيع لعقار ${sale.رقم_العقار} بشكل نهائي`,
    confirmText: 'نعم، احذف',
    cancelText: 'إلغاء',
    isDangerous: true,
    onConfirm: async () => {
      try {
        DbService.deleteSale(id);
        toast.delete('تم حذف عملية البيع بنجاح', 'تم الحذف');
        loadData();
      } catch (error) {
        toast.error(`خطأ: ${error}`, 'فشل الحذف');
      }
    }
  });
};
```

---

### 5. **`src/pages/Installments.tsx`** ✍️

```tsx
const handleCancelInstallment = async (id: string) => {
  const installment = installments.find(i => i.رقم_الدفعة === id);
  if (!installment) return;

  const confirmed = await toast.confirm({
    title: 'إلغاء الدفعة',
    message: `سيتم إلغاء الدفعة رقم ${id} المستحقة بتاريخ ${installment.تاريخ_الاستحقاق}`,
    confirmText: 'نعم، ألغِ',
    cancelText: 'إلغاء',
    isDangerous: true,
    onConfirm: async () => {
      try {
        DbService.cancelInstallment(id);
        toast.delete('تم إلغاء الدفعة بنجاح', 'تم الإلغاء');
        loadData();
      } catch (error) {
        toast.error(`خطأ: ${error}`, 'فشل الإلغاء');
      }
    }
  });
};
```

---

### 6. **`src/pages/Contracts.tsx`** ✅ (تم بالفعل)

```tsx
const handleArchive = useCallback(async (id: string) => {
  const contract = contracts.find(c => c.رقم_العقد === id);
  if (!contract) return;

  const confirmed = await toast.confirm({
    title: 'أرشفة العقد',
    message: `سيتم نقل العقد "${contract.رقم_العقد}" للأرشيف`,
    confirmText: 'نعم، انقل للأرشيف',
    cancelText: 'إلغاء',
    isDangerous: false,
    onConfirm: async () => {
      try {
        DbService.archiveContract(id);
        toast.success('تمت أرشفة العقد بنجاح', 'تم الأرشيف');
        loadData();
      } catch (error) {
        toast.error(`خطأ: ${error}`, 'فشل الأرشيف');
      }
    }
  });
}, [contracts, toast, loadData]);
```

---

## 🔑 نقاط مهمة

### في كل دالة delete:
1. ✅ احصل على البيانات الكاملة للعنصر (للرسالة)
2. ✅ استخدم `toast.confirm()` مع await
3. ✅ ضع `isDangerous: true` للعمليات الحساسة
4. ✅ استخدم `toast.delete()` عند النجاح
5. ✅ استخدم `toast.error()` عند الفشل
6. ✅ أعد تحميل البيانات بعد الحذف

### رسائل واضحة:
- ❌ سيء: "هل تريد الحذف؟"
- ✅ جيد: "سيتم حذف العقد 'رقم 001' بشكل نهائي. لا يمكن التراجع"

### معالجة الأخطاء:
```tsx
try {
  // عملية الحذف
  DbService.delete...(id);
  toast.delete('تم الحذف بنجاح', 'تم الحذف');
  loadData();
} catch (error) {
  toast.error(`خطأ: ${error.message}`, 'فشل الحذف');
}
```

---

## 🚀 خطوات التنفيذ

1. **استنساخ النمط** من أحد الملفات المحدثة
2. **تكييفه** مع الملف الجديد (أسماء الجداول والمتغيرات)
3. **اختبار** الحوار والصوت والحذف
4. **التحقق** من إعادة تحميل البيانات
5. **الانتقال** للملف التالي

---

## ✅ قائمة التحقق

- [ ] تم تحديث `src/pages/People.tsx`
- [ ] تم تحديث `src/pages/Properties.tsx`
- [ ] تم تحديث `src/components/dashboard/layers/CalendarTasksLayer.tsx`
- [ ] تم تحديث `src/pages/Sales.tsx`
- [ ] تم تحديث `src/pages/Installments.tsx`
- [ ] تم اختبار جميع الحوارات
- [ ] تم التحقق من الأصوات
- [ ] تم التحقق من إعادة تحميل البيانات

---

## 🎯 الفائدة

```
كل عملية حذف تصبح:
- ✅ آمنة (تأكيد إجباري)
- ✅ واضحة (رسائل بينة)
- ✅ مسموعة (تأثير صوتي)
- ✅ سلسة (أنميشنات جميلة)
- ✅ موثوقة (معالجة أخطاء)
```

---

**دمت بكل خير! 🚀**
