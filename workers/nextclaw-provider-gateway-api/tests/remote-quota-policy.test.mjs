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
  DEFAULT_REMOTE_QUOTA_SESSION_REQUESTS_PER_MINUTE,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
  leaseRemoteBrowserMessages,
  readRemoteQuotaPlatformSummary,
  readRemoteQuotaUserSummary,
  releaseRemoteBrowserConnection,
  REMOTE_BROWSER_CONNECT_COST,
  REMOTE_PROXY_REQUEST_COST,
  REMOTE_RUNTIME_REQUEST_COST
} from "../dist/services/remote-quota/remote-quota.service.js";

const CONFIG = {
  sessionRequestsPerMinute: DEFAULT_REMOTE_QUOTA_SESSION_REQUESTS_PER_MINUTE,
  instanceConnections: DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS,
  platformDailyWorkerRequestBudget: DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
  platformDailyDoRequestBudgetMilli: DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET * 1000,
  platformDailyReservePercent: DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT,
  userDailyWorkerRequestUnits: DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
  userDailyDoRequestBudgetMilli: DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS * 1000,
  wsMessageLeaseSize: DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE
};

test("session request quota rejects after the configured per-minute budget", () => {
  const nowMs = Date.UTC(2026, 2, 24, 12, 0, 0);
  let state = createEmptyRemoteQuotaState(nowMs);

  for (let index = 0; index < CONFIG.sessionRequestsPerMinute; index += 1) {
    const decision = consumeRemoteRequestQuota(state, CONFIG, {
      nowMs: nowMs + index,
      userId: "user-a",
      sessionId: "session-a",
      operationCost: REMOTE_RUNTIME_REQUEST_COST
    });
    assert.equal(decision.ok, true);
    state = decision.state;
  }

  const rejected = consumeRemoteRequestQuota(state, CONFIG, {
    nowMs: nowMs + 1_000,
    userId: "user-a",
    sessionId: "session-a",
    operationCost: REMOTE_RUNTIME_REQUEST_COST
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "REMOTE_SESSION_RATE_LIMITED");
});

test("connection quota only enforces the instance cap", () => {
  const nowMs = Date.UTC(2026, 2, 24, 12, 0, 0);
  let state = createEmptyRemoteQuotaState(nowMs);
  const limitedConfig = {
    ...CONFIG,
    instanceConnections: 3
  };

  for (let index = 0; index < limitedConfig.instanceConnections; index += 1) {
    const decision = acquireRemoteBrowserConnection(state, limitedConfig, {
      nowMs: nowMs + index,
      userId: `user-${index}`,
      ticket: `instance-ticket-${index}`,
      clientId: `instance-client-${index}`,
      sessionId: `instance-session-${index}`,
      instanceId: "instance-shared"
    });
    assert.equal(decision.ok, true);
    state = decision.state;
  }

  const rejected = acquireRemoteBrowserConnection(state, limitedConfig, {
    nowMs: nowMs + limitedConfig.instanceConnections + 1,
    userId: "user-over",
    ticket: "instance-ticket-over",
    clientId: "instance-client-over",
    sessionId: "instance-session-over",
    instanceId: "instance-shared"
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "REMOTE_INSTANCE_CONNECTION_LIMIT");
});

test("releasing a browser connection frees the ticket for reuse", () => {
  const nowMs = Date.UTC(2026, 2, 24, 12, 0, 0);
  const acquired = acquireRemoteBrowserConnection(createEmptyRemoteQuotaState(nowMs), CONFIG, {
    nowMs,
    userId: "user-a",
    ticket: "ticket-a",
    clientId: "client-a",
    sessionId: "session-a",
    instanceId: "instance-a"
  });
  assert.equal(acquired.ok, true);

  const released = releaseRemoteBrowserConnection(acquired.state, nowMs + 1_000, "user-a", "ticket-a");
  assert.equal(released.ok, true);
  assert.equal(released.data.released, true);

  const reacquired = acquireRemoteBrowserConnection(released.state, CONFIG, {
    nowMs: nowMs + 2_000,
    userId: "user-a",
    ticket: "ticket-b",
    clientId: "client-b",
    sessionId: "session-a",
    instanceId: "instance-a"
  });
  assert.equal(reacquired.ok, true);
});

test("platform daily worker budget rejects requests after the safety waterline", () => {
  const nowMs = Date.UTC(2026, 2, 24, 0, 0, 0);
  let state = createEmptyRemoteQuotaState(nowMs);
  const limitedConfig = {
    ...CONFIG,
    platformDailyWorkerRequestBudget: 10,
    platformDailyReservePercent: 20
  };

  for (let index = 0; index < 8; index += 1) {
    const decision = consumeRemoteRequestQuota(state, limitedConfig, {
      nowMs: nowMs + index,
      userId: "user-a",
      sessionId: `session-${index}`,
      operationCost: REMOTE_RUNTIME_REQUEST_COST
    });
    assert.equal(decision.ok, true);
    state = decision.state;
  }

  const rejected = consumeRemoteRequestQuota(state, limitedConfig, {
    nowMs: nowMs + 9_000,
    userId: "user-a",
    sessionId: "session-over",
    operationCost: REMOTE_RUNTIME_REQUEST_COST
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "REMOTE_PLATFORM_WORKER_DAILY_BUDGET_EXCEEDED");
});

test("platform daily durable object budget rejects new traffic after the safety waterline", () => {
  const nowMs = Date.UTC(2026, 2, 24, 0, 0, 0);
  let state = createEmptyRemoteQuotaState(nowMs);
  const limitedConfig = {
    ...CONFIG,
    platformDailyDoRequestBudgetMilli: 4_000,
    platformDailyReservePercent: 25
  };

  const admitted = acquireRemoteBrowserConnection(state, limitedConfig, {
    nowMs,
    userId: "user-a",
    ticket: "ticket-a",
    clientId: "client-a",
    sessionId: "session-a",
    instanceId: "instance-a"
  });
  assert.equal(admitted.ok, true);
  state = admitted.state;

  const rejected = consumeRemoteRequestQuota(state, limitedConfig, {
    nowMs: nowMs + 1_000,
    userId: "user-a",
    sessionId: "session-a",
    operationCost: REMOTE_PROXY_REQUEST_COST
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED");
});

test("user daily worker budget stops one user before it can monopolize the platform", () => {
  const nowMs = Date.UTC(2026, 2, 24, 0, 0, 0);
  let state = createEmptyRemoteQuotaState(nowMs);
  const limitedConfig = {
    ...CONFIG,
    userDailyWorkerRequestUnits: 3
  };

  for (let index = 0; index < 3; index += 1) {
    const decision = consumeRemoteRequestQuota(state, limitedConfig, {
      nowMs: nowMs + index,
      userId: "user-a",
      sessionId: `session-${index}`,
      operationCost: REMOTE_RUNTIME_REQUEST_COST
    });
    assert.equal(decision.ok, true);
    state = decision.state;
  }

  const rejected = consumeRemoteRequestQuota(state, limitedConfig, {
    nowMs: nowMs + 4_000,
    userId: "user-a",
    sessionId: "session-over",
    operationCost: REMOTE_RUNTIME_REQUEST_COST
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "REMOTE_USER_DAILY_WORKER_BUDGET_EXCEEDED");
});

test("user daily durable object budget blocks once the user's share is exhausted", () => {
  const nowMs = Date.UTC(2026, 2, 24, 0, 0, 0);
  let state = createEmptyRemoteQuotaState(nowMs);
  const limitedConfig = {
    ...CONFIG,
    userDailyDoRequestBudgetMilli: REMOTE_BROWSER_CONNECT_COST.durableObjectMilliUnits
  };

  const admitted = acquireRemoteBrowserConnection(state, limitedConfig, {
    nowMs,
    userId: "user-a",
    ticket: "ticket-a",
    clientId: "client-a",
    sessionId: "session-a",
    instanceId: "instance-a"
  });
  assert.equal(admitted.ok, true);
  state = admitted.state;

  const rejected = consumeRemoteRequestQuota(state, limitedConfig, {
    nowMs: nowMs + 1_000,
    userId: "user-a",
    sessionId: "session-a",
    operationCost: REMOTE_RUNTIME_REQUEST_COST
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "REMOTE_USER_DAILY_DO_BUDGET_EXCEEDED");
});

test("ws lease batches multiple browser messages under one quota decision", () => {
  const nowMs = Date.UTC(2026, 2, 24, 12, 0, 0);
  const limitedConfig = {
    ...CONFIG,
    sessionRequestsPerMinute: 5
  };
  const decision = leaseRemoteBrowserMessages(createEmptyRemoteQuotaState(nowMs), limitedConfig, {
    nowMs,
    userId: "user-a",
    sessionId: "session-a",
    requestedMessages: 3
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.data.grantedMessages, 3);

  const resized = leaseRemoteBrowserMessages(decision.state, limitedConfig, {
    nowMs: nowMs + 1_000,
    userId: "user-a",
    sessionId: "session-a",
    requestedMessages: 3
  });
  assert.equal(resized.ok, true);
  assert.equal(resized.data.grantedMessages, 2);
});

test("browser connection admission also respects daily budgets", () => {
  const nowMs = Date.UTC(2026, 2, 24, 12, 0, 0);
  const limitedConfig = {
    ...CONFIG,
    userDailyWorkerRequestUnits: REMOTE_BROWSER_CONNECT_COST.workerRequestUnits,
    userDailyDoRequestBudgetMilli: REMOTE_BROWSER_CONNECT_COST.durableObjectMilliUnits
  };

  const admitted = acquireRemoteBrowserConnection(createEmptyRemoteQuotaState(nowMs), limitedConfig, {
    nowMs,
    userId: "user-a",
    ticket: "ticket-a",
    clientId: "client-a",
    sessionId: "session-a",
    instanceId: "instance-a"
  });
  assert.equal(admitted.ok, true);

  const rejected = acquireRemoteBrowserConnection(admitted.state, limitedConfig, {
    nowMs: nowMs + 1_000,
    userId: "user-a",
    ticket: "ticket-b",
    clientId: "client-b",
    sessionId: "session-b",
    instanceId: "instance-b"
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "REMOTE_USER_DAILY_WORKER_BUDGET_EXCEEDED");
});

test("quota summaries expose user usage and platform waterline clearly", () => {
  const nowMs = Date.UTC(2026, 2, 24, 12, 0, 0);
  let state = createEmptyRemoteQuotaState(nowMs);
  const limitedConfig = {
    ...CONFIG,
    platformDailyWorkerRequestBudget: 10,
    platformDailyDoRequestBudgetMilli: 10_000,
    platformDailyReservePercent: 20,
    userDailyWorkerRequestUnits: 3,
    userDailyDoRequestBudgetMilli: 4_000
  };

  const connected = acquireRemoteBrowserConnection(state, limitedConfig, {
    nowMs,
    userId: "user-a",
    ticket: "ticket-a",
    clientId: "client-a",
    sessionId: "session-a",
    instanceId: "instance-a"
  });
  assert.equal(connected.ok, true);
  state = connected.state;

  const consumed = consumeRemoteRequestQuota(state, limitedConfig, {
    nowMs: nowMs + 1_000,
    userId: "user-a",
    sessionId: "session-a",
    operationCost: REMOTE_RUNTIME_REQUEST_COST
  });
  assert.equal(consumed.ok, true);
  state = consumed.state;

  const userSummary = readRemoteQuotaUserSummary(state, limitedConfig, "user-a", nowMs + 2_000);
  assert.equal(userSummary.workerRequests.limit, 3);
  assert.equal(userSummary.workerRequests.used, 2);
  assert.equal(userSummary.workerRequests.remaining, 1);
  assert.equal(userSummary.durableObjectRequests.limit, 4);
  assert.equal(userSummary.durableObjectRequests.used, 3);
  assert.equal(userSummary.activeBrowserConnections, 1);

  const platformSummary = readRemoteQuotaPlatformSummary(state, limitedConfig, nowMs + 2_000);
  assert.equal(platformSummary.workerRequests.configuredLimit, 10);
  assert.equal(platformSummary.workerRequests.enforcedLimit, 8);
  assert.equal(platformSummary.workerRequests.used, 2);
  assert.equal(platformSummary.workerRequests.remaining, 6);
  assert.equal(platformSummary.durableObjectRequests.configuredLimit, 10);
  assert.equal(platformSummary.durableObjectRequests.enforcedLimit, 8);
  assert.equal(platformSummary.durableObjectRequests.used, 3);
  assert.equal(platformSummary.defaultUserWorkerBudget, 3);
  assert.equal(platformSummary.defaultUserDoBudget, 4);
});
