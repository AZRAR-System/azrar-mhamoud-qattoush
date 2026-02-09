# Troubleshooting

هذا الملف يجمع حلولًا عملية للمشاكل المتكررة أثناء التطوير أو التشغيل.

## 1) ظهور حرف (ؤ) قبل أوامر PowerShell/Terminal

**الأعراض**
- ظهور أوامر مثل: `ؤcd` أو `ؤSet-Location` ثم يفشل التنفيذ برسالة "CommandNotFound".

**السبب الشائع**
- يحدث عادةً بسبب إدخال حرف عربي (أو IME) في بداية السطر داخل الطرفية قبل الأمر.

**حلول سريعة**
1. **بدّل لغة الإدخال إلى الإنجليزية** قبل كتابة الأوامر (Alt+Shift أو Win+Space).
2. **امسح السطر الحالي**:
   - في PowerShell مع PSReadLine: جرّب `Esc` لمسح/إلغاء الإدخال الحالي.
   - أو `Ctrl+U` لمسح السطر بالكامل (حسب إعدادات PSReadLine).
3. **افتح Terminal جديد** من VS Code: Terminal → New Terminal.

**حلول أكثر ثباتًا (اختياري)**
- تأكد أن الطرفية تستخدم PowerShell وأن تخطيط لوحة المفاتيح مضبوط.
- إذا كانت لديك إعدادات PSReadLine مخصصة، يمكنك إعادة تعيين نمط التحرير للوضع الافتراضي:
  - `Set-PSReadLineOption -EditMode Windows`

> ملاحظة: هذا ليس خطأ في الكود نفسه؛ هو إدخال نص غير مقصود في الطرفية.

## 2) شاشة بيضاء أو انهيار الواجهة (React)

**ما الذي تفعله النسخة الحالية؟**
- النظام يلتقط أخطاء React وأخطاء `window` و`unhandledrejection` ويعرض شاشة انهيار مع أدوات نسخ/تصدير تقرير.

**ما الذي ترسله للدعم؟**
- افتح الإعدادات → تبويب **التشخيص** ثم:
  - استخدم **تصدير ملف** لإخراج تقرير JSON
  - أو **نسخ التقرير** لإرسال التقرير كنص

> انتبه: تقرير التشخيص قد يحتوي معلومات بيئية (UserAgent/URL) وأجزاء من Stack Trace.

## 3) خطأ better-sqlite3: not a valid Win32 application (Desktop)

**الأعراض**
- عند تشغيل `npm run desktop:dev` يظهر خطأ من Electron/IPC مثل:
  - `better_sqlite3.node is not a valid Win32 application`

**السبب الشائع**
- ملف الـ native addon الخاص بـ `better-sqlite3` تم بناؤه لـ Node.js وليس لـ Electron (اختلاف ABI)، أو تم بناؤه لمعمارية مختلفة.

**الحل**
1. أعد بناء الـ native module لـ Electron:
  - `npx @electron/rebuild -f -w better-sqlite3`
2. ثم أعد تشغيل الديسكتوب:
  - `npm run desktop:dev`
