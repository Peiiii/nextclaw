CREATE TABLE distribution_download_assets (
  source TEXT NOT NULL CHECK (source IN ('github_release', 'npm_registry')),
  asset_key TEXT NOT NULL,
  release_tag TEXT,
  asset_name TEXT NOT NULL,
  artifact_kind TEXT NOT NULL,
  platform TEXT,
  architecture TEXT,
  latest_download_count INTEGER NOT NULL DEFAULT 0 CHECK (latest_download_count >= 0),
  first_observed_at TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  PRIMARY KEY (source, asset_key)
);

CREATE INDEX idx_distribution_download_assets_release
  ON distribution_download_assets(source, release_tag, artifact_kind);

CREATE TABLE distribution_download_daily (
  source TEXT NOT NULL CHECK (source IN ('github_release', 'npm_registry')),
  asset_key TEXT NOT NULL,
  business_date TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  observed_at TEXT NOT NULL,
  PRIMARY KEY (source, asset_key, business_date),
  FOREIGN KEY (source, asset_key)
    REFERENCES distribution_download_assets(source, asset_key)
);

CREATE INDEX idx_distribution_download_daily_date
  ON distribution_download_daily(source, business_date);

CREATE TABLE distribution_download_sync_state (
  source TEXT PRIMARY KEY CHECK (source IN ('github_release', 'npm_registry')),
  last_attempt_at TEXT NOT NULL,
  last_success_at TEXT,
  last_error TEXT
);
