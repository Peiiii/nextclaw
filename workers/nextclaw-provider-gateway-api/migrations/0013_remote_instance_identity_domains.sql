PRAGMA foreign_keys = ON;

ALTER TABLE remote_devices
  ADD COLUMN domain_prefix TEXT;

ALTER TABLE remote_devices
  ADD COLUMN domain_claimed_at TEXT;

ALTER TABLE remote_devices
  ADD COLUMN domain_expires_at TEXT;

UPDATE remote_devices
   SET domain_prefix = 'nc-' || lower(replace(id, '-', '')),
       domain_claimed_at = COALESCE(created_at, updated_at)
 WHERE domain_prefix IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_remote_devices_domain_prefix_unique
  ON remote_devices(domain_prefix)
  WHERE domain_prefix IS NOT NULL;
