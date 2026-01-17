# تقرير معماري: تصميم الواجهة وطريقة عرض الطبقات والشاشات (AZRAR)

هذا التقرير يصف باختصار “كيف تُركّب الواجهة” وكيف تُعرض الشاشات والطبقات (Pages / Panels / Modals) في نسخة الويب ونسخة الديسكتوب (Electron).

## 1) نقطة الدخول والتهيئة (Bootstrap)

- نقطة التشغيل الأساسية: `src/main.tsx`
  - يحمّل الخطوط/الستايلات العامة.
  - يقوم بتهيئة الـstorage (خصوصاً في الديسكتوب) عبر:
    - `storage.hydrateDbKeysToLocalStorage('db_')`
    - `storage.hydrateKeysToLocalStorage([...])`
    - `storage.subscribeDesktopRemoteUpdates({ prefix: 'db_', includeKeys: [...] })`
  - بعدها يرندر React داخل `#root`.

الهدف: في الديسكتوب يتم “ترطيب” المفاتيح من قاعدة محلية/جسر Electron إلى `localStorage` ليقرأها UI بسرعة وبنفس API.

## 2) غلاف التطبيق (App Shell) والـProviders

- ملف التجميع الأساسي: `src/App.tsx`
  - يغلّف التطبيق بالطبقات التالية:
    1) `GlobalErrorBoundary`
    2) `AuthProvider`
    3) `ToastProvider`
    4) `ModalProvider`
    5) `Suspense` (Lazy loading للصفحات)

ملاحظة مهمة: **التطبيق يستخدم `react-router-dom` مع `HashRouter`** للحفاظ على نفس شكل الروابط (#) في الويب/الديسكتوب.

### 2.1) نظام التوجيه (Routing)

- التوجيه يتم عبر `HashRouter` + `Routes` داخل `src/App.tsx`:
  - `RequireAuth` يحمي الصفحات ويحوّل غير المسجّل إلى `/login` عبر `Navigate`.
  - `LayoutRoute` يلف `Layout` ويضع `Outlet` لعرض الصفحة الحالية.
  - يوجد `NotFound` كـ 404 واضح عبر المسار `*`.
  - Dev-only: يستدعي `validateRoutes()` لضمان تطابق المسارات مع قائمة الـNAV.

ملاحظة استقرارية: تم وضع `AppShellErrorBoundary` حول `LayoutRoute` لمنع “الشاشة الفارغة” عند أي خطأ runtime داخل الغلاف أو الطبقات العلوية.

### 2.2) مصدر واحد للمسارات والعناوين

- تعريف المسارات: `src/routes/paths.ts`
- شجرة عناصر الشريط الجانبي: `src/routes/registry.ts` (NAV_ITEMS)
- فحص الانحراف بين NAV والـROUTE_PATHS: `src/routes/validate.ts`

النتيجة: أي تعديل في المسارات ينبغي أن يمر عبر `paths.ts` و`registry.ts`.

## 3) Layout: عرض الشاشات والطبقات في الواجهة

- الغلاف البصري الأساسي: `src/components/Layout.tsx`

Layout هو المسؤول عن:
- الشريط الجانبي (Sidebar) + هيكل التنقل (NAV_ITEMS)
- الهيدر (عنوان الصفحة + العنوان الفرعي)
- دعم الثيم (Dark/Light) على مستوى `document.documentElement.classList`
- إدراج طبقات “فوق المحتوى”:
  - `GlobalSearch`
  - `SmartModalEngine` (طبقة المودالات/اللوحات)
  - `OnboardingGuide`

### 3.1) طبقة الديسكتوب داخل Layout

Layout يتعامل مع وجود الجسر عبر:
- `const hasDesktopBridge = !!window.desktopDb;`

ويضيف قدرات:
- قراءة حالة SQL Sync كل 5 ثواني عبر `window.desktopDb.sqlStatus()`.
- الاستماع لأحداث المزامنة `window.desktopDb.onSqlSyncEvent` وتجميعها ثم عرض Toast مُجمّع.
- في أول تشغيل (إذا قاعدة البيانات فارغة) يفتح `SERVER_DRAWER` تلقائياً ويقوم بمحاولة استرجاع/مزامنة مرة واحدة.
- Post-update restore prompt عبر `desktopUpdater.getPendingRestore()` ثم فتح `CONFIRM_MODAL`.

## 4) نظام الـPanels/Modals (الطبقات فوق الشاشة)

### 4.1) تعريف الحالة والتحكم

- السياق: `src/context/ModalContext.tsx`
  - `activePanels: Panel[]`
  - `openPanel(type, dataId?, props?)`
  - `closePanel(id)` / `closeAll()`

الفكرة: بدل التنقل لصفحة تفاصيل (route)، يتم غالباً فتح “Panel” فوق الصفحة الحالية.

### 4.2) محرك العرض

- المحرك: `src/components/shared/SmartModalEngine.tsx`
  - يربط `PanelType` بمكوّن فعلي عبر `PANEL_COMPONENTS`.
  - يعرّف عناوين افتراضية عبر `PANEL_TITLES`.
  - يدعم أنماط خاصة:
    - `BULK_WHATSAPP`: نافذة قابلة للتصغير للأسفل.
    - `SERVER_DRAWER`: Drawer يمين.
    - `CONFIRM_MODAL`: نافذة تأكيد في الوسط.

هذه الطبقة موحّدة، لذلك أي صفحة يمكنها فتح تفاصيل/نموذج بدون تكرار UI مودال.

## 5) صفحات النظام (Screens) vs Panels

### 5.1) الصفحات الأساسية (Routes)

المحمّلة Lazy في `src/App.tsx`:
- Dashboard: `/`
- Sales: `/sales`
- People: `/people` و`/companies`
- Properties: `/properties`
- Contracts: `/contracts`
- Installments: `/installments`
- Commissions: `/commissions`
- Maintenance: `/maintenance`
- Alerts: `/alerts`
- Reports: `/reports`
- Legal Hub: `/legal`
- Smart Tools: `/smart-tools`
- Admin/Settings/Operations/System Maintenance/Database/Builder/Docs
- Utility: Contacts / Bulk WhatsApp / Documents / Comprehensive tests / Reset database

### 5.2) اللوحات (Panels)

أمثلة Panel Types (من `ModalContext.tsx` وSmartModalEngine):
- تفاصيل: PERSON_DETAILS / PROPERTY_DETAILS / CONTRACT_DETAILS / SALES_LISTING_DETAILS
- نماذج: PERSON_FORM / PROPERTY_FORM / CONTRACT_FORM / INSPECTION_FORM / BLACKLIST_FORM
- أدوات: REPORT_VIEWER / LEGAL_NOTICE_GENERATOR / SMART_PROMPT
- النظام: SERVER_DRAWER / SQL_SYNC_LOG / PAYMENT_NOTIFICATIONS / MARQUEE_ADS

القاعدة العملية في النظام:
- “القائمة/الإدارة” = Page.
- “التفاصيل/النماذج/الوِزرد” = Panel فوق الصفحة.

## 6) طبقة البيانات (Web vs Desktop)

### 6.1) Web/Legacy (in-memory)

- تعتمد كثير من الصفحات على `DbService` داخل `src/services/mockDb.ts`.

### 6.2) Desktop Fast Mode (Domain Queries)

- غلاف الاستعلامات الذكي: `src/services/domainQueries.ts`
  - يتحقق من `window.desktopDb`.
  - إذا كان Desktop:
    - ينفذ الاستعلام عبر IPC (`domainSearch`, `domainGet`, pickers…)
    - **ويتجنب السقوط إلى in-memory scans** حمايةً للأداء.
  - إذا Web:
    - يسقط إلى `DbService`.

### 6.3) جسر Electron (preload)

- التعريض للـrenderer: `electron/preload.ts`
  - `contextBridge.exposeInMainWorld('desktopDb', {...})`
  - كل الاستدعاءات تمر عبر `ipcRenderer.invoke(...)`.

- ضبط الأمان العام: `electron/main.ts`
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
  - CSP ديناميكي (أشد في الإنتاج)
  - تقييد التنقل والروابط الخارجية

## 7) Design System واتساق الـUI

- قيم Design System: `src/constants/designSystem.ts`
  - ألوان/حدود/ظلال/Radius/ستايلات للـCard/Table/Page header.

- مثال مركزي: `src/components/ui/Button.tsx`
  - يستخدم `DS.colors.*` وsizes ثابتة.
  - يطبق focus ring وdisabled states.

النتيجة: النظام عنده “نواة” تصميم يمكن البناء عليها لتوحيد كل البطاقات/الأزرار/الجداول.

## 8) تدفقات الاستخدام (User Flows) بنظرة عملية

- التنقل الرئيسي: Sidebar (NAV_ITEMS) يغير `window.location.hash`.
- داخل أي صفحة:
  - زر “تفاصيل” عادة يفتح Panel عبر `openPanel('..._DETAILS', id)`.
  - زر “تعديل/إضافة” يفتح Panel Form.
- البحث الشامل:
  - `GlobalSearch` (Ctrl+K) ينفذ `domainSearchGlobalSmart()` ثم يفتح Panels مباشرة.

## 9) نقاط قوة واضحة

- طبقة Panels موحدة ومركّزة في مكان واحد (SmartModalEngine) وتقلل التكرار.
- Dual-mode data access (Web/Mock vs Desktop/SQL) عبر `domainQueries.ts`.
- وجود `validateRoutes()` يقلل أخطاء الانحراف بين NAV والـrouting.
- إعدادات أمان Electron جيدة (contextIsolation + CSP + قيود التنقل).

## 10) ملاحظات وتحسينات مقترحة (مرتبة بالأولوية)

1) **توحيد التنقل (Navigation helper)**
   - حالياً هناك استعمالات مباشرة لـ`window.location.hash` داخل عدة ملفات.
   - مقترح: دالة واحدة مثل `navigate(path, query?)` لتوحيد بناء الـhash + query.

2) **رفع جودة أخطاء Desktop queries**
   - بعض الدوال في `domainQueries.ts` تُرجع فارغ بدون error عند فشل IPC.
   - مقترح: توحيد نمط “إرجاع error نصي” كما هو موجود في `contractPickerSearchPagedSmart`.

3) **تقوية Typing في الـPanels**
   - `SmartModalEngine` يستخدم `Record<string, React.FC<any>>`.
   - مقترح: ربطها بـ`Record<PanelType, React.FC<...>>` تدريجياً لتقليل الأخطاء.

4) **تقسيم Layout (اختياري)**
   - `Layout.tsx` كبير ويضم منطق Desktop/Theme/Search/Sidebar.
   - مقترح: استخراج أجزاء (DesktopSyncBanner/Sidebar/Header) لسهولة الصيانة.

---

إذا تريد، أستطيع أيضاً إنشاء مخطط “خريطة الشاشات” كجدول: Page → أهم Actions → Panels التي تفتحها، لتسهيل تدريب المستخدمين ودليل التشغيل.

---

## ملحق (ثابت): Page → Actions → Panels

الهدف من هذا الجدول توثيق “ما هي الشاشات (Routes)” وما هي “اللوحات (Panels)” التي تُفتح فوقها عبر `openPanel(...)`.

| Page (Route) | Actions شائعة | Panels (ModalContext PanelType) |
|---|---|---|
| Dashboard (`/`) | بحث شامل (Ctrl+K)، فتح عناصر سريعة | `PERSON_DETAILS`, `PROPERTY_DETAILS`, `CONTRACT_DETAILS`, `PAYMENT_NOTIFICATIONS`, `CALENDAR_EVENTS` |
| People (`/people`) | عرض/بحث/فلترة، إضافة/تعديل ملف، تفاصيل | `PERSON_DETAILS`, `PERSON_FORM`, `BLACKLIST_FORM`, `CALENDAR_EVENTS` |
| Properties (`/properties`) | عرض/بحث/فلترة، إضافة/تعديل عقار، تفاصيل | `PROPERTY_DETAILS`, `PROPERTY_FORM`, `CONFIRM_MODAL` |
| Contracts (`/contracts`) | عرض/بحث/فلترة، إنشاء/تعديل عقد، تفاصيل/براءة ذمة | `CONTRACT_DETAILS`, `CONTRACT_FORM`, `CLEARANCE_REPORT`, `CLEARANCE_WIZARD`, `CONFIRM_MODAL` |
| Installments (`/installments`) | عرض دفعات حسب عقد/فلتر، فتح تفاصيل العقد | `CONTRACT_DETAILS`, `CONFIRM_MODAL` |
| Commissions (`/commissions`) | عرض شرائح/تقارير عمولات | (غالباً بدون Panels مباشرة؛ حسب الصفحة قد تفتح `CONTRACT_DETAILS`) |
| Sales (`/sales`) | عرض فرص/عروض بيع، فتح تفاصيل العرض، فتح تفاصيل الأطراف | `SALES_LISTING_DETAILS`, `PROPERTY_DETAILS`, `PERSON_DETAILS` |
| Alerts (`/alerts`) | فتح مرجع التنبيه (شخص/عقار/عقد)، إنشاء إشعار قانوني | `PERSON_DETAILS`, `PROPERTY_DETAILS`, `CONTRACT_DETAILS`, `LEGAL_NOTICE_GENERATOR` |
| Reports (`/reports`) | تشغيل/عرض تقرير، تصدير/طباعة | `REPORT_VIEWER` |
| Legal (`/legal`) | توليد إنذارات/نماذج قانونية | `LEGAL_NOTICE_GENERATOR`, `CONTRACT_DETAILS`, `PERSON_DETAILS` |
| Maintenance (`/maintenance`) | إدارة طلبات الصيانة وربطها بأطراف/عقار | `MAINTENANCE_DETAILS`, `PROPERTY_DETAILS`, `PERSON_DETAILS` |
| Settings (`/settings`) | إعدادات النظام/نسخ احتياطية/أدوات إدارية | `CONFIRM_MODAL`, `SMART_PROMPT`, `SQL_SYNC_LOG` |
| Operations (`/operations`) | سجل عمليات وتحذيرات تشغيلية | (قد تفتح Panels حسب نوع السجل) |
| System Maintenance (`/sys-maintenance`) | أدوات اختبار/صيانة، إعادة ضبط | `CONFIRM_MODAL` |
| Database (`/database`) | إدارة الجداول/إصلاحات/ترحيل | `SERVER_DRAWER`, `CONFIRM_MODAL` |
| Smart Tools (`/smart-tools`) | أدوات مساعدة وعمليات سريعة | `SMART_PROMPT`, `CONTRACT_DETAILS` |

ملاحظة: أسماء الـPanels هي المصدر الحقيقي في [copy-of-khaberni-real-estate-system-mastar1 (3)/src/context/ModalContext.tsx](copy-of-khaberni-real-estate-system-mastar1%20(3)/src/context/ModalContext.tsx) وربطها بالـComponents داخل [copy-of-khaberni-real-estate-system-mastar1 (3)/src/components/shared/SmartModalEngine.tsx](copy-of-khaberni-real-estate-system-mastar1%20(3)/src/components/shared/SmartModalEngine.tsx).
