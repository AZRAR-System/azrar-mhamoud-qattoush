# FINAL_DB_AUDIT_REPORT — KHABERNI_DB (SQLite)

**Date:** 2026-01-17  
**Scope:** Desktop SQLite database used by KHABERNI (Electron)  
**Source of truth for schema (in this repo):** `electron/db.ts`

> مهم: هذا المستودع لا يحتوي على ملف قاعدة بيانات حقيقي (`khaberni.sqlite`) داخل الـ workspace، لذلك لا يمكنني استخراج **أرقام فعلية** مثل عدد السجلات لكل جدول من بياناتك الحالية.
> 
> هذا التقرير يقدّم:
> 1) تحليل “Static” للـ Schema/Indexes/Constraints كما هو مُعرَّف في الكود.
> 2) **SQL Scripts للقراءة فقط** (SELECT/PRAGMA) لتشغيلها على قاعدة بياناتك الفعلية لاستخراج العدّ/المشاكل بدقة.
>
> إذا وضعت نسخة من `khaberni.sqlite` داخل المشروع (مثلاً بجانب هذا الملف) سأقدر أملأ جدول العدّ بالأرقام وأطلع كشف Integrity كامل بالنتائج.

> تحديث (Read-only على جهازك): تم تشغيل تدقيق قراءة فقط على ملف قاعدة بيانات موجود على هذا الجهاز واستخراج أرقام فعلية (حجم/PRAGMA/Row counts/Integrity).
> 
> **ملف DB الذي تم تدقيقه (الأكثر نشاطاً وحجماً في بيئة التطوير):**
> `C:\Users\qpqp_\AppData\Roaming\copy-of-khaberni-real-estate-system-mastar1\Cache\copy-of-khaberni-real-estate-system-mastar1\khaberni.sqlite`

---

## 0) أين يوجد ملف قاعدة البيانات؟
مسار قاعدة البيانات يتم حله في `electron/db.ts` (دالة `resolveDbPathSync()`):
- إذا كان لديك متغير بيئة `AZRAR_DESKTOP_DB_PATH` → يتم استخدامه كمسار مباشر للملف.
- إذا كان لديك `AZRAR_DESKTOP_DB_DIR` → يتم إنشاء/استخدام `khaberni.sqlite` داخل هذا المجلد.
- افتراضياً: `app.getPath('userData')/khaberni.sqlite`.
- في نسخة الـ packaged قد يفضّل ملف بجانب الـ exe إذا كان قابل للكتابة.

**ملاحظة سلامة:** التطبيق يفتح قاعدة البيانات بطريقة عادية (ليس read-only) وقد ينشئ جداول (`CREATE TABLE IF NOT EXISTS`).
لذلك، لتشغيل التدقيق “قراءة فقط”، استخدم أداة SQLite أو افتح الملف بوضع read-only من خارج التطبيق.

### 0.1) Snapshot — أرقام فعلية من ملف DB المُدقَّق (Read-only)

**File:**
- Path: `C:\Users\qpqp_\AppData\Roaming\copy-of-khaberni-real-estate-system-mastar1\Cache\copy-of-khaberni-real-estate-system-mastar1\khaberni.sqlite`
- Size: 749,568 bytes (~0.71 MB)
- Last modified: 2026-01-17

**PRAGMA (مختصر):**
- `journal_mode=wal`, `synchronous=1 (NORMAL)`, `page_size=4096`, `page_count=194`, `freelist_count=11`
- `foreign_keys=1` (مفعّل كإعداد PRAGMA، لكن لا توجد FKs مُعرّفة في DDL)

**Row counts (أهم الجداول):**
- `installments`: 194
- `people`: 37
- `properties`: 19
- `contracts`: 18
- `person_roles`: 38
- `kv`: 38
- `domain_meta`: 9
- `kv_deleted`: 1
- `blacklist`: 0
- `maintenance_tickets`: 0

**SQLite Integrity:**
- `PRAGMA integrity_check` => `ok`
- `PRAGMA quick_check` => `ok`

---

## 1) Schema Overview (الجداول + الهدف)

طبقاً لـ `electron/db.ts`، KHABERNI_DB يحتوي على طبقتين:

### A) KV Layer (مصدر البيانات الأساسي)
- **`kv`**: تخزين مفاتيح `db_*` (JSON) وغيرها.  
  الأعمدة: `k` (PK), `v` (TEXT), `updatedAt` (TEXT)
- **`kv_deleted`**: Tombstones للحذف للمزامنة.  
  الأعمدة: `k` (PK), `deletedAt` (TEXT)

هذه الطبقة تحمل معظم “الدومين الحقيقي” (مثل attachments/notes/activities وغيرها) على شكل JSON في `kv.v`.

### B) Domain Tables (SQLite مُشتقّة من KV لأداء الاستعلامات والتقارير)
> هذه الجداول تُبنى/تُحدّث من KV بهدف تقليل المسح داخل الواجهة وتحسين الأداء.

الجداول المُعرّفة:
- **`domain_meta`**: مفاتيح/قيم خاصة بإصدارات وبصمة الـ migration.
- **`people`**: نسخة مُلخّصة + JSON snapshot.
- **`person_roles`**: أدوار الأشخاص (مُشتقة).
- **`blacklist`**: حالة الحظر (مُشتقة).
- **`properties`**: نسخة مُلخّصة + JSON snapshot.
- **`contracts`**: نسخة مُلخّصة + JSON snapshot.
- **`installments`**: نسخة مُلخّصة + JSON snapshot.
- **`maintenance_tickets`**: تذاكر الصيانة (مُشتقة).

### عدد السجلات في كل جدول
**تم استخراجها من ملف DB المُدقَّق (0.1):**
- `kv`: 38
- `kv_deleted`: 1
- `domain_meta`: 9
- `people`: 37
- `person_roles`: 38
- `blacklist`: 0
- `properties`: 19
- `contracts`: 18
- `installments`: 194
- `maintenance_tickets`: 0

---

## 2) العلاقات (Foreign Keys / Relationships)

### Foreign Keys المعرّفة فعلياً
**لا توجد أي قيود FK مُعلنة في CREATE TABLE** داخل `electron/db.ts` للجداول الدومينية (people/properties/contracts/installments…).

هذا يعني:
- SQLite لن يمنع Orphans تلقائياً.
- سلامة العلاقات تعتمد على منطق التطبيق/المزامنة.

### العلاقات المنطقية (Logical Relationships)
رغم عدم وجود FK، هناك علاقات ضمنية عبر أعمدة Ids:
- `properties.ownerId` → `people.id`
- `contracts.propertyId` → `properties.id`
- `contracts.tenantId` → `people.id`
- `contracts.guarantorId` → `people.id`
- `installments.contractId` → `contracts.id`
- `maintenance_tickets.propertyId` → `properties.id`
- `maintenance_tickets.tenantId` → `people.id`
- `blacklist.personId` → `people.id`
- `person_roles.personId` → `people.id`

### علاقات “مفقودة ومهمة”
**High impact:** إضافة FK (حتى لو كانت deferred) على الأقل بين:
- installments → contracts
- contracts → properties
- contracts → people (tenant/guarantor)
- properties → people (owner)
- blacklist → people
- person_roles → people

**ملاحظة:** إضافة FK تحتاج أيضاً تشغيل `PRAGMA foreign_keys=ON;` في الاتصال، وهو غير ظاهر حالياً في `electron/db.ts`.

---

## 3) الفهارس (Indexes / Unique Indexes)

### الفهارس الموجودة حسب الكود
**KV**
- `kv`: PK على `k` + `idx_kv_updatedAt(updatedAt)`
- `kv_deleted`: PK على `k` + `idx_kv_deleted_deletedAt(deletedAt)`

**people**
- `idx_people_name(name)`
- `idx_people_phone(phone)`
- `idx_people_nationalId(nationalId)`

**person_roles**
- Unique: `uq_person_roles_person_role(personId, role)`
- `idx_person_roles_personId(personId)`
- `idx_person_roles_role(role)`

**blacklist**
- `idx_blacklist_isActive(isActive)`

**properties**
- `idx_properties_internalCode(internalCode)`
- `idx_properties_ownerId(ownerId)`
- `idx_properties_status(status)`
- `idx_properties_type(type)`
- `idx_properties_address(address)`

**contracts**
- `idx_contracts_propertyId(propertyId)`
- `idx_contracts_tenantId(tenantId)`
- `idx_contracts_status(status)`
- `idx_contracts_endDate(endDate)`
- `idx_contracts_isArchived(isArchived)`

**installments**
- `idx_installments_contractId(contractId)`
- `idx_installments_dueDate(dueDate)`
- `idx_installments_remaining(remaining)`
- `idx_installments_status(status)`
- `idx_installments_type(type)`
- `idx_installments_isArchived(isArchived)`

**maintenance_tickets**
- `idx_maint_propertyId(propertyId)`
- `idx_maint_status(status)`
- `idx_maint_priority(priority)`
- `idx_maint_createdDate(createdDate)`

### الفهارس الناقصة التي قد تؤثر على الأداء (High impact)
> ملاحظة: هذه توصيات **بدون تنفيذ**.

**Contracts**
- Composite index على (propertyId, isArchived, startDate DESC) لتسريع “عقود عقار”.
- Composite index على (tenantId, isArchived, startDate DESC) لتسريع “عقود شخص”.

**Installments**
- Composite index على (contractId, isArchived, dueDate) لتسريع جداول الأقساط داخل تفاصيل عقد.
- Composite index على (status, remaining, dueDate) للتقارير (متأخر/مستحق قريباً).

**People**
- Unique index اختياري (مع سياسة تنظيف) على `nationalId` إذا كان يجب أن يكون فريداً.
- Unique index اختياري على `phone` (أو phoneNormalized) إذا كان ذلك مطلوباً.

**Properties**
- Unique index على `internalCode` إذا كان “الكود الداخلي” يجب أن يكون فريداً.

**Attachments**
- حالياً لا يوجد جدول attachments في SQLite domain؛ المرفقات محفوظة كـ JSON في KV.
  هذا يمنع إضافة فهارس فعالة على `referenceType/referenceId/createdAt`.
  **التوصية:** إنشاء جدول `attachments` مُطبّع + فهارس مناسبة (Appendix توصيات).

---

## 4) قيود البيانات (Constraints: CHECK/DEFAULT)

طبقاً لتعريف الجداول في `electron/db.ts`:
- لا توجد `CHECK` constraints.
- لا توجد `DEFAULT` constraints مُعلنة.

**الأثر:** إدخال قيم غير منطقية ممكن (مثل remaining<0 أو endDate قبل startDate) ما لم يمنعه منطق التطبيق.

### أين نحتاج قيود لمنع بيانات خاطئة؟ (توصيات فقط)
- `installments.amount >= 0`, `paid >= 0`, `remaining >= 0`, و `paid <= amount`.
- `contracts.paymentFrequency > 0`.
- `contracts.endDate >= startDate` (إذا كانت التواريخ موجودة).
- أعمدة boolean-like (`isArchived`, `isRented`, `isForSale`, …) تكون 0/1 فقط.

---

## 5) مشاكل السلامة (Data Integrity Issues) — كشف (بالـ SQL)

> هذه الاستعلامات **قراءة فقط**.
> 
> **نتائج فعلية من ملف DB المُدقَّق (0.1):**
> - Orphans: لا توجد حالات (0)
> - Duplicates: حالة واحدة في `people.phone`
> - قيم غير منطقية: 16 عقداً فيها `paymentFrequency = 0`

### A) Orphans (سجلات يتيمة)
- أقساط بلا عقد
- عقود بلا عقار
- عقارات بلا مالك (إذا كان مطلوب)
- تذاكر صيانة بلا عقار/مستأجر

(الاستعلامات في Appendix A)

**نتيجة DB المُدقَّق:**
- `contractsWithoutProperty`: 0
- `contractsTenantMissing`: 0
- `contractsGuarantorMissing`: 0
- `installmentsWithoutContract`: 0
- `installmentsMissingContractId`: 0

### B) Duplicates (تكرار محتمل)
- تكرار `people.nationalId`
- تكرار `people.phone`
- تكرار `properties.internalCode`

**نتيجة DB المُدقَّق:**
- `people.nationalId`: 0
- `people.phone`: 1 (مثال: `phone = "962"` بعدد 2)
- `properties.internalCode`: 0

### C) قيم غير منطقية
- `contracts.endDate < startDate`
- `contracts.annualValue <= 0` أو `paymentFrequency <= 0`
- `installments.amount <= 0` أو `remaining < 0` أو `paid > amount`

**نتيجة DB المُدقَّق:**
- `contracts.endDate < startDate`: 0
- `contracts.annualValue <= 0` أو `paymentFrequency <= 0`: 16 (المشكلة هنا كانت `paymentFrequency = 0`)
- `installments` money sanity: 0

### D) صحة JSON
- `json_valid(data) = 0` في `people/properties/contracts/installments` (إذا كان SQLite JSON1 مفعّل).

---

## 6) أداء واستعداد للمستقبل

### هل التصميم قابل للتوسع؟
- **جزئياً.** وجود Domain tables + فهارس أساسية جيد.
- لكن الاعتماد على KV JSON كمصدر أساسي لكل شيء (خصوصاً attachments/notes/activities) يحد من الأداء عند تضخم البيانات لأن الفهرسة داخل JSON غير ممكنة عملياً.

### أخطر 5 نقاط قد تسبب بطء بعد أشهر
1) تضخم `kv` وخاصة مفاتيح `db_*` كـ JSON كبير (تحميل/parse/filter داخل التطبيق).
2) عدم وجود Composite Indexes على مسارات الاستعلام الأكثر تكراراً (contracts/installments).
3) عدم وجود قيود FK/UNIQUE → تراكم Orphans/Duplicates يرفع تكلفة الاستعلامات والتقارير.
4) أعمدة التاريخ كنص (TEXT) بدون توحيد صارم للـ ISO → مشاكل فرز/فلترة واستعلامات تاريخية أبطأ.
5) عدم وجود جداول مُطبّعة لبعض الكيانات الثقيلة (Attachments/Notes/Activities/Sales…) → صعوبة الاستعلام السريع والتقارير.

---

## 7) توصيات نهائية (بدون تنفيذ)

### High
- إضافة FKs (مع تفعيل `PRAGMA foreign_keys=ON`) أو بديل: Jobs تدقيق دورية + تقارير Orphans.
- إضافة/تأكيد الفهارس الأساسية على العقود/الأقساط (خصوصاً `contracts.guarantorId`, وحقول الفرز/التصفية الشائعة) كما في قسم الفهارس.
- تطبيع attachments (جدول + فهارس) لأن المرفقات عادة تنمو بسرعة.

### High (Data Fix)
- إصلاح بيانات `paymentFrequency = 0` في `contracts` (16 عقداً في DB المُدقَّق) قبل فرض أي CHECK/UNIQUE/FK.

### Medium
- إضافة UNIQUE policies (nationalId / phone / internalCode) بعد تنظيف البيانات الحالية.
- إضافة CHECK constraints للأرقام/booleans والتواريخ.
- إضافة أعمدة “normalized” (مثل phoneNormalized) بدلاً من فهرسة نصوص غير موحدة.

### Low
- إضافة Views للتقارير الشائعة.
- إضافة FULLTEXT (FTS5) للبحث في الاسم/العنوان إذا أصبحت الاستعلامات النصية كثيفة.

---

# Appendix A — SQL Scripts (READ-ONLY)

> شغّل هذه الأوامر على `khaberni.sqlite` باستخدام sqlite3/DB Browser for SQLite.
> كلها SELECT/PRAGMA فقط.

## A1) قائمة الجداول + SQL
```sql
SELECT name, type, sql
FROM sqlite_master
WHERE type IN ('table','view','index')
  AND name NOT LIKE 'sqlite_%'
ORDER BY type, name;
```

## A2) عدد السجلات لكل جدول (الجداول المعروفة)
```sql
SELECT 'kv' AS table_name, COUNT(*) AS row_count FROM kv
UNION ALL SELECT 'kv_deleted', COUNT(*) FROM kv_deleted
UNION ALL SELECT 'domain_meta', COUNT(*) FROM domain_meta
UNION ALL SELECT 'people', COUNT(*) FROM people
UNION ALL SELECT 'person_roles', COUNT(*) FROM person_roles
UNION ALL SELECT 'blacklist', COUNT(*) FROM blacklist
UNION ALL SELECT 'properties', COUNT(*) FROM properties
UNION ALL SELECT 'contracts', COUNT(*) FROM contracts
UNION ALL SELECT 'installments', COUNT(*) FROM installments
UNION ALL SELECT 'maintenance_tickets', COUNT(*) FROM maintenance_tickets
ORDER BY table_name;
```

## A3) حجم مفاتيح KV المهمة (db_*)
```sql
SELECT
  k,
  LENGTH(v) AS bytes,
  CASE WHEN json_valid(v) THEN json_array_length(v) ELSE NULL END AS items
FROM kv
WHERE k LIKE 'db_%'
ORDER BY bytes DESC;
```

## A4) Foreign Keys (إن وجدت)
```sql
PRAGMA foreign_key_list('people');
PRAGMA foreign_key_list('properties');
PRAGMA foreign_key_list('contracts');
PRAGMA foreign_key_list('installments');
PRAGMA foreign_key_list('maintenance_tickets');
```

## A5) Indexes لكل جدول
```sql
PRAGMA index_list('people');
PRAGMA index_list('properties');
PRAGMA index_list('contracts');
PRAGMA index_list('installments');
PRAGMA index_list('maintenance_tickets');

-- لمعرفة أعمدة كل index:
-- PRAGMA index_info('idx_contracts_propertyId');
```

## A6) Constraints (CHECK/DEFAULT) عبر تحليل SQL
```sql
SELECT name, sql
FROM sqlite_master
WHERE type='table'
  AND name NOT LIKE 'sqlite_%'
  AND (sql LIKE '%CHECK%' OR sql LIKE '%DEFAULT%')
ORDER BY name;
```

## A7) Orphans
```sql
-- Contracts بلا property
SELECT c.id, c.propertyId
FROM contracts c
LEFT JOIN properties p ON p.id = c.propertyId
WHERE TRIM(COALESCE(c.propertyId,'')) <> ''
  AND p.id IS NULL
LIMIT 200;

-- Contracts tenantId غير موجود
SELECT c.id, c.tenantId
FROM contracts c
LEFT JOIN people t ON t.id = c.tenantId
WHERE TRIM(COALESCE(c.tenantId,'')) <> ''
  AND t.id IS NULL
LIMIT 200;

-- Installments بلا contract
SELECT i.id, i.contractId
FROM installments i
LEFT JOIN contracts c ON c.id = i.contractId
WHERE TRIM(COALESCE(i.contractId,'')) <> ''
  AND c.id IS NULL
LIMIT 200;

-- Properties ownerId غير موجود
SELECT pr.id, pr.ownerId
FROM properties pr
LEFT JOIN people p ON p.id = pr.ownerId
WHERE TRIM(COALESCE(pr.ownerId,'')) <> ''
  AND p.id IS NULL
LIMIT 200;
```

## A8) Duplicates
```sql
-- National ID duplicates
SELECT nationalId, COUNT(*) AS cnt
FROM people
WHERE TRIM(COALESCE(nationalId,'')) <> ''
GROUP BY nationalId
HAVING COUNT(*) > 1
ORDER BY cnt DESC, nationalId
LIMIT 200;

-- Phone duplicates
SELECT phone, COUNT(*) AS cnt
FROM people
WHERE TRIM(COALESCE(phone,'')) <> ''
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY cnt DESC, phone
LIMIT 200;

-- Internal code duplicates
SELECT internalCode, COUNT(*) AS cnt
FROM properties
WHERE TRIM(COALESCE(internalCode,'')) <> ''
GROUP BY internalCode
HAVING COUNT(*) > 1
ORDER BY cnt DESC, internalCode
LIMIT 200;
```

## A9) Non-sensical values
```sql
-- Contracts with endDate before startDate (expects ISO YYYY-MM-DD)
SELECT id, startDate, endDate
FROM contracts
WHERE TRIM(COALESCE(startDate,'')) <> ''
  AND TRIM(COALESCE(endDate,'')) <> ''
  AND date(endDate) < date(startDate)
LIMIT 200;

-- Annual value / payment frequency invalid
SELECT id, annualValue, paymentFrequency
FROM contracts
WHERE COALESCE(annualValue,0) <= 0
   OR COALESCE(paymentFrequency,0) <= 0
LIMIT 200;

-- Installments invalid amounts
SELECT id, contractId, amount, paid, remaining
FROM installments
WHERE COALESCE(amount,0) <= 0
   OR COALESCE(paid,0) < 0
   OR COALESCE(remaining,0) < 0
   OR COALESCE(paid,0) > COALESCE(amount,0)
LIMIT 200;
```

## A10) JSON validity (اختياري)
```sql
SELECT 'people' AS table_name, COUNT(*) AS invalid_json
FROM people
WHERE json_valid(data) = 0
UNION ALL
SELECT 'properties', COUNT(*) FROM properties WHERE json_valid(data) = 0
UNION ALL
SELECT 'contracts', COUNT(*) FROM contracts WHERE json_valid(data) = 0
UNION ALL
SELECT 'installments', COUNT(*) FROM installments WHERE json_valid(data) = 0;
```
