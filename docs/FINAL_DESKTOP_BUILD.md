# التطبيق النهائي (Windows Desktop) + أيقونة تشغيل سريع

هذا المشروع يدعم إخراج تطبيق Windows Desktop (Electron) مستقل بقاعدة SQLite محلية.

## 1) تجهيز المتطلبات
- Node.js 18+
- npm

## 2) بناء وإخراج الـ Installer
من داخل مجلد المشروع شغّل:
- `npm install`
- `npm run desktop:dist`

أو (نفس الأمر لكن باسم أوضح للاستخدام المتكرر بعد أي تعديل):
- `npm run desktop:release`

النتيجة ستظهر داخل مجلد:
- `release/`

وسيتم إنشاء Installer (NSIS) يقوم بإنشاء:
- اختصار على سطح المكتب
- اختصار في Start Menu

## 3) تشغيل التطبيق بشكل مستقل (بدون سيرفر)
- استخدم: [start-standalone.ps1](start-standalone.ps1) أو [start-standalone.bat](start-standalone.bat)

## 4) مزامنة البيانات عبر OneDrive (اختياري)
راجع: [docs/STANDALONE_DESKTOP.md](docs/STANDALONE_DESKTOP.md)

تنبيه مهم:
- لا تشغّل نفس قاعدة البيانات على جهازين بنفس الوقت.
