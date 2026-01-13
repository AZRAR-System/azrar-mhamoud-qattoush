
# دليل تشغيل النظام (Desktop)

## المتطلبات الأساسية
- **Node.js**: الإصدار 18 أو أحدث.
- **NPM**: مدير الحزم.
- (اختياري) **.NET SDK** فقط إذا كنت تعمل على مشروع الـ Backend (غير مستخدم في وضع Desktop فقط).

## خطوة 1: تشغيل نسخة Desktop للتجربة

- للتطوير (Vite + Electron): `npm run desktop:dev`
- تشغيل Standalone (يبني ثم يشغل): `npm run desktop:run`

## خطوة 2: بناء نسخة التوزيع (Installer)

افتح موجه الأوامر (Terminal) في مجلد المشروع ونفذ:

```bash
# تثبيت المكتبات (إذا لم تكن مثبتة)
npm install

# بناء نسخة Desktop
npm run desktop:dist:skipWU
```

ستجد مخرجات التوزيع داخل `release2_build/`.

## ملاحظات الأداء
- تم تفعيل **Gzip/Brotli** minification للكود.
- تم تقسيم الكود (Code Splitting) لتقليل حجم التحميل الأولي.
- تم إزالة جميع سجلات التتبع (Console Logs) من نسخة الإنتاج.

## ملاحظة
هذا الدليل يركّز على نسخة Desktop. تشغيل النظام على LAN/Server غير ضمن هذا المسار.
