-- Read-only audit recommendation: missing indexes
-- NOTE: This file is NOT executed automatically.
-- Apply only after a backup.

BEGIN;

-- Contracts: guarantorId is used by some screens/filters but was not indexed in the audited DB.
CREATE INDEX IF NOT EXISTS idx_contracts_guarantorId ON contracts(guarantorId);

-- Optional: speed up ordering/filtering by updatedAt (useful for dashboards & incremental refresh).
CREATE INDEX IF NOT EXISTS idx_contracts_updatedAt ON contracts(updatedAt);
CREATE INDEX IF NOT EXISTS idx_properties_updatedAt ON properties(updatedAt);
CREATE INDEX IF NOT EXISTS idx_installments_updatedAt ON installments(updatedAt);

-- Optional: properties location filters (only if you filter by these often).
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_area ON properties(area);

-- Optional: installments paidAt queries.
CREATE INDEX IF NOT EXISTS idx_installments_paidAt ON installments(paidAt);

COMMIT;
