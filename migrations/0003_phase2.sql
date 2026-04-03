-- Phase 2: Screenshots, comments, content_type
-- Run: wrangler d1 execute moltamp-db --local --file=migrations/0003_phase2.sql

-- Screenshot storage (D1 BLOB, max 3 per skin, 2MB each)
CREATE TABLE IF NOT EXISTS skin_screenshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skin_id     INTEGER NOT NULL REFERENCES community_skins(id) ON DELETE CASCADE,
  image_data  BLOB    NOT NULL,
  content_type TEXT   NOT NULL,
  file_size   INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_skin_screenshots_skin_id ON skin_screenshots (skin_id);

-- Simple comments (no threading, no editing)
CREATE TABLE IF NOT EXISTS skin_comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skin_id     INTEGER NOT NULL REFERENCES community_skins(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_skin_comments_skin_id ON skin_comments (skin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skin_comments_user_id ON skin_comments (user_id);
