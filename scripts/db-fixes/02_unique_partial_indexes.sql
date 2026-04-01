-- Read-only audit recommendation: UNIQUE policies via partial indexes
-- NOTE: This file is NOT executed automatically.
--
-- Deprecation (app 2026-03): The desktop app intentionally does NOT keep these UNIQUE indexes
-- (see migrateDomainSchemaV8/V9 in electron/db.ts) — they cause UNIQUE constraint failures during
-- KV pull / domain rebuild when real data has duplicate names, phones, or internal codes.
-- Use app-level validation instead. Do not re-apply this script on synced databases.
--
-- Apply only after a backup, for offline experiments.
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
