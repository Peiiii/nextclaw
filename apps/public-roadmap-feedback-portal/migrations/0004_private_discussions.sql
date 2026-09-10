CREATE TABLE discussion_threads (
  id TEXT PRIMARY KEY,
  space TEXT NOT NULL,
  title TEXT NOT NULL,
  opened_by_json TEXT NOT NULL CHECK(json_valid(opened_by_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_event_cursor INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX discussion_threads_space_activity
  ON discussion_threads(space, last_event_cursor DESC, id);

CREATE TABLE discussion_posts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  author_json TEXT NOT NULL CHECK(json_valid(author_json)),
  body TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(thread_id, sequence),
  FOREIGN KEY(thread_id) REFERENCES discussion_threads(id) ON DELETE CASCADE
);

CREATE INDEX discussion_posts_thread_sequence
  ON discussion_posts(thread_id, sequence);

CREATE TABLE discussion_events (
  cursor INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  post_id TEXT,
  audience_role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(thread_id) REFERENCES discussion_threads(id) ON DELETE CASCADE
);

CREATE INDEX discussion_events_audience_cursor
  ON discussion_events(audience_role, cursor);

INSERT INTO discussion_threads
  (id, space, title, opened_by_json, created_at, updated_at)
SELECT
  id,
  'support',
  json_extract(document, '$.report.title'),
  CASE WHEN user_id IS NULL
    THEN json_object('id', NULL, 'kind', 'anonymous', 'displayName', '匿名用户', 'roles', json_array('reporter'), 'authenticated', json('false'))
    ELSE json_object('id', user_id, 'kind', 'human', 'displayName', '已验证用户', 'roles', json_array('reporter'), 'authenticated', json('true'))
  END,
  created_at,
  updated_at
FROM support_reports;

INSERT INTO discussion_posts
  (id, thread_id, sequence, author_json, body, payload_hash, created_at)
SELECT
  id || ':opening',
  id,
  1,
  CASE WHEN user_id IS NULL
    THEN json_object('id', NULL, 'kind', 'anonymous', 'displayName', '匿名用户', 'roles', json_array('reporter'), 'authenticated', json('false'))
    ELSE json_object('id', user_id, 'kind', 'human', 'displayName', '已验证用户', 'roles', json_array('reporter'), 'authenticated', json('true'))
  END,
  json_extract(document, '$.report.description'),
  payload_hash,
  created_at
FROM support_reports;

INSERT INTO discussion_posts
  (id, thread_id, sequence, author_json, body, payload_hash, created_at)
SELECT
  json_extract(message.value, '$.id'),
  support_reports.id,
  CAST(message.key AS INTEGER) + 2,
  CASE json_extract(message.value, '$.role')
    WHEN 'user' THEN CASE WHEN support_reports.user_id IS NULL
      THEN json_object('id', NULL, 'kind', 'anonymous', 'displayName', '匿名用户', 'roles', json_array('reporter'), 'authenticated', json('false'))
      ELSE json_object('id', support_reports.user_id, 'kind', 'human', 'displayName', '已验证用户', 'roles', json_array('reporter'), 'authenticated', json('true'))
    END
    ELSE json_object('id', NULL, 'kind', 'service', 'displayName', '维护者（历史）', 'roles', json_array('legacy-maintainer'), 'authenticated', json('false'))
  END,
  json_extract(message.value, '$.body'),
  'legacy',
  json_extract(message.value, '$.createdAt')
FROM support_reports, json_each(support_reports.document, '$.report.messages') AS message;

INSERT INTO discussion_events(event_type, thread_id, post_id, audience_role, created_at)
SELECT 'thread-updated', id, NULL, 'administrator', updated_at FROM support_reports;

UPDATE discussion_threads
SET last_event_cursor = (
  SELECT MAX(cursor) FROM discussion_events WHERE thread_id = discussion_threads.id
);

UPDATE support_reports
SET document = json_remove(
  document,
  '$.report.title',
  '$.report.description',
  '$.report.messages',
  '$.report.openedBy'
);
