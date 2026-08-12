ALTER TABLE marketplace_app_items
ADD COLUMN icon_sha256 TEXT;

ALTER TABLE marketplace_app_items
ADD COLUMN cover_sha256 TEXT;

UPDATE marketplace_app_items
SET icon_sha256 = (
      SELECT files.sha256
      FROM marketplace_app_files AS files
      WHERE files.item_id = marketplace_app_items.id
        AND files.path = json_extract(marketplace_app_items.manifest_json, '$.icon')
      LIMIT 1
    ),
    cover_sha256 = (
      SELECT files.sha256
      FROM marketplace_app_files AS files
      WHERE files.item_id = marketplace_app_items.id
        AND files.path = marketplace_app_items.cover_path
      LIMIT 1
    );

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_public_featured_cursor
  ON marketplace_app_items(
    publish_status,
    owner_visibility,
    owner_deleted_at,
    featured DESC,
    updated_at DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS idx_marketplace_app_items_public_updated_cursor
  ON marketplace_app_items(
    publish_status,
    owner_visibility,
    owner_deleted_at,
    updated_at DESC,
    id DESC
  );

CREATE TABLE IF NOT EXISTS marketplace_app_tags (
  item_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_tags_tag_item
  ON marketplace_app_tags(tag, item_id);

INSERT OR IGNORE INTO marketplace_app_tags (item_id, tag)
SELECT items.id, LOWER(TRIM(tags.value))
FROM marketplace_app_items AS items,
     json_each(items.tags) AS tags
WHERE json_type(items.tags) = 'array'
  AND TRIM(tags.value) <> '';

CREATE TRIGGER IF NOT EXISTS marketplace_app_tags_after_insert
AFTER INSERT ON marketplace_app_items
BEGIN
  INSERT OR IGNORE INTO marketplace_app_tags (item_id, tag)
  SELECT NEW.id, LOWER(TRIM(value))
  FROM json_each(NEW.tags)
  WHERE TRIM(value) <> '';
END;

CREATE TRIGGER IF NOT EXISTS marketplace_app_tags_after_update
AFTER UPDATE OF tags ON marketplace_app_items
BEGIN
  DELETE FROM marketplace_app_tags WHERE item_id = OLD.id;
  INSERT OR IGNORE INTO marketplace_app_tags (item_id, tag)
  SELECT NEW.id, LOWER(TRIM(value))
  FROM json_each(NEW.tags)
  WHERE TRIM(value) <> '';
END;

CREATE TRIGGER IF NOT EXISTS marketplace_app_tags_after_delete
AFTER DELETE ON marketplace_app_items
BEGIN
  DELETE FROM marketplace_app_tags WHERE item_id = OLD.id;
END;

CREATE VIRTUAL TABLE IF NOT EXISTS marketplace_app_search USING fts5(
  item_id UNINDEXED,
  slug,
  app_id,
  name,
  summary,
  description,
  tags,
  author,
  publisher_name,
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO marketplace_app_search (
  item_id,
  slug,
  app_id,
  name,
  summary,
  description,
  tags,
  author,
  publisher_name
)
SELECT
  id,
  slug,
  app_id,
  name,
  summary,
  COALESCE(description, ''),
  tags,
  author,
  publisher_name
FROM marketplace_app_items;

CREATE TRIGGER IF NOT EXISTS marketplace_app_search_after_insert
AFTER INSERT ON marketplace_app_items
BEGIN
  INSERT INTO marketplace_app_search (
    item_id,
    slug,
    app_id,
    name,
    summary,
    description,
    tags,
    author,
    publisher_name
  ) VALUES (
    NEW.id,
    NEW.slug,
    NEW.app_id,
    NEW.name,
    NEW.summary,
    COALESCE(NEW.description, ''),
    NEW.tags,
    NEW.author,
    NEW.publisher_name
  );
END;

CREATE TRIGGER IF NOT EXISTS marketplace_app_search_after_update
AFTER UPDATE OF slug, app_id, name, summary, description, tags, author, publisher_name
ON marketplace_app_items
BEGIN
  DELETE FROM marketplace_app_search WHERE item_id = OLD.id;
  INSERT INTO marketplace_app_search (
    item_id,
    slug,
    app_id,
    name,
    summary,
    description,
    tags,
    author,
    publisher_name
  ) VALUES (
    NEW.id,
    NEW.slug,
    NEW.app_id,
    NEW.name,
    NEW.summary,
    COALESCE(NEW.description, ''),
    NEW.tags,
    NEW.author,
    NEW.publisher_name
  );
END;

CREATE TRIGGER IF NOT EXISTS marketplace_app_search_after_delete
AFTER DELETE ON marketplace_app_items
BEGIN
  DELETE FROM marketplace_app_search WHERE item_id = OLD.id;
END;

PRAGMA optimize;
