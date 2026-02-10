# 🚀 QUICK START — AZRAR Desktop

هذا المشروع **Desktop-only** (Electron). لا يوجد منتج Web مستقل.

## المتطلبات
- Windows 10/11 (64-bit)
- Node.js 22.x (LTS) (و 24.x مقبول)
- npm

## تشغيل أثناء التطوير

```powershell
npm install
npm run desktop:dev
```

- سيعمل Vite على `http://localhost:3000` (مطلوب أن يبقى على 3000).
- Electron يفتح التطبيق تلقائياً.

## تشغيل اختبارات الديسكتوب (E2E Autorun)

```powershell
npm run desktop:e2e
```

مخرجات الـ runner تُحفظ افتراضياً في:
- `tmp/desktop-dev-tests-latest.log`

لتغيير المهلة/مسار اللوج:

```powershell
$env:DESKTOP_DEV_TESTS_TIMEOUT_MS = "180000"
$env:DESKTOP_DEV_TESTS_LOG_PATH = "tmp/desktop-dev-tests-custom.log"
npm run desktop:e2e
```

## التحقق قبل الإخراج

```powershell
npm run verify
npm run verify:desktop
```

أو دفعة واحدة:

```powershell
npm run verify:full
```

## بناء Installer

```powershell
npm run desktop:dist
```

للتفاصيل:
- `docs/DESKTOP_SETUP_FINAL.md`
- `docs/TROUBLESHOOTING.md`
- `docs/LICENSE_ACTIVATION.md`
