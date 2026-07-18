import test from "node:test";
import assert from "node:assert/strict";

import {
  acquireRemoteBrowserConnection,
  consumeRemoteRequestQuota,
  createEmptyRemoteQuotaState,
  DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET,
  DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT,
  DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
  DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
  DEFAULT_REMOTE_QUOTA_WS_USAGE_REPORT_SIZE,
  readRemoteQuotaPlatformSummary,
  readRemoteQuotaUserSummary,
  recordRemoteWebSocketMessages,
  releaseRemoteBrowserConnection,
  REMOTE_PROXY_REQUEST_COST,
  REMOTE_RUNTIME_REQUEST_COST,
  settleAndLeaseRemoteBrowserMessages
} from "../dist/utils/remote-quota-decision.utils.js";

const CONFIG = {
  planProfile: "workers-free",
  instanceConnections: DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS,
  platformDailyWorkerRequestBudget: DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
  platformDailyDoRequestBudgetMilli: DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET * 1_000,
  platformDailyReservePercent: DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT,
  userDailyWorkerRequestUnits: DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
  userDailyDoRequestBudgetMilli: DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS * 1_000,
  wsMessageLeaseSize: DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
  wsUsageReportSize: DEFAULT_REMOTE_QUOTA_WS_USAGE_REPORT_SIZE
};

test("normal traffic has no short session rate limit", () => {
  const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
  let state = createEmptyRemoteQuotaState(nowMs);
  for (let index = 0; index < 1_000; index += 1) {
    const decision = consumeRemoteRequestQuota(state, CONFIG, {
      nowMs: nowMs + index,
      userId: "user-a",
      operationCost: REMOTE_RUNTIME_REQUEST_COST
    });
    assert.equal(decision.ok, true);
    state = decision.state;
  }
  assert.equal(readRemoteQuotaUserSummary(state, CONFIG, "user-a", nowMs + 1_000).day.workerRequests.actualUsed, 1_000);
});

test("runtime and proxy operations follow exact Worker and Durable Object request vectors", () => {
  const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
  const runtime = consumeRemoteRequestQuota(createEmptyRemoteQuotaState(nowMs), CONFIG, {
    nowMs,
    userId: "user-a",
    operationCost: REMOTE_RUNTIME_REQUEST_COST
  });
  assert.equal(runtime.ok, true);
  const proxy = consumeRemoteRequestQuota(runtime.state, CONFIG, {
    nowMs: nowMs + 1,
    userId: "user-a",
    operationCost: REMOTE_PROXY_REQUEST_COST
  });
  assert.equal(proxy.ok, true);

  const summary = readRemoteQuotaUserSummary(proxy.state, CONFIG, "user-a", nowMs + 2);
  assert.equal(summary.day.workerRequests.actualUsed, 2);
  assert.equal(summary.day.durableObjectRequests.actualUsed, 3);
  assert.equal(summary.recent.last30Minutes.workerRequests, 2);
  assert.equal(summary.recent.last30Minutes.durableObjectRequests, 3);
});

test("a rejected request is still recorded because its Worker and quota DO attempt already happened", () => {
  const nowMs = Date.UTC(2026, 6, 18, 0, 0, 0);
  const config = {
    ...CONFIG,
    platformDailyWorkerRequestBudget: 3,
    platformDailyReservePercent: 0,
    userDailyWorkerRequestUnits: 100
  };
  let state = createEmptyRemoteQuotaState(nowMs);
  for (let index = 0; index < 3; index += 1) {
    const decision = consumeRemoteRequestQuota(state, config, {
      nowMs: nowMs + index,
      userId: "user-a",
      operationCost: REMOTE_RUNTIME_REQUEST_COST
    });
    assert.equal(decision.ok, true);
    state = decision.state;
  }
  const rejected = consumeRemoteRequestQuota(state, config, {
    nowMs: nowMs + 4,
    userId: "user-a",
    operationCost: REMOTE_RUNTIME_REQUEST_COST
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "REMOTE_PLATFORM_WORKER_DAILY_BUDGET_EXCEEDED");
  assert.equal(readRemoteQuotaPlatformSummary(rejected.state, config, nowMs + 5).day.workerRequests.actualUsed, 4);
});

test("browser connection reserves its release and message settlement capacity", () => {
  const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
  const acquired = acquireRemoteBrowserConnection(createEmptyRemoteQuotaState(nowMs), CONFIG, {
    nowMs,
    userId: "user-a",
    ticket: "ticket-a",
    clientId: "client-a",
    sessionId: "session-a",
    instanceId: "instance-a"
  });
  assert.equal(acquired.ok, true);
  assert.equal(acquired.data.grantedMessages, 10);

  const summary = readRemoteQuotaUserSummary(acquired.state, CONFIG, "user-a", nowMs + 1);
  assert.equal(summary.day.workerRequests.actualUsed, 1);
  assert.equal(summary.day.durableObjectRequests.actualUsed, 2);
  assert.equal(summary.day.durableObjectRequests.reserved, 1.5);
  assert.equal(summary.activeBrowserConnections, 1);
});

test("browser message settlement converts reservation to actual usage and leases the next block", () => {
  const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
  const acquired = acquireBrowser(nowMs);
  const settled = settleAndLeaseRemoteBrowserMessages(acquired.state, CONFIG, {
    nowMs: nowMs + 1_000,
    userId: "user-a",
    ticket: "ticket-a",
    settledMessages: 10,
    requestedMessages: 10
  });
  assert.equal(settled.ok, true);
  assert.equal(settled.data.grantedMessages, 10);

  const summary = readRemoteQuotaUserSummary(settled.state, CONFIG, "user-a", nowMs + 2_000);
  assert.equal(summary.day.durableObjectRequests.actualUsed, 3.5);
  assert.equal(summary.day.durableObjectRequests.reserved, 1.5);
});

test("browser release settles remaining messages and removes every reservation", () => {
  const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
  const acquired = acquireBrowser(nowMs);
  const released = releaseRemoteBrowserConnection(acquired.state, {
    nowMs: nowMs + 1_000,
    userId: "user-a",
    ticket: "ticket-a",
    settledMessages: 4
  });
  assert.equal(released.ok, true);
  assert.equal(released.data.released, true);

  const summary = readRemoteQuotaUserSummary(released.state, CONFIG, "user-a", nowMs + 2_000);
  assert.equal(summary.day.durableObjectRequests.actualUsed, 3.2);
  assert.equal(summary.day.durableObjectRequests.reserved, 0);
  assert.equal(summary.activeBrowserConnections, 0);
});

test("connector incoming WebSocket messages use Cloudflare's 20-to-1 DO request ratio", () => {
  const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
  const recorded = recordRemoteWebSocketMessages(createEmptyRemoteQuotaState(nowMs), CONFIG, {
    nowMs,
    userId: "user-a",
    messages: 20
  });
  assert.equal(recorded.ok, true);
  const summary = readRemoteQuotaUserSummary(recorded.state, CONFIG, "user-a", nowMs + 1);
  assert.equal(summary.day.workerRequests.actualUsed, 0);
  assert.equal(summary.day.durableObjectRequests.actualUsed, 2);
});

test("connection cap remains a broad runaway guard and rejected attempts stay visible", () => {
  const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
  const config = { ...CONFIG, instanceConnections: 1 };
  const acquired = acquireBrowser(nowMs, config);
  const rejected = acquireRemoteBrowserConnection(acquired.state, config, {
    nowMs: nowMs + 1,
    userId: "user-b",
    ticket: "ticket-b",
    clientId: "client-b",
    sessionId: "session-b",
    instanceId: "instance-a"
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "REMOTE_INSTANCE_CONNECTION_LIMIT");
  assert.equal(readRemoteQuotaPlatformSummary(rejected.state, config, nowMs + 2).day.workerRequests.actualUsed, 2);
});

test("daily usage resets at 00:00 UTC while the cost model remains complete after its first day", () => {
  const dayOne = Date.UTC(2026, 6, 18, 23, 59, 59);
  const consumed = consumeRemoteRequestQuota(createEmptyRemoteQuotaState(dayOne), CONFIG, {
    nowMs: dayOne,
    userId: "user-a",
    operationCost: REMOTE_RUNTIME_REQUEST_COST
  });
  assert.equal(consumed.ok, true);
  const dayTwo = Date.UTC(2026, 6, 19, 0, 0, 1);
  const summary = readRemoteQuotaUserSummary(consumed.state, CONFIG, "user-a", dayTwo);
  assert.equal(summary.day.workerRequests.actualUsed, 0);
  assert.equal(summary.costModel.partialDay, false);
  assert.equal(summary.day.startsAt, "2026-07-19T00:00:00.000Z");
});

test("v1 stored state is not misrepresented as exact v2 usage", () => {
  const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
  const legacyState = {
    platformDailyUsage: { dayKey: "2026-07-18", workerRequestUnits: 999, durableObjectMilliUnits: 999_000 },
    users: {}
  };
  const summary = readRemoteQuotaPlatformSummary(legacyState, CONFIG, nowMs);
  assert.equal(summary.day.workerRequests.actualUsed, 0);
  assert.equal(summary.costModel.version, 2);
  assert.equal(summary.costModel.partialDay, true);
});

test("one thousand active-user hourly projections stay below the SQLite-backed DO value limit", () => {
  const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
  const state = createEmptyRemoteQuotaState(nowMs);
  for (let userIndex = 0; userIndex < 1_000; userIndex += 1) {
    state.users[`user-${userIndex}`] = {
      browserConnections: {},
      dailyUsage: {
        dayKey: "2026-07-18",
        workerRequestUnits: 12,
        durableObjectMilliUnits: 12_000
      },
      dailyReserved: {
        dayKey: "2026-07-18",
        workerRequestUnits: 0,
        durableObjectMilliUnits: 0
      },
      recentUsage: Array.from({ length: 12 }, (_value, bucketIndex) => ({
        startedAtMs: nowMs - bucketIndex * 5 * 60 * 1_000,
        workerRequestUnits: 1,
        durableObjectMilliUnits: 1_000
      }))
    };
  }
  assert.ok(Buffer.byteLength(JSON.stringify(state)) < 2_000_000);
});

function acquireBrowser(nowMs, config = CONFIG) {
  const acquired = acquireRemoteBrowserConnection(createEmptyRemoteQuotaState(nowMs), config, {
    nowMs,
    userId: "user-a",
    ticket: "ticket-a",
    clientId: "client-a",
    sessionId: "session-a",
    instanceId: "instance-a"
  });
  assert.equal(acquired.ok, true);
  return acquired;
}
