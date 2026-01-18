# DB Fix Scripts (DO NOT AUTO-RUN)

These SQL files are **recommendations only**.

- They are **not executed** by the app or by any script.
- Always take a backup copy of `khaberni.sqlite` before applying anything.
- Prefer applying to a copy first.

## Files

- `01_missing_indexes.sql` — safe index additions (no data changes).
- `02_unique_partial_indexes.sql` — optional UNIQUE partial indexes (may fail if duplicates exist).
- `03_constraints_fk_plan.sql` — plan/template for adding CHECK/FK/DEFAULT via table rebuild (requires data cleanup first).
