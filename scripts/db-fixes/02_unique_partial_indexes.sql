-- Read-only audit recommendation: UNIQUE policies via partial indexes
-- NOTE: This file is NOT executed automatically.
-- Apply only after a backup.
-- These statements can FAIL if duplicates already exist.

BEGIN;

-- National ID should be unique when present.
CREATE UNIQUE INDEX IF NOT EXISTS uq_people_nationalId
  ON people(nationalId)
  WHERE TRIM(COALESCE(nationalId,'')) <> '';

-- Property internal code should be unique when present.
CREATE UNIQUE INDEX IF NOT EXISTS uq_properties_internalCode
  ON properties(internalCode)
  WHERE TRIM(COALESCE(internalCode,'')) <> '';

-- Phone uniqueness is often NOT safe (shared numbers, placeholders, etc.).
-- In the audited DB we saw duplicates for phone = "962".
-- If you want to enforce uniqueness for VALID phones only, do it after normalization.
-- Example (commented out):
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_people_phone
--   ON people(phone)
--   WHERE TRIM(COALESCE(phone,'')) <> '' AND phone NOT IN ('962');

COMMIT;
