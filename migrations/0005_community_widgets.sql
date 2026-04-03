-- Community widgets marketplace tables
-- Run: wrangler d1 execute moltamp-db --local --file=migrations/0005_community_widgets.sql

-- Community widget metadata
CREATE TABLE IF NOT EXISTS community_widgets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  widget_id       TEXT    NOT NULL UNIQUE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  version         TEXT    NOT NULL,
  description     TEXT    NOT NULL,
  author_name     TEXT    NOT NULL,
  file_data       BLOB,
  r2_key          TEXT    NOT NULL,
  file_size       INTEGER NOT NULL,
  download_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  status          TEXT    NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_community_widgets_user_id ON community_widgets (user_id);
CREATE INDEX IF NOT EXISTS idx_community_widgets_status ON community_widgets (status);
CREATE INDEX IF NOT EXISTS idx_community_widgets_created ON community_widgets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_widgets_downloads ON community_widgets (download_count DESC);

-- Tags (max 5 per widget, enforced at application layer)
CREATE TABLE IF NOT EXISTS widget_tags (
  widget_id   INTEGER NOT NULL REFERENCES community_widgets(id) ON DELETE CASCADE,
  tag         TEXT    NOT NULL,
  PRIMARY KEY (widget_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_widget_tags_tag ON widget_tags (tag);

-- Widget ratings: 1-5 stars, one rating per user per widget
CREATE TABLE IF NOT EXISTS widget_ratings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  widget_id   INTEGER NOT NULL REFERENCES community_widgets(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(widget_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_widget_ratings_widget_id ON widget_ratings (widget_id);
CREATE INDEX IF NOT EXISTS idx_widget_ratings_user_id ON widget_ratings (user_id);

-- Widget comments (no threading, no editing)
CREATE TABLE IF NOT EXISTS widget_comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  widget_id   INTEGER NOT NULL REFERENCES community_widgets(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_widget_comments_widget_id ON widget_comments (widget_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_widget_comments_user_id ON widget_comments (user_id);
