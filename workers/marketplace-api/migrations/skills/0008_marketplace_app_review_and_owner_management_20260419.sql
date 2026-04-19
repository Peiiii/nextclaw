ALTER TABLE marketplace_app_items
  ADD COLUMN owner_scope TEXT NOT NULL DEFAULT 'nextclaw';

ALTER TABLE marketplace_app_items
  ADD COLUMN owner_user_id TEXT;

ALTER TABLE marketplace_app_items
  ADD COLUMN owner_visibility TEXT NOT NULL DEFAULT 'public';

ALTER TABLE marketplace_app_items
  ADD COLUMN owner_deleted_at TEXT;

ALTER TABLE marketplace_app_items
  ADD COLUMN app_name TEXT;

ALTER TABLE marketplace_app_items
  ADD COLUMN publish_status TEXT NOT NULL DEFAULT 'published';

ALTER TABLE marketplace_app_items
  ADD COLUMN published_by_type TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE marketplace_app_items
  ADD COLUMN review_note TEXT;

ALTER TABLE marketplace_app_items
  ADD COLUMN reviewed_at TEXT;

UPDATE marketplace_app_items
SET owner_scope = CASE
  WHEN owner_scope IS NULL OR TRIM(owner_scope) = '' THEN substr(app_id, 1, instr(app_id, '.') - 1)
  ELSE owner_scope
END,
    app_name = CASE
      WHEN app_name IS NULL OR TRIM(app_name) = '' THEN substr(app_id, instr(app_id, '.') + 1)
      ELSE app_name
    END,
    owner_visibility = CASE
      WHEN owner_visibility IS NULL OR TRIM(owner_visibility) = '' THEN 'public'
      ELSE owner_visibility
    END,
    publish_status = CASE
      WHEN publish_status IS NULL OR TRIM(publish_status) = '' THEN 'published'
      ELSE publish_status
    END,
    published_by_type = CASE
      WHEN published_by_type IS NULL OR TRIM(published_by_type) = '' THEN 'admin'
      ELSE published_by_type
    END;

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_public_listing
  ON marketplace_app_items(publish_status, owner_visibility, owner_deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_owner_user_updated
  ON marketplace_app_items(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_owner_scope_app_name
  ON marketplace_app_items(owner_scope, app_name);
