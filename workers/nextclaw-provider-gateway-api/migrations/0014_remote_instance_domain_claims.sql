PRAGMA foreign_keys = ON;

CREATE TABLE remote_instance_domains (
  prefix TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('system', 'custom')),
  claimed_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(instance_id, kind),
  FOREIGN KEY (instance_id) REFERENCES remote_devices(id) ON DELETE CASCADE
);

CREATE INDEX idx_remote_instance_domains_instance
  ON remote_instance_domains(instance_id);

CREATE INDEX idx_remote_instance_domains_expiry
  ON remote_instance_domains(expires_at)
  WHERE expires_at IS NOT NULL;

INSERT INTO remote_instance_domains (
  prefix, instance_id, kind, claimed_at, expires_at, created_at, updated_at
)
SELECT 'nc-' || lower(replace(id, '-', '')),
       id,
       'system',
       COALESCE(domain_claimed_at, created_at, updated_at),
       NULL,
       COALESCE(domain_claimed_at, created_at, updated_at),
       updated_at
  FROM remote_devices;

INSERT OR IGNORE INTO remote_instance_domains (
  prefix, instance_id, kind, claimed_at, expires_at, created_at, updated_at
)
SELECT domain_prefix,
       id,
       'custom',
       COALESCE(domain_claimed_at, created_at, updated_at),
       domain_expires_at,
       COALESCE(domain_claimed_at, created_at, updated_at),
       updated_at
  FROM remote_devices
 WHERE domain_prefix IS NOT NULL
   AND domain_prefix != 'nc-' || lower(replace(id, '-', ''));
