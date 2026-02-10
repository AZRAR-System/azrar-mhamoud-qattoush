# 🧹 تنظيف محلي آمن (Windows) — بدون حذف ملفات متتبعة

<div dir="rtl">

هذا الدليل يشرح طريقة تنظيف الملفات **المولّدة محليًا** (مثل `node_modules/`, `dist/`, `tmp/`, مخرجات البناء) **بدون** المخاطرة بحذف ملفات متتبعة داخل git.

> القاعدة الذهبية: **لا تحذف يدويًا** مجلدات كبيرة عشوائيًا. استخدم `git clean` أو السكربت المخصص.

---

## ✅ الطريقة الموصى بها (Preview ثم تنفيذ)

### 1) Preview (لا يحذف شيئًا)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1
```

### 2) تنفيذ الحذف (فعليًا)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -Force -Preview:$false
```

**ماذا يحذف؟**
- كل ما هو **Ignored** حسب `.gitignore` (مثل `node_modules/`, `dist/`, `tmp/`, مخرجات release…)

**ماذا لا يحذف؟**
- أي ملف متتبّع (Tracked) في git
- يتم استثناء:
  - `secrets/`
  - `server/data/`

---

## 🧯 ملاحظة مهمة عن Windows (ملفات مقفولة)

إذا فشل حذف بعض الملفات (مثل `app.asar`) بسبب “being used by another process”:
- أغلق التطبيق Electron بالكامل
- أغلق أي نافذة File Explorer مفتوحة داخل مجلدات الـ release
- انتظر دقيقة (أحيانًا antivirus/indexing)
- أعد المحاولة
- إن استمر القفل: أعد تشغيل الجهاز ثم نفّذ التنظيف

---

## 🔁 بعد التنظيف

- للتطوير/التشغيل مجددًا ستحتاج:
  - `npm install`
- وبعدها يمكنك تشغيل:
  - `npm run desktop:dev`

</div>
