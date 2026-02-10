# ✅ Release Checklist — AZRAR Desktop

<div dir="rtl">

**آخر تحديث:** 2026-02-10  
**الهدف:** قائمة قصيرة لتقليل الأخطاء قبل أي إصدار.

---

## 1) قبل البناء (Pre‑Build)

- تأكد أنك على الريبو الصحيح (فيه `.git`).
- استخدم Node **22.x** (baseline).
- حدّث التبعيات إذا لزم (اختياري حسب السياسة).

---

## 2) بوابات الجودة (Quality Gates)

نفّذ هذا ويجب أن ينجح بالكامل:

```powershell
npm run lint
npm test
npm run verify
```

إذا فشل `better-sqlite3`/native:

```powershell
npm run native:ensure:electron
```

---

## 3) تحقق تشغيل سريع (Smoke)

- تشغيل الديسكتوب dev والتأكد من فتح النافذة بدون أخطاء:

```powershell
npm run desktop:dev
```

- (اختياري) Autorun/E2E:

```powershell
npm run desktop:e2e
```

---

## 4) بناء Installer

```powershell
npm run desktop:dist
```

ملاحظات:
- التوقيع (Signing) يعتمد على إعدادات الجهاز/الشهادات. راجع: `docs/CODE_SIGNING.md`.
- مخرجات البناء تظهر تحت مجلدات release حسب سكربت التوزيع.

---

## 5) بعد البناء (Post‑Build)

- جرّب تشغيل الـ EXE على نفس الجهاز.
- تحقق من:
  - فتح التطبيق
  - فتح/إنشاء DB
  - طباعة/تصدير بسيط (إذا كان ضمن نطاق الإصدار)

</div>
