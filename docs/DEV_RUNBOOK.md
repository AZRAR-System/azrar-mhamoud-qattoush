# 🧰 Dev Runbook — AZRAR Desktop (Canonical)

<div dir="rtl">

**آخر تحديث:** 2026-02-10  
**الهدف:** نقطة واحدة موثوقة لتشغيل المشروع، تشخيص الأعطال الشائعة، وإصلاح مشاكل native modules والتنظيف الآمن.

> ملاحظة مهمة: اشتغل دائمًا على النسخة التي تحتوي `.git` (المجلد المستعاد/الرسمي)، وليس مجلدات مخرجات البناء مثل `release2_build`.

---

## 1) متطلبات البيئة (مهم جدًا)

- **Node.js:** يُفضّل **22.x (LTS)**. (24.x مقبول).  
  - تشغيل Node 25 قد يسبب تحذيرات Engine لبعض الحزم (ولا نعتبره baseline).
- **npm:** يأتي مع Node.
- **Windows 10/11**

إذا عندك `nvm-windows`:

```powershell
nvm install 22
nvm use 22
node -v
npm -v
```

---

## 2) إعداد أول مرة

```powershell
npm install
```

---

## 3) أوامر التشغيل الأساسية (Known‑Good)

### تشغيل الديسكتوب أثناء التطوير (الموصى به)

```powershell
npm run desktop:dev
```

- Vite يجب أن يبقى على `http://localhost:3000`.

### تشغيل واجهة فقط (Vite)

```powershell
npm run dev
```

### بناء Bundles الخاصة بـ Electron فقط

```powershell
npm run electron:build
```

---

## 4) التحقق والجودة (قبل أي تغيير كبير/PR)

```powershell
npm run lint
npm test
npm run verify
```

اختبارات الديسكتوب (Autorun/E2E):

```powershell
npm run desktop:e2e
```

---

## 5) Native modules (SQLite) — إصلاح سريع عند الأعطال

إذا ظهرت مشاكل `better-sqlite3` بعد تحديث/تبديل Node/Electron أو بعد تنظيف:

```powershell
npm run native:ensure:electron
```

---

## 6) تشغيل مع License Server (Dev)

تشغيل الديسكتوب مع السيرفر:

```powershell
npm run desktop:dev:withLicense
```

تشغيل نسخة مبنية مع السيرفر:

```powershell
npm run desktop:run:withLicense
```

تشغيل لوحة Admin:

```powershell
npm run license-admin:dev
```

---

## 7) مشاكل شائعة وحلول سريعة

### 7.1 تعارض المنافذ (3000 / 5056)

تحقق من المنافذ:

```powershell
$ports = 3000,5056
foreach($p in $ports){
  $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if($c){"PORT $p LISTEN pid=$($c.OwningProcess)"} else {"PORT $p NOT LISTEN"}
}
```

قتل العملية على منفذ:

```powershell
$port = 3000
$c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if($c){ Stop-Process -Id $c.OwningProcess -Force }
```

### 7.2 Windows file locks (مثل app.asar)

- تأكد أنك أغلقت أي نافذة Electron تعمل.
- إذا بقي القفل: أغلق VS Code/Explorer أو نفّذ الحذف بعد إعادة تشغيل.

---

## 8) تنظيف محلي آمن (مساحة القرص)

لا تحذف يدويًا ملفات/مجلدات كبيرة داخل المشروع.

- الدليل: [LOCAL_CLEANUP_SAFE.md](LOCAL_CLEANUP_SAFE.md)
- السكربت: `scripts/clean-local.ps1`

---

## 9) قاعدة ذهبية للمجلدات

- ✅ العمل والتطوير: مجلد الريبو الرسمي (الذي يحتوي `.git`).
- ❌ لا تعتمد على: مجلدات مخرجات مثل `release2_build*` كمصدر كود.

</div>
