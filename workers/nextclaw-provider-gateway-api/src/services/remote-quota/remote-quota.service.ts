export {
  DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET,
  DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT,
  DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
  DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS,
  DEFAULT_REMOTE_QUOTA_SESSION_REQUESTS_PER_MINUTE,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
  REMOTE_BROWSER_CONNECT_COST,
  REMOTE_PROXY_REQUEST_COST,
  REMOTE_QUOTA_CONNECTION_RETRY_AFTER_SECONDS,
  REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS,
  REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS,
  REMOTE_QUOTA_WINDOW_MS,
  REMOTE_RUNTIME_REQUEST_COST,
  type ConnectionUsage,
  type RemoteQuotaBudgets,
  type RemoteQuotaConfig,
  type RemoteQuotaDailyUsage,
  type RemoteQuotaDecision,
  type RemoteQuotaError,
  type RemoteQuotaFailure,
  type RemoteQuotaOperationCost,
  type RemoteQuotaPlatformSummary,
  type RemoteQuotaSessionState,
  type RemoteQuotaState,
  type RemoteQuotaSuccess,
  type RemoteQuotaTicket,
  type RemoteQuotaUsageSummary,
  type RemoteQuotaUserState,
  type RemoteQuotaUserSummary,
  type RemoteQuotaWindow,
  type RequestWindowUsage,
} from "@/configs/remote-quota/remote-quota.config.js";

import {
  REMOTE_BROWSER_CONNECT_COST,
  REMOTE_QUOTA_CONNECTION_RETRY_AFTER_SECONDS,
  type RemoteQuotaConfig,
  type RemoteQuotaDecision,
  type RemoteQuotaError,
  type RemoteQuotaOperationCost,
  type RemoteQuotaState,
} from "@/configs/remote-quota/remote-quota.config.js";
import {
  computeMaxGrantableWsMessages,
  createWsLeaseCost,
  evaluateDailyBudget,
  resolveWsLeaseBlockingError,
} from "@/utils/remote-quota/remote-quota-budget.utils.js";
import {
  addDailyUsage,
  addWindowCount,
  applyUserState,
  collectConnectionUsage,
  createWindow,
  getUserState,
  incrementWindow,
  normalizeRemoteQuotaState,
  readRequestWindowUsage,
  secondsUntilWindowReset,
} from "@/utils/remote-quota/remote-quota-state.utils.js";

export { createEmptyRemoteQuotaState } from "@/utils/remote-quota/remote-quota-state.utils.js";
export {
  readRemoteQuotaPlatformSummary,
  readRemoteQuotaUserSummary
} from "@/utils/remote-quota/remote-quota-summary.utils.js";

export function acquireRemoteBrowserConnection(
  state: RemoteQuotaState | null | undefined,
  config: RemoteQuotaConfig,
  input: {
    nowMs: number;
    userId: string;
    ticket: string;
    clientId: string;
    sessionId: string;
    instanceId: string;
  }
): RemoteQuotaDecision<{ ticket: string }> {
  const normalizedState = normalizeRemoteQuotaState(state, input.nowMs);
  const userState = getUserState(normalizedState, input.userId, input.nowMs);
  const usage = collectConnectionUsage(normalizedState, input.instanceId);

  if (usage.instanceCount >= config.instanceConnections) {
    return reject(normalizedState, {
      code: "REMOTE_INSTANCE_CONNECTION_LIMIT",
      message: "Remote access is temporarily degraded because this instance has too many active browser connections.",
      retryAfterSeconds: REMOTE_QUOTA_CONNECTION_RETRY_AFTER_SECONDS
    });
  }

  const dailyError = evaluateDailyBudget(
    config,
    normalizedState.platformDailyUsage,
    userState.dailyUsage,
    input.nowMs,
    REMOTE_BROWSER_CONNECT_COST
  );
  if (dailyError) {
    return reject(normalizedState, dailyError);
  }

  return {
    ok: true,
    data: { ticket: input.ticket },
    state: {
      ...applyUserState(normalizedState, input.userId, {
        ...userState,
        dailyUsage: addDailyUsage(userState.dailyUsage, REMOTE_BROWSER_CONNECT_COST),
        browserConnections: {
          ...userState.browserConnections,
          [input.ticket]: {
            ticket: input.ticket,
            clientId: input.clientId,
            sessionId: input.sessionId,
            instanceId: input.instanceId,
            connectedAtMs: input.nowMs
          }
        }
      }),
      platformDailyUsage: addDailyUsage(normalizedState.platformDailyUsage, REMOTE_BROWSER_CONNECT_COST)
    }
  };
}

export function releaseRemoteBrowserConnection(
  state: RemoteQuotaState | null | undefined,
  nowMs: number,
  userId: string,
  ticket: string
): RemoteQuotaDecision<{ released: boolean }> {
  const normalizedState = normalizeRemoteQuotaState(state, nowMs);
  const userState = getUserState(normalizedState, userId, nowMs);
  if (!userState.browserConnections[ticket]) {
    return {
      ok: true,
      data: { released: false },
      state: normalizedState
    };
  }
  const nextConnections = { ...userState.browserConnections };
  delete nextConnections[ticket];
  return {
    ok: true,
    data: { released: true },
    state: applyUserState(normalizedState, userId, {
      ...userState,
      browserConnections: nextConnections
    })
  };
}

export function consumeRemoteRequestQuota(
  state: RemoteQuotaState | null | undefined,
  config: RemoteQuotaConfig,
  input: {
    nowMs: number;
    userId: string;
    sessionId: string;
    operationCost: RemoteQuotaOperationCost;
  }
): RemoteQuotaDecision<{ remainingSessionRequests: number }> {
  const normalizedState = normalizeRemoteQuotaState(state, input.nowMs);
  const userState = getUserState(normalizedState, input.userId, input.nowMs);
  const sessionState = userState.sessions[input.sessionId] ?? { requestWindow: createWindow(input.nowMs) };
  const usage = readRequestWindowUsage(sessionState, input.nowMs);

  if (usage.sessionWindow.count >= config.sessionRequestsPerMinute) {
    return reject(normalizedState, {
      code: "REMOTE_SESSION_RATE_LIMITED",
      message: "Remote access is temporarily degraded because this session is sending requests too quickly.",
      retryAfterSeconds: secondsUntilWindowReset(input.nowMs)
    });
  }

  const dailyError = evaluateDailyBudget(
    config,
    normalizedState.platformDailyUsage,
    userState.dailyUsage,
    input.nowMs,
    input.operationCost
  );
  if (dailyError) {
    return reject(normalizedState, dailyError);
  }

  const nextSessionWindow = incrementWindow(usage.sessionWindow);
  return {
    ok: true,
    data: {
      remainingSessionRequests: Math.max(0, config.sessionRequestsPerMinute - nextSessionWindow.count)
    },
    state: {
      ...applyUserState(normalizedState, input.userId, {
        ...userState,
        dailyUsage: addDailyUsage(userState.dailyUsage, input.operationCost),
        sessions: {
          ...userState.sessions,
          [input.sessionId]: {
            requestWindow: nextSessionWindow
          }
        }
      }),
      platformDailyUsage: addDailyUsage(normalizedState.platformDailyUsage, input.operationCost)
    }
  };
}

export function leaseRemoteBrowserMessages(
  state: RemoteQuotaState | null | undefined,
  config: RemoteQuotaConfig,
  input: {
    nowMs: number;
    userId: string;
    sessionId: string;
    requestedMessages: number;
  }
): RemoteQuotaDecision<{ grantedMessages: number }> {
  const normalizedState = normalizeRemoteQuotaState(state, input.nowMs);
  const userState = getUserState(normalizedState, input.userId, input.nowMs);
  const sessionState = userState.sessions[input.sessionId] ?? { requestWindow: createWindow(input.nowMs) };
  const usage = readRequestWindowUsage(sessionState, input.nowMs);
  const maxByMinute = Math.max(0, config.sessionRequestsPerMinute - usage.sessionWindow.count);
  const maxByDaily = computeMaxGrantableWsMessages(
    config,
    normalizedState.platformDailyUsage,
    userState.dailyUsage
  );
  const grantedMessages = Math.min(Math.max(1, input.requestedMessages), maxByMinute, maxByDaily);
  if (grantedMessages <= 0) {
    return reject(
      normalizedState,
      resolveWsLeaseBlockingError(config, normalizedState.platformDailyUsage, userState.dailyUsage, sessionState, input.nowMs)
    );
  }

  const leaseCost = createWsLeaseCost(grantedMessages);
  const nextSessionWindow = addWindowCount(usage.sessionWindow, grantedMessages);
  return {
    ok: true,
    data: { grantedMessages },
    state: {
      ...applyUserState(normalizedState, input.userId, {
        ...userState,
        dailyUsage: addDailyUsage(userState.dailyUsage, leaseCost),
        sessions: {
          ...userState.sessions,
          [input.sessionId]: {
            requestWindow: nextSessionWindow
          }
        }
      }),
      platformDailyUsage: addDailyUsage(normalizedState.platformDailyUsage, leaseCost)
    }
  };
}

function reject(state: RemoteQuotaState, error: RemoteQuotaError) {
  return {
    ok: false,
    error,
    state
  } as const;
}
