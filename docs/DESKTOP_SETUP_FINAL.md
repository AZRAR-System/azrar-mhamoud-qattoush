# سيت أب الديسكتوب (نسخة نهائية) — Windows Desktop (Electron)

هذا الدليل هو المرجع المختصر لتشغيل وبناء نسخة **Desktop** من النظام (Electron + Vite + React + TypeScript).

## 1) المتطلبات
- Windows 10/11
- Node.js **18+** (يفضّل LTS)
- npm

> ملاحظة: البناء (Installer) يحتاج تحميل/تنزيل حزم Electron أثناء التنفيذ، فتأكد من اتصال إنترنت أثناء أول Build.

## 2) تثبيت وتشغيل أثناء التطوير
من داخل مجلد المشروع:
- `npm install`
- `npm run desktop:dev`

هذا يشغل:
- Vite على `http://localhost:3000`
- Electron ويفتح التطبيق

## 3) التحقق قبل الإخراج (موصى به)
- `npm run verify`
- `npm test`
- `npm run lint`

## 4) بناء وتشغيل محلي (بدون Installer)
- `npm run desktop:run`

## 5) إخراج نسخة التثبيت (Installer)
الأمر القياسي:
- `npm run desktop:dist`

مخرجات الإخراج تكون عادة داخل:
- `release2_build/`

بدائل مفيدة:
- `npm run desktop:dist:skipWU` (يتجاوز إنشاء win-unpacked إذا كان يسبب بطء/مشاكل)
- `npm run desktop:dist:nobump` (يبني بدون bump للنسخة)

### التوقيع الرقمي (اختياري)
إن كان لديك شهادة توقيع:
- `npm run desktop:dist:signed`

إذا ظهر تحذير قفل ملفات عند نسخ `win-unpacked` (غير مؤثر على المُثبّت)، استخدم:
- `npm run desktop:dist:signed:skipWU:nobump`

> ملاحظة مهمة: في حال استخدام شهادة **Self-Signed (dev/internal)** سيتم إنشاء مُثبّت “موقّع” ولكن قد يظهر للمستخدمين كـ **Unknown publisher** لأن سلسلة الشهادة ليست موثوقة افتراضياً على Windows.

#### جعل شهادة dev موثوقة داخل الشركة (اختياري)
إذا كنت تريد أن يظهر التوقيع كـ **Trusted publisher** على أجهزة الموظفين، ثبّت شهادة التوقيع (Public .cer) في مخازن الثقة على نفس الأجهزة:

- تثبيت للمستخدم الحالي (بدون صلاحيات Admin عادة):
	- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-codesign-trust.ps1 -CertThumbprint "<THUMBPRINT>" -Scope CurrentUser`

- تثبيت على الجهاز بالكامل (يتطلب Admin):
	- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-codesign-trust.ps1 -CertThumbprint "<THUMBPRINT>" -Scope LocalMachine`

وللنشر المؤسسي، وزّع ملف `.cer` عبر Group Policy (GPO) إلى:
- Trusted Root Certification Authorities
- Trusted Publishers

راجع الدليل الكامل:
- [docs/CODE_SIGNING_INTERNAL_TRUST.md](CODE_SIGNING_INTERNAL_TRUST.md)

## 6) تشغيل Standalone (بدون سيرفر)
- PowerShell: `./start-standalone.ps1`
- Batch: `start-standalone.bat`

## 7) مسار قاعدة البيانات (مهم عند تعدد النسخ/OneDrive)
الـ Desktop يدعم متغيرات بيئة لاختيار مكان SQLite:
- `AZRAR_DESKTOP_DB_PATH` (مُفضّل): مسار كامل لملف `khaberni.sqlite`
- أو `AZRAR_DESKTOP_DB_DIR`: مجلد يوضع بداخله `khaberni.sqlite`

ولحالات OneDrive يفضّل:
- `AZRAR_DESKTOP_JOURNAL_MODE=DELETE`

راجع التفاصيل والأمثلة في:
- [docs/STANDALONE_DESKTOP.md](STANDALONE_DESKTOP.md)

## 8) ملاحظة سلامة مهمة
- لا تشغّل نفس ملف قاعدة البيانات على جهازين بنفس الوقت (خصوصاً مع OneDrive) لتجنب تضارب/فساد الملفات.
