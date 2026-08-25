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
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL,
    analytics_audience TEXT NOT NULL DEFAULT 'external',
    free_limit_usd REAL NOT NULL DEFAULT 0,
    free_used_usd REAL NOT NULL DEFAULT 0,
    paid_balance_usd REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE anonymous_product_activity_receipts (
    receipt_id TEXT PRIMARY KEY,
    metric TEXT NOT NULL,
    period_kind TEXT NOT NULL,
    period_start TEXT NOT NULL,
    audience TEXT NOT NULL,
    environment TEXT NOT NULL,
    release_channel TEXT NOT NULL,
    platform TEXT NOT NULL,
    app_version TEXT NOT NULL,
    received_at TEXT NOT NULL
  );
`);

const d1 = new LocalD1Database(database);
const env = {
  AUTH_TOKEN_SECRET: "product-activity-test-secret-at-least-32-characters",
  NEXTCLAW_PLATFORM_DB: d1,
};
const now = new Date("2026-08-25T12:00:00.000Z");
const service = new ProductActivityService(env, () => now);

function input(receiptId, overrides = {}) {
  return {
    schemaVersion: 2,
    receiptId,
    metric: "active",
    periodKind: "day",
    periodStart: "2026-08-25",
    occurredAt: "2026-08-25T12:00:00.000Z",
    audience: "external",
    environment: "production",
    releaseChannel: "stable",
    platform: "macos",
    appVersion: "0.43",
    ...overrides,
  };
}

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
  "77777777-7777-4777-8777-777777777777",
  "88888888-8888-4888-8888-888888888888",
];

await service.ingest(input(ids[0]));
await service.ingest(input(ids[0]));
await service.ingest(input(ids[1], { metric: "successful" }));
await service.ingest(input(ids[2], { periodKind: "week", periodStart: "2026-08-24" }));
await service.ingest(input(ids[3], {
  metric: "successful",
  periodKind: "week",
  periodStart: "2026-08-24",
}));
await service.ingest(input(ids[4], { periodKind: "month", periodStart: "2026-08-01" }));
await service.ingest(input(ids[5], {
  metric: "successful",
  periodKind: "month",
  periodStart: "2026-08-01",
}));
await service.ingest(input(ids[6]));
await service.ingest(input(ids[7], { audience: "internal" }));

const overview = await service.readOverview({
  audience: "external",
  environment: "production",
  releaseChannel: "stable",
  trendDays: 30,
});
assert.deepEqual(overview.metrics, {
  dau: 2,
  wau: 1,
  mau: 1,
  successfulDau: 1,
  successfulWau: 1,
  successfulMau: 1,
});
assert.equal(overview.trend.length, 30);
assert.deepEqual(overview.trend.at(-1), {
  date: "2026-08-25",
  active: 2,
  successful: 1,
});

const internalOverview = await service.readOverview({
  audience: "internal",
  environment: "production",
  releaseChannel: "stable",
  trendDays: 7,
});
assert.equal(internalOverview.metrics.dau, 1);

const storedRows = database.prepare(
  "SELECT * FROM anonymous_product_activity_receipts ORDER BY receipt_id",
).all();
assert.equal(storedRows.length, 8);
assert.ok(storedRows.every((row) => !("installation_id" in row)));
assert.ok(storedRows.every((row) => !("linked_user_id" in row)));

assert.equal(parseProductActivityInput({
  ...input(ids[0]),
  message: "private text",
}, now).ok, false);
assert.equal(parseProductActivityInput({
  ...input(ids[0]),
  schemaVersion: 1,
  installationId: ids[0],
}, now).ok, false);
assert.equal(parseProductActivityInput(input(ids[0], {
  periodKind: "week",
  periodStart: "2026-08-25",
}), now).ok, false);
assert.equal(parseProductActivityInput(input(ids[0], {
  occurredAt: "2025-01-01T00:00:00.000Z",
}), now).ok, false);

const routeApp = new Hono();
routeApp.post("/platform/analytics/activity", productActivityIngestHandler);
const routeResponse = await routeApp.request(
  "http://localhost/platform/analytics/activity",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer must-not-be-used-for-anonymous-analytics",
    },
    body: JSON.stringify(input("99999999-9999-4999-8999-999999999999", {
      audience: "internal",
    })),
  },
  env,
);
assert.equal(routeResponse.status, 202);
assert.equal(await routeResponse.text(), "");

database.close();
console.log("[product-activity] passed");
