# تطبيق مستقل خارج الشبكة (Standalone Desktop)

إذا كان الجهاز الآخر **خارج الشبكة** (ليس على نفس LAN)، فالأبسط هو استخدام نسخة **Desktop/Electron** على ذلك الجهاز.

- هذا يعمل **بدون سيرفر مركزي**
- كل جهاز لديه **قاعدة بيانات SQLite محلية** خاصة به
- لا يوجد “مشاركة تلقائية” بين الأجهزة خارج الشبكة إلا إذا استخدمت حل مثل VPN/سيرفر إنترنت (اختياري)

## التشغيل

### Development (للتجربة)
- `npm run desktop:dev`

### Standalone Run (يبني ثم يشغل)
- PowerShell: `./start-standalone.ps1`
- Batch: `start-standalone.bat`

## نقل البيانات بين جهازين (يدوياً)
استخدم صفحة **Database Manager** داخل التطبيق:
- Export (تصدير JSON)
- Import (استيراد JSON)

هذا يسمح لك بنقل نسخة من البيانات إلى جهاز آخر بدون شبكة.

## المزامنة عبر OneDrive (موجودة عندك)
نعم، ممكن تعمل مزامنة للبيانات عبر OneDrive بوضع ملف قاعدة البيانات داخل مجلد OneDrive.

مهم جداً:
- لا تشغّل التطبيق على جهازين بنفس الوقت على نفس قاعدة البيانات (خطر تضارب/فساد ملفات).
- يفضّل إغلاق التطبيق وانتظار OneDrive حتى يكمّل الرفع قبل فتحه على جهاز آخر.

### كيف تحدد مكان قاعدة البيانات
Desktop يدعم متغيرات بيئة اختيارية:
- `AZRAR_DESKTOP_DB_PATH` = المسار الكامل لملف SQLite
- أو `AZRAR_DESKTOP_DB_DIR` = مجلد يوضع بداخله `khaberni.sqlite`

ولأجل OneDrive، يفضّل أيضاً:
- `AZRAR_DESKTOP_JOURNAL_MODE=DELETE`

مثال (مسار OneDrive):
- `AZRAR_DESKTOP_DB_DIR=C:\Users\<YOU>\OneDrive\AZRAR-Data`
- `AZRAR_DESKTOP_JOURNAL_MODE=DELETE`
