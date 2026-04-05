-- Admin-managed dynamic content.
-- Single-row config table — the content API reads this instead of hardcoded values.
-- The admin panel writes here. If empty, content.ts falls back to defaults.

CREATE TABLE IF NOT EXISTS admin_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Single row enforced
  content_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT
);

-- Seed with empty row so UPDATE always works
INSERT OR IGNORE INTO admin_content (id, content_json) VALUES (1, '{}');
