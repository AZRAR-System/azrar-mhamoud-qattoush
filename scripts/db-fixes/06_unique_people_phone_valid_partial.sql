-- Optional policy (NOT auto-applied): enforce uniqueness for valid phone numbers only
-- WARNING:
-- - Phone uniqueness is NOT always safe (shared family numbers, placeholders, etc.).
-- - Apply only if your business rules require it.
-- - This can FAIL if duplicates already exist.
--
-- Suggestion:
-- - Only enforce uniqueness for non-empty, digits-only numbers of reasonable length.
-- - Exclude known placeholders like "962".

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_people_phone_valid
  ON people(phone)
  WHERE TRIM(COALESCE(phone,'')) <> ''
    AND phone NOT IN ('0', '962')
    AND length(phone) BETWEEN 9 AND 15
    AND phone NOT GLOB '*[^0-9]*';

COMMIT;
