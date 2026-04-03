-- Skin ratings: 1-5 stars, one rating per user per skin
CREATE TABLE IF NOT EXISTS skin_ratings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skin_id     INTEGER NOT NULL REFERENCES community_skins(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(skin_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_skin_ratings_skin_id ON skin_ratings (skin_id);
CREATE INDEX IF NOT EXISTS idx_skin_ratings_user_id ON skin_ratings (user_id);
