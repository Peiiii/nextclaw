CREATE TABLE IF NOT EXISTS marketplace_app_items (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  app_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  summary_i18n TEXT NOT NULL,
  description TEXT,
  description_i18n TEXT,
  tags TEXT NOT NULL,
  author TEXT NOT NULL,
  source_repo TEXT,
  homepage TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  publisher_id TEXT NOT NULL,
  publisher_name TEXT NOT NULL,
  publisher_url TEXT,
  latest_version TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_slug
  ON marketplace_app_items(slug);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_app_id
  ON marketplace_app_items(app_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_featured_updated
  ON marketplace_app_items(featured, updated_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_app_versions (
  item_id TEXT NOT NULL,
  version TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  description TEXT,
  bundle_sha256 TEXT NOT NULL,
  bundle_storage_key TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (item_id, version)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_versions_item_id
  ON marketplace_app_versions(item_id);

CREATE TABLE IF NOT EXISTS marketplace_app_files (
  item_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (item_id, path)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_files_item_id
  ON marketplace_app_files(item_id);
