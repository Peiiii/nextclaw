ALTER TABLE marketplace_app_versions
ADD COLUMN distribution_mode TEXT NOT NULL DEFAULT 'bundle';
