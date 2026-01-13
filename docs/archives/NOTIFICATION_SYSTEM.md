# نظام الإشعارات والرسائل المنبثقة مع الصوت

## نظرة عامة

تم ربط نظام شامل للإشعارات يجمع بين:
- 🔊 نظام الصوت (audioService)
- 📢 نظام التنبيهات (notificationService)
- 🎯 رسائل منبثقة (Toast Notifications)

## المكونات

### 1. audioService.ts
نظام الصوت المتقدم الذي يدعم أنواع مختلفة من الأصوات:

```typescript
// استخدام مباشر
import { audioService } from '@/services/audioService';

audioService.playSound('success');  // صوت النجاح
audioService.playSound('error');    // صوت الخطأ
audioService.playSound('warning');  // صوت التحذير
audioService.playSound('info');     // صوت المعلومة
audioService.playSound('delete');   // صوت الحذف

// التحكم بمستوى الصوت
audioService.setVolume(0.5);  // 50%
audioService.setEnabled(false); // تعطيل الأصوات
```

### 2. notificationService.ts
نظام الإشعارات المتكامل:

```typescript
import { notificationService } from '@/services/notificationService';

// إشعارات أساسية
notificationService.success('تم الحفظ بنجاح');
notificationService.error('حدث خطأ ما');
notificationService.warning('تحذير مهم');
notificationService.info('معلومة');

// إشعارات الأعمال (Business Events)
notificationService.contractCreated('CNT-001', 'أحمد علي');
notificationService.installmentPaid(5000, 'محمد السعودي');
notificationService.installmentDue(3000, 'سارة محمود', 3);
notificationService.installmentOverdue(2500, 'علي إبراهيم', 5);
notificationService.contractEnding('CNT-002', 'فاطمة خديجة', 15);
notificationService.maintenanceRequired('PROP-456', 'تسرب مائي');
notificationService.blacklistWarning('محمد أحمد');
notificationService.commissionCalculated(500, 'عمولة البيع');
notificationService.systemAlert('انقطاع الاتصال بالخادم', 'critical');
```

### 3. useNotification Hook
هوك مخصص لاستخدام الإشعارات في المكونات:

```typescript
import { useNotification } from '@/hooks/useNotification';

export const MyComponent = () => {
  const notify = useNotification();

  const handleSave = () => {
    try {
      // save logic
      notify.success('تم الحفظ بنجاح', 'حفظ');
    } catch (error) {
      notify.error('فشل الحفظ', 'خطأ');
    }
  };

  const handleContractCreated = (contractId, tenantName) => {
    notify.contractCreated(contractId, tenantName);
  };

  return (
    // JSX
  );
};
```

## التكامل مع ToastContext

تم ربط `notificationService` مع `ToastContext` تلقائياً، مما يعني:

```typescript
// عند استدعاء
notificationService.success('رسالة');

// يحدث:
// 1. ✅ يظهر Toast في الشاشة
// 2. 🔊 يصدر صوت النجاح
// 3. 📝 يُسجل في سجل الإشعارات
```

## مثال عملي كامل

```typescript
import { useNotification } from '@/hooks/useNotification';
import { DbService } from '@/services/mockDb';

export const ContractFormPanel = () => {
  const notify = useNotification();

  const handleSubmit = () => {
    const res = DbService.createContract(contract, commOwner, commTenant);
    
    if (res.success) {
      // الحصول على اسم المستأجر
      const tenants = DbService.getPeople();
      const tenant = tenants.find(p => p.رقم_الشخص === contract.رقم_المستاجر);
      
      // إرسال إشعار العقد الجديد
      notify.contractCreated(res.id, tenant?.الاسم || 'مستأجر');
      
      // إرسال إشعار عام
      notify.success('تم إنشاء العقد بنجاح', 'عقد جديد');
    } else {
      notify.error(res.message, 'خطأ');
    }
  };

  return (
    // Form JSX
  );
};
```

## أنواع الإشعارات المدعومة

### أساسية
- `success` - ✅ نجاح (أخضر + صوت حادّ)
- `error` - ❌ خطأ (أحمر + صوت منخفض)
- `warning` - ⚠️ تحذير (أصفر + صوت متوسط)
- `info` - ℹ️ معلومة (أزرق + صوت ناعم)
- `delete` - 🗑️ حذف (أحمر داكن + صوت خاص)

### أعمال (Business)
- `contractCreated` - عقد جديد
- `installmentPaid` - دفعة تم استلامها
- `installmentDue` - دفعة مستحقة
- `installmentOverdue` - دفعة متأخرة
- `contractEnding` - انتهاء عقد قريب
- `maintenanceRequired` - صيانة مطلوبة
- `blacklistWarning` - تحذير سمعة
- `commissionCalculated` - عمولة محسوبة
- `systemAlert` - تنبيه النظام

## الخيارات المتقدمة

```typescript
notificationService.notify(
  'رسالتك هنا',
  'success',
  {
    title: 'عنوان مخصص',
    duration: 5000,  // مدة العرض بالميلي ثانية
    sound: true,     // تشغيل الصوت
    showNotification: true, // عرض الرسالة
    category: 'contracts'   // تصنيف الإشعار
  }
);
```

## إدارة الإشعارات

```typescript
// الحصول على سجل الإشعارات
const logs = notificationService.getLogs();
console.log(logs); // مصفوفة بجميع الإشعارات السابقة

// حذف السجل
notificationService.clearLogs();

// تفعيل/تعطيل الإشعارات
notificationService.setEnabled(false); // تعطيل الكل
notificationService.setEnabled(true);  // تفعيل الكل
```

## الإعدادات

الإعدادات تُحفظ في localStorage تلقائياً:

```
audioConfig:
{
  "volume": 0.3,
  "enabled": true
}
```

## ملاحظات تقنية

1. **عدم التدخل**: استخدام Web Audio API مع fallback safe
2. **الأداء**: الأصوات خفيفة الحجم (تخليق بدلاً من تحميل ملفات)
3. **التوافق**: يعمل على جميع المتصفحات الحديثة
4. **الخصوصية**: لا يوجد تسجيل صوتي، فقط تشغيل أصوات

## الخطوات التالية

1. ✅ ربط الإشعارات بعمليات العقود
2. ✅ ربط الإشعارات بعمليات الدفعات
3. ⏳ إضافة إشعارات لقائمة المسؤوليات
4. ⏳ إضافة إشعارات الصيانة
5. ⏳ إضافة تنبيهات النظام التلقائية

---

**تم التطوير بواسطة:** Mahmoud Qattoush  
**تاريخ:** 22 ديسمبر 2025  
**الإصدار:** 1.0.0
