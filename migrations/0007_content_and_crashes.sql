-- Server-driven dynamic content + crash reports
-- Run: npm run db:migrate (local) or npm run db:migrate:prod (production)

-- Crash reports — opt-in submissions from desktop app
CREATE TABLE IF NOT EXISTS crash_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  error       TEXT    NOT NULL,
  stack       TEXT,
  version     TEXT    NOT NULL,
  platform    TEXT,
  timestamp   TEXT    NOT NULL,
  received_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crash_reports_version
  ON crash_reports (version);

-- Content integrity log — passive tracking of integrity hashes
CREATE TABLE IF NOT EXISTS integrity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  version     TEXT    NOT NULL,
  hash        TEXT    NOT NULL,
  logged_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_integrity_version_hash
  ON integrity_log (version, hash);
