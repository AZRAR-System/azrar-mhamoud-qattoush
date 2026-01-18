-- Data cleanup: normalize people phone numbers (Domain + KV source of truth)
-- هدف هذا الملف:
-- - تنظيف أرقام الهواتف بتطبيع بسيط (إزالة المسافات والرموز وتحويل الأرقام العربية إلى إنجليزية).
-- - إزالة قيم placeholder مثل "962" و"0" (تحويلها إلى نص فارغ) حتى لا تُسبب تكرارات مضللة.
-- - تحديث مصدر الحقيقة أيضاً: kv.k='db_people' حتى لا تعود القيم بعد إعادة بناء Domain.
--
-- ملاحظة مهمة:
-- - هذا الملف UPDATE فقط (لا يحذف سجلات).
-- - خذ نسخة احتياطية من khaberni.sqlite قبل التنفيذ.

BEGIN;

-- 1) تحديث جدول people (Domain) + تعديل JSON snapshot داخل people.data
WITH
  normalized AS (
    SELECT
      id,
      phone AS oldPhone,
      TRIM(COALESCE(phone, '')) AS p0,
      -- Convert Arabic-Indic digits to ASCII digits (both sets)
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          TRIM(COALESCE(phone, '')),
          '٠','0'),'١','1'),'٢','2'),'٣','3'),'٤','4'),'٥','5'),'٦','6'),'٧','7'),'٨','8'),'٩','9'),
          '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9') AS p_ar,
      data AS oldData
    FROM people
  ),
  stripped AS (
    SELECT
      id,
      oldPhone,
      oldData,
      -- Strip common formatting chars
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(p_ar,
        ' ', ''),
        '-', ''),
        '(', ''),
        ')', ''),
        '+', ''),
        '.', ''),
        '/', ''),
        '\\', '') AS p1
    FROM normalized
  ),
  canonical AS (
    SELECT
      id,
      oldPhone,
      oldData,
      CASE
        WHEN SUBSTR(p1, 1, 2) = '00' THEN SUBSTR(p1, 3)
        ELSE p1
      END AS p2
    FROM stripped
  ),
  final AS (
    SELECT
      id,
      oldPhone,
      oldData,
      CASE
        WHEN TRIM(COALESCE(p2,'')) IN ('', '0', '962') THEN ''
        ELSE TRIM(p2)
      END AS newPhone
    FROM canonical
  )
UPDATE people
SET
  phone = (SELECT newPhone FROM final WHERE final.id = people.id),
  data = json_set(COALESCE(people.data, '{}'), '$.رقم_الهاتف', (SELECT newPhone FROM final WHERE final.id = people.id))
WHERE id IN (SELECT id FROM final WHERE COALESCE(oldPhone,'') <> COALESCE(newPhone,''));

-- 2) تحديث KV: db_people (Source of truth)
-- نبني JSON array جديدة بعد التطبيع.
WITH
  src AS (
    SELECT v AS raw
    FROM kv
    WHERE k = 'db_people'
    LIMIT 1
  ),
  arr AS (
    SELECT
      CASE
        WHEN raw IS NULL OR TRIM(raw) = '' THEN '[]'
        ELSE raw
      END AS raw
    FROM src
  ),
  items AS (
    SELECT
      je.key AS idx,
      je.value AS obj,
      -- raw phone
      COALESCE(JSON_EXTRACT(je.value, '$.رقم_الهاتف'), '') AS phoneRaw,
      COALESCE(JSON_EXTRACT(je.value, '$.رقم_هاتف_اضافي'), '') AS extraRaw
    FROM arr,
      json_each(arr.raw) AS je
  ),
  norm AS (
    SELECT
      idx,
      obj,
      -- normalize phone
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          TRIM(COALESCE(phoneRaw,'')),
          '٠','0'),'١','1'),'٢','2'),'٣','3'),'٤','4'),'٥','5'),'٦','6'),'٧','7'),'٨','8'),'٩','9'),
          '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9') AS phoneAr,
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          TRIM(COALESCE(extraRaw,'')),
          '٠','0'),'١','1'),'٢','2'),'٣','3'),'٤','4'),'٥','5'),'٦','6'),'٧','7'),'٨','8'),'٩','9'),
          '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9') AS extraAr
    FROM items
  ),
  stripped AS (
    SELECT
      idx,
      obj,
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phoneAr,
        ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), '/', ''), '\\', '') AS phone1,
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(extraAr,
        ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), '/', ''), '\\', '') AS extra1
    FROM norm
  ),
  canonical AS (
    SELECT
      idx,
      obj,
      CASE WHEN SUBSTR(phone1, 1, 2) = '00' THEN SUBSTR(phone1, 3) ELSE phone1 END AS phone2,
      CASE WHEN SUBSTR(extra1, 1, 2) = '00' THEN SUBSTR(extra1, 3) ELSE extra1 END AS extra2
    FROM stripped
  ),
  final AS (
    SELECT
      idx,
      json_set(
        json_set(
          obj,
          '$.رقم_الهاتف',
          CASE WHEN TRIM(COALESCE(phone2,'')) IN ('', '0', '962') THEN '' ELSE TRIM(phone2) END
        ),
        '$.رقم_هاتف_اضافي',
        CASE WHEN TRIM(COALESCE(extra2,'')) IN ('', '0', '962') THEN '' ELSE TRIM(extra2) END
      ) AS obj2
    FROM canonical
  )
UPDATE kv
SET v = (
  SELECT COALESCE(json_group_array(obj2), '[]')
  FROM (
    SELECT obj2
    FROM final
    ORDER BY CAST(idx AS INTEGER)
  )
)
WHERE k = 'db_people';

COMMIT;
