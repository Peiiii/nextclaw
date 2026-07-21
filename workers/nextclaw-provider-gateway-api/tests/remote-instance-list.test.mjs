import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { listRemoteInstancesByUserId } from "../dist/repositories/remote-instance.repository.js";

class LocalD1Statement {
  constructor(database, sql) {
    this.statement = database.prepare(sql);
    this.bindings = [];
  }

  bind = (...bindings) => {
    this.bindings = bindings;
    return this;
  };

  first = async () => {
    return this.statement.get(...this.bindings) ?? null;
  };

  all = async () => {
    return { results: this.statement.all(...this.bindings) };
  };
}

class LocalD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare = (sql) => {
    return new LocalD1Statement(this.database, sql);
  };
}

const database = new DatabaseSync(":memory:");
database.exec(`
  CREATE TABLE remote_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_install_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    app_version TEXT NOT NULL,
    local_origin TEXT NOT NULL,
    status TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE remote_instance_domains (
    prefix TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    claimed_at TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(instance_id, kind)
  );
`);

const insert = database.prepare(`
  INSERT INTO remote_devices (
    id, user_id, device_install_id, display_name, platform, app_version,
    local_origin, status, last_seen_at, archived_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertDomain = database.prepare(`
  INSERT INTO remote_instance_domains (
    prefix, instance_id, kind, claimed_at, expires_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, NULL, ?, ?)
`);

function seedInstance({
  id,
  userId = "user-1",
  name,
  platform = "darwin",
  status,
  archivedAt = null,
  lastSeenAt,
}) {
  insert.run(
    id,
    userId,
    `install-${id}`,
    name,
    platform,
    "0.25.3",
    "http://127.0.0.1:55667",
    status,
    lastSeenAt,
    archivedAt,
    "2026-07-01T00:00:00.000Z",
    lastSeenAt,
  );
  insertDomain.run(
    `i-system-${id}`,
    id,
    "system",
    "2026-07-01T00:00:00.000Z",
    "2026-07-01T00:00:00.000Z",
    lastSeenAt,
  );
  insertDomain.run(
    `domain-${id}`,
    id,
    "custom",
    "2026-07-01T00:00:00.000Z",
    "2026-07-01T00:00:00.000Z",
    lastSeenAt,
  );
}

for (let index = 1; index <= 13; index += 1) {
  seedInstance({
    id: `active-${index}`,
    name:
      index === 13
        ? "100% Linux Runner"
        : `MacBook ${String(index).padStart(2, "0")}`,
    platform: index === 13 ? "linux" : "darwin",
    status: index % 2 === 0 ? "offline" : "online",
    lastSeenAt: `2026-07-${String(14 - index).padStart(2, "0")}T00:00:00.000Z`,
  });
}
seedInstance({
  id: "archived-1",
  name: "Archived One",
  status: "offline",
  archivedAt: "2026-07-14T00:00:00.000Z",
  lastSeenAt: "2026-06-01T00:00:00.000Z",
});
seedInstance({
  id: "archived-2",
  name: "Archived Two",
  status: "offline",
  archivedAt: "2026-07-15T00:00:00.000Z",
  lastSeenAt: "2026-06-02T00:00:00.000Z",
});
seedInstance({
  id: "other-user",
  userId: "user-2",
  name: "Other User",
  status: "online",
  lastSeenAt: "2026-07-18T00:00:00.000Z",
});

const d1 = new LocalD1Database(database);
const baseQuery = {
  archiveStatus: "active",
  connectionStatus: "all",
  q: "",
  page: 1,
  pageSize: 10,
  sortBy: "lastSeenAt",
  sortDirection: "desc",
};

const firstPage = await listRemoteInstancesByUserId(d1, "user-1", baseQuery);
assert.equal(firstPage.total, 13);
assert.equal(firstPage.rows.length, 10);
assert.equal(firstPage.rows[0].id, "active-1");

const secondPage = await listRemoteInstancesByUserId(d1, "user-1", {
  ...baseQuery,
  page: 2,
});
assert.equal(secondPage.total, 13);
assert.equal(secondPage.rows.length, 3);

const archived = await listRemoteInstancesByUserId(d1, "user-1", {
  ...baseQuery,
  archiveStatus: "archived",
});
assert.equal(archived.total, 2);
assert.ok(archived.rows.every((row) => row.archived_at));

const offline = await listRemoteInstancesByUserId(d1, "user-1", {
  ...baseQuery,
  connectionStatus: "offline",
});
assert.equal(offline.total, 6);
assert.ok(offline.rows.every((row) => row.status === "offline"));

const literalSearch = await listRemoteInstancesByUserId(d1, "user-1", {
  ...baseQuery,
  q: "100%",
});
assert.equal(literalSearch.total, 1);
assert.equal(literalSearch.rows[0].id, "active-13");

const domainSearch = await listRemoteInstancesByUserId(d1, "user-1", {
  ...baseQuery,
  q: "domain-active-4",
});
assert.equal(domainSearch.total, 1);
assert.equal(domainSearch.rows[0].id, "active-4");

const originSearch = await listRemoteInstancesByUserId(d1, "user-1", {
  ...baseQuery,
  q: "55667",
});
assert.equal(originSearch.total, 13);

const nameSort = await listRemoteInstancesByUserId(d1, "user-1", {
  ...baseQuery,
  pageSize: 20,
  sortBy: "displayName",
  sortDirection: "asc",
});
assert.equal(nameSort.rows[0].display_name, "100% Linux Runner");
assert.equal(nameSort.rows.at(-1).display_name, "MacBook 12");

database.close();
console.log("[remote-instance-list] passed");
