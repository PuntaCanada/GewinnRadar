-- Apply ONLY to the isolated GewinnRadar D1 after explicit operator approval.
-- A singleton permanently records that first-admin bootstrap was consumed.
CREATE TABLE IF NOT EXISTS admin_bootstrap (
  slot INTEGER PRIMARY KEY CHECK(slot=1),
  admin_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  claim_id TEXT NOT NULL UNIQUE,
  used_at TEXT NOT NULL
);
