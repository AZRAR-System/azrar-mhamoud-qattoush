# Enterprise Printing (Main Process)

هذا المجلد هو مكان نظام الطباعة الاحترافي (حسب خطة 11 مرحلة).

- كل منطق الطباعة يجب أن يكون هنا داخل `electron/` (main process).
- واجهة المستخدم (renderer) ممنوع تحتوي منطق طباعة؛ فقط تستدعي IPC.

## المرحلة 1

- `printEngine.ts`: نقطة دخول موحّدة للطباعة (PrintEngine).
- `types.ts`: أنواع الطلبات والنتائج.

> سيتم توسيع هذا المجلد في المراحل القادمة لإضافة نظام DOCX والترويسة/الذيل والإعدادات والمعاينة.

## المرحلة 2

- `docx/`: توليد ملفات DOCX من قوالب قابلة للتحرير (docxtemplater + pizzip).

## المرحلة 3

- `headerFooter/`: محرك الترويسة/الذيل + Injector لدمجها داخل DOCX.

## المرحلة 4

- `settings/`: ملف إعدادات طباعة مستقل `print.settings.json` داخل userData مع Loader/Saver (IPC-only).

## المرحلة 5

- `generation/`: API موحّد `generateDocument({templateName,data,outputType})` يُنتج ملفات مؤقتة آمنة داخل userData/printing/tmp.

## المرحلة 6

- `pdf/`: تحويل DOCX → PDF (حاليًا عبر LibreOffice/soffice إذا كان متوفرًا أو تم تحديد مساره في الإعدادات).

## المرحلة 7

- `preview/`: نافذة معاينة داخل Electron تعرض PDF مؤقت مع أزرار (طباعة/تصدير Word/تصدير PDF) عبر IPC فقط.

## المرحلة 8

- داخل `preview/`: دعم الطباعة المباشرة عبر Electron API مع اختيار الطابعة (deviceName) وخيار الطباعة الصامتة (غير افتراضيًا).
