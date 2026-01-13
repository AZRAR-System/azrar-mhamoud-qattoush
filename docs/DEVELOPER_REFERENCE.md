# 🧑‍💻 مرجع المطور — AZRAR (Desktop + Web)

**آخر تحديث:** 2026-01-05

هذا الملف هو “مرجع عملي للمطورين” يغطي:
- أوامر التشغيل/البناء/الإصدار
- المعمارية (React/Vite + Electron)
- طبقة التخزين (SQLite KV + localStorage cache)
- المزامنة مع SQL Server + سجل المزامنة
- الطباعة/الترويسة + تصدير Excel
- خريطة أهم الملفات والدوال

---

## 1) التشغيل والبناء (Commands)

### المتطلبات
- Node.js 18+
- Windows (PowerShell) للتوزيع `desktop:dist`

### أوامر أساسية
- تشغيل واجهة الويب فقط:
  - `npm run dev`
- بناء واجهة الويب:
  - `npm run build`
- فحص TypeScript:
  - `npm run typecheck`
- تحقق شامل (Typecheck + Routes + Build + Electron bundles):
  - `npm run verify`

### تشغيل نسخة سطح المكتب (Electron)
- تشغيل تطوير (Vite + Electron):
  - `npm run desktop:dev`
- بناء ثم تشغيل Electron:
  - `npm run desktop:run`

### بناء حزم Electron (bundles)
- بناء preload + main + ipc + db:
  - `npm run electron:build`

### إنتاج Installer (NSIS)
- بناء توزيعة:
  - `npm run desktop:dist`

**ملاحظات Windows (PowerShell scripts):**
- الملف [start-desktop.ps1](../start-desktop.ps1) يشغّل `npm run desktop:dev`.
- إذا كان PowerShell يمنع تشغيل السكربتات:
  - `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

---

## 2) المعمارية (Architecture)

النظام يتكون من طبقتين في وضع Desktop:

1) **Renderer (واجهة المستخدم)**
- React + Vite
- نقطة الدخول: [src/main.tsx](../src/main.tsx)
- تطبيق Routing يدوي عبر hash داخل: [src/App.tsx](../src/App.tsx)

2) **Electron Main Process**
- إنشاء نافذة التطبيق + CSP + IPC
- نقطة الدخول: [electron/main.ts](../electron/main.ts)
- تسجيل IPC handlers: [electron/ipc.ts](../electron/ipc.ts)

3) **Preload Bridge**
- يعرض API آمن للواجهة عبر `contextBridge` (مع `contextIsolation: true`)
- الملف: [electron/preload.ts](../electron/preload.ts)

---

## 3) التخزين المحلي (Local Storage)

### Desktop Mode: SQLite KV + localStorage cache
- قاعدة البيانات المحلية هي SQLite (better-sqlite3) بشكل Key/Value:
  - جدول `kv(k, v, updatedAt)`
  - جدول `kv_deleted(k, deletedAt)` (tombstones للحذف والمزامنة)
- التنفيذ: [electron/db.ts](../electron/db.ts)

### Renderer Storage Wrapper
- الواجهة تتعامل مع التخزين عبر Wrapper واحد:
  - [src/services/storage.ts](../src/services/storage.ts)

السلوك:
- في Desktop:
  - `storage.setItem()` يكتب أولاً إلى `localStorage` (كاش سريع) ثم يكتب إلى SQLite عبر `window.desktopDb.set()`.
  - عند بدء التطبيق: يتم “Hydrate” لمفاتيح `db_` من SQLite إلى `localStorage` عبر `storage.hydrateDbKeysToLocalStorage('db_')`.
  - ثم يتم الاشتراك بتحديثات المزامنة القادمة من الـ main عبر `storage.subscribeDesktopRemoteUpdates('db_')`.
- في Web:
  - `storage.*` يستخدم `localStorage` مباشرة.

---

## 4) واجهة Electron → Renderer (IPC / Bridge)

### القنوات المكشوفة عبر preload
في [electron/preload.ts](../electron/preload.ts) يتم كشف كائنين:

#### `window.desktopDb`
- DB APIs:
  - `db:get`, `db:set`, `db:delete`, `db:keys`, `db:resetAll`
  - `db:export`, `db:import`, `db:getPath`
  - `db:getBackupDir`, `db:chooseBackupDir`

- SQL Server Sync APIs (Desktop only):
  - `sql:getSettings`, `sql:saveSettings`, `sql:test`
  - `sql:connect`, `sql:disconnect`, `sql:status`
  - `sql:provision`
  - `sql:exportBackup`, `sql:importBackup`, `sql:restoreBackup`
  - `sql:syncNow`
  - `sql:getSyncLog`, `sql:clearSyncLog`

- Events:
  - `onRemoteUpdate` (event: `db:remoteUpdate`)
  - `onSqlSyncEvent` (event: `sql:syncEvent`)

- Attachments:
  - `attachments:save`, `attachments:read`, `attachments:delete`

#### `window.desktopUpdater`
- إدارة التحديثات عبر electron-updater:
  - `updater:getVersion`, `updater:getStatus`, `updater:setFeedUrl`, `updater:check`, `updater:download`, `updater:install` … إلخ

### TypeScript types للـ bridge
- [src/types/electron.types.ts](../src/types/electron.types.ts)

---

## 5) المزامنة مع SQL Server (Desktop)

> التنفيذ الأساسي موجود داخل Electron main لأن الاتصال بـ SQL Server يتم عبر Node (`mssql`).

### أهم الملفات
- منطق الـ IPC والمزامنة وسجل المزامنة: [electron/ipc.ts](../electron/ipc.ts)
- التخزين المحلي والتومبستون: [electron/db.ts](../electron/db.ts)
- منطق الاتصال بـ SQL Server (مذكور كمستورد): `electron/sqlSync.ts`

### سجل المزامنة (Sync Log)
- هيكل حدث السجل داخل [electron/ipc.ts](../electron/ipc.ts):
  - `direction`: `push | pull | system`
  - `action`: `upsert | delete | connect | syncNow | provision | ...`
  - `status`: `ok | error`

- عرض السجل في الواجهة:
  - [src/components/panels/SqlSyncLogPanel.tsx](../src/components/panels/SqlSyncLogPanel.tsx)

**ملاحظة صيانة 2026-01:**
- تم تحسين السجل ليظهر **التعديل/الحذف** بشكل أوضح، وإضافة **سطر ملخص** بعد عملية “مزامنة الآن”.

### تدفق المزامنة (مفهومياً)
- **Pull**: سحب تغييرات من SQL إلى SQLite KV، ثم إرسال `db:remoteUpdate` للواجهة لتحديث الكاش.
- **Push**:
  - Full push: رفع كل `kv` + `kv_deleted`.
  - Delta push: رفع “ما تغيّر منذ timestamp” عبر:
    - `kvListUpdatedSince(sinceIso)`
    - `kvListDeletedSince(sinceIso)`

### المزامنة التلقائية
- في [electron/ipc.ts](../electron/ipc.ts) يوجد loop دوري (كل 5 دقائق) يمنع التشغيل المتوازي عبر guard.

### زر “مزامنة الآن”
- موجود في صفحة لوحة المعلومات:
  - [src/pages/Dashboard.tsx](../src/pages/Dashboard.tsx)

---

## 6) المرفقات (Attachments)

- في وضع Desktop يتم تخزين الملفات كمرفقات فعلية على القرص تحت `userData/attachments`.
- الواجهة تستخدم Bridge عند توفره:
  - `window.desktopDb.saveAttachmentFile()`
  - `window.desktopDb.readAttachmentFile()`
  - `window.desktopDb.deleteAttachmentFile()`

المرجع الأساسي لعمليات المرفقات داخل DbService:
- [src/services/mockDb.ts](../src/services/mockDb.ts)

---

## 7) الإعدادات والترويسة (Settings + Letterhead)

### الإعدادات
- UI: [src/pages/Settings.tsx](../src/pages/Settings.tsx)
- الوصول للإعدادات غالباً عبر: `DbService.getSettings()` داخل الواجهة.

### الترويسة للطباعة
- المكون: [src/components/print/PrintLetterhead.tsx](../src/components/print/PrintLetterhead.tsx)
- السلوك:
  - إذا `letterheadEnabled === false` لا يتم عرض الترويسة.
  - يعرض `companyIdentityText` كنص متعدد الأسطر.

### التصدير إلى Excel (XLSX)
- محرك التصدير: [src/utils/xlsx.ts](../src/utils/xlsx.ts)
  - يدعم `extraSheets` لإضافة أوراق إضافية.
- بناء ورقة “الترويسة”: [src/utils/companySheet.ts](../src/utils/companySheet.ts)
  - `buildCompanyLetterheadSheet(settings)`

**ملاحظة توافق:** الاستيراد يعتمد على أول ورقة؛ وجود ورقة إضافية لا ينبغي أن يكسر الاستيراد طالما الاستيراد يقرأ الورقة الأولى.

---

## 8) خريطة الملفات (File Map)

### Electron
- [electron/main.ts](../electron/main.ts): إنشاء نافذة التطبيق + CSP + DevTools في وضع dev
- [electron/preload.ts](../electron/preload.ts): تعريف الـ bridge (`desktopDb`, `desktopUpdater`)
- [electron/ipc.ts](../electron/ipc.ts): IPC handlers + سجل المزامنة + مزامنة SQL + بث أحداث للواجهة
- [electron/db.ts](../electron/db.ts): SQLite KV + tombstones + export/import
- [electron/autoMaintenance.ts](../electron/autoMaintenance.ts): مهام صيانة تلقائية (إن وجدت)

### Renderer (React)
- [src/main.tsx](../src/main.tsx): Bootstrap + Hydrate + subscribe updates
- [src/App.tsx](../src/App.tsx): Routing + providers
- [src/services/storage.ts](../src/services/storage.ts): طبقة تخزين موحدة Web/Desktop
- [src/services/mockDb.ts](../src/services/mockDb.ts): DbService (CRUD + منطق المجال)
- [src/pages/Dashboard.tsx](../src/pages/Dashboard.tsx): زر “مزامنة الآن”
- [src/components/panels/SqlSyncLogPanel.tsx](../src/components/panels/SqlSyncLogPanel.tsx): عرض سجل المزامنة

---

## 9) متغيرات البيئة (Environment Variables)

- `AZRAR_UPDATE_URL`: رابط تحديثات electron-updater (اختياري)
- `AZRAR_DESKTOP_DB_PATH`: مسار ملف sqlite كامل (override)
- `AZRAR_DESKTOP_DB_DIR`: مجلد لإنشاء `khaberni.sqlite`
- `AZRAR_DESKTOP_JOURNAL_MODE`: `WAL` (افتراضي) أو `DELETE`
- `VITE_AUTORUN_SYSTEM_TESTS`: تشغيل اختبارات/توجيه تلقائي لبعض صفحات النظام في وضع dev

---

## 10) استكشاف الأخطاء (Troubleshooting)

### شاشة بيضاء في build مُعبّأ (packaged)
- راجع رسائل Console التي يعكسها Electron من renderer (مفعّل في [electron/main.ts](../electron/main.ts)).

### بيانات “اختفت” بعد تحديث
- قاعدة البيانات في وضع Desktop محفوظة تحت `app.getPath('userData')` لضمان ثباتها عبر التحديثات.
- يوجد best-effort migration من DB ملاصقة للـ exe إلى userData عند الحاجة.

### مشاكل PowerShell في تشغيل سكربتات التوزيع
- نفّذ مرة واحدة:
  - `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
