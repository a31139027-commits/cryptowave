CREATE TABLE IF NOT EXISTS button_counts (
  button_id TEXT PRIMARY KEY,
  count     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS button_daily (
  button_id TEXT NOT NULL,
  date      TEXT NOT NULL,  -- YYYY-MM-DD (UTC)
  count     INTEGER DEFAULT 0,
  PRIMARY KEY (button_id, date)
);
