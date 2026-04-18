ALTER TABLE marketplace_skill_items
  ADD COLUMN owner_visibility TEXT NOT NULL DEFAULT 'public';

ALTER TABLE marketplace_skill_items
  ADD COLUMN owner_deleted_at TEXT;

UPDATE marketplace_skill_items
SET owner_visibility = 'public'
WHERE owner_visibility IS NULL
   OR TRIM(owner_visibility) = '';

CREATE INDEX IF NOT EXISTS idx_marketplace_skill_items_owner_user_updated
  ON marketplace_skill_items(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_skill_items_public_listing
  ON marketplace_skill_items(publish_status, owner_visibility, owner_deleted_at, updated_at DESC);
