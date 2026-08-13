ALTER TABLE marketplace_app_items
ADD COLUMN manifest_schema_version INTEGER NOT NULL DEFAULT 1
  CHECK (manifest_schema_version IN (1, 2));

ALTER TABLE marketplace_app_items
ADD COLUMN catalog_visibility TEXT NOT NULL DEFAULT 'listed'
  CHECK (catalog_visibility IN ('listed', 'unlisted'));

UPDATE marketplace_app_items
SET manifest_schema_version = CASE
      WHEN CAST(json_extract(manifest_json, '$.schemaVersion') AS INTEGER) >= 2 THEN 2
      ELSE 1
    END,
    catalog_visibility = CASE
      WHEN CAST(json_extract(manifest_json, '$.schemaVersion') AS INTEGER) >= 2 THEN 'listed'
      ELSE 'unlisted'
    END;

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_product_featured_cursor
  ON marketplace_app_items(
    publish_status,
    owner_visibility,
    owner_deleted_at,
    catalog_visibility,
    manifest_schema_version,
    featured DESC,
    updated_at DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_product_updated_cursor
  ON marketplace_app_items(
    publish_status,
    owner_visibility,
    owner_deleted_at,
    catalog_visibility,
    manifest_schema_version,
    updated_at DESC,
    id DESC
  );
