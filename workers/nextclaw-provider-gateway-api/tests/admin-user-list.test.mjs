import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { listAdminUsers } from "../dist/repositories/admin-user.repository.js";

class LocalD1Statement {
  constructor(database, sql) {
    this.statement = database.prepare(sql);
    this.bindings = [];
  }

  bind = (...bindings) => {
    this.bindings = bindings;
    return this;
  };

  first = async () => this.statement.get(...this.bindings) ?? null;

  all = async () => ({ results: this.statement.all(...this.bindings) });
}

class LocalD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare = (sql) => new LocalD1Statement(this.database, sql);
}

const database = new DatabaseSync(":memory:");
database.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL,
    free_limit_usd REAL NOT NULL,
    free_used_usd REAL NOT NULL,
    paid_balance_usd REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
const insert = database.prepare(`
  INSERT INTO users (
    id, email, username, password_hash, password_salt, role,
    free_limit_usd, free_used_usd, paid_balance_usd, created_at, updated_at
  ) VALUES (?, ?, ?, 'hash', 'salt', ?, ?, ?, ?, ?, ?)
`);

for (let index = 1; index <= 13; index += 1) {
  const day = String(index).padStart(2, "0");
  insert.run(
    `user-${index}`,
    index === 13 ? "percent%user@example.com" : `user${day}@example.com`,
    index === 12 ? "target_admin" : `person_${index}`,
    index >= 12 ? "admin" : "user",
    20,
    index,
    20 - index,
    `2026-07-${day}T00:00:00.000Z`,
    `2026-07-${day}T01:00:00.000Z`,
  );
}

const d1 = new LocalD1Database(database);
const baseQuery = {
  q: "",
  role: "all",
  page: 1,
  pageSize: 10,
  sortBy: "createdAt",
  sortDirection: "desc",
};

const firstPage = await listAdminUsers(d1, baseQuery);
assert.deepEqual(firstPage.counts, { all: 13, admin: 2, user: 11 });
assert.equal(firstPage.total, 13);
assert.equal(firstPage.rows.length, 10);
assert.equal(firstPage.rows[0].id, "user-13");

const secondPage = await listAdminUsers(d1, { ...baseQuery, page: 2 });
assert.equal(secondPage.rows.length, 3);
assert.equal(secondPage.rows.at(-1).id, "user-1");

const admins = await listAdminUsers(d1, { ...baseQuery, role: "admin" });
assert.equal(admins.total, 2);
assert.ok(admins.rows.every((row) => row.role === "admin"));

const usernameSearch = await listAdminUsers(d1, { ...baseQuery, q: "target_admin" });
assert.equal(usernameSearch.total, 1);
assert.equal(usernameSearch.rows[0].id, "user-12");

const literalSearch = await listAdminUsers(d1, { ...baseQuery, q: "%" });
assert.equal(literalSearch.total, 1);
assert.equal(literalSearch.rows[0].id, "user-13");

const balanceSort = await listAdminUsers(d1, {
  ...baseQuery,
  pageSize: 20,
  sortBy: "paidBalanceUsd",
  sortDirection: "asc",
});
assert.equal(balanceSort.rows[0].id, "user-13");
assert.equal(balanceSort.rows.at(-1).id, "user-1");

database.close();
console.log("[admin-user-list] passed");
