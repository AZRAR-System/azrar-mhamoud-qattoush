# 🚀 دليل البدء السريع - تطبيق التحسينات

## ⚡ خطوات سريعة (5 دقائق)

### 1️⃣ تطبيق الملفات الجديدة

```powershell
# في PowerShell (كمسؤول)
cd "C:\Users\qpqp_\OneDrive\Desktop\pk\copy-of-khaberni-real-estate-system-mastar1 (3)"

# نسخ احتياطية
Copy-Item .gitignore .gitignore.old
Copy-Item README.md README.md.old

# تطبيق الملفات الجديدة
Move-Item .gitignore.new .gitignore -Force
Move-Item README-NEW.md README.md -Force
```

### 2️⃣ تثبيت التبعيات الجديدة

```powershell
# تثبيت تبعيات الاختبارات
npm install --save-dev jest @testing-library/react @testing-library/jest-dom ts-jest @types/jest

# تثبيت electron-log
npm install --save electron-log
```

### 3️⃣ تحديث package.json

أضف هذه السكريبتات في قسم `"scripts"`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src electron --ext .ts,.tsx,.js,.jsx"
  }
}
```

### 4️⃣ تحديث electron-builder في package.json

استبدل قسم `"build"` بهذا:

```json
{
  "build": "electron-builder.config.js"
}
```

---

## 🔐 إعداد GitHub (للمطورين)

### 1. إعداد Secrets

في GitHub Repository → Settings → Secrets and variables → Actions، أضف:

| Secret Name | القيمة | الغرض |
|-------------|--------|-------|
| `CSC_LINK` | محتوى ملف .pfx (base64) | التوقيع الرقمي |
| `CSC_KEY_PASSWORD` | كلمة مرور الشهادة | التوقيع الرقمي |
| `SNYK_TOKEN` | Snyk API Token | فحص الأمان |
| `DISCORD_WEBHOOK` | Discord Webhook URL | الإشعارات |

### 2. تفعيل GitHub Actions

```powershell
# Commit التغييرات
git add .
git commit -m "chore: add CI/CD pipeline and documentation"
git push origin develop
```

---

## ✅ اختبار التحسينات

### 1. اختبار البناء المحلي

```powershell
# البناء بدون توقيع
npm run desktop:dist:skipWU

# التحقق من الملفات
dir release2_build
```

---

## 🗄️ تثبيت مسار قاعدة البيانات (منع خلط النسخ)

التطبيق يدعم تثبيت مسار DB عبر متغيرات البيئة (بدون تعديل الكود):

- `AZRAR_DESKTOP_DB_PATH` (مُفضّل): مسار كامل لملف `khaberni.sqlite`
- `AZRAR_DESKTOP_DB_DIR` (بديل): مجلد تُستخدم داخله `khaberni.sqlite`

### مثال (PowerShell) لتثبيت مسار رسمي قبل تشغيل التطبيق

```powershell
# مثال: تثبيت مسار قاعدة البيانات الرسمي
$env:AZRAR_DESKTOP_DB_PATH = "C:\Users\qpqp_\AppData\Roaming\copy-of-khaberni-real-estate-system-mastar1\Cache\copy-of-khaberni-real-estate-system-mastar1\khaberni.sqlite"

# تشغيل التطبيق
npm run desktop:run
```

> ملاحظة: إذا كان `AZRAR_DESKTOP_DB_PATH` موجوداً، سيتم استخدامه مباشرة وتجاهل المسارات الافتراضية.

### 2. اختبار الاختبارات

```powershell
# تشغيل الاختبارات
npm test

# مع التغطية
npm test -- --coverage
```

### 3. اختبار Logger

أضف في `electron/main.ts`:

```typescript
import logger, { logAppStart } from './logger';

app.whenReady().then(() => {
  logAppStart();
  // ... rest of code
});
```

ثم شغل التطبيق وتحقق من السجلات:

```powershell
# عرض السجلات
type "$env:APPDATA\azrar-desktop\logs\azrar-*.log"
```

---

## 📝 تحديث الروابط

ابحث واستبدل في جميع الملفات:

| القديم | الجديد |
|-------|--------|
| `your-username` | اسم المستخدم الفعلي في GitHub |
| `azrar-desktop` | اسم المستودع الفعلي |
| `support@azrar.example.com` | البريد الإلكتروني الفعلي |
| `https://azrar.example.com` | الموقع الفعلي |

الملفات المتأثرة:
- `electron-builder.config.js`
- `README.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `.github/workflows/build.yml`

---

## 🎯 الخطوات التالية

### أولوية عالية:
1. ✅ الحصول على شهادة توقيع رقمي
2. ✅ إعداد GitHub Secrets
3. ✅ تحديث جميع الروابط

### أولوية متوسطة:
4. ✅ كتابة اختبارات للمكونات الرئيسية
5. ✅ إعداد Snyk للفحص الأمني
6. ✅ إنشاء أول release عبر GitHub

### أولوية منخفضة:
7. ✅ إعداد Discord Webhook
8. ✅ كتابة المزيد من التوثيق
9. ✅ إضافة screenshots للـ README

---

## 🆘 مساعدة سريعة

### مشكلة: npm install فشل

```powershell
rm -r node_modules
rm package-lock.json
npm cache clean --force
npm install
```

### مشكلة: TypeScript errors

```powershell
npm run electron:build
```

### مشكلة: Jest لا يعمل

```powershell
npm install --save-dev @types/jest
```

---

## 📞 الدعم

- 📖 الوثائق الكاملة: `IMPLEMENTATION_SUMMARY.md`
- 👨‍💻 دليل المطورين: `DEVELOPMENT.md`
- 🔐 الأمان: `SECURITY.md`
- 🔧 التوقيع: `docs/CODE_SIGNING.md`

---

**وقت التطبيق المتوقع:** 5-10 دقائق  
**التعقيد:** سهل ⭐⭐☆☆☆

**ابدأ الآن! 🚀**
