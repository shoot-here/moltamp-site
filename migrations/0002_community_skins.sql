-- Community skins marketplace tables
-- Run: wrangler d1 execute moltamp-db --local --file=migrations/0002_community_skins.sql

-- Stable user identity (derived from license holders on first login)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  display_name  TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Sessions for cookie-based auth (30-day expiry)
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT    NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- Community skin metadata
CREATE TABLE IF NOT EXISTS community_skins (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  skin_id         TEXT    NOT NULL UNIQUE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  version         TEXT    NOT NULL,
  description     TEXT    NOT NULL,
  author_name     TEXT    NOT NULL,
  engine          TEXT    NOT NULL DEFAULT '1.0',
  colors_json     TEXT    NOT NULL,
  r2_key          TEXT    NOT NULL,
  file_size       INTEGER NOT NULL,
  css_size        INTEGER NOT NULL,
  asset_count     INTEGER NOT NULL DEFAULT 0,
  download_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  status          TEXT    NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_community_skins_user_id ON community_skins (user_id);
CREATE INDEX IF NOT EXISTS idx_community_skins_status ON community_skins (status);
CREATE INDEX IF NOT EXISTS idx_community_skins_created ON community_skins (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_skins_downloads ON community_skins (download_count DESC);

-- Tags (max 5 per skin, enforced at application layer)
CREATE TABLE IF NOT EXISTS skin_tags (
  skin_id     INTEGER NOT NULL REFERENCES community_skins(id) ON DELETE CASCADE,
  tag         TEXT    NOT NULL,
  PRIMARY KEY (skin_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_skin_tags_tag ON skin_tags (tag);
