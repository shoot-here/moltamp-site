-- Anonymous opt-in telemetry pings
CREATE TABLE IF NOT EXISTS telemetry_pings (
  id          INTEGER PRIMARY KEY,
  version     TEXT NOT NULL,
  platform    TEXT NOT NULL,
  arch        TEXT NOT NULL,
  uptime_min  INTEGER DEFAULT 0,
  sessions    INTEGER DEFAULT 0,
  skins       INTEGER DEFAULT 0,
  widgets     INTEGER DEFAULT 0,
  tickers     INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_created ON telemetry_pings (created_at);
