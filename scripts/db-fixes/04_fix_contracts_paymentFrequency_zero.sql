-- Fix plan (UPDATE only): contracts.paymentFrequency = 0
-- الهدف: تصحيح قيمة تكرار الدفع في 16 عقداً بدون تغيير أي مبلغ أو أقساط.
-- ملاحظة: هذا الملف غير مُنفّذ تلقائياً.
-- قبل أي شيء: خذ نسخة احتياطية من khaberni.sqlite.
--
-- المنطق:
-- - paymentFrequency يمثل عدد الدفعات في السنة:
--   12=شهري, 6=كل شهرين, 4=ربع سنوي, 2=نصف سنوي, 1=سنوي
-- - إذا وجدنا أقساطاً (installments) للعقد، نستنتج التكرار من فرق الأشهر بين أول قسطين.
-- - إذا لم يوجد (أو لا يمكن الاستنتاج)، نستخدم افتراضي آمن: 12 (شهري).
--
-- IMPORTANT:
-- - نحدّث مصدر الحقيقة أيضاً: kv.k='db_contracts' (JSON) حتى لا ترجع القيمة إلى 0 بعد أي إعادة توليد Domain.
-- - لا نغيّر annualValue ولا installments.

-- 0) عرض العقود المتأثرة + اقتراح التكرار (READ ONLY)
WITH
  affected AS (
    SELECT
      c.id,
      c.paymentFrequency,
      COALESCE(CAST(JSON_EXTRACT(c.data, '$.تكرار_الدفع') AS INTEGER), 0) AS freqInJson,
      COALESCE(CAST(JSON_EXTRACT(c.data, '$.مدة_العقد_بالاشهر') AS INTEGER), 0) AS durationMonths,
      (SELECT COUNT(1) FROM installments i WHERE i.contractId = c.id) AS installmentCount,
      (SELECT MIN(date(i.dueDate)) FROM installments i WHERE i.contractId = c.id AND TRIM(COALESCE(i.dueDate,'')) <> '') AS firstDue,
      (
        SELECT MIN(date(i2.dueDate))
        FROM installments i2
        WHERE i2.contractId = c.id
          AND TRIM(COALESCE(i2.dueDate,'')) <> ''
          AND date(i2.dueDate) > (
            SELECT MIN(date(i3.dueDate))
            FROM installments i3
            WHERE i3.contractId = c.id AND TRIM(COALESCE(i3.dueDate,'')) <> ''
          )
      ) AS secondDue
    FROM contracts c
    WHERE COALESCE(c.paymentFrequency, 0) = 0
       OR COALESCE(CAST(JSON_EXTRACT(c.data, '$.تكرار_الدفع') AS INTEGER), 0) = 0
  ),
  inferred AS (
    SELECT
      a.*, 
      CASE
        WHEN a.firstDue IS NOT NULL AND a.secondDue IS NOT NULL THEN
          (
            (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
            + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
          )
        ELSE NULL
      END AS monthsBetween,
      CASE
        WHEN a.firstDue IS NOT NULL AND a.secondDue IS NOT NULL THEN
          CASE
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 1 THEN 12
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 2 THEN 6
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 3 THEN 4
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 6 THEN 2
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 12 THEN 1
            ELSE 12
          END
        WHEN a.installmentCount >= 10 THEN 12
        WHEN a.installmentCount BETWEEN 4 AND 9 THEN 4
        WHEN a.installmentCount BETWEEN 2 AND 3 THEN 2
        WHEN a.installmentCount = 1 THEN 1
        ELSE 12
      END AS suggestedFrequency
    FROM affected a
  )
SELECT
  id,
  paymentFrequency,
  freqInJson,
  installmentCount,
  firstDue,
  secondDue,
  monthsBetween,
  suggestedFrequency
FROM inferred
ORDER BY id;

-- 1) تحديث جدول contracts (Domain) فقط (UPDATE)
-- هذا يجعل التطبيق يرى القيمة فوراً حتى قبل أي إعادة توليد.
WITH
  affected AS (
    SELECT
      c.id,
      COALESCE(CAST(JSON_EXTRACT(c.data, '$.تكرار_الدفع') AS INTEGER), 0) AS freqInJson,
      (SELECT COUNT(1) FROM installments i WHERE i.contractId = c.id) AS installmentCount,
      (SELECT MIN(date(i.dueDate)) FROM installments i WHERE i.contractId = c.id AND TRIM(COALESCE(i.dueDate,'')) <> '') AS firstDue,
      (
        SELECT MIN(date(i2.dueDate))
        FROM installments i2
        WHERE i2.contractId = c.id
          AND TRIM(COALESCE(i2.dueDate,'')) <> ''
          AND date(i2.dueDate) > (
            SELECT MIN(date(i3.dueDate))
            FROM installments i3
            WHERE i3.contractId = c.id AND TRIM(COALESCE(i3.dueDate,'')) <> ''
          )
      ) AS secondDue
    FROM contracts c
    WHERE COALESCE(c.paymentFrequency, 0) = 0
       OR COALESCE(CAST(JSON_EXTRACT(c.data, '$.تكرار_الدفع') AS INTEGER), 0) = 0
  ),
  inferred AS (
    SELECT
      a.id,
      CASE
        WHEN a.firstDue IS NOT NULL AND a.secondDue IS NOT NULL THEN
          CASE
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 1 THEN 12
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 2 THEN 6
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 3 THEN 4
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 6 THEN 2
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 12 THEN 1
            ELSE 12
          END
        WHEN a.installmentCount >= 10 THEN 12
        WHEN a.installmentCount BETWEEN 4 AND 9 THEN 4
        WHEN a.installmentCount BETWEEN 2 AND 3 THEN 2
        WHEN a.installmentCount = 1 THEN 1
        ELSE 12
      END AS suggestedFrequency
    FROM affected a
  )
UPDATE contracts
SET
  paymentFrequency = (SELECT suggestedFrequency FROM inferred WHERE inferred.id = contracts.id),
  data = json_set(COALESCE(contracts.data,'{}'), '$.تكرار_الدفع', (SELECT suggestedFrequency FROM inferred WHERE inferred.id = contracts.id))
WHERE id IN (SELECT id FROM inferred);

-- 2) تحديث مصدر الحقيقة: kv(db_contracts) (UPDATE)
-- ملاحظة: يعتمد على JSON1 (موجود لأن المشروع يستخدم JSON_EXTRACT بالفعل).
WITH
  affected AS (
    SELECT
      c.id,
      COALESCE(CAST(JSON_EXTRACT(c.data, '$.تكرار_الدفع') AS INTEGER), 0) AS freqInJson,
      (SELECT COUNT(1) FROM installments i WHERE i.contractId = c.id) AS installmentCount,
      (SELECT MIN(date(i.dueDate)) FROM installments i WHERE i.contractId = c.id AND TRIM(COALESCE(i.dueDate,'')) <> '') AS firstDue,
      (
        SELECT MIN(date(i2.dueDate))
        FROM installments i2
        WHERE i2.contractId = c.id
          AND TRIM(COALESCE(i2.dueDate,'')) <> ''
          AND date(i2.dueDate) > (
            SELECT MIN(date(i3.dueDate))
            FROM installments i3
            WHERE i3.contractId = c.id AND TRIM(COALESCE(i3.dueDate,'')) <> ''
          )
      ) AS secondDue
    FROM contracts c
    WHERE COALESCE(c.paymentFrequency,0) = 0
       OR COALESCE(CAST(JSON_EXTRACT(c.data, '$.تكرار_الدفع') AS INTEGER), 0) = 0
  ),
  inferred AS (
    SELECT
      a.id,
      CASE
        WHEN a.firstDue IS NOT NULL AND a.secondDue IS NOT NULL THEN
          CASE
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 1 THEN 12
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 2 THEN 6
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 3 THEN 4
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 6 THEN 2
            WHEN (
              (CAST(strftime('%Y', a.secondDue) AS INTEGER) - CAST(strftime('%Y', a.firstDue) AS INTEGER)) * 12
              + (CAST(strftime('%m', a.secondDue) AS INTEGER) - CAST(strftime('%m', a.firstDue) AS INTEGER))
            ) = 12 THEN 1
            ELSE 12
          END
        WHEN a.installmentCount >= 10 THEN 12
        WHEN a.installmentCount BETWEEN 4 AND 9 THEN 4
        WHEN a.installmentCount BETWEEN 2 AND 3 THEN 2
        WHEN a.installmentCount = 1 THEN 1
        ELSE 12
      END AS suggestedFrequency
    FROM affected a
  ),
  expanded AS (
    SELECT
      je.key AS idx,
      je.value AS obj,
      JSON_EXTRACT(je.value, '$."رقم_العقد"') AS contractId
    FROM kv
    JOIN json_each(kv.v) AS je
    WHERE kv.k = 'db_contracts'
  ),
  patched AS (
    SELECT
      idx,
      CASE
        WHEN contractId IN (SELECT id FROM inferred)
         AND COALESCE(CAST(JSON_EXTRACT(obj, '$."تكرار_الدفع"') AS INTEGER), 0) = 0
        THEN json_set(obj, '$."تكرار_الدفع"', (SELECT suggestedFrequency FROM inferred WHERE inferred.id = contractId))
        ELSE obj
      END AS newObj
    FROM expanded
  )
UPDATE kv
SET
  v = (
    SELECT json_group_array(json(newObj))
    FROM patched
    ORDER BY CAST(idx AS INTEGER)
  ),
  updatedAt = datetime('now')
WHERE k = 'db_contracts';

-- بعد تنفيذ التحديثات:
-- - أعد تشغيل التطبيق.
-- - (اختياري) شغّل domain migrate/refresh إن كان لديك زر/مسار لذلك.
