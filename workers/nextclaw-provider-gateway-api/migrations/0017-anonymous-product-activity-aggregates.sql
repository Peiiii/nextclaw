CREATE TABLE anonymous_product_activity_receipts (
  receipt_id TEXT PRIMARY KEY,
  metric TEXT NOT NULL CHECK (metric IN ('active', 'successful')),
  period_kind TEXT NOT NULL CHECK (period_kind IN ('day', 'week', 'month')),
  period_start TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('external', 'internal', 'qa')),
  environment TEXT NOT NULL CHECK (environment IN ('production', 'development', 'test')),
  release_channel TEXT NOT NULL CHECK (release_channel IN ('stable', 'beta', 'nightly', 'development')),
  platform TEXT NOT NULL CHECK (platform IN ('macos', 'windows', 'linux', 'other')),
  app_version TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX idx_anonymous_product_activity_metrics
  ON anonymous_product_activity_receipts (
    audience, environment, release_channel, period_kind, period_start, metric
  );

CREATE INDEX idx_anonymous_product_activity_retention
  ON anonymous_product_activity_receipts (received_at);
