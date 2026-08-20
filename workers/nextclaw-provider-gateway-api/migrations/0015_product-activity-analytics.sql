ALTER TABLE users
  ADD COLUMN analytics_audience TEXT NOT NULL DEFAULT 'external'
  CHECK (analytics_audience IN ('external', 'internal', 'qa'));

UPDATE users
   SET analytics_audience = 'internal'
 WHERE role = 'admin';

CREATE TABLE product_analytics_installations (
  installation_hash TEXT PRIMARY KEY,
  linked_user_id TEXT,
  audience TEXT NOT NULL CHECK (audience IN ('external', 'internal', 'qa')),
  environment TEXT NOT NULL CHECK (environment IN ('production', 'development', 'test')),
  release_channel TEXT NOT NULL CHECK (release_channel IN ('stable', 'beta', 'nightly', 'development')),
  platform TEXT NOT NULL CHECK (platform IN ('macos', 'windows', 'linux', 'other')),
  app_version TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (linked_user_id) REFERENCES users(id)
);

CREATE INDEX idx_product_analytics_installations_dimensions
  ON product_analytics_installations(audience, environment, release_channel, last_seen_at);
CREATE INDEX idx_product_analytics_installations_user
  ON product_analytics_installations(linked_user_id);

CREATE TABLE product_activity_daily (
  activity_date TEXT NOT NULL,
  installation_hash TEXT NOT NULL,
  intent_accepted INTEGER NOT NULL DEFAULT 0 CHECK (intent_accepted IN (0, 1)),
  run_succeeded INTEGER NOT NULL DEFAULT 0 CHECK (run_succeeded IN (0, 1)),
  direct_used INTEGER NOT NULL DEFAULT 0 CHECK (direct_used IN (0, 1)),
  channel_used INTEGER NOT NULL DEFAULT 0 CHECK (channel_used IN (0, 1)),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (activity_date, installation_hash),
  FOREIGN KEY (installation_hash) REFERENCES product_analytics_installations(installation_hash)
);

CREATE INDEX idx_product_activity_daily_date
  ON product_activity_daily(activity_date, installation_hash);
