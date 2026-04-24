# دليل المطور الشامل لنظام أزرار (AZRAR Developer Guide)

هذا المستند مصمم لتعريف المطورين بهيكلية نظام **أزرار (AZRAR)**، وكيفية التعامل مع الكود، وتدفق البيانات، والأنماط البرمجية المستخدمة.

---

## 1. الهيكل المعماري (System Architecture)

النظام مبني باستخدام **Electron**، وينقسم إلى طبقتين رئيسيتين:

### أ. طبقة الواجهة (Renderer Process - `src/`)
- مبنية باستخدام **React** و **TypeScript**.
- تعتمد على **TailwindCSS** للتنسيق.
- تتواصل مع النظام عبر **IPC (Inter-Process Communication)** من خلال جسر (Bridge) آمن.

### ب. طبقة النظام (Main Process - `electron/`)
- تدير العمليات الأساسية مثل الوصول لقاعدة البيانات، النظام المالي، والمزامنة.
- تحتوي على معالجات IPC (Handlers) التي تستقبل الطلبات من الواجهة وتنفذها.
- تدير دورة حياة التطبيق والنوافذ.

---

## 2. هيكلية المجلدات (Directory Structure)

```text
/
├── electron/               # كود الـ Main Process (Node.js/Electron)
│   ├── db/                 # منطق الوصول لقاعدة البيانات المحلية (SQLite)
│   ├── ipc/                # معالجات الرسائل (IPC Handlers) - قلب النظام
│   ├── security/           # نظام التراخيص والتحقق من الهوية
│   └── printing/           # محركات طباعة التقارير وتوليد ملفات Word/PDF
├── src/                    # كود الـ Renderer Process (React)
│   ├── components/         # المكونات القابلة لإعادة الاستخدام (UI Library)
│   ├── pages/              # صفحات التطبيق والواجهات الرئيسية
│   ├── services/           # واجهات التواصل مع IPC (API Wrappers)
│   ├── store/              # إدارة الحالة (State Management)
│   └── types/              # تعريفات TypeScript الموحدة للمشروع
├── tests/                  # الاختبارات الشاملة (Unit & Integration)
│   └── unit/               # اختبارات المنطق المالي والخدمات
├── package.json            # الاعتمادات وأوامر التشغيل
└── vite.config.ts          # إعدادات بناء الواجهة
```

---

## 3. تدفق البيانات (Data Flow & IPC Pattern)

لا تتواصل الواجهة مع قاعدة البيانات مباشرة. يتم الأمر كالتالي:
1. المكون (Component) يستدعي دالة من `src/services/`.
2. الخدمة تستخدم `window.electron.ipcRenderer.invoke`.
3. الـ Main Process يستقبل الطلب في `electron/ipc/`.
4. يتم تنفيذ العملية (DB, File System, etc) وإرجاع النتيجة.

**مثال:**
```typescript
// في الواجهة (Renderer)
const result = await peopleService.getPersonDetails(id);

// في النظام (Main)
ipcMain.handle('people:getDetails', async (event, id) => {
  return await db.getPersonById(id);
});
```

---

## 4. نظام المزامنة (SQL Sync Engine)

يعتبر من أهم أجزاء النظام، حيث يدعم:
- **Master/Client Mode:** يمكن للجهاز أن يعمل كمزود بيانات أو كعميل.
- **Delta Sync:** يتم رفع وتحميل التغييرات فقط بناءً على طابع زمني (Timestamp).
- **Conflict Resolution:** يعتمد النظام على منطق "Last Write Wins" مع تتبع الحذف (Soft Delete).

---

## 5. الاختبارات والجودة (Testing & QA)

يلتزم المشروع بمعايير عالية للجودة:
- **Jest:** هو المحرك الأساسي للاختبارات.
- **Coverage:** نستهدف تغطية أكثر من 80% للملفات الحساسة (المالية، العقود، التراخيص).
- **TypeScript:** استخدام صارم للأنواع (Strict Typing) لتقليل أخطاء وقت التشغيل.

أوامر هامة للمطور:
- `npm run dev`: تشغيل بيئة التطوير.
- `npm run test`: تشغيل كافة الاختبارات.
- `npm run test:coverage`: توليد تقرير التغطية.
- `npm run typecheck`: التأكد من سلامة الأنواع في المشروع كامل.

---

## 6. نظام التراخيص (Licensing System)

يعتمد النظام على **Digital Signatures (Ed25519)**:
1. يتم توليد بصمة فريدة للجهاز (Hardware ID).
2. يتم توقيع ملف الترخيص بمفتاح خاص (Private Key) لدى الإدارة.
3. يقوم التطبيق بالتحقق من التوقيع باستخدام المفتاح العام (Public Key) المدمج.

---

## 7. التقارير والطباعة (Printing & Reporting)

يستخدم النظام محركات متعددة:
- **Docxtemplater:** لتوليد عقود Word بناءً على قوالب.
- **Puppeteer/Electron Print:** لتحويل صفحات HTML إلى تقارير PDF احترافية.

---
*هذا الدليل هو المرجع التقني الأول لأي مطور ينضم لفريق أزرار.*
