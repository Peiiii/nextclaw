-- Private reports are deliberately separate from the public community projection.
CREATE TABLE support_reports (
  id TEXT PRIMARY KEY,
  receipt_hash TEXT NOT NULL,
  user_id TEXT,
  payload_hash TEXT NOT NULL,
  document TEXT NOT NULL CHECK(json_valid(document)),
  revision INTEGER NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX support_reports_queue ON support_reports(status, priority, created_at, id);
CREATE INDEX support_reports_owner ON support_reports(user_id, created_at, id);
CREATE TABLE support_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
