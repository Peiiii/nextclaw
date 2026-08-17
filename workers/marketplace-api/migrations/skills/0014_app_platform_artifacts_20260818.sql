CREATE TABLE IF NOT EXISTS marketplace_app_artifacts (
  item_id TEXT NOT NULL,
  version TEXT NOT NULL,
  target_key TEXT NOT NULL,
  target_json TEXT NOT NULL,
  bundle_sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  bundle_storage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (item_id, version, target_key),
  FOREIGN KEY (item_id, version)
    REFERENCES marketplace_app_versions(item_id, version)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_artifacts_version_status
  ON marketplace_app_artifacts(item_id, version, status, target_key);
