# خطة حماية تطبيق AZRAR (Electron + Installer)

> هذا الملف مرجع إلزامي للعمل على الحماية. أي تغيير يخص: التثبيت، التوقيع، التفعيل، HWID، التحديثات، أو تشفير البيانات يجب أن يلتزم بما هنا ولا يضيف منطق ترخيص داخل الـ Renderer.

## الأهداف
- **توقيع** ملفات التثبيت/التحديثات وإظهار اسم الناشر الرسمي.
- **تثبيت في مسار محمي** (Program Files على Windows) مع صلاحيات مناسبة.
- **عرض الأحكام وسياسة الخصوصية داخل الـ Installer** مع شرط الموافقة.
- **ربط الترخيص ببصمة جهاز** (HWID/Fingerprint) وتحقق عند كل تشغيل.
- **دعم Trial** عبر رخصة موقّعة بميزات محددة ومدة.
- **تعطيل التحديثات لغير المفعّل** وربط الـ feed بحالة الترخيص.
- **حماية بيانات محلية** (خيار SQLCipher أو بدائل مرحلية) + فحص سلامة ملفات حرجة.

## مبادئ إلزامية
- لا يُوضع أي منطق ترخيص/تفعيل/مفاتيح داخل الواجهة `src/`.
  - المسموح في `src/`: UI فقط + استدعاء IPC عبر preload.
  - المنطق الحساس يكون في `electron/` (Main Process) فقط.
- لا يتم الاعتماد على "منع النسخ 100%" (غير واقعي)، بل على:
  - HWID + ترخيص موقّع + فحص سلامة + سياسة تفعيل.

## نطاق التنفيذ (MVP → مراحل)
### المرحلة 1 (Installer + أساسيات)
- إضافة شاشة "الأحكام وسياسة الخصوصية" داخل NSIS.
- فرض التثبيت per-machine في مسار محمي.

**الحالة (Feb 2026): مكتملة ✅**
- تم تفعيل صفحة اتفاقية الترخيص داخل المثبّت، وتم التأكيد يدويًا أن العربية تظهر بشكل صحيح في آخر نسخة.
- تم فرض التثبيت per-machine (Program Files) ومنع تغيير مسار التثبيت.
- تم تجهيز مسار توقيع تطوير (Dev self-signed) يعمل محليًا: بناء المثبّت ثم توقيع ملف الـ EXE النهائي بـ `signtool` (بدون الاعتماد على توقيع electron-builder لتجنّب مشاكل صلاحيات symlink على بعض أجهزة ويندوز).

### المرحلة 2 (License في Main + بصمة جهاز)
- نقل التحقق من الرخصة من `src/services/*` إلى `electron/`.
- إضافة بصمة جهاز متعددة الأنظمة وتخزين محلي مشفّر باستخدام `safeStorage`.

**الحالة (Feb 2026): مكتملة ✅**
- تم حذف منطق التحقق/المفاتيح من `src/` بالكامل.
- واجهة `src/` أصبحت UI فقط وتستدعي `window.desktopLicense.*` عبر preload (IPC) للحالة والتفعيل (ملف تفعيل/Online).
- تم إزالة مسار “التفعيل بالكود” من الواجهة.

### المرحلة 3 (تفعيل Online + تعطيل عن بُعد)
- إضافة endpoints على السيرفر لحالة الترخيص وتعطيله.
- تطبيق Online check دوري مع TTL وOffline fallback.

**الحالة (Feb 2026): حسب جاهزية السيرفر ⚠️**
- منطق الـ TTL وoffline fallback ومنع العبث بالوقت موجود من جهة التطبيق.
- تم توفير سيرفر ترخيص بسيط للتجربة/البيئات الداخلية في: `server/license-server.mjs`.

#### سياسة الـ API (المتوقع من السيرفر)
- `POST /api/license/activate` body: `{ licenseKey, deviceId }`
  - نجاح: `{ ok:true, time:<ISO>, signedLicense:<SignedLicenseFileV1> }`
  - فشل: `{ ok:false, time:<ISO>?, error: suspended|revoked|expired|requires_new_activation|invalid_license }`
- `POST /api/license/status` body: `{ licenseKey, deviceId }`
  - نجاح: `{ ok:true, time:<ISO>, status: active|suspended|revoked|expired|mismatch|invalid_license|unknown }`
  - فشل: `{ ok:false, time:<ISO>?, error: invalid_license|... }`

#### إعدادات Online TTL (Desktop)
- رابط السيرفر: `AZRAR_LICENSE_SERVER_URL`
- TTL (بالساعات): `AZRAR_LICENSE_ONLINE_TTL_HOURS` (الافتراضي: 24)
- فترة التحقق الدورية (بالدقائق): `AZRAR_LICENSE_ONLINE_CHECK_INTERVAL_MINUTES` (الافتراضي: 60)
- تعطيل المراقبة الدورية (تشخيص فقط): `AZRAR_LICENSE_DISABLE_MONITOR=1`

#### تشغيل سيرفر الترخيص محليًا (Dev)
- توليد مفاتيح Dev (يُنشئ مفتاح خاص داخل `secrets/` + يحدّث المفتاح العام داخل `electron/assets/`):
  - `node scripts/generate-license-keys.mjs`
- تشغيل السيرفر (مع توليد مفاتيح تلقائيًا إذا لم تكن موجودة):
  - `powershell -ExecutionPolicy Bypass -File scripts/license-server-dev.ps1`
- إصدار مفتاح ترخيص للاختبار:
  - `powershell -ExecutionPolicy Bypass -File scripts/license-server-issue.ps1`

#### إعدادات منع التلاعب بالوقت (Anti-date-tamper)
- سماحية انحراف الساعة (بالميلي ثانية): `AZRAR_CLOCK_SKEW_ALLOW_MS` (الافتراضي: 5 دقائق)
- تجاوز الفحص (دعم/تشخيص فقط): `AZRAR_ALLOW_CLOCK_ROLLBACK=1`

### المرحلة 4 (التحديثات + تشفير البيانات)
- ربط updater feed بحالة الترخيص.
- **فرض Feature flags على التحديثات**: إذا كانت الرخصة تحتوي `features` غير فارغة، يلزم `features.updates=true`.
- ملاحظة: مسار **استرجاع ما بعد التحديث** (pending restore) يُعامل كمسار حماية بيانات (Recovery) ولا يتم حجبه بميزة `updates` لتجنب تعطّل استرجاع البيانات إذا انتهت الرخصة بعد التحديث.
- تقييم SQLCipher/تشفير فعلي لملف SQLite أو تشفير حقول حساسة كحل مرحلي.
- إضافة Integrity manifest + فحص سلامة ملفات حرجة داخل Main.

**الحالة (Feb 2026): منفّذة جزئيًا ⚠️**
- يوجد Integrity manifest + فحص سلامة داخل الـ Main (ينفذ على نسخ packaged فقط) مع خيار تجاوز دعم: `AZRAR_ALLOW_TAMPERED_APP=1`.
- يوجد تكامل updater داخل الـ Main/IPC، ويبقى التأكد النهائي من ربطه بشكل صارم بحالة الترخيص على سيناريوهات الإنتاج.
- تشفير قاعدة البيانات (SQLCipher) موجود كخيار، لكن يحتاج قرار تشغيل/مفتاح/مسار migration وتجارب ميدانية.

#### Feature Flags (Trial / Editions)
- صيغة الميزات داخل الرخصة: `features: Record<string, boolean>`.
- سلوك التوافق للخلف:
  - إذا كانت `features` غير موجودة أو فارغة → تُعامل كرخصة كاملة (كل الميزات مسموحة).
  - إذا كانت `features` موجودة وبها مفاتيح → يتم السماح فقط بالميزات المفعّلة `true`.
- أمثلة وأسماء الميزات المطبقة حاليًا داخل Main/IPC:
  - `features.updates=true` للسماح بالتحديثات.
  - `features.backups=true` للسماح بالنسخ الاحتياطي (تصدير/استيراد/تشغيل النسخ الآن/تشفير النسخ).
  - `features.attachments=true` للسماح بعمليات المرفقات (حفظ/قراءة/فتح/حذف/تنزيل).
  - `features.templates=true` للسماح بعمليات قوالب Word (عرض/استيراد/قراءة/حذف).
  - `features.sql=true` للسماح بمزامنة SQL Server وعمليات النسخ الاحتياطي/التهيئة المرتبطة بها.

#### إعدادات Obfuscation (Electron Bundles)
- لتفعيل Obfuscation/Minify لملفات Electron المجمّعة أثناء البناء: `AZRAR_OBFUSCATE_ELECTRON=1`
- لتعطيلها (تشخيص/تصحيح مشاكل البناء): `AZRAR_OBFUSCATE_ELECTRON=0`

#### إعدادات تشفير قاعدة البيانات (SQLCipher)
- لتفعيل التشفير: `AZRAR_DB_ENCRYPTION=sqlcipher`
- لتشفير قاعدة بيانات موجودة (مرة واحدة فقط): `AZRAR_DB_ENCRYPTION_MIGRATE=1`
  - ملاحظة: إذا كانت القاعدة أصلاً مشفّرة بمفتاح مختلف أو تالفة، سيظهر خطأ.
- مفتاح التشفير:
  - افتراضيًا يتم توليد مفتاح عشوائي وتخزينه بشكل مشفّر عبر `safeStorage` داخل `userData`.
  - بديل دعم/سيرفر: `AZRAR_DB_CIPHER_KEY=<secret>`

#### إعدادات فحص السلامة (Integrity)
- يتم فحص ملفات حرجة في الإنتاج فقط (Packaged) بناءً على manifest يتم توليده أثناء البناء.
- لتجاوز الفحص (تشخيص/دعم فقط): `AZRAR_ALLOW_TAMPERED_APP=1`

## ملفات/أماكن يجب مراجعتها عند أي تعديل
- Installer/Builder: [electron-builder.config.cjs](../electron-builder.config.cjs)، [build/installer.nsh](../build/installer.nsh)
- Main/IPC: `electron/main.ts`, `electron/ipc.ts`, `electron/preload.ts`
- Types: `src/types/electron.types.ts`
- UI تفعيل (Renderer): `src/services/activation.ts`, `src/context/ActivationContext.tsx`, `src/pages/Activation.tsx`

## قرارات حالية (Feb 2026)
- الأنظمة: Windows + macOS + Linux
- التوقيع: غير متوفر حاليًا (يتم تجهيز hooks دون مفاتيح)
- التفعيل: Online + Offline fallback
- Trial: عبر Feature flags ضمن رخصة موقّعة

## أين وصلنا الآن (مختصر)
- المرحلة 1: مكتملة ✅
- المرحلة 2: مكتملة ✅
- المرحلة 3: يتطلب جاهزية/تثبيت سياسة السيرفر ⚠️
- المرحلة 4: Integrity موجود؛ التحديثات/التشفير بحاجة ضبط إنتاجي وتجارب ⚠️
