# 🧭 خطة تحسين وتطوير شاملة — AZRAR Desktop (2026)

<div dir="rtl">

**آخر تحديث:** 2026-02-10  
**النطاق:** تحسينات هندسية + جودة + أمان + قابلية تشغيل + تجربة تطوير (بدون تغيير متطلبات UX الأساسية إلا عبر قرارات واضحة).  

> هذه الوثيقة هي “خارطة طريق” تنفيذية. للمبادئ والقيود الأساسية راجع: [SESSION_MASTER_REFERENCE.md](SESSION_MASTER_REFERENCE.md)

**مخرجات تنفيذية (Runbooks/Checklists):**
- تشغيل المطور (موحّد): [DEV_RUNBOOK.md](DEV_RUNBOOK.md)
- قائمة فحوصات الإصدار: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)

---

## 1) الأهداف العامة (Outcomes)

- **استقرار أعلى:** تقليل أعطال التشغيل/التحديث/الطباعة، وتحسين قابلية الاسترجاع عند الفشل.
- **أمان أقوى:** تقليل سطح الهجوم في Electron، وتحسين إدارة الأسرار/المفاتيح، وضبط التحديثات الآمنة.
- **جودة قابلة للقياس:** رفع تغطية الاختبارات للمسارات الحساسة (IPC/DB/Printing/Licensing).
- **سرعة تطوير أفضل:** تقليل وقت الإعداد للمطور، وإزالة الأعمال اليدوية المتكررة.
- **جاهزية إصدار محسّنة:** بناء/توقيع/إصدار أكثر اتساقًا، مع فحوصات قبل الإصدار.

**مقاييس نجاح مقترحة (KPIs):**
- `npm run verify` ينجح دائمًا على جهاز نظيف بعد `npm install`.
- تقليل تكرار مشاكل native module (better-sqlite3) عبر مسار إصلاح موحد.
- تقليل أخطاء الطباعة/التوليد (DOCX/PDF/Excel) ورفع نسبة نجاحها في QA.
- صفر تحذيرات أمنية حرجة غير مُعالجة في التبعيات (مع سياسة قبول/استثناء موثقة).

---

## 2) القيود غير القابلة للتفاوض (Constraints)

- **Desktop-only:** لا تعتمد الخطة على Backend إلزامي لعمل النظام الأساسي.
- **عزل Electron:** لا استدعاء Node/Electron APIs من `src/`؛ فقط عبر preload bridge.
- **أمان Electron:** `contextIsolation` و`nodeIntegration:false` وCSP تُحافظ عليها.
- **Windows-first:** مع الحفاظ على قابلية التشغيل قدر الإمكان.

---

## 3) تنظيم العمل (Workstreams)

### A) الاستقرار + الصيانة التشغيلية (Stability & Operability)
**هدف:** جعل الفشل “قابلًا للتشخيص” قبل أن يكون قابلًا للإصلاح.
- توحيد سجلات التشغيل (Main/Renderer/Updater/DB) مع Correlation Id.
- تحسين رسائل الأخطاء في المسارات الشائعة: DB open, IPC invoke, Printing pipeline, Updater.
- إضافة “فحوصات صحة” قصيرة في وضع التطوير (اختياري عبر scripts) بدل التشخيص اليدوي.

مراجع مفيدة:
- [SYSTEM_STATUS_REPORT_2026-01-01.md](SYSTEM_STATUS_REPORT_2026-01-01.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

### B) جودة واختبارات (Quality & Testing)
**هدف:** تثبيت السلوك عند التطوير السريع.
- توسيع اختبارات Jest للمناطق الحساسة (خاصة helpers والمنطق غير المرئي UI).
- تقوية اختبار `desktop:e2e` ليغطي: بدء التشغيل، DB init، تشغيل autorun، وإغلاق نظيف.
- إضافة اختبار واحد على الأقل لكل: IPC contract, migrations/kv invariants, print template rendering.

مراجع مفيدة:
- [PRINTING_QA_CHECKLIST_AR.md](PRINTING_QA_CHECKLIST_AR.md)

### C) الأمان والخصوصية (Security & Privacy)
**هدف:** أمان دفاعي + إدارة أسرار عملية.
- استبدال أي placeholders غير حقيقية في سياسة الأمن (بريد/PGP/روابط) أو توضيح أنها داخلية.
- تقوية مسار التحديث: التحقق من المصدر/الملفات/التوقيع + التعامل الآمن مع rollback.
- تقليل الاعتماد على مكتبات عليها تحذيرات عالية إن كانت ضمن مسارات حرجة.

مراجع مفيدة:
- [SECURITY.md](../SECURITY.md)
- [SECURITY_AUDIT.md](../SECURITY_AUDIT.md)
- [PROTECTION_PLAN.md](PROTECTION_PLAN.md)

### D) البيانات + الأداء (Data & Performance)
**هدف:** بيانات صحيحة وأداء ثابت حتى مع نمو الحجم.
- تثبيت invariants في KV (tombstones، حذف/إلغاء حذف، الاتساق بعد crash).
- تحسين caching والاسترجاع incremental بدل إعادة تحميل كاملة عندما يلزم.
- فحص فهرسة/استعلامات تقارير/لوحات التحكم عند نمو البيانات.

مراجع مفيدة:
- [FINAL_DB_AUDIT_REPORT.md](../FINAL_DB_AUDIT_REPORT.md)
- [DATA_VALIDATION_GUIDE.md](DATA_VALIDATION_GUIDE.md)

### E) الطباعة والمستندات (Printing & Documents)
**هدف:** مخرجات صحيحة وتوافق أعلى مع أجهزة/تعريفات مختلفة.
- توحيد طبقة “محرك الطباعة” وتوثيق نقاط الفشل (DOCX→PDF، إعدادات هوامش، اتجاه RTL).
- تعزيز QA للطباعة عبر سيناريوهات واقعية (قوالب، خطوط عربية، أرقام لاتينية).
- تنظيف/تقليل التباين بين القوالب والمتغيرات (خاصة العقود).

مراجع مفيدة:
- [ENTERPRISE_PRINTING_SYSTEM_PLAN_AR.md](ENTERPRISE_PRINTING_SYSTEM_PLAN_AR.md)
- [PRINTING_QA_CHECKLIST_AR.md](PRINTING_QA_CHECKLIST_AR.md)

### F) التراخيص والتوزيع (Licensing & Distribution)
**هدف:** تقليل التعقيد عند التشغيل مع السيرفر الترخيصي + تسهيل إصدار نسخة Standalone.
- توثيق رسمي لمسارات التشغيل الثلاثة: Dev، Run With License، Standalone.
- اختبار “انقطاع سيرفر الترخيص” وسلوك التطبيق عند reconnect.
- تسهيل بناء/إصدار license-admin وlicensegen مع قوالب إصدار موحدة.

مراجع مفيدة:
- [LICENSE_ACTIVATION.md](LICENSE_ACTIVATION.md)
- [STANDALONE_DESKTOP.md](STANDALONE_DESKTOP.md)

---

## 4) الخطة الزمنية المقترحة (Now / Next / Later)

> التقديرات أدناه مرنة، ويمكن تحويلها إلى سبرنتات أسبوعية.

### NOW (أسبوع 1–2) — “ثبات الأساس”
- **تنظيف وثائق التطوير/الأمان:**
  - استبدال روابط `your-username`/روابط غير صحيحة في المستندات المهمة. ✅
  - توحيد مسارات التشغيل الموثوقة (desktop:dev / verify / desktop:e2e) في وثيقة واحدة. ✅ (انظر: DEV_RUNBOOK)
- **أمان عمليات التنظيف المحلي:**
  - اعتماد طريقة حذف آمنة تعتمد على git (مثل `git clean -fdX`) بدل حذف يدوي واسع. ✅
  - إضافة تحذير واضح في التوثيق: لا يتم حذف ملفات tracked عبر تنظيفات محلية. ✅
- **قفل جودة قبل أي إصدار:**
  - شرط نجاح: `npm run verify` + `npm test` + `npm run lint`. ✅

Deliverables:
- وثيقة “تشغيل + بناء + إصلاح native module” محدثة. ✅ ([DEV_RUNBOOK.md](DEV_RUNBOOK.md))
- قائمة فحوصات Release صغيرة. ✅ ([RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md))

### NEXT (أسبوع 3–6) — “تحسينات ذات عائد عالي”
- **تحسين مسار الطباعة:** تقارير عن أكثر 3 أسباب فشل + إصلاحات.
- **تحسين مسار DB:** اختبارات invariants للـ KV + تحسين في recovery.
- **تحديثات Electron:** مراجعة مسار updater والتحقق وLogging.

Deliverables:
- 10–20 اختبار إضافي للمناطق الحساسة.
- QA checklist للطباعة يصبح قابل للتنفيذ خطوة بخطوة.

### LATER (أسبوع 7–12) — “تقوية المنظومة”
- **تقليل الاعتماد على مكتبات حرجة عالية المخاطر** (إذا كانت موجودة في مسارات إنتاجية).
- **تحسين الأداء مع البيانات الكبيرة:** Profiling على Views الثقيلة + تحسينات.
- **تحسين عملية الإصدار:** توحيد artifacts وتسمية الإصدارات وتسجيل التغييرات.

Deliverables:
- تقرير أداء (baseline vs after).
- تحسينات إصدار وDeploy محدثة.

---

## 5) قائمة أعمال قابلة للتنفيذ (Action List)

### 5.1 أولوية P0 (لازم الآن)
- تحديث الروابط/الـ placeholders في المستندات الأساسية.
- توثيق “طريقة التنظيف الآمن” بوضوح (لتجنب حذف غير مقصود).
- توحيد نقطة الدخول للمطور: تشغيل/إيقاف/تحقق.

### 5.2 أولوية P1 (قريبًا)
- تحسين الطباعة (أكثر مصدر شكاوى عادةً).
- اختبارات IPC + DB invariants.
- تثبيت منهجية تتبع أخطاء (logs قابلة للمشاركة بدون أسرار).

### 5.3 أولوية P2 (لاحقًا)
- تحسينات أداء تدريجية.
- إعادة هيكلة خفيفة للموديولات الكبيرة عند الحاجة.

---

## 6) المخاطر وكيف نقللها (Risks & Mitigations)

- **قفل ملفات Windows (app.asar/release outputs):**
  - Mitigation: إغلاق Electron/Explorer قبل الحذف، أو الحذف بعد إعادة تشغيل.
- **Native modules (better-sqlite3) تكسر بعد تحديث Electron/Node:**
  - Mitigation: الالتزام بـ `native:ensure:electron` كمسار رسمي وإضافة توثيق واضح.
- **إدخال تغييرات تمس الأمان (bridge/IPC):**
  - Mitigation: مراجعة peer + اختبارات contract + توثيق.

---

## 7) مخرجات مطلوبة لمراجعة أسبوعية (Weekly Review)

- ما الذي تم؟ (changes + links)
- ما الذي انكسر؟ وكيف سنمنع تكراره؟
- هل `verify` ما زال ينجح على جهاز نظيف؟
- هل الطباعة/التراخيص/DB تحسنت قياسيًا؟

</div>
