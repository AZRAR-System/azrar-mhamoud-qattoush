# 🏢 AZRAR - نظام إدارة العقارات المتقدم

<div dir="rtl">

[![Version](https://img.shields.io/badge/version-2.0.109-blue.svg)](https://github.com/your-username/azrar-desktop)
[![Electron](https://img.shields.io/badge/Electron-33.2.1-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.2.1-61DAFB.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6.svg)](https://www.typescriptlang.org/)

</div>

---

## 📋 نظرة عامة

**AZRAR** هو نظام إدارة عقارات سطح المكتب متطور مبني باستخدام **Electron** و **React**. يوفر حلاً شاملاً لإدارة العقارات والمعاملات والعملاء والمستندات.

### ✨ المميزات الرئيسية

- 🏠 **إدارة العقارات:** نظام متكامل لتسجيل وتتبع العقارات
- 📊 **لوحات تحكم تفاعلية:** رسوم بيانية ومؤشرات أداء في الوقت الفعلي
- 📄 **إدارة المستندات:** إنشاء وتحرير العقود والمستندات
- 👥 **إدارة العملاء:** قاعدة بيانات شاملة للعملاء والموردين
- 🔐 **أمان متقدم:** نظام صلاحيات متعدد المستويات (RBAC)
- 🔄 **تحديثات تلقائية:** نظام تحديث سلس وآمن
- 🌐 **دعم كامل للعربية:** واجهة مستخدم عربية بالكامل
- 📱 **تصميم متجاوب:** يعمل على جميع أحجام الشاشات
- 💾 **قاعدة بيانات محلية:** SQLite لأداء سريع وموثوق
- 🗄️ **اتصال بـ SQL Server:** دعم قواعد البيانات المؤسسية

---

## 🚀 البدء السريع

### المتطلبات الأساسية

- **Node.js:** v18.0.0 أو أحدث ([تحميل](https://nodejs.org/))
- **npm:** v9.0.0 أو أحدث (يأتي مع Node.js)
- **Windows:** 10/11 (64-bit)
- **Git:** للمطورين ([تحميل](https://git-scm.com/))

### 📥 التثبيت للمستخدمين

1. **تحميل أحدث إصدار:**
   ```
   https://github.com/your-username/azrar-desktop/releases/latest
   ```

2. **تشغيل المثبت:**
   - قم بتشغيل `AZRAR Setup 2.0.109.exe`
   - اتبع التعليمات على الشاشة
   - اختر مجلد التثبيت
   - انقر "تثبيت"

3. **تشغيل التطبيق:**
   - من سطح المكتب: انقر على أيقونة AZRAR
   - من قائمة ابدأ: ابحث عن "AZRAR"

---

## 🛠️ التثبيت للمطورين

### استنساخ المشروع

```bash
# استنساخ المستودع
git clone https://github.com/your-username/azrar-desktop.git

# الدخول إلى المجلد
cd azrar-desktop

# تثبيت التبعيات
npm install
```

### تشغيل بيئة التطوير

```bash
# تشغيل في وضع التطوير
npm run desktop:dev

# أو استخدام الملف الدفعي
start-desktop.bat
```

> ملاحظة مهمة: هذا المشروع **Desktop-only**. خادم Vite يُستخدم فقط لتشغيل واجهة Electron أثناء التطوير (على المنفذ 3000).

### بناء التطبيق

```bash
# بناء للإنتاج
npm run desktop:dist

# بناء مع التوقيع الرقمي
npm run desktop:dist:signed

# بناء بدون win-unpacked (أسرع)
npm run desktop:dist:skipWU
```

### تشغيل اختبارات الديسكتوب end-to-end (Autorun)

```bash
# يشغّل Electron + autorun system tests ثم يُغلق تلقائياً
npm run desktop:e2e
```

سيتم حفظ log افتراضي في:
- `tmp/desktop-dev-tests-latest.log`

---

## 📁 بنية المشروع

```
azrar-desktop/
├── 📂 src/                    # كود React الرئيسي
│   ├── components/           # مكونات React
│   ├── pages/                # صفحات التطبيق
│   ├── hooks/                # React Hooks مخصصة
│   ├── utils/                # دوال مساعدة
│   └── styles/               # ملفات CSS/Tailwind
│
├── 📂 electron/               # كود Electron
│   ├── main.ts               # العملية الرئيسية
│   ├── preload.ts            # سكريبت Preload
│   └── ipc/                  # معالجات IPC
│
├── 📂 build/                  # ملفات البناء
│   ├── icon.png              # أيقونة التطبيق
│   └── installer.nsh         # سكريبت NSIS
│
├── 📂 scripts/                # سكريبتات الأتمتة
│   ├── desktop-dist.ps1      # سكريبت البناء
│   └── bump-desktop-version.mjs
│
├── 📂 docs/                   # التوثيق
│   ├── CODE_SIGNING.md       # دليل التوقيع الرقمي
│   └── START_HERE_UPDATED.md # ابدأ من هنا
│
├── 📂 release2_build/         # مخرجات البناء
│   └── AZRAR Setup.exe       # المثبت النهائي
│
├── 📄 package.json            # تبعيات المشروع
├── 📄 electron-builder.config.js  # إعدادات البناء
├── 📄 tsconfig.json           # إعدادات TypeScript
├── 📄 vite.config.ts          # إعدادات Vite
└── 📄 README.md               # هذا الملف
```

---

## 🔧 السكريبتات المتاحة

### التطوير

| أمر | الوصف |
|-----|-------|
| `npm run desktop:dev` | تشغيل في وضع التطوير |
| `npm run desktop:e2e` | تشغيل autorun tests للديسكتوب (E2E) |
| `npm run desktop:dev+dist` | تطوير + بناء متزامن |
| `npm run desktop:build` | بناء واجهة المستخدم |

### البناء والتوزيع

| أمر | الوصف |
|-----|-------|
| `npm run desktop:dist` | بناء كامل للإنتاج |
| `npm run desktop:dist:skipWU` | بناء بدون win-unpacked |
| `npm run desktop:dist:signed` | بناء مع التوقيع |
| `npm run desktop:release` | بناء للإصدار النهائي |

### الأدوات المساعدة

| أمر | الوصف |
|-----|-------|
| `npm run desktop:version:bump` | تحديث رقم الإصدار |
| `npm run electron:build` | بناء ملفات Electron فقط |
| `npm run verify:desktop` | تحقق E2E للديسكتوب فقط |
| `npm run verify:full` | verify + verify:desktop |

---

## 🎨 التقنيات المستخدمة

### Frontend
- **React 19.2.1** - مكتبة واجهة المستخدم
- **React Router 7.10.1** - التنقل بين الصفحات
- **TailwindCSS 3.4.17** - إطار عمل CSS
- **Lucide React** - مكتبة الأيقونات
- **Recharts 3.5.1** - الرسوم البيانية

### Backend & Desktop
- **Electron 33.2.1** - إطار عمل سطح المكتب
- **Better-SQLite3 11.7.0** - قاعدة بيانات محلية
- **MSSQL 10.0.4** - اتصال SQL Server
- **Electron Updater 6.6.2** - نظام التحديثات

### Build Tools
- **Vite 6.4.1** - أداة البناء
- **TypeScript 5.8.2** - لغة البرمجة
- **Electron Builder 24.13.3** - بناء التطبيق
- **ESBuild 0.24.2** - Transpiler سريع

### مكتبات إضافية
- **Docxtemplater 3.67.6** - إنشاء ملفات Word
- **XLSX 0.18.5** - معالجة Excel
- **Mammoth 1.10.0** - قراءة Word

---

## 🔐 الأمان

### نظام الصلاحيات (RBAC)

يدعم التطبيق نظام صلاحيات متعدد المستويات:

- **مدير النظام (Admin):** صلاحيات كاملة
- **مدير (Manager):** إدارة العمليات اليومية
- **موظف (Employee):** عمليات محدودة
- **مشاهد (Viewer):** عرض فقط

### حماية البيانات

- 🔒 تشفير قاعدة البيانات المحلية
- 🔐 مصادقة المستخدم
- 🛡️ حماية من SQL Injection
- ✅ تحقق من صحة المدخلات
- 🔑 إدارة جلسات آمنة

للمزيد من التفاصيل، راجع [SECURITY.md](./SECURITY.md)

---

## 📚 التوثيق

- 🚀 [ابدأ من هنا](./docs/START_HERE_UPDATED.md)
- 🖥️ [إعداد وتشغيل الديسكتوب](./docs/DESKTOP_SETUP_FINAL.md)
- 🔐 [نظام التفعيل (License)](./docs/LICENSE_ACTIVATION.md)
- 🧯 [Troubleshooting](./docs/TROUBLESHOOTING.md)
- 🧭 [فهرس التوثيق](./docs/INDEX.md)
- ▶️ [دليل تشغيل النظام](./docs/RUN_SYSTEM_GUIDE.md)
- 🧱 [معمارية الواجهة وطبقة البيانات](./docs/UI_ARCHITECTURE_REPORT.md)
- 🧩 [التوثيق التقني](./docs/TECHNICAL_DOCUMENTATION.md)
- 🔐 [سياسة الأمان](./SECURITY.md)

---

## 🐛 الإبلاغ عن المشاكل

إذا واجهت مشكلة:

1. ابدأ من [ابدأ من هنا](./docs/START_HERE_UPDATED.md)
2. ابحث في [Issues الموجودة](https://github.com/your-username/azrar-desktop/issues)
3. افتح [Issue جديدة](https://github.com/your-username/azrar-desktop/issues/new) مع:
   - وصف المشكلة
   - خطوات إعادة الإنتاج
   - معلومات النظام
   - Screenshots (إن أمكن)

---

## 🤝 المساهمة

نرحب بالمساهمات! لكن حالياً المشروع خاص.

للمطورين الداخليين:
1. Fork المشروع
2. إنشاء branch جديد (`git checkout -b feature/AmazingFeature`)
3. Commit التغييرات (`git commit -m 'Add some AmazingFeature'`)
4. Push إلى Branch (`git push origin feature/AmazingFeature`)
5. فتح Pull Request

راجع [CONTRIBUTING.md](./CONTRIBUTING.md) للتفاصيل.

---

## 📝 سجل التغييرات

### الإصدار 2.0.109 (6 يناير 2026)
- ✨ إضافة لوحة تحكم جديدة
- 🐛 إصلاح مشاكل الأداء
- 🔒 تحسينات أمنية
- 📚 تحديث التوثيق

للسجل الكامل، راجع [CHANGELOG.md](./CHANGELOG.md)

---

## 📄 الترخيص

هذا المشروع محمي بحقوق الملكية. جميع الحقوق محفوظة © 2026 AZRAR

للحصول على ترخيص تجاري، تواصل معنا.

---

## 📞 التواصل

- **الموقع:** [https://azrar.example.com](https://azrar.example.com)
- **البريد الإلكتروني:** support@azrar.example.com
- **الدعم الفني:** support@azrar.example.com
- **GitHub:** [github.com/your-username/azrar-desktop](https://github.com/your-username/azrar-desktop)

---

## 🙏 شكر وتقدير

شكراً لجميع المساهمين والمطورين الذين ساهموا في تطوير هذا المشروع.

### التقنيات مفتوحة المصدر المستخدمة:
- [Electron](https://www.electronjs.org/)
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- وغيرها الكثير...

---

## 🌟 ادعمنا

إذا أعجبك المشروع:
- ⭐ قم بوضع نجمة على GitHub
- 🐦 شاركه مع الآخرين
- 📝 اكتب مراجعة

---

<div align="center">

**صُنع بـ ❤️ في السعودية**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/your-username/azrar-desktop)

</div>
