-- Moltamp license database
-- Run: npm run db:migrate (local) or npm run db:migrate:prod (production)

CREATE TABLE IF NOT EXISTS licenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL,
  license_key     TEXT    NOT NULL UNIQUE,
  stripe_session_id TEXT  NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  last_validated_at TEXT,
  revoked_at      TEXT,
  notes           TEXT
);

-- Index for fast validation lookups
CREATE INDEX IF NOT EXISTS idx_licenses_email_key
  ON licenses (email, license_key);

-- Index for admin queries by email
CREATE INDEX IF NOT EXISTS idx_licenses_email
  ON licenses (email);
