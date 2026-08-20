import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { productActivityIngestHandler } from "../dist/controllers/product-activity.controller.js";
import {
  parseProductActivityInput,
  ProductActivityService,
} from "../dist/services/product-activity.service.js";

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

  run = async () => {
    const result = this.statement.run(...this.bindings);
    return { success: true, meta: { changes: Number(result.changes) } };
  };
}

class LocalD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare = (sql) => new LocalD1Statement(this.database, sql);

  batch = async (statements) => await Promise.all(statements.map((statement) => statement.run()));
}

const database = new DatabaseSync(":memory:");
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL,
    analytics_audience TEXT NOT NULL,
    free_limit_usd REAL NOT NULL,
    free_used_usd REAL NOT NULL,
    paid_balance_usd REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE product_analytics_installations (
    installation_hash TEXT PRIMARY KEY,
    linked_user_id TEXT,
    audience TEXT NOT NULL,
    environment TEXT NOT NULL,
    release_channel TEXT NOT NULL,
    platform TEXT NOT NULL,
    app_version TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY (linked_user_id) REFERENCES users(id)
  );
  CREATE TABLE product_activity_daily (
    activity_date TEXT NOT NULL,
    installation_hash TEXT NOT NULL,
    intent_accepted INTEGER NOT NULL DEFAULT 0,
    run_succeeded INTEGER NOT NULL DEFAULT 0,
    direct_used INTEGER NOT NULL DEFAULT 0,
    channel_used INTEGER NOT NULL DEFAULT 0,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY (activity_date, installation_hash),
    FOREIGN KEY (installation_hash) REFERENCES product_analytics_installations(installation_hash)
  );
`);

const insertUser = database.prepare(`
  INSERT INTO users (
    id, email, username, password_hash, password_salt, role, analytics_audience,
    free_limit_usd, free_used_usd, paid_balance_usd, created_at, updated_at
  ) VALUES (?, ?, NULL, 'hash', 'salt', ?, ?, 0, 0, 0, ?, ?)
`);

function createUser(id, role = "user", analyticsAudience = "external") {
  const now = "2026-08-20T00:00:00.000Z";
  insertUser.run(id, `${id}@example.com`, role, analyticsAudience, now, now);
  return {
    id,
    email: `${id}@example.com`,
    username: null,
    password_hash: "hash",
    password_salt: "salt",
    role,
    analytics_audience: analyticsAudience,
    free_limit_usd: 0,
    free_used_usd: 0,
    paid_balance_usd: 0,
    created_at: now,
    updated_at: now,
  };
}

const externalUser = createUser("external-user");
const qaUser = createUser("qa-user", "user", "qa");
const adminUser = createUser("admin-user", "admin", "external");
const d1 = new LocalD1Database(database);
const env = {
  AUTH_TOKEN_SECRET: "product-activity-test-secret-at-least-32-characters",
  NEXTCLAW_PLATFORM_DB: d1,
};

function input(installationId, overrides = {}) {
  return {
    schemaVersion: 1,
    installationId,
    event: "intent_accepted",
    occurredAt: "2026-08-20T12:00:00.000Z",
    source: "direct",
    audience: "external",
    environment: "production",
    releaseChannel: "stable",
    platform: "macos",
    appVersion: "0.3.41",
    ...overrides,
  };
}

const anonymousId = "11111111-1111-4111-8111-111111111111";
const userInstallOne = "22222222-2222-4222-8222-222222222222";
const userInstallTwo = "33333333-3333-4333-8333-333333333333";
const internalId = "44444444-4444-4444-8444-444444444444";
const qaId = "55555555-5555-4555-8555-555555555555";
const adminId = "66666666-6666-4666-8666-666666666666";

const todayService = new ProductActivityService(env, () => new Date("2026-08-20T12:00:00.000Z"));
await todayService.ingest(input(anonymousId), null);
await todayService.ingest(input(anonymousId), null);
await todayService.ingest(input(anonymousId, { event: "run_succeeded" }), null);
await todayService.ingest(input(userInstallOne), externalUser);
await todayService.ingest(input(userInstallTwo), externalUser);
await todayService.ingest(input(userInstallTwo, { event: "run_succeeded" }), externalUser);
await todayService.ingest(input(internalId, { audience: "internal" }), null);
await todayService.ingest(input(qaId), qaUser);
await todayService.ingest(input(adminId), adminUser);

const overview = await todayService.readOverview({
  audience: "external",
  environment: "production",
  releaseChannel: "stable",
  trendDays: 30,
});
assert.equal(overview.metrics.dau, 2);
assert.equal(overview.metrics.wau, 2);
assert.equal(overview.metrics.mau, 2);
assert.equal(overview.metrics.successfulDau, 2);
assert.equal(overview.metrics.wauAnonymousInstallations, 1);
assert.equal(overview.metrics.wauIdentifiedUsers, 1);
assert.equal(overview.metrics.wauIdentificationRate, 0.5);
assert.equal(overview.trend.length, 30);
assert.deepEqual(overview.trend.at(-1), {
  date: "2026-08-20",
  active: 2,
  successful: 2,
});

const qaOverview = await todayService.readOverview({
  audience: "qa",
  environment: "production",
  releaseChannel: "stable",
  trendDays: 7,
});
assert.equal(qaOverview.metrics.dau, 1);
const internalOverview = await todayService.readOverview({
  audience: "internal",
  environment: "production",
  releaseChannel: "stable",
  trendDays: 7,
});
assert.equal(internalOverview.metrics.dau, 2);

const storedInstallations = database.prepare(
  "SELECT installation_hash FROM product_analytics_installations",
).all();
assert.ok(storedInstallations.every((row) => /^[a-f0-9]{64}$/.test(row.installation_hash)));
assert.ok(storedInstallations.every((row) => row.installation_hash !== anonymousId));

const duplicateDailyRows = database.prepare(
  "SELECT COUNT(*) AS count FROM product_activity_daily WHERE activity_date = '2026-08-20'",
).get();
assert.equal(duplicateDailyRows.count, 6);

assert.equal(parseProductActivityInput({
  ...input(anonymousId),
  message: "private text",
}, new Date("2026-08-20T12:00:00.000Z")).ok, false);
assert.equal(parseProductActivityInput(
  input(anonymousId, { occurredAt: "2025-01-01T00:00:00.000Z" }),
  new Date("2026-08-20T12:00:00.000Z"),
).ok, false);

const routeApp = new Hono();
routeApp.post("/platform/analytics/activity", productActivityIngestHandler);
const routeResponse = await routeApp.request(
  "http://localhost/platform/analytics/activity",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input("77777777-7777-4777-8777-777777777777", {
      audience: "internal",
    })),
  },
  env,
);
assert.equal(routeResponse.status, 202);
assert.equal(await routeResponse.text(), "");

database.close();
console.log("[product-activity] passed");
